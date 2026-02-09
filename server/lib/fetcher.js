// wikilinker/lib/fetcher.js
//
// Fetches remote web pages with SSRF protection. Validates URLs against
// a blocklist of private/internal IP ranges and localhost before making
// requests. Only allows http/https protocols. Returns raw HTML.

const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

const BLOCKED_HOSTNAMES = [
  'localhost',
  'localhost.localdomain',
  '*.local',
];

export function isUrlAllowed(urlString) {
  try {
    const url = new URL(urlString);

    // Only allow http/https
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false;
    }

    const hostname = url.hostname.toLowerCase();

    // Block localhost
    if (hostname === 'localhost' || hostname === 'localhost.localdomain') {
      return false;
    }

    // Block .local domains
    if (hostname.endsWith('.local')) {
      return false;
    }

    // Block private IPs
    for (const pattern of PRIVATE_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

export async function fetchPage(urlString, options = {}) {
  if (!isUrlAllowed(urlString)) {
    throw new Error('URL blocked for security reasons');
  }

  const timeout = options.timeout || 15000;
  const maxSize = options.maxSize || 5 * 1024 * 1024; // 5MB

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(urlString, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        // Pass through the user's browser User-Agent when available, otherwise use a sensible default
        'User-Agent': options.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Check content length
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > maxSize) {
      throw new Error('Response too large');
    }

    // Read with size limit
    const reader = response.body.getReader();
    const chunks = [];
    let totalSize = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalSize += value.length;
      if (totalSize > maxSize) {
        reader.cancel();
        throw new Error('Response too large');
      }
      chunks.push(value);
    }

    const buffer = Buffer.concat(chunks);
    return {
      html: buffer.toString('utf8'),
      url: response.url, // Final URL after redirects
      status: response.status,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
