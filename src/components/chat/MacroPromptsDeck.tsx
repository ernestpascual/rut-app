import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../design/ThemeContext';
import { typography, spacing, rounded } from '../../design/tokens';

export const FRIEND_AVATARS: Record<string, any> = {
  rei: require('../../../assets/images/friends/rei.jpg'),
  tala: require('../../../assets/images/friends/tala.jpg'),
  linh: require('../../../assets/images/friends/linh.jpg'),
  minji: require('../../../assets/images/friends/minji.jpg'),
  priya: require('../../../assets/images/friends/priya.jpg'),
  kamila: require('../../../assets/images/friends/kamila.jpg'),
  // Backward compatibility aliases
  kenji: require('../../../assets/images/friends/rei.jpg'),
  ingrid: require('../../../assets/images/friends/linh.jpg'),
  tariq: require('../../../assets/images/friends/minji.jpg'),
  mateo: require('../../../assets/images/friends/kamila.jpg'),
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
    icon: 'scissors',
    color: '#0057FF',
    prompt:
      "Apply Occam's Razor to our current discussion: What is the absolute simplest, most direct, and unbloated way to accomplish what we are discussing? Strip away all unneeded complexity, extra steps, and over-engineering.",
  },
  {
    id: 'pareto',
    name: 'Pareto (80/20)',
    shortLabel: 'PARETO',
    subtitle: '80% BENEFIT',
    icon: 'pie-chart',
    color: '#10B981',
    prompt:
      'Apply the Pareto Principle (80/20 Rule) to our current discussion: What is the vital 20% of effort, features, or core decisions that will yield 80% of the total benefit and impact? What can we safely de-prioritize or omit for now?',
  },
  {
    id: 'cost_estimate',
    name: 'Cost Estimate',
    shortLabel: 'COST',
    subtitle: 'BUDGET EST.',
    icon: 'dollar-sign',
    color: '#F59E0B',
    prompt:
      'Determine all the cost components of what we are discussing and provide a quick summarized cost estimate. Break down infrastructure, APIs/token costs, operational tooling, and human effort/time, with realistic rough figures.',
  },
  {
    id: 'similar_ideas',
    name: 'Similar Ideas',
    shortLabel: 'SIMILAR',
    subtitle: 'FIND SIMILAR IDEAS',
    icon: 'globe',
    color: '#8B5CF6',
    webAccess: true,
    prompt:
      'Check the internet for any similar implementations, existing products, open-source projects, or creative benchmarks of the ideas and thoughts we are formulating in this discussion. Summarize existing players and explain how our concept compares or differs.',
  },
];

export const FRIEND_PERSONAS: FriendPersonaItem[] = [
  {
    id: 'rei',
    name: 'Rei',
    role: 'Facts',
    subtitle: 'Objective Truth',
    icon: 'bar-chart-2',
    color: '#0EA5E9',
    instruction:
      'You are Rei. You focus purely on verifiable data, neutral facts, and missing information. Never express feelings or make value judgments; talk conversationally like a knowledgeable friend sharing what is known versus unknown.',
  },
  {
    id: 'tala',
    name: 'Tala',
    role: 'Gut Feel',
    subtitle: 'Emotional Honesty',
    icon: 'heart',
    color: '#F43F5E',
    instruction:
      "You are Tala. You lead with genuine warmth, gut instinct, and raw emotional honesty. Never waste time over-rationalizing your reactions with data; express your immediate kutob (hunches), heartfelt feelings, and how decisions will truly impact people's spirits like a close friend.",
  },
  {
    id: 'linh',
    name: 'Linh',
    role: 'Realist',
    subtitle: 'Downside Hunter',
    icon: 'shield',
    color: '#E11D48',
    instruction:
      'You are Linh. You are the realist who spots flaws, legal hazards, and potential downsides. Point out critical risks, vulnerabilities, and worst-case scenarios conversationally like a pragmatic friend watching my back.',
  },
  {
    id: 'minji',
    name: 'Minji',
    role: 'Optimist',
    subtitle: 'Value Creation',
    icon: 'trending-up',
    color: '#10B981',
    instruction:
      'You are Minji. You embody grounded optimism, value creation, and best-case potential. Highlight the distinct benefits, practical feasibility, and long-term upside in every concept, hyping up the potential like an encouraging friend.',
  },
  {
    id: 'priya',
    name: 'Priya',
    role: 'What Ifs',
    subtitle: 'Disruptive Spark',
    icon: 'compass',
    color: '#A855F7',
    instruction:
      'You are Priya. You generate lateral, unexpected ideas, disruptive alternatives, and provocative "what-ifs." Ignore feasibility constraints initially; focus on breaking standard assumptions and sparking original possibilities like a creative sparring buddy.',
  },
  {
    id: 'kamila',
    name: 'Kamila',
    role: 'Organized',
    subtitle: 'Synthesizer',
    icon: 'target',
    color: '#D97706',
    instruction:
      'You are Kamila. You manage the structure, summarize viewpoints, and keep conversations on track. Synthesize what others say, enforce focus, define next steps, and ensure all perspectives are balanced like a reliable friend keeping us centered.',
  },
];

