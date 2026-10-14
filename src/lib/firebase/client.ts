import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  connectAuthEmulator,
  browserLocalPersistence,
  Auth
} from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  Firestore
} from 'firebase/firestore';
import {
  getFunctions,
  connectFunctionsEmulator,
  Functions
} from 'firebase/functions';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Safe client-side environment configuration with fallback placeholders
// Client-side Firebase configuration for izepak
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'mock-api-key-for-local-testing',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'izepak.firebaseapp.com',
  databaseURL: 'https://izepak-default-rtdb.firebaseio.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'izepak',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'izepak.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '53941543805',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:53941543805:web:c796434bf9da4d3bb52214',
};

let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// Initialize Auth with platform-appropriate persistence
let auth: Auth;
try {
  if (Platform.OS === 'web') {
    auth = initializeAuth(app, {
      persistence: browserLocalPersistence,
    });
  } else {
    // Dynamically require React Native persistence to prevent web bundler issues
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getReactNativePersistence } = require('firebase/auth');
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  }
} catch (e) {
  // If already initialized
  auth = getAuth(app);
}

const db: Firestore = getFirestore(app);
const functions: Functions = getFunctions(app);

// Connect to emulators when specified
const useEmulator = process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === '1';
const emulatorHost = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST || '127.0.0.1';

if (useEmulator && typeof window !== 'undefined') {
  try {
    connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, emulatorHost, 8080);
    connectFunctionsEmulator(functions, emulatorHost, 5001);
    console.log(`[Firebase] Connected to emulators on ${emulatorHost}`);
  } catch (err) {
    // Ignored if already connected
  }
}

export { app, auth, db, functions };
