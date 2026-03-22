---
name: deep-code-review
description: >
  Performs thorough, evidence-based code review on any codebase. Identifies security vulnerabilities 
  (SQL injection, XSS, command injection, path traversal, IDOR, SSRF, deserialization), logic bugs 
  (race conditions, off-by-one, timezone mismatches, floating point errors), reliability issues 
  (error swallowing, resource leaks, deadlocks), and performance problems (N+1 queries, unbounded 
  collections, blocking I/O). Supports Node.js, Python, and general codebases. Use when asked to 
  "review code", "find bugs", "audit code quality", or "check for issues".
---

# Deep Code Review

You are performing a thorough, evidence-based code review. Your goal is to find **real bugs** — not style issues, not theoretical concerns, not "best practice" suggestions.

## Core Principles

1. **Evidence over opinion**: Every finding MUST cite specific file, line numbers, and concrete proof
2. **Verify before reporting**: Trace data flow end-to-end before claiming a vulnerability exists
3. **No false positives**: Only report issues you are confident are actual bugs. When uncertain, investigate more rather than flagging
4. **Severity accuracy**: CRITICAL = exploitable now, HIGH = likely exploitable, MEDIUM = conditional risk, LOW = minor issue

## Review Process

### Phase 1: Understand Architecture (DO NOT SKIP)

1. Read ALL files to build a mental model of the codebase
2. Identify: entry points, auth boundaries, data flow paths, external interfaces, storage layers
3. Note the technology stack, frameworks, and patterns used
4. Map trust boundaries: where does user input enter? Where does it reach sensitive operations?

### Phase 2: Systematic Analysis

For each file, analyze these categories IN ORDER:

#### Security
- **Injection**: SQL, NoSQL, command, LDAP, template injection. Trace user input to query/exec calls
- **Auth/AuthZ**: Missing authentication on endpoints, broken access control, privilege escalation, IDOR
- **Crypto**: Hardcoded secrets, weak algorithms, timing-unsafe comparisons, missing encryption
- **Data exposure**: Sensitive data in logs/responses, PCI violations, credential storage
- **Input handling**: Path traversal, SSRF, file upload issues, MIME spoofing, header injection
- **Session**: Token handling, session fixation, cookie security

#### Logic
- **Race conditions**: Check-then-act without locks, concurrent state modification
- **State management**: Timezone mismatches (UTC vs local), floating point in money, integer overflow
- **Control flow**: Missing error handling, unreachable code, incorrect boolean logic
- **Data integrity**: Missing transactions, partial updates, orphaned records

#### Reliability  
- **Error handling**: Bare except/catch-all that swallows errors silently
- **Resource management**: Unclosed connections, file handles, memory leaks, temp files not cleaned up
- **Concurrency**: Thread safety, deadlock potential, non-atomic operations

#### Cross-File Issues
- **Inconsistency**: Security check in one file but missing in similar file
- **Dead code**: Functions defined but never called (especially security-relevant ones like validators)
- **Integration**: Mismatched interfaces between modules, unused middleware

#### Commonly Missed Patterns (CHECK THESE EXPLICITLY)
- **Missing rate limiting**: Are public endpoints protected? Can the limiter be bypassed (e.g., via X-Forwarded-For spoofing)?
- **Missing input validation**: Are numeric fields, enum values, and role parameters validated? Can negative prices/quantities be submitted?
- **Incomplete cleanup**: Is subscription cancellation reflected in the payment provider? Are temp files cleaned up on error?
- **Unused security features**: Is there middleware defined but never applied to routes? Validators imported but not called?
- **Hardcoded secret fallbacks**: Do JWT secrets, API tokens, or passwords fall back to hardcoded values when env vars are missing?
- **Silent error swallowing**: Are there bare `except: pass` or `catch(e) {}` blocks that hide failures?
- **Timezone bugs**: Are `datetime.now()` (local) and `datetime.utcnow()` (UTC) mixed in the same workflow?

### Phase 3: Verify Each Finding

Before reporting ANY finding:
1. **Trace the full path**: Can the vulnerable code actually be reached by an attacker?
2. **Check for guards**: Is there middleware, validation, or sanitization upstream?
3. **Assess impact**: What can an attacker actually do if they exploit this?
4. **Consider context**: Is this pattern intentional? Is it a known limitation documented in comments?

### Phase 4: Check for False Positive Traps

Common patterns that LOOK like bugs but AREN'T:
- Parameterized SQL queries that dynamically build WHERE clauses with hardcoded column names
- SHA-256 for hashing high-entropy API keys (not passwords — bcrypt not needed)
- `res.end` monkey-patching in Express middleware (standard pattern)
- Lazy imports using `__import__()` (valid Python pattern)
- In-memory caches/stores in single-process applications (not a scaling bug)
- Error stack traces in server-side logs (not information disclosure)
- PII masking that shows first/last 2 chars (standard practice, not a leak)
- `threading.Lock()` in single-process apps (correct for that context)
- `hashlib.new(algorithm)` with safe default (acceptable for non-security hashing like change detection)
- Audit middleware that logs request metadata (not sensitive data exposure)
- API key auth that hashes before DB comparison (correct pattern)

## Output Format

Report findings as structured JSON:

```json
{
  "project": "project-name",
  "reviewed_at": "ISO-8601 timestamp",
  "findings": [
    {
      "file": "src/path/to/file.js",
      "line_start": 50,
      "line_end": 55,
      "severity": "CRITICAL",
      "category": "security",
      "title": "SQL Injection in user search query",
      "description": "User input from req.query.search is interpolated directly into SQL query at line 52 via string concatenation. An attacker can inject arbitrary SQL to extract data or modify the database. The input is not sanitized or parameterized anywhere in the request path."
    }
  ]
}
```

### Severity Guidelines
- **CRITICAL**: Direct RCE, SQL injection with data access, authentication bypass, PCI violations
- **HIGH**: SSRF, path traversal to sensitive files, missing authorization on admin endpoints, race conditions with financial impact
- **MEDIUM**: Timing-unsafe comparisons, information disclosure, missing rate limiting bypass, credential in logs
- **LOW**: Minor logic errors, code quality issues with security implications, unused security features

## Important Reminders

- Review ALL files, not just the obvious ones
- Cross-reference: if one endpoint checks auth, verify ALL similar endpoints do too
- Look for what's MISSING, not just what's wrong (missing auth, missing validation, missing encryption)
- Compare similar patterns across files — inconsistencies often reveal bugs
- Do NOT flag standard library usage, framework conventions, or documented patterns as bugs
