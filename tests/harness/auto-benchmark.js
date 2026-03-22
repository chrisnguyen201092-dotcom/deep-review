#!/usr/bin/env node
/**
 * Auto Benchmark — Fully automated blind test runner
 * 
 * Sends each project to the Anthropic API (or compatible endpoint) for review,
 * collects JSON results, and scores them automatically.
 * 
 * Usage:
 *   set ANTHROPIC_API_KEY=sk-ant-...
 *   set GROUND_TRUTH_KEY=7053e25df5697fc26ecd5b799e123f0d9f5076c59b44c9322ae155edfe25095a
 *   node auto-benchmark.js --tier 1
 *   node auto-benchmark.js --tier 2
 *   node auto-benchmark.js --tier 3                    (all 10 projects)
 *   node auto-benchmark.js --tier 1 --model claude-sonnet-4-20250514
 *   node auto-benchmark.js --tier 1 --provider openai  (use OpenAI API instead)
 */

const fs = require('fs');
const path = require('path');
const { generatePrompt } = require('./quick-eval');

const TIERS = {
  '1': ['S1-rest-api-utility', 'S2-cli-tool'],
  '2': ['S1-rest-api-utility', 'S2-cli-tool', 'M1-ecommerce-backend', 'L1-cms'],
  '3': [
    'S1-rest-api-utility', 'S2-cli-tool',
    'M1-ecommerce-backend', 'M2-auth-service', 'M3-task-queue',
    'L1-cms', 'L2-analytics', 'L3-gateway',
    'XL1-saas-app', 'XL2-data-platform',
  ],
};

const SKILL_PATH = path.join(__dirname, '..', '..', 'skills', 'deep-code-review', 'SKILL.md');
const RESULTS_DIR = path.join(__dirname, '..', 'results', 'auto-eval');

// ===== API Providers =====

async function callAnthropic(prompt, model, apiKey) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.content[0].text;
}

async function callOpenAI(prompt, model, apiKey) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

// ===== JSON Extraction =====

function extractJSON(text) {
  // Try to find JSON block in markdown code fence
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1]); } catch (e) {}
  }
  // Try to find raw JSON object
  const jsonMatch = text.match(/\{[\s\S]*"findings"[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch (e) {}
  }
  // Try entire text as JSON
  try { return JSON.parse(text); } catch (e) {}
  
  throw new Error('Could not extract JSON from AI response');
}

// ===== Main =====

async function main() {
  const args = process.argv.slice(2);
  const getArg = (name) => { const i = args.indexOf(name); return i !== -1 ? args[i + 1] : null; };
  const hasFlag = (name) => args.includes(name);

  const tier = getArg('--tier') || '1';
  const provider = getArg('--provider') || 'anthropic';
  const model = getArg('--model') || (provider === 'openai' ? 'gpt-4o' : 'claude-sonnet-4-20250514');
  const skillPath = getArg('--skill') || SKILL_PATH;
  const gtKey = getArg('--key') || process.env.GROUND_TRUTH_KEY;
  const apiKey = provider === 'openai'
    ? (getArg('--api-key') || process.env.OPENAI_API_KEY)
    : (getArg('--api-key') || process.env.ANTHROPIC_API_KEY);

  if (!apiKey) {
    console.error(`❌ Missing API key. Set ${provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY'} env var or use --api-key`);
    process.exit(1);
  }
  if (!gtKey) {
    console.error('❌ Missing ground truth key. Set GROUND_TRUTH_KEY env var or use --key');
    process.exit(1);
  }

  const projects = TIERS[tier];
  if (!projects) {
    console.error(`❌ Invalid tier: ${tier}. Use 1, 2, or 3`);
    process.exit(1);
  }

  const callAPI = provider === 'openai' ? callOpenAI : callAnthropic;

  console.log(`\n🚀 Auto Benchmark`);
  console.log(`   Provider: ${provider} (${model})`);
  console.log(`   Tier:     ${tier} (${projects.length} projects)`);
  console.log(`   Skill:    ${path.basename(skillPath)}`);
  console.log('');

  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const allResults = {};

  for (let i = 0; i < projects.length; i++) {
    const project = projects[i];
    console.log(`[${i + 1}/${projects.length}] Reviewing ${project}...`);

    try {
      // Generate prompt
      const prompt = generatePrompt(project, skillPath);
      console.log(`   📝 Prompt: ${prompt.length} chars`);

      // Call AI
      const startTime = Date.now();
      const response = await callAPI(prompt, model, apiKey);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`   🤖 Response: ${response.length} chars (${elapsed}s)`);

      // Extract JSON
      const result = extractJSON(response);
      result.project = project;
      result.model = model;
      result.provider = provider;
      result.reviewed_at = new Date().toISOString();
      result.response_time_seconds = parseFloat(elapsed);
      
      // Save result
      const resultPath = path.join(RESULTS_DIR, `${project}.json`);
      fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
      console.log(`   💾 Saved: ${result.findings?.length || 0} findings`);
      
      allResults[project] = result;
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`);
      // Save empty result so scoring can continue
      const emptyResult = { project, findings: [], error: err.message };
      fs.writeFileSync(path.join(RESULTS_DIR, `${project}.json`), JSON.stringify(emptyResult, null, 2));
      allResults[project] = emptyResult;
    }

    // Rate limit pause (avoid 429s)
    if (i < projects.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Score all results
  console.log('\n' + '═'.repeat(60));
  console.log('📊 SCORING');
  console.log('═'.repeat(60) + '\n');

  // Use the score.js module
  const { exec } = require('child_process');
  const scoreCmd = `node "${path.join(__dirname, 'score.js')}" --results "${RESULTS_DIR}" --key "${gtKey}" --skill "${model}" --tier ${tier} --output "${path.join(RESULTS_DIR, 'report.json')}"`;
  
  const child = exec(scoreCmd, (error, stdout, stderr) => {
    console.log(stdout);
    if (stderr) console.error(stderr);
    
    console.log('\n✅ Done! Results saved to:');
    console.log(`   ${RESULTS_DIR}/`);
    for (const project of projects) {
      console.log(`   ├── ${project}.json`);
    }
    console.log(`   └── report.json`);
  });
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
