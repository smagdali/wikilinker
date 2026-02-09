// wikilinker/lib/rewriter.js
//
// Rewrites all links and resource URLs in a proxied page so that
// navigation stays within the proxy. Anchor hrefs are routed through
// the proxy path; images, stylesheets, and scripts get absolute URLs
// resolved against the original page's base URL.
import { parse } from 'node-html-parser';

export function rewriteLinks(html, baseUrl, proxyPath, debug = false) {
  const root = parse(html);
  const base = new URL(baseUrl);
  const debugSuffix = debug ? '&debug=1' : '';

  const links = root.querySelectorAll('a[href]');

  for (const link of links) {
    const href = link.getAttribute('href');
    if (!href) continue;

    // Skip wikilinks (already processed)
    if (link.classNames?.includes('wikilink')) continue;

    // Skip hash-only links
    if (href.startsWith('#')) continue;

    // Skip javascript: links
    if (href.startsWith('javascript:')) continue;

    // Skip mailto: and tel: links
    if (href.startsWith('mailto:') || href.startsWith('tel:')) continue;

    try {
      // Resolve relative URLs against base
      const resolved = new URL(href, baseUrl);

      // Only rewrite same-origin links
      if (resolved.hostname === base.hostname ||
          resolved.hostname.endsWith('.' + base.hostname.replace(/^www\./, ''))) {
        const newHref = `${proxyPath}?url=${encodeURIComponent(resolved.href)}${debugSuffix}`;
        link.setAttribute('href', newHref);
      }
    } catch {
      // Invalid URL, leave as-is
    }
  }

  // Also rewrite form actions
  const forms = root.querySelectorAll('form[action]');
  for (const form of forms) {
    const action = form.getAttribute('action');
    if (!action || action.startsWith('#')) continue;

    try {
      const resolved = new URL(action, baseUrl);
      if (resolved.hostname === base.hostname) {
        form.setAttribute('action', `${proxyPath}?url=${encodeURIComponent(resolved.href)}${debugSuffix}`);
      }
    } catch {
      // Invalid URL, leave as-is
    }
  }

  return root.toString();
}

export function rewriteResourceUrls(html, baseUrl) {
  const root = parse(html);

  // Rewrite img src to absolute
  const images = root.querySelectorAll('img[src]');
  for (const img of images) {
    const src = img.getAttribute('src');
    if (src && !src.startsWith('data:') && !src.startsWith('http')) {
      try {
        const resolved = new URL(src, baseUrl);
        img.setAttribute('src', resolved.href);
      } catch {
        // Invalid URL, leave as-is
      }
    }
  }

  // Rewrite CSS links to absolute
  const cssLinks = root.querySelectorAll('link[rel="stylesheet"]');
  for (const link of cssLinks) {
    const href = link.getAttribute('href');
    if (href && !href.startsWith('http')) {
      try {
        const resolved = new URL(href, baseUrl);
        link.setAttribute('href', resolved.href);
      } catch {
        // Invalid URL
      }
    }
  }

  // Rewrite relative URLs inside <style> tags (url(), @import)
  // Many sites (CNN, etc.) use inline styles with relative font/image paths
  const styleTags = root.querySelectorAll('style');
  for (const style of styleTags) {
    let css = style.textContent || style.rawText || '';
    if (!css) continue;

    css = rewriteCssUrls(css, baseUrl);
    // Update style tag content
    style.set_content(css);
  }

  // Rewrite srcset attributes to absolute
  const srcsetEls = root.querySelectorAll('[srcset]');
  for (const el of srcsetEls) {
    const srcset = el.getAttribute('srcset');
    if (srcset) {
      const rewritten = srcset.split(',').map(entry => {
        const parts = entry.trim().split(/\s+/);
        if (parts[0] && !parts[0].startsWith('http') && !parts[0].startsWith('data:')) {
          try {
            parts[0] = new URL(parts[0], baseUrl).href;
          } catch { /* leave as-is */ }
        }
        return parts.join(' ');
      }).join(', ');
      el.setAttribute('srcset', rewritten);
    }
  }

  return root.toString();
}

/**
 * Rewrite relative URLs in CSS content to absolute.
 * Handles url() and @import references.
 */
function rewriteCssUrls(css, baseUrl) {
  // Rewrite url(...) references
  css = css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (match, quote, urlPath) => {
    if (urlPath.startsWith('data:') || urlPath.startsWith('http://') || urlPath.startsWith('https://') || urlPath.startsWith('#')) {
      return match;
    }
    try {
      const resolved = new URL(urlPath, baseUrl);
      return `url(${quote}${resolved.href}${quote})`;
    } catch {
      return match;
    }
  });

  // Rewrite @import url(...) and @import "..." references
  css = css.replace(/@import\s+(['"])([^'"]+)\1/g, (match, quote, urlPath) => {
    if (urlPath.startsWith('http://') || urlPath.startsWith('https://')) {
      return match;
    }
    try {
      const resolved = new URL(urlPath, baseUrl);
      return `@import ${quote}${resolved.href}${quote}`;
    } catch {
      return match;
    }
  });

  return css;
}
