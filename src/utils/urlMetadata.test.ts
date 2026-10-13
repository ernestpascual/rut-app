import {
  extractUrlMetadataFromUrl,
  humanizeSlug,
  enrichUrlMetadata,
  extractAuthorAndCaption,
  formatNotesWithCaption,
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
});
