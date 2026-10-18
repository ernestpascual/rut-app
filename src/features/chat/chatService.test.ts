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
  getWebAccessPreference,
  setWebAccessPreference,
  getMessageDisplayText,
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

    expect(result.response).toContain('high-contrast palette');
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
    expect(assistantMessage.content).toContain('brutalist monolith');
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

    expect(assistantMessage.content).toContain('saved inspirations');
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

  test('toggles and persists web access preference', async () => {
    await setWebAccessPreference(false);
    expect(await getWebAccessPreference()).toBe(false);

    await setWebAccessPreference(true);
    expect(await getWebAccessPreference()).toBe(true);

    await setWebAccessPreference(false);
    expect(await getWebAccessPreference()).toBe(false);
  });

  test('synthesizes thought train with live web radar and sources when webAccess is enabled', async () => {
    const result = synthesizeThoughtTrain({
      userQuery: 'What are contemporary studios doing for kinetic typography identity?',
      webAccess: true,
    });

    expect(result.response).toContain('live precedents');
    expect(result.webSources).toBeDefined();
    expect(result.webSources!.length).toBeGreaterThan(0);
    expect(result.webSources![0].uri).toContain('http');
  });

  test('sendChatMessage propagates webAccess and stores webSources on assistant message', async () => {
    const session = await createChatSession('Web Grounded Brainstorm');
    const { userMessage, assistantMessage } = await sendChatMessage(
      session.id,
      'Explore live design movements',
      {
        webAccess: true,
      }
    );

    expect(userMessage.webAccess).toBe(true);
    expect(assistantMessage.webAccess).toBe(true);
    expect(assistantMessage.webSources).toBeDefined();
    expect(assistantMessage.content).toContain('live precedents');
  });

  test('does not pull unrelated bank items and answers IoT query with domain substance', () => {
    const unrelatedPins: InspirationItem[] = [
      {
        id: 'kesha-photo',
        ownerUid: 'test',
        kind: 'link',
        title: 'Edited Photo of Kesha',
        url: 'https://instagram.com/p/123',
        previewDescription: 'Here is how I edited this photo of Kesha. While the video gives you layout tricks',
        userNote: 'Portrait photography and color grade',
        tags: ['photography', 'portrait', 'editing'],
        concepts: ['lighting', 'color'],
        aiSummary: 'Photo editing tutorial',
        processingStatus: 'ready',
        processingErrorCode: null,
        duplicateOf: null,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
        capturedAt: 1000,
      } as any,
    ];

    const result = synthesizeThoughtTrain({
      userQuery: 'I want to create an IOT device that uses wifi signals to map out something. is there any thing from my bank that tells me about it?',
      allInspirations: unrelatedPins,
    });

    expect(result.sourceInspirationIds).not.toContain('kesha-photo');
    expect(result.response).toContain("don't have any saved notes or inspirations");
    expect(result.response).toContain('WiFi CSI');
    expect(result.response).not.toContain('visual language');
    expect(result.response).not.toContain('clean, distinct tension');
  });

  test('handles user correction with zero defensive boilerplate', () => {
    const result = synthesizeThoughtTrain({
      userQuery: 'it doesnt answer my question',
      conversationHistory: [
        { role: 'user', content: 'Tell me about IoT' },
        { role: 'assistant', content: 'Here is some info' },
      ],
    });

    expect(result.response).toContain("let's refocus directly");
  });

  describe('Ask a Friend Personas & UI Display', () => {
    test('getMessageDisplayText masks system persona prompts to Asking [Friend]', () => {
      expect(
        getMessageDisplayText({
          role: 'user',
          content: '[Friend Persona: Kenji (Facts)]\nYou are Kenji...',
        })
      ).toBe('Asking Kenji');

      expect(
        getMessageDisplayText({
          role: 'user',
          content: '[Friend Persona: Tala]\nYou are Tala...',
        })
      ).toBe('Asking Tala');

      expect(
        getMessageDisplayText({
          role: 'user',
          content: 'Some raw prompt',
          displayContent: 'Asking Ingrid',
        })
      ).toBe('Asking Ingrid');

      expect(
        getMessageDisplayText({
          role: 'user',
          content: 'Just a regular question',
        })
      ).toBe('Just a regular question');

      expect(
        getMessageDisplayText({
          role: 'assistant',
          content: 'Here are the facts...',
        })
      ).toBe('Here are the facts...');
    });

    test('sendChatMessage persists displayContent when provided', async () => {
      const session = await createChatSession('Friend Persona Test');
      const { userMessage } = await sendChatMessage(
        session.id,
        '[Friend Persona: Kenji (Facts)]\nYou are Kenji...',
        {
          displayContent: 'Asking Kenji',
        }
      );

      expect(userMessage.displayContent).toBe('Asking Kenji');
      expect(getMessageDisplayText(userMessage)).toBe('Asking Kenji');
    });

    test('synthesizes short conversational friend replies under 60 words', () => {
      const friends = ['Rei', 'Tala', 'Linh', 'Minji', 'Priya', 'Kamila', 'Kenji', 'Ingrid', 'Tariq', 'Mateo'];

      for (const friend of friends) {
        const result = synthesizeThoughtTrain({
          userQuery: `[Friend Persona: ${friend}]\nGive me your quick take.`,
        });

        // Conversational and punchy
        expect(result.response.length).toBeGreaterThan(10);
        // Short: under 60 words
        const wordCount = result.response.split(/\s+/).filter(Boolean).length;
        expect(wordCount).toBeLessThanOrEqual(60);
      }
    });
  });

  describe('Google Live Voice Mode Enhancements', () => {
    test('synthesizeThoughtTrain with isLiveAudio produces short 1-2 sentence spoken summary', () => {
      const result = synthesizeThoughtTrain({
        userQuery: 'What are the main references in my bank for this concept?',
        isLiveAudio: true,
      });

      expect(result.response.length).toBeGreaterThan(5);
      // Strictly 1-2 sentences (under 35 words)
      const wordCount = result.response.split(/\s+/).filter(Boolean).length;
      expect(wordCount).toBeLessThanOrEqual(35);
    });

    test('synthesizeThoughtTrain with isLiveAudio and matching dump item cites item', () => {
      const dumpItem: InspirationItem = {
        id: 'brutalist-1',
        ownerUid: 'user-1',
        kind: 'note',
        title: 'Studio Drift Kinetic Shutter',
        url: null,
        normalizedUrl: null,
        sharedText: null,
        userNote: 'Kinetic light and architectural shadow play',
        sourcePlatform: null,
        sourceDomain: null,
        sourceApp: null,
        previewDescription: null,
        remotePreviewImageUrl: null,
        tags: ['kinetic', 'light'],
        aiTags: ['kinetic', 'glass'],
        concepts: ['movement'],
        aiSummary: 'Kinetic design precedent',
        processingStatus: 'ready',
        processingErrorCode: null,
        duplicateOf: null,
        archived: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        capturedAt: Date.now(),
      };

      const result = synthesizeThoughtTrain({
        userQuery: 'How does Studio Drift fit in?',
        allInspirations: [dumpItem],
        isLiveAudio: true,
      });

      expect(result.response).toContain('Studio Drift');
      expect(result.sourceInspirationIds).toContain('brutalist-1');
      const wordCount = result.response.split(/\s+/).filter(Boolean).length;
      expect(wordCount).toBeLessThanOrEqual(35);
    });
  });
});


