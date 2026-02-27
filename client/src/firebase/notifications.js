import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getToken, onMessage } from 'firebase/messaging';
import {
  db,
  firebaseConfig,
  isFirebaseConfigured,
  messagingPromise,
  vapidKey,
} from './config';

const safeRole = (role) => (role === 'rutbah' ? 'rutbah' : 'belal');

const hashToken = (value) => {
  let hash = 5381;
  const text = String(value || '');
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash) + text.charCodeAt(index);
    hash &= 0xffffffff;
  }
  return `tok_${(hash >>> 0).toString(16)}`;
};

const buildServiceWorkerUrl = () => {
  const params = new URLSearchParams({
    apiKey: firebaseConfig.apiKey,
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket,
    messagingSenderId: firebaseConfig.messagingSenderId,
    appId: firebaseConfig.appId,
  });
  return `/firebase-messaging-sw.js?${params.toString()}`;
};

const saveTokenForRole = async (role, token) => {
  if (!db) throw new Error('Firestore is unavailable.');
  const tokenId = hashToken(token);
  await setDoc(doc(db, 'mefilUsers', safeRole(role), 'tokens', tokenId), {
    token,
    userAgent: navigator.userAgent || 'unknown',
    platform: navigator.platform || 'unknown',
    enabled: true,
    updatedAt: serverTimestamp(),
  }, { merge: true });
};

const requestAndSaveNotificationToken = async (role) => {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase is not configured. Add all VITE_FIREBASE_* variables.');
  }
  if (!('Notification' in window)) {
    throw new Error('This browser does not support notifications.');
  }
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers are not supported in this browser.');
  }
  if (!vapidKey) {
    throw new Error('VITE_FIREBASE_VAPID_KEY is missing.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was denied.');
  }

  const swUrl = buildServiceWorkerUrl();
  const registration = await navigator.serviceWorker.register(swUrl, { scope: '/' });
  const messaging = await messagingPromise;
  if (!messaging) {
    throw new Error('Firebase messaging is not supported in this browser.');
  }

  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration,
  });
  if (!token) {
    throw new Error('Failed to obtain device notification token.');
  }

  await saveTokenForRole(role, token);
  return token;
};

const listenForegroundNotifications = async (onPayload) => {
  const messaging = await messagingPromise;
  if (!messaging) return () => {};
  return onMessage(messaging, (payload) => {
    onPayload?.(payload);
  });
};

export {
  requestAndSaveNotificationToken,
  listenForegroundNotifications,
};
