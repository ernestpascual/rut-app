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

/**
 * Deduplicates chat messages by ID and eliminates echo duplicates
 * (messages with identical role and trimmed content within 4 seconds of each other).
 */
export function deduplicateMessages(messages: ChatMessage[]): ChatMessage[] {
  const map = new Map<string, ChatMessage>();
  for (const m of messages) {
    if (m && m.id) {
      map.set(m.id, m);
    }
  }

  const sorted = Array.from(map.values()).sort((a, b) => a.createdAt - b.createdAt);

  const result: ChatMessage[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const prev = result[result.length - 1];

    if (
      prev &&
      prev.role === cur.role &&
      prev.content.trim() === cur.content.trim() &&
      Math.abs(cur.createdAt - prev.createdAt) < 4000
    ) {
      if (prev.id.includes('-opt-') && !cur.id.includes('-opt-')) {
        result[result.length - 1] = cur;
      }
      continue;
    }
    result.push(cur);
  }

  return result;
}

export async function getLocalMessages(chatId: string): Promise<ChatMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(`${MESSAGES_STORAGE_PREFIX}${chatId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return deduplicateMessages(parsed);
      }
    }
  } catch (e) {
    console.warn(`Failed to load local messages for ${chatId}:`, e);
  }
  return [];
}

export async function setLocalMessages(chatId: string, messages: ChatMessage[]): Promise<void> {
  try {
    const deduped = deduplicateMessages(messages);
    await AsyncStorage.setItem(`${MESSAGES_STORAGE_PREFIX}${chatId}`, JSON.stringify(deduped));
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

export const MAX_ACTIVE_THOUGHTS = 10;

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
    seedGreeting?: boolean;
  }
): Promise<ChatSession> {
  const ownerUid = options?.uid || DUMMY_USER_UID;
  const current = await getLocalChats();
  const activeChats = current.filter((c) => !c.archived);

  if (activeChats.length >= MAX_ACTIVE_THOUGHTS) {
    throw new Error(
      `Limit reached: You can have up to ${MAX_ACTIVE_THOUGHTS} active thoughts for now. Please archive or delete an existing thought to start a new one.`
    );
  }

  const chatId = `chat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const cleanTitle = title.trim() || 'New Train of Thought';

  const preferredModel = await getUserPreferredModel(ownerUid);
  const effectiveModel = preferredModel || DEFAULT_AI_MODEL;

  const newSession: ChatSession = {
    id: chatId,
    ownerUid,
    title: cleanTitle,
    model: effectiveModel,
    pinnedInspirationIds: options?.pinnedInspirationIds || [],
    summary: null,
    thesisStatement: options?.thesisStatement || null,
    projectId: options?.projectId || null,
    projectTitle: options?.projectTitle || null,
    memorySummary: null,
    compactedMessageCount: 0,
    archived: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const initialGreeting: ChatMessage = {
    id: `msg-agent-init-${Date.now()}`,
    role: 'assistant',
    content: `Hey! I'm your thinking partner for "${cleanTitle}". We can bounce ideas around, talk through technical or design directions, or pull in your saved inspirations. What angle do you want to explore?`,
    sourceInspirationIds: [],
    model: effectiveModel,
    inputTokens: 0,
    outputTokens: 0,
    estimatedCostMicros: 0,
    status: 'complete',
    createdAt: Date.now(),
  };

  // Save locally first for instant availability
  await setLocalChats([newSession, ...current]);
  await setLocalMessages(chatId, options?.seedGreeting ? [initialGreeting] : []);

  if (isLiveAuth(options?.uid)) {
    try {
      await setDoc(doc(db, 'users', options!.uid!, 'chats', chatId), newSession);
      if (options?.seedGreeting) {
        await setDoc(
          doc(db, 'users', options!.uid!, 'chats', chatId, 'messages', initialGreeting.id),
          initialGreeting
        );
      }
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

    const merged = deduplicateMessages([...local, ...remote]);
    await setLocalMessages(chatId, merged);
    return merged;
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
  maxOutputTokens?: number;
}): Promise<{
  text: string;
  webSources?: Array<{ title?: string; uri?: string }>;
} | null> {
  const { apiKey, model, systemPrompt, messages, temperature, webAccess, maxOutputTokens } = params;
  if (!apiKey) return null;

  const targetModel = (model || 'gemini-2.0-flash').trim();

  const rawFiltered = messages.filter((m) => m.role === 'user' || m.role === 'assistant');
  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

  for (const m of rawFiltered) {
    if (!m.content) continue;
    const role = m.role === 'user' ? 'user' : 'model';
    if (contents.length > 0 && contents[contents.length - 1].role === role) {
      contents[contents.length - 1].parts[0].text += `\n\n${m.content}`;
    } else {
      contents.push({ role, parts: [{ text: m.content }] });
    }
  }

  while (contents.length > 0 && contents[0].role !== 'user') {
    contents.shift();
  }

  const payload: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: typeof temperature === 'number' ? temperature : 0.5,
      maxOutputTokens: typeof maxOutputTokens === 'number' ? maxOutputTokens : 8192,
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
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  ideaContext?: {
    title: string;
    brief?: string | null;
    notes?: string;
    tags?: string[];
  } | null;
  pinnedInspirations?: InspirationItem[];
  allInspirations?: InspirationItem[];
  webAccess?: boolean;
  memorySummary?: string | null;
  isLiveAudio?: boolean;
}): {
  response: string;
  sourceInspirationIds: string[];
  webSources?: Array<{ title?: string; uri?: string }>;
} {
  const {
    userQuery,
    conversationHistory = [],
    ideaContext,
    pinnedInspirations = [],
    allInspirations = [],
    webAccess = false,
    isLiveAudio = false,
  } = params;
  const q = userQuery.toLowerCase().trim();
  const isOngoing = conversationHistory.length > 0;

  const isDumpPullQuery =
    /\b(dump|bank|saves?|saved|inspirations?|references?|bookmarks?|vault|pin(ned)?)\b/i.test(q) ||
    /\b(check|pull|search|look up|show me|find|from my|what do i have)\b.*\b(dump|bank|saves?|inspirations?|notes?)\b/i.test(q) ||
    /\b(pull|bring up|connect to|relate to)\b.*\b(saves?|inspirations?|bank|dump)\b/i.test(q);

  const stopWords = new Set([
    'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'are', 'was', 'were',
    'will', 'what', 'when', 'where', 'which', 'who', 'why', 'how', 'all', 'any', 'can',
    'could', 'should', 'would', 'about', 'into', 'some', 'than', 'them', 'then', 'there',
    'these', 'they', 'you', 'your', 'our', 'just', 'more', 'also', 'like', 'think',
    'make', 'making', 'makes', 'made', 'know', 'want', 'give', 'tell', 'tells', 'told', 'help',
    'much', 'many', 'good', 'well', 'come', 'look', 'find', 'talk', 'need', 'such', 'very',
    'even', 'most', 'only', 'hello', 'hey', 'okay', 'sure', 'please', 'thanks', 'thank',
    'something', 'anything', 'everything', 'nothing', 'things', 'thing',
    'create', 'creating', 'creates', 'created',
    'uses', 'used', 'using', 'use',
    'out', 'now', 'device', 'devices', 'bank', 'dump', 'save', 'saves', 'saved',
    'vault', 'notes', 'note', 'idea', 'ideas', 'inspiration', 'inspirations',
    'question', 'answer', 'does', 'doesnt', "doesn't", 'dont', "don't", 'did', 'didnt', "didn't"
  ]);

  // Combine candidate items: pinned first, then all dump items
  const candidatePool = [...pinnedInspirations];
  for (const item of allInspirations) {
    if (!candidatePool.some((c) => c.id === item.id)) {
      candidatePool.push(item);
    }
  }

  const matchesWholeWord = (haystack: string, word: string): boolean => {
    if (!word || word.length < 2) return false;
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|[^a-z0-9_])${escaped}(?:$|[^a-z0-9_])`, 'i').test(haystack);
  };

  // Score candidate inspirations against user query (ignoring stopwords)
  const queryTokens = q
    .split(/[^a-z0-9_]+/)
    .filter((t) => t.length > 2 && !stopWords.has(t));

  const scoredCandidates = candidatePool.map((item) => {
    let score = 0;
    const itemText = `${item.title} ${item.previewDescription || ''} ${item.userNote || ''} ${item.editorialContext || ''} ${item.sourceDomain || ''} ${item.siteName || ''} ${(item.tags || []).join(' ')} ${(item.concepts || []).join(' ')}`.toLowerCase();

    for (const t of queryTokens) {
      if (matchesWholeWord(itemText, t)) score += 4;
    }
    if (pinnedInspirations.some((p) => p.id === item.id)) {
      score += 6;
    }
    return { item, score };
  });

  scoredCandidates.sort((a, b) => b.score - a.score);

  // Anti-fatigue: exclude inspirations already cited in recent conversation turns unless user explicitly asks
  const historyText = conversationHistory.slice(-8).map((h) => h.content || '').join(' ').toLowerCase();
  const userExplicitlyAsked = (title: string, id: string) =>
    q.includes(title.toLowerCase()) || q.includes(id.toLowerCase());

  const freshCandidates = scoredCandidates.filter(
    (sc) => !historyText.includes(sc.item.title.toLowerCase()) || userExplicitlyAsked(sc.item.title, sc.item.id)
  );

  // Normal chat requires high specific score (score >= 6). Dump query requires score >= 4.
  const minThreshold = isDumpPullQuery ? 4 : 6;
  const relevantMatches = freshCandidates.filter((sc) => sc.score >= minThreshold);
  // NEVER forcibly grab random unrelated items when score is 0
  const topMatches = relevantMatches.slice(0, isDumpPullQuery ? 3 : 2);

  const citedIds = topMatches.map((m) => m.item.id);
  const ideaTitle = ideaContext?.title || 'This Concept';

  // Domain flags
  const isCorrection = /\b(doesn'?t answer|not what i asked|wrong|missed the point|refocus|irrelevant|off track)\b/i.test(q);
  const isIoT = /\b(iot|wifi|wi-fi|signal|signals|rf|mapping|radar|sensor|sensors|esp32|microcontroller|antenna|arduino|hardware)\b/i.test(q);
  const isSoftware = /\b(app|api|database|backend|frontend|react|node|cloud|server|auth|typescript|code|architecture)\b/i.test(q);

  let body = '';

  // 0. Ask a Friend Persona handling (conversational, short, strict limit)
  const friendMatch = /\[(?:Friend Persona|System Instruction: You are responding as):?\s*([A-Za-z]+)/i.exec(userQuery);
  if (friendMatch) {
    const friendName = friendMatch[1].toLowerCase();
    let friendVoice = '';
    if (friendName === 'rei' || friendName === 'kenji') {
      friendVoice = "Looking strictly at the facts and verifiable data, we don't have enough metrics to validate this yet. Let's test the baseline numbers first before investing more time.";
    } else if (friendName === 'tala') {
      friendVoice = "My gut feel says something here feels a bit heavy and overthought. Follow what genuinely excites you right now—trust that instinct and keep it simple.";
    } else if (friendName === 'linh' || friendName === 'ingrid') {
      friendVoice = "As a realist, watch out for the operational drag and points of failure here. If that bottleneck breaks, everything halts, so stress-test that downside first.";
    } else if (friendName === 'minji' || friendName === 'tariq') {
      friendVoice = "I love the genuine upside and value creation here! If this hits, the potential for long-term momentum is huge, so double down on the strongest hook.";
    } else if (friendName === 'priya') {
      friendVoice = "What if we throw out standard assumptions completely? Imagine if this entire flow was zero-touch and flipped the typical model upside down.";
    } else if (friendName === 'kamila' || friendName === 'mateo') {
      friendVoice = "Let's keep this organized and on track. We've got two solid paths on the table—let's pick the single most urgent decision and lock down the next step.";
    } else {
      friendVoice = "That's an interesting direction! Let's keep it conversational and test the smallest possible version first.";
    }

    return {
      response: friendVoice,
      sourceInspirationIds: citedIds,
      webSources: undefined,
    };
  }

  // Google Live Voice Mode: strictly 1-2 sentences for natural spoken delivery
  if (isLiveAudio) {
    let liveReply = '';
    if (topMatches.length > 0) {
      const top = topMatches[0].item;
      liveReply = `From your bank, "${top.title}" is the most relevant reference. It provides the core aesthetic anchor for this concept.`;
    } else if (isDumpPullQuery) {
      liveReply = `I checked your bank. You don't have matching saves on this topic yet, but we can formulate the concept directly.`;
    } else if (isOngoing) {
      liveReply = `That sharpens the direction nicely. Let's decide whether to push the physical or digital execution first.`;
    } else {
      liveReply = `Strong premise. Let's focus on the single core interaction that makes this unforgettable.`;
    }

    return {
      response: liveReply,
      sourceInspirationIds: citedIds,
      webSources: undefined,
    };
  }

  // 1. User correcting or asking to refocus
  if (isCorrection) {
    body = `Got it, my mistake—let's refocus directly on what you need without the fluff. What specific part or technical challenge should we address first?`;
  }
  // 2. Natural greeting check
  else if (
    !isOngoing &&
    (q === 'hi' ||
      q === 'hello' ||
      q === 'hey' ||
      q.startsWith('hi ') ||
      q.startsWith('hello ') ||
      q.startsWith('hey ') ||
      q.includes('who are you'))
  ) {
    body = `Hey! What's on your mind? We can bounce ideas around or pull from your saves.`;
  } else if (
    isOngoing &&
    (q === 'hi' || q === 'hello' || q === 'hey' || q.startsWith('hi ') || q.startsWith('hey '))
  ) {
    body = `Ready when you are. What direction do you want to explore next?`;
  }
  // 3. Explicit Dump query or pulling from dump
  else if (isDumpPullQuery) {
    if (topMatches.length > 0) {
      const listItems = topMatches.slice(0, 3).map((m) => {
        const item = m.item;
        const note = item.userNote || item.editorialContext || item.previewDescription || '';
        const briefExplanation = note ? note.slice(0, 100).trim() : 'Relevant reference';
        return `- [ID: ${item.id}] **${item.title}**: ${briefExplanation}`;
      }).join('\n');

      body = `Here are saved inspirations from your bank:\n\n${listItems}\n\nWant to build on one of these?`;
    } else {
      // Honest bank grounding: tell user nothing matches, then answer intelligently
      if (isIoT) {
        body = `I checked your bank, and you don't have any saved notes or inspirations on WiFi sensing or IoT mapping yet.\n\nHere are the core engineering approaches to map spaces using WiFi signals:
1. **WiFi CSI (Channel State Information):** Uses OFDM subcarrier phase and amplitude shifts on ESP32-S3 or Intel NICs to detect multi-path reflections and room geometry.
2. **Radio Tomographic Imaging (RTI):** Places multiple transceiver nodes around a room's perimeter to measure signal attenuation across RF links, generating a 2D occupancy heatmap.
3. **Synthetic Aperture Radar (SAR):** Moves a single WiFi receiver along a linear track to construct spatial reflectivity maps.

Which implementation fits your hardware setup best?`;
      } else if (isSoftware) {
        body = `I checked your bank, and you don't have any saved notes or references on this architecture yet.\n\nWhere is the main constraint or latency bottleneck you want to solve first?`;
      } else {
        body = `I checked your bank, and you don't have any saved notes or inspirations on that topic yet. What specific direction or challenge do you want to explore first?`;
      }
    }
  }
  // 4. Domain-specific responses
  else if (isIoT) {
    body = `For WiFi-based mapping and spatial sensing, the standard approach is WiFi CSI (Channel State Information) using an ESP32-S3. By analyzing multi-path phase shifts across subcarriers, you can detect movement and estimate indoor geometry without optical cameras.\n\nAre you looking to build single-device radar or an array of mesh nodes?`;
  }
  else if (isSoftware) {
    body = `For this system, focus on low-latency state synchronization and a clean domain boundary. Start with the data schema and API contracts before building UI.\n\nWhat is your preferred stack for this?`;
  }
  // 5. Palette, Materials, & Textures (Preserves design grounding test)
  else if (q.includes('palette') || q.includes('material') || q.includes('color') || q.includes('texture')) {
    const dumpTieIn = topMatches.length > 0
      ? `\n- Grounding with your save [ID: ${topMatches[0].item.id}] ("${topMatches[0].item.title}"): tactile contrast.`
      : '';

    body = `For **${ideaTitle}**, here's a tight high-contrast palette:
- Optical White (#FAFAFA), Carbon Black (#111111), and Raw Slate (#4A5568)
- Basalt (#24272B), Brushed Aluminum (#D1D5DB), and Unbleached Paper (#F4EFEA)${dumpTieIn}

Lean raw and tactile or super clean?`;
  }
  // 6. Conceptual Variations & Angles
  else if (
    q.includes('variation') ||
    q.includes('angle') ||
    q.includes('alternative') ||
    q.includes('different') ||
    q.includes('conceptual')
  ) {
    body = `A few quick angles for **${ideaTitle}**:
- brutalist monolith: heavy visual weight and negative space
- Archival index: raw process fragments and material studies
- Scale contrast: monumental typography paired with micro-details

Which one feels closest?`;
  }
  // 7. Critique, Refine, Polish
  else if (q.includes('brief') || q.includes('refine') || q.includes('polish') || q.includes('critique')) {
    body = `For **${ideaTitle}**, focus on the single core tension—like clinical minimalism against raw aggregate. Cut anything purely decorative. What's the one non-negotiable element for you?`;
  }
  // 8. General dialogue
  else {
    const dumpNote = topMatches.length > 0
      ? ` Pulls in nicely with [ID: ${topMatches[0].item.id}] ("${topMatches[0].item.title}").`
      : '';

    if (isOngoing) {
      body = `That direction makes sense.${dumpNote} What's the biggest technical or design decision in front of you right now?`;
    } else {
      body = `Strong premise.${dumpNote} Are you picturing this physically or digitally?`;
    }
  }

  let webSourcesList: Array<{ title: string; uri: string }> | undefined = undefined;
  let webSection = '';

  if (webAccess) {
    if (isIoT) {
      webSection = `\n\nLooking at live precedents, engineering teams are using ESP32 CSI toolkits on GitHub and IEEE wireless sensing publications for device-free indoor localization.`;
      webSourcesList = [
        { title: 'ESP32 CSI Sensing Toolkit', uri: 'https://github.com/espressif/esp-csi' },
        { title: 'IEEE WiFi Signal Tomography Research', uri: 'https://ieeexplore.ieee.org' },
      ];
    } else {
      webSection = `\n\nLooking at live precedents, studios like Koto and Dinamo are pairing monospace editorial typography with tactile spatial installations.`;
      webSourcesList = [
        { title: 'Contemporary Identity & Design Archive', uri: 'https://koto.studio' },
        { title: 'Independent Typography & Spatial Projects', uri: 'https://abcdinamo.com' },
        { title: 'Architectural Brutalism & Spatial Installations', uri: 'https://archdaily.com' },
      ];
    }
  }

  const fullResponse = `${body}${webSection}`;

  return {
    response: fullResponse,
    sourceInspirationIds: citedIds,
    webSources: webSourcesList,
  };
}

