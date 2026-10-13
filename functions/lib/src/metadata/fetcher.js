"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GENERIC_SVG = exports.YOUTUBE_SVG = exports.THREADS_SVG = exports.PINTEREST_SVG = exports.INSTAGRAM_SVG = void 0;
exports.isPrivateOrBlockedHost = isPrivateOrBlockedHost;
exports.parseInstagramDesc = parseInstagramDesc;
exports.parseThreadsDesc = parseThreadsDesc;
exports.cleanMetadata = cleanMetadata;
exports.normalizeTargetUrl = normalizeTargetUrl;
exports.captureMetadataAction = captureMetadataAction;
exports.fetchPublicMetadata = fetchPublicMetadata;
// Module-level base64 SVG mockups to ensure visual elements are never broken
exports.INSTAGRAM_SVG = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMjUwIiB2aWV3Qm94PSIwIDAgNDAwIDI1MCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzA5MDkwOSIvPjxsaW5lYXJHcmFkaWVudCBpZD0iaWciIHgxPSIwIiB5MT0iMSIgeDI9IjEiIHkyPSIwIj48c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjZjljZTNmIi8+PHN0b3Agb2Zmc2V0PSI1MCUiIHN0b3AtY29sb3I9IiNlMTMwNmMiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiM4MzNhYjQiLz48L2xpbmVhckdyYWRpZW50PjxyZWN0IHg9IjE0MCIgeT0iNjUiIHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiByeD0iMjgiIGZpbGw9InVybCgjaWcpIi8+PHJlY3QgeD0iMTYwIiB5PSI4NSIgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiByeD0iMTgiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNiIvPjxjaXJjbGUgY3g9IjIwMCIgY3k9IjEyNSIgcj0iMjIiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNiIvPjxjaXJjbGUgY3g9IjIyNiIgY3k9Ijk5IiByPSI2IiBmaWxsPSJ3aGl0ZSIvPjwvc3ZnPg==";
exports.PINTEREST_SVG = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMjUwIiB2aWV3Qm94PSIwIDAgNDAwIDI1MCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzA5MDkwOSIvPjxjaXJjbGUgY3g9IjIwMCIgY3k9IjEyNSIgcj0iNjAiIGZpbGw9IiNlNjAwMjMiLz48cGF0aCBkPSJNMjAwLDg1Yy0yMi4xLDAtNDAsMTcuOS00MCw0MGMwLDE2LjksMTAuNSwzMS40LDI1LjMsMzcuMmMtMC4zLTMuNy0wLjctOS41LDAuMS0xMy42YzAuOC0zLjcsNS4yLTIyLDUuMi0yMnMtMS4zLTIuNi0xLjMtNi41YzAtNi4xLDMuNS0xMC43LDgtMTAuN2MzLjgsMCw1LjYsMi44LDUuNiw2LjNjMCwzLjgtMi40LDkuNS0zLjcsMTQuOGMtMSw0LjQsMi4yLDgsNi41LDhjNy44LDAsMTMuOC04LjIsMTMuOC0yMC4xYzAtMTAuNS03LjUtMTcuOS0xOC40LTE3LjljLTEyLjUsMC0xOS45LDkuNC0xOS45LDE5LjJjMCwzLjgsMS41LDcuOCwzLjMsMTBjMC40LDAuNCwwLjQsMC44LDAuMywxLjJsLTEuMiw1Yy0wLjIsMC44LTAuNiwxLTEuNCwwLjZjLTUuMi0yLjQtOC41LTEwLTguNS0xNi4xYzAtMTMuMSw5LjUtMjUuMiwyNy41LTI1LjJjMTQuNCwwLDI1LjYsMTAuMywyNS42LDI0YzAsMTQuMy05LDI1LjgtMjEuNSwyNS44Yy00LjIsMC04LjItMi4yLTkuNS00LjJsLTIuNiw5LjljLTAuOSwzLjYtMy41LDguMS01LjIsMTAuOWMzLjksMS4yLDgsMS45LDEyLjMsMS45YzIyLjEsMCw0MC0xNy45LDQwLTQwQzI0MCwxMDIuOSwyMjIuMSw4NSwyMDAsODV6IiBmaWxsPSJ3aGl0ZSIvPjwvc3ZnPg==";
exports.THREADS_SVG = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMjUwIiB2aWV3Qm94PSIwIDAgNDAwIDI1MCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzA5MDkwOSIvPjxwYXRoIGQ9Ik0yMDAsNzUgQzE4NSw3NSAxNzAsODUgMTcwLDEwNSBDMTcwLDEyNSAxODUsMTM1IDIwMCwxMzUgQzIxNSwxMzUgMjI1LDEyNSAyMjUsMTE1IEMyMjUsMTAwIDIxMCw5NSAyMDAsOTUgQzE4MCw5NSAxNjAsMTEwIDE2MCwxMzAgQzE2MCwxNTUgMTgwLDE3NSAyMDUsMTc1IEMyMjUsMTc1IDI0MCwxNjAgMjQwLDE0NSBMMjI1LDE0NSBDMjI1LDE1MiAyMTcsMTYwIDIwNSwxNjAgQzE5MCwxNjAgMTc1LDE0NSAxNzUsMTMwIEMxNzUsMTE4IDE4OCwxMTAgMjAwLDExMCBDMjEyLDExMCAyMTcsMTE4IDIxNSwxMjUgQzIxMiwxMzAgMjA2LDEzMiAyMDAsMTMyIEMxOTQsMTMyIDE4NSwxMjggMTg1LDExOCBDMTg1LDEwOCAxOTQsMTAzIDIwMCwxMDMgQzIwOCwxMDMgMjEzLDEwOCAyMTQsMTE1IE0yMDAsNjAgQzIzNSw2MCAyNTUsODUgMjU1LDExNSBDMjU1LDE0NSAyMzAsMTkwIDIwMCwxOTAgQzE2NSwxOTAgMTQ1LDE2NSAxNDUsMTMwIEMxNDUsOTUgMTcwLDYwIDIwMCw2MFoiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PC9zdmc+";
exports.YOUTUBE_SVG = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMjUwIiB2aWV3Qm94PSIwIDAgNDAwIDI1MCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzA5MDkwOSIvPjxyZWN0IHg9IjEyMCIgeT0iNzAiIHdpZHRoPSIxNiIgIGhlaWdodD0iMTEwIiByeD0iMjQiIGZpbGw9IiNGRjAwMDAiLz48cG9seWdvbiBwb2ludHM9IjE3NSw5NSAyMjUsMTI1IDE3NSwxNTUiIGZpbGw9IndoaXRlIi8+PC9zdmc+";
exports.GENERIC_SVG = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMjUwIiB2aWV3Qm94PSIwIDAgNDAwIDI1MCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzA5MDkwOSIvPjxsaW5lYXJHcmFkaWVudCBpZD0iZ3JhZCIgeDE9IjAiIHkxPSIwIiB4Mj0iMSIgeTI9IjEiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMwMDk5ZmYiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiM2YTRjZjUiLz48L2xpbmVhckdyYWRpZW50PjxyZWN0IHg9IjQwIiB5PSI0MCIgd2lkdGg9IjMyMCIgaGVpZ2h0PSIxNzAiIHJ4PSIxMiIgZmlsbD0idXJsKCNncmFkKSIgZmlsbD0ib3BhY2l0eT0iMC4yIiBzdHJva2U9InVybCgjZ3JhZCkiIHN0cm9rZS13aWR0aD0iMiIvPjxjaXJjbGUgY3g9IjEyMCIgY3k9IjEyNSIgcj0iNDAiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz48Y2lyY2xlIGN4PSIyODAiIGN5PSIxMjUiIHI9IjYwIiBmaWxsPSJ3aGl0ZSIgZmlsbC1vcGFjaXR5PSIwLjA1Ii8+PHBhdGggZD0iTTYwLDE4MCBMMzQwLDE4MCIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMSIgc3Ryb2tlLXdpZHRoPSI0IiBzdHJva2UtZGFzaGFycmF5PSIxMCA2Ii8+PC9zdmc+";
/**
 * Checks whether an IP or hostname is in a private, localhost, or link-local range.
 */
