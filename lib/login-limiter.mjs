export class LoginLimiter {
  constructor({ limit = 12, windowMs = 15 * 60000, now = Date.now } = {}) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
    this.failures = new Map();
  }
  retryAfter(key) {
    const record = this.failures.get(key);
    if (!record) return 0;
    if (record.until <= this.now()) {
      this.failures.delete(key);
      return 0;
    }
    return record.count >= this.limit
      ? Math.max(1, Math.ceil((record.until - this.now()) / 1000))
      : 0;
  }
  failure(key) {
    this.retryAfter(key);
    let record = this.failures.get(key);
    if (!record) {
      if (this.failures.size >= 10000) {
        for (const [k, v] of this.failures)
          if (v.until <= this.now()) this.failures.delete(k);
        if (this.failures.size >= 10000)
          this.failures.delete(this.failures.keys().next().value);
      }
      record = { count: 0, until: this.now() + this.windowMs };
      this.failures.set(key, record);
    }
    record.count++;
    return this.retryAfter(key);
  }
  success(key) {
    this.failures.delete(key);
  }
}
