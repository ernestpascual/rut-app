import AsyncStorage from '@react-native-async-storage/async-storage';
import { InspirationItem, Project, ProjectInspirationLink, SourcePlatform } from '../../types';
import { detectPlatform, extractDomain, generateContentHash, normalizeUrl } from '../../utils/url';

export type DumpSortOption =
  | 'newest'
  | 'oldest'
  | 'platform'
  | 'title-asc'
  | 'title-desc'
  | 'tags';

const DUMP_STORAGE_KEY = '@rut_dump_inspirations_v2';
const PROJECTS_STORAGE_KEY = '@rut_projects_v2';
const LINKS_STORAGE_PREFIX = '@rut_project_links_v2:';

export const INITIAL_PROJECT_IDEAS: Project[] = [];

// Cleanup older mock data keys from v1 if present
async function cleanupOldStorageKeys() {
  try {
    await AsyncStorage.removeItem('@rut_dump_inspirations_v1');
    await AsyncStorage.removeItem('@rut_projects_v1');
  } catch {}
}
cleanupOldStorageKeys();

/**
 * Loads dump inspirations from storage or returns empty array.
 */
export async function getDumpInspirations(): Promise<InspirationItem[]> {
  try {
    const raw = await AsyncStorage.getItem(DUMP_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to read dump inspirations from local storage:', e);
  }

  return [];
}

/**
 * Persists dump inspirations to local storage.
 */
export async function setDumpInspirations(items: InspirationItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(DUMP_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn('Failed to save dump inspirations to storage:', e);
  }
}

/**
 * Resets the inspiration dump to empty.
 */
export async function resetDumpToInitial(): Promise<InspirationItem[]> {
  await setDumpInspirations([]);
  return [];
}

/**
 * Quick-dump a raw link or text note into the inspiration bank.
 */
export async function quickDumpLinkOrNote(
  rawInput: string,
  userNote?: string,
  tags: string[] = []
): Promise<InspirationItem> {
  const trimmed = rawInput.trim();
  const normalized = normalizeUrl(trimmed);
  const platform = normalized ? detectPlatform(normalized) : 'other';
  const domain = normalized ? extractDomain(normalized) : null;
  const hash = generateContentHash(normalized || trimmed);

  let fallbackTitle = domain ? `Saved from ${domain}` : trimmed.slice(0, 60);
  if (platform === 'pinterest') {
    fallbackTitle = domain ? `Pinterest Inspiration (${domain})` : 'Pinterest Pin Reference';
  } else if (platform === 'instagram') {
    fallbackTitle = domain ? `Instagram Visual (${domain})` : 'Instagram Reel / Post';
  } else if (platform === 'tiktok') {
    fallbackTitle = 'TikTok Motion Clip';
  }

  // Auto-detect tags based on platform and URL
  const autoTags = [...tags];
  if (platform && platform !== 'other' && !autoTags.includes(platform)) {
    autoTags.push(platform);
  }

  const newItem: InspirationItem = {
    id: `dump-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    ownerUid: 'test',
    kind: normalized ? 'link' : 'note',
    folder: 'dump',
    title: fallbackTitle,
    url: normalized ? trimmed : null,
    normalizedUrl: normalized,
    sharedText: normalized ? null : trimmed,
    userNote: userNote?.trim() || null,
    sourcePlatform: platform,
    sourceDomain: domain,
    sourceApp: platform !== 'other' ? platform.toUpperCase() : 'Web',
    previewDescription: normalized ? `Dumped link from ${domain || platform}` : trimmed,
    remotePreviewImageUrl: null,
    tags: autoTags,
    aiTags: [platform, 'saved-inspiration'],
    concepts: [platform, 'reference'],
    aiSummary: userNote || `Saved reference link from ${platform}. Added to inspiration dump.`,
    processingStatus: 'ready',
    processingErrorCode: null,
    duplicateOf: hash,
    archived: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    capturedAt: Date.now(),
  };

  const current = await getDumpInspirations();
  const updated = [newItem, ...current];
  await setDumpInspirations(updated);
  return newItem;
}

/**
 * Sorts inspirations according to chosen criteria.
 */
export function sortDumpItems(items: InspirationItem[], criteria: DumpSortOption): InspirationItem[] {
  const cloned = [...items];
  switch (criteria) {
    case 'newest':
      return cloned.sort((a, b) => b.createdAt - a.createdAt);
    case 'oldest':
      return cloned.sort((a, b) => a.createdAt - b.createdAt);
    case 'title-asc':
      return cloned.sort((a, b) => a.title.localeCompare(b.title));
    case 'title-desc':
      return cloned.sort((a, b) => b.title.localeCompare(a.title));
    case 'platform':
      return cloned.sort((a, b) => (a.sourcePlatform || 'zzz').localeCompare(b.sourcePlatform || 'zzz'));
    case 'tags':
      return cloned.sort((a, b) => ((b.tags?.length || 0) + (b.aiTags?.length || 0)) - ((a.tags?.length || 0) + (a.aiTags?.length || 0)));
    default:
      return cloned;
  }
}

/**
 * Projects / Ideas storage helpers.
 */
export async function getProjects(): Promise<Project[]> {
  try {
    const raw = await AsyncStorage.getItem(PROJECTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to read projects from storage:', e);
  }

  return [];
}

export async function saveProject(project: Project): Promise<void> {
  const current = await getProjects();
  const index = current.findIndex((p) => p.id === project.id);
  let updated: Project[];
  if (index >= 0) {
    updated = [...current];
    updated[index] = project;
  } else {
    updated = [project, ...current];
  }
  await AsyncStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(updated));
}

export async function deleteProjectLocal(projectId: string): Promise<void> {
  const current = await getProjects();
  const updated = current.filter((p) => p.id !== projectId);
  await AsyncStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(updated));
  await AsyncStorage.removeItem(`${LINKS_STORAGE_PREFIX}${projectId}`);
}

/**
 * Inspiration links attached to a project/idea.
 */
export async function getProjectLinks(projectId: string): Promise<ProjectInspirationLink[]> {
  try {
    const raw = await AsyncStorage.getItem(`${LINKS_STORAGE_PREFIX}${projectId}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to load project inspiration links:', e);
  }
  return [];
}

export async function attachInspirationToProject(
  projectId: string,
  inspirationId: string,
  linkedBy: 'user' | 'ai' = 'user',
  reason?: string | null,
  confidence?: number | null
): Promise<ProjectInspirationLink> {
  const current = await getProjectLinks(projectId);
  const existing = current.find((l) => l.inspirationId === inspirationId);
  if (existing) return existing;

  const newLink: ProjectInspirationLink = {
    id: `link-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    inspirationId,
    linkedBy,
    reason: reason || null,
    confidence: confidence !== undefined ? confidence : null,
    createdAt: Date.now(),
  };

  const updated = [newLink, ...current];
  await AsyncStorage.setItem(`${LINKS_STORAGE_PREFIX}${projectId}`, JSON.stringify(updated));
  return newLink;
}

export async function detachInspirationFromProject(
  projectId: string,
  inspirationId: string
): Promise<void> {
  const current = await getProjectLinks(projectId);
  const updated = current.filter((l) => l.inspirationId !== inspirationId);
  await AsyncStorage.setItem(`${LINKS_STORAGE_PREFIX}${projectId}`, JSON.stringify(updated));
}
