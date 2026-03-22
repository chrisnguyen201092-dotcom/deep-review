#!/usr/bin/env node
/**
 * Benchmark Harness — Scores AI code review results against encrypted ground truth
 * 
 * Usage:
 *   node score.js --results <results_dir> --key <ground_truth_key>
 *   node score.js --results ./results/deep-review --key <key> --output report.json
 * 
 * Results Format:
 *   Each result file should be a JSON with:
 *   {
 *     "project": "S1-rest-api-utility",
 *     "findings": [
 *       { "file": "src/index.js", "line_start": 50, "severity": "CRITICAL", "title": "...", "description": "..." },
 *       ...
 *     ]
 *   }
 */

const fs = require('fs');
const path = require('path');
const { decryptAllFiles } = require('./encrypt');

// ========== MATCHING LOGIC ==========

function matchFinding(finding, bug) {
  // Score: 0.0 - 1.0 for how well a finding matches a ground truth bug
  let score = 0;
  let reasons = [];

  // File match (required)
  const findingFile = normalizeFile(finding.file);
  const bugFile = normalizeFile(bug.file);
  if (findingFile !== bugFile) return { score: 0, reasons: ['file mismatch'] };
  score += 0.3;
  reasons.push('file match');

  // Line range overlap
  const fStart = finding.line_start || 0;
  const fEnd = finding.line_end || fStart;
  const bStart = bug.line_start || 0;
  const bEnd = bug.line_end || bStart;
  
  if (fStart <= bEnd && fEnd >= bStart) {
    // Overlapping ranges
    const overlap = Math.min(fEnd, bEnd) - Math.max(fStart, bStart) + 1;
    const bugRange = bEnd - bStart + 1;
    const lineScore = Math.min(overlap / bugRange, 1.0) * 0.3;
    score += lineScore;
    reasons.push(`line overlap (${overlap}/${bugRange})`);
  } else {
    // Check if within 20 lines
    const distance = Math.min(Math.abs(fStart - bEnd), Math.abs(fEnd - bStart));
    if (distance <= 20) {
      score += 0.1;
      reasons.push(`nearby (${distance} lines away)`);
    }
  }

  // Semantic similarity — check keyword overlap in title/description
  const findingText = `${finding.title || ''} ${finding.description || ''}`.toLowerCase();
  const bugText = `${bug.title || ''} ${bug.description || ''}`.toLowerCase();
  const semanticScore = computeSemanticSimilarity(findingText, bugText);
  score += semanticScore * 0.4;
  reasons.push(`semantic: ${(semanticScore * 100).toFixed(0)}%`);

  return { score, reasons };
}

function computeSemanticSimilarity(text1, text2) {
  // Keyword-based similarity with domain-specific terms
  const keywords = extractKeywords(text1).concat(extractKeywords(text2));
  const unique = [...new Set(keywords)];
  if (unique.length === 0) return 0;
  
  const k1 = new Set(extractKeywords(text1));
  const k2 = new Set(extractKeywords(text2));
  
  let intersection = 0;
  for (const k of k1) { if (k2.has(k)) intersection++; }
  
  const union = new Set([...k1, ...k2]).size;
  return union > 0 ? intersection / union : 0;
}

function extractKeywords(text) {
  // Security/code review domain keywords
  const domainTerms = [
    'sql injection', 'xss', 'cross-site', 'path traversal', 'directory traversal',
    'command injection', 'rce', 'remote code', 'ssrf', 'server-side request',
    'idor', 'insecure direct', 'race condition', 'toctou', 'timing',
    'authentication', 'authorization', 'access control', 'privilege',
    'deserialization', 'pickle', 'unsafe', 'insecure',
    'hardcoded', 'secret', 'credential', 'password', 'plaintext',
    'rate limit', 'dos', 'denial', 'overflow', 'memory',
    'cors', 'csrf', 'header', 'injection', 'sanitiz', 'escap',
    'encrypt', 'hash', 'token', 'session', 'cookie',
    'file upload', 'mime', 'content-type', 'filename',
    'pci', 'card', 'payment', 'billing',
    'timezone', 'utc', 'datetime', 'deadlock', 'thread',
    'missing', 'unused', 'bypass', 'leak', 'expos',
  ];
  
  const found = [];
  for (const term of domainTerms) {
    if (text.includes(term)) found.push(term);
  }
  
  return found;
}