function isPrivateOrBlockedHost(hostname) {
    const lower = hostname.toLowerCase().trim();
    if (lower === 'localhost' ||
        lower.endsWith('.localhost') ||
        lower === '127.0.0.1' ||
        lower === '::1' ||
        lower === '0.0.0.0') {
        return true;
    }
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(lower))
        return true;
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(lower))
        return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(lower))
        return true;
    if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(lower))
        return true;
    if (lower.includes('metadata.google.internal') || lower.includes('169.254.169.254')) {
        return true;
    }
    return false;
}
function parseInstagramDesc(desc) {
    if (/log in|login|welcome back|sign up/i.test(desc)) {
        return 'Instagram video reference captured for ideation.';
    }
    const match = desc.match(/on\s+[A-Za-z]+\s+\d+,\s*\d{4}\s*:\s*(?:\\?"|")?(.*)/i);
    let content = match ? match[1] : desc;
    content = content.replace(/\\?"?\s*$/, "").trim();
    const sentences = content.split(/(?<=[.!?])\s+/);
    return sentences.slice(0, 2).join(" ");
}
function parseThreadsDesc(desc) {
    const match = desc.match(/on\s+Threads\s*:\s*(?:\\?"|")?(.*)/i);
    let content = match ? match[1] : desc;
    content = content.replace(/\s*-\s*[A-Za-z0-9_.]+\s*\(@[A-Za-z0-9_.]+\)\s*on\s*Threads\s*$/i, "");
    content = content.replace(/\\?"?\s*$/, "").trim();
    const sentences = content.split(/(?<=[.!?])\s+/);
    return sentences.slice(0, 2).join(" ");
}
function cleanMetadata(value) {
    const entities = {
        amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " "
    };
    return value
        .replace(/\\u([\dA-Fa-f]{4})/g, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
        .replace(/&#x([\dA-Fa-f]+);/g, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number.parseInt(code, 10)))
        .replace(/&(amp|quot|apos|lt|gt|nbsp);/gi, (_, entity) => entities[entity.toLowerCase()] || entity)
        .replace(/\s+/g, " ")
        .trim();
}
function normalizeTargetUrl(rawUrl) {
    const trimmed = rawUrl.trim();
    if (/^(file|gopher|ftp|javascript|data|dict|blob|mailto):/i.test(trimmed)) {
        throw new Error('Only HTTP and HTTPS links can be captured.');
    }
    let formatted = trimmed.match(/^https?:\/\//i) ? trimmed : `https://${trimmed}`;
    const igMatch = formatted.match(/(?:instagram\.com|instagr\.am)\/(?:[A-Za-z0-9_.]+\/)?(p|reel|reels)\/([A-Za-z0-9_-]+)/i);
    if (igMatch) {
        const type = igMatch[1].toLowerCase() === 'reels' ? 'reel' : igMatch[1].toLowerCase();
        const shortcode = igMatch[2];
        formatted = `https://www.instagram.com/${type}/${shortcode}/`;
    }
    const parsed = new URL(formatted);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Only HTTP and HTTPS links can be captured.');
    }
    if (isPrivateOrBlockedHost(parsed.hostname)) {
        throw new Error(`SSRF Blocked: ${parsed.hostname}`);
    }
    return parsed;
}
function parseAttributes(tag) {
    const attributes = {};
    const attributePattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    for (const match of tag.matchAll(attributePattern)) {
        const key = match[1].toLowerCase();
        if (key !== 'meta' && key !== 'script') {
            attributes[key] = match[2] ?? match[3] ?? match[4] ?? '';
        }
    }
    return attributes;
}
function getMetaContent(html, names) {
    const targetNames = new Set(names.map((name) => name.toLowerCase()));
    for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
        const attributes = parseAttributes(tag);
        const name = attributes.property || attributes.name || attributes.itemprop;
        if (name && targetNames.has(name.toLowerCase()) && attributes.content) {
            return cleanMetadata(attributes.content);
        }
    }
    return undefined;
}
function getPageTitle(html) {
    const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    return titleMatch ? cleanMetadata(titleMatch[1].replace(/<[^>]+>/g, '')) : undefined;
}
function getPageSummary(html) {
    const paragraphMatch = html.match(/<p\b[^>]*>([\s\S]{40,1200}?)<\/p>/i);
    if (!paragraphMatch)
        return undefined;
    const summary = cleanMetadata(paragraphMatch[1].replace(/<[^>]+>/g, ''));
    return summary.length >= 40 ? summary.slice(0, 360) : undefined;
}
function resolveAssetUrl(value, pageUrl) {
    if (!value)
        return undefined;
    try {
        const assetUrl = new URL(value, pageUrl);
        return ['http:', 'https:'].includes(assetUrl.protocol) ? assetUrl.href : undefined;
    }
    catch {
        return undefined;
    }
}
function getLinkHref(html, relNames) {
    const targetNames = new Set(relNames.map((name) => name.toLowerCase()));
    for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
        const attributes = parseAttributes(tag);
        const relValues = (attributes.rel || '').toLowerCase().split(/\s+/);
        if (attributes.href && relValues.some((rel) => targetNames.has(rel))) {
            return cleanMetadata(attributes.href);
        }
    }
    return undefined;
}
function asString(value) {
    if (typeof value === 'string')
        return cleanMetadata(value);
    if (Array.isArray(value))
        return asString(value[0]);
    if (value && typeof value === 'object') {
        const nested = value;
        return asString(nested.url || nested.content);
    }
    return undefined;
}
function collectJsonLdObjects(value) {
    if (!value)
        return [];
    if (Array.isArray(value))
        return value.flatMap(collectJsonLdObjects);
    if (typeof value === 'object') {
        const record = value;
        return [record, ...collectJsonLdObjects(record['@graph'])];
    }
    return [];
}
function getJsonLdMetadata(html) {
    for (const script of html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || []) {
        const rawJson = script
            .replace(/^<script\b[^>]*>/i, '')
            .replace(/<\/script>$/i, '')
            .trim();
        try {
            const objects = collectJsonLdObjects(JSON.parse(cleanMetadata(rawJson)));
            for (const object of objects) {
                const thumbnail = asString(object.thumbnailUrl || object.image);
                const description = asString(object.description || object.caption);
                const title = asString(object.headline || object.name);
                const author = asString(object.author?.name || object.author);
                if (thumbnail || description || title) {
                    return { thumbnail, description, title, author, caption: description };
                }
            }
        }
        catch { }
    }
    return {};
}
function getHtmlPreview(html, pageUrl) {
    const jsonLd = getJsonLdMetadata(html);
    const thumbnail = resolveAssetUrl(getMetaContent(html, ['og:image', 'og:image:url', 'og:image:secure_url', 'twitter:image', 'twitter:image:src', 'thumbnailurl']) || jsonLd.thumbnail, pageUrl);
    const favicon = resolveAssetUrl(getLinkHref(html, ['apple-touch-icon', 'icon', 'shortcut icon']) || '/favicon.ico', pageUrl);
    return {
        title: getMetaContent(html, ['og:title', 'twitter:title', 'title']) || jsonLd.title || getPageTitle(html),
        thumbnail,
        description: getMetaContent(html, ['og:description', 'twitter:description', 'description']) || jsonLd.description || getPageSummary(html),
        favicon,
        author: jsonLd.author,
        caption: jsonLd.caption,
        resolvedUrl: pageUrl,
        source: 'html'
    };
}
function scorePreview(preview) {
    let score = 0;
    if (preview.thumbnail && !preview.thumbnail.includes('svg'))
        score += 5;
    if (preview.title) {
        if (/login|log in|page not found|sign up/i.test(preview.title)) {
            score -= 20;
        }
        else {
            score += 2;
        }
    }
    if (preview.description) {
        if (/log in to|welcome back|sign up for instagram|login/i.test(preview.description)) {
            score -= 20;
        }
        else {
            score += 2;
        }
    }
    if (preview.favicon)
        score += 1;
    if (preview.source === 'oembed' && preview.thumbnail)
        score += 10;
    return score;
}
async function fetchHtmlPreview(requestedUrl, userAgent) {
    const response = await fetch(requestedUrl.href, {
        redirect: 'follow',
        signal: AbortSignal.timeout(10_000),
        headers: {
            'User-Agent': userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        }
    });
    if (!response.ok) {
        throw new Error(`Platform returned HTTP ${response.status}`);
    }
    const html = await response.text();
    return getHtmlPreview(html, response.url || requestedUrl.href);
}
async function fetchInstagramOEmbed(requestedUrl) {
    try {
        const oembedUrl = new URL('https://graph.facebook.com/v19.0/instagram_oembed');
        oembedUrl.searchParams.set('url', requestedUrl.href);
        oembedUrl.searchParams.set('omitscript', 'true');
        const response = await fetch(oembedUrl.href, {
            signal: AbortSignal.timeout(8_000),
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
            }
        });
        if (!response.ok)
            return null;
        const data = await response.json();
        const author = asString(data.author_name);
        const isReel = requestedUrl.pathname.includes('/reel/') || requestedUrl.pathname.includes('/reels/');
        const rawTitle = asString(data.title);
        const cleanTitle = (rawTitle && !/login|log in|page not found|sign up/i.test(rawTitle) && rawTitle !== 'Instagram')
            ? rawTitle
            : (isReel
                ? (author ? `Instagram Reel by ${author}` : "Instagram Reel")
                : (author ? `Instagram Post by ${author}` : "Instagram Post"));
        return {
            title: cleanTitle,
            description: author ? `Instagram reference by ${author}.` : 'Instagram reference captured through public oEmbed metadata.',
            thumbnail: resolveAssetUrl(asString(data.thumbnail_url), requestedUrl.href),
            favicon: 'https://www.instagram.com/static/images/ico/favicon-192.png/68d99ba29cc8.png',
            author: author || undefined,
            caption: rawTitle || undefined,
            resolvedUrl: requestedUrl.href,
            source: 'oembed'
        };
    }
    catch {
        return null;
    }
}
async function fetchInstagramEmbedPage(requestedUrl) {
    try {
        const match = requestedUrl.pathname.match(/\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/);
        if (!match)
            return null;
        const shortcode = match[1];
        const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
        const response = await fetch(embedUrl, {
            signal: AbortSignal.timeout(8_000),
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });
        if (!response.ok)
            return null;
        const html = await response.text();
        let thumbnail = getMetaContent(html, ['og:image', 'twitter:image']);
        if (!thumbnail) {
            const imgMatch = html.match(/class="EmbeddedMediaImage"[^>]*src="([^"]+)"/i) || html.match(/<img\b[^>]*src="([^"]+)"/i);
            if (imgMatch) {
                thumbnail = cleanMetadata(imgMatch[1]);
            }
        }
        let title = getMetaContent(html, ['og:title', 'twitter:title']);
        const authorMatch = html.match(/class="CaptionUsername"[^>]*>([^<]+)</i) || html.match(/@([A-Za-z0-9_.]+)/);
        const author = authorMatch ? authorMatch[1].trim() : undefined;
        const isReel = requestedUrl.pathname.includes('/reel') || requestedUrl.pathname.includes('/reels');
        if (!title || /login|log in|page not found/i.test(title)) {
            title = isReel
                ? (author ? `Instagram Reel by ${author}` : "Instagram Reel")
                : (author ? `Instagram Post by ${author}` : "Instagram Post");
        }
        let description = getMetaContent(html, ['og:description', 'twitter:description']);
        if (!description || /login|log in|welcome back/i.test(description)) {
            const captionMatch = html.match(/class="Caption"[^>]*>([\s\S]*?)<\/div>/i);
            if (captionMatch) {
                description = cleanMetadata(captionMatch[1].replace(/<[^>]+>/g, ''));
            }
        }
        return {
            title,
            description: description ? parseInstagramDesc(description) : `Instagram reference captured from instagram.com/p/${shortcode}/`,
            thumbnail: thumbnail && !/rsrc\.php|logging|login/i.test(thumbnail) ? thumbnail : `https://www.instagram.com/p/${shortcode}/media/?size=l`,
            favicon: 'https://www.instagram.com/static/images/ico/favicon-192.png/68d99ba29cc8.png',
            author: author || undefined,
            caption: description || undefined,
            resolvedUrl: requestedUrl.href,
            source: 'html'
        };
    }
    catch {
        return null;
    }
}
async function fetchThreadsOEmbed(requestedUrl) {
    try {
        const oembedUrl = new URL('https://graph.facebook.com/v19.0/threads_oembed');
        oembedUrl.searchParams.set('url', requestedUrl.href);
        oembedUrl.searchParams.set('omitscript', 'true');
        const response = await fetch(oembedUrl.href, {
            signal: AbortSignal.timeout(8_000),
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
            }
        });
        if (!response.ok)
            return null;
        const data = await response.json();
        const author = asString(data.author_name);
        return {
            title: asString(data.title || data.provider_name),
            description: author ? `Threads post by ${author}.` : 'Threads post captured through public oEmbed metadata.',
            thumbnail: resolveAssetUrl(asString(data.thumbnail_url), requestedUrl.href),
            favicon: 'https://www.threads.net/favicon.ico',
            author: author || undefined,
            resolvedUrl: requestedUrl.href,
            source: 'oembed'
        };
    }
    catch {
        return null;
    }
}
/**
 * Server-side action that fetches rich metadata from target URLs (bypassing client-side CORS issues).
 * Uses multi-strategy scraping with specialized Instagram embed/oEmbed extractors and fallback vector SVGs.
 */
