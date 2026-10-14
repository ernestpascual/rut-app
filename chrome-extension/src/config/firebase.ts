// Firebase configuration matching the rut main web app
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'mock-api-key-for-local-testing',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'izepak.firebaseapp.com',
  databaseURL: 'https://izepak-default-rtdb.firebaseio.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'izepak',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'izepak.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '53941543805',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:53941543805:web:c796434bf9da4d3bb52214',
};

export const RUT_WEB_APP_URL = 'https://rut.web.app';
