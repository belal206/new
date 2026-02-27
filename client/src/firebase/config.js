import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getMessaging, isSupported as isMessagingSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

const requiredKeys = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
];

const firebaseEnvMissingKeys = requiredKeys.filter((key) => !firebaseConfig[key]);
const isFirebaseConfigured = firebaseEnvMissingKeys.length === 0;
const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';

const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
const db = app ? getFirestore(app) : null;

let messagingPromise = Promise.resolve(null);
if (app) {
  messagingPromise = isMessagingSupported()
    .then((supported) => (supported ? getMessaging(app) : null))
    .catch(() => null);
}

export {
  app,
  db,
  firebaseConfig,
  firebaseEnvMissingKeys,
  isFirebaseConfigured,
  messagingPromise,
  vapidKey,
};
