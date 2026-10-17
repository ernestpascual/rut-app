import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Pressable,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  collection,
  query,
  doc,
  updateDoc,
  onSnapshot,
  orderBy,
} from 'firebase/firestore';
import { db } from '../../../src/lib/firebase/client';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { useTheme } from '../../../src/design/ThemeContext';
import { TopNav } from '../../../src/components/ui/TopNav';
import { Button } from '../../../src/components/ui/Button';
import { Card } from '../../../src/components/ui/Card';
import { Badge } from '../../../src/components/ui/Badge';
import { rounded, typography, spacing, ThemeColors } from '../../../src/design/tokens';
import {
  deleteInspiration,
  getDumpInspirations,
  setDumpInspirations,
  enrichInspirationItem,
} from '../../../src/features/dump/dumpService';
import { InspirationItem } from '../../../src/types';

export default function TrashScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [trashedItems, setTrashedItems] = useState<InspirationItem[]>([]);
  const [selectedTrashIds, setSelectedTrashIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Real-time listener for trashed items
  useEffect(() => {
    if (!user) {
      getDumpInspirations().then((all) => {
        setTrashedItems(all.filter((i) => i.archived));
        setLoading(false);
      });
      return;
    }

    const q = query(
      collection(db, 'users', user.uid, 'inspirations'),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const trashed: InspirationItem[] = [];
        snapshot.forEach((docSnap) => {
          const raw = { ...(docSnap.data() as any), id: docSnap.id } as InspirationItem;
          if (raw.archived) {
            trashed.push(enrichInspirationItem(raw));
          }
        });
        setTrashedItems(trashed);
        setLoading(false);
      },
      (err) => {
        console.warn('Trash snapshot fallback:', err);
        getDumpInspirations().then((all) => {
          setTrashedItems(all.filter((i) => i.archived));
          setLoading(false);
        });
      }
    );

    return () => unsubscribe();
  }, [user]);

  const toggleSelectTrash = (id: string) => {
    const next = new Set(selectedTrashIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedTrashIds(next);
  };

  const toggleSelectAllTrash = () => {
    if (selectedTrashIds.size === trashedItems.length) {
      setSelectedTrashIds(new Set());
    } else {
      setSelectedTrashIds(new Set(trashedItems.map((i) => i.id)));
    }
  };

  const handleRestoreItems = async (idsToRestore: string[]) => {
    if (!idsToRestore.length) return;
    setActionLoading(true);
    try {
      if (user) {
        for (const id of idsToRestore) {
          await updateDoc(doc(db, 'users', user.uid, 'inspirations', id), {
            archived: false,
            updatedAt: Date.now(),
          }).catch(() => {});
        }
      }
      const local = await getDumpInspirations();
      const updatedLocal = local.map((i) =>
        idsToRestore.includes(i.id) ? { ...i, archived: false, updatedAt: Date.now() } : i
      );
      await setDumpInspirations(updatedLocal);

      setSelectedTrashIds((prev) => {
        const next = new Set(prev);
        idsToRestore.forEach((id) => next.delete(id));
        return next;
      });

      const count = idsToRestore.length;
      const msg = `${count} item${count > 1 ? 's' : ''} restored to your Bank.`;
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Restored', msg);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to restore items.');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePermanentDeleteItems = async (idsToDelete: string[]) => {
    if (!idsToDelete.length) return;

    const performDelete = async () => {
      setActionLoading(true);
      try {
        for (const id of idsToDelete) {
          await deleteInspiration(id, user?.uid);
        }

        setSelectedTrashIds((prev) => {
          const next = new Set(prev);
          idsToDelete.forEach((id) => next.delete(id));
          return next;
        });

        const count = idsToDelete.length;
        const msg = `Permanently deleted ${count} item${count > 1 ? 's' : ''}.`;
        if (Platform.OS === 'web') {
          window.alert(msg);
        } else {
          Alert.alert('Deleted', msg);
        }
      } catch (e: any) {
        Alert.alert('Error', e.message || 'Failed to delete items.');
      } finally {
        setActionLoading(false);
      }
    };

    const count = idsToDelete.length;
    const confirmMessage = `Permanently delete ${count} item${count > 1 ? 's' : ''} from Trash? This action cannot be undone.`;

    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' && window.confirm(`Permanent Deletion\n\n${confirmMessage}`);
      if (confirmed) {
        await performDelete();
      }
      return;
    }

    Alert.alert('Permanent Deletion', confirmMessage, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete Permanently', style: 'destructive', onPress: performDelete },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TopNav
        title="rut"
        subtitle="Trash Manager"
        onBack={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(app)/(tabs)/settings');
          }
        }}
        backTitle="SETTINGS"
      />

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.sectionCard}>
          <View style={styles.trashHeader}>
            <Text style={styles.sectionHeading}>TRASH</Text>
            <Badge
              label={trashedItems.length > 0 ? `${trashedItems.length} ITEM${trashedItems.length > 1 ? 'S' : ''}` : 'EMPTY'}
              variant={trashedItems.length > 0 ? 'grade' : 'outline'}
            />
          </View>
          <Text style={styles.disclaimerText}>
            Items moved to trash are hidden from your active bank. You can restore 1, multiple, or all items back to your bank, or permanently purge them from the database.
          </Text>

          {loading ? (
            <ActivityIndicator color={colors.ink} size="small" style={{ marginVertical: spacing.xl }} />
          ) : trashedItems.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={{ fontSize: 32, marginBottom: spacing.xs }}>🗑</Text>
              <Text style={styles.emptyTitle}>Trash is Empty</Text>
              <Text style={styles.emptySubtitle}>You don't have any archived items in trash.</Text>
              <Button
                title="BACK TO BANK"
                variant="secondary"
                onPress={() => router.replace('/(app)/(tabs)/bank')}
                style={{ marginTop: spacing.base }}
              />
            </View>
          ) : (
            <View>
              {/* Batch Actions Toolbar */}
              <View style={styles.trashActionBar}>
                <Button
                  title={selectedTrashIds.size === trashedItems.length ? 'DESELECT ALL' : 'SELECT ALL'}
                  variant="secondary"
                  disabled={actionLoading}
                  onPress={toggleSelectAllTrash}
                  style={styles.trashActionBtn}
                />
                <Button
                  title={actionLoading ? 'RESTORING...' : 'RESTORE ALL'}
                  variant="secondary"
                  disabled={actionLoading}
                  onPress={() => handleRestoreItems(trashedItems.map((i) => i.id))}
                  style={styles.trashActionBtn}
                />
                <Button
                  title={actionLoading ? 'EMPTYING...' : 'EMPTY TRASH'}
                  variant="secondary"
                  disabled={actionLoading}
                  onPress={() => handlePermanentDeleteItems(trashedItems.map((i) => i.id))}
                  style={[styles.trashActionBtn, { borderColor: colors.statusErrorBorder }]}
                  textStyle={{ color: colors.statusErrorText }}
                />

                {selectedTrashIds.size > 0 ? (
                  <>
                    <Button
                      title={`RESTORE (${selectedTrashIds.size})`}
                      variant="primary"
                      disabled={actionLoading}
                      onPress={() => handleRestoreItems(Array.from(selectedTrashIds))}
                      style={styles.trashActionBtn}
                    />
                    <Button
                      title={`DELETE (${selectedTrashIds.size})`}
                      variant="secondary"
                      disabled={actionLoading}
                      onPress={() => handlePermanentDeleteItems(Array.from(selectedTrashIds))}
                      style={[styles.trashActionBtn, { borderColor: colors.statusErrorBorder }]}
                      textStyle={{ color: colors.statusErrorText }}
                    />
                  </>
                ) : null}
              </View>

              {/* Trashed Items List */}
              <View style={styles.trashList}>
                {trashedItems.map((item) => {
                  const isSelected = selectedTrashIds.has(item.id);
                  return (
                    <View key={item.id} style={styles.trashItemRow}>
                      <Pressable
                        onPress={() => toggleSelectTrash(item.id)}
                        style={[styles.trashCheckbox, isSelected && styles.trashCheckboxChecked]}
                      >
                        <Text style={[styles.trashCheckboxText, !isSelected && { color: colors.inkSoft }]}>
                          {isSelected ? '✓' : ''}
                        </Text>
                      </Pressable>

                      {item.remotePreviewImageUrl ? (
                        <Image
                          source={{ uri: item.remotePreviewImageUrl }}
                          style={styles.trashThumb}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.trashThumbPlaceholder}>
                          <Text style={{ fontSize: 16 }}>🗑</Text>
                        </View>
                      )}

                      <Pressable
                        style={styles.trashInfo}
                        onPress={() => router.push(`/(app)/inspiration/${item.id}`)}
                      >
                        <Text style={styles.trashTitle} numberOfLines={2}>
                          {item.title}
                        </Text>
                        <View style={styles.trashBadges}>
                          {item.sourcePlatform ? (
                            <Badge
                              label={item.sourcePlatform.toUpperCase()}
                              variant="grade"
                              style={{ marginRight: 4 }}
                            />
                          ) : null}
                          {item.sourceDomain ? (
                            <Badge
                              label={item.sourceDomain}
                              variant="outline"
                              style={{ marginRight: 4 }}
                            />
                          ) : null}
                        </View>
                      </Pressable>

                      <View style={styles.trashRowActions}>
                        <Button
                          title="RESTORE"
                          variant="secondary"
                          disabled={actionLoading}
                          onPress={() => handleRestoreItems([item.id])}
                          style={styles.trashMiniBtn}
                        />
                        <Button
                          title="DELETE"
                          variant="secondary"
                          disabled={actionLoading}
                          onPress={() => handlePermanentDeleteItems([item.id])}
                          style={[styles.trashMiniBtn, { borderColor: colors.statusErrorBorder }]}
                          textStyle={{ color: colors.statusErrorText }}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.canvas,
    },
    content: {
      padding: spacing.base,
      maxWidth: 680,
      width: '100%',
      alignSelf: 'center',
    },
    sectionCard: {
      marginBottom: spacing.base,
      borderWidth: 1,
      borderColor: colors.hairline,
      padding: spacing.base,
    },
    sectionHeading: {
      ...typography.captionCap,
      color: colors.ink,
      fontWeight: '700',
      marginBottom: spacing.xs,
    },
    trashHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.xxs,
    },
    disclaimerText: {
      ...typography.captionSm,
      color: colors.inkSoft,
      lineHeight: 16,
      marginBottom: spacing.base,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xl,
    },
    emptyTitle: {
      ...typography.bodyLg,
      color: colors.ink,
      fontWeight: '700',
      marginBottom: spacing.xxs,
    },
    emptySubtitle: {
      ...typography.captionSm,
      color: colors.inkSoft,
    },
    trashActionBar: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginBottom: spacing.base,
      paddingTop: spacing.xs,
      borderTopWidth: 1,
      borderTopColor: colors.hairline,
    },
    trashActionBtn: {
      height: 34,
      paddingHorizontal: 10,
    },
    trashList: {
      marginTop: spacing.xs,
    },
    trashItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.hairlineGrade,
    },
    trashCheckbox: {
      width: 26,
      height: 26,
      borderWidth: 1,
      borderColor: colors.hairline,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.sm,
      backgroundColor: colors.surfaceGrade,
    },
    trashCheckboxChecked: {
      backgroundColor: colors.ink,
      borderColor: colors.ink,
    },
    trashCheckboxText: {
      ...typography.captionSm,
      color: colors.canvas,
      fontWeight: '700',
    },
    trashThumb: {
      width: 44,
      height: 44,
      marginRight: spacing.sm,
      backgroundColor: colors.surfaceGrade,
    },
    trashThumbPlaceholder: {
      width: 44,
      height: 44,
      marginRight: spacing.sm,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.surfaceGrade,
      justifyContent: 'center',
      alignItems: 'center',
    },
    trashInfo: {
      flex: 1,
      marginRight: spacing.sm,
    },
    trashTitle: {
      ...typography.captionSm,
      color: colors.ink,
      fontWeight: '600',
      marginBottom: spacing.xxs,
    },
    trashBadges: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    trashRowActions: {
      flexDirection: 'row',
      gap: spacing.xxs,
    },
    trashMiniBtn: {
      height: 32,
      paddingHorizontal: 8,
    },
  });
