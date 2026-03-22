/**
 * Circuit Breaker Pattern
 * Prevents cascading failures by stopping requests to failing services.
 */

class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.threshold = options.threshold || 5;
    this.timeout = options.timeout || 30000;
    this.state = 'closed'; // closed, open, half-open
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
  }

  isAllowed() {
    if (this.state === 'closed') return true;
    if (this.state === 'open') {
      // Check if timeout has elapsed to transition to half-open
      if (Date.now() - this.lastFailureTime >= this.timeout) {
        this.state = 'half-open';
        return true;
      }
      return false;
    }
    if (this.state === 'half-open') return true;
    return false;
  }

  recordSuccess() {
    if (this.state === 'half-open') {
      this.successes++;
      if (this.successes >= 3) {
        this.state = 'closed';
        this.failures = 0;
        this.successes = 0;
      }
    }
    this.failures = Math.max(0, this.failures - 1);
  }

  recordFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    this.successes = 0;
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }

  getStatus() {
    return { name: this.name, state: this.state, failures: this.failures };
  }
}

module.exports = { CircuitBreaker };
