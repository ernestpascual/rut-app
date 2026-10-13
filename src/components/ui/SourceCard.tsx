import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { rounded, typography, spacing } from '../../design/tokens';
import { useTheme } from '../../design/ThemeContext';

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
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: pressed ? colors.canvas : colors.surfaceGrade,
          borderColor: colors.hairline,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`View source inspiration: ${title}`}
    >
      <View style={styles.headerRow}>
        <View style={[styles.pillTag, { backgroundColor: colors.ink }]}>
          <Text style={[styles.pillText, { color: colors.onInk }]}>
            {platform ? platform.toUpperCase() : 'SOURCE'}
          </Text>
        </View>
        {domain ? (
          <Text style={[styles.domainText, { color: colors.inkSoft }]}>{domain}</Text>
        ) : null}
      </View>
      <Text style={[styles.titleText, { color: colors.ink }]} numberOfLines={1}>
        {title}
      </Text>
      {snippet ? (
        <Text style={[styles.snippetText, { color: colors.inkSoft }]} numberOfLines={2}>
          {snippet}
        </Text>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: rounded.none, // 0px
    padding: spacing.xs,
    marginVertical: spacing.xxs,
    marginRight: spacing.xs,
    minWidth: 200,
    maxWidth: 280,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xxs,
  },
  pillTag: {
    borderRadius: rounded.none,
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginRight: spacing.xs,
  },
  pillText: {
    ...typography.captionCap,
    fontSize: 9,
    lineHeight: 12,
  },
  domainText: {
    ...typography.captionSm,
    fontSize: 11,
  },
  titleText: {
    ...typography.captionMd,
    fontWeight: '600',
  },
  snippetText: {
    ...typography.captionSm,
    marginTop: 2,
    fontSize: 11,
    lineHeight: 15,
  },
});
