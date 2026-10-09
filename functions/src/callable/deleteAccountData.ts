import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from '../config';

export const deleteAccountData = onCall(async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const uid = request.auth.uid;

  try {
    const userRef = db.collection('users').doc(uid);

    // 1. Delete all inspirations
    const inspirations = await userRef.collection('inspirations').get();
    for (const doc of inspirations.docs) {
      await doc.ref.delete();
    }

    // 2. Delete all chats and their messages
    const chats = await userRef.collection('chats').get();
    for (const chatDoc of chats.docs) {
      const messages = await chatDoc.ref.collection('messages').get();
      for (const msg of messages.docs) {
        await msg.ref.delete();
      }
      await chatDoc.ref.delete();
    }

    // 3. Delete all projects and their inspirationLinks
    const projects = await userRef.collection('projects').get();
    for (const projDoc of projects.docs) {
      const links = await projDoc.ref.collection('inspirationLinks').get();
      for (const link of links.docs) {
        await link.ref.delete();
      }
      await projDoc.ref.delete();
    }

    // 4. Delete usage events and summaries
    const events = await userRef.collection('usageEvents').get();
    for (const ev of events.docs) {
      await ev.ref.delete();
    }
    const summaries = await userRef.collection('usageSummaries').get();
    for (const sum of summaries.docs) {
      await sum.ref.delete();
    }

    // 5. Delete server-only index records
    const indexRecords = await db
      .collection('_aiInspirationIndex')
      .where('ownerUid', '==', uid)
      .get();
    for (const idx of indexRecords.docs) {
      await idx.ref.delete();
    }

    // 6. Delete user document
    await userRef.delete();

    console.log(`[Account Deletion] Successfully deleted all Firestore data for ${uid}`);
    return { success: true };
  } catch (err: any) {
    console.error(`[Account Deletion] Error for user ${uid}:`, err);
    throw new HttpsError('internal', err.message || 'Failed to delete account data.');
  }
});
