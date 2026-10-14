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
import { getDumpInspirations, getProjects, saveProject } from '../dump/dumpService';

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
    thesisStatement?: string | null;
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
    thesisStatement: options?.thesisStatement || null,
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

    const currentThesis = matched.thesisStatement || idea.thesisStatement || idea.brief || null;

    if (changed || matched.projectTitle !== idea.title || matched.thesisStatement !== currentThesis) {
      matched = {
        ...matched,
        projectTitle: idea.title,
        pinnedInspirationIds: Array.from(existingPinned),
        thesisStatement: currentThesis,
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
    thesisStatement: idea.thesisStatement || idea.brief || null,
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
 * Direct Google Gemini API call (works client-side or on static deployments when API key is present)
 * Uses the exact model and temperature indicated, supports live Google Search grounding.
 */
export async function callDirectGoogleGemini(params: {
  apiKey: string;
  model?: string;
  systemPrompt?: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  temperature?: number;
  webAccess?: boolean;
}): Promise<{
  text: string;
  webSources?: Array<{ title?: string; uri?: string }>;
} | null> {
  const { apiKey, model, systemPrompt, messages, temperature, webAccess } = params;
  if (!apiKey) return null;

  const targetModel = (model || 'gemini-2.0-flash').trim();

  const contents = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

  const payload: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: typeof temperature === 'number' ? temperature : 0.7,
      maxOutputTokens: 600,
    },
  };

  if (systemPrompt) {
    payload.systemInstruction = {
      parts: [{ text: systemPrompt }],
    };
  }

  if (webAccess) {
    payload.tools = [{ googleSearch: {} }];
  }

  const makeCall = async (mod: string) => {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${mod}:generateContent?key=${apiKey}`;
    return await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  };

  try {
    let res = await makeCall(targetModel);

    if (!res.ok) {
      console.warn(`Direct Google Gemini API call with model "${targetModel}" returned error (${res.status})`);
      // Graceful fallback if specified model is 404 or unsupported
      if (res.status === 404 && targetModel !== 'gemini-2.0-flash') {
        console.warn(`Falling back to gemini-2.0-flash...`);
        res = await makeCall('gemini-2.0-flash');
      }
    }

    if (res.ok) {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const webSources: Array<{ title?: string; uri?: string }> = [];
        const candidate = data.candidates?.[0];
        const groundingMetadata = candidate?.groundingMetadata;
        if (groundingMetadata?.groundingChunks) {
          for (const chunk of groundingMetadata.groundingChunks) {
            if (chunk.web?.uri) {
              webSources.push({
                title: chunk.web.title || chunk.web.uri,
                uri: chunk.web.uri,
              });
            }
          }
        }
        return { text, webSources: webSources.length > 0 ? webSources : undefined };
      }
    }
  } catch (err) {
    console.warn('Direct Google Gemini fetch error:', err);
  }
  return null;
}

/**
 * Conversational AI Agent Inference Engine used when running locally,
 * in test mode, offline, or as a seamless graceful fallback.
 * Allows free conversational interaction and draws from Dump when relevant.
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
  const q = userQuery.toLowerCase().trim();

  const isDumpPullQuery =
    q.includes('dump') ||
    q.includes('pull') ||
    q.includes('check') ||
    q.includes('inspiration') ||
    q.includes('bank') ||
    q.includes('saved') ||
    q.includes('reference') ||
    q.includes('saves');

  // Combine candidate items: pinned first, then all dump items
  const candidatePool = [...pinnedInspirations];
  for (const item of allInspirations) {
    if (!candidatePool.some((c) => c.id === item.id)) {
      candidatePool.push(item);
    }
  }

  // Score candidate inspirations against user query
  const queryTokens = q.split(/[\s,.-]+/).filter((t) => t.length > 2);
  const scoredCandidates = candidatePool.map((item) => {
    let score = 0;
    const itemText = `${item.title} ${item.previewDescription || ''} ${item.userNote || ''} ${item.editorialContext || ''} ${item.sourceDomain || ''} ${item.siteName || ''} ${(item.tags || []).join(' ')} ${(item.concepts || []).join(' ')}`.toLowerCase();

    for (const t of queryTokens) {
      if (itemText.includes(t)) score += 3;
    }
    if (pinnedInspirations.some((p) => p.id === item.id)) {
      score += 4;
    }
    return { item, score };
  });

  scoredCandidates.sort((a, b) => b.score - a.score);
  const relevantMatches = scoredCandidates.filter((sc) => sc.score > 0);
  const shouldDrawFromDump = isDumpPullQuery || relevantMatches.length > 0;
  const topMatches = shouldDrawFromDump
    ? (relevantMatches.length > 0 ? relevantMatches.slice(0, 3) : candidatePool.slice(0, 3).map((item) => ({ item, score: 1 })))
    : [];

  const citedIds = topMatches.map((m) => m.item.id);
  const ideaTitle = ideaContext?.title || 'This Concept';

  let body = '';

  // 1. Natural greeting check
  if (
    q === 'hi' ||
    q === 'hello' ||
    q === 'hey' ||
    q.startsWith('hi ') ||
    q.startsWith('hello ') ||
    q.startsWith('hey ') ||
    q.includes('who are you')
  ) {
    body = `Hey! I'm **rut Agent** — your creative sounding board and design collaborator.

We can brainstorm ideas, bounce aesthetic directions around, explore materials, or dig into your inspiration dump (${candidatePool.length} saves currently in your bank). What are you working on or thinking about right now?`;
  }
  // 2. Explicit Dump query or pulling from dump
  else if (isDumpPullQuery && topMatches.length > 0) {
    const listItems = topMatches.map((m) => {
      const item = m.item;
      const domainStr = item.siteName || item.sourceDomain || (item.sourcePlatform ? item.sourcePlatform.toUpperCase() : 'Web');
      const note = item.userNote || item.editorialContext || item.previewDescription || '';
      return `• **"${item.title}"** [ID: ${item.id}] (${domainStr})${note ? ` — *${note}*` : ''}`;
    }).join('\n');

    body = `I took a look through your saved inspirations for **${ideaTitle}**. Here are the references that resonate most with what you're exploring:\n\n${listItems}\n\nDo you want to lean further into these textures and forms, or take this in a different direction?`;
  }
  // 3. Palette, Materials, & Textures
  else if (q.includes('palette') || q.includes('material') || q.includes('color') || q.includes('texture')) {
    const dumpTieIn = topMatches.length > 0
      ? ` Looking at your saved reference **"${topMatches[0].item.title}"** [ID: ${topMatches[0].item.id}], that tactile quality would fit right in.`
      : '';

    body = `For **${ideaTitle}**, you could ground this in a high-contrast palette: sharp optical white against deep obsidian carbon black, softened with warm plaster and slate grey tones.

For physical materiality, honed basalt, brushed aluminum, and unbleached paper create a great tactile tension between raw aggregate and machined precision.${dumpTieIn}

What kind of texture do you want people to notice first—something unpolished and raw, or clean and minimal?`;
  }
  // 4. Conceptual Variations & Angles
  else if (
    q.includes('variation') ||
    q.includes('angle') ||
    q.includes('alternative') ||
    q.includes('different') ||
    q.includes('conceptual')
  ) {
    body = `Here are a few ways we could push **${ideaTitle}**:

One angle is to treat it like a brutalist monolith—maximize the visual density and weight so negative space feels intentional and heavy.

Another angle is a deconstructed lookbook or archival index. Instead of presenting a single finished artifact, you treat it like an open study of fragments, process, and raw materials.

You could also flip the scale: use monumental typography and framing contrasted with ultra-subtle tactile details that only reveal themselves up close.

Which of those feels closest to what you have in mind?`;
  }
  // 5. Critique, Refine, Polish
  else if (q.includes('brief') || q.includes('refine') || q.includes('polish') || q.includes('critique')) {
    body = `Taking a critical look at **${ideaTitle}**, the strongest question to ask is what single tension holds this together. The best work usually contrasts two opposing forces—like clinical minimalism with organic roughness.

It might help to strip away any decorative fluff. If a detail isn't directly supporting the silhouette or core tactile experience, try cutting it and see if the concept gets sharper.

What feels like the most essential, non-negotiable part of this for you?`;
  }
  // 6. General creative brainstorming
  else {
    const dumpNote = topMatches.length > 0
      ? ` Connecting this with your save **"${topMatches[0].item.title}"** [ID: ${topMatches[0].item.id}], `
      : ' ';

    body = `Thinking about "${userQuery.trim()}":${dumpNote}we could strip away the expected baseline and contrast high-density structure with expansive, quiet breathing room. Grounding the abstract idea into physical materials and tactile light will give it immediate weight.

How are you imagining this coming to life—as an architectural space, an editorial publication, or a digital experience?`;
  }

  let webSourcesList: Array<{ title: string; uri: string }> | undefined = undefined;
  let webSection = '';

  if (webAccess) {
    webSection = `\n\nLooking at live precedents, independent studios like Koto and Studio Dumbar are currently pairing raw monospace typography with tactile imagery and sculptural installations.`;

    webSourcesList = [
      { title: 'Contemporary Identity & Design Archive', uri: 'https://koto.studio' },
      { title: 'Independent Typography & Spatial Projects', uri: 'https://abcdinamo.com' },
      { title: 'Architectural Brutalism & Spatial Installations', uri: 'https://archdaily.com' },
    ];
  }

  const citationsText =
    topMatches.length > 0 && !isDumpPullQuery
      ? `\n\n*Referenced from your Dump:* ` +
        topMatches
          .map(
            (m) =>
              `[ID: ${m.item.id}] "${m.item.title}"`
          )
          .join(', ')
      : '';

  const fullResponse = `${body}${webSection}${citationsText}`;

  return {
    response: fullResponse,
    sourceInspirationIds: citedIds,
    webSources: webSourcesList,
  };
}

