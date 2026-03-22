# Benchmark Harness

Tools for testing and comparing AI code review skills against ground truth.

## Quick Start

```bash
# 1. Generate review prompts
node runner.js prepare --skill deep-review --output ../prompts

# 2. Run AI tool on each project (manually or via automation)
#    Save results as JSON in a results directory

# 3. Score results
node score.js --results ../results/deep-review --key <GROUND_TRUTH_KEY> --skill deep-review --output report.json

# 4. Compare two skills
node score.js --results ../results/deep-review --key <KEY> --skill deep-review --compare ../results/codex-skill --output comparison.json
```

## Files

| File | Purpose |
|------|---------|
| `encrypt.js` | Encrypt/decrypt ground truth (AES-256-GCM) |
| `score.js` | Score AI findings against ground truth |
| `runner.js` | Generate review prompts and normalize results |

## Result Format

AI review results should be saved as JSON:

```json
{
  "project": "S1-rest-api-utility",
  "findings": [
    {
      "file": "src/index.js",
      "line_start": 50,
      "line_end": 55,
      "severity": "CRITICAL",
      "category": "security",
      "title": "SQL Injection in user search",
      "description": "User input is interpolated into SQL query..."
    }
  ]
}
```

## Metrics

- **Precision**: What % of reported findings are real bugs
- **Recall**: What % of actual bugs were found
- **F1 Score**: Harmonic mean of precision and recall
- **FP Trap Rate**: What % of false-positive traps were incorrectly flagged
- **McNemar's Test**: Statistical significance when comparing two skills

## Ground Truth Key

The key is required for scoring. Never commit it to the repository.
Store it as an environment variable: `GROUND_TRUTH_KEY`
