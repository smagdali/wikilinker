// wikilinker/lib/fetcher.js
//
// Fetches remote web pages with domain allowlist. Only fetches from domains
// listed in sites.json. Follows redirects manually, re-validating each hop
// against the allowlist. Returns raw HTML.

const MAX_REDIRECTS = 5;

/**
 * Check if a URL's domain is in the allowed sites list.
 * Strips www. prefix and checks for exact or suffix match against site keys.
 */
export function isUrlAllowed(urlString, allowedDomains) {
  try {
    const url = new URL(urlString);

    // Only allow http/https
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false;
    }

    const hostname = url.hostname.toLowerCase().replace(/^www\./, '');

    for (const domain of allowedDomains) {
      if (hostname === domain || hostname.endsWith('.' + domain)) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

export async function fetchPage(urlString, options = {}) {
  const { allowedDomains } = options;
  if (!allowedDomains) {
    throw new Error('allowedDomains required');
  }

  if (!isUrlAllowed(urlString, allowedDomains)) {
    throw new Error('URL blocked: site not supported');
  }

  const timeout = options.timeout || 15000;
  const maxSize = options.maxSize || 5 * 1024 * 1024; // 5MB

  let currentUrl = urlString;

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          'User-Agent': options.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      // Handle redirects manually — re-validate each hop
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) {
          throw new Error(`HTTP ${response.status}: redirect with no Location header`);
        }

        // Resolve relative redirect URLs
        const redirectUrl = new URL(location, currentUrl).href;

        if (!isUrlAllowed(redirectUrl, allowedDomains)) {
          throw new Error('URL blocked: redirect to unsupported site');
        }

        currentUrl = redirectUrl;
        continue;
      }

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
        url: currentUrl, // Final URL after redirects
        status: response.status,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error('Too many redirects');
}
