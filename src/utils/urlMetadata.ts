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
    : `Saved reference from ${siteName}`;

  const tagSummary = concepts.length > 0 ? concepts.join(', ') : 'creative inspiration';
  const authorBadge = author ? `👤 @${author.replace(/^@/, '')}` : null;
  const captionSnippet = caption ? `📝 "${caption.slice(0, 80)}"` : null;
  const contextNotes = [authorBadge, captionSnippet].filter(Boolean).join(' • ');

  const editorialContext = contextNotes
    ? `💡 ${siteName} • ${contextNotes} • Context: ${tagSummary}`
    : `💡 ${siteName} reference • Context: Explores ${tagSummary} with focus on visual aesthetics.`;

  return {
    title: fallbackTitle,
    description: caption || `Reference link from ${siteName} exploring ${tagSummary}. Saved to inspiration dump.`,
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
export async function enrichUrlMetadata(
  rawUrl: string,
  userTitle?: string,
  userNote?: string,
  sharedText?: string
): Promise<ExtractedUrlMetadata> {
  const base = extractUrlMetadataFromUrl(rawUrl, sharedText);

  // If user provided a title, preserve it
  if (userTitle && userTitle.trim()) {
    base.title = userTitle.trim();
  }

  const isRestrictedDomain = CORS_RESTRICTED_DOMAINS.some((d) =>
    (base.domain || '').toLowerCase().includes(d)
  );

  // In web browsers, or for CORS-restricted domains, NEVER perform direct client fetch
  if (Platform.OS === 'web' || isRestrictedDomain) {
    if (base.author || base.caption || userNote) {
      base.editorialContext = formatNotesWithCaption(base.author, base.caption, userNote, base.siteName);
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

  if (base.author || base.caption || userNote) {
    base.editorialContext = formatNotesWithCaption(base.author, base.caption, userNote, base.siteName);
  }

  return base;
}
