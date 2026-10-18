import { Platform, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Project, ProjectInspirationLink, InspirationItem, ChatMessage, ChatSession } from '../../types';

/**
 * Generates structured context Markdown for a project/idea.
 * Perfect for feeding into LLMs, sharing with team members, or archiving.
 */
export function generateIdeaContextMarkdown(
  project: Project,
  links: ProjectInspirationLink[],
  bankMap: Record<string, InspirationItem>,
  ideaChat?: ChatSession | null,
  chatMessages: ChatMessage[] = []
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

  // 4. Train of Thought Stream
  parts.push(`## 4. TRAIN OF THOUGHT (${chatMessages.length} INSIGHTS)`);
  parts.push('');
  if (chatMessages.length === 0) {
    parts.push('_No brainstorm thoughts recorded for this idea yet._');
    parts.push('');
  } else {
    chatMessages.forEach((msg) => {
      const isUser = msg.role === 'user';
      const roleTitle = isUser ? 'YOU' : `RUT (${msg.model ? msg.model.replace('gemini-', '').toUpperCase() : 'AI'})`;
      const timeStr = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      parts.push(`#### [${timeStr}] ${roleTitle}`);
      parts.push('');
      parts.push(msg.content);
      parts.push('');
      if (msg.sourceInspirationIds && msg.sourceInspirationIds.length > 0) {
        const citedTitles = msg.sourceInspirationIds
          .map((sid) => bankMap[sid]?.title || `Ref [${sid.slice(-4)}]`)
          .join(', ');
        parts.push(`> _Cited References: ${citedTitles}_`);
        parts.push('');
      }
    });
  }

  parts.push('---');
  parts.push('_Exported from rut — Visual Research & Brainstorm Studio_');

  return parts.join('\n');
}

/**
 * Generates an editorial HTML representation of the idea for PDF print and Word (.doc).
 */