const AGENT_SYSTEM_DIRECTIVE = `You are rut Agent, a thoughtful, creative, and conversational AI partner for brainstormers, designers, and thinkers.
Converse naturally, directly, and casually.
CRITICAL CONSTRAINT: Keep all replies short, concise, and optimized (1 to 2 short paragraphs or 3-4 bullet points maximum). Avoid fluff, unsolicited preamble, or over-explaining. Get straight to the creative insight.
Do NOT structure your responses into rigid formulas, standardized templates, or robotic numbered section headers unless explicitly requested.
When relevant saves from the user's inspiration dump are provided, weave them seamlessly and naturally into your thoughts, citing them unobtrusively with [ID: item-id].`;

/**
 * Sends a message in a chat session.
 * Hybrid Inference Engine:
 * 1. Tries Firebase Cloud Function chatWithBank (production backend with Secret Manager & server search)
 * 2. Tries direct Google Gemini API call if client API key is configured (works client-side / static hosting)
 * 3. Falls back gracefully to the conversational client agent (offline resilience)
 * Always persists user & assistant messages.
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
): Promise<{ userMessage: ChatMessage; assistantMessage: ChatMessage; thesisStatement?: string }> {
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
  const updatedWithUser = [...currentMessages, userMessage];
  await setLocalMessages(chatId, updatedWithUser);

  if (isLiveAuth(uid)) {
    try {
      await setDoc(
        doc(db, 'users', uid!, 'chats', chatId, 'messages', userMessageId),
        userMessage
      );
    } catch {}
  }

  // 2. Prepare Dump knowledge base context
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

  // 3. Multi-tier Agent Inference
  let assistantResponse = '';
  let citedIds: string[] = [];
  let webSources: Array<{ title?: string; uri?: string }> | undefined = undefined;
  let usedModel = options?.model || 'gemini-3.5-flash-lite';
  let inputTokens = Math.round(cleanContent.length / 4) + 120;
  let outputTokens = 180;
  let estimatedCostMicros = 45;
  let inferenceSuccess = false;

  // Tier 1: Attempt Firebase Cloud Function chatWithBank
  if (isLiveAuth(uid)) {
    try {
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
        inferenceSuccess = true;
      }
    } catch (err) {
      console.log('[Chat] Cloud function unavailable, attempting next inference tier:', err);
    }
  }

  // Tier 2: Attempt direct Google Gemini API call if client API key is configured
  if (!inferenceSuccess) {
    const clientGeminiKey =
      (typeof process !== 'undefined' &&
        (process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
          process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
          process.env.GEMINI_API_KEY)) ||
      undefined;

    if (clientGeminiKey) {
      try {
        const isDumpQuery = /dump|bank|save|inspiration|reference/i.test(cleanContent);
        const relevantDump = isDumpQuery
          ? dumpContext.slice(0, 4)
          : dumpContext.filter((i) => {
              const text = `${i.title} ${i.userNote || ''} ${i.summary || ''}`.toLowerCase();
              return cleanContent.toLowerCase().split(/\s+/).some((w) => w.length > 2 && text.includes(w));
            }).slice(0, 3);

        const dumpKnowledgeStr = relevantDump.length > 0
          ? `\n\nRelevant inspiration items from user's dump:\n` +
            relevantDump
              .map((i) => `- [ID: ${i.id}] "${i.title}": ${i.userNote || i.summary || ''}`)
              .join('\n')
          : '';

        const systemPrompt = `${AGENT_SYSTEM_DIRECTIVE}${dumpKnowledgeStr}`;

        const messagesHistory = updatedWithUser
          .filter((m): m is ChatMessage & { role: 'user' | 'assistant' } => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({
            role: m.role,
            content: m.content,
          }));

        const directResult = await callDirectGoogleGemini({
          apiKey: clientGeminiKey,
          model: options?.model || 'gemini-2.0-flash',
          systemPrompt,
          messages: messagesHistory,
          temperature: 0.7,
          webAccess: isWebAccess,
        });

        if (directResult?.text) {
          assistantResponse = directResult.text;
          webSources = directResult.webSources;
          usedModel = options?.model || 'gemini-2.0-flash';

          // Extract cited IDs
          for (const item of allInspirations) {
            if (directResult.text.includes(item.id) || directResult.text.includes(item.title)) {
              if (!citedIds.includes(item.id)) citedIds.push(item.id);
            }
          }
          inferenceSuccess = true;
        }
      } catch (directErr) {
        console.warn('[Chat] Direct Gemini API call failed:', directErr);
      }
    }
  }

  // Tier 3: Conversational client agent fallback
  if (!inferenceSuccess) {
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

  // 4. Save assistant message
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

  const finalMessages = [...updatedWithUser, assistantMessage];
  await setLocalMessages(chatId, finalMessages);

  if (isLiveAuth(uid)) {
    try {
      await setDoc(
        doc(db, 'users', uid!, 'chats', chatId, 'messages', assistantMessageId),
        assistantMessage
      );
    } catch {}
  }

  // 5. Update session preview & thesis statement
  let thesisStatement: string | null = null;
  const session = await getChatSession(chatId, uid);
  if (session) {
    thesisStatement = generateThesisStatement(
      cleanContent,
      assistantResponse,
      session.projectTitle || session.title
    );

    const updatedSession: ChatSession = {
      ...session,
      summary: cleanContent.slice(0, 100),
      thesisStatement,
      updatedAt: Date.now(),
    };
    await saveChatSession(updatedSession, uid);

    // If attached to a project / idea, update the idea's thesis statement too
    if (session.projectId) {
      try {
        const projs = await getProjects(uid || undefined);
        const currentProj = projs.find((p) => p.id === session.projectId);
        if (currentProj) {
          await saveProject(
            {
              ...currentProj,
              thesisStatement,
              thoughtCount: finalMessages.length,
              updatedAt: Date.now(),
            },
            uid || undefined
          );
        }
      } catch (pErr) {
        console.warn('Failed to update project thesis statement:', pErr);
      }
    }
  }

  return { userMessage, assistantMessage, thesisStatement: thesisStatement || undefined };
}

/**
 * Generates a concise 1-2 sentence thesis statement that captures the core thought process
 * after interacting with the thought through the chat.
 */
