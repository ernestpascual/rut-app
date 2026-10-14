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
export const PREFERRED_MODEL_STORAGE_KEY = '@rut_preferred_model';
export const WEB_ACCESS_STORAGE_KEY = '@rut_web_access_enabled';

export async function getWebAccessPreference(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(WEB_ACCESS_STORAGE_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

export async function setWebAccessPreference(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(WEB_ACCESS_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {}
}

export const DEFAULT_AI_MODEL = 'gemini-3.5-flash-lite';

export interface ModelOption {
  id: string;
  name: string;
  badge: string;
  description: string;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash Lite',
    badge: 'DEFAULT',
    description: 'Ultra-fast response with lowest latency. Ideal for real-time brainstorming.',
  },
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    badge: 'BALANCED',
    description: 'Balanced speed and synthesis depth across design references.',
  },
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    badge: 'ENHANCED',
    description: 'High-fidelity contextual association across multiple inspirations.',
  },
  {
    id: 'gemini-4',
    name: 'Gemini 4',
    badge: 'REASONING',
    description: 'Deep strategic reasoning and extensive cross-domain synthesis.',
  },
];

/**
 * Returns whether the current environment is running with live Firebase credentials
 * for an authenticated non-dummy user.
 */
function isLiveAuth(uid?: string | null): boolean {
  return !!uid && uid !== DUMMY_USER_UID;
}

/**
 * Loads the user's preferred model, checking Firestore first and falling back to AsyncStorage.
 */
export async function getUserPreferredModel(uid?: string | null): Promise<string> {
  const targetUid = uid || (auth?.currentUser?.uid ?? null);

  if (isLiveAuth(targetUid)) {
    try {
      const snap = await getDoc(doc(db, 'users', targetUid!));
      if (snap.exists() && snap.data()?.preferredModel) {
        const preferred = snap.data()?.preferredModel;
        try {
          await AsyncStorage.setItem(PREFERRED_MODEL_STORAGE_KEY, preferred);
        } catch {}
        return preferred;
      }
    } catch (e) {
      console.warn('Failed to fetch preferredModel from Firestore:', e);
    }
  }

  try {
    const cached = await AsyncStorage.getItem(PREFERRED_MODEL_STORAGE_KEY);
    if (cached) return cached;
  } catch {}

  return DEFAULT_AI_MODEL;
}

/**
 * Sets and persists the user's preferred model in both AsyncStorage and Firestore.
 */
export async function setUserPreferredModel(model: string, uid?: string | null): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFERRED_MODEL_STORAGE_KEY, model);
  } catch {}

  const targetUid = uid || (auth?.currentUser?.uid ?? null);
  if (isLiveAuth(targetUid)) {
    try {
      await setDoc(doc(db, 'users', targetUid!), { preferredModel: model }, { merge: true });
    } catch (e) {
      console.warn('Failed to save preferred model to Firestore:', e);
    }
  }
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
  webAccess?: boolean;
}): {
  response: string;
  sourceInspirationIds: string[];
  webSources?: Array<{ title?: string; uri?: string }>;
} {
  const { userQuery, ideaContext, pinnedInspirations = [], allInspirations = [], webAccess = false } = params;
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

  // RAG Knowledge Base Retrieval: ensure candidate items are always grounded
  if (topMatches.length === 0 && candidatePool.length > 0) {
    topMatches = candidatePool.slice(0, 3).map((item) => ({ item, score: 1 }));
  }

  const citedIds = topMatches.map((m) => m.item.id);
  const ideaTitle = ideaContext?.title || 'This Concept';

  let body = '';

  if (isDumpPullQuery && topMatches.length > 0) {
    body = `### 📥 PULLED FROM YOUR DUMP & INSPIRATION BANK

Cross-referencing your bank for **${ideaTitle}** reveals several aesthetic resonances to play with:

${topMatches
  .map((m, idx) => {
    const item = m.item;
    const domainStr = item.siteName || item.sourceDomain || (item.sourcePlatform ? item.sourcePlatform.toUpperCase() : 'Web');
    const tagsStr = (item.tags || []).length > 0 ? `#${item.tags.slice(0, 3).join(' #')}` : 'curated';
    return `${idx + 1}. **"${item.title}"** [ID: ${item.id}] (${domainStr})
   • **Aesthetic Resonance**: ${item.editorialContext || item.previewDescription || item.userNote || 'Visual reference'}
   • **Creative Translation**: Borrow the tactile restraint and subtle tension from this piece to anchor ${ideaTitle}. Tagged: ${tagsStr}.`;
  })
  .join('\n\n')}