export function generateIdeaHTML(
  project: Project,
  links: ProjectInspirationLink[],
  bankMap: Record<string, InspirationItem>,
  ideaChat?: ChatSession | null,
  chatMessages: ChatMessage[] = []
): string {
  const attachedItems = links
    .map((l) => bankMap[l.inspirationId])
    .filter(Boolean) as InspirationItem[];

  const escapeHtml = (text: string) =>
    text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const briefHtml = project.brief
    ? `<p>${escapeHtml(project.brief).replace(/\n/g, '<br/>')}</p>`
    : '<p><em>No concept brief provided.</em></p>';

  const notesHtml = project.notes
    ? `<p>${escapeHtml(project.notes).replace(/\n/g, '<br/>')}</p>`
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
                ${item.url ? `<span> • <a href="${escapeHtml(item.url)}">${escapeHtml(item.url)}</a></span>` : ''}
              </div>
              ${reason ? `<div class="ref-reason">💡 ${escapeHtml(reason)}</div>` : ''}
              ${item.tags && item.tags.length > 0 ? `<div class="ref-tags">${item.tags.map((t) => `#${escapeHtml(t)}`).join(' ')}</div>` : ''}
            </div>
          `;
          })
          .join('');

  const chatHtml =
    chatMessages.length === 0
      ? '<p><em>No train of thought thoughts recorded.</em></p>'
      : chatMessages
          .map((msg) => {
            const isUser = msg.role === 'user';
            const role = isUser ? 'YOU' : `RUT (${escapeHtml(msg.model ? msg.model.replace('gemini-', '').toUpperCase() : 'AI')})`;
            const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `
            <div class="chat-bubble ${isUser ? 'chat-user' : 'chat-assistant'}">
              <div class="chat-meta">
                <span class="chat-role">${role}</span>
                <span class="chat-time">${time}</span>
              </div>
              <div class="chat-content">${escapeHtml(msg.content).replace(/\n/g, '<br/>')}</div>
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
    @page { margin: 20mm; size: auto; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #111111;
      background: #FFFFFF;
      line-height: 1.6;
      font-size: 11pt;
      margin: 0;
      padding: 24px;
      max-width: 780px;
      margin-left: auto;
      margin-right: auto;
    }
    h1 {
      font-size: 24pt;
      font-weight: 800;
      letter-spacing: -0.5px;
      text-transform: uppercase;
      margin-bottom: 8px;
      border-bottom: 2px solid #111111;
      padding-bottom: 8px;
    }
    .header-badges {
      font-size: 9pt;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: #555555;
      text-transform: uppercase;
      margin-bottom: 24px;
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
      font-size: 12pt;
      font-weight: 800;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      margin-top: 28px;
      margin-bottom: 10px;
      border-bottom: 1px solid #E0E0E0;
      padding-bottom: 4px;
    }
    p { margin: 6px 0; }
    .card {
      border: 1px solid #E0E0E0;
      background: #FAFAFA;
      padding: 14px 18px;
      margin-bottom: 16px;
    }
    .ref-card {
      border: 1px solid #DDDDDD;
      background: #FDFDFD;
      padding: 10px 14px;
      margin-bottom: 10px;
      page-break-inside: avoid;
    }
    .ref-title { font-weight: 700; font-size: 11pt; margin-bottom: 2px; }
    .ref-meta { font-size: 9pt; color: #666666; margin-bottom: 4px; }
    .ref-reason { font-size: 9.5pt; color: #333333; margin-top: 4px; }
    .ref-tags { font-size: 8.5pt; color: #888888; margin-top: 4px; }
    .chat-bubble {
      padding: 10px 14px;
      margin-bottom: 10px;
      border: 1px solid #EEEEEE;
      page-break-inside: avoid;
    }
    .chat-user {
      background: #111111;
      color: #FFFFFF;
      border-color: #111111;
    }
    .chat-assistant {
      background: #F9F9F9;
      border-left: 3px solid #111111;
    }
    .chat-meta {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      font-size: 8pt;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .chat-user .chat-meta { color: #CCCCCC; }
    .chat-assistant .chat-meta { color: #666666; }
    .chat-content { font-size: 10pt; line-height: 1.5; }
    footer {
      margin-top: 40px;
      padding-top: 12px;
      border-top: 1px solid #E0E0E0;
      font-size: 8.5pt;
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

  ${(project.thesisStatement || ideaChat?.thesisStatement) ? `
    <div style="border-left: 3px solid #111111; padding: 10px 14px; background: #F8F8F8; margin-bottom: 20px; font-style: italic;">
      <strong>THESIS:</strong> ${escapeHtml(project.thesisStatement || ideaChat?.thesisStatement || '')}
    </div>
  ` : ''}

  <h2>1. Concept Brief</h2>
  <div class="card">
    ${briefHtml}
  </div>

  <h2>2. Notes &amp; Specifications</h2>
  <div class="card">
    ${notesHtml}
  </div>

  <h2>3. Attached References (${attachedItems.length})</h2>
  ${referencesHtml}

  <h2>4. Train of Thought Stream (${chatMessages.length})</h2>
  ${chatHtml}

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
  chatMessages: ChatMessage[] = []
): Promise<boolean> {
  const md = generateIdeaContextMarkdown(project, links, bankMap, ideaChat, chatMessages);

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
  chatMessages: ChatMessage[] = []
): Promise<boolean> {
  const md = generateIdeaContextMarkdown(project, links, bankMap, ideaChat, chatMessages);
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
      await copyIdeaAsMarkdown(project, links, bankMap, ideaChat, chatMessages);
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
  chatMessages: ChatMessage[] = []
): Promise<void> {
  const html = generateIdeaHTML(project, links, bankMap, ideaChat, chatMessages);

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
  chatMessages: ChatMessage[] = []
): Promise<void> {
  const html = generateIdeaHTML(project, links, bankMap, ideaChat, chatMessages);
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
