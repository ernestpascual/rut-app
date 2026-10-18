import { generateIdeaContextMarkdown, generateIdeaHTML, downloadIdeaAsMarkdown } from './ideaExporter';
import { Project, ProjectInspirationLink, InspirationItem, ChatMessage, ChatSession } from '../../types';

describe('ideaExporter', () => {
  const mockProject: Project = {
    id: 'proj-1',
    ownerUid: 'user-1',
    title: 'Kinetic Glass Pavilion',
    status: 'active',
    brief: 'A reactive glass pavilion responding to natural daylight shifts.',
    notes: 'Requires dichroic glass panes and low-energy mechanical hinges.',
    tags: ['architecture', 'glass', 'kinetic'],
    thesisStatement: 'Material transparency as an interactive structural dialogue.',
    autoLinkEnabled: true,
    autoLinkConfidenceThreshold: 0.7,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  };

  const mockLinks: ProjectInspirationLink[] = [
    {
      id: 'link-1',
      inspirationId: 'insp-1',
      linkedBy: 'user',
      reason: 'Facade mechanics reference',
      confidence: 0.95,
      createdAt: 1700000000000,
    },
  ];

  const mockBankMap: Record<string, InspirationItem> = {
    'insp-1': {
      id: 'insp-1',
      ownerUid: 'user-1',
      kind: 'link',
      title: 'Studio Drift Kinetic Shutter',
      url: 'https://studiodrift.com/kinetic-shutter',
      sourcePlatform: 'web',
      tags: ['kinetic', 'light'],
      editorialContext: 'Precision mechanical motion',
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
    } as unknown as InspirationItem,
  };

  const mockChatSession: ChatSession = {
    id: 'chat-1',
    ownerUid: 'user-1',
    title: 'Kinetic Glass Pavilion — Train of Thought',
    summary: 'Exploration of kinetic daylight facades.',
    projectId: 'proj-1',
    projectTitle: 'Kinetic Glass Pavilion',
    pinnedInspirationIds: ['insp-1'],
    archived: false,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  };

  const mockChatMessages: ChatMessage[] = [
    {
      id: 'msg-1',
      role: 'user',
      content: 'How should the dichroic glass interface with sunlight?',
      createdAt: 1700000100000,
    } as unknown as ChatMessage,
    {
      id: 'msg-2',
      role: 'assistant',
      content: 'Calibrate rotation angles to split incident light wavelengths across interior zones.',
      model: 'gemini-3.5-flash-lite',
      sourceInspirationIds: ['insp-1'],
      createdAt: 1700000200000,
    } as unknown as ChatMessage,
  ];

  test('generates valid idea context markdown containing all sections', () => {
    const md = generateIdeaContextMarkdown(
      mockProject,
      mockLinks,
      mockBankMap,
      mockChatSession,
      mockChatMessages
    );

    expect(md).toContain('# KINETIC GLASS PAVILION');
    expect(md).toContain('## 1. CONCEPT BRIEF');
    expect(md).toContain(mockProject.brief!);
    expect(md).toContain('## 2. NOTES & SPECIFICATIONS');
    expect(md).toContain(mockProject.notes);
    expect(md).toContain('## 3. ATTACHED REFERENCES & INSPIRATIONS (1)');
    expect(md).toContain('Studio Drift Kinetic Shutter');
    expect(md).toContain('https://studiodrift.com/kinetic-shutter');
    expect(md).toContain('## 4. TRAIN OF THOUGHT (2 INSIGHTS)');
    expect(md).toContain('How should the dichroic glass interface with sunlight?');
    expect(md).toContain('Calibrate rotation angles');
    expect(md).toContain('Studio Drift Kinetic Shutter');
  });

  test('generates HTML representation with clean layout', () => {
    const html = generateIdeaHTML(
      mockProject,
      mockLinks,
      mockBankMap,
      mockChatSession,
      mockChatMessages
    );

    expect(html).toContain('Kinetic Glass Pavilion');
    expect(html).toContain('Studio Drift Kinetic Shutter');
    expect(html).toContain('How should the dichroic glass interface with sunlight?');
    expect(html).toContain('THESIS:');
    expect(html).toContain('<!DOCTYPE html>');
  });

  test('downloadIdeaAsMarkdown produces expected output without throwing', async () => {
    const res = await downloadIdeaAsMarkdown(
      mockProject,
      mockLinks,
      mockBankMap,
      mockChatSession,
      mockChatMessages
    );
    expect(typeof res).toBe('boolean');
  });
});