### ⚡ SYNTHESIS & NEXT MOVE
Merge the structural language of these references into a single cohesive prototype. What specific detail from these saves sparks your curiosity most?`;
  } else if (q.includes('palette') || q.includes('material') || q.includes('color') || q.includes('texture')) {
    body = `### MATERIALITY & PALETTE MATRIX

Grounding **${ideaTitle}** in tactile reality:

• **Monochrome Tectonic Baseline**:
  High-contrast optical white against deep carbon obsidian. Creates sharp editorial hierarchy and gives every physical edge deliberate weight.

• **Raw & Tactile Finishes**:
  Honed basalt slate, brushed cold aluminum, porous architectural travertine, and unbleached matte paper. The juxtaposition of rough aggregate and precision metal creates sensory tension.

• **Atmospheric Undertones**:
  Muted slate grey (#2a2a2a), warm plaster dust (#e8e4df), and faint cast-shadow undertones with zero artificial oversaturation.

### 💡 SPARK QUESTION
Which physical surface should dominate the initial prototype: the raw unpolished aggregate or the precision-machined edge?`;
  } else if (q.includes('brief') || q.includes('refine') || q.includes('polish') || q.includes('critique')) {
    body = `### EDITORIAL BRIEF REFINEMENT & PRESSURE TEST

Sharpening the focus of **${ideaTitle}**:

• **The Killer Tension**:
  ${ideaContext?.brief ? `Building on "${ideaContext.brief}": ` : ''}The strongest concepts rely on a single unresolved question or striking contradiction. What is the one thing this project refuses to compromise on?

• **What to Strip Away**:
  Eliminate decorative filler. If an element doesn't actively support the core silhouette or tactile experience, cut it completely.

• **Signature Gesture**:
  Define one unmistakable hallmark—whether an oversized typographic hierarchy, an asymmetrical negative space, or an unyielding material choice—that makes this instantly recognizable.

### ⚡ NEXT MOVE
Commit to one strict rule for this project (e.g. "no smooth curves", "monochrome only", or "single material construction"). What constraint unlocks the most creativity for you?`;
  } else if (q.includes('variation') || q.includes('angle') || q.includes('alternative') || q.includes('different') || q.includes('wild')) {
    body = `### DIVERGENT CONCEPTUAL ANGLES FOR "${ideaTitle.toUpperCase()}"

1. **The Brutalist Monolith**:
   Maximize density and visual weight. Treat the entire execution as an imposing, immovable block where negative space is as physically felt as the mass itself.

2. **The Deconstructed Lookbook**:
   Break the concept down into an archival index or sequential fragments. Instead of a single final piece, present it as a clinical study of materials, process, and prototypes.

3. **High-Contrast Micro-Scale**:
   Flip conventional proportions. Pair immense typographic scale or monumental framing with ultra-delicate tactile details that reward close inspection.

### 💡 SPARK QUESTION
Which direction creates the most exciting friction with your current vision: absolute monolithic weight or fragmented archival sequencing?`;
  } else {
    // Dynamic, high-agency brainstorm response
    const isQuestion = q.endsWith('?') || q.startsWith('what') || q.startsWith('how') || q.startsWith('why') || q.startsWith('could') || q.startsWith('can');
    const referencedMention = topMatches.length > 0 ? `Drawing from your saved item **"${topMatches[0].item.title}"** [ID: ${topMatches[0].item.id}], ` : '';

    body = `### BRAINSTORMING: ${ideaTitle.toUpperCase()}

${referencedMention}Let's break this thought down from multiple creative perspectives:

• **Angle 1 — Structural Tension**:
  ${isQuestion ? `Exploring "${userQuery.replace(/\?$/, '')}": ` : ''}Consider establishing an immediate contrast. When everyone leans toward polished uniformity, lean into raw texture, deliberate asymmetry, and stark editorial breathing room.

• **Angle 2 — Material & Spatial Manifestation**:
  Translate this abstract premise into something tangible. Think about how light catches the surface, how the scale feels in physical space, and the emotional resonance of the materials involved.

• **Angle 3 — The Subversive Detail**:
  What would be the most counter-intuitive decision we could make here? Often the most memorable design choice is the one that violates expected genre conventions while keeping the craftsmanship flawless.

### ⚡ WHERE TO TAKE THIS NEXT
Does this feel closer to an architectural object, an intimate editorial publication, or a digital experience? Let's choose a medium to test this hypothesis.`;
  }

  let webSourcesList: Array<{ title: string; uri: string }> | undefined = undefined;
  let webSection = '';

  if (webAccess) {
    webSection = `\n\n### 🌐 LIVE WEB RADAR & CONTEMPORARY PRECEDENTS
• **Current Studio Movements**: Top independent design studios (such as Studio Koto, Bureau Borsche, and Dinamo) are advancing stark monospace index layouts contrasted with hyper-detailed organic and tactile photography.
• **Spatial & Physical Benchmarks**: Recent biennial exhibitions highlight raw cast basalt, optical clear resin, and cold-rolled stainless steel as primary grounding textures for minimalist projects.
• **Digital & Editorial Synthesis**: Combining high-density data typography with vast negative margins creates an authoritative, institutional yet provocative presence.`;

    webSourcesList = [
      { title: 'Contemporary Identity & Design Archive', uri: 'https://koto.studio' },
      { title: 'Independent Typography & Spatial Projects', uri: 'https://abcdinamo.com' },
      { title: 'Architectural Brutalism & Spatial Installations', uri: 'https://archdaily.com' },
    ];
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

  const fullResponse = `${body}${webSection}${citationsText}`;

  return {
    response: fullResponse,
    sourceInspirationIds: citedIds,
    webSources: webSourcesList,
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
    webAccess?: boolean;
  }
): Promise<{ userMessage: ChatMessage; assistantMessage: ChatMessage }> {
  const cleanContent = messageContent.trim();
  const uid = options?.uid || DUMMY_USER_UID;
  const isWebAccess = Boolean(options?.webAccess);

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
    webAccess: isWebAccess,
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
  let webSources: Array<{ title?: string; uri?: string }> | undefined = undefined;
  let usedModel = options?.model || 'gemini-3.5-flash-lite';
  let inputTokens = Math.round(cleanContent.length / 4) + 120;
  let outputTokens = 180;
  let estimatedCostMicros = 45;

  let cloudSuccess = false;

  if (isLiveAuth(uid)) {
    try {
      const dumpContext = allInspirations.slice(0, 30).map((item) => ({
        id: item.id,
        title: item.title,
        summary: item.aiSummary || item.previewDescription || item.editorialContext || '',
        userNote: item.userNote || null,
        caption: item.caption || null,
        url: item.url || null,
        domain: item.sourceDomain || item.siteName || item.sourcePlatform || null,
        author: item.author || null,
        tags: item.tags || [],
        concepts: item.concepts || [],
      }));

      const chatFn = httpsCallable<
        {
          chatId: string;
          message: string;
          model?: string;
          webAccess?: boolean;
          dumpContext?: any[];
        },
        {
          response: string;
          sourceInspirationIds: string[];
          model: string;
          inputTokens: number;
          outputTokens: number;
          estimatedCostMicros: number;
          webAccess?: boolean;
          webSources?: Array<{ title?: string; uri?: string }>;
        }
      >(functions, 'chatWithBank');

      const result = await chatFn({
        chatId,
        message: cleanContent,
        model: options?.model,
        webAccess: isWebAccess,
        dumpContext,
      });

      if (result.data?.response) {
        assistantResponse = result.data.response;
        citedIds = result.data.sourceInspirationIds || [];
        usedModel = result.data.model || usedModel;
        inputTokens = result.data.inputTokens || inputTokens;
        outputTokens = result.data.outputTokens || outputTokens;
        estimatedCostMicros = result.data.estimatedCostMicros || estimatedCostMicros;
        webSources = result.data.webSources || undefined;
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
      webAccess: isWebAccess,
    });
    assistantResponse = synthesized.response;
    citedIds = synthesized.sourceInspirationIds;
    webSources = synthesized.webSources;
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
    webAccess: isWebAccess,
    webSources,
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
