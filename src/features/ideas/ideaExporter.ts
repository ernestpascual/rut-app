import { Platform, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Project, ProjectInspirationLink, InspirationItem, ChatMessage, ChatSession } from '../../types';

export interface ThoughtExportItem {
  id?: string;
  title: string;
  summary?: string | null;
  model?: string | null;
  messageCount?: number;
  updatedAt?: number;
  citedInspirationIds?: string[];
  messages?: ChatMessage[];
}

export interface ExportIdeaOptions {
  thoughtSummary?: string;
  allThoughts?: ThoughtExportItem[];
}

/**
 * Escapes characters that have special meaning in HTML.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Parses inline markdown: bold, italic, code, links, strikethrough.
 */
export function renderInlineMarkdown(text: string): string {
  let out = text;
  // Inline code: `code`
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold + Italic: ***text***
  out = out.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  // Bold: **text** or __text__
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  // Italic: *text* (excluding lone math asterisks)
  out = out.replace(/(^|[^\*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>');
  // Strikethrough: ~~text~~
  out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  // Links: [title](url)
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, title, href) => {
    const cleanHref = href.trim();
    if (/^(https?:\/\/|mailto:)/i.test(cleanHref)) {
      return `<a href="${cleanHref}" target="_blank" rel="noopener">${title}</a>`;
    }
    return title;
  });
  return out;
}

/**
 * Converts standard Markdown text into structured, semantic HTML for PDF export and print styling.
 * Preserves typography, headings, lists, blockquotes, code blocks, and horizontal rules.
 */
export function renderMarkdownToHtml(markdown?: string | null): string {
  if (!markdown || !markdown.trim()) return '';
  const lines = markdown.split(/\r?\n/);
  const result: string[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let listItems: string[] = [];
  let blockquoteLines: string[] = [];
  let paragraphLines: string[] = [];

  function flushList() {
    if (listType && listItems.length > 0) {
      result.push(
        `<${listType}>` +
          listItems.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join('') +
          `</${listType}>`
      );
      listType = null;
      listItems = [];
    }
  }

  function flushBlockquote() {
    if (blockquoteLines.length > 0) {
      const content = blockquoteLines
        .map((line) => renderInlineMarkdown(line))
        .join('<br/>');
      result.push(`<blockquote>${content}</blockquote>`);
      blockquoteLines = [];
    }
  }

  function flushParagraph() {
    if (paragraphLines.length > 0) {
      const content = paragraphLines
        .map((line) => renderInlineMarkdown(line))
        .join('<br/>');
      result.push(`<p>${content}</p>`);
      paragraphLines = [];
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Check code blocks
    if (trimmed.startsWith('```')) {
      flushParagraph();
      flushList();
      flushBlockquote();
      if (inCodeBlock) {
        result.push(`<pre><code>${escapeHtml(codeBlockContent.join('\n'))}</code></pre>`);
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(rawLine);
      continue;
    }

    // Horizontal rule: --- or *** or ___
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
      flushParagraph();
      flushList();
      flushBlockquote();
      result.push('<hr/>');
      continue;
    }

    // Blank line
    if (!trimmed) {
      flushParagraph();
      flushList();
      flushBlockquote();
      continue;
    }

    // Blockquote: > quote
    if (trimmed.startsWith('>')) {
      flushParagraph();
      flushList();
      const quoteText = escapeHtml(trimmed.replace(/^>\s?/, ''));
      blockquoteLines.push(quoteText);
      continue;
    } else {
      flushBlockquote();
    }

    // Headings: #, ##, ###, ####
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1].length;
      const headingTag = level === 1 ? 'h3' : level === 2 ? 'h4' : level === 3 ? 'h5' : 'h6';
      const escapedHeading = escapeHtml(headingMatch[2]);
      result.push(`<${headingTag}>${renderInlineMarkdown(escapedHeading)}</${headingTag}>`);
      continue;
    }

    // Bullet lists: - item, * item, + item
    const bulletMatch = trimmed.match(/^[-*+]\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      if (listType !== 'ul') {
        flushList();
        listType = 'ul';
      }
      listItems.push(escapeHtml(bulletMatch[1]));
      continue;
    }

    // Numbered lists: 1. item
    const numberMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (numberMatch) {
      flushParagraph();
      if (listType !== 'ol') {
        flushList();
        listType = 'ol';
      }
      listItems.push(escapeHtml(numberMatch[1]));
      continue;
    }

    // Indented continuation line of list item
    if (listType && (rawLine.startsWith('  ') || rawLine.startsWith('\t'))) {
      if (listItems.length > 0) {
        listItems[listItems.length - 1] += ' ' + escapeHtml(trimmed);
        continue;
      }
    }

    // Regular paragraph line
    flushList();
    paragraphLines.push(escapeHtml(trimmed));
  }

  flushParagraph();
  flushList();
  flushBlockquote();
  if (inCodeBlock && codeBlockContent.length > 0) {
    result.push(`<pre><code>${escapeHtml(codeBlockContent.join('\n'))}</code></pre>`);
  }

  return result.join('\n');
}

/**
 * Synthesizes or retrieves the concise summary for a thought session.
 * Never dumps the raw message history.
 */
export function extractThoughtSummary(
  session?: ChatSession | null,
  messages: ChatMessage[] = [],
  customSummary?: string | null
): string {
  if (customSummary && customSummary.trim().length > 0) {
    return customSummary.trim();
  }
  if (session?.thoughtSummary && session.thoughtSummary.trim().length > 0) {
    return session.thoughtSummary.trim();
  }
  if (session?.summary && session.summary.trim().length > 0) {
    return session.summary.trim();
  }

  if (messages && messages.length > 0) {
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
      const lastAssistant = assistantMessages[assistantMessages.length - 1].content.trim().replace(/\n+/g, ' ');
      const match = lastAssistant.match(/^([^.!?]+[.!?])/);
      const lead = match ? match[1].trim() : lastAssistant.slice(0, 120);
      sentenceTwo = lead.length > 140 ? `${lead.slice(0, 137)}...` : lead;
      if (!/[.!?]$/.test(sentenceTwo)) sentenceTwo += '.';
    } else {
      sentenceTwo = `Specific visual references, materials, and creative hypotheses were synthesized to guide execution.`;
    }
    return `${sentenceOne} ${sentenceTwo}`;
  }

  return 'Exploring creative angles, precedents, and conceptual directions for this idea.';
}