const AGENT_SYSTEM_DIRECTIVE = `You are rut, an intuitive, sharp thinking partner and creative collaborator across engineering, hardware, software, design, and strategic ideation.

CORE RULES:
1. MULTI-DISCIPLINARY FLUENCY:
   - Match domain fluency to the user's project:
     * For IoT / hardware / electronics / networking: speak with concrete technical precision (RF physics, WiFi CSI, ESP32, protocols, signal processing). NEVER force visual design clichés ("negative space", "material contrast", "visual language") onto technical or hardware problems.
     * For software & systems: discuss architecture, data flow, APIs, and edge cases.
     * For visual design & aesthetics: discuss composition, typography, and materiality. When recommending or mentioning specific colors or palettes, always provide their exact 6-digit hex color code with a '#' (e.g. 'Deep Basalt (#1A1A1A)', 'Off-White (#F5F5F0)') so the interface renders a visual color preview square beside them.
2. THOROUGH & SUBSTANTIVE: Provide thorough, well-developed, and actionable responses when exploring concepts, engineering solutions, systems architecture, or design (up to a maximum of 2,000 words). Avoid superficial or artificially truncated replies while avoiding unnecessary fluff or filler. Always conclude and round out your answer cleanly within this 2,000-word limit without trailing off or cutting off mid-sentence.
3. TALK LIKE A HUMAN: Converse naturally and casually like an experienced collaborator. Never sound robotic, preachy, or like an AI assistant. Never use generic filler ("Certainly!", "Great question!", "Here is a breakdown...").
4. ANSWER DIRECTLY: Jump straight into the answer or idea. Don't summarize what the user just asked, don't over-explain, and don't give unsolicited background lectures.
5. VOCABULARY & STRICT BANK GROUNDING:
   - In 'rut', the words "bank", "dump", "saves", "vault", and "my inspirations" ALL refer to the user's private library of saved inspirations (links, images, notes, ideas).
   - When the user refers to their "dump" or "bank", they are ALWAYS referring to their saved inspirations, never a financial bank or garbage dump.
   - The candidate items in prompt grounding are search excerpts retrieved from their bank. The user's full bank typically has many more items. NEVER tell the user that their bank "only has 2 items" or "only has these items" unless the total count explicitly says so.
   - When the user asks to "re-evaluate", "rethink", or take a fresh look at their ideas/bank, re-examine the items with fresh critical insight, alternative perspectives, or new creative angles.
   - When the user asks whether their bank has notes, inspirations, or references on a specific topic:
     * If candidate items below genuinely match: weave in relevant references organically.
     * If NO candidate items match (or candidate list is empty): explicitly and honestly tell the user that their bank does not have anything saved on that topic yet. NEVER force-link or invent relevance for an unrelated save (e.g. never pull a photo edit for a WiFi IoT question).
     * Immediately follow that honest statement by directly answering their question with real intellectual/technical substance and actionable ideas.
6. CONVERSATIONAL RESPONSIVENESS:
   - If the user says "it doesn't answer my question", corrects you, or redirects:
     * Immediately acknowledge the redirect with zero defensiveness (e.g. "Got it, let's refocus directly on...") and address their exact point.
7. FRIEND PERSONAS (ASK A FRIEND):
   - When the user prompt includes a Friend Persona instruction (e.g. Rei, Tala, Linh, Minji, Priya, Kamila, or legacy Kenji, Ingrid, Tariq, Mateo), adopt that specific friend persona completely.
   - Reply conversationally like a trusted friend chatting casually. Do NOT sound like an AI assistant or corporate consultant, and do NOT use bulleted lists or formal greetings.
   - STRICT LIMIT: Strictly keep your reply short and concise—maximum 2 to 3 sentences (under 60 words total).`;

