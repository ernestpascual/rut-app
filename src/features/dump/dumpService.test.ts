import {
  sortDumpItems,
  quickDumpLinkOrNote,
  deleteInspiration,
  getDumpInspirations,
  attachInspirationToProject,
  getProjectLinks,
  detachInspirationFromProject,
} from './dumpService';
import { InspirationItem } from '../../types';

const TEST_SORT_FIXTURES: InspirationItem[] = [
  {
    id: 'item-1',
    ownerUid: 'uid',
    kind: 'link',
    title: 'Alpha Concept',
    url: null,
    normalizedUrl: null,
    sharedText: null,
    userNote: null,
    sourcePlatform: 'instagram',
    sourceDomain: 'instagram.com',
    sourceApp: 'Instagram',
    previewDescription: null,
    remotePreviewImageUrl: null,
    tags: ['tag1', 'tag2'],
    aiTags: ['ai1'],
    concepts: [],
    aiSummary: null,
    processingStatus: 'ready',
    processingErrorCode: null,
    duplicateOf: null,
    archived: false,
    createdAt: 1000,
    updatedAt: 1000,
    capturedAt: 1000,
  },
  {
    id: 'item-2',
    ownerUid: 'uid',
    kind: 'link',
    title: 'Zeta Concept',
    url: null,
    normalizedUrl: null,
    sharedText: null,
    userNote: null,
    sourcePlatform: 'pinterest',
    sourceDomain: 'pinterest.com',
    sourceApp: 'Pinterest',
    previewDescription: null,
    remotePreviewImageUrl: null,
    tags: ['tag1'],
    aiTags: [],
    concepts: [],
    aiSummary: null,
    processingStatus: 'ready',
    processingErrorCode: null,
    duplicateOf: null,
    archived: false,
    createdAt: 2000,
    updatedAt: 2000,
    capturedAt: 2000,
  },
];

describe('dumpService sorting', () => {
  test('sorts by newest and oldest correctly', () => {
    const newest = sortDumpItems(TEST_SORT_FIXTURES, 'newest');
    expect(newest[0].createdAt).toBe(2000);

    const oldest = sortDumpItems(TEST_SORT_FIXTURES, 'oldest');
    expect(oldest[0].createdAt).toBe(1000);
  });

  test('sorts by title ascending and descending', () => {
    const asc = sortDumpItems(TEST_SORT_FIXTURES, 'title-asc');
    expect(asc[0].title).toBe('Alpha Concept');

    const desc = sortDumpItems(TEST_SORT_FIXTURES, 'title-desc');
    expect(desc[0].title).toBe('Zeta Concept');
  });

  test('sorts by platform', () => {
    const byPlatform = sortDumpItems(TEST_SORT_FIXTURES, 'platform');
    expect(byPlatform.length).toBe(TEST_SORT_FIXTURES.length);
  });

  test('quickDumpLinkOrNote captures full metadata for shared URLs', async () => {
    const item = await quickDumpLinkOrNote(
      'https://www.behance.net/gallery/999/Brutalist-Architecture-Identity',
      'Incredible use of concrete materials'
    );
    expect(item.kind).toBe('link');
    expect(item.sourcePlatform).toBe('behance');
    expect(item.siteName).toBe('Behance');
    expect(item.sourceDomain).toBe('behance.net');
    expect(item.title).toContain('Brutalist Architecture Identity');
    expect(item.tags).toEqual(expect.arrayContaining(['behance', 'architecture', 'brutalist']));
    expect(item.concepts.length).toBeGreaterThan(0);
    expect(item.editorialContext).toContain('Behance');
    expect(item.editorialContext).toContain('Incredible use of concrete materials');
  }, 15000);

  test('quickDumpLinkOrNote does not duplicate an existing link in the dump', async () => {
    const item1 = await quickDumpLinkOrNote(
      'https://www.pinterest.com/pin/123456789/',
      'First dump of ceramic vase'
    );
    const item2 = await quickDumpLinkOrNote(
      'https://www.pinterest.com/pin/123456789/?utm_source=share',
      'Second dump with tracking query'
    );
    expect(item1.id).toBe(item2.id);
  }, 15000);

  test('deleteInspiration removes an item from local storage dump', async () => {
    const item = await quickDumpLinkOrNote(
      'https://news.ycombinator.com/item?id=123456',
      'Hacker News item to delete'
    );
    const before = await getDumpInspirations();
    expect(before.some((i) => i.id === item.id)).toBe(true);

    await deleteInspiration(item.id);
    const after = await getDumpInspirations();
    expect(after.some((i) => i.id === item.id)).toBe(false);
  }, 15000);

  test('attachInspirationToProject does not duplicate links when attached repeatedly', async () => {
    const projectId = `proj-test-${Date.now()}`;
    const inspirationId = `insp-test-${Date.now()}`;

    // First attach
    const link1 = await attachInspirationToProject(projectId, inspirationId, 'ai', 'First match reason', 0.95);
    expect(link1.inspirationId).toBe(inspirationId);

    // Second attach (same inspirationId)
    const link2 = await attachInspirationToProject(projectId, inspirationId, 'user', 'Updated reason', null);
    expect(link2.inspirationId).toBe(inspirationId);

    // Verify getProjectLinks only has one entry for this inspirationId
    const links = await getProjectLinks(projectId);
    const matching = links.filter((l) => (l.inspirationId || l.id) === inspirationId);
    expect(matching.length).toBe(1);
    expect(matching[0].reason).toBe('Updated reason');

    // Detach
    await detachInspirationFromProject(projectId, inspirationId);
    const afterDetach = await getProjectLinks(projectId);
    expect(afterDetach.some((l) => (l.inspirationId || l.id) === inspirationId)).toBe(false);
  }, 15000);
});