/**
 * Builds the normalized array of thought sessions to be exported.
 */
export function compileThoughtsForExport(
  ideaChat?: ChatSession | null,
  chatMessages: ChatMessage[] = [],
  options?: ExportIdeaOptions,
  projectTitle = 'Idea'
): ThoughtExportItem[] {
  const thoughts: ThoughtExportItem[] = [];

  if (options?.allThoughts && options.allThoughts.length > 0) {
    thoughts.push(...options.allThoughts);
  } else if (ideaChat || chatMessages.length > 0) {
    const summary = extractThoughtSummary(ideaChat, chatMessages, options?.thoughtSummary);
    const citedIds = Array.from(
      new Set(
        chatMessages
          .flatMap((m) => m.sourceInspirationIds || [])
          .concat(ideaChat?.pinnedInspirationIds || [])
      )
    ).filter(Boolean);

    thoughts.push({
      id: ideaChat?.id,
      title: ideaChat?.title || `${projectTitle} — Train of Thought`,
      summary,
      model: ideaChat?.model || 'gemini-3.5-flash-lite',
      messageCount: chatMessages.length || ideaChat?.summaryMessageCount || 0,
      updatedAt: ideaChat?.updatedAt,
      citedInspirationIds: citedIds,
      messages: chatMessages,
    });
  }

  return thoughts;
}

