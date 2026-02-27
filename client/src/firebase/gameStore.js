import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';

const QUEST_COLLECTION = 'bossBattle';
const QUEST_DOC_ID = 'globalQuest';
const BOSS_MAX_HP = 500;
const TEAM_MAX_HP = 100;
const ATTACK_DAMAGE = 25;
const DISTRACT_DAMAGE = 20;

const defaultQuestState = {
  bossName: 'The DBMS Final',
  bossHp: BOSS_MAX_HP,
  bossMaxHp: BOSS_MAX_HP,
  teamHp: TEAM_MAX_HP,
  teamMaxHp: TEAM_MAX_HP,
  status: 'active',
  lastActionType: null,
  lastActor: null,
  lastDamage: null,
  updatedAt: null,
};

const getQuestRef = () => doc(db, QUEST_COLLECTION, QUEST_DOC_ID);
const getEventsRef = () => collection(db, QUEST_COLLECTION, QUEST_DOC_ID, 'events');

const normalizeQuest = (value) => {
  const source = value && typeof value === 'object' ? value : {};
  const bossMaxHp = Number.isFinite(source.bossMaxHp) ? Math.max(1, source.bossMaxHp) : BOSS_MAX_HP;
  const teamMaxHp = Number.isFinite(source.teamMaxHp) ? Math.max(1, source.teamMaxHp) : TEAM_MAX_HP;
  const bossHp = Number.isFinite(source.bossHp) ? Math.max(0, Math.min(bossMaxHp, source.bossHp)) : bossMaxHp;
  const teamHp = Number.isFinite(source.teamHp) ? Math.max(0, Math.min(teamMaxHp, source.teamHp)) : teamMaxHp;
  const status = bossHp <= 0 ? 'won' : (teamHp <= 0 ? 'lost' : 'active');
  return {
    bossName: typeof source.bossName === 'string' && source.bossName.trim() ? source.bossName.trim() : defaultQuestState.bossName,
    bossHp,
    bossMaxHp,
    teamHp,
    teamMaxHp,
    status,
    lastActionType: source.lastActionType === 'attack' || source.lastActionType === 'distracted' ? source.lastActionType : null,
    lastActor: source.lastActor === 'belal' || source.lastActor === 'rutbah' ? source.lastActor : null,
    lastDamage: Number.isFinite(source.lastDamage) ? source.lastDamage : null,
    updatedAt: source.updatedAt || null,
  };
};

const assertFirebaseReady = () => {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firebase is not configured. Add all VITE_FIREBASE_* variables.');
  }
};

const ensureQuestExists = async () => {
  assertFirebaseReady();
  const questRef = getQuestRef();
  const snapshot = await getDoc(questRef);
  if (snapshot.exists()) return normalizeQuest(snapshot.data());
  await setDoc(questRef, {
    ...defaultQuestState,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return defaultQuestState;
};

const writeAction = async (role, actionType) => {
  assertFirebaseReady();
  const safeRole = role === 'rutbah' ? 'rutbah' : 'belal';
  const questRef = getQuestRef();
  const eventsRef = getEventsRef();
  const eventDamage = actionType === 'attack' ? ATTACK_DAMAGE : DISTRACT_DAMAGE;

  await ensureQuestExists();

  const updated = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(questRef);
    const current = normalizeQuest(snapshot.exists() ? snapshot.data() : defaultQuestState);
    if (current.status !== 'active') {
      return current;
    }

    const nextBossHp = actionType === 'attack'
      ? Math.max(0, current.bossHp - ATTACK_DAMAGE)
      : current.bossHp;
    const nextTeamHp = actionType === 'distracted'
      ? Math.max(0, current.teamHp - DISTRACT_DAMAGE)
      : current.teamHp;
    const nextStatus = nextBossHp <= 0 ? 'won' : (nextTeamHp <= 0 ? 'lost' : 'active');

    const nextQuest = {
      ...current,
      bossHp: nextBossHp,
      teamHp: nextTeamHp,
      status: nextStatus,
      lastActionType: actionType,
      lastActor: safeRole,
      lastDamage: eventDamage,
      updatedAt: serverTimestamp(),
    };

    transaction.set(questRef, nextQuest, { merge: true });
    transaction.set(doc(eventsRef), {
      type: actionType,
      actor: safeRole,
      damage: eventDamage,
      createdAt: serverTimestamp(),
    });

    return normalizeQuest({
      ...nextQuest,
      updatedAt: new Date().toISOString(),
    });
  });

  return updated;
};

const completePomodoro = async (role) => writeAction(role, 'attack');
const markDistracted = async (role) => writeAction(role, 'distracted');

const resetQuest = async () => {
  assertFirebaseReady();
  const questRef = getQuestRef();
  const nextQuest = {
    ...defaultQuestState,
    updatedAt: serverTimestamp(),
  };
  await setDoc(questRef, nextQuest, { merge: true });
  return defaultQuestState;
};

const subscribeQuest = (onData, onError) => {
  if (!isFirebaseConfigured || !db) {
    onError?.(new Error('Firebase is not configured. Add all VITE_FIREBASE_* variables.'));
    return () => {};
  }

  const questRef = getQuestRef();
  let unsubscribed = false;

  const unsubscribe = onSnapshot(questRef, async (snapshot) => {
    if (!snapshot.exists()) {
      try {
        await ensureQuestExists();
      } catch (err) {
        onError?.(err);
      }
      if (!unsubscribed) onData(defaultQuestState);
      return;
    }
    onData(normalizeQuest(snapshot.data()));
  }, (error) => {
    onError?.(error);
  });

  return () => {
    unsubscribed = true;
    unsubscribe();
  };
};

const storeBattleEvent = async (eventPayload) => {
  assertFirebaseReady();
  await addDoc(getEventsRef(), {
    ...eventPayload,
    createdAt: serverTimestamp(),
  });
};

export {
  ATTACK_DAMAGE,
  DISTRACT_DAMAGE,
  TEAM_MAX_HP,
  BOSS_MAX_HP,
  defaultQuestState,
  subscribeQuest,
  ensureQuestExists,
  completePomodoro,
  markDistracted,
  resetQuest,
  storeBattleEvent,
};
