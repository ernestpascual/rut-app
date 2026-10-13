import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
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
import { AnnouncementBar } from '../../../../src/components/ui/AnnouncementBar';
import { TopNav } from '../../../../src/components/ui/TopNav';
import { Button } from '../../../../src/components/ui/Button';
import { Card } from '../../../../src/components/ui/Card';
import { Badge } from '../../../../src/components/ui/Badge';
import { rounded, typography, spacing, ThemeColors } from '../../../../src/design/tokens';
import { Project } from '../../../../src/types';
import { getProjects } from '../../../../src/features/dump/dumpService';

export default function ProjectsListScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
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
          if (snapshot.empty) {
            getProjects().then((loaded) => {
              if (isMounted) {
                setProjects(loaded);
                setLoading(false);
              }
            });
          } else {
            const fetched: Project[] = [];
            snapshot.forEach((docSnap) => {
              fetched.push({ id: docSnap.id, ...(docSnap.data() as any) });
            });
            setProjects(fetched);
            setLoading(false);
          }
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AnnouncementBar
        pillText="IDEAS STUDIO"
        message="Write your idea and match & attach inspirations from your dump as references"
      />
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

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  listContent: {
    padding: spacing.base,
    paddingBottom: 100,
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
    maxWidth: 320,
  },
});