/**
 * Generates structured context Markdown for a project/idea.
 * Now includes summaries of each train of thought instead of dumping full raw chat transcripts.
 */
export function generateIdeaContextMarkdown(
  project: Project,
  links: ProjectInspirationLink[],
  bankMap: Record<string, InspirationItem>,
  ideaChat?: ChatSession | null,
  chatMessages: ChatMessage[] = [],
  options?: ExportIdeaOptions
): string {
  const attachedItems = links
    .map((l) => bankMap[l.inspirationId])
    .filter(Boolean) as InspirationItem[];

  const parts: string[] = [];

  // Header & Metadata
  parts.push(`# ${project.title.toUpperCase()}`);
  parts.push('');
  parts.push(`> **Status:** ${project.status.toUpperCase()}`);
  parts.push(`> **Updated:** ${new Date(project.updatedAt).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })}`);
  if (project.thesisStatement || ideaChat?.thesisStatement) {
    parts.push(`> **Thesis Statement:** ${project.thesisStatement || ideaChat?.thesisStatement}`);
  }
  if (project.tags && project.tags.length > 0) {
    parts.push(`> **Tags:** ${project.tags.map((t) => `#${t}`).join(' ')}`);
  }
  parts.push('');
  parts.push('---');
  parts.push('');

  // 1. Concept Brief
  parts.push('## 1. CONCEPT BRIEF');
  parts.push('');
  parts.push(project.brief ? project.brief : '_No concept brief provided._');
  parts.push('');

  // 2. Notes & Specifications
  parts.push('## 2. NOTES & SPECIFICATIONS');
  parts.push('');
  parts.push(project.notes ? project.notes : '_No notes or specifications recorded._');
  parts.push('');

  // 3. Attached References
  parts.push(`## 3. ATTACHED REFERENCES & INSPIRATIONS (${attachedItems.length})`);
  parts.push('');
  if (attachedItems.length === 0) {
    parts.push('_No inspirations or dump items attached yet._');
    parts.push('');
  } else {
    attachedItems.forEach((item, idx) => {
      const link = links.find((l) => l.inspirationId === item.id);
      parts.push(`### 3.${idx + 1} ${item.title}`);
      parts.push(`- **Type / Platform:** ${item.sourcePlatform ? item.sourcePlatform.toUpperCase() : item.kind}`);
      if (item.url) parts.push(`- **URL:** ${item.url}`);
      const reason = link?.reason || item.editorialContext;
      if (reason) parts.push(`- **Context / Why Attached:** ${reason}`);
      if (item.tags && item.tags.length > 0) {
        parts.push(`- **Tags:** ${item.tags.map((t) => `#${t}`).join(' ')}`);
      }
      parts.push('');
    });
  }

  // 4. Trains of Thought (Summaries)
  const thoughtsToExport = compileThoughtsForExport(ideaChat, chatMessages, options, project.title);
  parts.push(`## 4. TRAINS OF THOUGHT (${thoughtsToExport.length} ${thoughtsToExport.length === 1 ? 'SESSION' : 'SESSIONS'})`);
  parts.push('');
  if (thoughtsToExport.length === 0) {
    parts.push('_No brainstorm thoughts recorded for this idea yet._');
    parts.push('');
  } else {
    thoughtsToExport.forEach((thought, idx) => {
      const summaryText = thought.summary || extractThoughtSummary(null, thought.messages || [], null);
      const modelName = thought.model ? thought.model.replace('gemini-', '').toUpperCase() : 'AI';
      const timeStr = thought.updatedAt
        ? new Date(thought.updatedAt).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })
        : 'Recent';

      parts.push(`### 4.${idx + 1} ${thought.title}`);
      parts.push(`- **Engine / Model:** RUT (${modelName})`);
      if (thought.messageCount && thought.messageCount > 0) {
        parts.push(`- **Activity:** ${thought.messageCount} insights recorded • Updated ${timeStr}`);
      }
      parts.push(`- **Summary:**`);
      parts.push(`> ${summaryText}`);
      parts.push('');

      const citedIds = thought.citedInspirationIds || [];
      if (citedIds.length > 0) {
        const citedTitles = citedIds
          .map((sid) => bankMap[sid]?.title || `Ref [${sid.slice(-4)}]`)
          .filter(Boolean)
          .join(', ');
        if (citedTitles) {
          parts.push(`- **Referenced Saves:** ${citedTitles}`);
          parts.push('');
        }
      }
    });
  }

  parts.push('---');
  parts.push('_Exported from rut — Visual Research & Brainstorm Studio_');

  return parts.join('\n');
}

