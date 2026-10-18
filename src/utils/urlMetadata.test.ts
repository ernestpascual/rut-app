import {
  extractUrlMetadataFromUrl,
  humanizeSlug,
  enrichUrlMetadata,
  extractAuthorAndCaption,
  formatNotesWithCaption,
  cleanMetadata,
  parseInstagramDesc,
  parseThreadsDesc,
  truncateTitle,
  getPlatformFallbackSvg,
  INSTAGRAM_SVG,
  PINTEREST_SVG,
  THREADS_SVG,
  YOUTUBE_SVG,
  GENERIC_SVG,
} from './urlMetadata';

describe('URL Metadata and Auto-Tagging Engine', () => {
  test('humanizes slug properly', () => {
    expect(humanizeSlug('brutalist-concrete-residence-2024')).toBe('Brutalist Concrete Residence');
    expect(humanizeSlug('minimalist_packaging_design.html')).toBe('Minimalist Packaging Design');
  });

  test('extracts domain, platform, auto tags, and context from architectural URL', () => {
    const meta = extractUrlMetadataFromUrl('https://www.archdaily.com/1012345/monolithic-concrete-house');
    expect(meta.domain).toBe('archdaily.com');
    expect(meta.siteName).toBe('ArchDaily');
    expect(meta.autoTags).toContain('architecture');
    expect(meta.autoTags).toContain('concrete');
    expect(meta.autoTags).toContain('monolithic');
    expect(meta.title).toContain('Monolithic Concrete House');
    expect(meta.editorialContext).toContain('ArchDaily');
  });

  test('extracts Behance portfolio metadata and design tags', () => {
    const meta = extractUrlMetadataFromUrl('https://www.behance.net/gallery/9876543/Editorial-Typography-Branding');
    expect(meta.platform).toBe('behance');
    expect(meta.siteName).toBe('Behance');
    expect(meta.autoTags).toContain('behance');
    expect(meta.autoTags).toContain('portfolio');
    expect(meta.autoTags).toContain('typography');
    expect(meta.autoTags).toContain('branding');
    expect(meta.autoTags).toContain('editorial');
    expect(meta.editorialContext).toContain('Context:');
  });

  test('extracts Are.na research curation tags', () => {
    const meta = extractUrlMetadataFromUrl('https://www.are.na/channel/minimalist-furniture-ceramics');
    expect(meta.platform).toBe('arena');
    expect(meta.siteName).toBe('Are.na');
    expect(meta.autoTags).toContain('arena');
    expect(meta.autoTags).toContain('furniture');
    expect(meta.autoTags).toContain('ceramics');
    expect(meta.autoTags).toContain('minimalist');
  });

  test('extracts author, caption, and thumbnail from Instagram post URL and shared text', () => {
    const { author, caption, thumbnail } = extractAuthorAndCaption(
      'https://www.instagram.com/p/DecT31jlOWi/',
      'Studio Koto on Instagram: "Visual identity system for archival gallery"'
    );
    expect(author).toBe('Studio Koto');
    expect(caption).toBe('Visual identity system for archival gallery');
    expect(thumbnail).toBe('https://www.instagram.com/p/DecT31jlOWi/media/?size=l');

    const meta = extractUrlMetadataFromUrl(
      'https://www.instagram.com/p/DecT31jlOWi/',
      'Studio Koto on Instagram: "Visual identity system for archival gallery"'
    );
    expect(meta.platform).toBe('instagram');
    expect(meta.author).toBe('Studio Koto');
    expect(meta.caption).toBe('Visual identity system for archival gallery');
    expect(meta.previewImageUrl).toBe('https://www.instagram.com/p/DecT31jlOWi/media/?size=l');
  });

  test('extracts author and caption from Pinterest board or pin', () => {
    const { author, caption } = extractAuthorAndCaption(
      'https://www.pinterest.com/designstudio/brutalist-concrete-architecture/'
    );
    expect(author).toBe('designstudio');
    expect(caption).toBe('Brutalist Concrete Architecture');

    const meta = extractUrlMetadataFromUrl(
      'https://www.pinterest.com/designstudio/brutalist-concrete-architecture/'
    );
    expect(meta.platform).toBe('pinterest');
    expect(meta.author).toBe('designstudio');
    expect(meta.caption).toBe('Brutalist Concrete Architecture');
  });

  test('extracts author and caption from TikTok shared link and text', () => {
    const { author, caption } = extractAuthorAndCaption(
      'https://www.tiktok.com/@minimalistdesign/video/7123456789012345678',
      'Check out @minimalistdesign on TikTok: Brutalist concrete house tour #TikTok https://vt.tiktok.com/ZSjV2d9A/'
    );
    expect(author).toBe('minimalistdesign');
    expect(caption).toContain('Brutalist concrete house tour');

    const meta = extractUrlMetadataFromUrl(
      'https://www.tiktok.com/@minimalistdesign/video/7123456789012345678',
      'Check out @minimalistdesign on TikTok: Brutalist concrete house tour #TikTok https://vt.tiktok.com/ZSjV2d9A/'
    );
    expect(meta.platform).toBe('tiktok');
    expect(meta.author).toBe('minimalistdesign');
    expect(meta.caption).toContain('Brutalist concrete house tour');
  });

  test('formats notes cleanly with creator and caption', () => {
    const formatted = formatNotesWithCaption(
      'designstudio',
      'Brutalist Concrete Architecture',
      'Look into texture treatment'
    );
    expect(formatted).toContain('👤 @designstudio');
    expect(formatted).toContain('📝 Caption: "Brutalist Concrete Architecture"');
    expect(formatted).toContain('💡 Note: Look into texture treatment');
  });

  test('does not duplicate platform as author in formatNotesWithCaption or extractAuthorAndCaption', () => {
    const { author } = extractAuthorAndCaption(
      'https://www.pinterest.com/pin/123456789/',
      'Check out this pin from Pinterest'
    );
    expect(author).toBeNull();

    const formatted = formatNotesWithCaption(
      'Pinterest',
      'Brutalist Concrete Architecture',
      'Look into texture treatment',
      'Pinterest'
    );
    expect(formatted).not.toContain('@Pinterest');
    expect(formatted).toContain('🌐 Pinterest');
  });

  test('enriches with user note context', async () => {
    const enriched = await enrichUrlMetadata(
      'https://pinterest.com/pin/123-brutalist-basalt-sculpture',
      undefined,
      'Raw textures for packaging prototype'
    );
    expect(enriched.platform).toBe('pinterest');
    expect(enriched.editorialContext).toContain('Raw textures for packaging prototype');
    expect(enriched.autoTags).toContain('pinterest');
  });

  test('cleans HTML entities and unicode characters in metadata', () => {
    const raw = 'Brutalist &amp; Monolithic&#x20;Design &quot;Inspiration&quot;';
    expect(cleanMetadata(raw)).toBe('Brutalist & Monolithic Design "Inspiration"');
  });

  test('parses Instagram caption sentences cleanly from standard embed text', () => {
    const raw = 'on October 12, 2026: "Raw concrete monolith in Kyoto. Exploring tectonic mass and light."';
    const parsed = parseInstagramDesc(raw);
    expect(parsed).toBe('Raw concrete monolith in Kyoto. Exploring tectonic mass and light.');

    const loginWall = 'Log in to see photos and videos from friends';
    expect(parseInstagramDesc(loginWall)).toBe('Instagram video reference captured for ideation.');
  });

  test('parses Threads caption text cleanly', () => {
    const raw = 'Exploring brutalist typography systems on Threads: Modern grid with grotesque headers. - studio (@studio) on Threads';
    const parsed = parseThreadsDesc(raw);
    expect(parsed).toContain('Modern grid with grotesque headers.');
  });

  test('parses Instagram description with like/comment count header cleanly', () => {
    const raw = '64 likes, 17 comments - itsnextwork on October 13, 2026: “Follow and comment “uni” for hands-on AI projects of the week 👀 #ai#projects#students”.';
    const parsed = parseInstagramDesc(raw);
    expect(parsed).toBe('Follow and comment “uni” for hands-on AI projects of the week 👀 #ai#projects#students');
  });

  test('never generates dummy placeholder sentences when extracting metadata', () => {
    const meta = extractUrlMetadataFromUrl('https://example.com/unknown-resource');
    expect(meta.description).toBeNull();
    expect(meta.title).not.toContain('Saved reference from');
    expect(meta.editorialContext).not.toContain('exploring creative inspiration');
    expect(meta.editorialContext).not.toContain('focus on visual aesthetics');
  });

  test('shortens titles longer than 300 characters to 100 characters', () => {
    const longTitle = 'Super long title that repeats words for testing '.repeat(10);
    expect(longTitle.length).toBeGreaterThan(300);
    const truncated = truncateTitle(longTitle);
    expect(truncated.length).toBe(100);
    expect(truncated).toBe(longTitle.slice(0, 100).trim());

    // Titles under 300 are preserved
    expect(truncateTitle('Normal Title')).toBe('Normal Title');
  });
});

