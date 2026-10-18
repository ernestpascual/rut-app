import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  getDocs,
  setDoc,
  doc,
  addDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  limit,
} from 'firebase/firestore';
import { db, auth } from '../../lib/firebase/client';
import { InspirationItem, Project, ProjectInspirationLink, SourcePlatform } from '../../types';
import { detectPlatform, extractDomain, generateContentHash, normalizeUrl } from '../../utils/url';
import { enrichUrlMetadata, extractUrlMetadataFromUrl, formatNotesWithCaption } from '../../utils/urlMetadata';

export function getTargetUid(uid?: string): string {
  return uid || auth?.currentUser?.uid || 'test';
}

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

export function enrichInspirationItem(item: InspirationItem): InspirationItem {
  const normalizedTitle = item.title && item.title.length > 300 ? item.title.slice(0, 100).trim() : item.title;
  if (!item.url) return { ...item, title: normalizedTitle };
  const meta = extractUrlMetadataFromUrl(item.url, item.sharedText || item.userNote || undefined);
  const combinedTags = Array.from(new Set([...(item.tags || []), ...meta.autoTags]));
  const deduplicatedAiTags = Array.from(new Set(item.aiTags && item.aiTags.length > 0 ? item.aiTags : meta.autoTags));
  const deduplicatedConcepts = Array.from(new Set(item.concepts && item.concepts.length > 0 ? item.concepts : meta.concepts));
  return {
    ...item,
    title: normalizedTitle,
    author: item.author || meta.author || null,
    caption: item.caption || meta.caption || null,
    siteName: item.siteName || meta.siteName,
    sourcePlatform: item.sourcePlatform || meta.platform,
    sourceDomain: item.sourceDomain || meta.domain,
    remotePreviewImageUrl: item.remotePreviewImageUrl || meta.previewImageUrl || null,
    userNote: item.userNote || (meta.author || meta.caption ? formatNotesWithCaption(meta.author, meta.caption) : null),
    tags: combinedTags,
    aiTags: deduplicatedAiTags,
    concepts: deduplicatedConcepts,
    editorialContext: item.editorialContext || meta.editorialContext,
    previewDescription: item.previewDescription || meta.caption || meta.description,
  };
}

/**
 * Loads dump inspirations from Firebase Firestore, ensuring auto-enrichment on any missing metadata.
 */
