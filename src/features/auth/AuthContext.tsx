import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as fbSignOut,
  deleteUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../../lib/firebase/client';
import { getStagedPendingShare, clearStagedPendingShare } from '../capture/stagingStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IncomingSharePayload, UserProfile } from '../../types';

export const DUMMY_USER_UID = 'test';

export const DUMMY_TEST_USER: any = {
  uid: DUMMY_USER_UID,
  email: 'test@rut.app',
  displayName: 'Test Account',
  emailVerified: true,
  isAnonymous: false,
  photoURL: null,
  phoneNumber: null,
  providerId: 'password',
  metadata: {
    creationTime: new Date().toISOString(),
    lastSignInTime: new Date().toISOString(),
  },
  providerData: [],
  refreshToken: 'test-refresh-token',
  tenantId: null,
  delete: async () => {},
  getIdToken: async () => 'test-id-token',
  getIdTokenResult: async () => ({
    token: 'test-id-token',
    authTime: '0',
    issuedAtTime: '0',
    expirationTime: '9999999999',
    signInProvider: 'password',
    signInSecondFactor: null,
    claims: {},
  }),
  reload: async () => {},
  toJSON: () => ({ uid: DUMMY_USER_UID, email: 'test@rut.app' }),
};

const DUMMY_STORAGE_KEY = '@rut_dummy_user_active';

export const syncUserProfile = async (
  uid: string,
  email: string | null
): Promise<UserProfile> => {
  const userDocRef = doc(db, 'users', uid);
  const now = Date.now();
  try {
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const data = snap.data();
      const updatedProfile: UserProfile = {
        uid,
        email: data.email || email,
        role: data.role || 'user',
        createdAt: data.createdAt || now,
        updatedAt: now,
        lastSignInAt: now,
      };
      await setDoc(
        userDocRef,
        {
          role: updatedProfile.role,
          lastSignInAt: now,
          updatedAt: now,
          email: updatedProfile.email,
        },
        { merge: true }
      );
      return updatedProfile;
    } else {
      const newProfile: UserProfile = {
        uid,
        email: email || null,
        role: 'user',
        createdAt: now,
        updatedAt: now,
        lastSignInAt: now,
      };
      await setDoc(userDocRef, newProfile, { merge: true });
      return newProfile;
    }
  } catch (err) {
    console.warn('[AuthContext] syncUserProfile error:', err);
    return {
      uid,
      email: email || null,
      role: 'user',
      createdAt: now,
      updatedAt: now,
      lastSignInAt: now,
    };
  }
};

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isDummyUser: boolean;
  stagedShare: IncomingSharePayload | null;
  signIn: (email: string, pass: string) => Promise<void>;
  signInAsDummy: () => Promise<void>;
  signUp: (email: string, pass: string) => Promise<void>;
  sendReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  clearStagedShare: () => Promise<void>;
  authError: string | null;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [stagedShare, setStagedShare] = useState<IncomingSharePayload | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Check if dummy user was previously active
    AsyncStorage.getItem(DUMMY_STORAGE_KEY)
      .then((active) => {
        if (active === 'true' && isMounted) {
          setUser(DUMMY_TEST_USER);
          syncUserProfile(DUMMY_USER_UID, 'test@rut.app')
            .then((p) => {
              if (isMounted) setUserProfile(p);
            })
            .catch(() => {});
          setLoading(false);
        }
      })
      .catch(() => {});

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!isMounted) return;
      if (currentUser) {
        setUser(currentUser);
        await AsyncStorage.removeItem(DUMMY_STORAGE_KEY).catch(() => {});
        try {
          const profile = await syncUserProfile(currentUser.uid, currentUser.email);
          if (isMounted) setUserProfile(profile);
        } catch (e) {
          console.warn('Profile sync on auth change warning:', e);
        }
      } else {
        // If not logged into Firebase, check if dummy user session is active
        const dummyActive = await AsyncStorage.getItem(DUMMY_STORAGE_KEY).catch(() => null);
        if (dummyActive === 'true') {
          setUser(DUMMY_TEST_USER);
          try {
            const profile = await syncUserProfile(DUMMY_USER_UID, 'test@rut.app');
            if (isMounted) setUserProfile(profile);
          } catch (e) {}
        } else {
          setUser(null);
          setUserProfile(null);
        }
      }
      setLoading(false);
      if (currentUser) {
        // Check if there was a staged share captured while signed out
        const staged = await getStagedPendingShare();
        if (staged && isMounted) {
          setStagedShare(staged);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const formatAuthError = (err: any): string => {
    const code = err?.code as string | undefined;
    switch (code) {
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/user-disabled':
        return 'This account has been disabled.';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Incorrect email or password.';
      case 'auth/email-already-in-use':
        return 'An account already exists with this email.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters.';
      case 'auth/requires-recent-login':
        return 'Please sign out and sign in again before deleting your account.';
      default:
        return err?.message || 'An unexpected error occurred. Please try again.';
    }
  };

  const signIn = async (email: string, pass: string) => {
    setAuthError(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
      const profile = await syncUserProfile(cred.user.uid, cred.user.email || email.trim());
      setUserProfile(profile);
    } catch (err: any) {
      const msg = formatAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const signUp = async (email: string, pass: string) => {
    setAuthError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      const profile = await syncUserProfile(cred.user.uid, cred.user.email || email.trim());
      setUserProfile(profile);
    } catch (err: any) {
      const msg = formatAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const sendReset = async (email: string) => {
    setAuthError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err: any) {
      const msg = formatAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const signInAsDummy = async () => {
    setAuthError(null);
    try {
      await AsyncStorage.setItem(DUMMY_STORAGE_KEY, 'true');
      setUser(DUMMY_TEST_USER);
      try {
        const profile = await syncUserProfile(DUMMY_USER_UID, 'test@rut.app');
        setUserProfile(profile);
      } catch (err) {
        console.warn('Dummy profile sync error:', err);
      }
    } catch (err: any) {
      setUser(DUMMY_TEST_USER);
    }
  };

  const signOut = async () => {
    setAuthError(null);
    try {
      await AsyncStorage.removeItem(DUMMY_STORAGE_KEY);
    } catch {}
    try {
      await fbSignOut(auth);
    } catch {}
    setUser(null);
    setUserProfile(null);
    setStagedShare(null);
  };

  const deleteAccount = async () => {
    if (!user) return;
    if (user.uid === DUMMY_USER_UID) {
      await signOut();
      return;
    }
    try {
      // First invoke recursive backend deletion function
      const deleteDataFn = httpsCallable(functions, 'deleteAccountData');
      await deleteDataFn();
      // Then delete Firebase Auth record
      await deleteUser(user);
      setUser(null);
      setUserProfile(null);
      setStagedShare(null);
    } catch (err: any) {
      const msg = formatAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const clearStagedShare = async () => {
    await clearStagedPendingShare();
    setStagedShare(null);
  };

  const isDummyUser = !!user && user.uid === DUMMY_USER_UID;

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        isDummyUser,
        stagedShare,
        signIn,
        signInAsDummy,
        signUp,
        sendReset,
        signOut,
        deleteAccount,
        clearStagedShare,
        authError,
        clearAuthError: () => setAuthError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
