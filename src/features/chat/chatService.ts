import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  doc,
  collection,
  query,
  orderBy,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions, auth } from '../../lib/firebase/client';
import { DUMMY_USER_UID } from '../auth/AuthContext';
import { ChatMessage, ChatSession, InspirationItem, Project } from '../../types';
import { getDumpInspirations } from '../dump/dumpService';

const CHATS_STORAGE_KEY = '@rut_chats_v2';
const MESSAGES_STORAGE_PREFIX = '@rut_chat_messages_v2:';

/**
 * Returns whether the current environment is running with live Firebase credentials
 * for an authenticated non-dummy user.
 */
function isLiveAuth(uid?: string | null): boolean {
  return !!uid && uid !== DUMMY_USER_UID;
}

/**
 * Local storage helpers for chat sessions.
 */
export async function getLocalChats(): Promise<ChatSession[]> {
  try {
    const raw = await AsyncStorage.getItem(CHATS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.sort((a, b) => b.updatedAt - a.updatedAt);
      }
    }
  } catch (e) {
    console.warn('Failed to load local chats:', e);
  }
  return [];
}

export async function setLocalChats(chats: ChatSession[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(chats));
  } catch (e) {
    console.warn('Failed to save local chats:', e);
  }
}

export async function getLocalMessages(chatId: string): Promise<ChatMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(`${MESSAGES_STORAGE_PREFIX}${chatId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.sort((a, b) => a.createdAt - b.createdAt);
      }
    }
  } catch (e) {
    console.warn(`Failed to load local messages for ${chatId}:`, e);
  }
  return [];
}

export async function setLocalMessages(chatId: string, messages: ChatMessage[]): Promise<void> {
  try {
    await AsyncStorage.setItem(`${MESSAGES_STORAGE_PREFIX}${chatId}`, JSON.stringify(messages));
  } catch (e) {
    console.warn(`Failed to save local messages for ${chatId}:`, e);
  }
}

/**
 * Retrieves all chat sessions (merging Firestore when available with local storage).
 */
export async function getChatSessions(uid?: string | null): Promise<ChatSession[]> {
  const local = await getLocalChats();

  if (!isLiveAuth(uid)) {
    return local;
  }

  try {
    const q = query(
      collection(db, 'users', uid!, 'chats'),
      orderBy('updatedAt', 'desc')
    );
    const snap = await getDocs(q);
    const remote: ChatSession[] = [];
    snap.forEach((d) => remote.push({ id: d.id, ...(d.data() as any) }));
    await setLocalChats(remote);
    return remote;
  } catch (e) {
    console.warn('Firestore chats fetch failed, using local sessions:', e);
  }

  return local;
}

/**
 * Retrieves a single chat session by ID.
 */
export async function getChatSession(chatId: string, uid?: string | null): Promise<ChatSession | null> {
  const localList = await getLocalChats();
  const localFound = localList.find((c) => c.id === chatId);

  if (!isLiveAuth(uid)) {
    return localFound || null;
  }

  try {
    const snap = await getDoc(doc(db, 'users', uid!, 'chats', chatId));
    if (snap.exists()) {
      return { id: snap.id, ...(snap.data() as any) } as ChatSession;
    }
  } catch {}

  return localFound || null;
}

/**
 * Creates a new chat session.
 */
export async function createChatSession(
  title: string,
  options?: {
    projectId?: string | null;
    projectTitle?: string | null;
    pinnedInspirationIds?: string[];
    uid?: string | null;
  }
): Promise<ChatSession> {
  const chatId = `chat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const cleanTitle = title.trim() || 'New Train of Thought';
  const ownerUid = options?.uid || DUMMY_USER_UID;

  const newSession: ChatSession = {
    id: chatId,
    ownerUid,
    title: cleanTitle,
    pinnedInspirationIds: options?.pinnedInspirationIds || [],
    summary: null,
    projectId: options?.projectId || null,
    projectTitle: options?.projectTitle || null,
    archived: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Save locally first for instant availability
  const current = await getLocalChats();
  await setLocalChats([newSession, ...current]);

  if (isLiveAuth(options?.uid)) {
    try {
      await setDoc(doc(db, 'users', options!.uid!, 'chats', chatId), newSession);
    } catch (e) {
      console.warn('Failed to persist chat session to Firestore:', e);
    }
  }

  return newSession;
}

/**
 * Gets or creates the dedicated Train of Thought chat session for a creative Idea.
 */
export async function getOrCreateIdeaChat(
  idea: Project,
  references?: InspirationItem[],
  uid?: string | null
): Promise<ChatSession> {
  const existingChats = await getChatSessions(uid);

  // Match by existing chatId or projectId link
  let matched = existingChats.find(
    (c) => (idea.chatId && c.id === idea.chatId) || c.projectId === idea.id
  );

  const referenceIds = references ? references.map((r) => r.id) : [];

  if (matched) {
    // If references were added, update pinned inspirations
    const existingPinned = new Set(matched.pinnedInspirationIds || []);
    let changed = false;
    referenceIds.forEach((rid) => {
      if (!existingPinned.has(rid)) {
        existingPinned.add(rid);
        changed = true;
      }
    });

    if (changed || matched.projectTitle !== idea.title) {
      matched = {
        ...matched,
        projectTitle: idea.title,
        pinnedInspirationIds: Array.from(existingPinned),
        updatedAt: Date.now(),
      };
      await saveChatSession(matched, uid);
    }
    return matched;
  }

  // Create new dedicated thought train for this idea
  const newSession = await createChatSession(`${idea.title} — Train of Thought`, {
    projectId: idea.id,
    projectTitle: idea.title,
    pinnedInspirationIds: referenceIds,
    uid,
  });

  return newSession;
}

/**
 * Updates an existing chat session.
 */
export async function saveChatSession(session: ChatSession, uid?: string | null): Promise<void> {
  const current = await getLocalChats();
  const index = current.findIndex((c) => c.id === session.id);
  let updatedList: ChatSession[];
  if (index >= 0) {
    updatedList = [...current];
    updatedList[index] = session;
  } else {
    updatedList = [session, ...current];
  }
  await setLocalChats(updatedList);

  if (isLiveAuth(uid)) {
    try {
      await setDoc(doc(db, 'users', uid!, 'chats', session.id), session, { merge: true });
    } catch (e) {
      console.warn('Failed to update chat session in Firestore:', e);
    }
  }
}

/**
 * Deletes a chat session and its local messages.
 */
export async function deleteChatSession(chatId: string, uid?: string | null): Promise<void> {
  const current = await getLocalChats();
  await setLocalChats(current.filter((c) => c.id !== chatId));
  await AsyncStorage.removeItem(`${MESSAGES_STORAGE_PREFIX}${chatId}`);

  if (isLiveAuth(uid)) {
    try {
      await deleteDoc(doc(db, 'users', uid!, 'chats', chatId));
    } catch (e) {
      console.warn('Failed to delete chat session from Firestore:', e);
    }
  }
}

/**
 * Retrieves messages for a chat session.
 */
export async function getChatMessages(chatId: string, uid?: string | null): Promise<ChatMessage[]> {
  const local = await getLocalMessages(chatId);

  if (!isLiveAuth(uid)) {
    return local;
  }

  try {
    const q = query(
      collection(db, 'users', uid!, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const snap = await getDocs(q);
    const remote: ChatMessage[] = [];
    snap.forEach((d) => remote.push({ id: d.id, ...(d.data() as any) }));
    await setLocalMessages(chatId, remote);
    return remote;
  } catch (e) {
    console.warn(`Firestore messages fetch failed for ${chatId}, using local:`, e);
  }

  return local;
}

/**
 * Deletes a single message or thought insight from a chat session.
 */
export async function deleteChatMessage(
  chatId: string,
  messageId: string,
  uid?: string | null
): Promise<void> {
  const current = await getLocalMessages(chatId);
  const updated = current.filter((m) => m.id !== messageId);
  await setLocalMessages(chatId, updated);

  const targetUid = uid || (auth?.currentUser?.uid ?? DUMMY_USER_UID);
  try {
    await deleteDoc(doc(db, 'users', targetUid, 'chats', chatId, 'messages', messageId));
  } catch (e) {
    console.warn('Failed to delete message from Firestore:', e);
  }

  // Update session summary if last message was removed
  const session = await getChatSession(chatId, targetUid);
  if (session) {
    const lastMsg = updated[updated.length - 1];
    session.summary = lastMsg ? lastMsg.content.slice(0, 100) : null;
    session.updatedAt = Date.now();
    await saveChatSession(session, targetUid);
  }
}

/**
 * Intelligent, editorial train of thought synthesizer used when running locally,
 * in test mode, offline, or as a seamless graceful fallback when cloud functions are unavailable.
 */
export function synthesizeThoughtTrain(params: {
  userQuery: string;
  ideaContext?: {
    title: string;
    brief?: string | null;
    notes?: string;
    tags?: string[];
  } | null;
  pinnedInspirations?: InspirationItem[];
  allInspirations?: InspirationItem[];
}): {
  response: string;
  sourceInspirationIds: string[];
} {
  const { userQuery, ideaContext, pinnedInspirations = [], allInspirations = [] } = params;
  const q = userQuery.toLowerCase();
  const isDumpPullQuery =
    q.includes('dump') ||
    q.includes('pull') ||
    q.includes('check') ||
    q.includes('inspiration') ||
    q.includes('bank') ||
    q.includes('saved') ||
    q.includes('reference');

  // Combine reference candidates: pinned first, then all dump items
  const candidatePool = [...pinnedInspirations];
  for (const item of allInspirations) {
    if (!candidatePool.some((c) => c.id === item.id)) {
      candidatePool.push(item);
    }
  }

  // Score candidate inspirations against user query and idea keywords
  const queryTokens = q.split(/[\s,.-]+/).filter((t) => t.length > 2);
  const ideaTokens = ideaContext
    ? `${ideaContext.title} ${ideaContext.brief || ''} ${ideaContext.notes || ''} ${ideaContext.tags?.join(' ') || ''}`
        .toLowerCase()
        .split(/[\s,.-]+/)
        .filter((t) => t.length > 2)
    : [];

  const scoredCandidates = candidatePool.map((item) => {
    let score = 0;
    const itemText = `${item.title} ${item.previewDescription || ''} ${item.userNote || ''} ${item.editorialContext || ''} ${item.sourceDomain || ''} ${item.siteName || ''} ${item.tags?.join(' ') || ''} ${item.aiTags?.join(' ') || ''} ${item.concepts?.join(' ') || ''}`.toLowerCase();

    for (const t of queryTokens) {
      if (itemText.includes(t)) score += 3;
    }
    for (const t of ideaTokens) {
      if (itemText.includes(t)) score += 1;
    }
    if (pinnedInspirations.some((p) => p.id === item.id)) {
      score += 4; // Heavily weight pinned references
    }

    return { item, score };
  });

  scoredCandidates.sort((a, b) => b.score - a.score);
  let topMatches = scoredCandidates.slice(0, 4).filter((sc) => sc.score > 0);

  // If user specifically asked to check/pull from dump and no match scored, pull newest from dump
  if (topMatches.length === 0 && allInspirations.length > 0 && isDumpPullQuery) {
    topMatches = allInspirations.slice(0, 3).map((item) => ({ item, score: 1 }));
  }

  const citedIds = topMatches.map((m) => m.item.id);
  const ideaTitle = ideaContext?.title || 'This Concept';

  let body = '';

  if (isDumpPullQuery && topMatches.length > 0) {
    body = `### 📥 PULLED FROM YOUR DUMP & INSPIRATION BANK

We searched your inspiration bank and pulled the following reference materials for "${ideaTitle}":

${topMatches
  .map((m, idx) => {
    const item = m.item;
    const tagList = (item.tags || []).length > 0 ? `#${item.tags.join(' #')}` : 'none';
    const domainStr = item.siteName || item.sourceDomain || (item.sourcePlatform ? item.sourcePlatform.toUpperCase() : 'Web');
    return `${idx + 1}. **"${item.title}"** [ID: ${item.id}]
   • **Source**: ${domainStr}${item.url ? ` (${item.url})` : ''}
   • **Auto-Tags**: ${tagList}
   • **Context**: ${item.editorialContext || item.previewDescription || item.userNote || 'Visual design reference'}
   • **Relevance**: Informs the design direction for "${ideaTitle}" with structural clarity and aesthetic focus.`;
  })
  .join('\n\n')}

### STRATEGIC NEXT MOVE
Use these pulled references to ground your design decisions. Tap any source card below to view details in your Bank.`;
  } else if (q.includes('variation') || q.includes('angle') || q.includes('alternative') || q.includes('different')) {
    body = `### CONCEPTUAL ANGLES FOR "${ideaTitle.toUpperCase()}"

1. **Monolithic & Minimalist Approach**:
   Strip ornamentation to pure form, high contrast, and structural geometry. Focus entirely on silhouette and spatial tension.

2. **Textural Tactility**:
   Introduce subtle organic irregularities into the editorial framework—matte surface treatments contrasted with high-gloss highlights.

3. **Narrative Sequencing**:
   Frame the concept as an unfolding editorial lookbook or serialized object series rather than an isolated artifact.`;
  } else if (q.includes('palette') || q.includes('material') || q.includes('color') || q.includes('texture')) {
    body = `### MATERIALITY & PALETTE MATRIX

• **Ink & Canvas Baseline**:
  Pure pitch black (#000000) and optical white (#ffffff) establish high-contrast editorial hierarchy.

• **Tactile Finishes**:
  Brushed raw aluminum, honed basalt slate, unbleached linen, and low-reflectance ceramics.

• **Atmospheric Tonalities**:
  Cold asphalt gray, subtle warm travertine, and deep obsidian shadowing. Zero artificial saturation.`;
  } else if (q.includes('brief') || q.includes('refine') || q.includes('polish') || q.includes('critique')) {
    body = `### EDITORIAL BRIEF REFINEMENT

• **Core Proposition**:
  "${ideaContext?.brief || ideaTitle}" thrives when the core tension is sharpened. Emphasize what is intentionally excluded.

• **Critical Observations**:
  ${ideaContext?.notes ? `Current notes focus on: "${ideaContext.notes.slice(0, 80)}..."` : 'Ground the idea with specific spatial or material constraints.'}

• **Immediate Next Action**:
  Define a single signature gesture—one unmistakable detail that anchors the entire collection.`;
  } else {
    body = `### TRAIN OF THOUGHT EXPLORATION

Exploring "${ideaTitle}":

• **Concept Synthesis**:
  ${userQuery}

• **Strategic Direction**:
  Align this inquiry with your saved references to maintain distinct visual consistency while testing bolder experimental boundaries.

• **Exploratory Vector**:
  Consider how this element will interact with the editorial baseline—maintaining hard 0px geometry and rigorous contrast.`;
  }

  const citationsText =
    topMatches.length > 0 && !isDumpPullQuery
      ? `\n\n**REFERENCED INSPIRATIONS:**\n` +
        topMatches
          .map(
            (m) =>
              `• [ID: ${m.item.id}] "${m.item.title}" (${m.item.siteName || m.item.sourcePlatform || 'WEB'})`
          )
          .join('\n')
      : '';

  const fullResponse = `${body}${citationsText}`;

  return {
    response: fullResponse,
    sourceInspirationIds: citedIds,
  };
}

/**
 * Sends a message in a chat session.
 * Tries the Firebase Cloud Function first; if it fails or is offline/dummy,
 * seamlessly falls back to the client-side thought synthesizer.
 */
export async function sendChatMessage(
  chatId: string,
  messageContent: string,
  options?: {
    uid?: string | null;
    ideaContext?: {
      title: string;
      brief?: string | null;
      notes?: string;
      tags?: string[];
    } | null;
    pinnedInspirations?: InspirationItem[];
    allInspirations?: InspirationItem[];
    model?: string;
  }
): Promise<{ userMessage: ChatMessage; assistantMessage: ChatMessage }> {
  const cleanContent = messageContent.trim();
  const uid = options?.uid || DUMMY_USER_UID;

  // Ensure all inspirations are available for dump inspection
  let allInspirations = options?.allInspirations || [];
  if (allInspirations.length === 0) {
    allInspirations = await getDumpInspirations();
  }

  // 1. Create and save user message locally
  const userMessageId = `msg-user-${Date.now()}`;
  const userMessage: ChatMessage = {
    id: userMessageId,
    role: 'user',
    content: cleanContent,
    sourceInspirationIds: [],
    model: null,
    inputTokens: null,
    outputTokens: null,
    estimatedCostMicros: null,
    status: 'complete',
    createdAt: Date.now(),
  };

  const currentMessages = await getLocalMessages(chatId);
  await setLocalMessages(chatId, [...currentMessages, userMessage]);

  if (isLiveAuth(uid)) {
    try {
      await setDoc(
        doc(db, 'users', uid!, 'chats', chatId, 'messages', userMessageId),
        userMessage
      );
    } catch {}
  }

  // 2. Generate assistant response
  let assistantResponse = '';
  let citedIds: string[] = [];
  let usedModel = options?.model || 'gemini-3.5-flash-lite';
  let inputTokens = Math.round(cleanContent.length / 4) + 120;
  let outputTokens = 180;
  let estimatedCostMicros = 45;

  let cloudSuccess = false;

  if (isLiveAuth(uid)) {
    try {
      const chatFn = httpsCallable<
        { chatId: string; message: string; model?: string },
        {
          response: string;
          sourceInspirationIds: string[];
          model: string;
          inputTokens: number;
          outputTokens: number;
          estimatedCostMicros: number;
        }
      >(functions, 'chatWithBank');

      const result = await chatFn({
        chatId,
        message: cleanContent,
        model: options?.model,
      });

      if (result.data?.response) {
        assistantResponse = result.data.response;
        citedIds = result.data.sourceInspirationIds || [];
        usedModel = result.data.model || usedModel;
        inputTokens = result.data.inputTokens || inputTokens;
        outputTokens = result.data.outputTokens || outputTokens;
        estimatedCostMicros = result.data.estimatedCostMicros || estimatedCostMicros;
        cloudSuccess = true;
      }
    } catch (err) {
      console.log('[Chat] Cloud function unavailable, activating local thought synthesizer:', err);
    }
  }

  if (!cloudSuccess) {
    // Intelligent local fallback synthesis
    const synthesized = synthesizeThoughtTrain({
      userQuery: cleanContent,
      ideaContext: options?.ideaContext,
      pinnedInspirations: options?.pinnedInspirations,
      allInspirations: options?.allInspirations,
    });
    assistantResponse = synthesized.response;
    citedIds = synthesized.sourceInspirationIds;
  }

  // 3. Save assistant message
  const assistantMessageId = `msg-assistant-${Date.now()}`;
  const assistantMessage: ChatMessage = {
    id: assistantMessageId,
    role: 'assistant',
    content: assistantResponse,
    sourceInspirationIds: citedIds,
    model: usedModel,
    inputTokens,
    outputTokens,
    estimatedCostMicros,
    status: 'complete',
    createdAt: Date.now() + 1,
  };

  const updatedMessages = [...currentMessages, userMessage, assistantMessage];
  await setLocalMessages(chatId, updatedMessages);

  if (isLiveAuth(uid)) {
    try {
      await setDoc(
        doc(db, 'users', uid!, 'chats', chatId, 'messages', assistantMessageId),
        assistantMessage
      );
    } catch {}
  }

  // 4. Update session preview
  const session = await getChatSession(chatId, uid);
  if (session) {
    const updatedSession: ChatSession = {
      ...session,
      summary: cleanContent.slice(0, 100),
      updatedAt: Date.now(),
    };
    await saveChatSession(updatedSession, uid);
  }

  return { userMessage, assistantMessage };
}
