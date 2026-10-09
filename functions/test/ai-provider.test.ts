import { MockAIProvider } from '../src/ai/mock-provider';

describe('Mock AI Provider', () => {
  const provider = new MockAIProvider();

  test('generates normalized embeddings with 64 dimensions', async () => {
    const result = await provider.generateEmbedding('Minimalist brutalist typography inspiration');
    expect(result.embedding).toHaveLength(64);
    expect(result.model).toBe('mock-model');
    // Vector norm should be close to 1
    const norm = Math.sqrt(result.embedding.reduce((s, v) => s + v * v, 0));
    expect(Math.abs(norm - 1)).toBeLessThan(0.001);
  });

  test('summarizes inspiration deterministically with tags and concepts', async () => {
    const summary = await provider.summarizeInspiration({
      title: 'Architectural Digest Modernist House',
      userNote: 'Clean lines, raw concrete',
      url: 'https://example.com/modernist',
    });

    expect(summary.aiSummary).toContain('Architectural Digest');
    expect(summary.aiTags.length).toBeGreaterThan(0);
    expect(summary.concepts.length).toBeGreaterThan(0);
    expect(summary.estimatedCostMicros).toBeGreaterThan(0);
  });

  test('cites exact real context inspiration IDs in chat responses', async () => {
    const chatResult = await provider.generateChatResponse({
      message: 'Can we combine these architectural ideas?',
      chatHistory: [],
      pinnedInspirations: [
        {
          id: 'item-101',
          title: 'Concrete House',
          summary: 'Minimalist monolithic structure',
        },
      ],
      retrievedInspirations: [
        {
          id: 'item-202',
          title: 'Bauhaus Chairs',
          summary: 'Steel frame modernist furniture',
        },
      ],
    });

    expect(chatResult.sourceInspirationIds).toContain('item-101');
    expect(chatResult.sourceInspirationIds).toContain('item-202');
    expect(chatResult.response).toContain('Concrete House');
  });

  test('suggests project links with bounded confidence and rationale', async () => {
    const projectResult = await provider.suggestProjectLinks({
      projectTitle: 'Lookbook 2026',
      inspirations: [
        { id: 'insp-1', title: 'Studio Lighting Setup' },
        { id: 'insp-2', title: 'Editorial Monochrome Layout' },
      ],
    });

    expect(projectResult.suggestions).toHaveLength(2);
    expect(projectResult.suggestions[0].confidence).toBeGreaterThanOrEqual(0);
    expect(projectResult.suggestions[0].confidence).toBeLessThanOrEqual(1);
    expect(projectResult.suggestions[0].inspirationId).toBe('insp-1');
  });
});

describe('validateFlashModel Rule Enforcement', () => {
  const { validateFlashModel } = require('../src/config');

  test('accepts gemini-3.5-flash and above flash models', () => {
    expect(validateFlashModel('gemini-3.5-flash')).toBe('gemini-3.5-flash');
    expect(validateFlashModel('gemini-3.5-flash-preview')).toBe('gemini-3.5-flash-preview');
    expect(validateFlashModel('gemini-4.0-flash')).toBe('gemini-4.0-flash');
    expect(validateFlashModel('GEMINI-4.5-FLASH')).toBe('gemini-4.5-flash');
  });

  test('rejects Flash models below version 3.5', () => {
    expect(() => validateFlashModel('gemini-2.0-flash')).toThrow(/Version 2.0 is not supported/);
    expect(() => validateFlashModel('gemini-1.5-flash')).toThrow(/Version 1.5 is not supported/);
    expect(() => validateFlashModel('gemini-2.5-flash')).toThrow(/Version 2.5 is not supported/);
    expect(() => validateFlashModel('gemini-3.0-flash')).toThrow(/Version 3.0 is not supported/);
  });

  test('rejects non-flash models even if 3.5 or above', () => {
    expect(() => validateFlashModel('gemini-3.5-pro')).toThrow(/Only Gemini Flash models/);
    expect(() => validateFlashModel('gemini-pro')).toThrow(/Only Gemini Flash models/);
    expect(() => validateFlashModel('gemini-ultra')).toThrow(/Only Gemini Flash models/);
  });
});

