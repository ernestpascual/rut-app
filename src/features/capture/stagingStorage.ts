import AsyncStorage from '@react-native-async-storage/async-storage';
import { IncomingSharePayload } from '../../types';

const STAGED_SHARE_KEY = '@rut:staged_share_payload';

export async function stagePendingShare(payload: IncomingSharePayload): Promise<void> {
  try {
    await AsyncStorage.setItem(STAGED_SHARE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.error('Failed to stage pending share:', err);
  }
}

export async function getStagedPendingShare(): Promise<IncomingSharePayload | null> {
  try {
    const raw = await AsyncStorage.getItem(STAGED_SHARE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as IncomingSharePayload;
  } catch (err) {
    console.error('Failed to read staged pending share:', err);
    return null;
  }
}

export async function clearStagedPendingShare(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STAGED_SHARE_KEY);
  } catch (err) {
    console.error('Failed to clear staged pending share:', err);
  }
}
