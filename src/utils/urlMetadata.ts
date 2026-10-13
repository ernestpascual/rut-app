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
  previewImageUrl: string | null;
  domain: string | null;
  platform: SourcePlatform;
  autoTags: string[];
  concepts: string[];
  editorialContext: string;
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
 * Extracts auto tags, title tokens, and concepts from a URL's structure.
 */
export function extractUrlMetadataFromUrl(rawUrl: string): ExtractedUrlMetadata {
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

  // Parse path components
  let parsedTitle: string | null = null;
  const pathTokens: string[] = [];

  try {
    const urlObj = new URL(norm);
    const pathParts = urlObj.pathname.split('/').filter((p) => p.length > 0);

    if (pathParts.length > 0) {
      // Find the most meaningful segment (usually the last or second to last)
      const meaningful = [...pathParts].reverse().find(
        (p) => p.length > 3 && !/^\d+$/.test(p) && !['p', 'pin', 'reel', 'post', 'item', 'watch'].includes(p.toLowerCase())
      );

      if (meaningful) {
        parsedTitle = humanizeSlug(meaningful);
      }

      // Collect path tokens for tagging
      pathParts.forEach((part) => {
        const words = part.toLowerCase().split(/[-_.]+/);
        words.forEach((w) => {
          if (w.length > 2 && !/^\d+$/.test(w)) {
            pathTokens.push(w);
          }
        });
      });
    }

    // Parse query params for search/topic keywords
    urlObj.searchParams.forEach((val, key) => {
      if (['q', 'query', 'tag', 'topic', 'search'].includes(key.toLowerCase())) {
        val.toLowerCase().split(/[\s,+_-]+/).forEach((w) => {
          if (w.length > 2) pathTokens.push(w);
        });
      }
    });
  } catch {}

  // Match design keywords from path tokens and domain
  pathTokens.forEach((token) => {
    DESIGN_KEYWORDS.forEach((keyword) => {
      if (token.includes(keyword) || keyword.includes(token)) {
        autoTagsSet.add(keyword);
      }
    });
  });

  // If no design keyword matched, add top informative path tokens
  if (autoTagsSet.size < 3) {
    pathTokens.slice(0, 3).forEach((token) => {
      if (token.length > 3 && !['html', 'index', 'view'].includes(token)) {
        autoTagsSet.add(token);
      }
    });
  }

  // Always ensure platform tag
  if (platform && platform !== 'other') {
    autoTagsSet.add(platform);
  }

  const autoTags = Array.from(autoTagsSet);
  const concepts = autoTags.slice(0, 4);

  const fallbackTitle = parsedTitle
    ? `${parsedTitle} (${siteName})`
    : `Saved reference from ${siteName}`;

  // Formulate rich editorial context
  const tagSummary = concepts.length > 0 ? concepts.join(', ') : 'creative inspiration';
  const editorialContext = `💡 ${siteName} reference • Context: Explores ${tagSummary} with focus on visual aesthetics and spatial composition.`;

  return {
    title: fallbackTitle,
    description: `Reference link from ${siteName} exploring ${tagSummary}. Saved to inspiration dump.`,
    siteName,
    previewImageUrl: null,
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
export async function enrichUrlMetadata(
  rawUrl: string,
  userTitle?: string,
  userNote?: string
): Promise<ExtractedUrlMetadata> {
  const base = extractUrlMetadataFromUrl(rawUrl);

  // If user provided a title, preserve it
  if (userTitle && userTitle.trim()) {
    base.title = userTitle.trim();
  }

  const isRestrictedDomain = CORS_RESTRICTED_DOMAINS.some((d) =>
    (base.domain || '').toLowerCase().includes(d)
  );

  // In web browsers, or for CORS-restricted domains, NEVER perform direct client fetch
  if (Platform.OS === 'web' || isRestrictedDomain) {
    if (userNote && userNote.trim()) {
      base.editorialContext = `💡 ${base.siteName} • User Note: "${userNote.trim()}" • Context: ${base.concepts.join(', ')}`;
    }
    return base;
  }

  // On native mobile (iOS/Android), attempt lightweight OpenGraph fetch for open domains
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      try {
        controller.abort();
      } catch {}
    }, 2000);

    const response = await fetch(rawUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
      },
    }).catch(() => null);

    clearTimeout(timeout);

    if (response && response.ok) {
      const html = await response.text().catch(() => '');
      if (html) {
        const titleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
                           html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const descMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) ||
                          html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
        const imageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
        const siteMatch = html.match(/<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)["']/i);

        if (titleMatch && titleMatch[1] && (!userTitle || !userTitle.trim())) {
          base.title = titleMatch[1].trim();
        }
        if (descMatch && descMatch[1]) {
          base.description = descMatch[1].trim();
        }
        if (imageMatch && imageMatch[1] && /^https?:\/\//i.test(imageMatch[1])) {
          base.previewImageUrl = imageMatch[1].trim();
        }
        if (siteMatch && siteMatch[1]) {
          base.siteName = siteMatch[1].trim();
        }
      }
    }
  } catch {
    // Pure fallback
  }

  if (userNote && userNote.trim()) {
    base.editorialContext = `💡 ${base.siteName} • User Note: "${userNote.trim()}" • Context: ${base.concepts.join(', ')}`;
  }

  return base;
}