export async function getDumpInspirations(uid?: string): Promise<InspirationItem[]> {
  const targetUid = getTargetUid(uid);
  try {
    const q = query(
      collection(db, 'users', targetUid, 'inspirations'),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    const items: InspirationItem[] = [];
    snap.forEach((d) => {
      items.push(enrichInspirationItem({ ...(d.data() as any), id: d.id }));
    });
    AsyncStorage.setItem(DUMP_STORAGE_KEY, JSON.stringify(items)).catch(() => {});
    return items;
  } catch (e) {
    // Graceful fallback to local cache ONLY if network/Firestore fails
  }

  try {
    const raw = await AsyncStorage.getItem(DUMP_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(enrichInspirationItem);
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
 * Permanently deletes an inspiration item from Firestore (if user signed in) and local storage.
 */
export async function deleteInspiration(itemId: string, uid?: string): Promise<void> {
  const targetUid = getTargetUid(uid);
  try {
    if (db && targetUid) {
      await deleteDoc(doc(db, 'users', targetUid, 'inspirations', itemId));

      // Also handle cases where legacy items had mismatched internal id fields
      const q = query(
        collection(db, 'users', targetUid, 'inspirations'),
        where('id', '==', itemId),
        limit(1)
      );
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        if (d.id !== itemId) {
          await deleteDoc(d.ref);
        }
      }
    }
  } catch (err) {
    console.warn('[dumpService] deleteInspiration Firestore fallback:', err);
  }

  try {
    const current = await getDumpInspirations(targetUid);
    const updated = current.filter((i) => i.id !== itemId);
    await setDumpInspirations(updated);
  } catch (err) {
    console.warn('[dumpService] deleteInspiration local storage fallback:', err);
  }
}

/**
 * Quick-dump a raw link or text note into the inspiration bank via Firebase Firestore.
 */
export async function quickDumpLinkOrNote(
  rawInput: string,
  userNote?: string,
  tags: string[] = [],
  uid?: string
): Promise<InspirationItem> {
  const targetUid = getTargetUid(uid);
  const trimmed = rawInput.trim();
  const normalized = normalizeUrl(trimmed);
  const hash = generateContentHash(normalized || trimmed);

  // If the link is already in the dump, do not duplicate
  if (normalized) {
    try {
      const q = query(
        collection(db, 'users', targetUid, 'inspirations'),
        where('normalizedUrl', '==', normalized),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const existing = snap.docs[0];
        return enrichInspirationItem({ id: existing.id, ...(existing.data() as any) });
      }
    } catch (err) {
      console.warn('[dumpService] Duplicate check fallback:', err);
    }

    const current = await getDumpInspirations(targetUid);
    const existingLocal = current.find(
      (i) => i.normalizedUrl === normalized || (i.url && normalizeUrl(i.url) === normalized)
    );
    if (existingLocal) {
      return existingLocal;
    }
  }

  let meta;
  if (normalized) {
    meta = await enrichUrlMetadata(normalized, undefined, userNote).catch(() => undefined);
  }

  const combinedTags = Array.from(new Set([...tags, ...(meta?.autoTags || [])]));
  const platform = meta?.platform || (normalized ? detectPlatform(normalized) : 'other');
  const domain = meta?.domain || (normalized ? extractDomain(normalized) : null);
  const rawTitle = meta?.title || (domain ? `Saved from ${domain}` : trimmed.slice(0, 60));
  const title = rawTitle.length > 300 ? rawTitle.slice(0, 100).trim() : rawTitle;

  const docRef = db && targetUid ? doc(collection(db, 'users', targetUid, 'inspirations')) : null;
  const docId = docRef ? docRef.id : `dump-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const newItem: InspirationItem = {
    id: docId,
    ownerUid: targetUid,
    kind: normalized ? 'link' : 'note',
    folder: 'dump',
    title,
    url: normalized ? trimmed : null,
    normalizedUrl: normalized,
    sharedText: normalized ? null : trimmed,
    author: meta?.author || null,
    userNote: userNote?.trim() || (meta?.author || meta?.caption ? formatNotesWithCaption(meta.author, meta.caption) : null),
    sourcePlatform: platform,
    sourceDomain: domain,
    sourceApp: meta?.siteName || (platform !== 'other' ? platform.toUpperCase() : 'Web'),
    siteName: meta?.siteName || null,
    previewDescription: meta?.caption || meta?.description || trimmed,
    remotePreviewImageUrl: meta?.previewImageUrl || null,
    editorialContext: meta?.editorialContext || null,
    tags: combinedTags,
    aiTags: meta?.autoTags && meta.autoTags.length > 0 ? meta.autoTags : (platform !== 'other' ? [platform] : []),
    concepts: meta?.concepts || [],
    aiSummary: meta?.editorialContext || userNote?.trim() || null,
    processingStatus: 'ready',
    processingErrorCode: null,
    duplicateOf: hash,
    archived: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    capturedAt: Date.now(),
  };

  try {
    if (docRef) {
      await setDoc(docRef, newItem);
    }
  } catch (err) {
    console.warn('[dumpService] Firestore write fallback:', err);
  }

  const current = await getDumpInspirations(targetUid);
  const updated = [newItem, ...current.filter((i) => i.id !== newItem.id)];
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
 * Projects / Ideas storage helpers using Firebase Firestore.
 */
export async function getProjects(uid?: string): Promise<Project[]> {
  const targetUid = getTargetUid(uid);
  try {
    const q = query(
      collection(db, 'users', targetUid, 'projects'),
      orderBy('updatedAt', 'desc')
    );
    const snap = await getDocs(q);
    const projects: Project[] = [];
    snap.forEach((d) => {
      projects.push({ id: d.id, ...(d.data() as any) });
    });
    AsyncStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects)).catch(() => {});
    return projects;
  } catch (e) {
    // Fallback to local cache ONLY if Firestore fails
  }

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

export async function saveProject(project: Project, uid?: string): Promise<void> {
  const targetUid = getTargetUid(uid);
  try {
    await setDoc(doc(db, 'users', targetUid, 'projects', project.id), project, { merge: true });
  } catch (err) {
    console.warn('[dumpService] saveProject Firestore fallback:', err);
  }

  const current = await getProjects(targetUid);
  const index = current.findIndex((p) => p.id === project.id);
  let updated: Project[];
  if (index >= 0) {
    updated = [...current];
    updated[index] = project;
  } else {
    updated = [project, ...current];
  }
  await AsyncStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
}

export async function deleteProjectLocal(projectId: string, uid?: string): Promise<void> {
  const targetUid = getTargetUid(uid);
  try {
    await deleteDoc(doc(db, 'users', targetUid, 'projects', projectId));
  } catch (err) {
    console.warn('[dumpService] deleteProject Firestore fallback:', err);
  }

  const current = await getProjects(targetUid);
  const updated = current.filter((p) => p.id !== projectId);
  await AsyncStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
  await AsyncStorage.removeItem(`${LINKS_STORAGE_PREFIX}${projectId}`).catch(() => {});
}

/**
 * Inspiration links attached to a project/idea via Firebase Firestore.
 */
export async function getProjectLinks(projectId: string, uid?: string): Promise<ProjectInspirationLink[]> {
  const targetUid = getTargetUid(uid);
  try {
    const snap = await getDocs(
      collection(db, 'users', targetUid, 'projects', projectId, 'inspirationLinks')
    );
    const seen = new Set<string>();
    const links: ProjectInspirationLink[] = [];
    snap.forEach((d) => {
      const data = { id: d.id, ...(d.data() as any) } as ProjectInspirationLink;
      const inspId = data.inspirationId || d.id;
      if (!seen.has(inspId)) {
        seen.add(inspId);
        links.push({ ...data, id: inspId, inspirationId: inspId });
      }
    });
    AsyncStorage.setItem(`${LINKS_STORAGE_PREFIX}${projectId}`, JSON.stringify(links)).catch(() => {});
    return links;
  } catch (err) {
    // Fallback ONLY if Firestore call fails
  }

  try {
    const raw = await AsyncStorage.getItem(`${LINKS_STORAGE_PREFIX}${projectId}`);
    if (raw) {
      const parsed: ProjectInspirationLink[] = JSON.parse(raw);
      const seen = new Set<string>();
      return parsed.filter((l) => {
        const inspId = l.inspirationId || l.id;
        if (seen.has(inspId)) return false;
        seen.add(inspId);
        return true;
      });
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
  confidence?: number | null,
  uid?: string
): Promise<ProjectInspirationLink> {
  const targetUid = getTargetUid(uid);
  const newLink: ProjectInspirationLink = {
    id: inspirationId,
    inspirationId,
    linkedBy,
    reason: reason || null,
    confidence: confidence !== undefined ? confidence : null,
    createdAt: Date.now(),
  };

  try {
    // 1. Set document with deterministic inspirationId as ID to guarantee idempotency
    await setDoc(
      doc(db, 'users', targetUid, 'projects', projectId, 'inspirationLinks', inspirationId),
      newLink,
      { merge: true }
    );

    // 2. Cleanup any legacy docs that had random doc IDs for this inspirationId
    const snap = await getDocs(
      query(
        collection(db, 'users', targetUid, 'projects', projectId, 'inspirationLinks'),
        where('inspirationId', '==', inspirationId)
      )
    );
    for (const d of snap.docs) {
      if (d.id !== inspirationId) {
        await deleteDoc(d.ref).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('[dumpService] attachInspiration Firestore fallback:', err);
  }

  const current = await getProjectLinks(projectId, targetUid);
  const updated = [newLink, ...current.filter((l) => (l.inspirationId || l.id) !== inspirationId)];
  await AsyncStorage.setItem(`${LINKS_STORAGE_PREFIX}${projectId}`, JSON.stringify(updated)).catch(() => {});
  return newLink;
}

export async function detachInspirationFromProject(
  projectId: string,
  inspirationId: string,
  uid?: string
): Promise<void> {
  const targetUid = getTargetUid(uid);
  try {
    // Delete deterministic doc
    await deleteDoc(
      doc(db, 'users', targetUid, 'projects', projectId, 'inspirationLinks', inspirationId)
    ).catch(() => {});

    // Delete any legacy doc matching this inspirationId
    const snap = await getDocs(
      query(
        collection(db, 'users', targetUid, 'projects', projectId, 'inspirationLinks'),
        where('inspirationId', '==', inspirationId)
      )
    );
    for (const d of snap.docs) {
      await deleteDoc(d.ref).catch(() => {});
    }
  } catch (err) {
    console.warn('[dumpService] detachInspiration Firestore fallback:', err);
  }

  const current = await getProjectLinks(projectId, targetUid);
  const updated = current.filter((l) => (l.inspirationId || l.id) !== inspirationId);
  await AsyncStorage.setItem(`${LINKS_STORAGE_PREFIX}${projectId}`, JSON.stringify(updated)).catch(() => {});
}
