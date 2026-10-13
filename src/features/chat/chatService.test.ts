import {
  getLocalChats,
  setLocalChats,
  createChatSession,
  synthesizeThoughtTrain,
  getOrCreateIdeaChat,
  sendChatMessage,
  deleteChatMessage,
  getChatMessages,
  AVAILABLE_MODELS,
  DEFAULT_AI_MODEL,
  getUserPreferredModel,
  setUserPreferredModel,
} from './chatService';
import { Project, InspirationItem } from '../../types';

describe('Chat Service & Train of Thought Synthesizer', () => {
  beforeEach(async () => {
    await setLocalChats([]);
  });

  test('creates and retrieves local chat sessions', async () => {
    const session = await createChatSession('Architectural Monoliths');
    expect(session.id).toBeDefined();
    expect(session.title).toBe('Architectural Monoliths');

    const all = await getLocalChats();
    expect(all.length).toBe(1);
    expect(all[0].id).toBe(session.id);
  });

  test('synthesizes creative thought train with cited inspiration IDs', () => {
    const references: InspirationItem[] = [
      {
        id: 'dump-pin-1',
        ownerUid: 'test',
        kind: 'link',
        title: 'Brutalist Concrete Residence',
        url: 'https://pinterest.com/pin/123',
        normalizedUrl: 'https://pinterest.com/pin/123',
        sharedText: null,
        userNote: 'Raw basalt and textured concrete slabs',
        sourcePlatform: 'pinterest',
        sourceDomain: 'pinterest.com',
        sourceApp: 'PINTEREST',
        previewDescription: 'Brutalist concrete architecture pin',
        remotePreviewImageUrl: null,
        tags: ['architecture', 'concrete', 'brutalist'],
        aiTags: ['concrete', 'monolith'],
        concepts: ['minimalism', 'structure'],
        aiSummary: 'Brutalist house pin',
        processingStatus: 'ready',
        processingErrorCode: null,
        duplicateOf: null,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
        capturedAt: 1000,
      },
    ];

    const result = synthesizeThoughtTrain({
      userQuery: 'What material palette and textures should I use for this idea?',
      ideaContext: {
        title: 'Brutalist Haven',
        brief: 'Monolithic concrete villa concept',
        notes: 'Minimalist framing',
        tags: ['concrete', 'minimalist'],
      },
      pinnedInspirations: references,
    });

    expect(result.response).toContain('MATERIALITY & PALETTE MATRIX');
    expect(result.sourceInspirationIds).toContain('dump-pin-1');
    expect(result.response).toContain('[ID: dump-pin-1]');
  });

  test('links idea to a dedicated chat session and auto-pins references', async () => {
    const idea: Project = {
      id: 'proj-123',
      ownerUid: 'test',
      title: 'Ceramics Line',
      brief: 'Organic tableware',
      notes: 'Matte glaze',
      status: 'active',
      tags: ['ceramics', 'tableware'],
      autoLinkEnabled: true,
      autoLinkConfidenceThreshold: 0.8,
      createdAt: 1000,
      updatedAt: 1000,
    };

    const references: InspirationItem[] = [
      {
        id: 'dump-ref-9',
        ownerUid: 'test',
        kind: 'link',
        title: 'Japanese Wabi-Sabi Bowls',
        url: 'https://instagram.com/p/abc',
        normalizedUrl: 'https://instagram.com/p/abc',
        sharedText: null,
        userNote: 'Earth tones and clay texture',
        sourcePlatform: 'instagram',
        sourceDomain: 'instagram.com',
        sourceApp: 'INSTAGRAM',
        previewDescription: 'Wabi-sabi bowls',
        remotePreviewImageUrl: null,
        tags: ['ceramics'],
        aiTags: ['bowls'],
        concepts: ['craft'],
        aiSummary: 'Ceramics',
        processingStatus: 'ready',
        processingErrorCode: null,
        duplicateOf: null,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
        capturedAt: 1000,
      },
    ];

    const chat = await getOrCreateIdeaChat(idea, references);
    expect(chat.projectId).toBe('proj-123');
    expect(chat.projectTitle).toBe('Ceramics Line');
    expect(chat.pinnedInspirationIds).toContain('dump-ref-9');

    // Subsequent retrieval returns the same linked chat
    const chatAgain = await getOrCreateIdeaChat(idea, references);
    expect(chatAgain.id).toBe(chat.id);
  });

  test('sends a chat message and returns user and assistant responses with citations', async () => {
    const session = await createChatSession('Brutalist Exploration');
    const { userMessage, assistantMessage } = await sendChatMessage(
      session.id,
      'Suggest conceptual variations for this project',
      {
        ideaContext: {
          title: 'Brutalist Exploration',
          brief: 'Exploring raw geometry',
        },
        model: 'gemini-3.5-flash-lite',
      }
    );

    expect(userMessage.role).toBe('user');
    expect(userMessage.content).toContain('conceptual variations');
    expect(assistantMessage.role).toBe('assistant');
    expect(assistantMessage.content).toContain('CONCEPTUAL ANGLES');
    expect(assistantMessage.model).toBe('gemini-3.5-flash-lite');
  });

  test('deletes chat session and cleans up local storage', async () => {
    const session = await createChatSession('Temporary Train of Thought');
    let chats = await getLocalChats();
    expect(chats.some((c) => c.id === session.id)).toBe(true);

    const { deleteChatSession } = await import('./chatService');
    await deleteChatSession(session.id);

    chats = await getLocalChats();
    expect(chats.some((c) => c.id === session.id)).toBe(false);
  });

  test('actively pulls and checks inspirations from dump when asked in chat', async () => {
    const session = await createChatSession('Dump Inspection Chat');
    const dumpItems: InspirationItem[] = [
      {
        id: 'dump-arch-1',
        ownerUid: 'test',
        kind: 'link',
        title: 'Monolithic Basalt Pavilion',
        url: 'https://archdaily.com/123/monolithic-basalt-pavilion',
        normalizedUrl: 'https://archdaily.com/123/monolithic-basalt-pavilion',
        sharedText: null,
        userNote: 'Monolithic proportions with dark basalt',
        sourcePlatform: 'web',
        sourceDomain: 'archdaily.com',
        sourceApp: 'ArchDaily',
        previewDescription: 'Dark basalt pavilion',
        remotePreviewImageUrl: null,
        editorialContext: '💡 ArchDaily • Context: architecture, basalt, pavilion',
        tags: ['architecture', 'basalt', 'pavilion', 'monolith'],
        aiTags: ['architecture', 'monolith'],
        concepts: ['architecture', 'basalt'],
        aiSummary: 'Basalt architecture',
        processingStatus: 'ready',
        processingErrorCode: null,
        duplicateOf: null,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
        capturedAt: 1000,
      },
    ];

    const { assistantMessage } = await sendChatMessage(
      session.id,
      'Check my dump and pull inspirations about basalt and monolith',
      {
        ideaContext: {
          title: 'Basalt Sanctuary',
        },
        allInspirations: dumpItems,
      }
    );

    expect(assistantMessage.content).toContain('PULLED FROM YOUR DUMP');
    expect(assistantMessage.content).toContain('Monolithic Basalt Pavilion');
    expect(assistantMessage.sourceInspirationIds).toContain('dump-arch-1');
  });

  test('deletes individual thought messages / insights from chat', async () => {
    const session = await createChatSession('Delete Test Train');
    const { userMessage, assistantMessage } = await sendChatMessage(
      session.id,
      'Initial brainstorm message'
    );

    let messages = await getChatMessages(session.id);
    expect(messages.length).toBe(2);

    await deleteChatMessage(session.id, assistantMessage.id);
    messages = await getChatMessages(session.id);
    expect(messages.length).toBe(1);
    expect(messages[0].id).toBe(userMessage.id);

    await deleteChatMessage(session.id, userMessage.id);
    messages = await getChatMessages(session.id);
    expect(messages.length).toBe(0);
  });

  test('provides available models and defaults to gemini-3.5-flash-lite', async () => {
    expect(DEFAULT_AI_MODEL).toBe('gemini-3.5-flash-lite');
    expect(AVAILABLE_MODELS.length).toBe(4);
    expect(AVAILABLE_MODELS.map((m) => m.id)).toEqual([
      'gemini-3.5-flash-lite',
      'gemini-3.6-flash',
      'gemini-3.8-flash',
      'gemini-4',
    ]);
  });

  test('manages user preferred model and persists updates', async () => {
    // When unset, returns default model
    await setUserPreferredModel('gemini-3.5-flash-lite');
    let model = await getUserPreferredModel();
    expect(model).toBe('gemini-3.5-flash-lite');

    // Updates to gemini-4
    await setUserPreferredModel('gemini-4');
    model = await getUserPreferredModel();
    expect(model).toBe('gemini-4');

    // Updates to gemini-3.8-flash
    await setUserPreferredModel('gemini-3.8-flash');
    model = await getUserPreferredModel();
    expect(model).toBe('gemini-3.8-flash');
  });

  test('sendChatMessage stamps assistant message with chosen model', async () => {
    const session = await createChatSession('Model Verification Train');
    const { assistantMessage } = await sendChatMessage(
      session.id,
      'Explore minimal branding angles',
      {
        model: 'gemini-3.8-flash',
      }
    );

    expect(assistantMessage.model).toBe('gemini-3.8-flash');
  });
});


