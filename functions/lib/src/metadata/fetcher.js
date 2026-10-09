"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPrivateOrBlockedHost = isPrivateOrBlockedHost;
exports.fetchPublicMetadata = fetchPublicMetadata;
const http = __importStar(require("http"));
const https = __importStar(require("https"));
/**
 * Checks whether an IP or hostname is in a private, localhost, or link-local range.
 */
function isPrivateOrBlockedHost(hostname) {
    const lower = hostname.toLowerCase().trim();
    // Localhost aliases
    if (lower === 'localhost' ||
        lower.endsWith('.localhost') ||
        lower === '127.0.0.1' ||
        lower === '::1' ||
        lower === '0.0.0.0') {
        return true;
    }
    // IPv4 private & link-local ranges
    // 10.0.0.0/8
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(lower))
        return true;
    // 172.16.0.0/12
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(lower))
        return true;
    // 192.168.0.0/16
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(lower))
        return true;
    // 169.254.0.0/16 (Link-local / AWS metadata endpoint 169.254.169.254)
    if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(lower))
        return true;
    // Cloud metadata endpoint aliases
    if (lower.includes('metadata.google.internal') || lower.includes('169.254.169.254')) {
        return true;
    }
    return false;
}
/**
 * Fetches HTML with strict SSRF protections, timeout, and max byte limits.
 */
async function fetchPublicMetadata(targetUrl) {
    const result = {
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
        const ogImage = extractMetaAttribute(html, 'property', 'og:image') ||
            extractMetaAttribute(html, 'name', 'twitter:image');
        if (ogImage && /^https?:\/\//i.test(ogImage)) {
            result.remotePreviewImageUrl = ogImage;
        }
        // Canonical URL
        const canonical = extractTagAttribute(html, /<link[^>]+rel=["']canonical["'][^>]*>/i, 'href');
        if (canonical && /^https?:\/\//i.test(canonical)) {
            result.canonicalUrl = canonical;
        }
    }
    catch (err) {
        // Non-fatal; metadata is best effort
        console.warn(`[Metadata Fetch] Failed for ${targetUrl}:`, err);
    }
    return result;
}
function downloadLimitedHtml(urlStr, maxRedirects, maxBytes) {
    return new Promise((resolve, reject) => {
        if (maxRedirects < 0) {
            return reject(new Error('Too many redirects'));
        }
        let url;
        try {
            url = new URL(urlStr);
        }
        catch {
            return reject(new Error('Invalid URL'));
        }
        if (isPrivateOrBlockedHost(url.hostname)) {
            return reject(new Error(`SSRF Blocked: ${url.hostname}`));
        }
        const client = url.protocol === 'https:' ? https : http;
        const req = client.get(urlStr, {
            timeout: 5000,
            headers: {
                'User-Agent': 'rut-bot/1.0 (+https://rut.local)',
                Accept: 'text/html,application/xhtml+xml',
            },
        }, (res) => {
            // Handle redirects
            if (res.statusCode &&
                res.statusCode >= 300 &&
                res.statusCode < 400 &&
                res.headers.location) {
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
        });
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timed out'));
        });
        req.on('error', (err) => reject(err));
    });
}
function extractTagContent(html, regex) {
    const match = html.match(regex);
    return match && match[1] ? cleanText(match[1]) : null;
}
function extractMetaAttribute(html, attrName, attrVal) {
    const regex = new RegExp(`<meta[^>]+${attrName}=["']${attrVal}["'][^>]*content=["']([^"']+)["']`, 'i');
    const match = html.match(regex);
    if (match && match[1])
        return cleanText(match[1]);
    // Try reverse order: content="..." property="..."
    const reverseRegex = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*${attrName}=["']${attrVal}["']`, 'i');
    const reverseMatch = html.match(reverseRegex);
    if (reverseMatch && reverseMatch[1])
        return cleanText(reverseMatch[1]);
    return null;
}
function extractTagAttribute(html, tagRegex, attrName) {
    const tagMatch = html.match(tagRegex);
    if (!tagMatch)
        return null;
    const attrMatch = tagMatch[0].match(new RegExp(`${attrName}=["']([^"']+)["']`, 'i'));
    return attrMatch && attrMatch[1] ? cleanText(attrMatch[1]) : null;
}
function cleanText(raw) {
    return raw.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
}
//# sourceMappingURL=fetcher.js.map