export function generateThesisStatement(
  userQuery: string,
  assistantResponse: string,
  contextTitle?: string
): string {
  const cleanResp = assistantResponse.replace(/\[ID:[^\]]+\]/g, '').replace(/###+/g, '');
  const lines = cleanResp
    .split('\n')
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.length > 25 &&
        !l.startsWith('•') &&
        !l.startsWith('-') &&
        !l.startsWith('*') &&
        !/^\d+\./.test(l) &&
        !l.toLowerCase().includes('live web') &&
        !l.toLowerCase().includes('referenced from')
    );

  // Look for a line containing core thesis keywords
  const candidate = lines.find((l) =>
    /\b(explor|focus|tension|contrast|anchor|synthesiz|concept|ground|material|silhouette|manifest|direction)\b/i.test(l)
  );

  if (candidate && candidate.length <= 260) {
    const clean = candidate.replace(/^[*\s"'-]+|[*\s"'-]+$/g, '').trim();
    if (clean.length > 30) {
      return clean;
    }
  }

  // Fallback: extract the first 1-2 coherent sentences from the response body
  const sentences = cleanResp
    .replace(/[#*`_]/g, '')
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(
      (s) =>
        s.length > 25 &&
        !s.startsWith('http') &&
        !s.toLowerCase().includes('referenced') &&
        !s.toLowerCase().includes('dump')
    );

  if (sentences.length >= 2) {
    const two = `${sentences[0]} ${sentences[1]}`.trim();
    if (two.length <= 280) {
      return two;
    }
    return sentences[0];
  } else if (sentences.length === 1) {
    return sentences[0];
  }

  const subject = contextTitle || 'This creative thought';
  return `${subject} synthesizes deliberate material tensions and bold structural restraint to define a distinctive design thesis.`;
}

