import React from 'react';
import { View, Text, StyleSheet, Platform, ScrollView, Linking } from 'react-native';
import { typography, spacing, rounded } from '../../design/tokens';
import { useTheme } from '../../design/ThemeContext';

export interface MarkdownRendererProps {
  content: string;
  isUser?: boolean;
}

export interface Block {
  type: 'h1' | 'h2' | 'h3' | 'h4' | 'blockquote' | 'codeblock' | 'ul' | 'ol' | 'paragraph' | 'table' | 'hr';
  content: string;
  lang?: string;
  orderNumber?: string;
  tableHeaders?: string[];
  tableRows?: string[][];
}

/**
 * Parses raw markdown text into structural blocks (headers, code blocks, lists, quotes, paragraphs).
 */
export function parseBlocks(raw: string): Block[] {
  if (!raw) return [];
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeBlockLines: string[] = [];
  let paragraphLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length > 0) {
      blocks.push({
        type: 'paragraph',
        content: paragraphLines.join(' ').trim(),
      });
      paragraphLines = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block open/close
    if (line.trim().startsWith('```')) {
      flushParagraph();
      if (inCodeBlock) {
        blocks.push({
          type: 'codeblock',
          lang: codeBlockLang,
          content: codeBlockLines.join('\n'),
        });
        codeBlockLines = [];
        inCodeBlock = false;
        codeBlockLang = '';
      } else {
        inCodeBlock = true;
        codeBlockLang = line.trim().slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    const trimmed = line.trim();

    // Blank line -> separates paragraphs
    if (!trimmed) {
      flushParagraph();
      continue;
    }

    // Horizontal Rule: ---, ***, ___ (at least 3 characters)
    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushParagraph();
      blocks.push({ type: 'hr', content: '' });
      continue;
    }

    // Headings
    if (trimmed.startsWith('#### ')) {
      flushParagraph();
      blocks.push({ type: 'h4', content: trimmed.slice(5).trim() });
      continue;
    }
    if (trimmed.startsWith('### ')) {
      flushParagraph();
      blocks.push({ type: 'h3', content: trimmed.slice(4).trim() });
      continue;
    }
    if (trimmed.startsWith('## ')) {
      flushParagraph();
      blocks.push({ type: 'h2', content: trimmed.slice(3).trim() });
      continue;
    }
    if (trimmed.startsWith('# ')) {
      flushParagraph();
      blocks.push({ type: 'h1', content: trimmed.slice(2).trim() });
      continue;
    }

    // Blockquote (> )
    if (trimmed.startsWith('> ') || trimmed === '>') {
      flushParagraph();
      const quoteText = trimmed.startsWith('> ') ? trimmed.slice(2).trim() : '';
      if (blocks.length > 0 && blocks[blocks.length - 1].type === 'blockquote') {
        blocks[blocks.length - 1].content += `\n${quoteText}`;
      } else {
        blocks.push({ type: 'blockquote', content: quoteText });
      }
      continue;
    }

    // Unordered list item (- item, * item, • item)
    if (/^[•\-*]\s+/.test(trimmed)) {
      flushParagraph();
      blocks.push({
        type: 'ul',
        content: trimmed.replace(/^[•\-*]\s+/, '').trim(),
      });
      continue;
    }

    // Ordered list item (1. item)
    if (/^\d+\.\s+/.test(trimmed)) {
      flushParagraph();
      const match = trimmed.match(/^(\d+)\.\s+(.*)/);
      blocks.push({
        type: 'ol',
        orderNumber: match ? match[1] : '1',
        content: match ? match[2].trim() : trimmed,
      });
      continue;
    }

    // Markdown Table check
    if (
      trimmed.startsWith('|') &&
      trimmed.endsWith('|') &&
      i + 1 < lines.length &&
      /^[|\s-:]+$/.test(lines[i + 1].trim())
    ) {
      flushParagraph();
      const headers = trimmed
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());
      i++; // advance past delimiter row
      const tableRows: string[][] = [];
      while (
        i + 1 < lines.length &&
        lines[i + 1].trim().startsWith('|') &&
        lines[i + 1].trim().endsWith('|')
      ) {
        i++;
        const rowCells = lines[i]
          .trim()
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());
        tableRows.push(rowCells);
      }
      blocks.push({
        type: 'table',
        content: '',
        tableHeaders: headers,
        tableRows,
      });
      continue;
    }

    // Standard paragraph line (join consecutive lines into one paragraph)
    paragraphLines.push(trimmed);
  }

  flushParagraph();

  // Handle unclosed code block if any
  if (inCodeBlock && codeBlockLines.length > 0) {
    blocks.push({
      type: 'codeblock',
      lang: codeBlockLang,
      content: codeBlockLines.join('\n'),
    });
  }

  return blocks;
}