async function captureMetadataAction(url) {
    let requestedUrl;
    try {
        requestedUrl = normalizeTargetUrl(url);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid URL';
        return {
            success: false,
            error: message,
            title: 'Invalid link',
            thumbnail: exports.GENERIC_SVG,
            description: 'Enter a complete website address to capture a visual reference.',
            platform: 'generic'
        };
    }
    const isInstagram = requestedUrl.hostname.includes("instagram.com") || requestedUrl.hostname.includes("instagr.am");
    const isPinterest = requestedUrl.hostname.includes("pinterest.com") || requestedUrl.hostname.includes("pin.it");
    const isThreads = requestedUrl.hostname.includes("threads.net") || requestedUrl.hostname.includes("threads.com");
    const isYouTube = requestedUrl.hostname.includes("youtube.com") || requestedUrl.hostname.includes("youtu.be");
    const platform = isInstagram ? 'instagram' : isPinterest ? 'pinterest' : isThreads ? 'threads' : isYouTube ? 'youtube' : 'generic';
    try {
        const userAgents = isInstagram || isPinterest || isThreads || isYouTube
            ? [
                'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
                'Twitterbot/1.0',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
            ]
            : [
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
            ];
        const previews = await Promise.allSettled([
            ...userAgents.map((userAgent) => fetchHtmlPreview(requestedUrl, userAgent)),
            ...(isInstagram ? [fetchInstagramOEmbed(requestedUrl), fetchInstagramEmbedPage(requestedUrl)] : []),
            ...(isThreads ? [fetchThreadsOEmbed(requestedUrl)] : [])
        ]);
        const bestPreview = previews
            .flatMap((result) => (result.status === 'fulfilled' && result.value ? [result.value] : []))
            .sort((a, b) => scorePreview(b) - scorePreview(a))[0];
        if (!bestPreview) {
            throw new Error('No public metadata response was available.');
        }
        const isReel = isInstagram && (requestedUrl.pathname.includes('/reel/') || requestedUrl.pathname.includes('/reels/'));
        const isPost = isInstagram && requestedUrl.pathname.includes('/p/');
        const pageUrl = (bestPreview.resolvedUrl && !bestPreview.resolvedUrl.includes('/accounts/login'))
            ? bestPreview.resolvedUrl
            : requestedUrl.href;
        const page = new URL(pageUrl);
        const pageHost = page.hostname.replace(/^www\./, '');
        let extractedDesc = bestPreview.description;
        if (extractedDesc && /log in to|welcome back|sign up for instagram|login/i.test(extractedDesc)) {
            extractedDesc = undefined;
        }
        let extractedTitle = bestPreview.title;
        if (!extractedTitle || /login|log in|page not found|sign up/i.test(extractedTitle) || extractedTitle === 'Instagram') {
            extractedTitle = isReel
                ? "Instagram Reel"
                : isPost
                    ? "Instagram Post"
                    : isInstagram
                        ? "Instagram Reference Post"
                        : isPinterest
                            ? "Pinterest Visual Pin"
                            : isThreads
                                ? "Threads Post"
                                : isYouTube
                                    ? "YouTube Video"
                                    : "Web Resource";
        }
        const fallbackDescription = `Reference from ${pageHost}${page.pathname === '/' ? '' : page.pathname}.`;
        let thumbnail = bestPreview.thumbnail;
        if (thumbnail && /rsrc\.php|logging|login/i.test(thumbnail)) {
            thumbnail = undefined;
        }
        // Specialized platform instant thumbnail if available
        if (!thumbnail && isInstagram) {
            const match = requestedUrl.pathname.match(/\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/);
            if (match) {
                thumbnail = `https://www.instagram.com/p/${match[1]}/media/?size=l`;
            }
        }
        else if (!thumbnail && isYouTube) {
            let vid = null;
            if (requestedUrl.hostname.includes('youtu.be')) {
                vid = requestedUrl.pathname.slice(1);
            }
            else if (requestedUrl.searchParams.has('v')) {
                vid = requestedUrl.searchParams.get('v');
            }
            if (vid) {
                thumbnail = `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
            }
        }
        let finalThumbnail = thumbnail || bestPreview.favicon;
        if (!finalThumbnail || /rsrc\.php|logging|login/i.test(finalThumbnail)) {
            finalThumbnail = platform === 'pinterest'
                ? exports.PINTEREST_SVG
                : platform === 'instagram'
                    ? exports.INSTAGRAM_SVG
                    : platform === 'threads'
                        ? exports.THREADS_SVG
                        : platform === 'youtube'
                            ? exports.YOUTUBE_SVG
                            : exports.GENERIC_SVG;
        }
        return {
            success: true,
            title: extractedTitle,
            thumbnail: finalThumbnail,
            description: isInstagram && extractedDesc
                ? parseInstagramDesc(extractedDesc)
                : isThreads && extractedDesc
                    ? parseThreadsDesc(extractedDesc)
                    : (extractedDesc || fallbackDescription),
            favicon: bestPreview.favicon,
            author: bestPreview.author,
            caption: bestPreview.caption || extractedDesc,
            domain: pageHost,
            resolvedUrl: pageUrl,
            source: bestPreview.source,
            platform
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown metadata lookup error';
        console.warn(`[rut metadata] Lookup warning for ${url}:`, message);
        const fallbackTitle = isInstagram ? "Instagram Reference" : isPinterest ? "Pinterest Pin" : isThreads ? "Threads Post" : isYouTube ? "YouTube Video" : "Captured Reference";
        const fallbackDesc = `Could not fetch public preview metadata from ${requestedUrl.hostname}.`;
        return {
            success: false,
            error: message,
            title: fallbackTitle,
            thumbnail: platform === 'pinterest' ? exports.PINTEREST_SVG : platform === 'instagram' ? exports.INSTAGRAM_SVG : platform === 'threads' ? exports.THREADS_SVG : platform === 'youtube' ? exports.YOUTUBE_SVG : exports.GENERIC_SVG,
            description: fallbackDesc,
            favicon: platform === 'generic' ? new URL('/favicon.ico', requestedUrl.href).href : undefined,
            domain: requestedUrl.hostname.replace(/^www\./, ''),
            resolvedUrl: requestedUrl.href,
            source: 'fallback',
            platform
        };
    }
}
/**
 * Backwards-compatible helper for background triggers like onInspirationCreated.
 */
async function fetchPublicMetadata(targetUrl) {
    const meta = await captureMetadataAction(targetUrl);
    return {
        title: meta.title,
        description: meta.description,
        canonicalUrl: meta.resolvedUrl || targetUrl,
        remotePreviewImageUrl: meta.thumbnail && !meta.thumbnail.startsWith('data:image/svg') ? meta.thumbnail : null,
    };
}
//# sourceMappingURL=fetcher.js.map