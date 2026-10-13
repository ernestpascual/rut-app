import {
  InspirationCreateSchema,
  ChatMessageCreateSchema,
  ProjectCreateSchema
} from './schemas';

describe('Validation Schemas', () => {
  test('validates valid inspiration item creation', () => {
    const valid = {
      title: 'Design Inspiration',
      url: 'https://example.com/article',
      kind: 'link' as const,
      tags: ['minimalism', 'typography'],
      userNote: 'Clean layout reference'
    };
    const result = InspirationCreateSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  test('rejects invalid URL protocols like ftp or javascript', () => {
    const invalid = {
      title: 'Bad Link',
      url: 'javascript:alert(1)',
      kind: 'link' as const
    };
    const result = InspirationCreateSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  test('shortens titles longer than 300 characters to 100 characters', () => {
    const item = {
      title: 'a'.repeat(350),
      kind: 'note' as const
    };
    const result = InspirationCreateSchema.safeParse(item);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title.length).toBe(100);
      expect(result.data.title).toBe('a'.repeat(100));
    }
  });

  test('validates chat message limits', () => {
    const valid = { content: 'Hello AI', pinnedInspirationIds: ['item1'] };
    expect(ChatMessageCreateSchema.safeParse(valid).success).toBe(true);

    const empty = { content: '' };
    expect(ChatMessageCreateSchema.safeParse(empty).success).toBe(false);
  });

  test('validates project creation constraints', () => {
    const valid = {
      title: 'Spring Campaign',
      brief: 'New lookbook project',
      tags: ['campaign', '2026']
    };
    expect(ProjectCreateSchema.safeParse(valid).success).toBe(true);
  });
});
