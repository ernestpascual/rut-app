import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, rounded, typography, spacing } from '../../design/tokens';

interface SourceCardProps {
  id: string;
  title: string;
  domain?: string | null;
  platform?: string | null;
  snippet?: string | null;
  onPress: () => void;
}

export const SourceCard: React.FC<SourceCardProps> = ({
  id,
  title,
  domain,
  platform,
  snippet,
  onPress,
}) => {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`View source inspiration: ${title}`}
    >
      <View style={styles.headerRow}>
        <View style={styles.pillTag}>
          <Text style={styles.pillText}>{platform ? platform.toUpperCase() : 'SOURCE'}</Text>
        </View>
        {domain ? <Text style={styles.domainText}>{domain}</Text> : null}
      </View>
      <Text style={styles.titleText} numberOfLines={1}>
        {title}
      </Text>
      {snippet ? (
        <Text style={styles.snippetText} numberOfLines={2}>
          {snippet}
        </Text>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceGrade, // #f4f4f4
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: rounded.none, // 0px
    padding: spacing.xs,
    marginVertical: spacing.xxs,
    marginRight: spacing.xs,
    minWidth: 200,
    maxWidth: 280,
  },
  pressed: {
    backgroundColor: colors.canvas,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xxs,
  },
  pillTag: {
    backgroundColor: colors.ink,
    borderRadius: rounded.none,
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginRight: spacing.xs,
  },
  pillText: {
    ...typography.captionCap,
    color: colors.onInk,
    fontSize: 9,
    lineHeight: 12,
  },
  domainText: {
    ...typography.captionSm,
    color: colors.inkSoft,
    fontSize: 11,
  },
  titleText: {
    ...typography.captionMd,
    color: colors.ink,
    fontWeight: '600',
  },
  snippetText: {
    ...typography.captionSm,
    color: colors.inkSoft,
    marginTop: 2,
    fontSize: 11,
    lineHeight: 15,
  },
});
