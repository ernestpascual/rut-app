import * as http from 'http';
import * as https from 'https';

export interface PublicMetadata {
  title: string | null;
  description: string | null;
  canonicalUrl: string | null;
  remotePreviewImageUrl: string | null;
}

/**
 * Checks whether an IP or hostname is in a private, localhost, or link-local range.
 */
export function isPrivateOrBlockedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase().trim();

  // Localhost aliases
  if (
    lower === 'localhost' ||
    lower.endsWith('.localhost') ||
    lower === '127.0.0.1' ||
    lower === '::1' ||
    lower === '0.0.0.0'
  ) {
    return true;
  }

  // IPv4 private & link-local ranges
  // 10.0.0.0/8
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(lower)) return true;
  // 172.16.0.0/12
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(lower)) return true;
  // 192.168.0.0/16
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(lower)) return true;
  // 169.254.0.0/16 (Link-local / AWS metadata endpoint 169.254.169.254)
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(lower)) return true;

  // Cloud metadata endpoint aliases
  if (lower.includes('metadata.google.internal') || lower.includes('169.254.169.254')) {
    return true;
  }

  return false;
}

/**
 * Fetches HTML with strict SSRF protections, timeout, and max byte limits.
 */
export async function fetchPublicMetadata(targetUrl: string): Promise<PublicMetadata> {
  const result: PublicMetadata = {
    title: null,
    description: null,
    canonicalUrl: null,
    remotePreviewImageUrl: null,
  };

  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Blocked protocol: ${parsed.protocol}`);
    }

    if (isPrivateOrBlockedHost(parsed.hostname)) {
      throw new Error(`SSRF Blocked host: ${parsed.hostname}`);
    }

    const html = await downloadLimitedHtml(targetUrl, 3, 256 * 1024); // max 256KB, 3 redirects

    // Extract basic meta tags
    result.title = extractTagContent(html, /<title[^>]*>([^<]+)<\/title>/i);

    // Meta description
    result.description =
      extractMetaAttribute(html, 'property', 'og:description') ||
      extractMetaAttribute(html, 'name', 'description') ||
      extractMetaAttribute(html, 'name', 'twitter:description');

    // OpenGraph image preview URL (external reference only)
    const ogImage =
      extractMetaAttribute(html, 'property', 'og:image') ||
      extractMetaAttribute(html, 'name', 'twitter:image');

    if (ogImage && /^https?:\/\//i.test(ogImage)) {
      result.remotePreviewImageUrl = ogImage;
    }

    // Canonical URL
    const canonical = extractTagAttribute(html, /<link[^>]+rel=["']canonical["'][^>]*>/i, 'href');
    if (canonical && /^https?:\/\//i.test(canonical)) {
      result.canonicalUrl = canonical;
    }
  } catch (err) {
    // Non-fatal; metadata is best effort
    console.warn(`[Metadata Fetch] Failed for ${targetUrl}:`, err);
  }

  return result;
}

function downloadLimitedHtml(urlStr: string, maxRedirects: number, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    if (maxRedirects < 0) {
      return reject(new Error('Too many redirects'));
    }

    let url: URL;
    try {
      url = new URL(urlStr);
    } catch {
      return reject(new Error('Invalid URL'));
    }

    if (isPrivateOrBlockedHost(url.hostname)) {
      return reject(new Error(`SSRF Blocked: ${url.hostname}`));
    }

    const client = url.protocol === 'https:' ? https : http;

    const req = client.get(
      urlStr,
      {
        timeout: 5000,
        headers: {
          'User-Agent': 'rut-bot/1.0 (+https://rut.local)',
          Accept: 'text/html,application/xhtml+xml',
        },
      },
      (res) => {
        // Handle redirects
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          const redirectUrl = new URL(res.headers.location, urlStr).toString();
          return resolve(downloadLimitedHtml(redirectUrl, maxRedirects - 1, maxBytes));
        }

        if (res.statusCode && res.statusCode >= 400) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }

        let body = '';
        let bytesReceived = 0;

        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          bytesReceived += chunk.length;
          body += chunk;
          if (bytesReceived > maxBytes) {
            res.destroy(); // Abort reading beyond limit
            resolve(body);
          }
        });

        res.on('end', () => resolve(body));
      }
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    req.on('error', (err) => reject(err));
  });
}

function extractTagContent(html: string, regex: RegExp): string | null {
  const match = html.match(regex);
  return match && match[1] ? cleanText(match[1]) : null;
}

function extractMetaAttribute(html: string, attrName: string, attrVal: string): string | null {
  const regex = new RegExp(`<meta[^>]+${attrName}=["']${attrVal}["'][^>]*content=["']([^"']+)["']`, 'i');
  const match = html.match(regex);
  if (match && match[1]) return cleanText(match[1]);

  // Try reverse order: content="..." property="..."
  const reverseRegex = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*${attrName}=["']${attrVal}["']`, 'i');
  const reverseMatch = html.match(reverseRegex);
  if (reverseMatch && reverseMatch[1]) return cleanText(reverseMatch[1]);

  return null;
}

function extractTagAttribute(html: string, tagRegex: RegExp, attrName: string): string | null {
  const tagMatch = html.match(tagRegex);
  if (!tagMatch) return null;
  const attrMatch = tagMatch[0].match(new RegExp(`${attrName}=["']([^"']+)["']`, 'i'));
  return attrMatch && attrMatch[1] ? cleanText(attrMatch[1]) : null;
}

function cleanText(raw: string): string {
  return raw.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
}
