import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as fbSignOut,
  deleteUser,
  AuthError
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../../lib/firebase/client';
import { getStagedPendingShare, clearStagedPendingShare } from '../capture/stagingStorage';
import { IncomingSharePayload } from '../../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  stagedShare: IncomingSharePayload | null;
  signIn: (email: string, pass: string) => Promise<void>;
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
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [stagedShare, setStagedShare] = useState<IncomingSharePayload | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        // Check if there was a staged share captured while signed out
        const staged = await getStagedPendingShare();
        if (staged) {
          setStagedShare(staged);
        }
      }
    });
    return unsubscribe;
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
      await signInWithEmailAndPassword(auth, email.trim(), pass);
    } catch (err: any) {
      const msg = formatAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const signUp = async (email: string, pass: string) => {
    setAuthError(null);
    try {
      await createUserWithEmailAndPassword(auth, email.trim(), pass);
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

  const signOut = async () => {
    setAuthError(null);
    await fbSignOut(auth);
    setStagedShare(null);
  };

  const deleteAccount = async () => {
    if (!user) return;
    try {
      // First invoke recursive backend deletion function
      const deleteDataFn = httpsCallable(functions, 'deleteAccountData');
      await deleteDataFn();
      // Then delete Firebase Auth record
      await deleteUser(user);
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

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        stagedShare,
        signIn,
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
