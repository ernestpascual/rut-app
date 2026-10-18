import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { useTheme } from '../../design/ThemeContext';
import { typography, spacing, rounded } from '../../design/tokens';
import { Badge } from '../ui/Badge';

export const FRIEND_AVATARS: Record<string, any> = {
  kenji: require('../../../assets/images/friends/kenji.jpg'),
  tala: require('../../../assets/images/friends/tala.jpg'),
  ingrid: require('../../../assets/images/friends/ingrid.jpg'),
  tariq: require('../../../assets/images/friends/tariq.jpg'),
  priya: require('../../../assets/images/friends/priya.jpg'),
  mateo: require('../../../assets/images/friends/mateo.jpg'),
};

export interface MacroPromptItem {
  id: string;
  name: string;
  shortLabel: string;
  subtitle: string;
  icon: string;
  color: string;
  prompt: string;
  webAccess?: boolean;
}

export interface FriendPersonaItem {
  id: string;
  name: string;
  role: string;
  subtitle: string;
  icon: string;
  color: string;
  instruction: string;
}

export const MACRO_PROMPTS: MacroPromptItem[] = [
  {
    id: 'occams_razor',
    name: "Occam's Razor",
    shortLabel: 'OCCAM',
    subtitle: 'SIMPLEST WAY',
    icon: '🪒',
    color: '#0057FF',
    prompt:
      "Apply Occam's Razor to our current discussion: What is the absolute simplest, most direct, and unbloated way to accomplish what we are discussing? Strip away all unneeded complexity, extra steps, and over-engineering.",
  },
  {
    id: 'pareto',
    name: 'Pareto (80/20)',
    shortLabel: 'PARETO',
    subtitle: '80% BENEFIT',
    icon: '⚖️',
    color: '#10B981',
    prompt:
      'Apply the Pareto Principle (80/20 Rule) to our current discussion: What is the vital 20% of effort, features, or core decisions that will yield 80% of the total benefit and impact? What can we safely de-prioritize or omit for now?',
  },
  {
    id: 'cost_estimate',
    name: 'Cost Estimate',
    shortLabel: 'COST',
    subtitle: 'BUDGET EST.',
    icon: '💰',
    color: '#F59E0B',
    prompt:
      'Determine all the cost components of what we are discussing and provide a quick summarized cost estimate. Break down infrastructure, APIs/token costs, operational tooling, and human effort/time, with realistic rough figures.',
  },
  {
    id: 'similar_ideas',
    name: 'Similar Ideas',
    shortLabel: 'SIMILAR',
    subtitle: 'FIND SIMILAR IDEAS',
    icon: '🌐',
    color: '#8B5CF6',
    webAccess: true,
    prompt:
      'Check the internet for any similar implementations, existing products, open-source projects, or creative benchmarks of the ideas and thoughts we are formulating in this discussion. Summarize existing players and explain how our concept compares or differs.',
  },
];

