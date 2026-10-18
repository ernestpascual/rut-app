import { parseBlocks } from './MarkdownRenderer';

describe('MarkdownRenderer parseBlocks', () => {
  test('parses headings without duplicating them as paragraphs', () => {
    const markdown = `# Main Title
## Subtitle
### Section Header
#### Minor Header
This is a standard paragraph.`;

    const blocks = parseBlocks(markdown);
    expect(blocks).toHaveLength(5);
    expect(blocks[0]).toEqual({ type: 'h1', content: 'Main Title' });
    expect(blocks[1]).toEqual({ type: 'h2', content: 'Subtitle' });
    expect(blocks[2]).toEqual({ type: 'h3', content: 'Section Header' });
    expect(blocks[3]).toEqual({ type: 'h4', content: 'Minor Header' });
    expect(blocks[4]).toEqual({ type: 'paragraph', content: 'This is a standard paragraph.' });
  });

  test('parses unordered list items without duplicating them as paragraphs', () => {
    const markdown = `- First item
* Second item
• Third item`;

    const blocks = parseBlocks(markdown);
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toEqual({ type: 'ul', content: 'First item' });
    expect(blocks[1]).toEqual({ type: 'ul', content: 'Second item' });
    expect(blocks[2]).toEqual({ type: 'ul', content: 'Third item' });
  });

  test('parses ordered list items without duplicating them as paragraphs', () => {
    const markdown = `1. Step one
2. Step two
3. Step three`;

    const blocks = parseBlocks(markdown);
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toEqual({ type: 'ol', orderNumber: '1', content: 'Step one' });
    expect(blocks[1]).toEqual({ type: 'ol', orderNumber: '2', content: 'Step two' });
    expect(blocks[2]).toEqual({ type: 'ol', orderNumber: '3', content: 'Step three' });
  });

  test('parses code blocks with language specifiers', () => {
    const markdown = `Here is code:
\`\`\`typescript
const a = 1;
console.log(a);
\`\`\`
Follow-up text.`;

    const blocks = parseBlocks(markdown);
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toEqual({ type: 'paragraph', content: 'Here is code:' });
    expect(blocks[1]).toEqual({
      type: 'codeblock',
      lang: 'typescript',
      content: 'const a = 1;\nconsole.log(a);',
    });
    expect(blocks[2]).toEqual({ type: 'paragraph', content: 'Follow-up text.' });
  });

  test('parses horizontal rules', () => {
    const markdown = `Section 1
---
Section 2`;

    const blocks = parseBlocks(markdown);
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toEqual({ type: 'paragraph', content: 'Section 1' });
    expect(blocks[1]).toEqual({ type: 'hr', content: '' });
    expect(blocks[2]).toEqual({ type: 'paragraph', content: 'Section 2' });
  });

  test('parses markdown tables', () => {
    const markdown = `| Header A | Header B |
| --- | --- |
| Val 1 | Val 2 |
| Val 3 | Val 4 |`;

    const blocks = parseBlocks(markdown);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('table');
    expect(blocks[0].tableHeaders).toEqual(['Header A', 'Header B']);
    expect(blocks[0].tableRows).toEqual([
      ['Val 1', 'Val 2'],
      ['Val 3', 'Val 4'],
    ]);
  });

  test('groups consecutive paragraph lines and separates on blank lines', () => {
    const markdown = `Paragraph 1 line A
Paragraph 1 line B

Paragraph 2 line C`;

    const blocks = parseBlocks(markdown);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({
      type: 'paragraph',
      content: 'Paragraph 1 line A Paragraph 1 line B',
    });
    expect(blocks[1]).toEqual({
      type: 'paragraph',
      content: 'Paragraph 2 line C',
    });
  });

  test('parses ASCII and Unicode flowchart diagrams into scrollable codeblocks without breaking', () => {
    const raw = `3. The Signal Processing & Mapping Pipeline
Once your IoT receiver node captures raw CSI matrices, it sends them via UDP/WebSocket to a local edge broker (e.g., a Python service or Rust backend). The data pipeline looks like this:
[WiFi RF Wave Environment] 
         │
         ▼
[ESP32 / Rx Antenna Array] ──(Raw CSI Subcarrier Matrix)──► [Edge Computing Server]
                                                                  │
                                                                  ├─► Phase Unwrapping & SFO Sanitization
                                                                  ├─► MUSIC / ESPRIT (AoA & ToF Calculation)
                                                                  └─► Point Cloud / Heatmap Reconstruction
1.
Phase Sanitization: Raw CSI phase readings are contaminated by Sampling Frequency Offset (SFO) and Carrier Frequency Offset (CFO). You apply a linear transformation across subcarriers to unwrap and sanitize the phase.`;

    const blocks = parseBlocks(raw);
    expect(blocks).toHaveLength(4);
    expect(blocks[0]).toEqual({
      type: 'ol',
      orderNumber: '3',
      content: 'The Signal Processing & Mapping Pipeline',
    });
    expect(blocks[1].type).toBe('paragraph');
    expect(blocks[1].content).toContain('The data pipeline looks like this:');

    // Flowchart diagram preserved as codeblock
    expect(blocks[2].type).toBe('codeblock');
    expect(blocks[2].lang).toBe('flowchart');
    expect(blocks[2].content).toContain('[WiFi RF Wave Environment]');
    expect(blocks[2].content).toContain('├─► Phase Unwrapping & SFO Sanitization');
    expect(blocks[2].content).toContain('└─► Point Cloud / Heatmap Reconstruction');

    // Multiline ordered list item parsed cleanly
    expect(blocks[3]).toEqual({
      type: 'ol',
      orderNumber: '1',
      content:
        'Phase Sanitization: Raw CSI phase readings are contaminated by Sampling Frequency Offset (SFO) and Carrier Frequency Offset (CFO). You apply a linear transformation across subcarriers to unwrap and sanitize the phase.',
    });
  });
});