/**
 * Universally safe regex for inline formatting (bold, italic, code, links, citations, strikethrough).
 * Note: Tested in order of specificity to avoid lookbehinds.
 */
const INLINE_REGEX = /(\[ID:\s*[^\]]+\]|\[[^\]]+\]\([^\)]+\)|`[^`]+`|\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|~~[^~]+~~)/g;

/**
 * Renders text containing hex colors (#RGB, #RRGGBB, #RRGGBBAA) with a miniature color preview square.
 */
export function renderTextWithHexColors(
  content: string,
  style: any,
  keyPrefix: string
): React.ReactNode {
  if (!content) return null;

  // Fast path: if no '#' is present, return single Text node
  if (!content.includes('#')) {
    return (
      <Text key={keyPrefix} style={style}>
        {content}
      </Text>
    );
  }

  // Matches #RGB, #RRGGBB, #RRGGBBAA where # is preceded by start of string or non-word/non-& character
  // and followed by a non-hex character
  const regex = /(^|[^\w&])(#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3}))(?![0-9a-fA-F])/g;
  let match: RegExpExecArray | null = null;
  let lastIndex = 0;
  let matchCount = 0;
  const elements: React.ReactNode[] = [];

  while ((match = regex.exec(content)) !== null) {
    const fullMatch = match[0];
    const prefix = match[1];
    const hex = match[2];
    const matchIndex = match.index;

    const textBefore = content.substring(lastIndex, matchIndex) + prefix;
    if (textBefore) {
      elements.push(
        <Text key={`${keyPrefix}-tb-${matchCount}`} style={style}>
          {textBefore}
        </Text>
      );
    }

    elements.push(
      <View
        key={`${keyPrefix}-swatch-${matchCount}`}
        style={[styles.colorSwatchSquare, { backgroundColor: hex }]}
        accessibilityRole="image"
        accessibilityLabel={`Color preview: ${hex}`}
      />
    );

    elements.push(
      <Text key={`${keyPrefix}-hex-${matchCount}`} style={style}>
        {hex}
      </Text>
    );

    lastIndex = matchIndex + fullMatch.length;
    matchCount++;
  }

  if (matchCount === 0) {
    return (
      <Text key={keyPrefix} style={style}>
        {content}
      </Text>
    );
  }

  const trailingText = content.substring(lastIndex);
  if (trailingText) {
    elements.push(
      <Text key={`${keyPrefix}-tail`} style={style}>
        {trailingText}
      </Text>
    );
  }

  return elements;
}

/**
 * Renders inline markdown tokens: **bold**, *italic*, `code`, [link](url), and [ID: ...] citations.
 */
export function renderInlineFormatted(
  text: string,
  baseStyle: any,
  textColor: string,
  secondaryColor: string,
  isUser: boolean
): React.ReactNode {
  if (!text) return null;
  const parts = text.split(INLINE_REGEX);

  return parts.map((part, idx) => {
    if (!part) return null;

    // Bold Italic: ***text***
    if (part.startsWith('***') && part.endsWith('***') && part.length >= 6) {
      return renderTextWithHexColors(
        part.slice(3, -3),
        [baseStyle, { fontWeight: '700', fontStyle: 'italic' }],
        `bi-${idx}`
      );
    }

    // Bold: **text** or __text__
    if (
      (part.startsWith('**') && part.endsWith('**') && part.length >= 4) ||
      (part.startsWith('__') && part.endsWith('__') && part.length >= 4)
    ) {
      return renderTextWithHexColors(
        part.slice(2, -2),
        [baseStyle, { fontWeight: '700' }],
        `b-${idx}`
      );
    }

    // Italic: *text* or _text_
    if (
      (part.startsWith('*') && part.endsWith('*') && part.length >= 2) ||
      (part.startsWith('_') && part.endsWith('_') && part.length >= 2)
    ) {
      return renderTextWithHexColors(
        part.slice(1, -1),
        [baseStyle, { fontStyle: 'italic' }],
        `i-${idx}`
      );
    }

    // Inline Code: `code`
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return renderTextWithHexColors(
        part.slice(1, -1),
        [
          baseStyle,
          {
            fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
            fontSize: Math.round((baseStyle.fontSize || 14) * 0.92),
            backgroundColor: isUser ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.06)',
            paddingHorizontal: 5,
            paddingVertical: 1,
          },
        ],
        `c-${idx}`
      );
    }

    // Strikethrough: ~~text~~
    if (part.startsWith('~~') && part.endsWith('~~') && part.length >= 4) {
      return renderTextWithHexColors(
        part.slice(2, -2),
        [baseStyle, { textDecorationLine: 'line-through' }],
        `s-${idx}`
      );
    }

    // Source Citation Badge: [ID: item-id]
    if (part.startsWith('[ID:') && part.endsWith(']')) {
      return (
        <Text
          key={`id-${idx}`}
          style={[
            baseStyle,
            {
              fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
              fontSize: 11,
              fontWeight: '700',
              color: isUser ? '#ffffff' : secondaryColor,
              backgroundColor: isUser ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.06)',
              paddingHorizontal: 4,
              letterSpacing: 0.5,
            },
          ]}
        >
          {part}
        </Text>
      );
    }

    // Markdown Link: [label](url)
    if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
      const splitIdx = part.indexOf('](');
      const label = part.slice(1, splitIdx);
      const url = part.slice(splitIdx + 2, -1);
      return (
        <Text
          key={`l-${idx}`}
          style={[
            baseStyle,
            {
              textDecorationLine: 'underline',
              fontWeight: '600',
              color: isUser ? '#ffffff' : textColor,
            },
          ]}
          onPress={() => {
            if (url) {
              Linking.openURL(url).catch((e) => console.warn('Could not open link:', e));
            }
          }}
          accessibilityRole="link"
        >
          {renderTextWithHexColors(
            label,
            [
              baseStyle,
              {
                textDecorationLine: 'underline',
                fontWeight: '600',
                color: isUser ? '#ffffff' : textColor,
              },
            ],
            `l-t-${idx}`
          )}
        </Text>
      );
    }

    // Plain text chunk
    return renderTextWithHexColors(part, baseStyle, `t-${idx}`);
  });
}

/**
 * Premium, typography-accurate Markdown Renderer for React Native and Web.
 */
export function MarkdownRenderer({ content, isUser = false }: MarkdownRendererProps) {
  const { colors } = useTheme();
  const blocks = parseBlocks(content);

  const textColor = isUser ? colors.onInk : colors.ink;
  const secondaryColor = isUser ? colors.onInk : colors.inkSoft;

  const baseTextStyle = {
    ...typography.bodyMd,
    color: textColor,
    lineHeight: 23,
    fontSize: 14,
  };

  return (
    <View style={styles.container}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'h1':
            return (
              <View key={`b-${idx}`} style={styles.h1Container}>
                <Text style={[styles.h1Text, { color: textColor }]}>
                  {renderInlineFormatted(
                    block.content,
                    styles.h1Text,
                    textColor,
                    secondaryColor,
                    isUser
                  )}
                </Text>
              </View>
            );

          case 'h2':
            return (
              <View key={`b-${idx}`} style={styles.h2Container}>
                <Text style={[styles.h2Text, { color: textColor }]}>
                  {renderInlineFormatted(
                    block.content,
                    styles.h2Text,
                    textColor,
                    secondaryColor,
                    isUser
                  )}
                </Text>
              </View>
            );

          case 'h3':
            return (
              <View key={`b-${idx}`} style={styles.h3Container}>
                <Text style={[styles.h3Text, { color: textColor }]}>
                  {renderInlineFormatted(
                    block.content,
                    styles.h3Text,
                    textColor,
                    secondaryColor,
                    isUser
                  )}
                </Text>
              </View>
            );

          case 'h4':
            return (
              <View key={`b-${idx}`} style={styles.h4Container}>
                <Text style={[styles.h4Text, { color: textColor }]}>
                  {renderInlineFormatted(
                    block.content,
                    styles.h4Text,
                    textColor,
                    secondaryColor,
                    isUser
                  )}
                </Text>
              </View>
            );

          case 'blockquote':
            return (
              <View
                key={`b-${idx}`}
                style={[
                  styles.blockquoteContainer,
                  {
                    borderLeftColor: isUser ? colors.onInk : colors.ink,
                    backgroundColor: isUser
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(0,0,0,0.03)',
                  },
                ]}
              >
                <Text style={[baseTextStyle, { fontStyle: 'italic' }]}>
                  {renderInlineFormatted(
                    block.content,
                    { ...baseTextStyle, fontStyle: 'italic' },
                    textColor,
                    secondaryColor,
                    isUser
                  )}
                </Text>
              </View>
            );

          case 'codeblock':
            return (
              <View
                key={`b-${idx}`}
                style={[
                  styles.codeblockContainer,
                  {
                    backgroundColor: isUser
                      ? 'rgba(255,255,255,0.1)'
                      : 'rgba(0,0,0,0.05)',
                    borderColor: isUser ? 'rgba(255,255,255,0.2)' : colors.hairline,
                  },
                ]}
              >
                {block.lang ? (
                  <View
                    style={[
                      styles.codeblockHeader,
                      {
                        borderBottomColor: isUser ? 'rgba(255,255,255,0.15)' : colors.hairline,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.codeblockLangText,
                        { color: secondaryColor },
                      ]}
                    >
                      {block.lang.toUpperCase()}
                    </Text>
                  </View>
                ) : null}
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <Text
                    style={[
                      styles.codeblockText,
                      {
                        color: textColor,
                        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                      },
                    ]}
                    selectable
                  >
                    {block.content}
                  </Text>
                </ScrollView>
              </View>
            );

          case 'ul':
            return (
              <View key={`b-${idx}`} style={styles.listItemRow}>
                <Text style={[styles.bulletPoint, { color: textColor }]}>•</Text>
                <Text style={[styles.listContent, baseTextStyle]}>
                  {renderInlineFormatted(
                    block.content,
                    baseTextStyle,
                    textColor,
                    secondaryColor,
                    isUser
                  )}
                </Text>
              </View>
            );

          case 'ol':
            return (
              <View key={`b-${idx}`} style={styles.listItemRow}>
                <Text style={[styles.orderNumber, { color: secondaryColor }]}>
                  {block.orderNumber}.
                </Text>
                <Text style={[styles.listContent, baseTextStyle]}>
                  {renderInlineFormatted(
                    block.content,
                    baseTextStyle,
                    textColor,
                    secondaryColor,
                    isUser
                  )}
                </Text>
              </View>
            );

          case 'hr':
            return (
              <View
                key={`b-${idx}`}
                style={[
                  styles.hrLine,
                  {
                    backgroundColor: isUser ? 'rgba(255,255,255,0.2)' : colors.gradeDivider,
                  },
                ]}
              />
            );

          case 'table':
            return (
              <ScrollView
                key={`b-${idx}`}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.tableScroll}
              >
                <View
                  style={[
                    styles.tableContainer,
                    { borderColor: isUser ? colors.onInk : colors.hairline },
                  ]}
                >
                  {block.tableHeaders && block.tableHeaders.length > 0 ? (
                    <View
                      style={[
                        styles.tableRow,
                        styles.tableHeaderRow,
                        {
                          backgroundColor: isUser
                            ? 'rgba(255,255,255,0.15)'
                            : colors.surfaceGrade,
                          borderBottomColor: isUser ? colors.onInk : colors.hairline,
                        },
                      ]}
                    >
                      {block.tableHeaders.map((header, hIdx) => (
                        <View key={`th-${hIdx}`} style={styles.tableCell}>
                          <Text style={[styles.tableHeaderText, { color: textColor }]}>
                            {renderInlineFormatted(
                              header,
                              styles.tableHeaderText,
                              textColor,
                              secondaryColor,
                              isUser
                            )}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {block.tableRows?.map((row, rIdx) => (
                    <View
                      key={`tr-${rIdx}`}
                      style={[
                        styles.tableRow,
                        { borderBottomColor: isUser ? 'rgba(255,255,255,0.1)' : colors.hairlineGrade },
                        rIdx === (block.tableRows?.length || 0) - 1
                          ? { borderBottomWidth: 0 }
                          : { borderBottomWidth: 1 },
                      ]}
                    >
                      {row.map((cell, cIdx) => (
                        <View key={`td-${cIdx}`} style={styles.tableCell}>
                          <Text style={[baseTextStyle, { fontSize: 13, lineHeight: 18 }]}>
                            {renderInlineFormatted(
                              cell,
                              baseTextStyle,
                              textColor,
                              secondaryColor,
                              isUser
                            )}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
            );

          case 'paragraph':
          default:
            return (
              <View key={`b-${idx}`} style={styles.paragraphContainer}>
                <Text style={baseTextStyle}>
                  {renderInlineFormatted(
                    block.content,
                    baseTextStyle,
                    textColor,
                    secondaryColor,
                    isUser
                  )}
                </Text>
              </View>
            );
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  paragraphContainer: {
    marginBottom: spacing.xs,
  },
  h1Container: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  h1Text: {
    ...typography.displayMd,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  h2Container: {
    marginTop: spacing.sm,
    marginBottom: spacing.xxs,
  },
  h2Text: {
    ...typography.displayMd,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '700',
  },
  h3Container: {
    marginTop: spacing.xs,
    marginBottom: spacing.xxs,
  },
  h3Text: {
    ...typography.captionCap,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  h4Container: {
    marginTop: spacing.xxs,
    marginBottom: spacing.xxs,
  },
  h4Text: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  hrLine: {
    height: 1,
    marginVertical: spacing.sm,
    width: '100%',
  },
  blockquoteContainer: {
    borderLeftWidth: 3,
    paddingLeft: spacing.sm,
    paddingVertical: spacing.xxs,
    marginBottom: spacing.xs,
  },
  codeblockContainer: {
    borderWidth: 1,
    borderRadius: rounded.none,
    marginBottom: spacing.xs,
    overflow: 'hidden',
  },
  codeblockHeader: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderBottomWidth: 1,
  },
  codeblockLangText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  codeblockText: {
    fontSize: 12,
    lineHeight: 18,
    padding: spacing.sm,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    paddingLeft: 4,
  },
  bulletPoint: {
    fontSize: 14,
    lineHeight: 22,
    marginRight: 8,
    fontWeight: '700',
  },
  orderNumber: {
    fontSize: 13,
    lineHeight: 22,
    marginRight: 8,
    fontWeight: '700',
    minWidth: 16,
  },
  listContent: {
    flex: 1,
  },
  tableScroll: {
    marginVertical: spacing.xs,
    maxWidth: '100%',
  },
  tableContainer: {
    borderWidth: 1,
    minWidth: '100%',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tableHeaderRow: {
    borderBottomWidth: 1.5,
  },
  tableCell: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minWidth: 90,
    justifyContent: 'center',
  },
  tableHeaderText: {
    ...typography.captionCap,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  colorSwatchSquare: {
    width: 11,
    height: 11,
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.45)',
    borderRadius: 1,
    marginRight: 4,
    marginLeft: 2,
    ...(Platform.OS === 'web'
      ? {
          display: 'inline-block' as any,
          verticalAlign: 'middle',
          position: 'relative' as any,
          top: -1,
        }
      : {
          alignSelf: 'center',
        }),
  },
});
