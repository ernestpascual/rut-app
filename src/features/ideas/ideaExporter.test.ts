import {
  generateIdeaContextMarkdown,
  generateIdeaHTML,
  downloadIdeaAsMarkdown,
  renderMarkdownToHtml,
  renderInlineMarkdown,
  extractThoughtSummary,
} from './ideaExporter';
import { Project, ProjectInspirationLink, InspirationItem, ChatMessage, ChatSession } from '../../types';

describe('ideaExporter', () => {
  const mockProject: Project = {
    id: 'proj-1',
    ownerUid: 'user-1',
    title: 'Kinetic Glass Pavilion',
    status: 'active',
    brief: '# Concept Overview\nA reactive **glass pavilion** responding to natural daylight shifts.\n- Responsive shading\n- Dichroic optical prisms',
    notes: '### Specifications\n- Requires dichroic glass panes\n- `tolerance <= 0.5mm`\n> Structural balance is essential.',
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
    thoughtSummary: 'The brainstorm centers on calibrating dichroic glass angles for natural sunlight splitting. The team determined dynamic pivot axes balance internal heat gain while producing vivid chromatic refraction.',
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

  describe('renderMarkdownToHtml', () => {
    test('renders markdown headings, lists, bold, blockquotes, and code to semantic HTML', () => {
      const md = `# Overview
This is **bold** and *italic* text.

### Key Features:
- Feature one
- Feature two

1. Step one
2. Step two

> "Design is intelligence made visible."

\`inlineCode\`

\`\`\`
const x = 42;
\`\`\`

---
Visit [Studio](https://studiodrift.com)`;

      const html = renderMarkdownToHtml(md);

      expect(html).toContain('<h3>Overview</h3>');
      expect(html).toContain('<strong>bold</strong>');
      expect(html).toContain('<em>italic</em>');
      expect(html).toContain('<h5>Key Features:</h5>');
      expect(html).toContain('<ul><li>Feature one</li><li>Feature two</li></ul>');
      expect(html).toContain('<ol><li>Step one</li><li>Step two</li></ol>');
      expect(html).toContain('<blockquote>&quot;Design is intelligence made visible.&quot;</blockquote>');
      expect(html).toContain('<code>inlineCode</code>');
      expect(html).toContain('<pre><code>const x = 42;</code></pre>');
      expect(html).toContain('<hr/>');
      expect(html).toContain('<a href="https://studiodrift.com" target="_blank" rel="noopener">Studio</a>');
    });

    test('handles empty or blank markdown gracefully', () => {
      expect(renderMarkdownToHtml('')).toBe('');
      expect(renderMarkdownToHtml('   ')).toBe('');
      expect(renderMarkdownToHtml(null)).toBe('');
    });
  });

  describe('extractThoughtSummary', () => {
    test('uses cached thoughtSummary when present', () => {
      const summary = extractThoughtSummary(mockChatSession, mockChatMessages);
      expect(summary).toBe(mockChatSession.thoughtSummary);
    });

    test('extracts 2-sentence summary from messages when no cached summary exists', () => {
      const sessionWithoutSummary: ChatSession = { ...mockChatSession, thoughtSummary: null, summary: null };
      const summary = extractThoughtSummary(sessionWithoutSummary, mockChatMessages);
      expect(summary).toContain('The brainstorm centers on exploring');
      expect(summary).toContain('Calibrate rotation angles');
    });
  });

  test('generates valid idea context markdown containing thought summaries instead of raw chat messages', () => {
    const md = generateIdeaContextMarkdown(
      mockProject,
      mockLinks,
      mockBankMap,
      mockChatSession,
      mockChatMessages
    );

    expect(md).toContain('# KINETIC GLASS PAVILION');
    expect(md).toContain('## 1. CONCEPT BRIEF');
    expect(md).toContain('## 2. NOTES & SPECIFICATIONS');
    expect(md).toContain('## 3. ATTACHED REFERENCES & INSPIRATIONS (1)');
    expect(md).toContain('Studio Drift Kinetic Shutter');
    expect(md).toContain('## 4. TRAINS OF THOUGHT (1 SESSION)');
    // Includes summary
    expect(md).toContain(mockChatSession.thoughtSummary!);
    // Does NOT dump raw prompt format
    expect(md).not.toContain('#### [');
    expect(md).not.toContain('YOU\n\nHow should the dichroic glass interface');
  });

  test('generates HTML representation with clean layout and properly rendered markdown', () => {
    const html = generateIdeaHTML(
      mockProject,
      mockLinks,
      mockBankMap,
      mockChatSession,
      mockChatMessages
    );

    // Markdown rendered into HTML tags
    expect(html).toContain('<h3>Concept Overview</h3>');
    expect(html).toContain('<strong>glass pavilion</strong>');
    expect(html).toContain('<ul><li>Responsive shading</li><li>Dichroic optical prisms</li></ul>');
    expect(html).toContain('<h5>Specifications</h5>');
    expect(html).toContain('<code>tolerance &lt;= 0.5mm</code>');
    expect(html).toContain('<blockquote>Structural balance is essential.</blockquote>');

    // Thought summary card included without raw message dump
    expect(html).toContain('Kinetic Glass Pavilion — Train of Thought');
    expect(html).toContain('THOUGHT SUMMARY');
    expect(html).toContain(mockChatSession.thoughtSummary!);
    expect(html).not.toContain('<div class="chat-content">How should the dichroic glass');
  });

  test('supports exporting multiple trains of thought in options.allThoughts', () => {
    const secondThought = {
      id: 'chat-2',
      title: 'Structural Engineering Review',
      summary: 'Focused on stress analysis for wind sheer resistance.',
      model: 'gemini-3.5-flash-lite',
      messageCount: 5,
    };

    const html = generateIdeaHTML(
      mockProject,
      mockLinks,
      mockBankMap,
      mockChatSession,
      mockChatMessages,
      {
        allThoughts: [
          {
            id: mockChatSession.id,
            title: mockChatSession.title,
            summary: mockChatSession.thoughtSummary,
            model: mockChatSession.model,
            messageCount: 2,
          },
          secondThought,
        ],
      }
    );

    expect(html).toContain('<h2>4. Trains of Thought (2)</h2>');
    expect(html).toContain('Kinetic Glass Pavilion — Train of Thought');
    expect(html).toContain('Structural Engineering Review');
    expect(html).toContain('Focused on stress analysis');
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
