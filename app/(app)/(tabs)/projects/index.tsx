import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../../../../src/lib/firebase/client';
import { useAuth, DUMMY_USER_UID } from '../../../../src/features/auth/AuthContext';
import { useTheme } from '../../../../src/design/ThemeContext';
import { TopNav } from '../../../../src/components/ui/TopNav';
import { Button } from '../../../../src/components/ui/Button';
import { Card } from '../../../../src/components/ui/Card';
import { Badge } from '../../../../src/components/ui/Badge';
import { rounded, typography, spacing, ThemeColors } from '../../../../src/design/tokens';
import { Project } from '../../../../src/types';
import { getProjects, deleteProjectLocal } from '../../../../src/features/dump/dumpService';

export default function ProjectsListScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && windowWidth >= 640;
  const styles = useMemo(() => getStyles(colors, isDesktop), [colors, isDesktop]);
  const isDummy = !user || user.uid === DUMMY_USER_UID;

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      getProjects().then((loaded) => {
        if (isMounted) {
          setProjects(loaded);
          setLoading(false);
        }
      });
      return;
    }

    try {
      const q = query(
        collection(db, 'users', user.uid, 'projects'),
        orderBy('updatedAt', 'desc')
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!isMounted) return;
          const fetched: Project[] = [];
          snapshot.forEach((docSnap) => {
            fetched.push({ id: docSnap.id, ...(docSnap.data() as any) });
          });
          setProjects(fetched);
          setLoading(false);
        },
        (err) => {
          console.warn('Projects snapshot error, using local ideas:', err);
          getProjects().then((loaded) => {
            if (isMounted) {
              setProjects(loaded);
              setLoading(false);
            }
          });
        }
      );

      return () => {
        isMounted = false;
        unsubscribe();
      };
    } catch {
      getProjects().then((loaded) => {
        if (isMounted) {
          setProjects(loaded);
          setLoading(false);
        }
      });
    }
  }, [user, isDummy]);

  const handleDeleteProject = (projectId: string, title: string) => {
    Alert.alert('Delete Idea', `Are you sure you want to delete "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteProjectLocal(projectId, user?.uid);
          setProjects((prev) => prev.filter((p) => p.id !== projectId));
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TopNav
        title="rut"
        subtitle="Ideas & Projects"
        rightAction={
          <Button
            title="+ WRITE IDEA"
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
          <Text style={styles.emptyTitle}>NO IDEAS YET</Text>
          <Text style={styles.emptySubtitle}>
            Write an idea concept, brief, or notes, and discover matching references from your saved dump.
          </Text>
          <Button
            title="+ WRITE FIRST IDEA"
            onPress={() => router.push('/(app)/project/new')}
            style={{ marginTop: spacing.base }}
          />
        </View>
      ) : isDesktop ? (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator
        >
          {projects.map((item) => (
            <Card
              key={item.id}
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
                <Text style={styles.briefText} numberOfLines={3}>
                  {item.brief}
                </Text>
              ) : null}

              <View style={styles.tagRow}>
                <Badge label="INSPIRATION MATCHER" variant="outline" />
                <Badge label="💬 TRAIN OF THOUGHT" variant="inverse" />
                {(item.tags || []).map((t) => (
                  <Badge key={t} label={`#${t}`} variant="grade" />
                ))}
              </View>

              <View style={styles.cardFooterRow}>
                <Text style={styles.cardFooterSub}>
                  {item.thoughtCount ? `${item.thoughtCount} THOUGHTS LOGGED` : 'CONNECTED TO BANK'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Button
                    title="DELETE"
                    variant="text"
                    onPress={() => handleDeleteProject(item.id, item.title)}
                    style={{ marginRight: spacing.xs }}
                  />
                  <Button
                    title="THINK →"
                    variant="text"
                    onPress={() => router.push(`/(app)/project/${item.id}`)}
                  />
                </View>
              </View>
            </Card>
          ))}
        </ScrollView>
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
                <Badge label="INSPIRATION MATCHER" variant="outline" />
                <Badge label="💬 TRAIN OF THOUGHT" variant="inverse" />
                {(item.tags || []).map((t) => (
                  <Badge key={t} label={`#${t}`} variant="grade" />
                ))}
              </View>

              <View style={styles.cardFooterRow}>
                <Text style={styles.cardFooterSub}>
                  {item.thoughtCount ? `${item.thoughtCount} THOUGHTS LOGGED` : 'CONNECTED TO BANK'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Button
                    title="DELETE"
                    variant="text"
                    onPress={() => handleDeleteProject(item.id, item.title)}
                    style={{ marginRight: spacing.xs }}
                  />
                  <Button
                    title="THINK →"
                    variant="text"
                    onPress={() => router.push(`/(app)/project/${item.id}`)}
                  />
                </View>
              </View>
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors, isDesktop: boolean) =>
  StyleSheet.create<any>({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  listContent: {
    padding: spacing.base,
    paddingBottom: 100,
    width: '100%',
    maxWidth: 1440,
    alignSelf: 'center',
    ...(Platform.OS === 'web' && isDesktop
      ? {
          display: 'grid' as any,
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: spacing.base,
        }
      : {}),
  },
  projectCard: {
    marginBottom: isDesktop ? 0 : spacing.sm,
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
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.hairlineGrade,
    paddingTop: spacing.xs,
    marginTop: spacing.xs,
  },
  cardFooterSub: {
    ...typography.captionCap,
    fontSize: 9,
    color: colors.inkSoft,
    letterSpacing: 0.5,
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
    maxWidth: 320,
  },
});
