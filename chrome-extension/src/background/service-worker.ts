import { initializeApp, getApps, getApp } from 'firebase/app';
// firebase/auth/web-extension ensures compliance with Chrome Extension MV3 CSP
import {
  getAuth,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signOut,
  User,
} from 'firebase/auth/web-extension';
import { getFirestore, writeBatch, doc, setDoc } from 'firebase/firestore';
import { firebaseConfig } from '../config/firebase';
import { InspirationItem, ScrapedReelMetadata, UserSnapshot } from '../types/insight';

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

      case 'AUTH_LOGIN_GOOGLE': {
        try {
          // Acquire token using chrome.identity
          const tokenResult = await chrome.identity.getAuthToken({ interactive: true });
          const token = typeof tokenResult === 'string' ? tokenResult : tokenResult?.token;
          if (!token) {
            throw new Error('Google OAuth token was not returned.');
          }

          const credential = GoogleAuthProvider.credential(null, token);
          const cred = await signInWithCredential(auth, credential);
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
          console.error('[rut-extension] Google sign-in failed:', err);
          return { success: false, error: err.message || 'Google Sign-In failed.' };
        }
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

          const now = Date.now();
          const targetUid = user.uid;

          // Chunk into batches of 400 (well within Firestore 500-operation limit)
          const CHUNK_SIZE = 400;
          let committedCount = 0;

          for (let i = 0; i < items.length; i += CHUNK_SIZE) {
            const chunk = items.slice(i, i + CHUNK_SIZE);
            const batch = writeBatch(db);

            for (const item of chunk) {
              const docId = `ig_reel_${item.shortcode}`;
              const docRef = doc(db, 'users', targetUid, 'inspirations', docId);

              const rawCaption = item.caption || '';
              // Extract first line of caption for title (shortened to <= 100 chars)
              const firstLine = rawCaption.split('\n')[0]?.trim();
              const derivedTitle =
                firstLine && firstLine.length > 5
                  ? firstLine.slice(0, 100)
                  : `Instagram Reel (${item.shortcode})`;

              const collectionSlugTag = item.collection.slug
                ? item.collection.slug.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase()
                : '';
              const collectionNameTag = item.collection.name
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
                  'instagram',
                  'reel',
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
                sourcePlatform: 'instagram',
                sourceDomain: 'instagram.com',
                sourceApp: 'INSTAGRAM',
                siteName: 'Instagram',
                author: item.collection.name || 'Instagram',
                caption: rawCaption || null,
                previewDescription: rawCaption || null,
                remotePreviewImageUrl: item.thumbnailUrl || null,
                editorialContext: item.viewCountText
                  ? `Views: ${item.viewCountText} • Collection: ${item.collection.name}`
                  : `Collection: ${item.collection.name}`,
                tags,
                aiTags: ['instagram', 'reel'],
                concepts: [item.collection.name].filter(Boolean),
                aiSummary: rawCaption || null,
                // Setting 'pending' automatically triggers Cloud Function onInspirationWritten for embeddings & AI summary
                processingStatus: 'pending',
                processingErrorCode: null,
                duplicateOf: item.shortcode,
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

          const { platform, url, title, tags, collectionOrigin, userNote } = message.payload;
          if (!url || !url.trim()) {
            throw new Error('A valid URL is required.');
          }

          const cleanUrl = url.trim();
          const targetUid = user.uid;
          const now = Date.now();

          // Build clean tags including platform and collection origin tag
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
            (title || '').trim() ||
            (platform === 'pinterest' ? 'Pinterest Inspiration' : 'Instagram Inspiration');

          const domain = platform === 'pinterest' ? 'pinterest.com' : 'instagram.com';
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
            normalizedUrl: cleanUrl,
            sharedText: null,
            userNote: userNote?.trim() || null,
            sourcePlatform: platform,
            sourceDomain: domain,
            sourceApp: platform.toUpperCase(),
            siteName: platform === 'pinterest' ? 'Pinterest' : 'Instagram',
            author: collectionOrigin?.trim() || (platform === 'pinterest' ? 'Pinterest' : 'Instagram'),
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
