# deep-review

Cross-platform AI code review skill pack with evidence-based verification and rigorous benchmarking.

## Skills

| Skill | Purpose |
|-------|---------|
| `deep-code-review` | Full code review (security + logic + reliability) |
| `deep-security-review` | OWASP Top 10 security audit |
| `deep-plan-review` | Architecture/plan review |

### Compatible Platforms
Claude Code, Antigravity, OpenCode, Kilo Code, Codex CLI

### Installation
Copy the `skills/` directory into your project's `.claude/skills/` or equivalent skill directory.

## Test Framework

**10 projects** across 4 tiers with embedded bugs and false-positive traps for benchmarking:

| Tier | Projects | LOC | Bugs | FP Traps |
|------|----------|-----|------|----------|
| S | 2 (Node.js + Python) | 693 | 11 | 4 |
| M | 3 (Node.js x2 + Python) | 2,119 | 21 | 6 |
| L | 3 (Node.js x2 + Python) | 2,123 | 27 | 7 |
| XL | 2 (Node.js + Python) | 1,223 | 25 | 6 |
| **Total** | **10** | **6,158** | **84** | **23** |

Ground truth is **AES-256-GCM encrypted** — AI tools cannot see answers during review.

## Benchmarking

```bash
# Quick iteration (single project)
node tests/harness/quick-eval.js prompt --project S1-rest-api-utility > prompt.md
node tests/harness/quick-eval.js score --result result.json --project S1-rest-api-utility --key $KEY

# Full benchmark
node tests/harness/score.js --results results/ --key $KEY --skill deep-review

# Compare two skills
node tests/harness/score.js --results results/A --key $KEY --compare results/B --skill A
```

## Metrics
- Precision, Recall, F1 per project/tier/severity/difficulty
- FP trap rate (lower = better)
- McNemar's χ² test for statistically comparing two skills
