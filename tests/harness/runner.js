#!/usr/bin/env node
/**
 * Benchmark Runner — Generates review prompts and collects results
 * 
 * Usage:
 *   node runner.js prepare --skill <skill_name> --output <prompts_dir>
 *   node runner.js collect --input <raw_results_dir> --output <normalized_dir>
 * 
 * Workflow:
 *   1. `prepare` generates prompt files to feed to AI tools
 *   2. Run the AI tool on each project (manually or via automation)
 *   3. Save raw AI output to <raw_results_dir>/<project>.txt
 *   4. `collect` normalizes raw output to structured JSON findings
 *      (or you can write JSON directly)
 *   5. Use `score.js` to score the normalized results
 */

const fs = require('fs');
const path = require('path');

const PROJECTS_DIR = path.join(__dirname, '..', 'projects');

function preparePrompts(skillName, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });

  const projects = fs.readdirSync(PROJECTS_DIR).filter(d => {
    return fs.statSync(path.join(PROJECTS_DIR, d)).isDirectory();
  });

  console.log(`Preparing review prompts for ${projects.length} projects using skill: ${skillName}\n`);

  for (const project of projects) {
    const projectDir = path.join(PROJECTS_DIR, project);
    const files = getAllFiles(projectDir, ['.js', '.py']);
    
    if (files.length === 0) continue;

    // Build file listing
    const fileListing = files.map(f => {
      const rel = path.relative(projectDir, f).replace(/\\/g, '/');
      const content = fs.readFileSync(f, 'utf8');
      const lines = content.split('\n').length;
      return { path: rel, lines, content };
    });

    const totalLOC = fileListing.reduce((s, f) => s + f.lines, 0);

    // Generate prompt
    const prompt = generateReviewPrompt(project, fileListing, totalLOC, skillName);
    
    const promptPath = path.join(outputDir, `${project}.md`);
    fs.writeFileSync(promptPath, prompt);
    console.log(`  ✓ ${project}: ${files.length} files, ${totalLOC} LOC → ${promptPath}`);
  }

  // Generate result template
  const templatePath = path.join(outputDir, '_result_template.json');
  fs.writeFileSync(templatePath, JSON.stringify({
    project: "PROJECT_NAME",
    skill: skillName,
    reviewed_at: "",
    findings: [
      {
        file: "src/path/to/file.js",
        line_start: 0,
        line_end: 0,
        severity: "CRITICAL|HIGH|MEDIUM|LOW",
        category: "security|logic|performance|reliability",
        title: "Short title",
        description: "Detailed description of the issue",
      }
    ]
  }, null, 2));

  console.log(`\nPrompts saved to: ${outputDir}`);
  console.log(`Result template: ${templatePath}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Run the AI tool on each project`);
  console.log(`  2. Save results as JSON in a results directory (follow _result_template.json format)`);
  console.log(`  3. Score: node score.js --results <results_dir> --key <key> --skill ${skillName}`);
}

function generateReviewPrompt(project, files, totalLOC, skillName) {
  const fileList = files.map(f => `- \`${f.path}\` (${f.lines} lines)`).join('\n');
  
  const codeBlocks = files.map(f => {
    const ext = path.extname(f.path).slice(1);
    const lang = ext === 'js' ? 'javascript' : ext === 'py' ? 'python' : ext;
    return `### ${f.path}\n\`\`\`${lang}\n${f.content}\n\`\`\``;
  }).join('\n\n');

  return `# Code Review: ${project}

## Project Overview
- **Files**: ${files.length}
- **Total LOC**: ${totalLOC}

## Files
${fileList}

## Instructions
Perform a thorough code review of this project. Focus on:
1. **Security vulnerabilities** (SQL injection, XSS, command injection, path traversal, auth/authz issues, etc.)
2. **Logic bugs** (race conditions, off-by-one, incorrect state management, etc.)
3. **Reliability issues** (error handling, data loss, concurrency bugs, etc.)
4. **Performance problems** (N+1 queries, blocking operations, memory leaks, etc.)

For each finding, provide:
- **File** and **line number(s)**
- **Severity**: CRITICAL, HIGH, MEDIUM, or LOW
- **Category**: security, logic, performance, or reliability
- **Title**: A short, specific title
- **Description**: Detailed explanation of the issue and its impact

**IMPORTANT**: Only report REAL issues. Do not flag standard patterns, intentional design decisions, or correct implementations as bugs.

## Source Code

${codeBlocks}
`;
}

function getAllFiles(dir, extensions) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, extensions));
    } else if (extensions.some(ext => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

function collectResults(inputDir, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  
  const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.json'));
  console.log(`Collecting ${files.length} result files...`);
  
  for (const file of files) {
    const content = JSON.parse(fs.readFileSync(path.join(inputDir, file), 'utf8'));
    
    // Normalize findings format
    if (content.findings && Array.isArray(content.findings)) {
      content.findings = content.findings.map(f => ({
        file: normalizeFilePath(f.file || f.path || ''),
        line_start: f.line_start || f.lineStart || f.line || 0,
        line_end: f.line_end || f.lineEnd || f.line_start || f.line || 0,
        severity: (f.severity || 'MEDIUM').toUpperCase(),
        category: f.category || 'security',
        title: f.title || f.summary || '',
        description: f.description || f.details || '',
      }));
    }
    
    fs.writeFileSync(path.join(outputDir, file), JSON.stringify(content, null, 2));
    console.log(`  ✓ ${file}: ${content.findings?.length || 0} findings`);
  }
  
  console.log(`\nNormalized results saved to: ${outputDir}`);
}

function normalizeFilePath(p) {
  return p.replace(/\\/g, '/').replace(/^\.\//, '');
}

// CLI
const args = process.argv.slice(2);
const command = args[0];
const getArg = (name) => { const i = args.indexOf(name); return i !== -1 ? args[i + 1] : null; };

if (command === 'prepare') {
  const skillName = getArg('--skill') || 'review';
  const outputDir = getArg('--output') || path.join(__dirname, '..', 'prompts');
  preparePrompts(skillName, outputDir);
} else if (command === 'collect') {
  const inputDir = getArg('--input');
  const outputDir = getArg('--output');
  if (!inputDir || !outputDir) {
    console.error('Usage: node runner.js collect --input <raw_dir> --output <normalized_dir>');
    process.exit(1);
  }
  collectResults(inputDir, outputDir);
} else {
  console.log('Benchmark Runner');
  console.log('');
  console.log('Commands:');
  console.log('  prepare  Generate review prompts for AI tools');
  console.log('  collect  Normalize raw results to structured JSON');
  console.log('');
  console.log('Usage:');
  console.log('  node runner.js prepare --skill <name> --output <dir>');
  console.log('  node runner.js collect --input <raw_dir> --output <normalized_dir>');
}
