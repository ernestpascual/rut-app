import { matchIdeaWithDump } from './ideaMatcher';
import { InspirationItem } from '../../types';

const TEST_DUMP_FIXTURES: InspirationItem[] = [
  {
    id: 'test-pin-ceramics',
    ownerUid: 'test-uid',
    kind: 'link',
    folder: 'dump',
    title: 'Nordic Organic Ceramic Forms & Stoneware',
    url: 'https://pinterest.com/pin/123',
    normalizedUrl: 'https://pinterest.com/pin/123',
    sharedText: null,
    userNote: 'Earthy ceramic vessels and pottery textures.',
    sourcePlatform: 'pinterest',
    sourceDomain: 'pinterest.com',
    sourceApp: 'Pinterest',
    previewDescription: null,
    remotePreviewImageUrl: null,
    tags: ['ceramics', 'pottery', 'scandi', 'minimal'],
    aiTags: ['stoneware', 'earth-tones', 'craft'],
    concepts: ['tactile materiality', 'organic pottery', 'wabi-sabi'],
    aiSummary: 'A visual study of stoneware pottery and natural clay textures.',
    processingStatus: 'ready',
    processingErrorCode: null,
    duplicateOf: null,
    archived: false,
    createdAt: Date.now() - 50000,
    updatedAt: Date.now() - 50000,
    capturedAt: Date.now() - 50000,
  },
  {
    id: 'test-ig-brutalist',
    ownerUid: 'test-uid',
    kind: 'link',
    title: 'Brutalist Swiss Posters and Concrete Layouts',
    url: 'https://instagram.com/reel/abc',
    normalizedUrl: 'https://instagram.com/reel/abc',
    sharedText: null,
    userNote: 'Monochrome grid posters with heavy concrete vibe.',
    sourcePlatform: 'instagram',
    sourceDomain: 'instagram.com',
    sourceApp: 'Instagram',
    previewDescription: null,
    remotePreviewImageUrl: null,
    tags: ['typography', 'brutalist', 'swiss', 'poster'],
    aiTags: ['monochrome', 'grid-system'],
    concepts: ['brutalist typography', 'swiss modernism'],
    aiSummary: 'Editorial posters utilizing tight grids and high contrast.',
    processingStatus: 'ready',
    processingErrorCode: null,
    duplicateOf: null,
    archived: false,
    createdAt: Date.now() - 20000,
    updatedAt: Date.now() - 20000,
    capturedAt: Date.now() - 20000,
  },
];

describe('ideaMatcher', () => {
  test('matches ceramics and pottery idea with ceramic dump inspirations', () => {
    const results = matchIdeaWithDump(
      {
        title: 'Organic Ceramic Tableware Line',
        brief: 'Nordic stoneware vessels, tactile pottery clay, and earthy minimalist forms',
        tags: ['ceramics', 'pottery'],
      },
      TEST_DUMP_FIXTURES
    );

    expect(results.length).toBeGreaterThan(0);
    const topMatch = results[0];
    expect(topMatch.inspiration.tags).toContain('ceramics');
    expect(topMatch.confidence).toBeGreaterThan(0.7);
    expect(topMatch.reason).toMatch(/ceramic/i);
  });

  test('matches brutalist architecture and typography idea', () => {
    const results = matchIdeaWithDump(
      {
        title: 'Brutalist Swiss Posters',
        brief: 'Monochrome grid layouts with heavy concrete architectural vibe',
      },
      TEST_DUMP_FIXTURES
    );

    expect(results.length).toBeGreaterThan(0);
    const topIds = results.slice(0, 3).map((r) => r.inspirationId);
    expect(topIds).toContain('test-ig-brutalist');
  });

  test('excludes items already attached as references', () => {
    const attached = new Set(['test-pin-ceramics']);
    const results = matchIdeaWithDump(
      {
        title: 'Ceramics',
      },
      TEST_DUMP_FIXTURES,
      attached
    );

    const foundAttached = results.find((r) => r.inspirationId === 'test-pin-ceramics');
    expect(foundAttached).toBeUndefined();
  });
});
