import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  collection,
  query,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../../../../src/lib/firebase/client';
import { useAuth } from '../../../../src/features/auth/AuthContext';
import { AnnouncementBar } from '../../../../src/components/ui/AnnouncementBar';
import { TopNav } from '../../../../src/components/ui/TopNav';
import { Button } from '../../../../src/components/ui/Button';
import { Card } from '../../../../src/components/ui/Card';
import { Badge } from '../../../../src/components/ui/Badge';
import { colors, rounded, typography, spacing } from '../../../../src/design/tokens';
import { Project } from '../../../../src/types';

export default function ProjectsListScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'users', user.uid, 'projects'),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched: Project[] = [];
        snapshot.forEach((docSnap) => {
          fetched.push({ id: docSnap.id, ...(docSnap.data() as any) });
        });
        setProjects(fetched);
        setLoading(false);
      },
      (err) => {
        console.warn('Projects snapshot error:', err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user]);

  return (
    <SafeAreaView style={styles.container}>
      <AnnouncementBar pillText="PROJECTS" message="Combine notes and AI-suggested inspiration" />
      <TopNav
        title="rut"
        subtitle="Projects Workspace"
        rightAction={
          <Button
            title="+ NEW PROJECT"
            onPress={() => router.push('/(app)/project/new')}
            style={{ height: 36, paddingHorizontal: 16 }}
          />
        }
      />

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.ink} size="small" />
        </View>
      ) : projects.length === 0 ? (
        <View style={styles.centerBox}>
          <Text style={styles.emptyTitle}>NO ACTIVE PROJECTS</Text>
          <Text style={styles.emptySubtitle}>
            Projects aggregate your notes with relevant inspiration items matched automatically by AI.
          </Text>
          <Button
            title="+ CREATE FIRST PROJECT"
            onPress={() => router.push('/(app)/project/new')}
            style={{ marginTop: spacing.base }}
          />
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Card
              onPress={() => router.push(`/(app)/project/${item.id}`)}
              style={styles.projectCard}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.projectTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Badge
                  label={item.status.toUpperCase()}
                  variant={item.status === 'active' ? 'inverse' : 'grade'}
                />
              </View>

              {item.brief ? (
                <Text style={styles.briefText} numberOfLines={2}>
                  {item.brief}
                </Text>
              ) : null}

              <View style={styles.tagRow}>
                {item.autoLinkEnabled ? (
                  <Badge label="AI AUTO-LINK ON" variant="outline" />
                ) : null}
                {(item.tags || []).map((t) => (
                  <Badge key={t} label={`#${t}`} variant="grade" />
                ))}
              </View>
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  listContent: {
    padding: spacing.base,
  },
  projectCard: {
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xxs,
  },
  projectTitle: {
    ...typography.bodyLg,
    color: colors.ink,
    flex: 1,
    marginRight: spacing.xs,
  },
  briefText: {
    ...typography.captionSm,
    color: colors.inkSoft,
    lineHeight: 18,
    marginBottom: spacing.xs,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xxs,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    ...typography.displayMd,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.bodyMd,
    color: colors.inkSoft,
    textAlign: 'center',
    maxWidth: 340,
  },
});
