#!/usr/bin/env node
/**
 * Quick Eval — Run a rapid evaluation cycle for skill iteration
 * 
 * This script:
 * 1. Generates a review prompt for a single project
 * 2. Prints it (or copies to clipboard) for pasting into an AI tool
 * 3. After you paste the AI's result back, it scores immediately
 * 
 * Usage:
 *   node quick-eval.js --project S1-rest-api-utility --key <key>
 *   node quick-eval.js --tier 1 --key <key>    (scores all Tier 1 projects)
 *   node quick-eval.js score --result result.json --project S1-rest-api-utility --key <key>
 */

const fs = require('fs');
const path = require('path');
const { decryptSingleFile } = require('./encrypt');
const { scoreProject } = require('./score');

const PROJECTS_DIR = path.join(__dirname, '..', 'projects');
const ENCRYPTED_DIR = path.join(__dirname, '..', 'ground-truth-encrypted');

function generatePrompt(projectName, skillPath) {
  const projectDir = path.join(PROJECTS_DIR, projectName);
  if (!fs.existsSync(projectDir)) {
    console.error(`Project not found: ${projectDir}`);
    process.exit(1);
  }

  // Read skill instructions
  let skillInstructions = '';
  if (skillPath && fs.existsSync(skillPath)) {
    const raw = fs.readFileSync(skillPath, 'utf8');
    // Strip YAML frontmatter
    const match = raw.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
    skillInstructions = match ? match[1].trim() : raw;
  }

  // Gather source files
  const files = getAllFiles(projectDir, ['.js', '.py']);
  const fileContents = files.map(f => {
    const rel = path.relative(projectDir, f).replace(/\\/g, '/');
    const content = fs.readFileSync(f, 'utf8');
    const ext = path.extname(f).slice(1);
    const lang = ext === 'js' ? 'javascript' : ext === 'py' ? 'python' : ext;
    return { path: rel, content, lang, lines: content.split('\n').length };
  });

  const totalLOC = fileContents.reduce((s, f) => s + f.lines, 0);

  let prompt = '';
  
  if (skillInstructions) {
    prompt += skillInstructions + '\n\n---\n\n';
  }

  prompt += `# Code Review: ${projectName}\n\n`;
  prompt += `**${files.length} files, ${totalLOC} LOC**\n\n`;
  prompt += `Please review this codebase and return your findings as JSON in this exact format:\n`;
  prompt += '```json\n{"project":"' + projectName + '","findings":[{"file":"src/path.js","line_start":1,"line_end":5,"severity":"HIGH","category":"security","title":"Short title","description":"Details"}]}\n```\n\n';

  for (const f of fileContents) {
    prompt += `## ${f.path}\n\`\`\`${f.lang}\n${f.content}\n\`\`\`\n\n`;
  }

  return prompt;
}

function scoreResult(resultPath, projectName, keyHex) {
  // Decrypt ground truth for this project
  const encPath = path.join(ENCRYPTED_DIR, `${projectName}.enc`);
  if (!fs.existsSync(encPath)) {
    console.error(`No encrypted ground truth for: ${projectName}`);
    process.exit(1);
  }

  const groundTruth = decryptSingleFile(encPath, keyHex);
  
  // Load result
  let result;
  try {
    result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
  } catch (e) {
    console.error(`Failed to parse result file: ${e.message}`);
    process.exit(1);
  }

  const findings = result.findings || [];
  console.log(`\n📊 Scoring ${projectName}: ${findings.length} findings vs ${groundTruth.total_bugs} bugs\n`);

  const score = scoreProject(findings, groundTruth, projectName);

  // Pretty print
  console.log('━'.repeat(60));
  console.log(`  Project:   ${projectName}`);
  console.log(`  Bugs:      ${score.total_bugs} total`);
  console.log(`  Found:     ${score.true_positives} TP (${(score.recall * 100).toFixed(0)}% recall)`);
  console.log(`  Missed:    ${score.false_negatives} FN`);
  console.log(`  False pos: ${score.false_positives} FP`);
  console.log(`  FP traps:  ${score.fp_traps_triggered}/${score.total_fp_traps} triggered`);
  console.log('━'.repeat(60));
  console.log(`  Precision: ${(score.precision * 100).toFixed(1)}%`);
  console.log(`  Recall:    ${(score.recall * 100).toFixed(1)}%`);
  console.log(`  F1 Score:  ${(score.f1_score * 100).toFixed(1)}%`);
  console.log('━'.repeat(60));

  if (score.missed_bugs.length > 0) {
    console.log('\n❌ Missed bugs:');
    for (const b of score.missed_bugs) {
      console.log(`  ${b.bug_id} [${b.severity}] [${b.difficulty}] ${b.title}`);
    }
  }

  if (score.fp_traps_hit.length > 0) {
    console.log('\n⚠️  FP traps triggered (should NOT have been flagged):');
    for (const f of score.fp_traps_hit) {
      console.log(`  ${f.trap_id} (match score: ${f.match_score})`);
    }
  }

  if (score.matched_bugs.length > 0) {
    console.log('\n✅ Found bugs:');
    for (const m of score.matched_bugs) {
      console.log(`  ${m.bug_id} [${m.severity}] [${m.difficulty}] (match: ${m.match_score})`);
    }
  }

  return score;
}

function getAllFiles(dir, extensions) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) results = results.concat(getAllFiles(fullPath, extensions));
    else if (extensions.some(ext => entry.name.endsWith(ext))) results.push(fullPath);
  }
  return results;
}

// CLI
const args = process.argv.slice(2);
const command = args[0];
const getArg = (name) => { const i = args.indexOf(name); return i !== -1 ? args[i + 1] : null; };

if (command === 'prompt') {
  const project = getArg('--project') || 'S1-rest-api-utility';
  const skill = getArg('--skill') || path.join(__dirname, '..', '..', 'skills', 'deep-code-review', 'SKILL.md');
  const outputPath = getArg('--output');
  
  const prompt = generatePrompt(project, skill);
  
  if (outputPath) {
    fs.writeFileSync(outputPath, prompt);
    console.log(`Prompt saved to: ${outputPath} (${prompt.length} chars)`);
  } else {
    console.log(prompt);
  }

} else if (command === 'score') {
  const resultPath = getArg('--result');
  const project = getArg('--project');
  const key = getArg('--key') || process.env.GROUND_TRUTH_KEY;
  
  if (!resultPath || !project || !key) {
    console.error('Usage: node quick-eval.js score --result <file.json> --project <name> --key <key>');
    process.exit(1);
  }
  scoreResult(resultPath, project, key);

} else {
  console.log('Quick Eval — Rapid skill iteration tool\n');
  console.log('Commands:');
  console.log('  prompt  Generate a review prompt for a project');
  console.log('  score   Score AI results against ground truth\n');
  console.log('Examples:');
  console.log('  node quick-eval.js prompt --project S1-rest-api-utility > prompt.md');
  console.log('  node quick-eval.js prompt --project S1-rest-api-utility --skill path/to/SKILL.md');
  console.log('  node quick-eval.js score --result result.json --project S1-rest-api-utility --key <key>');
}

module.exports = { generatePrompt, scoreResult };
