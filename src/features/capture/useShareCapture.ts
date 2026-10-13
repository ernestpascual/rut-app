import { useState } from 'react';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../lib/firebase/client';
import { useAuth } from '../auth/AuthContext';
import { extractUrlFromText, normalizeUrl, detectPlatform, extractDomain, generateContentHash } from '../../utils/url';
import { stagePendingShare } from './stagingStorage';
import { IncomingSharePayload, InspirationItem } from '../../types';
import { quickDumpLinkOrNote, getDumpInspirations, setDumpInspirations } from '../dump/dumpService';
import { enrichUrlMetadata } from '../../utils/urlMetadata';

export function useShareCapture() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processPayload = (payload: IncomingSharePayload) => {
    const rawText = (payload.text || '').trim();
    const rawUrl = (payload.url || '').trim();
    const rawTitle = (payload.title || '').trim();

    const extracted = rawUrl ? rawUrl : extractUrlFromText(rawText);
    const normalized = extracted ? normalizeUrl(extracted) : null;
    const platform = normalized ? detectPlatform(normalized) : null;
    const domain = normalized ? extractDomain(normalized) : null;

    // Build title fallback
    const title = rawTitle || (domain ? `Saved from ${domain}` : (rawText.slice(0, 50) || 'Untitled Note'));
    const hash = generateContentHash(normalized || rawText);

    return {
      title,
      rawUrl: extracted,
      normalizedUrl: normalized,
      sharedText: rawText || null,
      platform,
      domain,
      contentHash: hash,
      hasBinary: !!payload.hasBinaryAttachment,
    };
  };

  const checkForDuplicate = async (hash: string): Promise<InspirationItem | null> => {
    if (!user) return null;
    try {
      const q = query(
        collection(db, 'users', user.uid, 'inspirations'),
        where('duplicateOf', '==', hash)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        return { id: snap.docs[0].id, ...snap.docs[0].data() } as InspirationItem;
      }
    } catch {
      // Index might be required or fallback
    }
    return null;
  };

  const saveShare = async (
    payload: IncomingSharePayload,
    customTitle?: string,
    userNote?: string,
    tags: string[] = []
  ) => {
    setLoading(true);
    setError(null);

    const processed = processPayload(payload);

    if (processed.hasBinary && !processed.normalizedUrl && !processed.sharedText) {
      setLoading(false);
      throw new Error(
        'File capture (images/videos) is not supported in this version. You can save text notes and links.'
      );
    }

    if (!user) {
      const newItem = await quickDumpLinkOrNote(
        processed.rawUrl || processed.sharedText || '',
        userNote,
        tags
      );
      setLoading(false);
      return { id: newItem.id, staged: false };
    }

    try {
      let meta: any = null;
      if (processed.rawUrl || processed.normalizedUrl) {
        meta = await enrichUrlMetadata(
          processed.rawUrl || processed.normalizedUrl || '',
          customTitle,
          userNote
        );
      }

      const platform = meta?.platform || processed.platform || 'other';
      const domain = meta?.domain || processed.domain || null;
      const siteName = meta?.siteName || (domain ? domain.charAt(0).toUpperCase() + domain.slice(1) : null);
      const rawFinalTitle = (customTitle || meta?.title || processed.title).trim();
      const finalTitle = rawFinalTitle.length > 300 ? rawFinalTitle.slice(0, 100).trim() : rawFinalTitle;
      const combinedTags = Array.from(new Set([...tags, ...(meta?.autoTags || [])]));
      const concepts = meta?.concepts || combinedTags.slice(0, 4);
      const editorialContext = meta?.editorialContext || (userNote?.trim() ? `💡 Note: ${userNote.trim()}` : null);
      const previewDesc = meta?.description || processed.sharedText || finalTitle;
      const previewImg = meta?.previewImageUrl || null;
      const kind = processed.normalizedUrl ? 'link' : 'note';

      const newItemData: Omit<InspirationItem, 'id'> = {
        ownerUid: user.uid,
        kind,
        folder: 'dump',
        title: finalTitle,
        url: processed.rawUrl || null,
        normalizedUrl: processed.normalizedUrl || null,
        sharedText: processed.sharedText || null,
        userNote: userNote?.trim() || null,
        sourcePlatform: platform,
        sourceDomain: domain,
        sourceApp: siteName || (platform !== 'other' ? platform.toUpperCase() : 'Web'),
        siteName,
        previewDescription: previewDesc,
        remotePreviewImageUrl: previewImg,
        editorialContext,
        tags: combinedTags,
        aiTags: meta?.autoTags && meta.autoTags.length > 0 ? meta.autoTags : (platform !== 'other' ? [platform] : []),
        concepts,
        aiSummary: editorialContext || userNote?.trim() || null,
        processingStatus: 'ready',
        processingErrorCode: null,
        duplicateOf: processed.contentHash,
        archived: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        capturedAt: Date.now(),
      };

      const docRef = await addDoc(
        collection(db, 'users', user.uid, 'inspirations'),
        newItemData
      );

      const localItem: InspirationItem = {
        id: docRef.id,
        ...newItemData,
      };
      const existing = await getDumpInspirations();
      await setDumpInspirations([localItem, ...existing]);

      setLoading(false);
      return { id: docRef.id, staged: false };
    } catch (err: any) {
      // Local fallback
      const newItem = await quickDumpLinkOrNote(
        processed.rawUrl || processed.sharedText || '',
        userNote,
        tags
      );
      setLoading(false);
      return { id: newItem.id, staged: false };
    }
  };

  return {
    processPayload,
    checkForDuplicate,
    saveShare,
    loading,
    error,
  };
}
