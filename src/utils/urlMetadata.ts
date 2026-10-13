import { Platform } from 'react-native';
import { SourcePlatform } from '../types';
import { detectPlatform, extractDomain, normalizeUrl } from './url';

const CORS_RESTRICTED_DOMAINS = [
  'instagram.com',
  'facebook.com',
  'fb.com',
  'tiktok.com',
  'twitter.com',
  'x.com',
  'threads.net',
  'pinterest.com',
  'pin.it',
  'linkedin.com',
  'youtube.com',
  'youtu.be',
];

export interface ExtractedUrlMetadata {
  title: string | null;
  description: string | null;
  siteName: string | null;
  author: string | null;
  caption: string | null;
  previewImageUrl: string | null;
  domain: string | null;
  platform: SourcePlatform;
  autoTags: string[];
  concepts: string[];
  editorialContext: string;
}

// Module-level base64 SVG mockups to ensure visual elements are never broken
export const INSTAGRAM_SVG = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMjUwIiB2aWV3Qm94PSIwIDAgNDAwIDI1MCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzA5MDkwOSIvPjxsaW5lYXJHcmFkaWVudCBpZD0iaWciIHgxPSIwIiB5MT0iMSIgeDI9IjEiIHkyPSIwIj48c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjZjljZTNmIi8+PHN0b3Agb2Zmc2V0PSI1MCUiIHN0b3AtY29sb3I9IiNlMTMwNmMiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiM4MzNhYjQiLz48L2xpbmVhckdyYWRpZW50PjxyZWN0IHg9IjE0MCIgeT0iNjUiIHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiByeD0iMjgiIGZpbGw9InVybCgjaWcpIi8+PHJlY3QgeD0iMTYwIiB5PSI4NSIgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiByeD0iMTgiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNiIvPjxjaXJjbGUgY3g9IjIwMCIgY3k9IjEyNSIgcj0iMjIiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNiIvPjxjaXJjbGUgY3g9IjIyNiIgY3k9Ijk5IiByPSI2IiBmaWxsPSJ3aGl0ZSIvPjwvc3ZnPg==";

export const PINTEREST_SVG = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMjUwIiB2aWV3Qm94PSIwIDAgNDAwIDI1MCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzA5MDkwOSIvPjxjaXJjbGUgY3g9IjIwMCIgY3k9IjEyNSIgcj0iNjAiIGZpbGw9IiNlNjAwMjMiLz48cGF0aCBkPSJNMjAwLDg1Yy0yMi4xLDAtNDAsMTcuOS00MCw0MGMwLDE2LjksMTAuNSwzMS40LDI1LjMsMzcuMmMtMC4zLTMuNy0wLjctOS41LDAuMS0xMy42YzAuOC0zLjcsNS4yLTIyLDUuMi0yMnMtMS4zLTIuNi0xLjMtNi41YzAtNi4xLDMuNS0xMC43LDgtMTAuN2MzLjgsMCw1LjYsMi44LDUuNiw2LjNjMCwzLjgtMi40LDkuNS0zLjcsMTQuOGMtMSw0LjQsMi4yLDgsNi41LDhjNy44LDAsMTMuOC04LjIsMTMuOC0yMC4xYzAtMTAuNS03LjUtMTcuOS0xOC40LTE3LjljLTEyLjUsMC0xOS45LDkuNC0xOS45LDE5LjJjMCwzLjgsMS41LDcuOCwzLjMsMTBjMC40LDAuNCwwLjQsMC44LDAuMywxLjJsLTEuMiw1Yy0wLjIsMC44LTAuNiwxLTEuNCwwLjZjLTUuMi0yLjQtOC41LTEwLTguNS0xNi4xYzAtMTMuMSw5LjUtMjUuMiwyNy41LTI1LjJjMTQuNCwwLDI1LjYsMTAuMywyNS42LDI0YzAsMTQuMy05LDI1LjgtMjEuNSwyNS44Yy00LjIsMC04LjItMi4yLTkuNS00LjJsLTIuNiw5LjljLTAuOSwzLjYtMy41LDguMS01LjIsMTAuOWMzLjksMS4yLDgsMS45LDEyLjMsMS45YzIyLjEsMCw0MC0xNy45LDQwLTQwQzI0MCwxMDIuOSwyMjIuMSw4NSwyMDAsODV6IiBmaWxsPSJ3aGl0ZSIvPjwvc3ZnPg==";