export const FRIEND_PERSONAS: FriendPersonaItem[] = [
  {
    id: 'kenji',
    name: 'Kenji',
    role: 'DATA & FACTS',
    subtitle: 'Objective Truth',
    icon: '📊',
    color: '#0EA5E9',
    instruction:
      'You are Kenji. You focus purely on verifiable data, neutral facts, and missing information. Never express feelings or make value judgments; present numbers, cite what is known versus unknown, and remain objective.',
  },
  {
    id: 'tala',
    name: 'Tala',
    role: 'GUT & WARMTH',
    subtitle: 'Emotional Honesty',
    icon: '❤️',
    color: '#F43F5E',
    instruction:
      "You are Tala. You lead with genuine warmth, gut instinct, and raw emotional honesty. Never waste time over-rationalizing your reactions with data; express your immediate kutob (hunches), heartfelt feelings, and how decisions will truly impact people's spirits.",
  },
  {
    id: 'ingrid',
    name: 'Ingrid',
    role: 'REALIST & RISKS',
    subtitle: 'Downside Hunter',
    icon: '🛡️',
    color: '#E11D48',
    instruction:
      'You are Ingrid. You are the realist who spots flaws, legal hazards, and potential downsides. Point out critical risks, vulnerabilities, and worst-case scenarios logically and constructively to prevent failure.',
  },
  {
    id: 'tariq',
    name: 'Tariq',
    role: 'OPTIMISM & UPSIDE',
    subtitle: 'Value Creation',
    icon: '🚀',
    color: '#10B981',
    instruction:
      'You are Tariq. You embody grounded optimism, value creation, and best-case potential. Highlight the distinct benefits, practical feasibility, and long-term upside in every concept, backing up your enthusiasm with clear reasons.',
  },
  {
    id: 'priya',
    name: 'Priya',
    role: 'LATERAL & WHAT-IF',
    subtitle: 'Disruptive Spark',
    icon: '💡',
    color: '#A855F7',
    instruction:
      'You are Priya. You generate lateral, unexpected ideas, disruptive alternatives, and provocative "what-ifs." Ignore feasibility constraints initially; focus on breaking standard assumptions and sparking original possibilities.',
  },
  {
    id: 'mateo',
    name: 'Mateo',
    role: 'STRUCTURE & FOCUS',
    subtitle: 'Synthesizer',
    icon: '🧭',
    color: '#D97706',
    instruction:
      'You are Mateo. You manage the structure, summarize viewpoints, and keep conversations on track. Synthesize what others say, enforce focus, define next steps, and ensure all perspectives are balanced.',
  },
];

export interface MacroPromptsDeckProps {
  onSelectPrompt: (prompt: string, options?: { webAccess?: boolean }) => void;
  disabled?: boolean;
}