function normalizeFile(filePath) {
  return filePath.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^src\//, 'src/');
}

// ========== SCORING ==========

function scoreProject(findings, groundTruth, projectName) {
  const bugs = groundTruth.bugs || [];
  const fpTraps = groundTruth.fp_traps || [];

  // Match findings to bugs (Hungarian algorithm approximation — greedy best-match)
  const bugMatches = new Array(bugs.length).fill(null);
  const findingUsed = new Array(findings.length).fill(false);

  // Build score matrix
  const scores = [];
  for (let fi = 0; fi < findings.length; fi++) {
    for (let bi = 0; bi < bugs.length; bi++) {
      const matchResult = matchFinding(findings[fi], bugs[bi]);
      if (matchResult.score >= 0.4) { // Threshold for a plausible match
        scores.push({ fi, bi, score: matchResult.score, reasons: matchResult.reasons });
      }
    }
  }

  // Greedy match: highest scores first
  scores.sort((a, b) => b.score - a.score);
  for (const { fi, bi, score, reasons } of scores) {
    if (bugMatches[bi] === null && !findingUsed[fi]) {
      bugMatches[bi] = { findingIndex: fi, score, reasons };
      findingUsed[fi] = true;
    }
  }

  // Calculate metrics
  const truePositives = bugMatches.filter(m => m !== null);
  const falseNegatives = bugMatches.filter(m => m === null);
  const unmatchedFindings = findings.filter((_, i) => !findingUsed[i]);

  // Check false positive traps
  const fpTriggered = []; // Findings that match FP traps (bad — should NOT flag these)
  for (const finding of unmatchedFindings) {
    for (const trap of fpTraps) {
      const match = matchFinding(finding, { ...trap, title: trap.description, description: trap.why_not_bug });
      if (match.score >= 0.4) {
        fpTriggered.push({ finding, trap: trap.id, score: match.score });
        break;
      }
    }
  }

  const tp = truePositives.length;
  const fn = falseNegatives.length;
  const fp = unmatchedFindings.length;
  const fpFromTraps = fpTriggered.length;

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;

  return {
    project: projectName,
    tier: groundTruth.tier,
    total_bugs: bugs.length,
    total_fp_traps: fpTraps.length,
    true_positives: tp,
    false_negatives: fn,
    false_positives: fp,
    fp_traps_triggered: fpFromTraps,
    precision: round(precision, 4),
    recall: round(recall, 4),
    f1_score: round(f1, 4),
    matched_bugs: truePositives.map((m, i) => ({
      bug_id: bugs[bugMatches.indexOf(m)].id,
      severity: bugs[bugMatches.indexOf(m)].severity,
      difficulty: bugs[bugMatches.indexOf(m)].difficulty,
      match_score: round(m.score, 3),
    })),
    missed_bugs: bugs
      .filter((_, i) => bugMatches[i] === null)
      .map(b => ({ bug_id: b.id, severity: b.severity, difficulty: b.difficulty, title: b.title })),
    fp_traps_hit: fpTriggered.map(f => ({ trap_id: f.trap, match_score: round(f.score, 3) })),
  };
}

