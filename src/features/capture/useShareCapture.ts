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
import { quickDumpLinkOrNote } from '../dump/dumpService';

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
      const kind = processed.normalizedUrl ? 'link' : 'note';
      const docRef = await addDoc(
        collection(db, 'users', user.uid, 'inspirations'),
        {
          ownerUid: user.uid,
          kind,
          folder: 'dump',
          title: (customTitle || processed.title).trim(),
          url: processed.rawUrl || null,
          normalizedUrl: processed.normalizedUrl || null,
          sharedText: processed.sharedText || null,
          userNote: userNote?.trim() || null,
          sourcePlatform: processed.platform,
          sourceDomain: processed.domain,
          sourceApp: processed.platform,
          previewDescription: null,
          remotePreviewImageUrl: null,
          tags: tags || [],
          aiTags: [],
          concepts: [],
          aiSummary: null,
          processingStatus: 'pending', // Trigger will process AI enrichment
          processingErrorCode: null,
          duplicateOf: processed.contentHash,
          archived: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          capturedAt: Date.now(),
        }
      );

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