/**
 * Resolves the user-facing display content for a message.
 * Hides raw persona system prompts (e.g. "[Friend Persona: Kenji]") so the UI simply shows "Asking Kenji".
 */
export function getMessageDisplayText(message: {
  content: string;
  displayContent?: string;
  role: string;
}): string {
  if (message.displayContent) {
    return message.displayContent;
  }
  if (message.role === 'user') {
    const friendMatch = message.content.match(
      /^\[(?:Friend Persona|System Instruction: You are responding as):?\s*([A-Za-z]+)/i
    );
    if (friendMatch) {
      return `Asking ${friendMatch[1]}`;
    }
  }
  return message.content;
}

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
    userMessageId?: string;
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
    displayContent?: string;
    isLiveAudio?: boolean;
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
  const userMessageId = options?.userMessageId || `msg-user-${Date.now()}`;
  const userMessage: ChatMessage = {
    id: userMessageId,
    role: 'user',
    content: cleanContent,
    displayContent: options?.displayContent?.trim() || undefined,
    sourceInspirationIds: [],
    model: null,
    inputTokens: null,
    outputTokens: null,
    estimatedCostMicros: null,
    status: 'complete',
    webAccess: isWebAccess,
    isLiveAudio: Boolean(options?.isLiveAudio),
    createdAt: Date.now(),
  };

  const currentMessages = await getLocalMessages(chatId);
  const updatedWithUser = deduplicateMessages([...currentMessages, userMessage]);
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

  const currentSession = await getChatSession(chatId, uid);
  const existingMemory = currentSession?.memorySummary || null;
  const sessionModel = currentSession?.model || null;
  const userPreferred = await getUserPreferredModel(uid);
  const effectiveModel = options?.model || sessionModel || userPreferred || DEFAULT_AI_MODEL;

  // 3. Multi-tier Agent Inference
  let assistantResponse = '';
  let citedIds: string[] = [];
  let webSources: Array<{ title?: string; uri?: string }> | undefined = undefined;
  let usedModel = effectiveModel;
  let inputTokens = Math.round(cleanContent.length / 4) + 120;
  let outputTokens = 180;
  let estimatedCostMicros = 45;
  let inferenceSuccess = false;

  // Tier 1: Attempt Firebase Cloud Function chatWithBank
  if (isLiveAuth(uid)) {
    try {
      const historyToSend = currentMessages
        .slice(-30)
        .filter((m): m is ChatMessage & { role: 'user' | 'assistant' } => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content }));

      const chatFn = httpsCallable<
        {
          chatId: string;
          message: string;
          chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
          model?: string;
          webAccess?: boolean;
          dumpContext?: any[];
          totalBankCount?: number;
          memorySummary?: string;
          isLiveAudio?: boolean;
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
          memorySummary?: string;
        }
      >(functions, 'chatWithBank');

      const result = await chatFn({
        chatId,
        message: cleanContent,
        chatHistory: historyToSend,
        model: effectiveModel,
        webAccess: isWebAccess,
        dumpContext,
        totalBankCount: allInspirations.length,
        memorySummary: existingMemory || undefined,
        isLiveAudio: Boolean(options?.isLiveAudio),
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
        const isDumpQuery =
          /\b(dump|bank|saves?|saved|inspirations?|references?|bookmarks?|vault|pin(ned)?)\b/i.test(cleanContent) ||
          /\b(check|pull|search|look up|show me|find|from my|what do i have)\b.*\b(dump|bank|saves?|inspirations?|notes?)\b/i.test(cleanContent);

        const isReevaluateQuery =
          /\b(re-?evaluate|re-?examine|re-?check|re-?assess|re-?think|re-?consider|look again|check again|analyze again|look closer|re-?analyze|review|fresh look|re-?inspect|take another look|evaluate again)\b/i.test(cleanContent);

        const stopWords = new Set([
          'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'are', 'was', 'were',
          'will', 'what', 'when', 'where', 'which', 'who', 'why', 'how', 'all', 'any', 'can',
          'could', 'should', 'would', 'about', 'into', 'some', 'than', 'them', 'then', 'there',
          'these', 'they', 'you', 'your', 'our', 'just', 'more', 'also', 'like', 'think',
          'make', 'know', 'want', 'give', 'tell', 'help', 'much', 'many', 'good', 'well'
        ]);

        const contentTokens = cleanContent
          .toLowerCase()
          .split(/[^a-z0-9_]+/)
          .filter((w) => w.length > 2 && !stopWords.has(w));

        const bankMetaTerms = new Set([
          'bank', 'dump', 'save', 'saves', 'saved', 'vault',
          'inspiration', 'inspirations', 'reference', 'references',
          'item', 'items', 'note', 'notes', 'file', 'files',
          'pin', 'pins', 'pinned', 'bookmark', 'bookmarks', 'total'
        ]);

        const topicTokens = contentTokens.filter((t) => !bankMetaTerms.has(t));
        const isBroadBankQuery = isDumpQuery && topicTokens.length === 0;

        let relevantDump: typeof dumpContext = [];

        if (isBroadBankQuery) {
          relevantDump = dumpContext.slice(0, 5);
        } else {
          const tokensToScore = topicTokens.length > 0 ? topicTokens : contentTokens;
          const scoredDump = dumpContext.map((item) => {
            const text = `${item.title} ${item.userNote || ''} ${item.summary || ''} ${(item.tags || []).join(' ')} ${(item.concepts || []).join(' ')}`.toLowerCase();
            let matchCount = 0;
            for (const tok of tokensToScore) {
              if (text.includes(tok)) matchCount++;
            }
            return { item, matchCount };
          });

          relevantDump = scoredDump
            .filter((sc) => sc.matchCount > (isDumpQuery ? 0 : 1))
            .sort((a, b) => b.matchCount - a.matchCount)
            .slice(0, isDumpQuery ? 4 : 2)
            .map((sc) => sc.item);
        }

        const totalBankCount = allInspirations.length;
        const dumpKnowledgeStr = relevantDump.length > 0
          ? `\n\nUSER'S INSPIRATION BANK / DUMP CONTEXT:\n` +
            `- Total inspirations saved in user's bank: ${totalBankCount}.\n` +
            `- Representative / retrieved candidate saves:\n` +
            relevantDump
              .map((i) => {
                const snippet = (i.userNote || i.summary || '').slice(0, 160).trim();
                return `- [ID: ${i.id}] "${i.title}": ${snippet}`;
              })
              .join('\n') +
            `\n(IMPORTANT: The user has ${totalBankCount} inspirations saved in their bank in total. The items above are search excerpts retrieved for this query. Never say or claim that the user only has ${relevantDump.length} items. When the user says 'bank' or 'dump', they are ALWAYS referring to this saved inspiration vault. ${isReevaluateQuery ? 'The user asked to re-evaluate: provide a fresh critical perspective or new angles.' : ''})`
          : totalBankCount > 0
            ? `\n\nUSER'S INSPIRATION BANK / DUMP CONTEXT:\n- Total inspirations saved in user's bank: ${totalBankCount}.\n- No saved inspirations matched the specific query keywords.\n(When the user asks about their bank or dump, note that they have ${totalBankCount} saved inspirations in total, but none matched this specific query.)`
            : '';

        const memoryDirective = existingMemory
          ? `\n\nCompacted Memory from earlier in this thought:\n${existingMemory}`
          : '';

        const liveAudioDirective = options?.isLiveAudio
          ? `\n\nGOOGLE LIVE VOICE MODE (CRITICAL MANDATE):
The user is speaking out loud in Google Live voice mode.
1. NATURAL HUMAN SPOKEN FLOW: Speak with a warm, natural, human cadence. Never sound robotic, preachy, or formal.
2. STRICT SHORT LENGTH: Keep your answer strictly to 1 or 2 concise, punchy sentences (maximum 30-35 words total).
3. SPOKEN SUMMARY + SCREEN DETAILS: State the direct creative answer or main summary immediately. If citing dump inspirations, mention 1-2 item titles naturally in your sentence so the system displays their rich visual reference cards on screen.
4. ZERO MARKDOWN: Never output asterisks, markdown bullet points, numbered lists, or headers.`
          : '';

        const systemPrompt = `${AGENT_SYSTEM_DIRECTIVE}${memoryDirective}${liveAudioDirective}${dumpKnowledgeStr}`;

        const messagesHistory = updatedWithUser
          .slice(-30)
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
          maxOutputTokens: options?.isLiveAudio ? 120 : 8192,
        });

        if (directResult?.text) {
          assistantResponse = directResult.text;
          webSources = directResult.webSources;
          usedModel = options?.model || 'gemini-2.0-flash';

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
    const historyToSend = currentMessages
      .slice(-30)
      .filter((m): m is ChatMessage & { role: 'user' | 'assistant' } => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content }));

    const synthesized = synthesizeThoughtTrain({
      userQuery: cleanContent,
      conversationHistory: historyToSend,
      ideaContext: options?.ideaContext,
      pinnedInspirations: options?.pinnedInspirations,
      allInspirations: options?.allInspirations,
      webAccess: isWebAccess,
      memorySummary: existingMemory,
      isLiveAudio: options?.isLiveAudio,
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
    isLiveAudio: Boolean(options?.isLiveAudio),
    createdAt: Date.now() + 1,
  };

  const finalMessages = deduplicateMessages([...updatedWithUser, assistantMessage]);
  await setLocalMessages(chatId, finalMessages);

  if (isLiveAuth(uid)) {
    try {
      await setDoc(
        doc(db, 'users', uid!, 'chats', chatId, 'messages', assistantMessageId),
        assistantMessage
      );
    } catch {}
  }

  // 5. Compaction: If conversation history exceeds 20 messages, summarize earlier context
  let updatedMemorySummary = existingMemory;
  if (finalMessages.length > 20) {
    const older = finalMessages.slice(0, -20);
    const earlierBullets = older
      .map((m) => `${m.role === 'user' ? 'User' : 'Rut'}: "${m.content.slice(0, 80)}"`)
      .join('; ');
    updatedMemorySummary = updatedMemorySummary
      ? `${updatedMemorySummary} Earlier: ${earlierBullets}`.slice(0, 800)
      : `Earlier discussion points: ${earlierBullets}`.slice(0, 800);
  }

  // 6. Update session preview, thesis statement, and compacted memory
  let thesisStatement: string | null = null;
  const session = currentSession || (await getChatSession(chatId, uid));
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
      memorySummary: updatedMemorySummary,
      compactedMessageCount: finalMessages.length > 20 ? finalMessages.length - 20 : 0,
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

/**
 * Retrieves an existing cached 2-sentence summary or generates a new one.
 * If the last message has not changed since the summary was created,
 * returns the cached summary without reprocessing.
 * Stores generated summaries in Firestore and local storage.
 */
export async function getOrGenerateThoughtSummary(
  chatId: string,
  messages: ChatMessage[],
  session?: ChatSession | null,
  uid?: string | null
): Promise<string> {
  if (!messages || messages.length === 0) {
    return '';
  }

  const lastMessage = messages[messages.length - 1];

  // 1. Check if cached summary is already valid (no last changes from chat)
  if (
    session?.thoughtSummary &&
    session.summaryLastMessageId === lastMessage.id &&
    session.thoughtSummary.trim().length > 0
  ) {
    return session.thoughtSummary;
  }

  // 2. If authenticated, try server-side summarizeChat Cloud Function
  if (isLiveAuth(uid)) {
    try {
      const summarizeFn = httpsCallable<{ chatId: string; model?: string }, { summary: string; cached: boolean }>(
        functions,
        'summarizeChat'
      );
      const res = await summarizeFn({ chatId, model: session?.model || undefined });
      if (res.data?.summary) {
        const generated = res.data.summary.trim();
        if (session) {
          session.thoughtSummary = generated;
          session.summaryLastMessageId = lastMessage.id;
          session.summaryUpdatedAt = Date.now();
          session.summaryMessageCount = messages.length;
          await saveChatSession(session, uid);
        }
        return generated;
      }
    } catch (fnErr) {
      console.warn('[getOrGenerateThoughtSummary] Cloud function fallback:', fnErr);
    }
  }

  // 3. Deterministic local/offline 2-sentence summary generator
  // Synthesizes the core angles from the discussion into exactly 2 crisp sentences.
  const assistantMessages = messages.filter((m) => m.role === 'assistant' && m.content.trim().length > 0);
  const userMessages = messages.filter((m) => m.role === 'user' && m.content.trim().length > 0);

  let sentenceOne = '';
  let sentenceTwo = '';

  if (userMessages.length > 0) {
    const firstUser = userMessages[0].content.trim().replace(/\n+/g, ' ');
    const cleanUser = firstUser.length > 140 ? `${firstUser.slice(0, 137)}...` : firstUser;
    sentenceOne = `The brainstorm centers on exploring ${cleanUser.replace(/^(\?|\.|\!)+/, '')}${cleanUser.endsWith('.') ? '' : '.'}`;
  } else {
    sentenceOne = `The brainstorm explores creative angles and conceptual directions for this idea.`;
  }

  if (assistantMessages.length > 0) {
    const lastAssistant = assistantMessages[assistantMessages.length - 1].content.trim();
    const rawSentences = lastAssistant
      .replace(/[#*`_]/g, '')
      .replace(/\n+/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20 && !s.startsWith('http'));

    if (rawSentences.length > 0) {
      sentenceTwo = rawSentences[0];
      if (!/[.!?]$/.test(sentenceTwo)) sentenceTwo += '.';
    } else {
      sentenceTwo = `Key insights prioritize cohesive material execution, structural clarity, and focused refinement.`;
    }
  } else {
    sentenceTwo = `Key insights prioritize cohesive material execution, structural clarity, and focused refinement.`;
  }

  const localSummary = `${sentenceOne} ${sentenceTwo}`.trim();

  // Save to session and Firestore
  if (session) {
    session.thoughtSummary = localSummary;
    session.summaryLastMessageId = lastMessage.id;
    session.summaryUpdatedAt = Date.now();
    session.summaryMessageCount = messages.length;
    await saveChatSession(session, uid);
  }

  return localSummary;
}

