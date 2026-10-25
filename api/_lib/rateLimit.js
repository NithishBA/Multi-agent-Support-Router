// Best-effort per-IP rate limiter for Vercel serverless functions.
// State lives in the warm lambda instance's memory: it resets on cold starts and
// isn't shared across concurrent instances, so it won't stop a distributed flood —
// but it's enough to blunt casual abuse/scripted hammering of a portfolio demo
// without adding an external Redis dependency.

const buckets = new Map();
let requestsSinceSweep = 0;

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function sweep(now) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

// windowMs: length of the fixed window in ms. max: allowed requests per window per IP+route.
function rateLimit(req, res, { name, windowMs, max }) {
  const now = Date.now();
  requestsSinceSweep += 1;
  if (requestsSinceSweep >= 500) {
    requestsSinceSweep = 0;
    sweep(now);
  }

  const key = `${name}:${getClientIp(req)}`;
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;

  if (bucket.count > max) {
    const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
    res.setHeader('Retry-After', String(retryAfterSec));
    res.status(429).json({ error: "Too many requests — please wait a moment and try again." });
    return false;
  }
  return true;
}

module.exports = { rateLimit };