export interface MacroPromptsDeckProps {
  onSelectPrompt: (prompt: string, options?: { webAccess?: boolean; displayText?: string }) => void;
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
    const personaPrompt = `[Friend Persona: ${item.name} (${item.role})]
${item.instruction}

CONVERSATIONAL FRIEND GUIDELINES:
- Talk casually, directly, and warmly like a real friend chatting one-on-one.
- No corporate jargon, formal introductions, bulleted lists, or robotic greetings.
- STRICT LIMIT: Keep your response short and concise—maximum 2 to 3 sentences (under 60 words total).

Based on what we're discussing, what's your quick take?`;

    onSelectPrompt(personaPrompt, { displayText: `Asking ${item.name}` });
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
            <Feather name="zap" size={13} color={colors.ink} style={styles.toggleIcon} />
            <Text style={[styles.toggleLabel, { color: colors.ink }]}>MACRO PROMPTS</Text>
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
                <Feather
                  name={m.icon as any}
                  size={18}
                  color={colors.ink}
                  style={styles.keyIcon}
                />
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
            <Feather name="users" size={13} color={colors.ink} style={styles.toggleIcon} />
            <Text style={[styles.toggleLabel, { color: colors.ink }]}>ASK A FRIEND</Text>
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

                {/* Dark Contrast Scrim Overlay across whole button for Legibility */}
                <View style={styles.friendKeyScrim} />

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
    alignItems: 'center',
    width: '100%',
  },
  collapsibleWrapper: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 340 : undefined,
    alignSelf: 'center',
  },
  toggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    borderWidth: 1,
    borderRadius: rounded.none,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  toggleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleIcon: {
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
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    padding: 6,
    borderWidth: 1,
    borderTopWidth: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  streamDeckKey: {
    flex: 1,
    maxWidth: Platform.OS === 'web' ? 76 : undefined,
    maxHeight: Platform.OS === 'web' ? 76 : undefined,
    aspectRatio: 1,
    borderWidth: 1.5,
    borderRadius: rounded.none,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    position: 'relative',
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  friendsGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    padding: 6,
    borderWidth: 1,
    borderTopWidth: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  friendDeckKey: {
    width: '31.8%',
    maxWidth: Platform.OS === 'web' ? 100 : undefined,
    maxHeight: Platform.OS === 'web' ? 100 : undefined,
    aspectRatio: 1,
    borderWidth: 1.5,
    borderRadius: rounded.none,
    justifyContent: 'flex-end',
    position: 'relative',
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
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
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.38)',
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
    color: 'rgba(255, 255, 255, 0.92)',
    marginTop: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
