import { initializeApp, getApps, getApp } from 'firebase/app';
// firebase/auth/web-extension ensures compliance with Chrome Extension MV3 CSP
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
} from 'firebase/auth/web-extension';
import {
  getFirestore,
  writeBatch,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
} from 'firebase/firestore';
import { firebaseConfig } from '../config/firebase';
import { InspirationItem, ScrapedReelMetadata, SourcePlatform, UserSnapshot } from '../types/insight';

// 1. Initialize Firebase App & Services
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

// 2. Synchronous top-level Auth State Listener
onAuthStateChanged(auth, async (user: User | null) => {
  if (user) {
    const snapshot: UserSnapshot = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
    };
    await chrome.storage.local.set({ authUser: snapshot });
    console.log('[rut-extension] User authenticated:', user.email, user.uid);
  } else {
    await chrome.storage.local.remove('authUser');
    console.log('[rut-extension] User signed out');
  }
});

// Helper to ensure auth is rehydrated after cold service worker start
async function getAuthenticatedUser(): Promise<User | null> {
  if (typeof (auth as any).authStateReady === 'function') {
    await (auth as any).authStateReady();
  }
  return auth.currentUser;
}

// 3. Message Dispatcher
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const handleAsync = async () => {
    switch (message.type) {
      case 'AUTH_GET_STATE': {
        const user = await getAuthenticatedUser();
        if (user) {
          const snapshot: UserSnapshot = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
          };
          return { success: true, user: snapshot };
        }
        return { success: true, user: null };
      }

      case 'AUTH_LOGIN_EMAIL': {
        try {
          const { email, pass } = message;
          const cred = await signInWithEmailAndPassword(auth, email, pass);
          const user = cred.user;
          const snapshot: UserSnapshot = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
          };
          await chrome.storage.local.set({ authUser: snapshot });
          return { success: true, user: snapshot };
        } catch (err: any) {
          console.error('[rut-extension] Email sign-in failed:', err);
          return { success: false, error: err.message || 'Email Sign-In failed.' };
        }
      }

      case 'AUTH_LOGOUT': {
        try {
          await signOut(auth);
          await chrome.storage.local.remove('authUser');
          return { success: true };
        } catch (err: any) {
          return { success: false, error: err.message };
        }
      }

      case 'SYNC_ITEMS': {
        try {
          const user = await getAuthenticatedUser();
          if (!user) {
            throw new Error('You must be signed in to sync items to Insight Bank.');
          }

          const items: ScrapedReelMetadata[] = message.items || [];
          if (items.length === 0) {
            return { success: true, count: 0 };
          }

          const platform: 'instagram' | 'facebook' | 'pinterest' =
            message.platform ||
            (items[0]?.source === 'facebook_collection'
              ? 'facebook'
              : items[0]?.source === 'pinterest_collection'
              ? 'pinterest'
              : 'instagram');

          const now = Date.now();
          const targetUid = user.uid;

          // Chunk into batches of 400 (well within Firestore 500-operation limit)
          const CHUNK_SIZE = 400;
          let committedCount = 0;

          const siteName =
            platform === 'pinterest' ? 'Pinterest' : platform === 'facebook' ? 'Facebook' : 'Instagram';
          const domain =
            platform === 'pinterest' ? 'pinterest.com' : platform === 'facebook' ? 'facebook.com' : 'instagram.com';
          const prefix =
            platform === 'pinterest' ? 'pin' : platform === 'facebook' ? 'fb' : 'ig_reel';

          for (let i = 0; i < items.length; i += CHUNK_SIZE) {
            const chunk = items.slice(i, i + CHUNK_SIZE);
            const batch = writeBatch(db);

            for (const item of chunk) {
              const cleanCode = item.shortcode.replace(/[^a-zA-Z0-9_-]/g, '') || Math.random().toString(36).substring(2, 8);
              const docId = `${prefix}_${cleanCode}`;
              const docRef = doc(db, 'users', targetUid, 'inspirations', docId);

              const rawCaption = item.caption || '';
              const firstLine = rawCaption.split('\n')[0]?.trim();
              const derivedTitle =
                (item.title && item.title.trim()) ||
                (firstLine && firstLine.length > 5 ? firstLine.slice(0, 100) : `${siteName} Item (${cleanCode})`);

              const collectionSlugTag = item.collection?.slug
                ? item.collection.slug.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase()
                : '';
              const collectionNameTag = item.collection?.name
                ? item.collection.name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase()
                : '';
              const customTagsList = (message.customTags || []).map((t: string) =>
                t.trim().toLowerCase().replace(/^#/, '')
              );
              const extraOriginTag = message.collectionOrigin
                ? message.collectionOrigin.trim().toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '-')
                : '';

              const tags = Array.from(
                new Set([
                  platform,
                  collectionSlugTag,
                  collectionNameTag,
                  collectionNameTag ? `collection-${collectionNameTag}` : '',
                  extraOriginTag,
                  extraOriginTag ? `collection-${extraOriginTag}` : '',
                  ...customTagsList,
                ].filter(Boolean))
              );

              const inspirationData: InspirationItem = {
                id: docId,
                ownerUid: targetUid,
                kind: 'link',
                folder: 'dump',
                title: derivedTitle,
                url: item.url,
                normalizedUrl: item.url,
                sharedText: null,
                userNote: rawCaption ? `Caption: ${rawCaption}` : null,
                sourcePlatform: platform,
                sourceDomain: domain,
                sourceApp: platform.toUpperCase(),
                siteName,
                author: item.collection?.name || siteName,
                caption: rawCaption || null,
                previewDescription: rawCaption || null,
                remotePreviewImageUrl: item.thumbnailUrl || null,
                editorialContext: item.viewCountText
                  ? `Views: ${item.viewCountText} • Collection: ${item.collection?.name || siteName}`
                  : item.collection?.name
                  ? `Collection: ${item.collection.name}`
                  : null,
                tags,
                aiTags: [platform],
                concepts: [item.collection?.name].filter(Boolean),
                aiSummary: rawCaption || null,
                processingStatus: 'pending',
                processingErrorCode: null,
                duplicateOf: cleanCode,
                archived: false,
                createdAt: now,
                updatedAt: now,
                capturedAt: now,
              };

              batch.set(docRef, inspirationData, { merge: true });
            }

            await batch.commit();
            committedCount += chunk.length;
          }

          return { success: true, count: committedCount };
        } catch (err: any) {
          console.error('[rut-extension] Batch sync failed:', err);
          return { success: false, error: err.message || 'Sync to Firestore failed.' };
        }
      }

      case 'DUMP_URL_ITEM': {
        try {
          const user = await getAuthenticatedUser();
          if (!user) {
            throw new Error('You must be signed in to dump items to Insight Bank.');
          }

          const { platform: payloadPlatform, url, title, tags, collectionOrigin, userNote } = message.payload;
          if (!url || !url.trim()) {
            throw new Error('A valid URL is required.');
          }

          const cleanUrl = url.trim();
          const targetUid = user.uid;
          const now = Date.now();

          // Auto-detect platform from URL if not specified
          const detectPlatformFromUrl = (rawUrl: string): SourcePlatform => {
            const lower = rawUrl.toLowerCase();
            if (lower.includes('instagram.com') || lower.includes('instagr.am')) return 'instagram';
            if (lower.includes('pinterest.com') || lower.includes('pin.it')) return 'pinterest';
            if (lower.includes('facebook.com') || lower.includes('fb.com') || lower.includes('fb.watch')) return 'facebook';
            if (lower.includes('tiktok.com')) return 'tiktok';
            if (lower.includes('twitter.com') || lower.includes('x.com') || lower.includes('t.co')) return 'x';
            if (lower.includes('threads.net') || lower.includes('threads.com')) return 'threads';
            if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
            if (lower.includes('behance.net')) return 'behance';
            if (lower.includes('dribbble.com')) return 'dribbble';
            if (lower.includes('are.na')) return 'arena';
            if (lower.includes('github.com')) return 'github';
            if (lower.includes('vimeo.com')) return 'vimeo';
            if (lower.includes('medium.com')) return 'medium';
            if (lower.includes('substack.com')) return 'substack';
            return 'web';
          };

          const platform: SourcePlatform = payloadPlatform || detectPlatformFromUrl(cleanUrl);

          let domain = 'web';
          try {
            domain = new URL(cleanUrl).hostname.replace(/^www\./, '');
          } catch {}

          const siteName =
            platform === 'pinterest'
              ? 'Pinterest'
              : platform === 'instagram'
              ? 'Instagram'
              : platform === 'facebook'
              ? 'Facebook'
              : domain;

          // Build clean tags including platform and optional origin tag
          const cleanTags = (tags || []).map((t: string) =>
            t.trim().toLowerCase().replace(/^#/, '')
          );

          const originTag = collectionOrigin
            ? collectionOrigin.trim().toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '-')
            : '';

          const mergedTags = Array.from(
            new Set([
              platform,
              originTag,
              originTag ? `collection-${originTag}` : '',
              ...cleanTags,
            ].filter(Boolean))
          );

          const derivedTitle =
            (title || '').trim() || `${siteName} Link`;

          // Helper to normalize URL and strip tracking parameters
          const TRACKING_PARAMS = [
            'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
            'fbclid', 'gclid', 'igshid', 'igsh', 'ig_mid', 'img_index',
            '_hsenc', '_hsmi', 'mc_cid', 'mc_eid', 'si', 'feature'
          ];
          const normalizeUrl = (rawUrl: string): string => {
            try {
              const u = new URL(rawUrl.trim());
              u.hostname = u.hostname.toLowerCase();
              for (const p of TRACKING_PARAMS) {
                u.searchParams.delete(p);
              }
              let norm = u.toString();
              if (norm.endsWith('/') && u.pathname === '/') {
                norm = norm.slice(0, -1);
              }
              return norm;
            } catch {
              return rawUrl.trim();
            }
          };

          const normalizedUrl = normalizeUrl(cleanUrl);

          // Check if link already exists in user's dump to prevent duplicates
          const inspirationsRef = collection(db, 'users', targetUid, 'inspirations');
          let existingDoc: { id: string; title?: string } | null = null;

          // 1. Query by normalizedUrl
          if (normalizedUrl) {
            try {
              const qNorm = query(inspirationsRef, where('normalizedUrl', '==', normalizedUrl), limit(1));
              const snapNorm = await getDocs(qNorm);
              if (!snapNorm.empty) {
                const d = snapNorm.docs[0];
                existingDoc = { id: d.id, title: d.data()?.title };
              }
            } catch (e) {
              console.warn('[rut-extension] Error querying normalizedUrl:', e);
            }
          }

          // 2. Query by raw url if not matched
          if (!existingDoc && cleanUrl && cleanUrl !== normalizedUrl) {
            try {
              const qRaw = query(inspirationsRef, where('url', '==', cleanUrl), limit(1));
              const snapRaw = await getDocs(qRaw);
              if (!snapRaw.empty) {
                const d = snapRaw.docs[0];
                existingDoc = { id: d.id, title: d.data()?.title };
              }
            } catch (e) {
              console.warn('[rut-extension] Error querying raw url:', e);
            }
          }

          // 3. Query deterministic ID for Instagram / Pinterest / Facebook
          if (!existingDoc) {
            try {
              const igMatch = cleanUrl.match(/\/(?:reel|p)\/([a-zA-Z0-9_-]+)/);
              if (igMatch) {
                const directSnap = await getDoc(doc(db, 'users', targetUid, 'inspirations', `ig_reel_${igMatch[1]}`));
                if (directSnap.exists()) {
                  existingDoc = { id: directSnap.id, title: directSnap.data()?.title };
                }
              }
              if (!existingDoc) {
                const pinMatch = cleanUrl.match(/\/pin\/([0-9a-zA-Z_-]+)/);
                if (pinMatch) {
                  const directSnap = await getDoc(doc(db, 'users', targetUid, 'inspirations', `pin_${pinMatch[1]}`));
                  if (directSnap.exists()) {
                    existingDoc = { id: directSnap.id, title: directSnap.data()?.title };
                  }
                }
              }
            } catch (e) {
              console.warn('[rut-extension] Error checking deterministic IDs:', e);
            }
          }

          // If link already exists, return early without creating a duplicate
          if (existingDoc) {
            console.log('[rut-extension] Link already in dump, skipping duplicate:', existingDoc.id);
            return {
              success: true,
              alreadyExists: true,
              id: existingDoc.id,
              title: existingDoc.title || derivedTitle,
            };
          }

          const randomId = Math.random().toString(36).substring(2, 8);
          const docId = `ext_${platform}_${Date.now()}_${randomId}`;
          const docRef = doc(db, 'users', targetUid, 'inspirations', docId);

          const inspirationData: InspirationItem = {
            id: docId,
            ownerUid: targetUid,
            kind: 'link',
            folder: 'dump',
            title: derivedTitle,
            url: cleanUrl,
            normalizedUrl: normalizedUrl || cleanUrl,
            sharedText: null,
            userNote: userNote?.trim() || null,
            sourcePlatform: platform,
            sourceDomain: domain,
            sourceApp: platform.toUpperCase(),
            siteName,
            author: collectionOrigin?.trim() || siteName,
            caption: userNote?.trim() || null,
            previewDescription: collectionOrigin ? `Saved from collection: ${collectionOrigin}` : null,
            remotePreviewImageUrl: null,
            editorialContext: collectionOrigin ? `Collection Origin: ${collectionOrigin}` : null,
            tags: mergedTags,
            aiTags: [platform],
            concepts: collectionOrigin ? [collectionOrigin] : [],
            aiSummary: null,
            processingStatus: 'pending',
            processingErrorCode: null,
            duplicateOf: null,
            archived: false,
            createdAt: now,
            updatedAt: now,
            capturedAt: now,
          };

          await setDoc(docRef, inspirationData);
          return { success: true, id: docId, title: derivedTitle };
        } catch (err: any) {
          console.error('[rut-extension] Dump URL item failed:', err);
          return { success: false, error: err.message || 'Failed to dump item to Insight Bank.' };
        }
      }

      default:
        return { success: false, error: 'Unknown message type.' };
    }
  };

  handleAsync().then(sendResponse);
  return true; // Keep channel open for asynchronous response
});

// 4. External Session Handoff Listener (from rut web app)
chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
  if (message.type === 'AUTH_WEB_HANDOFF' && message.user) {
    chrome.storage.local.set({ authUser: message.user }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});