function round(num, decimals) {
  return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

// ========== STATISTICAL ANALYSIS ==========

function mcNemarTest(resultsA, resultsB) {
  /**
   * McNemar's test for comparing two classifiers
   * Uses matched-pairs on per-bug detection
   */
  let b = 0; // A correct, B wrong
  let c = 0; // A wrong, B correct

  for (const project of Object.keys(resultsA)) {
    const a = resultsA[project];
    const bRes = resultsB[project];
    if (!a || !bRes) continue;

    const bugsA = new Set(a.matched_bugs.map(m => m.bug_id));
    const bugsB = new Set(bRes.matched_bugs.map(m => m.bug_id));

    // Get all bug IDs from ground truth
    const allBugs = new Set([
      ...a.missed_bugs.map(m => m.bug_id),
      ...a.matched_bugs.map(m => m.bug_id),
    ]);

    for (const bugId of allBugs) {
      const aFound = bugsA.has(bugId);
      const bFound = bugsB.has(bugId);
      if (aFound && !bFound) b++;
      if (!aFound && bFound) c++;
    }
  }

  // McNemar's chi-squared statistic
  const chiSq = b + c > 0 ? Math.pow(Math.abs(b - c) - 1, 2) / (b + c) : 0;
  
  // Approximate p-value from chi-squared distribution (1 df)
  // Using Wilson-Hilferty approximation
  const pValue = chiSq > 0 ? Math.exp(-chiSq / 2) : 1.0;

  return {
    b_count: b,
    c_count: c,
    chi_squared: round(chiSq, 4),
    p_value: round(pValue, 6),
    significant_at_05: pValue < 0.05,
    significant_at_01: pValue < 0.01,
    winner: b > c ? 'A' : c > b ? 'B' : 'tie',
  };
}

// ========== AGGREGATE REPORT ==========

function generateReport(allResults, skillName) {
  const projects = Object.values(allResults);
  
  const totalBugs = projects.reduce((s, p) => s + p.total_bugs, 0);
  const totalTP = projects.reduce((s, p) => s + p.true_positives, 0);
  const totalFP = projects.reduce((s, p) => s + p.false_positives, 0);
  const totalFN = projects.reduce((s, p) => s + p.false_negatives, 0);
  const totalFPTraps = projects.reduce((s, p) => s + p.total_fp_traps, 0);
  const totalFPTriggered = projects.reduce((s, p) => s + p.fp_traps_triggered, 0);

  const precision = totalTP + totalFP > 0 ? totalTP / (totalTP + totalFP) : 0;
  const recall = totalTP + totalFN > 0 ? totalTP / (totalTP + totalFN) : 0;
  const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;

  // By tier
  const tiers = {};
  for (const p of projects) {
    if (!tiers[p.tier]) tiers[p.tier] = { tp: 0, fn: 0, fp: 0, bugs: 0 };
    tiers[p.tier].tp += p.true_positives;
    tiers[p.tier].fn += p.false_negatives;
    tiers[p.tier].fp += p.false_positives;
    tiers[p.tier].bugs += p.total_bugs;
  }
  for (const tier of Object.keys(tiers)) {
    const t = tiers[tier];
    t.recall = round(t.tp / t.bugs, 4);
    t.precision = round(t.tp / (t.tp + t.fp || 1), 4);
  }

  // By severity
  const severity = { CRITICAL: { found: 0, missed: 0 }, HIGH: { found: 0, missed: 0 }, MEDIUM: { found: 0, missed: 0 }, LOW: { found: 0, missed: 0 } };
  for (const p of projects) {
    for (const m of p.matched_bugs) {
      if (severity[m.severity]) severity[m.severity].found++;
    }
    for (const m of p.missed_bugs) {
      if (severity[m.severity]) severity[m.severity].missed++;
    }
  }

  // By difficulty
  const difficulty = { easy: { found: 0, missed: 0 }, medium: { found: 0, missed: 0 }, hard: { found: 0, missed: 0 } };
  for (const p of projects) {
    for (const m of p.matched_bugs) {
      if (difficulty[m.difficulty]) difficulty[m.difficulty].found++;
    }
    for (const m of p.missed_bugs) {
      if (difficulty[m.difficulty]) difficulty[m.difficulty].missed++;
    }
  }

  return {
    skill: skillName,
    generated_at: new Date().toISOString(),
    summary: {
      total_bugs: totalBugs,
      true_positives: totalTP,
      false_positives: totalFP,
      false_negatives: totalFN,
      precision: round(precision, 4),
      recall: round(recall, 4),
      f1_score: round(f1, 4),
      fp_traps_total: totalFPTraps,
      fp_traps_triggered: totalFPTriggered,
      fp_trap_rate: round(totalFPTriggered / (totalFPTraps || 1), 4),
    },
    by_tier: tiers,
    by_severity: severity,
    by_difficulty: difficulty,
    per_project: projects,
  };
}

// ========== CLI ==========

const TIER_FILTERS = {
  '1': ['S1-rest-api-utility', 'S2-cli-tool'],
  '2': ['S1-rest-api-utility', 'S2-cli-tool', 'M1-ecommerce-backend', 'L1-cms'],
  '3': null, // all projects
};

function main() {
  const args = process.argv.slice(2);
  const getArg = (name) => { const i = args.indexOf(name); return i !== -1 ? args[i + 1] : null; };

  const resultsDir = getArg('--results');
  const keyHex = getArg('--key') || process.env.GROUND_TRUTH_KEY;
  const outputPath = getArg('--output') || 'benchmark-report.json';
  const skillName = getArg('--skill') || 'unknown';
  const compareDir = getArg('--compare');
  const tier = getArg('--tier');

  if (!resultsDir || !keyHex) {
    console.log('Usage:');
    console.log('  node score.js --results <results_dir> --key <key> [--skill <name>] [--output <file>] [--compare <dir>] [--tier 1|2|3]');
    console.log('');
    console.log('Tiers: 1=S-only (micro, ~30s), 2=S+M1+L1 (mini, ~3min), 3=all (full, ~15min)');
    console.log('Results dir should contain JSON files named like S1-rest-api-utility.json');
    process.exit(1);
  }

  const tierFilter = tier ? TIER_FILTERS[tier] : null;
  if (tier) console.log(`🔍 Tier ${tier} eval: ${tierFilter ? tierFilter.join(', ') : 'ALL projects'}\n`);

  // Decrypt ground truth
  console.log('Decrypting ground truth...');
  let groundTruth = decryptAllFiles(keyHex);

  // Filter by tier
  if (tierFilter) {
    const filtered = {};
    for (const name of tierFilter) {
      if (groundTruth[name]) filtered[name] = groundTruth[name];
    }
    groundTruth = filtered;
  }
  console.log(`Loaded ${Object.keys(groundTruth).length} ground truth files.\n`);

  // Load results
  const results = loadResults(resultsDir);
  console.log(`Loaded ${Object.keys(results).length} result files.\n`);

  // Score each project
  const allScores = {};
  for (const [project, gt] of Object.entries(groundTruth)) {
    const findings = results[project]?.findings || [];
    console.log(`Scoring ${project}: ${findings.length} findings vs ${gt.total_bugs} bugs...`);
    allScores[project] = scoreProject(findings, gt, project);
    console.log(`  → TP: ${allScores[project].true_positives}, FP: ${allScores[project].false_positives}, FN: ${allScores[project].false_negatives} | F1: ${allScores[project].f1_score}`);
  }

  // Generate report
  const report = generateReport(allScores, skillName);

  // Compare with another skill if provided
  if (compareDir) {
    const compareResults = loadResults(compareDir);
    const compareScores = {};
    for (const [project, gt] of Object.entries(groundTruth)) {
      const findings = compareResults[project]?.findings || [];
      compareScores[project] = scoreProject(findings, gt, project);
    }
    report.comparison = {
      mcnemar: mcNemarTest(allScores, compareScores),
      other_skill: generateReport(compareScores, 'baseline').summary,
    };
  }

  // Write report
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`\n✅ Report saved to: ${outputPath}`);

  // Print summary
  console.log('\n=== SUMMARY ===');
  console.log(`Precision: ${(report.summary.precision * 100).toFixed(1)}%`);
  console.log(`Recall:    ${(report.summary.recall * 100).toFixed(1)}%`);
  console.log(`F1 Score:  ${(report.summary.f1_score * 100).toFixed(1)}%`);
  console.log(`FP Trap Rate: ${(report.summary.fp_trap_rate * 100).toFixed(1)}% (lower is better)`);

  if (report.comparison) {
    const mc = report.comparison.mcnemar;
    console.log(`\n=== McNemar's Test ===`);
    console.log(`Winner: ${mc.winner === 'A' ? skillName : 'baseline'} (χ² = ${mc.chi_squared}, p = ${mc.p_value})`);
    console.log(`Significant at α=0.05: ${mc.significant_at_05 ? 'YES' : 'NO'}`);
  }
}

function loadResults(dir) {
  const results = {};
  if (!fs.existsSync(dir)) {
    console.error(`Results directory not found: ${dir}`);
    process.exit(1);
  }
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    const content = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    const project = file.replace('.json', '');
    results[project] = content;
  }
  return results;
}

if (require.main === module) {
  main();
}

module.exports = { scoreProject, mcNemarTest, generateReport, matchFinding };