export function MacroPromptsDeck({ onSelectPrompt, disabled = false }: MacroPromptsDeckProps) {
  const { colors } = useTheme();
  const [showMacros, setShowMacros] = useState(false);
  const [showFriends, setShowFriends] = useState(false);

  const handleMacroPress = (item: MacroPromptItem) => {
    if (disabled) return;
    onSelectPrompt(item.prompt, { webAccess: item.webAccess });
  };

  const handleFriendPress = (item: FriendPersonaItem) => {
    if (disabled) return;
    const personaPrompt = `[Friend Persona: ${item.name}]\n${item.instruction}\n\nBased on our current discussion, give me your short, direct insight and perspective.`;
    onSelectPrompt(personaPrompt);
  };

  return (
    <View style={styles.container}>
      {/* 1. MACRO PROMPTS (COLLAPSIBLE) */}
      <View style={styles.collapsibleWrapper}>
        <Pressable
          style={[
            styles.toggleHeader,
            {
              backgroundColor: showMacros ? colors.surfaceGrade : colors.canvas,
              borderColor: colors.hairlineGrade,
            },
          ]}
          onPress={() => setShowMacros((prev) => !prev)}
          accessibilityRole="button"
          accessibilityLabel="Toggle Macro Prompts"
        >
          <View style={styles.toggleTitleRow}>
            <Text style={styles.toggleEmoji}>⚡</Text>
            <Text style={[styles.toggleLabel, { color: colors.ink }]}>MACRO PROMPTS</Text>
            <Badge label="4 KEYS" variant="grade" style={{ marginLeft: 6 }} />
          </View>
          <Text style={[styles.chevronText, { color: colors.inkSoft }]}>
            {showMacros ? '▲ COLLAPSE' : '▼ EXPAND'}
          </Text>
        </Pressable>

        {showMacros && (
          <View style={[styles.deckGridRow, { borderColor: colors.hairlineGrade }]}>
            {MACRO_PROMPTS.map((m) => (
              <Pressable
                key={m.id}
                onPress={() => handleMacroPress(m)}
                disabled={disabled}
                style={({ pressed }) => [
                  styles.streamDeckKey,
                  {
                    backgroundColor: colors.surfaceGrade,
                    borderColor: colors.hairlineGrade,
                    opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Macro Prompt: ${m.name}`}
              >
                {/* Accent LED top indicator */}
                <View style={[styles.keyLed, { backgroundColor: m.color }]} />
                <Text style={styles.keyIcon}>{m.icon}</Text>
                <Text style={[styles.keyLabel, { color: colors.ink }]} numberOfLines={1}>
                  {m.shortLabel}
                </Text>
                <Text style={[styles.keySubtitle, { color: colors.inkSoft }]} numberOfLines={1}>
                  {m.subtitle}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* 2. ASK A FRIEND (COLLAPSIBLE) */}
      <View style={[styles.collapsibleWrapper, { marginTop: spacing.xxs }]}>
        <Pressable
          style={[
            styles.toggleHeader,
            {
              backgroundColor: showFriends ? colors.surfaceGrade : colors.canvas,
              borderColor: colors.hairlineGrade,
            },
          ]}
          onPress={() => setShowFriends((prev) => !prev)}
          accessibilityRole="button"
          accessibilityLabel="Toggle Ask a Friend"
        >
          <View style={styles.toggleTitleRow}>
            <Text style={styles.toggleEmoji}>👥</Text>
            <Text style={[styles.toggleLabel, { color: colors.ink }]}>ASK A FRIEND</Text>
            <Badge label="6 PERSONAS" variant="grade" style={{ marginLeft: 6 }} />
          </View>
          <Text style={[styles.chevronText, { color: colors.inkSoft }]}>
            {showFriends ? '▲ COLLAPSE' : '▼ EXPAND'}
          </Text>
        </Pressable>

        {showFriends && (
          <View style={[styles.friendsGridContainer, { borderColor: colors.hairlineGrade }]}>
            {FRIEND_PERSONAS.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => handleFriendPress(f)}
                disabled={disabled}
                style={({ pressed }) => [
                  styles.friendDeckKey,
                  {
                    backgroundColor: colors.surfaceGrade,
                    borderColor: colors.hairlineGrade,
                    opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Friend Persona: ${f.name} - ${f.role}`}
              >
                {/* Full Background Portrait Image */}
                {FRIEND_AVATARS[f.id] ? (
                  <Image
                    source={FRIEND_AVATARS[f.id]}
                    style={styles.friendKeyImage}
                    resizeMode="cover"
                  />
                ) : null}

                {/* Dark Contrast Scrim Overlay for Legibility */}
                <View style={styles.friendKeyScrim} />

                {/* Accent LED Top Indicator */}
                <View style={[styles.keyLed, { backgroundColor: f.color }]} />

                {/* Bottom Label Content */}
                <View style={styles.friendKeyBottomContent}>
                  <Text style={styles.friendKeyName} numberOfLines={1}>
                    {f.name.toUpperCase()}
                  </Text>
                  <Text style={styles.friendKeyRole} numberOfLines={1}>
                    {f.role}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xxs,
    paddingBottom: spacing.xxs,
  },
  collapsibleWrapper: {
    width: '100%',
  },
  toggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    borderWidth: 1,
    borderRadius: rounded.none,
  },
  toggleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleEmoji: {
    fontSize: 13,
    marginRight: 6,
  },
  toggleLabel: {
    ...typography.captionCap,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  chevronText: {
    ...typography.captionCap,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  deckGridRow: {
    flexDirection: 'row',
    gap: 6,
    padding: 6,
    borderWidth: 1,
    borderTopWidth: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  streamDeckKey: {
    flex: 1,
    aspectRatio: 1,
    borderWidth: 1.5,
    borderRadius: rounded.none,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  friendsGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    padding: 6,
    borderWidth: 1,
    borderTopWidth: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  friendDeckKey: {
    width: '31.8%',
    aspectRatio: 1,
    borderWidth: 1.5,
    borderRadius: rounded.none,
    justifyContent: 'flex-end',
    position: 'relative',
    overflow: 'hidden',
  },
  friendKeyImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    zIndex: 0,
  },
  friendKeyScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '48%',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    zIndex: 1,
  },
  friendKeyBottomContent: {
    paddingHorizontal: 4,
    paddingBottom: 6,
    alignItems: 'center',
    width: '100%',
    zIndex: 2,
  },
  friendKeyName: {
    ...typography.captionCap,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  friendKeyRole: {
    fontSize: 7.5,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  keyLed: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3.5,
    zIndex: 3,
  },
  keyIcon: {
    fontSize: 20,
    marginBottom: 3,
  },
  keyLabel: {
    ...typography.captionCap,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  keySubtitle: {
    fontSize: 7.5,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
    marginTop: 1,
  },
});
