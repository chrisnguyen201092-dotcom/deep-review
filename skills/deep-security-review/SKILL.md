---
name: deep-security-review
description: >
  Performs a focused security audit on codebases. Specializes in OWASP Top 10, CWE patterns, and 
  real-world exploit chains. Maps attack surfaces, traces trust boundaries, and identifies 
  multi-step vulnerabilities that cross file boundaries. Covers injection, broken auth, sensitive 
  data exposure, XXE, broken access control, security misconfiguration, XSS, insecure 
  deserialization, insufficient logging, and SSRF. Use when asked to "security audit", 
  "penetration test", "find vulnerabilities", "check security", or "OWASP review".
---

# Deep Security Review

You are performing a focused security audit. Think like an attacker: find exploit chains, not just individual weaknesses.

## Methodology

### Step 1: Attack Surface Mapping

Identify and document:
- **Entry points**: HTTP endpoints, CLI args, file uploads, webhook handlers, WebSocket connections
- **Auth boundaries**: Which endpoints require auth? Which don't? What auth method (JWT, API key, session)?
- **Trust boundaries**: Where does user input enter? Where does trusted internal data flow?
- **Sensitive data**: Credentials, tokens, PII, financial data — where stored, how transmitted
- **External integrations**: Database queries, HTTP calls, file system access, subprocess, email

### Step 2: Vulnerability Hunting (by OWASP Category)

#### A01: Broken Access Control
- Missing `authorize`/`require_role` middleware on protected endpoints
- IDOR: Can user A access user B's resources by changing an ID?
- Privilege escalation: Can a regular user access admin endpoints?
- Compare ALL similar endpoints — if one checks roles but another doesn't, that's a bug

#### A02: Cryptographic Failures
- Hardcoded secrets, API keys, JWT secrets in source code
- Weak hashing for passwords (MD5, SHA-256 instead of bcrypt/argon2)
- Missing encryption for sensitive data at rest
- PCI DSS violations: raw card data touching the server
- Timing-unsafe string comparisons (`===`, `==` instead of `hmac.compare_digest` / `crypto.timingSafeEqual`)

#### A03: Injection
- **SQL**: String concatenation/interpolation in queries, ORM raw query methods
- **Command**: `subprocess.run(shell=True)`, `exec()`, `eval()`, `child_process.exec()`
- **NoSQL**: User-controlled operators in MongoDB queries (`$gt`, `$ne`)
- **Template**: User input in template strings without escaping
- **LDAP/XPath**: User input in directory queries

#### A04: Insecure Design
- Race conditions in financial operations (check-then-act without transactions)
- Missing rate limiting (or rate limit bypassable via header spoofing)
- Business logic flaws (downgrade without checking limits, cancel without external API call)

#### A05: Security Misconfiguration
- CORS wildcards (`*`) with credentials
- Debug mode in production, verbose error messages to client
- Default credentials that ship with the code
- Missing security headers (CSP, X-Frame-Options, etc)

#### A06: Vulnerable Components
- Known vulnerable dependency versions (if package.json/requirements.txt visible)
- Using deprecated/unsafe APIs (`yaml.load` instead of `yaml.safe_load`)

#### A07: Authentication Failures
- Account lockout bypass, missing brute-force protection
- Token expiration too long (>24h for access tokens)
- Refresh token reuse, session fixation
- Password reset token handling issues

#### A08: Data Integrity Failures
- Unsafe deserialization (`pickle.loads`, `eval` on user data)
- Missing signature verification or weak signature schemes
- Webhook signature bypass when secret is empty

#### A09: Logging & Monitoring Failures
- Sensitive data in logs (passwords, tokens, card numbers, full error with credentials)
- Missing audit logging for security-relevant operations
- Silent error swallowing in security-critical paths

#### A10: SSRF
- User-controlled URLs in HTTP requests (`requests.get(user_url)`)
- Webhook URLs pointing to internal networks
- File inclusion via user-controlled paths

### Step 3: Exploit Chain Analysis

For each vulnerability found:
1. **Can it be reached?** Trace from entry point to vulnerable code
2. **What's the prerequisite?** Does the attacker need auth? What role?
3. **What's the impact?** Data theft, RCE, privilege escalation, DoS?
4. **Can it be chained?** Does vuln A enable vuln B? (e.g., SSRF → credential theft → auth bypass)

### Step 4: False Positive Filtering

DO NOT flag these as vulnerabilities:
- Parameterized queries with dynamic WHERE clauses using hardcoded column names
- SHA-256 for hashing high-entropy random tokens (API keys, not passwords)
- Express `res.end` monkey-patching (standard middleware pattern)
- In-memory state in single-process applications
- Server-side error logging with stack traces
- Standard PII masking (showing first/last few characters)
- `__import__()` lazy loading (valid Python pattern)

## Output Format

```json
{
  "project": "project-name",
  "reviewed_at": "ISO-8601",
  "findings": [
    {
      "file": "src/path/to/file.js",
      "line_start": 50,
      "line_end": 55,
      "severity": "CRITICAL",
      "category": "security",
      "title": "SQL Injection via string interpolation",
      "description": "Detailed description with evidence, attack scenario, and impact",
      "owasp": "A03",
      "cwe": "CWE-89"
    }
  ]
}
```
