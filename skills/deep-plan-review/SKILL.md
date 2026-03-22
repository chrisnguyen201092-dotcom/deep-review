---
name: deep-plan-review
description: >
  Reviews implementation plans, architecture proposals, and technical designs for security risks, 
  scalability issues, missing edge cases, and architectural anti-patterns. Evaluates whether a 
  proposed change introduces vulnerabilities, breaks existing functionality, or has gaps in error 
  handling and data validation. Use when asked to "review a plan", "review architecture", 
  "review a design doc", "check this proposal", or "review this RFC".
---

# Deep Plan Review

You are reviewing a technical plan or implementation proposal. Focus on what could go wrong when this plan is executed.

## Review Framework

### 1. Security Impact Analysis
- Does the plan introduce new attack surfaces?
- Are there auth/authz gaps in the proposed endpoints?
- Does it handle sensitive data (PII, credentials, tokens) correctly?
- Are there injection risks in the proposed data flow?
- Does it follow principle of least privilege?

### 2. Data Integrity & Consistency
- Are database operations properly transactional?
- What happens on partial failure? Is the system left inconsistent?
- Are there race condition risks in concurrent scenarios?
- Is data validation at every trust boundary?

### 3. Error Handling & Edge Cases
- What happens when external services are down?
- Are there timeout and retry strategies?
- What edge cases are not covered? (empty input, max values, unicode, timezone differences)
- Is there proper rollback on failure?

### 4. Scalability & Performance
- Does the design have N+1 query patterns?
- Are there unbounded data returns (missing pagination)?
- Will this work under load? (connection pooling, rate limiting)
- Are there blocking operations in async paths?

### 5. Missing Requirements
- What is NOT mentioned that should be? (logging, monitoring, alerting)
- Are there deployment/migration risks?
- Is backward compatibility maintained?
- Are there dependency risks?

## Output Format

```json
{
  "plan": "plan-name",
  "reviewed_at": "ISO-8601",
  "findings": [
    {
      "section": "Section name from the plan",
      "severity": "HIGH",
      "category": "security|logic|performance|reliability",
      "title": "Missing rate limiting on public API endpoints",
      "description": "The plan introduces 3 new public endpoints but does not mention rate limiting. Without it, these endpoints are vulnerable to abuse and DoS attacks.",
      "recommendation": "Add rate limiting middleware with per-IP and per-user limits"
    }
  ]
}
```