export const THREADS_SVG = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMjUwIiB2aWV3Qm94PSIwIDAgNDAwIDI1MCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzA5MDkwOSIvPjxwYXRoIGQ9Ik0yMDAsNzUgQzE4NSw3NSAxNzAsODUgMTcwLDEwNSBDMTcwLDEyNSAxODUsMTM1IDIwMCwxMzUgQzIxNSwxMzUgMjI1LDEyNSAyMjUsMTE1IEMyMjUsMTAwIDIxMCw5NSAyMDAsOTUgQzE4MCw5NSAxNjAsMTEwIDE2MCwxMzAgQzE2MCwxNTUgMTgwLDE3NSAyMDUsMTc1IEMyMjUsMTc1IDI0MCwxNjAgMjQwLDE0NSBMMjI1LDE0NSBDMjI1LDE1MiAyMTcsMTYwIDIwNSwxNjAgQzE5MCwxNjAgMTc1LDE0NSAxNzUsMTMwIEMxNzUsMTE4IDE4OCwxMTAgMjAwLDExMCBDMjEyLDExMCAyMTcsMTE4IDIxNSwxMjUgQzIxMiwxMzAgMjA2LDEzMiAyMDAsMTMyIEMxOTQsMTMyIDE4NSwxMjggMTg1LDExOCBDMTg1LDEwOCAxOTQsMTAzIDIwMCwxMDMgQzIwOCwxMDMgMjEzLDEwOCAyMTQsMTE1IE0yMDAsNjAgQzIzNSw2MCAyNTUsODUgMjU1LDExNSBDMjU1LDE0NSAyMzAsMTkwIDIwMCwxOTAgQzE2NSwxOTAgMTQ1LDE2NSAxNDUsMTMwIEMxNDUsOTUgMTcwLDYwIDIwMCw2MFoiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PC9zdmc+";

export const YOUTUBE_SVG = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMjUwIiB2aWV3Qm94PSIwIDAgNDAwIDI1MCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzA5MDkwOSIvPjxyZWN0IHg9IjEyMCIgeT0iNzAiIHdpZHRoPSIxNjAiIGhlaWdodD0iMTEwIiByeD0iMjQiIGZpbGw9IiNGRjAwMDAiLz48cG9seWdvbiBwb2ludHM9IjE3NSw5NSAyMjUsMTI1IDE3NSwxNTUiIGZpbGw9IndoaXRlIi8+PC9zdmc+";

export const GENERIC_SVG = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMjUwIiB2aWV3Qm94PSIwIDAgNDAwIDI1MCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzA5MDkwOSIvPjxsaW5lYXJHcmFkaWVudCBpZD0iZ3JhZCIgeDE9IjAiIHkxPSIwIiB4Mj0iMSIgeTI9IjEiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMwMDk5ZmYiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiM2YTRjZjUiLz48L2xpbmVhckdyYWRpZW50PjxyZWN0IHg9IjQwIiB5PSI0MCIgd2lkdGg9IjMyMCIgaGVpZ2h0PSIxNzAiIHJ4PSIxMiIgZmlsbD0idXJsKCNncmFkKSIgZmlsbD0ib3BhY2l0eT0iMC4yIiBzdHJva2U9InVybCgjZ3JhZCkiIHN0cm9rZS13aWR0aD0iMiIvPjxjaXJjbGUgY3g9IjEyMCIgY3k9IjEyNSIgcj0iNDAiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz48Y2lyY2xlIGN4PSIyODAiIGN5PSIxMjUiIHI9IjYwIiBmaWxsPSJ3aGl0ZSIgZmlsbC1vcGFjaXR5PSIwLjA1Ii8+PHBhdGggZD0iTTYwLDE4MCBMMzQwLDE4MCIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMSIgc3Ryb2tlLXdpZHRoPSI0IiBzdHJva2UtZGFzaGFycmF5PSIxMCA2Ii8+PC9zdmc+";

export function getPlatformFallbackSvg(platform?: string | null): string {
  switch (platform) {
    case 'instagram':
      return INSTAGRAM_SVG;
    case 'pinterest':
      return PINTEREST_SVG;
    case 'threads':
      return THREADS_SVG;
    case 'youtube':
      return YOUTUBE_SVG;
    default:
      return GENERIC_SVG;
  }
}