/**
 * Generates an editorial HTML representation of the idea for PDF print and Word (.doc).
 * Renders full markdown formatting (headings, lists, blockquotes, bold, italics, code)
 * and includes clean 2-sentence summaries of each train of thought instead of dumping raw messages.
 */
export function generateIdeaHTML(
  project: Project,
  links: ProjectInspirationLink[],
  bankMap: Record<string, InspirationItem>,
  ideaChat?: ChatSession | null,
  chatMessages: ChatMessage[] = [],
  options?: ExportIdeaOptions
): string {
  const attachedItems = links
    .map((l) => bankMap[l.inspirationId])
    .filter(Boolean) as InspirationItem[];

  const briefHtml = project.brief
    ? renderMarkdownToHtml(project.brief)
    : '<p><em>No concept brief provided.</em></p>';

  const notesHtml = project.notes
    ? renderMarkdownToHtml(project.notes)
    : '<p><em>No notes or specifications recorded.</em></p>';

  const referencesHtml =
    attachedItems.length === 0
      ? '<p><em>No references attached.</em></p>'
      : attachedItems
          .map((item, idx) => {
            const link = links.find((l) => l.inspirationId === item.id);
            const reason = link?.reason || item.editorialContext;
            return `
            <div class="ref-card">
              <div class="ref-title">3.${idx + 1} ${escapeHtml(item.title)}</div>
              <div class="ref-meta">
                <span>Platform: <strong>${escapeHtml(item.sourcePlatform ? item.sourcePlatform.toUpperCase() : item.kind)}</strong></span>
                ${item.url ? `<span> • <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.url)}</a></span>` : ''}
              </div>
              ${reason ? `<div class="ref-reason">💡 ${renderInlineMarkdown(escapeHtml(reason))}</div>` : ''}
              ${item.tags && item.tags.length > 0 ? `<div class="ref-tags">${item.tags.map((t) => `#${escapeHtml(t)}`).join(' ')}</div>` : ''}
            </div>
          `;
          })
          .join('');

  const thoughtsToExport = compileThoughtsForExport(ideaChat, chatMessages, options, project.title);
  const thoughtsHtml =
    thoughtsToExport.length === 0
      ? '<p><em>No brainstorm thoughts recorded for this idea yet.</em></p>'
      : thoughtsToExport
          .map((thought, idx) => {
            const summaryText = thought.summary || extractThoughtSummary(null, thought.messages || [], null);
            const modelName = thought.model ? thought.model.replace('gemini-', '').toUpperCase() : 'AI';
            const timeStr = thought.updatedAt
              ? new Date(thought.updatedAt).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })
              : '';
            const citedIds = thought.citedInspirationIds || [];
            const citedTitles = citedIds
              .map((sid) => bankMap[sid]?.title)
              .filter(Boolean) as string[];

            return `
            <div class="thought-card">
              <div class="thought-header">
                <span class="thought-title">4.${idx + 1} ${escapeHtml(thought.title)}</span>
                <span class="thought-meta">RUT ${escapeHtml(modelName)}${thought.messageCount ? ` • ${thought.messageCount} INSIGHTS` : ''}${timeStr ? ` • ${timeStr}` : ''}</span>
              </div>
              <div class="thought-summary-box">
                <div class="thought-summary-label">THOUGHT SUMMARY</div>
                <div class="thought-summary-text">${renderMarkdownToHtml(summaryText)}</div>
              </div>
              ${
                citedTitles.length > 0
                  ? `<div class="thought-citations"><strong>Referenced Dump Saves:</strong> ${citedTitles.map((t) => escapeHtml(t)).join(', ')}</div>`
                  : ''
              }
            </div>
          `;
          })
          .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(project.title)} — rut Export</title>
  <style>
    @page { margin: 18mm; size: auto; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #111111;
      background: #FFFFFF;
      line-height: 1.6;
      font-size: 10.5pt;
      margin: 0;
      padding: 24px;
      max-width: 800px;
      margin-left: auto;
      margin-right: auto;
    }
    h1 {
      font-size: 22pt;
      font-weight: 800;
      letter-spacing: -0.5px;
      text-transform: uppercase;
      margin-bottom: 6px;
      border-bottom: 2px solid #111111;
      padding-bottom: 6px;
    }
    .header-badges {
      font-size: 8.5pt;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: #555555;
      text-transform: uppercase;
      margin-bottom: 20px;
    }
    .badge {
      display: inline-block;
      border: 1px solid #111111;
      padding: 2px 6px;
      margin-right: 6px;
      font-size: 8pt;
    }
    .badge-inverse {
      background: #111111;
      color: #FFFFFF;
    }
    h2 {
      font-size: 11.5pt;
      font-weight: 800;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      margin-top: 26px;
      margin-bottom: 10px;
      border-bottom: 1px solid #E0E0E0;
      padding-bottom: 4px;
    }
    h3 { font-size: 11pt; font-weight: 700; margin: 12px 0 6px 0; color: #111111; }
    h4 { font-size: 10.5pt; font-weight: 700; margin: 10px 0 4px 0; color: #222222; }
    h5 { font-size: 10pt; font-weight: 700; margin: 8px 0 4px 0; color: #444444; }
    p { margin: 6px 0; line-height: 1.55; }
    strong { font-weight: 700; color: #000000; }
    em { font-style: italic; }
    ul, ol { margin: 6px 0 8px 22px; padding: 0; }
    li { margin-bottom: 4px; line-height: 1.5; }
    blockquote {
      border-left: 3px solid #111111;
      margin: 10px 0;
      padding: 6px 14px;
      background: #F9F9F9;
      color: #333333;
      font-style: italic;
    }
    code {
      background: #F2F2F2;
      border: 1px solid #E0E0E0;
      border-radius: 3px;
      padding: 1px 4px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 9pt;
    }
    pre {
      background: #1A1A1A;
      color: #F0F0F0;
      padding: 10px 14px;
      border-radius: 4px;
      overflow-x: auto;
      font-size: 8.5pt;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      line-height: 1.45;
      margin: 10px 0;
      page-break-inside: avoid;
    }
    pre code {
      background: transparent;
      border: none;
      padding: 0;
      color: inherit;
    }
    hr {
      border: none;
      border-top: 1px solid #E0E0E0;
      margin: 16px 0;
    }
    a {
      color: #111111;
      text-decoration: underline;
    }
    .card {
      border: 1px solid #E0E0E0;
      background: #FAFAFA;
      padding: 14px 18px;
      margin-bottom: 16px;
      page-break-inside: avoid;
    }
    .ref-card {
      border: 1px solid #DDDDDD;
      background: #FDFDFD;
      padding: 10px 14px;
      margin-bottom: 10px;
      page-break-inside: avoid;
    }
    .ref-title { font-weight: 700; font-size: 10.5pt; margin-bottom: 2px; }
    .ref-meta { font-size: 8.5pt; color: #666666; margin-bottom: 4px; }
    .ref-reason { font-size: 9.5pt; color: #333333; margin-top: 4px; }
    .ref-tags { font-size: 8pt; color: #888888; margin-top: 4px; }

    /* Thought Summary Cards */
    .thought-card {
      border: 1px solid #DDDDDD;
      background: #FDFDFD;
      padding: 12px 16px;
      margin-bottom: 12px;
      page-break-inside: avoid;
    }
    .thought-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 6px;
      border-bottom: 1px solid #EEEEEE;
      padding-bottom: 6px;
    }
    .thought-title {
      font-size: 10.5pt;
      font-weight: 700;
      letter-spacing: -0.2px;
      color: #111111;
    }
    .thought-meta {
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #666666;
    }
    .thought-summary-box {
      border-left: 3px solid #111111;
      background: #F8F8F8;
      padding: 8px 12px;
      margin-top: 8px;
      margin-bottom: 8px;
      font-size: 10pt;
      line-height: 1.55;
      color: #222222;
    }
    .thought-summary-label {
      font-size: 7.5pt;
      font-weight: 800;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      color: #888888;
      margin-bottom: 4px;
    }
    .thought-summary-text p {
      margin: 4px 0;
    }
    .thought-citations {
      margin-top: 6px;
      font-size: 8.5pt;
      color: #666666;
      border-top: 1px dashed #EEEEEE;
      padding-top: 6px;
    }
    .thought-citations strong {
      color: #333333;
    }
    footer {
      margin-top: 36px;
      padding-top: 12px;
      border-top: 1px solid #E0E0E0;
      font-size: 8pt;
      color: #888888;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(project.title)}</h1>
  <div class="header-badges">
    <span class="badge badge-inverse">${escapeHtml(project.status.toUpperCase())}</span>
    <span>Updated ${new Date(project.updatedAt).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })}</span>
    ${project.tags && project.tags.length > 0 ? `<span> • ${project.tags.map((t) => `#${escapeHtml(t)}`).join(' ')}</span>` : ''}
  </div>

  ${
    project.thesisStatement || ideaChat?.thesisStatement
      ? `
    <div style="border-left: 3px solid #111111; padding: 10px 14px; background: #F8F8F8; margin-bottom: 20px; font-style: italic;">
      <strong>THESIS:</strong> ${renderInlineMarkdown(escapeHtml(project.thesisStatement || ideaChat?.thesisStatement || ''))}
    </div>
  `
      : ''
  }

  <h2>1. Concept Brief</h2>
  <div class="card markdown-body">
    ${briefHtml}
  </div>

  <h2>2. Notes &amp; Specifications</h2>
  <div class="card markdown-body">
    ${notesHtml}
  </div>

  <h2>3. Attached References (${attachedItems.length})</h2>
  ${referencesHtml}

  <h2>4. Trains of Thought (${thoughtsToExport.length})</h2>
  ${thoughtsHtml}

  <footer>
    rut — Creative Research &amp; Brainstorm Studio
  </footer>
</body>
</html>`;
}

/**
 * Copies the idea context markdown to the clipboard.
 */
export async function copyIdeaAsMarkdown(
  project: Project,
  links: ProjectInspirationLink[],
  bankMap: Record<string, InspirationItem>,
  ideaChat?: ChatSession | null,
  chatMessages: ChatMessage[] = [],
  options?: ExportIdeaOptions
): Promise<boolean> {
  const md = generateIdeaContextMarkdown(project, links, bankMap, ideaChat, chatMessages, options);

  try {
    if (Clipboard?.setStringAsync) {
      await Clipboard.setStringAsync(md);
      return true;
    }
  } catch {}

  // Fallback for Web browser clipboard API
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(md);
      return true;
    } catch {}
  }

  return false;
}

/**
 * Downloads the compiled markdown context as a .md file directly.
 */
export async function downloadIdeaAsMarkdown(
  project: Project,
  links: ProjectInspirationLink[],
  bankMap: Record<string, InspirationItem>,
  ideaChat?: ChatSession | null,
  chatMessages: ChatMessage[] = [],
  options?: ExportIdeaOptions
): Promise<boolean> {
  const md = generateIdeaContextMarkdown(project, links, bankMap, ideaChat, chatMessages, options);
  const cleanTitle = (project.title || 'idea')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const fileName = `${cleanTitle || 'idea'}-context.md`;

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    try {
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return true;
    } catch {
      return false;
    }
  }

  // Native: fallback to sharing
  try {
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await copyIdeaAsMarkdown(project, links, bankMap, ideaChat, chatMessages, options);
      Alert.alert('Markdown Copied', 'Markdown context copied to clipboard.');
      return true;
    }
  } catch {}

  return false;
}

/**
 * Exports the idea as a PDF.
 * On Web, isolates the markdown document in a hidden iframe and invokes print,
 * ensuring only the markdown document is printed and NEVER the app screen or UI.
 * On Native (iOS/Android), generates the PDF file and opens the native Share Sheet.
 */
export async function exportIdeaAsPDF(
  project: Project,
  links: ProjectInspirationLink[],
  bankMap: Record<string, InspirationItem>,
  ideaChat?: ChatSession | null,
  chatMessages: ChatMessage[] = [],
  options?: ExportIdeaOptions
): Promise<void> {
  const html = generateIdeaHTML(project, links, bankMap, ideaChat, chatMessages, options);

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    // Isolate document in a rendered, off-screen iframe so ONLY the document prints (never the app screen)
    const iframe = document.createElement('iframe');
    iframe.id = 'rut-pdf-isolated-iframe';
    iframe.style.position = 'fixed';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = '1000px';
    iframe.style.height = '1000px';
    iframe.style.border = 'none';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);

    const frameDoc = iframe.contentWindow?.document;
    if (frameDoc) {
      frameDoc.open();
      frameDoc.write(html);
      frameDoc.close();

      // Give browser time to parse CSS and layout HTML
      await new Promise((resolve) => setTimeout(resolve, 350));

      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.warn('Iframe print failed, falling back to dedicated print window:', err);
        const printWin = window.open('', '_blank');
        if (printWin) {
          printWin.document.open();
          printWin.document.write(html);
          printWin.document.close();
          printWin.focus();
          printWin.print();
        }
      } finally {
        setTimeout(() => {
          try {
            document.body.removeChild(iframe);
          } catch {}
        }, 5000);
      }
    }
    return;
  }

  // Native: generate file and trigger share sheet
  const { uri } = await Print.printToFileAsync({ html });
  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(uri, {
      UTI: '.pdf',
      mimeType: 'application/pdf',
      dialogTitle: `Export ${project.title} as PDF`,
    });
  } else {
    Alert.alert('PDF Generated', `File saved to: ${uri}`);
  }
}

/**
 * Exports the idea as a Word (.doc) document.
 * On Web, downloads a formatted HTML .doc file directly.
 * On Native, creates/shares a file or copies doc content.
 */
export async function exportIdeaAsDoc(
  project: Project,
  links: ProjectInspirationLink[],
  bankMap: Record<string, InspirationItem>,
  ideaChat?: ChatSession | null,
  chatMessages: ChatMessage[] = [],
  options?: ExportIdeaOptions
): Promise<void> {
  const html = generateIdeaHTML(project, links, bankMap, ideaChat, chatMessages, options);
  const cleanTitle = (project.title || 'idea')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const fileName = `${cleanTitle || 'idea'}-context.doc`;

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const blob = new Blob(['\ufeff' + html], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }

  // Native: generate HTML file with .doc extension and share
  try {
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        dialogTitle: `Export ${project.title} as Document`,
      });
    }
  } catch (err: any) {
    Alert.alert('Notice', 'Document export could not be shared on this device.');
  }
}
