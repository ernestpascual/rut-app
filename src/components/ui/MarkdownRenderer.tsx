import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { typography, spacing, rounded } from '../../design/tokens';
import { useTheme } from '../../design/ThemeContext';

interface MarkdownRendererProps {
  content: string;
  isUser?: boolean;
}

interface Block {
  type: 'h1' | 'h2' | 'h3' | 'blockquote' | 'codeblock' | 'ul' | 'ol' | 'paragraph';
  content: string;
  orderNumber?: string;
}

/**
 * Parses raw markdown text into structural blocks (headers, code blocks, lists, quotes, paragraphs).
 */
function parseBlocks(raw: string): Block[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeBlockLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block open/close
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        blocks.push({
          type: 'codeblock',
          content: codeBlockLines.join('\n'),
        });
        codeBlockLines = [];
        inCodeBlock = false;
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
    if (!trimmed) {
      continue;
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      blocks.push({ type: 'h3', content: trimmed.slice(4).trim() });
    } else if (trimmed.startsWith('## ')) {
      blocks.push({ type: 'h2', content: trimmed.slice(3).trim() });
    } else if (trimmed.startsWith('# ')) {
      blocks.push({ type: 'h1', content: trimmed.slice(2).trim() });
    }
    // Blockquote
    else if (trimmed.startsWith('> ')) {
      blocks.push({ type: 'blockquote', content: trimmed.slice(2).trim() });
    }
    // Unordered list
    else if (
      trimmed.startsWith('• ') ||
      trimmed.startsWith('- ') ||
      trimmed.startsWith('* ')
    ) {
      blocks.push({
        type: 'ul',
        content: trimmed.replace(/^([•\-*]\s+)/, '').trim(),
      });
    }
    // Ordered list
    else if (/^\d+\.\s+/.test(trimmed)) {
      const match = trimmed.match(/^(\d+)\.\s+(.*)/);
      blocks.push({
        type: 'ol',
        orderNumber: match ? match[1] : '1',
        content: match ? match[2] : trimmed,
      });
    }
    // Standard paragraph
    else {
      blocks.push({ type: 'paragraph', content: trimmed });
    }
  }

  // Handle unclosed code block if any
  if (inCodeBlock && codeBlockLines.length > 0) {
    blocks.push({
      type: 'codeblock',
      content: codeBlockLines.join('\n'),
    });
  }

  return blocks;
}

/**
 * Renders inline markdown: **bold**, *italic*, `code`, and [ID: ...] source citations.
 */
function renderInlineFormatted(
  text: string,
  baseStyle: any,
  textColor: string,
  secondaryColor: string,
  isUser: boolean
): React.ReactNode {
  // Regex pattern for **bold**, *italic*, `inline code`, and [ID: ...]
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[ID:\s*[^\]]+\])/g;
  const parts = text.split(regex);

  return parts.map((part, idx) => {
    if (!part) return null;

    // Bold: **text**
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <Text key={`b-${idx}`} style={[baseStyle, { fontWeight: '700' }]}>
          {part.slice(2, -2)}
        </Text>
      );
    }

    // Italic: *text*
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return (
        <Text key={`i-${idx}`} style={[baseStyle, { fontStyle: 'italic' }]}>
          {part.slice(1, -1)}
        </Text>
      );
    }

    // Inline Code: `code`
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <Text
          key={`c-${idx}`}
          style={[
            baseStyle,
            {
              fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
              fontSize: (baseStyle.fontSize || 14) * 0.9,
              backgroundColor: isUser ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.06)',
              paddingHorizontal: 4,
            },
          ]}
        >
          {part.slice(1, -1)}
        </Text>
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
              fontSize: 11,
              fontWeight: '700',
              color: isUser ? '#ffffff' : secondaryColor,
              letterSpacing: 0.5,
            },
          ]}
        >
          {part}
        </Text>
      );
    }

    // Plain text chunk
    return (
      <Text key={`t-${idx}`} style={baseStyle}>
        {part}
      </Text>
    );
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
    lineHeight: 22,
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
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  blockquoteContainer: {
    borderLeftWidth: 3,
    paddingLeft: spacing.sm,
    paddingVertical: spacing.xxs,
    marginBottom: spacing.xs,
  },
  codeblockContainer: {
    borderWidth: 1,
    padding: spacing.sm,
    borderRadius: rounded.none,
    marginBottom: spacing.xs,
  },
  codeblockText: {
    fontSize: 12,
    lineHeight: 18,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    paddingLeft: 4,
  },
  bulletPoint: {
    fontSize: 16,
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
});