export function cleanMetadata(value: string): string {
  const entities: Record<string, string> = {
    amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' '
  };
  return value
    .replace(/\\u([\dA-Fa-f]{4})/g, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/&#x([\dA-Fa-f]+);/g, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number.parseInt(code, 10)))
    .replace(/&(amp|quot|apos|lt|gt|nbsp);/gi, (_, entity) => entities[entity.toLowerCase()] || entity)
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseInstagramDesc(desc: string): string {
  if (!desc) return '';
  if (/log in|login|welcome back|sign up/i.test(desc)) {
    return 'Instagram video reference captured for ideation.';
  }
  const match =
    desc.match(/on\s+[A-Za-z]+\s+\d+,\s*\d{4}\s*:\s*(?:\\?"|[“"])(.*)/i) ||
    desc.match(/:\s*(?:\\?"|[“"])(.*)/i);
  let content = match ? match[1] : desc;
  content = content.replace(/[”"]?\s*\.?\s*$/, '').trim();
  content = content.replace(/[”"]\s*$/, '').trim();
  const sentences = content.split(/(?<=[.!?])\s+/);
  return sentences.slice(0, 2).join(' ').trim();
}

export function parseThreadsDesc(desc: string): string {
  const match = desc.match(/on\s+Threads\s*:\s*(?:\\?"|")?(.*)/i);
  let content = match ? match[1] : desc;
  content = content.replace(/\s*-\s*[A-Za-z0-9_.]+\s*\(@[A-Za-z0-9_.]+\)\s*on\s*Threads\s*$/i, '');
  content = content.replace(/\\?"?\s*$/, '').trim();
  const sentences = content.split(/(?<=[.!?])\s+/);
  return sentences.slice(0, 2).join(' ');
}

const DOMAIN_PLATFORM_MAP: Record<string, { platform: SourcePlatform; siteName: string; defaultTags: string[] }> = {
  'instagram.com': { platform: 'instagram', siteName: 'Instagram', defaultTags: ['instagram', 'visual', 'lookbook', 'social'] },
  'pinterest.com': { platform: 'pinterest', siteName: 'Pinterest', defaultTags: ['pinterest', 'visual-inspiration', 'moodboard', 'curation'] },
  'pin.it': { platform: 'pinterest', siteName: 'Pinterest', defaultTags: ['pinterest', 'visual-inspiration', 'moodboard'] },
  'behance.net': { platform: 'behance', siteName: 'Behance', defaultTags: ['behance', 'portfolio', 'design', 'creative-direction'] },
  'dribbble.com': { platform: 'dribbble', siteName: 'Dribbble', defaultTags: ['dribbble', 'ui-design', 'visual-design', 'graphic-design'] },
  'are.na': { platform: 'arena', siteName: 'Are.na', defaultTags: ['arena', 'research', 'curation', 'moodboard', 'archive'] },
  'github.com': { platform: 'github', siteName: 'GitHub', defaultTags: ['github', 'code', 'open-source', 'software', 'tech'] },
  'youtube.com': { platform: 'youtube', siteName: 'YouTube', defaultTags: ['youtube', 'video', 'motion', 'audiovisual'] },
  'youtu.be': { platform: 'youtube', siteName: 'YouTube', defaultTags: ['youtube', 'video', 'motion'] },
  'vimeo.com': { platform: 'vimeo', siteName: 'Vimeo', defaultTags: ['vimeo', 'film', 'motion-design', 'cinematography'] },
  'tiktok.com': { platform: 'tiktok', siteName: 'TikTok', defaultTags: ['tiktok', 'short-form', 'motion', 'video'] },
  'twitter.com': { platform: 'x', siteName: 'X (Twitter)', defaultTags: ['x', 'microblog', 'discourse'] },
  'x.com': { platform: 'x', siteName: 'X', defaultTags: ['x', 'microblog', 'discourse'] },
  'threads.net': { platform: 'threads', siteName: 'Threads', defaultTags: ['threads', 'discourse', 'typography'] },
  'medium.com': { platform: 'medium', siteName: 'Medium', defaultTags: ['medium', 'editorial', 'writing', 'essay'] },
  'substack.com': { platform: 'substack', siteName: 'Substack', defaultTags: ['substack', 'newsletter', 'editorial', 'publication'] },
  'archdaily.com': { platform: 'web', siteName: 'ArchDaily', defaultTags: ['archdaily', 'architecture', 'built-environment', 'spatial', 'structures'] },
  'dezeen.com': { platform: 'web', siteName: 'Dezeen', defaultTags: ['dezeen', 'design', 'architecture', 'interiors', 'industrial-design'] },
  'designboom.com': { platform: 'web', siteName: 'Designboom', defaultTags: ['designboom', 'art', 'design', 'technology'] },
  'vogue.com': { platform: 'web', siteName: 'Vogue', defaultTags: ['vogue', 'fashion', 'editorial', 'runway', 'styling'] },
  'monocle.com': { platform: 'web', siteName: 'Monocle', defaultTags: ['monocle', 'editorial', 'print', 'lifestyle', 'journalism'] },
  'wallpaper.com': { platform: 'web', siteName: 'Wallpaper*', defaultTags: ['wallpaper', 'architecture', 'design', 'lifestyle'] },
};

const DESIGN_KEYWORDS = [
  'architecture', 'brutalist', 'brutalism', 'minimalist', 'minimalism',
  'monolith', 'monolithic', 'concrete', 'stone', 'marble', 'basalt',
  'typography', 'editorial', 'grotesque', 'serif', 'sans-serif',
  'branding', 'identity', 'packaging', 'industrial-design', 'product-design',
  'furniture', 'lighting', 'interior', 'interiors', 'spatial', 'spatial-design',
  'fashion', 'runway', 'textile', 'ceramic', 'ceramics', 'pottery',
  'poster', 'layout', 'grid', 'monochrome', 'black-and-white',
  'lookbook', 'curation', 'archive', 'exhibition', 'materiality',
  'tactile', 'hardware', 'metal', 'aluminum', 'matte', 'sculpture'
];

/**
 * Humanizes a slug token from a URL path.
 * e.g. "minimalist-concrete-house-2024" -> "Minimalist Concrete House"
 */
export function humanizeSlug(slug: string): string {
  if (!slug) return '';
  const cleaned = slug
    .replace(/\.[a-zA-Z0-9]+$/, '') // strip extension like .html
    .replace(/[_-]+/g, ' ')
    .replace(/\b\d{4,}\b/g, '') // remove large ID numbers or years
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Extracts author username, post caption, and instant thumbnail URL across platforms.
 */
export function extractAuthorAndCaption(
  rawUrl: string,
  sharedText?: string
): { author: string | null; caption: string | null; thumbnail: string | null } {
  let author: string | null = null;
  let caption: string | null = null;
  let thumbnail: string | null = null;

  const text = (sharedText || '').trim();

  try {
    const norm = normalizeUrl(rawUrl) || rawUrl.trim();
    const urlObj = new URL(norm);
    const domain = (urlObj.hostname || '').toLowerCase().replace(/^www\./, '');
    const pathParts = urlObj.pathname.split('/').filter(Boolean);

    // 1. INSTAGRAM
    if (domain.includes('instagram.com')) {
      const pIdx = pathParts.findIndex((p) => p === 'p' || p === 'reel' || p === 'reels');
      let shortcode: string | null = null;
      if (pIdx >= 0 && pathParts[pIdx + 1]) {
        shortcode = pathParts[pIdx + 1];
        if (pIdx > 0 && !['www', 'm'].includes(pathParts[pIdx - 1])) {
          author = pathParts[pIdx - 1];
        }
      } else if (pathParts.length === 1 && !['explore', 'reels', 'stories'].includes(pathParts[0])) {
        author = pathParts[0];
      }

      if (shortcode) {
        thumbnail = `https://www.instagram.com/p/${shortcode}/media/?size=l`;
      }

      // Check text for Instagram author and caption
      const igAuthorMatch = text.match(/([a-zA-Z0-9_.\s]+)\s+on\s+Instagram[:\s]/i) ||
                            text.match(/@([a-zA-Z0-9_.]{3,30})/);
      if (igAuthorMatch && igAuthorMatch[1]) {
        author = igAuthorMatch[1].trim().replace(/^@/, '');
      }

      const igCaptionMatch = text.match(/["“]([^"”]+)["”]/) ||
                             text.match(/on\s+Instagram:\s*(.+?)(?:https?:\/\/|$)/is);
      if (igCaptionMatch && igCaptionMatch[1] && igCaptionMatch[1].trim().length > 3) {
        caption = igCaptionMatch[1].trim();
      }
    }

    // 2. PINTEREST
    else if (domain.includes('pinterest.com') || domain.includes('pin.it')) {
      if (domain.includes('pinterest.com')) {
        if (pathParts.length >= 2 && !['pin', 'search', 'ideas', 'today'].includes(pathParts[0])) {
          author = pathParts[0];
          caption = humanizeSlug(pathParts[1]);
        } else if (pathParts.length === 1 && !['pin', 'search', 'ideas'].includes(pathParts[0])) {
          author = pathParts[0];
        }
      }

      const pinCaptionMatch = text.match(/["“]([^"”]+)["”]/) ||
                              text.match(/(?:Pinterest[:\s]+)(.+?)(?:https?:\/\/|$)/is);
      if (pinCaptionMatch && pinCaptionMatch[1]) {
        caption = pinCaptionMatch[1].trim();
      }
      const pinAuthorMatch = text.match(/(?:pinned by|from|by)\s+@?([a-zA-Z0-9_-]{3,30})/i);
      if (pinAuthorMatch && pinAuthorMatch[1]) {
        author = pinAuthorMatch[1].trim();
      }
    }

    // 3. YOUTUBE
    else if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
      let videoId: string | null = null;
      if (domain.includes('youtu.be') && pathParts[0]) {
        videoId = pathParts[0];
      } else if (urlObj.searchParams.has('v')) {
        videoId = urlObj.searchParams.get('v');
      } else if (pathParts[0] === 'shorts' && pathParts[1]) {
        videoId = pathParts[1];
      }

      if (videoId) {
        thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      }

      if (pathParts[0] && pathParts[0].startsWith('@')) {
        author = pathParts[0].slice(1);
      }
    }

    // 4. VIMEO
    else if (domain.includes('vimeo.com')) {
      const vimeoId = pathParts[0] && /^\d+$/.test(pathParts[0]) ? pathParts[0] : null;
      if (vimeoId) {
        thumbnail = `https://vumbnail.com/${vimeoId}.jpg`;
      }
    }

    // 5. X / TWITTER
    else if (domain.includes('twitter.com') || domain.includes('x.com')) {
      if (pathParts.length >= 1 && !['i', 'search', 'home', 'explore'].includes(pathParts[0])) {
        author = pathParts[0];
      }
      const tweetMatch = text.match(/["“]([^"”]+)["”]/) ||
                         text.match(/(.+?)(?:https?:\/\/|$)/is);
      if (tweetMatch && tweetMatch[1] && tweetMatch[1].trim().length > 3) {
        caption = tweetMatch[1].trim();
      }
    }

    // 6. TIKTOK
    else if (domain.includes('tiktok.com')) {
      if (pathParts[0] && pathParts[0].startsWith('@')) {
        author = pathParts[0].slice(1);
      }
    }

    // 7. BEHANCE
    else if (domain.includes('behance.net')) {
      if (pathParts[0] === 'gallery' && pathParts[2]) {
        caption = humanizeSlug(pathParts[2]);
      } else if (pathParts.length === 1) {
        author = pathParts[0];
      }
    }

    // 8. DRIBBBLE
    else if (domain.includes('dribbble.com')) {
      if (pathParts[0] === 'shots' && pathParts[1]) {
        caption = humanizeSlug(pathParts[1].replace(/^\d+-/, ''));
      } else if (pathParts.length === 1) {
        author = pathParts[0];
      }
    }

    // 9. GITHUB
    else if (domain.includes('github.com')) {
      if (pathParts[0]) author = pathParts[0];
      if (pathParts[1]) caption = humanizeSlug(pathParts[1]);
    }

    // 10. SUBSTACK & MEDIUM
    else if (domain.includes('substack.com')) {
      const sub = domain.split('.')[0];
      if (sub && sub !== 'www') author = sub;
      if (pathParts[1]) caption = humanizeSlug(pathParts[1]);
    } else if (domain.includes('medium.com')) {
      if (pathParts[0] && pathParts[0].startsWith('@')) {
        author = pathParts[0].slice(1);
      }
    }
  } catch {}

  if (!caption && text && !text.startsWith('http')) {
    caption = text.slice(0, 160);
  }

  return { author, caption, thumbnail };
}

/**
 * Formats note text with author creator info and caption.
 */
export function formatNotesWithCaption(
  author?: string | null,
  caption?: string | null,
  userNote?: string | null,
  siteName?: string | null
): string {
  const parts: string[] = [];
  if (siteName) {
    parts.push(`🌐 ${siteName}`);
  }
  if (author) {
    parts.push(`👤 @${author.replace(/^@/, '')}`);
  }
  if (caption) {
    parts.push(`📝 Caption: "${caption}"`);
  }
  if (userNote && userNote.trim() && !parts.some((p) => p.includes(userNote.trim()))) {
    parts.push(`💡 Note: ${userNote.trim()}`);
  }
  return parts.join('\n');
}

/**
 * Extracts auto tags, title tokens, author, caption, and concepts from a URL's structure.
 */
export function extractUrlMetadataFromUrl(rawUrl: string, sharedText?: string): ExtractedUrlMetadata {
  const norm = normalizeUrl(rawUrl) || rawUrl.trim();
  const domain = extractDomain(norm) || '';
  const cleanDomain = domain.toLowerCase().replace(/^www\./, '');

  let platform: SourcePlatform = detectPlatform(norm);
  let siteName = domain ? domain.charAt(0).toUpperCase() + domain.slice(1) : 'Web';
  const autoTagsSet = new Set<string>();

  // Check known domain mappings
  for (const [key, mapping] of Object.entries(DOMAIN_PLATFORM_MAP)) {
    if (cleanDomain.includes(key)) {
      platform = mapping.platform;
      siteName = mapping.siteName;
      mapping.defaultTags.forEach((t) => autoTagsSet.add(t));
      break;
    }
  }

  // Extract author username, caption, and thumbnail
  const { author, caption, thumbnail } = extractAuthorAndCaption(norm, sharedText);

  if (author) {
    const cleanAuthor = author.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (cleanAuthor) autoTagsSet.add(cleanAuthor);
  }

  // Parse path components
  let parsedTitle: string | null = null;
  const pathTokens: string[] = [];

  try {
    const urlObj = new URL(norm);
    const pathParts = urlObj.pathname.split('/').filter((p) => p.length > 0);

    if (pathParts.length > 0) {
      const meaningful = [...pathParts].reverse().find(
        (p) => p.length > 3 && !/^\d+$/.test(p) && !['p', 'pin', 'reel', 'post', 'item', 'watch'].includes(p.toLowerCase())
      );

      if (meaningful) {
        parsedTitle = humanizeSlug(meaningful);
      }

      pathParts.forEach((part) => {
        const words = part.toLowerCase().split(/[-_.]+/);
        words.forEach((w) => {
          if (w.length > 2 && !/^\d+$/.test(w)) {
            pathTokens.push(w);
          }
        });
      });
    }

    urlObj.searchParams.forEach((val, key) => {
      if (['q', 'query', 'tag', 'topic', 'search'].includes(key.toLowerCase())) {
        val.toLowerCase().split(/[\s,+_-]+/).forEach((w) => {
          if (w.length > 2) pathTokens.push(w);
        });
      }
    });
  } catch {}

  pathTokens.forEach((token) => {
    DESIGN_KEYWORDS.forEach((keyword) => {
      if (token.includes(keyword) || keyword.includes(token)) {
        autoTagsSet.add(keyword);
      }
    });
  });

  if (autoTagsSet.size < 3) {
    pathTokens.slice(0, 3).forEach((token) => {
      if (token.length > 3 && !['html', 'index', 'view'].includes(token)) {
        autoTagsSet.add(token);
      }
    });
  }

  if (platform && platform !== 'other') {
    autoTagsSet.add(platform);
  }

  const autoTags = Array.from(autoTagsSet);
  const concepts = autoTags.slice(0, 4);

  const fallbackTitle = caption
    ? `${caption} (${siteName})`
    : parsedTitle
    ? `${parsedTitle} (${siteName})`
    : author
    ? `@${author} on ${siteName}`
    : (siteName || 'Web Resource');

  const tagSummary = concepts.length > 0 ? concepts.join(', ') : '';
  const authorBadge = author ? `👤 @${author.replace(/^@/, '')}` : null;
  const captionSnippet = caption ? `📝 "${caption.slice(0, 80)}"` : null;
  const contextNotes = [authorBadge, captionSnippet].filter(Boolean).join(' • ');

  const editorialContext = contextNotes
    ? `💡 ${siteName} • ${contextNotes}${tagSummary ? ` • Context: ${tagSummary}` : ''}`
    : (tagSummary ? `💡 ${siteName} • Context: ${tagSummary}` : `💡 ${siteName}`);

  return {
    title: fallbackTitle,
    description: caption || null,
    siteName,
    author,
    caption,
    previewImageUrl: thumbnail,
    domain: cleanDomain || null,
    platform,
    autoTags,
    concepts,
    editorialContext,
  };
}

/**
 * Enhanced async metadata extractor: attempts live HTML metadata fetch if feasible,
 * and seamlessly merges with URL path semantic parsing.
 */
interface LiveMetadataPayload {
  title?: string;
  description?: string;
  author?: string;
  caption?: string;
  thumbnail?: string;
  domain?: string;
  siteName?: string;
}

/**
 * Fetches live metadata through multiple CORS-safe and server-backed strategies:
 * 1. Firebase Callable Cloud Function (if deployed)
 * 2. Official CORS-enabled oEmbed endpoints (YouTube, Vimeo, X)
 * 3. CORS-friendly universal OpenGraph extractor (Microlink) for Instagram, Pinterest, Threads, etc.
 * 4. Mobile native direct fetch (iOS/Android)
 */
export async function fetchLiveMetadata(rawUrl: string): Promise<LiveMetadataPayload | null> {
  const norm = normalizeUrl(rawUrl) || rawUrl.trim();
  let domain = '';
  try {
    domain = new URL(norm).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }

  // Strategy 1: Firebase Callable Cloud Function
  try {
    const { httpsCallable } = await import('firebase/functions');
    const { functions } = await import('../lib/firebase/client');
    if (functions) {
      const callCapture = httpsCallable<
        { url: string },
        {
          success: boolean;
          title?: string;
          description?: string;
          thumbnail?: string;
          author?: string;
          caption?: string;
          domain?: string;
        }
      >(functions, 'captureMetadata');

      const res = await callCapture({ url: norm });
      if (res?.data && res.data.success) {
        return {
          title: res.data.title,
          description: res.data.description,
          thumbnail: res.data.thumbnail,
          author: res.data.author,
          caption: res.data.caption,
          domain: res.data.domain,
        };
      }
    }
  } catch {
    // Continue to next strategy if callable is not yet deployed or unreachable
  }

  // Strategy 2: Official YouTube oEmbed (native CORS enabled by Google)
  if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(norm)}&format=json`;
      const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        return {
          title: cleanMetadata(data.title || ''),
          author: cleanMetadata(data.author_name || ''),
          thumbnail: data.thumbnail_url,
          siteName: 'YouTube',
        };
      }
    } catch {}
  }

  // Strategy 3: Official Vimeo oEmbed (native CORS enabled)
  if (domain.includes('vimeo.com')) {
    try {
      const oembedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(norm)}`;
      const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        return {
          title: cleanMetadata(data.title || ''),
          author: cleanMetadata(data.author_name || ''),
          description: cleanMetadata(data.description || ''),
          thumbnail: data.thumbnail_url,
          siteName: 'Vimeo',
        };
      }
    } catch {}
  }

  // Strategy 4: Official X (Twitter) oEmbed (native CORS enabled)
  if (domain.includes('twitter.com') || domain.includes('x.com')) {
    try {
      const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(norm)}`;
      const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        const rawHtml = data.html || '';
        const match = rawHtml.match(/<p[^>]*>(.*?)<\/p>/i);
        const tweetText = match ? cleanMetadata(match[1].replace(/<[^>]+>/g, '')) : undefined;
        return {
          title: cleanMetadata(data.author_name ? `Post by ${data.author_name}` : 'X Post'),
          author: cleanMetadata(data.author_name || ''),
          caption: tweetText,
          description: tweetText,
          siteName: 'X',
        };
      }
    } catch {}
  }

  // Strategy 5: Universal CORS-friendly OpenGraph resolver (Microlink)
  // Perfectly handles Instagram, Pinterest, Threads, and arbitrary websites in browser contexts
  try {
    const microUrl = `https://api.microlink.io/?url=${encodeURIComponent(norm)}`;
    const res = await fetch(microUrl, {
      signal: AbortSignal.timeout(7000),
      headers: {
        Accept: 'application/json',
      },
    });

    if (res.ok) {
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        const d = json.data;
        let title = cleanMetadata(d.title || '');
        let author = cleanMetadata(d.author || '');
        let caption = cleanMetadata(d.description || '');
        let image =
          d.image?.url && typeof d.image.url === 'string' && /^https?:\/\//i.test(d.image.url)
            ? d.image.url
            : undefined;

        // Instagram refinements
        if (domain.includes('instagram.com')) {
          const handleMatch = title.match(/\(@([A-Za-z0-9_.]+)\)/);
          if (handleMatch) {
            author = handleMatch[1];
          }
          if (caption) {
            const parsedCaption = parseInstagramDesc(caption);
            if (parsedCaption) {
              caption = parsedCaption;
              if (!title || /instagram/i.test(title)) {
                title = parsedCaption;
              }
            }
          }
          if (image && /rsrc\.php|logging|static\.cdninstagram\.com\/rsrc/i.test(image)) {
            image = undefined;
          }
        }

        // Threads refinements
        if (domain.includes('threads.net') || domain.includes('threads.com')) {
          if (caption) {
            const parsedCaption = parseThreadsDesc(caption);
            if (parsedCaption) {
              caption = parsedCaption;
              if (!title || /threads/i.test(title)) {
                title = parsedCaption;
              }
            }
          }
          if (image && /rsrc\.php|logging/i.test(image)) {
            image = undefined;
          }
        }

        // Pinterest refinements
        if (domain.includes('pinterest.com') || domain.includes('pin.it')) {
          if (caption && /Instagram:/i.test(caption)) {
            const parsed = parseInstagramDesc(caption);
            if (parsed) caption = parsed;
          }
        }

        if (/log in|login|welcome back|sign up/i.test(title)) {
          title = '';
        }

        return {
          title: title || undefined,
          author: author || undefined,
          caption: caption || undefined,
          description: caption || undefined,
          thumbnail: image,
          siteName: d.publisher ? cleanMetadata(d.publisher) : undefined,
        };
      }
    }
  } catch {}

  // Strategy 6: Native Mobile direct fetch (iOS / Android) for unrestricted domains
  if (Platform.OS !== 'web' && !CORS_RESTRICTED_DOMAINS.some((d) => domain.includes(d))) {
    try {
      const res = await fetch(norm, {
        signal: AbortSignal.timeout(3000),
        headers: {
          Accept: 'text/html',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        },
      });
      if (res.ok) {
        const html = await res.text();
        const titleMatch =
          html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
          html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const descMatch =
          html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) ||
          html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
        const imgMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
        const siteMatch = html.match(/<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)["']/i);

        return {
          title: titleMatch ? cleanMetadata(titleMatch[1]) : undefined,
          description: descMatch ? cleanMetadata(descMatch[1]) : undefined,
          caption: descMatch ? cleanMetadata(descMatch[1]) : undefined,
          thumbnail: imgMatch && /^https?:\/\//i.test(imgMatch[1]) ? imgMatch[1].trim() : undefined,
          siteName: siteMatch ? cleanMetadata(siteMatch[1]) : undefined,
        };
      }
    } catch {}
  }

  return null;
}

/**
 * Enhanced async metadata extractor: executes live metadata resolution across
 * multiple resilient providers and merges genuine data with zero dummy fallbacks.
 */
export async function enrichUrlMetadata(
  rawUrl: string,
  userTitle?: string,
  userNote?: string,
  sharedText?: string
): Promise<ExtractedUrlMetadata> {
  const base = extractUrlMetadataFromUrl(rawUrl, sharedText);

  if (userTitle && userTitle.trim()) {
    base.title = userTitle.trim();
  }

  const live = await fetchLiveMetadata(rawUrl).catch(() => null);

  if (live) {
    const isDomainOnly =
      live.title &&
      base.domain &&
      (live.title.toLowerCase() === base.domain.toLowerCase() ||
        live.title.toLowerCase() === `www.${base.domain.toLowerCase()}`);

    if (live.title && !isDomainOnly && (!userTitle || !userTitle.trim())) {
      base.title = live.title;
    }
    if (live.description) {
      base.description = live.description;
    }
    if (live.caption) {
      base.caption = live.caption;
    }
    if (live.author) {
      base.author = live.author;
      const cleanAuthor = live.author.toLowerCase().replace(/[^a-z0-9_-]/g, '');
      if (cleanAuthor && !base.autoTags.includes(cleanAuthor)) {
        base.autoTags.unshift(cleanAuthor);
      }
    }
    if (live.thumbnail) {
      base.previewImageUrl = live.thumbnail;
    }
    if (live.siteName) {
      const isCurated = Object.values(DOMAIN_PLATFORM_MAP).some((m) => m.siteName === base.siteName);
      if (!isCurated) {
        base.siteName = live.siteName;
      }
    }
    if (live.domain) {
      base.domain = live.domain;
    }

    // Extract genuine auto-tags from real title and caption
    const textPool = `${live.title || ''} ${live.caption || ''}`.toLowerCase();
    DESIGN_KEYWORDS.forEach((keyword) => {
      if (textPool.includes(keyword) && !base.autoTags.includes(keyword)) {
        base.autoTags.push(keyword);
      }
    });
  }

  if (base.author || base.caption || userNote) {
    base.editorialContext = formatNotesWithCaption(base.author, base.caption, userNote, base.siteName);
  }

  return base;
}