describe('MarkdownRenderer hex color swatches', () => {
  const { renderTextWithHexColors, renderInlineFormatted } = require('./MarkdownRenderer');

  test('renders visual swatches for hex color codes in plain text', () => {
    const result = renderTextWithHexColors('Basalt #1A1A1A and Slate #708090', {}, 'test-swatch');
    expect(Array.isArray(result)).toBe(true);

    const swatches = (result as any[]).filter(
      (el) => el?.props?.accessibilityRole === 'image'
    );
    expect(swatches).toHaveLength(2);
    expect(swatches[0].props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ backgroundColor: '#1A1A1A' })])
    );
    expect(swatches[1].props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ backgroundColor: '#708090' })])
    );
  });

  test('renders swatches when hex colors are wrapped in bold or code markdown', () => {
    const boldResult = renderInlineFormatted('**#FF5733**', {}, '#000', '#666', false);
    expect(Array.isArray(boldResult)).toBe(true);
    // Find swatch in bold result
    const boldSwatches = (boldResult as any[]).flat(2).filter(
      (el) => el?.props?.accessibilityRole === 'image'
    );
    expect(boldSwatches).toHaveLength(1);
    expect(boldSwatches[0].props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ backgroundColor: '#FF5733' })])
    );

    const codeResult = renderInlineFormatted('`#000000`', {}, '#000', '#666', false);
    const codeSwatches = (codeResult as any[]).flat(2).filter(
      (el) => el?.props?.accessibilityRole === 'image'
    );
    expect(codeSwatches).toHaveLength(1);
    expect(codeSwatches[0].props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ backgroundColor: '#000000' })])
    );
  });

  test('does not create swatches for issue numbers or HTML entities', () => {
    const issueResult = renderTextWithHexColors('Issue #42 and item #1024', {}, 'test-issue');
    expect(Array.isArray(issueResult)).toBe(false); // Single Text node returned
  });
});

