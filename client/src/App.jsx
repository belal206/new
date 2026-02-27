import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import './index.css';

const POETS = [
  'Ahmad Faraz',
  'Mirza Ghalib',
  'Faiz Ahmed Faiz',
  'Allama Iqbal',
  'Jaun Elia',
  'Parveen Shakir',
  'Mir Taqi Mir',
  'Rutbah',
  'Rumi',
  'Bulleh Shah',
  'Amrita Pritam',
  'Habib Jalib',
  'Sahir Ludhianvi',
  'Nida Fazli',
  'Gulzar',
];
const OTHER_POET_VALUE = '__OTHER_POET__';
const FEEL_TAGS = [
  'Romantic',
  'Longing',
  'Nostalgic',
  'Heartbreak',
  'Reunion',
  'Passionate',
  'Hopeful',
  'Peaceful',
  'Melancholic',
  'Spiritual',
  'Devotion',
  'Grief',
];
const THEMES = ['sukoon', 'noor', 'shahi'];
const THEME_LABELS = {
  sukoon: 'Sukoon',
  noor: 'Noor',
  shahi: 'Shahi',
};
const THEME_ICONS = {
  sukoon: '☀',
  noor: '✧',
  shahi: '♛',
};
const THEME_STORAGE_KEY = 'sufi_dervish_theme';
const RANDOMIZE_ENABLED_STORAGE_KEY = 'sufi_randomize_poems_enabled';
const RANDOMIZE_ORDER_STORAGE_KEY = 'sufi_randomize_poems_order';
const CELEBRATION_DURATION_MS = 10000;
const KALAM_MAX_TEXT_LENGTH = 500;
const KALAM_POLL_INTERVAL_MS = 10000;
const MEFIL_POLL_INTERVAL_MS = 1000;
const POMODORO_SECONDS = 25 * 60;
const BOSS_MAX_HP = 500;
const TEAM_MAX_HP = 100;
const ATTACK_DAMAGE = 25;
const DISTRACT_DAMAGE = 20;
const defaultQuestState = {
  bossName: 'The Aadhaar OTP Rakshas',
  bossHp: BOSS_MAX_HP,
  bossMaxHp: BOSS_MAX_HP,
  teamHp: TEAM_MAX_HP,
  teamMaxHp: TEAM_MAX_HP,
  status: 'active',
  lastActionType: null,
  lastActor: null,
  lastDamage: null,
};
const KALAM_ROOMS = {
  rutbah: 'Rutbah Chat',
  belal: 'Belal Chat',
};
const MEFIL_ROLES = {
  belal: 'Belal',
  rutbah: 'Rutbah',
};
const MEFIL_STATUS_OPTIONS = ['active', 'break', 'not_studying'];
const MEFIL_STATUS_LABELS = {
  active: 'Active',
  break: 'Break',
  not_studying: 'Not Studying',
};
const defaultMefilPresenceEntry = {
  status: 'not_studying',
  isRunning: false,
  remainingSeconds: POMODORO_SECONDS,
  durationSeconds: POMODORO_SECONDS,
  endsAt: null,
  updatedAt: null,
};
const defaultMefilPresence = {
  belal: { ...defaultMefilPresenceEntry },
  rutbah: { ...defaultMefilPresenceEntry },
};

const normalizeTags = (tags) => [...new Set(
  (Array.isArray(tags) ? tags : [])
    .map((tag) => String(tag).trim())
    .filter(Boolean)
)].slice(0, 6);

const LEVELS = [
  { title: 'Murid', min: 0, max: 2 },
  { title: 'Raahi', min: 3, max: 5 },
  { title: 'Dervish', min: 6, max: 9 },
  { title: 'Arif', min: 10, max: 14 },
  { title: 'Fanaa', min: 15, max: Number.POSITIVE_INFINITY },
];

const buildShuffledOrderIds = (items) => {
  const ids = (Array.isArray(items) ? items : [])
    .map((item) => String(item?._id || '').trim())
    .filter(Boolean);
  for (let index = ids.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const temp = ids[index];
    ids[index] = ids[swapIndex];
    ids[swapIndex] = temp;
  }
  return ids;
};

const applyOrderIds = (items, orderIds) => {
  const source = Array.isArray(items) ? items : [];
  const order = Array.isArray(orderIds) ? orderIds : [];
  if (!source.length) return [];
  if (!order.length) return source;

  const byId = new Map(source.map((item) => [String(item?._id || ''), item]));
  const sorted = [];
  const seen = new Set();

  for (const rawId of order) {
    const id = String(rawId || '').trim();
    if (!id || seen.has(id)) continue;
    const poem = byId.get(id);
    if (!poem) continue;
    sorted.push(poem);
    seen.add(id);
  }

  for (const poem of source) {
    const id = String(poem?._id || '').trim();
    if (!id || seen.has(id)) continue;
    sorted.push(poem);
  }

  return sorted;
};

const areOrdersEqual = (leftOrder, rightOrder) => (
  leftOrder.length === rightOrder.length
  && leftOrder.every((id, index) => id === rightOrder[index])
);

const buildNextRandomOrderIds = (items, previousOrderIds) => {
  const normalizedPrevious = applyOrderIds(items, previousOrderIds)
    .map((item) => String(item?._id || '').trim())
    .filter(Boolean);

  if (normalizedPrevious.length < 2) {
    return buildShuffledOrderIds(items);
  }

  let nextOrder = buildShuffledOrderIds(items);
  let attempt = 0;
  while (attempt < 5 && areOrdersEqual(nextOrder, normalizedPrevious)) {
    nextOrder = buildShuffledOrderIds(items);
    attempt += 1;
  }

  if (areOrdersEqual(nextOrder, normalizedPrevious)) {
    nextOrder = [...nextOrder].reverse();
  }

  return nextOrder;
};

const resolveLevelState = (countValue) => {
  const count = Math.max(0, Number.isFinite(countValue) ? countValue : 0);
  let currentLevelIndex = LEVELS.length - 1;
  let currentLevel = LEVELS[LEVELS.length - 1];
  for (let index = 0; index < LEVELS.length; index += 1) {
    const level = LEVELS[index];
    if (count <= level.max) {
      currentLevel = level;
      currentLevelIndex = index;
      break;
    }
  }

  const isMax = currentLevel.max === Number.POSITIVE_INFINITY;
  const nextLevel = currentLevelIndex < LEVELS.length - 1 ? LEVELS[currentLevelIndex + 1] : null;
  const nextGoal = isMax ? currentLevel.min : currentLevel.max + 1;
  const span = Math.max(1, (currentLevel.max - currentLevel.min + 1));
  const progress = isMax ? 100 : Math.min(100, Math.max(0, ((count - currentLevel.min + 1) / span) * 100));

  return {
    levelTitle: currentLevel.title,
    nextLevelTitle: nextLevel?.title || currentLevel.title,
    nextGoal,
    progress,
    isMax,
  };
};

const getGoalRamp = (progressValue) => {
  const progress = Number.isFinite(progressValue) ? progressValue : 0;
  if (progress >= 100) return 'r100';
  if (progress >= 95) return 'r95';
  if (progress >= 80) return 'r80';
  if (progress >= 60) return 'r60';
  return 'base';
};

const normalizeLevelUpPayload = (payload) => ({
  count: Math.max(0, Number.parseInt(String(payload?.count ?? 0), 10) || 0),
  streakDays: Math.max(0, Number.parseInt(String(payload?.streakDays ?? 0), 10) || 0),
  isStreakGlowOn: Boolean(payload?.isStreakGlowOn),
  streakLastDate: typeof payload?.streakLastDate === 'string' ? payload.streakLastDate : null,
  dailyGoalCount: Math.max(1, Number.parseInt(String(payload?.dailyGoalCount ?? 1), 10) || 1),
  dailyProgressCount: Math.max(0, Number.parseInt(String(payload?.dailyProgressCount ?? 0), 10) || 0),
  dailyCompleted: Boolean(payload?.dailyCompleted),
  dailyQuestDateKey: typeof payload?.dailyQuestDateKey === 'string' ? payload.dailyQuestDateKey : null,
  secondsUntilReset: Math.max(0, Number.parseInt(String(payload?.secondsUntilReset ?? 0), 10) || 0),
});

const formatResetCountdown = (totalSeconds) => {
  const safeSeconds = Math.max(0, Number.isFinite(totalSeconds) ? totalSeconds : 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const readErrorMessage = async (res, fallbackMessage) => {
  try {
    const data = await res.json();
    return data?.error || fallbackMessage;
  } catch (err) {
    return fallbackMessage;
  }
};

const normalizeKalamPayload = (payload, fallbackRoom = 'rutbah') => {
  const nextRoom = ['rutbah', 'belal'].includes(payload?.room) ? payload.room : fallbackRoom;
  const nextNotes = Array.isArray(payload?.notes)
    ? payload.notes
      .map((note) => ({
        parsedDate: new Date(note?.createdAt || Date.now()),
        noteId: String(note?.noteId || '').trim(),
        text: String(note?.text || '').trim(),
        createdAt: null,
      }))
      .map((note) => {
        const createdAt = Number.isFinite(note.parsedDate.getTime()) ? note.parsedDate.toISOString() : new Date().toISOString();
        return {
          noteId: note.noteId,
          text: note.text,
          createdAt,
        };
      })
      .filter((note) => note.noteId && note.text)
    : [];

  return {
    room: nextRoom,
    notes: nextNotes,
  };
};

const formatKalamTimestamp = (value) => {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return '';
  return parsed.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const normalizeMefilQuest = (payload) => {
  const parsedBossMax = Number.parseInt(String(payload?.bossMaxHp ?? BOSS_MAX_HP), 10);
  const parsedTeamMax = Number.parseInt(String(payload?.teamMaxHp ?? TEAM_MAX_HP), 10);
  const bossMaxHp = Number.isFinite(parsedBossMax) && parsedBossMax > 0 ? parsedBossMax : BOSS_MAX_HP;
  const teamMaxHp = Number.isFinite(parsedTeamMax) && parsedTeamMax > 0 ? parsedTeamMax : TEAM_MAX_HP;
  const parsedBossHp = Number.parseInt(String(payload?.bossHp ?? bossMaxHp), 10);
  const parsedTeamHp = Number.parseInt(String(payload?.teamHp ?? teamMaxHp), 10);
  const bossHp = Number.isFinite(parsedBossHp) ? Math.max(0, Math.min(bossMaxHp, parsedBossHp)) : bossMaxHp;
  const teamHp = Number.isFinite(parsedTeamHp) ? Math.max(0, Math.min(teamMaxHp, parsedTeamHp)) : teamMaxHp;
  const status = bossHp <= 0 ? 'won' : (teamHp <= 0 ? 'lost' : 'active');
  const lastActor = payload?.lastActor === 'rutbah' || payload?.lastActor === 'belal' ? payload.lastActor : null;
  const lastActionType = payload?.lastActionType === 'attack' || payload?.lastActionType === 'distracted'
    ? payload.lastActionType
    : null;
  const parsedLastDamage = Number.parseInt(String(payload?.lastDamage ?? ''), 10);
  const lastDamage = Number.isFinite(parsedLastDamage) ? parsedLastDamage : null;

  return {
    bossName: String(payload?.bossName || defaultQuestState.bossName),
    bossHp,
    bossMaxHp,
    teamHp,
    teamMaxHp,
    status,
    lastActionType,
    lastActor,
    lastDamage,
  };
};

const normalizeMefilPresenceEntry = (payload) => {
  const source = payload && typeof payload === 'object' ? payload : {};
  const parsedDuration = Number.parseInt(String(source.durationSeconds ?? POMODORO_SECONDS), 10);
  const durationSeconds = Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : POMODORO_SECONDS;
  const parsedRemaining = Number.parseInt(String(source.remainingSeconds ?? durationSeconds), 10);
  const remainingSeconds = Number.isFinite(parsedRemaining)
    ? Math.max(0, Math.min(durationSeconds, parsedRemaining))
    : durationSeconds;
  const status = MEFIL_STATUS_OPTIONS.includes(source.status) ? source.status : 'not_studying';

  return {
    status,
    isRunning: Boolean(source.isRunning),
    remainingSeconds,
    durationSeconds,
    endsAt: typeof source.endsAt === 'string' ? source.endsAt : null,
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : null,
  };
};

const normalizeMefilPresence = (payload) => {
  const source = payload && typeof payload === 'object' ? payload : {};
  return {
    belal: normalizeMefilPresenceEntry(source.belal),
    rutbah: normalizeMefilPresenceEntry(source.rutbah),
  };
};

const formatPomodoroClock = (totalSeconds) => {
  const safeSeconds = Math.max(0, Number.isFinite(totalSeconds) ? totalSeconds : 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const applySourcePayload = (payload, setPlaylists, setActivePlaylistId) => {
  const nextPlaylists = Array.isArray(payload?.playlists) ? payload.playlists : [];
  const nextActivePlaylistId = typeof payload?.activePlaylistId === 'string' ? payload.activePlaylistId : null;
  setPlaylists(nextPlaylists);
  setActivePlaylistId(nextActivePlaylistId);
};

const readYouTubePlaybackError = (errorCode) => {
  if (errorCode === 2) return 'Invalid YouTube request for this playlist.';
  if (errorCode === 5) return 'This YouTube playlist cannot be played in this browser.';
  if (errorCode === 100) return 'YouTube playlist/video not found or removed.';
  if (errorCode === 101 || errorCode === 150) return 'YouTube owner blocked embedded playback for this item.';
  return 'YouTube playback failed for this playlist.';
};

const parseYouTubePlaylistInput = (rawUrl) => {
  const text = String(rawUrl || '').trim();
  if (!text) {
    return { playlistId: null, error: 'YouTube playlist URL is required.' };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(text);
  } catch (err) {
    return { playlistId: null, error: 'Invalid URL. Paste a full YouTube playlist link.' };
  }

  const host = parsedUrl.hostname.toLowerCase();
  const allowedHosts = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com']);
  if (!allowedHosts.has(host)) {
    return { playlistId: null, error: 'Only youtube.com playlist URLs are supported.' };
  }

  const pathname = parsedUrl.pathname.replace(/\/+$/, '');
  if (pathname !== '/playlist') {
    return { playlistId: null, error: 'Use a playlist URL like https://www.youtube.com/playlist?list=...' };
  }

  const listId = parsedUrl.searchParams.get('list');
  if (!listId) {
    return { playlistId: null, error: 'Playlist ID is missing in URL.' };
  }

  if (!/^[A-Za-z0-9_-]+$/.test(listId)) {
    return { playlistId: null, error: 'Invalid YouTube playlist ID.' };
  }

  if (listId.toUpperCase().startsWith('RD')) {
    return { playlistId: null, error: 'Auto-mix/radio links are not supported. Paste a real playlist URL.' };
  }

  return { playlistId: listId, error: null, normalizedUrl: `https://www.youtube.com/playlist?list=${listId}` };
};

const FallingLeaves = () => {
  const [leaves, setLeaves] = useState([]);

  useEffect(() => {
    const interval = setInterval(() => {
      const id = Date.now();
      const left = Math.random() * 100;
      const duration = 5 + Math.random() * 10;
      const size = 20 + Math.random() * 30;

      setLeaves((prev) => [...prev, { id, left, duration, size }]);

      setTimeout(() => {
        setLeaves((prev) => prev.filter((leaf) => leaf.id !== id));
      }, duration * 1000);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="chinar-container">
      {leaves.map((leaf) => (
        <div
          key={leaf.id}
          className="leaf"
          style={{
            left: `${leaf.left}%`,
            animationDuration: `${leaf.duration}s`,
            width: `${leaf.size}px`,
            height: `${leaf.size}px`,
          }}
        />
      ))}
    </div>
  );
};

function App() {
  const YOUTUBE_ONLY_MODE = true;

  const [poems, setPoems] = useState([]);
  const [view, setView] = useState('gallery');
  const [selectedPoemId, setSelectedPoemId] = useState(null);
  const [currentTheme, setCurrentTheme] = useState('sukoon');
  const [isRandomOrderEnabled, setIsRandomOrderEnabled] = useState(false);
  const [randomOrderIds, setRandomOrderIds] = useState([]);
  const [isSemaMenuOpen, setIsSemaMenuOpen] = useState(false);
  const [selfCreatedCount, setSelfCreatedCount] = useState(0);
  const [streakDays, setStreakDays] = useState(0);
  const [isStreakGlowOn, setIsStreakGlowOn] = useState(false);
  const [streakLastDate, setStreakLastDate] = useState(null);
  const [dailyGoalCount, setDailyGoalCount] = useState(1);
  const [dailyProgressCount, setDailyProgressCount] = useState(0);
  const [dailyCompleted, setDailyCompleted] = useState(false);
  const [dailyQuestDateKey, setDailyQuestDateKey] = useState(null);
  const [secondsUntilReset, setSecondsUntilReset] = useState(0);
  const [isQuestPulseOn, setIsQuestPulseOn] = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [celebrationUntil, setCelebrationUntil] = useState(0);
  const [isKalamOpen, setIsKalamOpen] = useState(false);
  const [kalamRoom, setKalamRoom] = useState('rutbah');
  const [kalamNotes, setKalamNotes] = useState([]);
  const [kalamInput, setKalamInput] = useState('');
  const [kalamLoading, setKalamLoading] = useState(false);
  const [kalamSaving, setKalamSaving] = useState(false);
  const [kalamError, setKalamError] = useState('');
  const [isMefilOpen, setIsMefilOpen] = useState(false);
  const [mefilRole, setMefilRole] = useState(null);
  const [mefilLoggedIn, setMefilLoggedIn] = useState(false);
  const [mefilAuthLoading, setMefilAuthLoading] = useState(false);
  const [mefilLoginUsername, setMefilLoginUsername] = useState('belal');
  const [mefilLoginPassword, setMefilLoginPassword] = useState('');
  const [mefilLoginLoading, setMefilLoginLoading] = useState(false);
  const [mefilLoginError, setMefilLoginError] = useState('');
  const [questState, setQuestState] = useState(defaultQuestState);
  const [mefilPresence, setMefilPresence] = useState(defaultMefilPresence);
  const [questLoading, setQuestLoading] = useState(false);
  const [questError, setQuestError] = useState('');
  const [mefilActionLoading, setMefilActionLoading] = useState(false);
  const [mefilChatNotes, setMefilChatNotes] = useState([]);
  const [mefilChatInput, setMefilChatInput] = useState('');
  const [mefilChatLoading, setMefilChatLoading] = useState(false);
  const [mefilChatSaving, setMefilChatSaving] = useState(false);
  const [mefilChatError, setMefilChatError] = useState('');
  const galleryScrollYRef = useRef(0);
  const poemDetailCardRef = useRef(null);
  const poemDetailHeadingRef = useRef(null);
  const semaMenuRef = useRef(null);
  const celebrationCanvasRef = useRef(null);
  const kalamMessagesRef = useRef(null);
  const kalamFetchSeqRef = useRef(0);
  const mefilChatMessagesRef = useRef(null);
  const mefilChatInputRef = useRef(null);
  const mefilChatFetchSeqRef = useRef(0);
  const mefilStateFetchSeqRef = useRef(0);

  const [formData, setFormData] = useState({ title: '', poet: 'Ahmad Faraz', content: '', tags: [] });
  const [editingPoemId, setEditingPoemId] = useState(null);
  const [editData, setEditData] = useState({ title: '', poet: 'Ahmad Faraz', content: '', tags: [] });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [spotifyConfigured, setSpotifyConfigured] = useState(true);
  const [spotifyLoggedIn, setSpotifyLoggedIn] = useState(false);
  const [spotifyProfile, setSpotifyProfile] = useState(null);
  const [spotifyAuthLoading, setSpotifyAuthLoading] = useState(false);
  const [spotifyAuthError, setSpotifyAuthError] = useState('');

  const [spotifyPlaylists, setSpotifyPlaylists] = useState([]);
  const [activeSpotifyPlaylistId, setActiveSpotifyPlaylistId] = useState(null);
  const [spotifyUrlInput, setSpotifyUrlInput] = useState('');
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const [spotifySaving, setSpotifySaving] = useState(false);
  const [spotifyError, setSpotifyError] = useState('');
  const [spotifyNowPlaying, setSpotifyNowPlaying] = useState(false);
  const [spotifyPlayerReady, setSpotifyPlayerReady] = useState(false);
  const [spotifyPlayerError, setSpotifyPlayerError] = useState('');

  const [youtubePlaylists, setYoutubePlaylists] = useState([]);
  const [activeYoutubePlaylistId, setActiveYoutubePlaylistId] = useState(null);
  const [youtubeUrlInput, setYoutubeUrlInput] = useState('');
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [youtubeSaving, setYoutubeSaving] = useState(false);
  const [youtubeError, setYoutubeError] = useState('');
  const [youtubeNowPlaying, setYoutubeNowPlaying] = useState(false);
  const [youtubePlayerReady, setYoutubePlayerReady] = useState(false);
  const [youtubePlayerError, setYoutubePlayerError] = useState('');

  const spotifyPlayerRef = useRef(null);
  const spotifyDeviceIdRef = useRef('');
  const youtubePlayerRef = useRef(null);

  const [isMehfilOpen, setIsMehfilOpen] = useState(false);
  const [activeMehfilPoemId, setActiveMehfilPoemId] = useState(null);
  const [revealedLineCount, setRevealedLineCount] = useState(1);

  const isKnownPoet = (poetName) => POETS.includes(poetName);
  const selectPoetValue = (poetName) => (isKnownPoet(poetName) ? poetName : OTHER_POET_VALUE);
  const selectedPoem = poems.find((poem) => poem._id === selectedPoemId) || null;
  const activeMehfilPoem = poems.find((poem) => poem._id === activeMehfilPoemId) || null;

  const activeSpotifyPlaylist = spotifyPlaylists.find((playlist) => playlist.playlistId === activeSpotifyPlaylistId) || null;
  const spotifyAvailable = spotifyConfigured;
  const canManageSpotify = spotifyAvailable && spotifyLoggedIn;
  const canControlYouTubePlaylist = youtubePlayerReady && Boolean(activeYoutubePlaylistId) && !youtubeSaving;

  const setTheme = (themeKey) => {
    if (!THEMES.includes(themeKey)) return;
    setCurrentTheme(themeKey);
  };

  const cycleTheme = () => {
    const currentIndex = THEMES.indexOf(currentTheme);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % THEMES.length : 0;
    setTheme(THEMES[nextIndex]);
  };

  const getPreviewLines = (content) => {
    if (typeof content !== 'string') return [''];
    return content.split(/\r?\n/).slice(0, 2);
  };

  const poemLines = activeMehfilPoem ? activeMehfilPoem.content.split(/\r?\n/) : [];
  const totalMehfilLines = Math.max(poemLines.length, 1);
  const safeRevealedLineCount = Math.min(Math.max(revealedLineCount, 1), totalMehfilLines);
  const mehfilProgress = (safeRevealedLineCount / totalMehfilLines) * 100;
  const displayPoems = isRandomOrderEnabled ? applyOrderIds(poems, randomOrderIds) : poems;
  const levelState = resolveLevelState(selfCreatedCount);
  const levelRemaining = levelState.isMax ? 0 : Math.max(levelState.nextGoal - selfCreatedCount, 0);
  const goalRamp = getGoalRamp(levelState.progress);
  const safeDailyGoal = Math.max(1, dailyGoalCount);
  const safeDailyProgress = Math.min(Math.max(dailyProgressCount, 0), safeDailyGoal);
  const dailyQuestProgressPercent = Math.min(100, Math.max(0, (safeDailyProgress / safeDailyGoal) * 100));
  const dailyResetLabel = formatResetCountdown(secondsUntilReset);
  const bossHpPercent = Math.min(100, Math.max(0, (questState.bossHp / Math.max(1, questState.bossMaxHp || BOSS_MAX_HP)) * 100));
  const teamHpPercent = Math.min(100, Math.max(0, (questState.teamHp / Math.max(1, questState.teamMaxHp || TEAM_MAX_HP)) * 100));
  const activeMefilRole = mefilRole || 'belal';
  const activePresenceEntry = mefilPresence[activeMefilRole] || defaultMefilPresenceEntry;
  const canUseMefilActions = mefilLoggedIn && Boolean(mefilRole);
  const canAttackBoss = (
    canUseMefilActions
    && !questLoading
    && !mefilActionLoading
    && questState.status === 'active'
    && !activePresenceEntry.isRunning
    && activePresenceEntry.remainingSeconds === 0
  );
  const canUseDistracted = canUseMefilActions && !questLoading && !mefilActionLoading && questState.status === 'active';

  const fetchPoems = async () => {
    try {
      const res = await fetch('/api/poems');
      if (!res.ok) throw new Error(`Fetch failed with status ${res.status}`);
      const data = await res.json();
      setPoems(data);
    } catch (err) {
      console.error(err);
    }
  };

  const applyLevelUpPayload = (payload) => {
    const normalized = normalizeLevelUpPayload(payload);
    setSelfCreatedCount(normalized.count);
    setStreakDays(normalized.streakDays);
    setIsStreakGlowOn(normalized.isStreakGlowOn);
    setStreakLastDate(normalized.streakLastDate);
    setDailyGoalCount(normalized.dailyGoalCount);
    setDailyProgressCount(normalized.dailyProgressCount);
    setDailyCompleted(normalized.dailyCompleted);
    setDailyQuestDateKey(normalized.dailyQuestDateKey);
    setSecondsUntilReset(normalized.secondsUntilReset);
  };

  const fetchLevelUp = async () => {
    try {
      const res = await fetch('/api/levelup');
      if (!res.ok) {
        const message = await readErrorMessage(res, 'Unable to load level up progress.');
        throw new Error(message);
      }
      const data = await res.json();
      applyLevelUpPayload(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchKalamNotes = async (room = kalamRoom, options = {}) => {
    const normalizedRoom = ['rutbah', 'belal'].includes(room) ? room : 'rutbah';
    const { silent = false } = options;
    const requestSeq = kalamFetchSeqRef.current + 1;
    kalamFetchSeqRef.current = requestSeq;

    if (!silent) {
      setKalamLoading(true);
    }

    try {
      const res = await fetch(`/api/kalam/notes?room=${encodeURIComponent(normalizedRoom)}`);
      if (!res.ok) {
        const message = await readErrorMessage(res, 'Unable to load Kalam notes.');
        throw new Error(message);
      }
      const data = await res.json();
      if (kalamFetchSeqRef.current !== requestSeq) return;
      const normalized = normalizeKalamPayload(data, normalizedRoom);
      setKalamNotes(normalized.notes);
      setKalamError('');
    } catch (err) {
      if (kalamFetchSeqRef.current !== requestSeq) return;
      console.error(err);
      setKalamError(err.message || 'Unable to load Kalam notes.');
    } finally {
      if (kalamFetchSeqRef.current === requestSeq && !silent) {
        setKalamLoading(false);
      }
    }
  };

  const handleOpenKalam = () => {
    setIsKalamOpen(true);
    fetchKalamNotes(kalamRoom);
  };

  const handleCloseKalam = () => {
    setIsKalamOpen(false);
    setKalamError('');
  };

  const handleSwitchKalamRoom = (room) => {
    const normalizedRoom = ['rutbah', 'belal'].includes(room) ? room : 'rutbah';
    if (normalizedRoom === kalamRoom) return;
    setKalamRoom(normalizedRoom);
    setKalamNotes([]);
    setKalamError('');
    fetchKalamNotes(normalizedRoom);
  };

  const handleSendKalamNote = async (e) => {
    e.preventDefault();
    const text = kalamInput.trim();
    if (!text) {
      setKalamError('Note text is required.');
      return;
    }

    kalamFetchSeqRef.current += 1;
    setKalamSaving(true);
    try {
      const res = await fetch('/api/kalam/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: kalamRoom, text })
      });
      if (!res.ok) {
        const message = await readErrorMessage(res, 'Unable to save Kalam note.');
        throw new Error(message);
      }

      const data = await res.json();
      const normalized = normalizeKalamPayload(data, kalamRoom);
      setKalamNotes(normalized.notes);
      setKalamInput('');
      setKalamError('');
    } catch (err) {
      console.error(err);
      setKalamError(err.message || 'Unable to save Kalam note.');
    } finally {
      setKalamSaving(false);
    }
  };

  const applyMefilStatePayload = (payload) => {
    setQuestState(normalizeMefilQuest(payload?.quest || payload));
    setMefilPresence(normalizeMefilPresence(payload?.presence));
  };

  const resetMefilAuthState = () => {
    setMefilLoggedIn(false);
    setMefilRole(null);
    setMefilChatNotes([]);
    setMefilChatInput('');
    setMefilActionLoading(false);
  };

  const handleMefilUnauthorized = (message = 'Mefil login required') => {
    resetMefilAuthState();
    setMefilLoginError(message);
    setQuestError(message);
    setMefilChatError(message);
  };

  const fetchMefilSession = async ({ silent = false } = {}) => {
    if (!silent) setMefilAuthLoading(true);
    try {
      const res = await fetch('/api/mefil/auth/session');
      if (!res.ok) {
        const message = await readErrorMessage(res, 'Unable to verify Mefil session.');
        throw new Error(message);
      }
      const data = await res.json();
      if (data?.loggedIn && (data?.role === 'belal' || data?.role === 'rutbah')) {
        setMefilLoggedIn(true);
        setMefilRole(data.role);
        setMefilLoginError('');
        return true;
      }
      resetMefilAuthState();
      return false;
    } catch (err) {
      console.error(err);
      resetMefilAuthState();
      setMefilLoginError(err.message || 'Unable to verify Mefil session.');
      return false;
    } finally {
      if (!silent) setMefilAuthLoading(false);
    }
  };

  const fetchMefilState = async ({ silent = false } = {}) => {
    const requestSeq = mefilStateFetchSeqRef.current + 1;
    mefilStateFetchSeqRef.current = requestSeq;
    if (!silent) setQuestLoading(true);
    try {
      const res = await fetch('/api/mefil/state');
      if (res.status === 401) {
        const message = await readErrorMessage(res, 'Mefil login required');
        handleMefilUnauthorized(message);
        return;
      }
      if (!res.ok) {
        const message = await readErrorMessage(res, 'Unable to load Mefil state.');
        throw new Error(message);
      }
      const data = await res.json();
      if (mefilStateFetchSeqRef.current !== requestSeq) return;
      applyMefilStatePayload(data);
      setQuestError('');
    } catch (err) {
      if (mefilStateFetchSeqRef.current !== requestSeq) return;
      console.error(err);
      setQuestError(err.message || 'Unable to load Mefil state.');
    } finally {
      if (mefilStateFetchSeqRef.current === requestSeq && !silent) setQuestLoading(false);
    }
  };

  const fetchMefilChatNotes = async (options = {}) => {
    if (!mefilLoggedIn || !mefilRole) return;
    const { silent = false } = options;
    const requestSeq = mefilChatFetchSeqRef.current + 1;
    mefilChatFetchSeqRef.current = requestSeq;

    if (!silent) {
      setMefilChatLoading(true);
    }

    try {
      const res = await fetch('/api/mefil/chat');
      if (res.status === 401) {
        const message = await readErrorMessage(res, 'Mefil login required');
        handleMefilUnauthorized(message);
        return;
      }
      if (!res.ok) {
        const message = await readErrorMessage(res, 'Unable to load Mefil chat.');
        throw new Error(message);
      }
      const data = await res.json();
      if (mefilChatFetchSeqRef.current !== requestSeq) return;
      const normalized = normalizeKalamPayload(data, mefilRole);
      setMefilChatNotes(normalized.notes);
      setMefilChatError('');
    } catch (err) {
      if (mefilChatFetchSeqRef.current !== requestSeq) return;
      console.error(err);
      setMefilChatError(err.message || 'Unable to load Mefil chat.');
    } finally {
      if (mefilChatFetchSeqRef.current === requestSeq && !silent) {
        setMefilChatLoading(false);
      }
    }
  };

  const handleOpenMefil = () => {
    setIsMefilOpen(true);
    setMefilLoginError('');
    setQuestError('');
    setMefilChatError('');
  };

  const handleCloseMefil = () => {
    setIsMefilOpen(false);
    setMefilChatError('');
  };

  const handleMefilLogin = async (e) => {
    e.preventDefault();
    if (!['belal', 'rutbah'].includes(mefilLoginUsername)) {
      setMefilLoginError('Choose Belal or Rutbah.');
      return;
    }
    if (!mefilLoginPassword.trim()) {
      setMefilLoginError('Password is required.');
      return;
    }

    setMefilLoginLoading(true);
    try {
      const res = await fetch('/api/mefil/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: mefilLoginUsername,
          password: mefilLoginPassword,
        }),
      });
      if (!res.ok) {
        const message = await readErrorMessage(res, 'Unable to login to Mefil.');
        throw new Error(message);
      }
      const data = await res.json();
      if (!data?.role) {
        throw new Error('Invalid login response.');
      }
      setMefilLoggedIn(true);
      setMefilRole(data.role);
      setMefilLoginPassword('');
      setMefilLoginError('');
      setQuestError('');
      setMefilChatError('');
    } catch (err) {
      console.error(err);
      setMefilLoginError(err.message || 'Unable to login to Mefil.');
    } finally {
      setMefilLoginLoading(false);
    }
  };

  const handleMefilLogout = async () => {
    setMefilActionLoading(true);
    try {
      await fetch('/api/mefil/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      resetMefilAuthState();
      setQuestError('');
      setMefilChatError('');
      setMefilLoginError('');
    } catch (err) {
      console.error(err);
      resetMefilAuthState();
    } finally {
      setMefilActionLoading(false);
    }
  };

  const handleMefilStatusChange = async (status) => {
    if (!canUseMefilActions) return;
    if (!MEFIL_STATUS_OPTIONS.includes(status)) return;
    setMefilActionLoading(true);
    try {
      const res = await fetch('/api/mefil/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.status === 401) {
        const message = await readErrorMessage(res, 'Mefil login required');
        handleMefilUnauthorized(message);
        return;
      }
      if (!res.ok) {
        const message = await readErrorMessage(res, 'Failed to update status.');
        throw new Error(message);
      }
      const data = await res.json();
      if (data?.presence) {
        setMefilPresence(normalizeMefilPresence(data.presence));
      } else {
        await fetchMefilState({ silent: true });
      }
      setQuestError('');
    } catch (err) {
      console.error(err);
      setQuestError(err.message || 'Failed to update status.');
    } finally {
      setMefilActionLoading(false);
    }
  };

  const handlePomodoroStart = async () => {
    if (!canUseMefilActions) return;
    setMefilActionLoading(true);
    try {
      const res = await fetch('/api/mefil/pomodoro/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.status === 401) {
        const message = await readErrorMessage(res, 'Mefil login required');
        handleMefilUnauthorized(message);
        return;
      }
      if (!res.ok) {
        const message = await readErrorMessage(res, 'Failed to start Pomodoro.');
        throw new Error(message);
      }
      const data = await res.json();
      if (data?.presence) {
        setMefilPresence(normalizeMefilPresence(data.presence));
      } else {
        await fetchMefilState({ silent: true });
      }
      setQuestError('');
    } catch (err) {
      console.error(err);
      setQuestError(err.message || 'Failed to start Pomodoro.');
    } finally {
      setMefilActionLoading(false);
    }
  };

  const handlePomodoroPause = async () => {
    if (!canUseMefilActions) return;
    setMefilActionLoading(true);
    try {
      const res = await fetch('/api/mefil/pomodoro/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.status === 401) {
        const message = await readErrorMessage(res, 'Mefil login required');
        handleMefilUnauthorized(message);
        return;
      }
      if (!res.ok) {
        const message = await readErrorMessage(res, 'Failed to pause Pomodoro.');
        throw new Error(message);
      }
      const data = await res.json();
      if (data?.presence) {
        setMefilPresence(normalizeMefilPresence(data.presence));
      } else {
        await fetchMefilState({ silent: true });
      }
      setQuestError('');
    } catch (err) {
      console.error(err);
      setQuestError(err.message || 'Failed to pause Pomodoro.');
    } finally {
      setMefilActionLoading(false);
    }
  };

  const handlePomodoroReset = async () => {
    if (!canUseMefilActions) return;
    setMefilActionLoading(true);
    try {
      const res = await fetch('/api/mefil/pomodoro/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.status === 401) {
        const message = await readErrorMessage(res, 'Mefil login required');
        handleMefilUnauthorized(message);
        return;
      }
      if (!res.ok) {
        const message = await readErrorMessage(res, 'Failed to reset Pomodoro.');
        throw new Error(message);
      }
      const data = await res.json();
      if (data?.presence) {
        setMefilPresence(normalizeMefilPresence(data.presence));
      } else {
        await fetchMefilState({ silent: true });
      }
      setQuestError('');
    } catch (err) {
      console.error(err);
      setQuestError(err.message || 'Failed to reset Pomodoro.');
    } finally {
      setMefilActionLoading(false);
    }
  };

  const handleBossAttack = async () => {
    if (!canAttackBoss) return;
    setMefilActionLoading(true);
    try {
      const res = await fetch('/api/mefil/pomodoro/complete-attack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.status === 401) {
        const message = await readErrorMessage(res, 'Mefil login required');
        handleMefilUnauthorized(message);
        return;
      }
      if (!res.ok) {
        const message = await readErrorMessage(res, 'Failed to complete Pomodoro attack.');
        throw new Error(message);
      }
      const data = await res.json();
      applyMefilStatePayload(data);
      setQuestError('');
    } catch (err) {
      console.error(err);
      setQuestError(err.message || 'Failed to complete Pomodoro attack.');
    } finally {
      setMefilActionLoading(false);
    }
  };

  const handleMefilDistracted = async () => {
    if (!canUseDistracted) return;
    setMefilActionLoading(true);
    try {
      const res = await fetch('/api/mefil/distracted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.status === 401) {
        const message = await readErrorMessage(res, 'Mefil login required');
        handleMefilUnauthorized(message);
        return;
      }
      if (!res.ok) {
        const message = await readErrorMessage(res, 'Failed to record distraction.');
        throw new Error(message);
      }
      await fetchMefilState({ silent: true });
      setQuestError('');
    } catch (err) {
      console.error(err);
      setQuestError(err.message || 'Failed to record distraction.');
    } finally {
      setMefilActionLoading(false);
    }
  };

  const handleQuestReset = async () => {
    if (!canUseMefilActions) return;
    setMefilActionLoading(true);
    try {
      const res = await fetch('/api/mefil/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.status === 401) {
        const message = await readErrorMessage(res, 'Mefil login required');
        handleMefilUnauthorized(message);
        return;
      }
      if (!res.ok) {
        const message = await readErrorMessage(res, 'Failed to reset quest.');
        throw new Error(message);
      }
      const data = await res.json();
      setQuestState(normalizeMefilQuest(data));
      setQuestError('');
    } catch (err) {
      console.error(err);
      setQuestError(err.message || 'Failed to reset quest.');
    } finally {
      setMefilActionLoading(false);
    }
  };

  const handleSendMefilNote = async (e) => {
    e.preventDefault();
    if (!canUseMefilActions || !mefilRole) return;
    const text = mefilChatInput.trim();
    if (!text) {
      setMefilChatError('Message is required.');
      return;
    }

    mefilChatFetchSeqRef.current += 1;
    setMefilChatSaving(true);
    try {
      const res = await fetch('/api/mefil/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (res.status === 401) {
        const message = await readErrorMessage(res, 'Mefil login required');
        handleMefilUnauthorized(message);
        return;
      }
      if (!res.ok) {
        const message = await readErrorMessage(res, 'Unable to send message.');
        throw new Error(message);
      }

      const data = await res.json();
      const normalized = normalizeKalamPayload(data, mefilRole);
      setMefilChatNotes(normalized.notes);
      setMefilChatInput('');
      setMefilChatError('');
    } catch (err) {
      console.error(err);
      setMefilChatError(err.message || 'Unable to send message.');
    } finally {
      setMefilChatSaving(false);
    }
  };

  const triggerCelebration = (durationSeconds = 10) => {
    const durationMs = Math.max(1000, Number.parseInt(String(durationSeconds || 10), 10) * 1000);
    setCelebrationUntil(Date.now() + durationMs);
    setIsCelebrating(true);
  };

  const incrementLevelUp = async () => {
    const res = await fetch('/api/levelup/increment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const message = await readErrorMessage(res, 'Unable to update level up progress.');
      throw new Error(message);
    }
    const data = await res.json();
    applyLevelUpPayload(data);
    if (data?.celebrate) {
      triggerCelebration(data?.celebrationSeconds || 10);
    }
    if (data?.questJustCompleted) {
      setIsQuestPulseOn(true);
    }
  };

  const fetchSpotifyPlaylists = async (forceEnabled = spotifyLoggedIn) => {
    if (!forceEnabled) {
      setSpotifyPlaylists([]);
      setActiveSpotifyPlaylistId(null);
      return;
    }

    setSpotifyLoading(true);
    try {
      const res = await fetch('/api/music/spotify/playlists');
      if (!res.ok) {
        const message = await readErrorMessage(res, 'Unable to load Spotify playlists.');
        throw new Error(message);
      }
      const data = await res.json();
      applySourcePayload(data, setSpotifyPlaylists, setActiveSpotifyPlaylistId);
      setSpotifyError('');
    } catch (err) {
      console.error(err);
      setSpotifyError(err.message || 'Unable to load Spotify playlists.');
    } finally {
      setSpotifyLoading(false);
    }
  };

  const fetchYouTubePlaylists = async () => {
    setYoutubeLoading(true);
    try {
      const res = await fetch('/api/music/youtube/playlists');
      if (!res.ok) {
        const message = await readErrorMessage(res, 'Unable to load YouTube playlists.');
        throw new Error(message);
      }
      const data = await res.json();
      applySourcePayload(data, setYoutubePlaylists, setActiveYoutubePlaylistId);
      setYoutubeError('');
    } catch (err) {
      console.error(err);
      setYoutubeError(err.message || 'Unable to load YouTube playlists.');
    } finally {
      setYoutubeLoading(false);
    }
  };

  const fetchSpotifySession = async () => {
    setSpotifyAuthLoading(true);
    try {
      const res = await fetch('/api/spotify/session');
      if (!res.ok) {
        const message = await readErrorMessage(res, 'Unable to read Spotify session.');
        throw new Error(message);
      }

      const data = await res.json();
      setSpotifyConfigured(Boolean(data?.configured ?? true));
      setSpotifyLoggedIn(Boolean(data?.loggedIn));
      setSpotifyProfile(data?.profile || null);

      if (data?.loggedIn) {
        await fetchSpotifyPlaylists(true);
      } else {
        setSpotifyPlaylists([]);
        setActiveSpotifyPlaylistId(null);
        setSpotifyNowPlaying(false);
        setSpotifyPlayerReady(false);
      }
    } catch (err) {
      console.error(err);
      setSpotifyLoggedIn(false);
      setSpotifyProfile(null);
      setSpotifyPlaylists([]);
      setActiveSpotifyPlaylistId(null);
      setSpotifyAuthError(err.message || 'Unable to read Spotify session.');
    } finally {
      setSpotifyAuthLoading(false);
    }
  };

  const pauseSpotifyPlayback = async () => {
    if (!spotifyConfigured) return;
    if (!spotifyLoggedIn) return;

    try {
      const res = await fetch('/api/spotify/player/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: spotifyDeviceIdRef.current || undefined })
      });

      if (!res.ok) {
        const message = await readErrorMessage(res, 'Unable to pause Spotify playback.');
        throw new Error(message);
      }

      setSpotifyNowPlaying(false);
      setSpotifyPlayerError('');
    } catch (err) {
      console.error(err);
      setSpotifyPlayerError(err.message || 'Unable to pause Spotify playback.');
    }
  };

  const startSpotifyPlayback = async (playlistId) => {
    if (!spotifyConfigured) {
      setSpotifyPlayerError('Spotify is not configured on this server.');
      return;
    }

    if (!spotifyLoggedIn) {
      setSpotifyError('Please log in with Spotify to play Spotify playlists.');
      return;
    }

    if (!spotifyDeviceIdRef.current || !spotifyPlayerReady) {
      setSpotifyPlayerError('Spotify player is still starting. Wait a moment and try again.');
      return;
    }

    if (youtubeNowPlaying && youtubePlayerRef.current) {
      try {
        youtubePlayerRef.current.pauseVideo();
      } catch (err) {
        console.error(err);
      }
      setYoutubeNowPlaying(false);
    }

    setSpotifySaving(true);
    try {
      const transferRes = await fetch('/api/spotify/player/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: spotifyDeviceIdRef.current })
      });

      if (!transferRes.ok) {
        const message = await readErrorMessage(transferRes, 'Unable to prepare Spotify player.');
        throw new Error(message);
      }

      const playRes = await fetch('/api/spotify/player/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistId, deviceId: spotifyDeviceIdRef.current })
      });

      if (!playRes.ok) {
        const message = await readErrorMessage(playRes, 'Unable to start Spotify playback.');
        throw new Error(message);
      }

      setSpotifyNowPlaying(true);
      setSpotifyPlayerError('');
    } catch (err) {
      console.error(err);
      setSpotifyPlayerError(err.message || 'Unable to start Spotify playback.');
    } finally {
      setSpotifySaving(false);
    }
  };

  const startYouTubePlayback = async (playlistId) => {
    if (!youtubePlayerRef.current || !youtubePlayerReady) {
      setYoutubePlayerError('YouTube player is still loading. Wait a moment and try again.');
      return;
    }

    if (spotifyNowPlaying) {
      await pauseSpotifyPlayback();
    }

    try {
      setYoutubePlayerError('');
      setYoutubeNowPlaying(false);
      youtubePlayerRef.current.loadPlaylist({
        listType: 'playlist',
        list: playlistId,
        index: 0,
        startSeconds: 0
      });
      youtubePlayerRef.current.playVideo();
    } catch (err) {
      console.error(err);
      setYoutubeNowPlaying(false);
      setYoutubePlayerError('Unable to start YouTube playback.');
    }
  };

  const pauseYouTubePlayback = () => {
    if (!youtubePlayerRef.current || !youtubeNowPlaying) return;
    try {
      youtubePlayerRef.current.pauseVideo();
      setYoutubeNowPlaying(false);
      setYoutubePlayerError('');
    } catch (err) {
      console.error(err);
      setYoutubePlayerError('Unable to pause YouTube playback.');
    }
  };

  const playYouTubePlayback = async () => {
    if (!activeYoutubePlaylistId) {
      setYoutubePlayerError('Select a playlist first.');
      return;
    }
    if (!youtubePlayerRef.current || !youtubePlayerReady) {
      setYoutubePlayerError('YouTube player is still loading. Wait a moment and try again.');
      return;
    }

    if (spotifyNowPlaying) {
      await pauseSpotifyPlayback();
    }

    try {
      const playlist = typeof youtubePlayerRef.current.getPlaylist === 'function'
        ? youtubePlayerRef.current.getPlaylist()
        : null;
      const hasLoadedPlaylist = Array.isArray(playlist) && playlist.length > 0;

      if (!hasLoadedPlaylist) {
        await startYouTubePlayback(activeYoutubePlaylistId);
        return;
      }

      youtubePlayerRef.current.playVideo();
      setYoutubeNowPlaying(true);
      setYoutubePlayerError('');
    } catch (err) {
      console.error(err);
      setYoutubeNowPlaying(false);
      setYoutubePlayerError('Unable to resume YouTube playback.');
    }
  };

  const handleYouTubePrevious = () => {
    if (!youtubePlayerRef.current || !youtubePlayerReady || !activeYoutubePlaylistId) return;
    try {
      youtubePlayerRef.current.previousVideo();
      youtubePlayerRef.current.playVideo();
      setYoutubeNowPlaying(true);
      setYoutubePlayerError('');
    } catch (err) {
      console.error(err);
      setYoutubeNowPlaying(false);
      setYoutubePlayerError('Unable to move to previous track.');
    }
  };

  const handleYouTubeNext = () => {
    if (!youtubePlayerRef.current || !youtubePlayerReady || !activeYoutubePlaylistId) return;
    try {
      youtubePlayerRef.current.nextVideo();
      youtubePlayerRef.current.playVideo();
      setYoutubeNowPlaying(true);
      setYoutubePlayerError('');
    } catch (err) {
      console.error(err);
      setYoutubeNowPlaying(false);
      setYoutubePlayerError('Unable to move to next track.');
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const spotifyErrorParam = params.get('spotify_error');
    const connectedParam = params.get('spotify');

    if (spotifyErrorParam) {
      setSpotifyAuthError(`Spotify login failed: ${spotifyErrorParam}`);
    }

    if (spotifyErrorParam || connectedParam) {
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);
    }

    fetchPoems();
    fetchLevelUp();
    fetchYouTubePlaylists();
    if (!YOUTUBE_ONLY_MODE) {
      fetchSpotifySession();
    }
  }, []);

  useEffect(() => {
    if (!spotifyConfigured || !spotifyLoggedIn) {
      if (spotifyPlayerRef.current) {
        spotifyPlayerRef.current.disconnect();
        spotifyPlayerRef.current = null;
      }
      spotifyDeviceIdRef.current = '';
      setSpotifyPlayerReady(false);
      setSpotifyNowPlaying(false);
      return;
    }

    let cancelled = false;

    const initSpotifyPlayer = () => {
      if (cancelled || !window.Spotify || spotifyPlayerRef.current) return;

      const player = new window.Spotify.Player({
        name: 'Sufi Dervish Player',
        getOAuthToken: async (cb) => {
          try {
            const res = await fetch('/api/spotify/access-token');
            if (!res.ok) {
              const message = await readErrorMessage(res, 'Unable to read Spotify access token.');
              throw new Error(message);
            }
            const data = await res.json();
            cb(data.accessToken);
          } catch (err) {
            console.error(err);
            setSpotifyPlayerError(err.message || 'Unable to authorize Spotify player.');
          }
        },
        volume: 0.8
      });

      player.addListener('ready', ({ device_id: deviceId }) => {
        spotifyDeviceIdRef.current = deviceId;
        setSpotifyPlayerReady(true);
        setSpotifyPlayerError('');
      });

      player.addListener('not_ready', () => {
        setSpotifyPlayerReady(false);
      });

      player.addListener('player_state_changed', (state) => {
        if (!state) return;
        setSpotifyNowPlaying(!state.paused);
      });

      player.addListener('initialization_error', ({ message }) => setSpotifyPlayerError(message));
      player.addListener('authentication_error', ({ message }) => setSpotifyPlayerError(message));
      player.addListener('account_error', ({ message }) => setSpotifyPlayerError(message));
      player.addListener('playback_error', ({ message }) => setSpotifyPlayerError(message));

      player.connect();
      spotifyPlayerRef.current = player;
    };

    if (window.Spotify) {
      initSpotifyPlayer();
      return () => {
        cancelled = true;
      };
    }

    const existingScript = document.getElementById('spotify-web-playback-sdk');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'spotify-web-playback-sdk';
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;
      document.body.appendChild(script);
    }

    const previousReady = window.onSpotifyWebPlaybackSDKReady;
    window.onSpotifyWebPlaybackSDKReady = () => {
      if (typeof previousReady === 'function') previousReady();
      initSpotifyPlayer();
    };

    return () => {
      cancelled = true;
    };
  }, [spotifyConfigured, spotifyLoggedIn]);

  useEffect(() => {
    let cancelled = false;

    const createYouTubePlayer = () => {
      if (cancelled || !window.YT || !window.YT.Player || youtubePlayerRef.current) return;

      youtubePlayerRef.current = new window.YT.Player('youtube-persistent-player', {
        height: '0',
        width: '0',
        playerVars: {
          autoplay: 0,
          controls: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1
        },
        events: {
          onReady: () => {
            setYoutubePlayerReady(true);
            setYoutubePlayerError('');
          },
          onStateChange: (event) => {
            if (!window.YT || !window.YT.PlayerState) return;
            if (event.data === window.YT.PlayerState.PLAYING) {
              setYoutubeNowPlaying(true);
              setYoutubePlayerError('');
            }
            if (
              event.data === window.YT.PlayerState.PAUSED
              || event.data === window.YT.PlayerState.ENDED
              || event.data === window.YT.PlayerState.CUED
            ) {
              setYoutubeNowPlaying(false);
            }
          },
          onError: (event) => {
            setYoutubeNowPlaying(false);
            setYoutubePlayerError(readYouTubePlaybackError(event?.data));
          }
        }
      });
    };

    if (window.YT && window.YT.Player) {
      createYouTubePlayer();
      return () => {
        cancelled = true;
      };
    }

    const existingScript = document.getElementById('youtube-iframe-api');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'youtube-iframe-api';
      script.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(script);
    }

    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previousReady === 'function') previousReady();
      createYouTubePlayer();
    };

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => {
    if (spotifyPlayerRef.current) {
      spotifyPlayerRef.current.disconnect();
      spotifyPlayerRef.current = null;
    }

    if (youtubePlayerRef.current) {
      try {
        youtubePlayerRef.current.destroy();
      } catch (err) {
        console.error(err);
      }
      youtubePlayerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (activeYoutubePlaylistId) return;
    setYoutubeNowPlaying(false);
  }, [activeYoutubePlaylistId]);

  useEffect(() => {
    if (!isMehfilOpen) return;

    if (poems.length === 0) {
      setIsMehfilOpen(false);
      setActiveMehfilPoemId(null);
      return;
    }

    const activeExists = poems.some((poem) => poem._id === activeMehfilPoemId);
    if (!activeExists) {
      setActiveMehfilPoemId(poems[0]._id);
      setRevealedLineCount(1);
    }
  }, [isMehfilOpen, poems, activeMehfilPoemId]);

  useEffect(() => {
    if (!isMehfilOpen && !isKalamOpen && !isMefilOpen) return undefined;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isMehfilOpen, isKalamOpen, isMefilOpen]);

  useEffect(() => {
    if (!isKalamOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsKalamOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isKalamOpen]);

  useEffect(() => {
    if (!isMefilOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsMefilOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMefilOpen]);

  useEffect(() => {
    if (!isMehfilOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsMehfilOpen(false);
        setActiveMehfilPoemId(null);
        setRevealedLineCount(1);
        return;
      }

      if (!poems.length) return;

      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        const currentIndex = poems.findIndex((poem) => poem._id === activeMehfilPoemId);
        const anchorIndex = currentIndex >= 0 ? currentIndex : 0;
        const offset = event.key === 'ArrowRight' ? 1 : -1;
        const nextIndex = (anchorIndex + offset + poems.length) % poems.length;
        setActiveMehfilPoemId(poems[nextIndex]._id);
        setRevealedLineCount(1);
        return;
      }

      if (event.key === 'ArrowDown' || event.key === ' ' || event.code === 'Space') {
        event.preventDefault();
        setRevealedLineCount((prev) => Math.min(prev + 1, Math.max(poemLines.length, 1)));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMehfilOpen, poems, activeMehfilPoemId, poemLines.length]);

  useEffect(() => {
    const storedThemeRaw = window.localStorage.getItem(THEME_STORAGE_KEY);
    let storedTheme = storedThemeRaw;
    if (storedTheme === 'ishq') {
      setCurrentTheme('noor');
      window.localStorage.setItem(THEME_STORAGE_KEY, 'noor');
      return;
    }
    if (storedTheme === 'fanaa') {
      storedTheme = 'shahi';
      window.localStorage.setItem(THEME_STORAGE_KEY, storedTheme);
    }
    if (THEMES.includes(storedTheme)) {
      setCurrentTheme(storedTheme);
    }
  }, []);

  useEffect(() => {
    const storedRandomize = window.localStorage.getItem(RANDOMIZE_ENABLED_STORAGE_KEY) === '1';
    let storedOrder = [];
    try {
      const parsed = JSON.parse(window.localStorage.getItem(RANDOMIZE_ORDER_STORAGE_KEY) || '[]');
      storedOrder = Array.isArray(parsed) ? parsed.map((id) => String(id || '').trim()).filter(Boolean) : [];
    } catch (err) {
      storedOrder = [];
    }
    setIsRandomOrderEnabled(storedRandomize);
    setRandomOrderIds(storedOrder);
  }, []);

  useEffect(() => {
    const themeClasses = THEMES.map((theme) => `theme-${theme}`);
    document.body.classList.remove(...themeClasses);
    document.body.classList.add(`theme-${currentTheme}`);
    window.localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
    return () => {
      document.body.classList.remove(...themeClasses);
    };
  }, [currentTheme]);

  useEffect(() => {
    window.localStorage.setItem(RANDOMIZE_ENABLED_STORAGE_KEY, isRandomOrderEnabled ? '1' : '0');
  }, [isRandomOrderEnabled]);

  useEffect(() => {
    window.localStorage.setItem(RANDOMIZE_ORDER_STORAGE_KEY, JSON.stringify(randomOrderIds));
  }, [randomOrderIds]);

  useEffect(() => {
    if (!isKalamOpen) return undefined;
    const interval = window.setInterval(() => {
      fetchKalamNotes(kalamRoom, { silent: true });
    }, KALAM_POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [isKalamOpen, kalamRoom]);

  useEffect(() => {
    if (!isKalamOpen) return;
    const container = kalamMessagesRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [isKalamOpen, kalamRoom, kalamNotes.length]);

  useEffect(() => {
    if (!isMefilOpen) return undefined;
    fetchMefilSession();
    return undefined;
  }, [isMefilOpen]);

  useEffect(() => {
    if (!isMefilOpen || !mefilLoggedIn || !mefilRole) return undefined;
    fetchMefilState();
    fetchMefilChatNotes();
    const interval = window.setInterval(() => {
      fetchMefilState({ silent: true });
      fetchMefilChatNotes({ silent: true });
    }, MEFIL_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [isMefilOpen, mefilLoggedIn, mefilRole]);

  useLayoutEffect(() => {
    if (!isMefilOpen || !mefilLoggedIn || !mefilRole) return;
    const container = mefilChatMessagesRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [isMefilOpen, mefilLoggedIn, mefilRole, mefilChatNotes.length]);

  useEffect(() => {
    if (!isMefilOpen || !mefilLoggedIn || !mefilRole) return undefined;
    const focusId = window.requestAnimationFrame(() => {
      mefilChatInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(focusId);
  }, [isMefilOpen, mefilLoggedIn, mefilRole]);

  useEffect(() => {
    if (!isRandomOrderEnabled) return;
    if (!poems.length) {
      if (randomOrderIds.length) setRandomOrderIds([]);
      return;
    }

    const normalizedOrderIds = randomOrderIds.map((id) => String(id || '').trim()).filter(Boolean);
    if (!normalizedOrderIds.length) {
      setRandomOrderIds(buildShuffledOrderIds(poems));
      return;
    }

    const reconciledIds = applyOrderIds(poems, normalizedOrderIds)
      .map((poem) => String(poem?._id || '').trim())
      .filter(Boolean);

    if (areOrdersEqual(reconciledIds, normalizedOrderIds)) return;
    setRandomOrderIds(reconciledIds);
  }, [isRandomOrderEnabled, poems, randomOrderIds]);

  useEffect(() => {
    if (!isSemaMenuOpen) return undefined;
    const handlePointerDown = (event) => {
      if (!semaMenuRef.current || semaMenuRef.current.contains(event.target)) return;
      setIsSemaMenuOpen(false);
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsSemaMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isSemaMenuOpen]);

  useEffect(() => {
    if (view === 'gallery') return;
    if (isSemaMenuOpen) setIsSemaMenuOpen(false);
  }, [view, isSemaMenuOpen]);

  useEffect(() => {
    if (view === 'detail' && selectedPoemId && !selectedPoem) {
      setView('gallery');
      setSelectedPoemId(null);
      requestAnimationFrame(() => {
        window.scrollTo({ top: galleryScrollYRef.current, behavior: 'auto' });
      });
    }
  }, [view, selectedPoemId, selectedPoem]);

  useLayoutEffect(() => {
    if (view !== 'detail' || !selectedPoemId) return undefined;
    let rafId = 0;
    const timeoutIds = [];
    let isCancelled = false;

    const scrollToHeadingAnchor = () => {
      if (isCancelled) return;
      const targetNode = poemDetailHeadingRef.current || poemDetailCardRef.current;
      if (!targetNode) return;
      const targetTop = window.scrollY + targetNode.getBoundingClientRect().top;
      window.scrollTo({
        top: Math.max(0, targetTop),
        left: 0,
        behavior: 'auto',
      });
    };

    scrollToHeadingAnchor();
    rafId = window.requestAnimationFrame(scrollToHeadingAnchor);
    [120, 300, 600].forEach((delay) => {
      timeoutIds.push(window.setTimeout(scrollToHeadingAnchor, delay));
    });

    return () => {
      isCancelled = true;
      window.cancelAnimationFrame(rafId);
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [view, selectedPoemId]);

  useEffect(() => {
    if (!isCelebrating) return undefined;
    const remainingMs = Math.max(0, celebrationUntil - Date.now());
    const timeout = window.setTimeout(() => setIsCelebrating(false), remainingMs || CELEBRATION_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [isCelebrating, celebrationUntil]);

  useEffect(() => {
    if (secondsUntilReset <= 0) return undefined;
    const interval = window.setInterval(() => {
      setSecondsUntilReset((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [secondsUntilReset > 0]);

  useEffect(() => {
    if (!isQuestPulseOn) return undefined;
    const timeout = window.setTimeout(() => setIsQuestPulseOn(false), 2200);
    return () => window.clearTimeout(timeout);
  }, [isQuestPulseOn]);

  useEffect(() => {
    if (!isCelebrating) return undefined;
    const canvas = celebrationCanvasRef.current;
    if (!canvas) return undefined;
    const context = canvas.getContext('2d');
    if (!context) return undefined;

    const palettes = {
      sukoon: ['#d4af37', '#f3cd73', '#7b2cbf', '#f6e6a6'],
      noor: ['#b58d4a', '#d8be86', '#f2e1bb', '#9f7932'],
      shahi: ['#c9a86a', '#b58d4a', '#f3deaf', '#e8e1d2'],
    };
    const colors = palettes[currentTheme] || palettes.sukoon;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const devicePixelRatio = window.devicePixelRatio || 1;
    const particles = [];
    let frameId = 0;
    let lastSpawnAt = 0;

    const resizeCanvas = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = Math.floor(width * devicePixelRatio);
      canvas.height = Math.floor(height * devicePixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);
    };

    const spawnFireworkBurst = () => {
      const width = canvas.width / devicePixelRatio;
      const height = canvas.height / devicePixelRatio;
      if (!width || !height) return;

      const centerX = Math.random() * width * 0.8 + width * 0.1;
      const centerY = Math.random() * height * 0.45 + height * 0.08;
      const count = prefersReducedMotion ? 18 : 34;

      for (let index = 0; index < count; index += 1) {
        const angle = (Math.PI * 2 * index) / count + (Math.random() - 0.5) * 0.2;
        const speed = (prefersReducedMotion ? 1.6 : 2.6) + Math.random() * (prefersReducedMotion ? 1.2 : 2.4);
        const life = (prefersReducedMotion ? 30 : 42) + Math.floor(Math.random() * (prefersReducedMotion ? 20 : 28));
        particles.push({
          x: centerX,
          y: centerY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: prefersReducedMotion ? 1.6 + Math.random() * 1.8 : 2 + Math.random() * 2.4,
          life,
          maxLife: life,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
    };

    const drawFrame = (timestamp) => {
      const width = canvas.width / devicePixelRatio;
      const height = canvas.height / devicePixelRatio;
      context.fillStyle = 'rgba(0, 0, 0, 0.1)';
      context.fillRect(0, 0, width, height);

      const spawnInterval = prefersReducedMotion ? 900 : 380;
      if (timestamp - lastSpawnAt >= spawnInterval) {
        spawnFireworkBurst();
        lastSpawnAt = timestamp;
      }

      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index];
        particle.vy += prefersReducedMotion ? 0.01 : 0.02;
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life -= 1;
        if (particle.life <= 0) {
          particles.splice(index, 1);
          continue;
        }
        const alpha = particle.life / particle.maxLife;
        context.globalAlpha = alpha;
        context.fillStyle = particle.color;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
      frameId = window.requestAnimationFrame(drawFrame);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    frameId = window.requestAnimationFrame(drawFrame);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resizeCanvas);
      context.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [isCelebrating, currentTheme]);

  const handlePlant = async (e) => {
    e.preventDefault();
    const poetName = formData.poet.trim();
    if (!poetName) {
      alert('Please select or enter a poet name.');
      return;
    }

    try {
      const res = await fetch('/api/poems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, poet: poetName, tags: normalizeTags(formData.tags) })
      });
      if (!res.ok) throw new Error(`Save failed with status ${res.status}`);
      alert('Verse inscribed in the Sanctuary.');
      setFormData({ title: '', poet: 'Ahmad Faraz', content: '', tags: [] });
      try {
        await incrementLevelUp();
      } catch (levelErr) {
        console.error(levelErr);
        await fetchLevelUp();
      }
      setView('gallery');
      fetchPoems();
    } catch (err) {
      console.error(err);
      alert('Failed.');
    }
  };

  const handleDelete = async (poemId) => {
    const shouldDelete = window.confirm('Delete this verse?');
    if (!shouldDelete) return;

    try {
      const res = await fetch(`/api/poems/${poemId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Delete failed with status ${res.status}`);
      setPoems((prev) => prev.filter((poem) => poem._id !== poemId));
      if (view === 'detail' && selectedPoemId === poemId) {
        setView('gallery');
        setSelectedPoemId(null);
        requestAnimationFrame(() => {
          window.scrollTo({ top: galleryScrollYRef.current, behavior: 'auto' });
        });
      }
    } catch (err) {
      console.error(err);
      alert('Could not delete this verse.');
    }
  };

  const startEdit = (poem) => {
    setEditingPoemId(poem._id);
    setEditData({ title: poem.title, poet: poem.poet, content: poem.content, tags: normalizeTags(poem.tags) });
  };

  const cancelEdit = () => {
    setEditingPoemId(null);
    setEditData({ title: '', poet: 'Ahmad Faraz', content: '', tags: [] });
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editingPoemId) return;

    const poetName = editData.poet.trim();
    if (!poetName) {
      alert('Please select or enter a poet name.');
      return;
    }

    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/poems/${editingPoemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editData, poet: poetName, tags: normalizeTags(editData.tags) }),
      });
      if (!res.ok) throw new Error(`Update failed with status ${res.status}`);
      const updatedPoem = await res.json();
      setPoems((prev) => prev.map((poem) => (poem._id === updatedPoem._id ? updatedPoem : poem)));
      cancelEdit();
    } catch (err) {
      console.error(err);
      alert('Could not update this verse.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleSpotifyLogin = () => {
    if (!spotifyConfigured) {
      setSpotifyAuthError('Spotify is not configured on this server. Add SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, and SPOTIFY_REDIRECT_URI.');
      return;
    }

    setSpotifyAuthError('');
    window.location.href = '/api/spotify/login';
  };

  const handleSpotifyLogout = async () => {
    try {
      await fetch('/api/spotify/logout', { method: 'POST' });
    } catch (err) {
      console.error(err);
    }

    setSpotifyLoggedIn(false);
    setSpotifyProfile(null);
    setSpotifyPlaylists([]);
    setActiveSpotifyPlaylistId(null);
    setSpotifyNowPlaying(false);
    setSpotifyPlayerReady(false);
    setSpotifyError('');
    setSpotifyPlayerError('');

    if (spotifyPlayerRef.current) {
      spotifyPlayerRef.current.disconnect();
      spotifyPlayerRef.current = null;
    }
  };

  const handleAddSpotifyPlaylist = async (e) => {
    e.preventDefault();
    if (!spotifyConfigured) {
      setSpotifyError('Spotify is not configured on this server.');
      return;
    }

    if (!spotifyLoggedIn) {
      setSpotifyError('Please log in with Spotify first.');
      return;
    }

    const url = spotifyUrlInput.trim();
    if (!url) {
      setSpotifyError('Spotify playlist URL is required.');
      return;
    }

    setSpotifySaving(true);
    try {
      const res = await fetch('/api/music/spotify/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (!res.ok) {
        const message = await readErrorMessage(res, 'Unable to add Spotify playlist.');
        throw new Error(message);
      }

      const data = await res.json();
      applySourcePayload(data, setSpotifyPlaylists, setActiveSpotifyPlaylistId);
      setSpotifyUrlInput('');
      setSpotifyError('');
    } catch (err) {
      console.error(err);
      setSpotifyError(err.message || 'Unable to add Spotify playlist.');
    } finally {
      setSpotifySaving(false);
    }
  };

  const handleActivateSpotifyPlaylist = async (playlistId) => {
    if (!spotifyConfigured) {
      setSpotifyError('Spotify is not configured on this server.');
      return;
    }

    if (!spotifyLoggedIn) {
      setSpotifyError('Please log in with Spotify first.');
      return;
    }

    setSpotifySaving(true);
    try {
      const res = await fetch('/api/music/spotify/playlists/active', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistId })
      });

      if (!res.ok) {
        const message = await readErrorMessage(res, 'Unable to activate Spotify playlist.');
        throw new Error(message);
      }

      const data = await res.json();
      applySourcePayload(data, setSpotifyPlaylists, setActiveSpotifyPlaylistId);
      setSpotifyError('');
      await startSpotifyPlayback(playlistId);
    } catch (err) {
      console.error(err);
      setSpotifyError(err.message || 'Unable to activate Spotify playlist.');
    } finally {
      setSpotifySaving(false);
    }
  };

  const handleDeleteSpotifyPlaylist = async (playlistId) => {
    if (!spotifyConfigured) {
      setSpotifyError('Spotify is not configured on this server.');
      return;
    }

    if (!spotifyLoggedIn) {
      setSpotifyError('Please log in with Spotify first.');
      return;
    }

    const shouldDelete = window.confirm('Delete this Spotify playlist?');
    if (!shouldDelete) return;

    setSpotifySaving(true);
    try {
      const res = await fetch(`/api/music/spotify/playlists/${playlistId}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const message = await readErrorMessage(res, 'Unable to delete Spotify playlist.');
        throw new Error(message);
      }

      const data = await res.json();
      applySourcePayload(data, setSpotifyPlaylists, setActiveSpotifyPlaylistId);
      setSpotifyError('');
    } catch (err) {
      console.error(err);
      setSpotifyError(err.message || 'Unable to delete Spotify playlist.');
    } finally {
      setSpotifySaving(false);
    }
  };

  const handleAddYouTubePlaylist = async (e) => {
    e.preventDefault();
    const url = youtubeUrlInput.trim();
    if (!url) {
      setYoutubeError('YouTube playlist URL is required.');
      return;
    }

    const parsedPlaylist = parseYouTubePlaylistInput(url);
    if (parsedPlaylist.error) {
      setYoutubeError(parsedPlaylist.error);
      return;
    }

    setYoutubeSaving(true);
    try {
      const res = await fetch('/api/music/youtube/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: parsedPlaylist.normalizedUrl })
      });

      if (!res.ok) {
        const message = await readErrorMessage(res, 'Unable to add YouTube playlist.');
        throw new Error(message);
      }

      const data = await res.json();
      applySourcePayload(data, setYoutubePlaylists, setActiveYoutubePlaylistId);
      setYoutubeUrlInput('');
      setYoutubeError('');
    } catch (err) {
      console.error(err);
      setYoutubeError(err.message || 'Unable to add YouTube playlist.');
    } finally {
      setYoutubeSaving(false);
    }
  };

  const handleActivateYouTubePlaylist = async (playlistId) => {
    setYoutubeSaving(true);
    try {
      const res = await fetch('/api/music/youtube/playlists/active', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistId })
      });

      if (!res.ok) {
        const message = await readErrorMessage(res, 'Unable to activate YouTube playlist.');
        throw new Error(message);
      }

      const data = await res.json();
      applySourcePayload(data, setYoutubePlaylists, setActiveYoutubePlaylistId);
      setYoutubeError('');
      await startYouTubePlayback(playlistId);
    } catch (err) {
      console.error(err);
      setYoutubeError(err.message || 'Unable to activate YouTube playlist.');
    } finally {
      setYoutubeSaving(false);
    }
  };

  const handleDeleteYouTubePlaylist = async (playlistId) => {
    const shouldDelete = window.confirm('Delete this YouTube playlist?');
    if (!shouldDelete) return;

    setYoutubeSaving(true);
    try {
      const res = await fetch(`/api/music/youtube/playlists/${playlistId}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const message = await readErrorMessage(res, 'Unable to delete YouTube playlist.');
        throw new Error(message);
      }

      const data = await res.json();
      applySourcePayload(data, setYoutubePlaylists, setActiveYoutubePlaylistId);
      setYoutubeError('');
    } catch (err) {
      console.error(err);
      setYoutubeError(err.message || 'Unable to delete YouTube playlist.');
    } finally {
      setYoutubeSaving(false);
    }
  };

  const openMehfil = (poemId) => {
    setEditingPoemId(null);
    setIsSavingEdit(false);
    setActiveMehfilPoemId(poemId);
    setRevealedLineCount(1);
    setIsMehfilOpen(true);
  };

  const openPoemDetail = (poemId) => {
    setEditingPoemId(null);
    setIsSavingEdit(false);
    galleryScrollYRef.current = window.scrollY;
    setSelectedPoemId(poemId);
    setView('detail');
  };

  const closePoemDetail = () => {
    setEditingPoemId(null);
    setView('gallery');
    setSelectedPoemId(null);
    requestAnimationFrame(() => {
      window.scrollTo({ top: galleryScrollYRef.current, behavior: 'auto' });
    });
  };

  const handleRandomizeToggle = () => {
    setIsRandomOrderEnabled((prev) => {
      const next = !prev;
      if (next) {
        setRandomOrderIds((previousOrderIds) => buildNextRandomOrderIds(poems, previousOrderIds));
      }
      return next;
    });
    setIsSemaMenuOpen(false);
  };

  const closeMehfil = () => {
    setIsMehfilOpen(false);
    setActiveMehfilPoemId(null);
    setRevealedLineCount(1);
  };

  const revealNextLine = () => {
    setRevealedLineCount((prev) => Math.min(prev + 1, totalMehfilLines));
  };

  const resetReveal = () => {
    setRevealedLineCount(1);
  };

  const goToPoem = (offset) => {
    if (!poems.length) return;

    const currentIndex = poems.findIndex((poem) => poem._id === activeMehfilPoemId);
    const anchorIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (anchorIndex + offset + poems.length) % poems.length;

    setActiveMehfilPoemId(poems[nextIndex]._id);
    setRevealedLineCount(1);
  };

  const goToPrevPoem = () => goToPoem(-1);
  const goToNextPoem = () => goToPoem(1);

  const addTagToForm = (tag) => {
    if (!tag) return;
    setFormData((prev) => ({ ...prev, tags: normalizeTags([...prev.tags, tag]) }));
  };

  const removeTagFromForm = (tag) => {
    setFormData((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));
  };

  const addTagToEdit = (tag) => {
    if (!tag) return;
    setEditData((prev) => ({ ...prev, tags: normalizeTags([...prev.tags, tag]) }));
  };

  const removeTagFromEdit = (tag) => {
    setEditData((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));
  };

  const renderEditForm = () => (
    <form className="poem-edit-form" onSubmit={saveEdit}>
      <input
        value={editData.title}
        onChange={(e) => setEditData({ ...editData, title: e.target.value })}
        required
      />
      <select
        value={selectPoetValue(editData.poet)}
        onChange={(e) => {
          const selectedPoet = e.target.value;
          setEditData({
            ...editData,
            poet: selectedPoet === OTHER_POET_VALUE ? '' : selectedPoet,
          });
        }}
      >
        {POETS.map((poetName) => (
          <option key={poetName} value={poetName}>{poetName}</option>
        ))}
        <option value={OTHER_POET_VALUE}>Other (type name)</option>
      </select>
      {selectPoetValue(editData.poet) === OTHER_POET_VALUE && (
        <input
          type="text"
          placeholder="Enter poet name"
          value={editData.poet}
          onChange={(e) => setEditData({ ...editData, poet: e.target.value })}
          required
        />
      )}
      <div className="poem-tag-picker">
        <label>Feel Tags</label>
        <select
          defaultValue=""
          onChange={(e) => {
            const selectedTag = e.target.value;
            addTagToEdit(selectedTag);
            e.target.selectedIndex = 0;
          }}
        >
          <option value="" disabled>Select feel tag</option>
          {FEEL_TAGS.map((tagName) => (
            <option key={tagName} value={tagName}>{tagName}</option>
          ))}
        </select>
        {editData.tags.length > 0 && (
          <div className="poem-tag-list">
            {editData.tags.map((tag) => (
              <span key={tag} className="poem-tag">
                {tag}
                <button type="button" className="poem-tag-remove" onClick={() => removeTagFromEdit(tag)} aria-label={`Remove ${tag}`}>
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      <textarea
        rows="8"
        value={editData.content}
        onChange={(e) => setEditData({ ...editData, content: e.target.value })}
        required
      />
      <div className="poem-edit-actions">
        <button type="submit" disabled={isSavingEdit}>
          {isSavingEdit ? 'Saving...' : 'Save'}
        </button>
        <button type="button" onClick={cancelEdit} disabled={isSavingEdit}>
          Cancel
        </button>
      </div>
    </form>
  );

  return (
    <div className="sanctuary-root">
      <div className="mehrab-frame"></div>
      <FallingLeaves />
      {isCelebrating ? (
        <div className="celebration-overlay" aria-hidden="true">
          <canvas ref={celebrationCanvasRef} className="celebration-canvas"></canvas>
          <div className="celebration-glow"></div>
        </div>
      ) : null}

      <div className="theme-switcher">
        <button
          type="button"
          className="theme-control"
          onClick={cycleTheme}
          title={`Switch mood theme (Current: ${THEME_LABELS[currentTheme]})`}
          aria-label={`Switch mood theme. Current theme ${THEME_LABELS[currentTheme]}`}
        >
          {THEME_ICONS[currentTheme]}
        </button>
        <span className="theme-chip">{THEME_LABELS[currentTheme]}</span>
      </div>

      <div className="main-sanctuary">
        <header>
          <div className="bismillah">﷽</div>
          <h1>Sufi Dervish</h1>
          <p>I am in the ocean and an ocean is in me</p>
        </header>

        <nav className="top-nav">
          <button onClick={() => setView('gallery')} className={view === 'gallery' ? 'active' : ''}>The Sema</button>
          <button onClick={() => setView('plant')} className={view === 'plant' ? 'active' : ''}>Inscribe Verse</button>
          <button onClick={() => setView('music')} className={view === 'music' ? 'active' : ''}>Music</button>
        </nav>

        <main>
          {view === 'gallery' ? (
            <section className="poem-gallery">
              <article className="levelup-card" data-goal-ramp={goalRamp} aria-label="The Level Up progress">
                <div className="levelup-meta">
                  <h3>The Level Up</h3>
                  <span>{`${levelState.levelTitle} · ${selfCreatedCount} Verses${streakDays >= 2 ? ` · ${streakDays}-day streak` : ''}`}</span>
                </div>
                <div className={`levelup-bar${isStreakGlowOn ? ' levelup-bar-streak' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(levelState.progress)}>
                  <span className={`levelup-fill${isStreakGlowOn ? ' levelup-fill-streak' : ''}`} style={{ width: `${levelState.progress}%` }}></span>
                </div>
                <p className="levelup-note">
                  {levelState.isMax
                    ? 'Max level reached: Fanaa.'
                    : `${levelRemaining} more to reach ${levelState.nextLevelTitle}.${streakDays >= 2 ? ` Streak alive since ${streakLastDate || 'today'}.` : ''}`}
                </p>
                <section className={`daily-quest-card${isQuestPulseOn ? ' daily-quest-card-pulse' : ''}`} aria-label="Daily quest">
                  <div className="daily-quest-head">
                    <strong>Daily Quest</strong>
                    <span>{dailyCompleted ? 'Completed' : 'In Progress'}</span>
                  </div>
                  <div className="daily-quest-bar" role="progressbar" aria-valuemin={0} aria-valuemax={safeDailyGoal} aria-valuenow={safeDailyProgress}>
                    <span style={{ width: `${dailyQuestProgressPercent}%` }}></span>
                  </div>
                  <p className="daily-quest-note">
                    {`${safeDailyProgress}/${safeDailyGoal} verses today · resets in ${dailyResetLabel} UTC${dailyQuestDateKey ? ` · ${dailyQuestDateKey}` : ''}`}
                  </p>
                </section>
              </article>

              <div className="kalam-launch-row">
                <button
                  type="button"
                  className="kalam-launch-btn"
                  onClick={handleOpenKalam}
                >
                  Kalam
                </button>
                <button
                  type="button"
                  className="mefil-launch-btn"
                  onClick={handleOpenMefil}
                >
                  Mefil
                </button>
              </div>

              <div className="poem-list-toolbar" ref={semaMenuRef}>
                <button
                  type="button"
                  className="sema-menu-trigger"
                  aria-label="Open Sema controls"
                  aria-expanded={isSemaMenuOpen}
                  onClick={() => setIsSemaMenuOpen((prev) => !prev)}
                >
                  ⋯
                </button>
                {isSemaMenuOpen ? (
                  <div className="sema-menu-popover">
                    <button
                      type="button"
                      className={`random-toggle ${isRandomOrderEnabled ? 'random-toggle-on' : ''}`}
                      onClick={handleRandomizeToggle}
                      aria-label="Randomize poem order"
                      aria-pressed={isRandomOrderEnabled}
                      title={`Random order: ${isRandomOrderEnabled ? 'On' : 'Off'}`}
                    />
                  </div>
                ) : null}
              </div>
              <div className="poem-list">
                {displayPoems.map((poem) => (
                  <article
                    key={poem._id}
                    className={`poem-card ${editingPoemId !== poem._id ? 'poem-card-clickable' : ''}`}
                    onClick={editingPoemId !== poem._id ? () => openPoemDetail(poem._id) : undefined}
                    onKeyDown={editingPoemId !== poem._id ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openPoemDetail(poem._id);
                      }
                    } : undefined}
                    role={editingPoemId !== poem._id ? 'button' : undefined}
                    tabIndex={editingPoemId !== poem._id ? 0 : undefined}
                    aria-label={editingPoemId !== poem._id ? `Open poem ${poem.title}` : undefined}
                  >
                    <div className="poem-actions">
                      <button
                        type="button"
                        className="poem-action-btn"
                        aria-label="Edit poem"
                        title="Edit"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(poem);
                        }}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="poem-action-btn"
                        aria-label="Delete poem"
                        title="Delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(poem._id);
                        }}
                      >
                        ✕
                      </button>
                      <button
                        type="button"
                        className="poem-action-btn poem-action-mehfil"
                        aria-label="Enter Mehfil mode"
                        title="Enter Mehfil"
                        onClick={(e) => {
                          e.stopPropagation();
                          openMehfil(poem._id);
                        }}
                      >
                        ✦
                      </button>
                    </div>

                    {editingPoemId === poem._id ? (
                      renderEditForm()
                    ) : (
                      <>
                        <h2>{poem.title}</h2>
                        <div className="poem-preview" dir="auto">
                          {getPreviewLines(poem.content).map((line, idx) => (
                            <p key={`${poem._id}-preview-${idx}`} className="poem-preview-line">
                              {line || '\u00A0'}
                            </p>
                          ))}
                        </div>
                        {normalizeTags(poem.tags).length > 0 && (
                          <div className="poem-tag-list poem-tag-list-preview">
                            {normalizeTags(poem.tags).map((tag) => (
                              <span key={`${poem._id}-${tag}`} className="poem-tag">{tag}</span>
                            ))}
                          </div>
                        )}
                        <div className="poem-read-hint">Read full poem</div>
                        <div className="poet-stamp">{poem.poet}</div>
                      </>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ) : view === 'detail' && selectedPoem ? (
            <section className="poem-detail-view">
              <article key={selectedPoem._id} className="poem-detail-card" ref={poemDetailCardRef}>
                <div className="poem-detail-actions">
                  <button type="button" className="poem-detail-btn" onClick={closePoemDetail}>
                    Back
                  </button>
                  <button type="button" className="poem-detail-btn" onClick={() => startEdit(selectedPoem)}>
                    Edit
                  </button>
                  <button type="button" className="poem-detail-btn poem-detail-btn-danger" onClick={() => handleDelete(selectedPoem._id)}>
                    Delete
                  </button>
                </div>
                {editingPoemId === selectedPoem._id ? (
                  renderEditForm()
                ) : (
                  <>
                    <h2 ref={poemDetailHeadingRef}>{selectedPoem.title}</h2>
                    {normalizeTags(selectedPoem.tags).length > 0 && (
                      <div className="poem-tag-list poem-tag-list-detail">
                        {normalizeTags(selectedPoem.tags).map((tag) => (
                          <span key={`${selectedPoem._id}-detail-${tag}`} className="poem-tag">{tag}</span>
                        ))}
                      </div>
                    )}
                    <div className="poem-detail-content" dir="auto">{selectedPoem.content}</div>
                    <div className="poet-stamp">{selectedPoem.poet}</div>
                  </>
                )}
              </article>
            </section>
          ) : view === 'plant' ? (
            <div className="form-container">
              <h2>Inscribe a New Verse</h2>
              <form onSubmit={handlePlant}>
                <input placeholder="Title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required />
                <select
                  value={selectPoetValue(formData.poet)}
                  onChange={(e) => {
                    const selectedPoet = e.target.value;
                    setFormData({
                      ...formData,
                      poet: selectedPoet === OTHER_POET_VALUE ? '' : selectedPoet,
                    });
                  }}
                >
                  {POETS.map((poetName) => (
                    <option key={poetName} value={poetName}>{poetName}</option>
                  ))}
                  <option value={OTHER_POET_VALUE}>Other (type name)</option>
                </select>
                {selectPoetValue(formData.poet) === OTHER_POET_VALUE && (
                  <input
                    type="text"
                    placeholder="Enter poet name"
                    value={formData.poet}
                    onChange={(e) => setFormData({ ...formData, poet: e.target.value })}
                    required
                  />
                )}
                <div className="poem-tag-picker">
                  <label>Feel Tags</label>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const selectedTag = e.target.value;
                      addTagToForm(selectedTag);
                      e.target.selectedIndex = 0;
                    }}
                  >
                    <option value="" disabled>Select feel tag</option>
                    {FEEL_TAGS.map((tagName) => (
                      <option key={tagName} value={tagName}>{tagName}</option>
                    ))}
                  </select>
                  {formData.tags.length > 0 && (
                    <div className="poem-tag-list">
                      {formData.tags.map((tag) => (
                        <span key={tag} className="poem-tag">
                          {tag}
                          <button type="button" className="poem-tag-remove" onClick={() => removeTagFromForm(tag)} aria-label={`Remove ${tag}`}>
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <textarea rows="8" placeholder="Verses..." value={formData.content} onChange={(e) => setFormData({ ...formData, content: e.target.value })} required />
                <button type="submit">Inscribe</button>
              </form>
            </div>
          ) : view === 'music' ? (
            <section className="music-section">
              <div className="music-auth-bar">
                <div className="music-auth-left">
                  <h2>Music Mehfil</h2>
                  <p className="music-subtitle">YouTube playlists with continuous playback across tabs.</p>
                </div>
              </div>

              <div className="music-source-grid">
                <article className="music-source-card">
                  <h3>YouTube Playlists</h3>
                  <form className="music-form" onSubmit={handleAddYouTubePlaylist}>
                    <input
                      type="url"
                      className="music-url-input"
                      placeholder="https://www.youtube.com/playlist?list=..."
                      value={youtubeUrlInput}
                      onChange={(e) => setYoutubeUrlInput(e.target.value)}
                      required
                      disabled={youtubeSaving}
                    />
                    <button type="submit" disabled={youtubeSaving}>
                      {youtubeSaving ? 'Saving...' : 'Add YouTube'}
                    </button>
                  </form>
                  <p className="music-inline-note">Use playlist links only: https://www.youtube.com/playlist?list=...</p>

                  <div className="music-player-controls">
                    <button type="button" onClick={handleYouTubePrevious} disabled={!canControlYouTubePlaylist}>Previous</button>
                    <button type="button" onClick={playYouTubePlayback} disabled={!canControlYouTubePlaylist || youtubeNowPlaying}>Play YouTube</button>
                    <button type="button" onClick={pauseYouTubePlayback} disabled={!youtubeNowPlaying || youtubeSaving}>Pause YouTube</button>
                    <button type="button" onClick={handleYouTubeNext} disabled={!canControlYouTubePlaylist}>Next</button>
                    <span className="music-status">
                      {(youtubePlayerError ? 'Error' : (youtubeNowPlaying ? 'Playing' : 'Paused'))}
                      {' · '}
                      {youtubePlayerReady ? 'Player Ready' : 'Player Starting'}
                    </span>
                  </div>

                  {youtubeError ? <p className="music-error">{youtubeError}</p> : null}
                  {youtubePlayerError ? <p className="music-error">{youtubePlayerError}</p> : null}

                  {youtubeLoading ? (
                    <p className="music-empty-state">Loading YouTube playlists...</p>
                  ) : youtubePlaylists.length === 0 ? (
                    <p className="music-empty-state">No YouTube playlists yet.</p>
                  ) : (
                    <ul className="playlist-list">
                      {youtubePlaylists.map((playlist, index) => {
                        const isActive = playlist.playlistId === activeYoutubePlaylistId;
                        return (
                          <li key={playlist.playlistId} className={`playlist-item ${isActive ? 'playlist-item-active' : ''}`}>
                            <div className="playlist-item-meta">
                              <strong>{`YouTube ${index + 1}`}</strong>
                              <span>{isActive ? 'Active Playlist' : 'Saved Playlist'}</span>
                              <a href={playlist.url} target="_blank" rel="noreferrer">Open on YouTube</a>
                            </div>
                            <div className="playlist-item-actions">
                              <button
                                type="button"
                                onClick={() => handleActivateYouTubePlaylist(playlist.playlistId)}
                                disabled={youtubeSaving}
                              >
                                {isActive ? 'Play Active' : 'Activate + Play'}
                              </button>
                              <button
                                type="button"
                                className="playlist-delete-btn"
                                onClick={() => handleDeleteYouTubePlaylist(playlist.playlistId)}
                                disabled={youtubeSaving}
                              >
                                Delete
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                </article>
              </div>
            </section>
          ) : null}
        </main>

        <footer>
          The only lasting beauty is the beauty of the heart
        </footer>
      </div>

      {isMefilOpen ? (
        <div className="mefil-overlay" role="dialog" aria-modal="true" aria-label="Mefil Boss Battle" onClick={handleCloseMefil}>
          <section className="mefil-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mefil-header">
              <h2>Mefil Boss Battle</h2>
              <div className="mefil-header-actions">
                {mefilLoggedIn && mefilRole ? (
                  <span className="mefil-profile-pill">{`Logged in as ${MEFIL_ROLES[mefilRole]}`}</span>
                ) : null}
                {mefilLoggedIn ? (
                  <button
                    type="button"
                    className="mefil-logout-btn"
                    onClick={handleMefilLogout}
                    disabled={mefilActionLoading}
                  >
                    Logout
                  </button>
                ) : null}
                <button type="button" className="mefil-close-btn" onClick={handleCloseMefil}>Close</button>
              </div>
            </div>

            {mefilAuthLoading ? (
              <p className="mefil-status">Checking session...</p>
            ) : !mefilLoggedIn || !mefilRole ? (
              <article className="mefil-login-card" aria-label="Mefil login">
                <h3>Login to Mefil</h3>
                <form className="mefil-login-form" onSubmit={handleMefilLogin}>
                  <label className="mefil-login-field">
                    <span>Username</span>
                    <select
                      value={mefilLoginUsername}
                      onChange={(e) => setMefilLoginUsername(e.target.value)}
                      disabled={mefilLoginLoading}
                    >
                      <option value="belal">Belal</option>
                      <option value="rutbah">Rutbah</option>
                    </select>
                  </label>
                  <label className="mefil-login-field">
                    <span>Password</span>
                    <input
                      type="password"
                      value={mefilLoginPassword}
                      onChange={(e) => setMefilLoginPassword(e.target.value)}
                      disabled={mefilLoginLoading}
                      required
                    />
                  </label>
                  <button type="submit" className="mefil-login-btn" disabled={mefilLoginLoading}>
                    {mefilLoginLoading ? 'Logging in...' : 'Login'}
                  </button>
                </form>
                {mefilLoginError ? <p className="mefil-login-error">{mefilLoginError}</p> : null}
              </article>
            ) : (
              <>
                <div className="boss-card">
                  <div className="boss-head">
                    <strong>{questState.bossName || 'The Aadhaar OTP Rakshas'}</strong>
                    <span className={`status-pill status-pill-${questState.status}`}>{questState.status}</span>
                  </div>
                  <div className="boss-stat">
                    <label>{`Boss HP: ${questState.bossHp}/${questState.bossMaxHp || BOSS_MAX_HP}`}</label>
                    <div className="hp-track hp-track-boss">
                      <span className="hp-fill hp-fill-boss" style={{ width: `${bossHpPercent}%` }}></span>
                    </div>
                  </div>
                  <div className="boss-stat">
                    <label>{`Team HP: ${questState.teamHp}/${questState.teamMaxHp || TEAM_MAX_HP}`}</label>
                    <div className="hp-track hp-track-team">
                      <span className="hp-fill hp-fill-team" style={{ width: `${teamHpPercent}%` }}></span>
                    </div>
                  </div>
                  <p className="boss-last-action">
                    {questState.lastActionType
                      ? `${MEFIL_ROLES[questState.lastActor] || 'Someone'} used ${questState.lastActionType === 'attack' ? 'Attack' : 'Distracted'} (${questState.lastDamage || 0})`
                      : 'No actions yet in this quest.'}
                  </p>
                </div>

                <div className="mefil-presence-grid">
                  {Object.entries(MEFIL_ROLES).map(([roleKey, roleLabel]) => {
                    const roleEntry = mefilPresence[roleKey] || defaultMefilPresenceEntry;
                    const roleClock = formatPomodoroClock(roleEntry.remainingSeconds);
                    const statusClass = `status-${roleEntry.status.replace('_', '-')}`;
                    const isSelf = roleKey === mefilRole;

                    return (
                      <article key={roleKey} className={`mefil-role-card ${isSelf ? 'mefil-role-card-self' : 'mefil-role-card-partner'}`}>
                        <div className="mefil-role-card-head">
                          <h3>{roleLabel}</h3>
                          <span className={`mefil-status-indicator ${statusClass}`}>
                            {MEFIL_STATUS_LABELS[roleEntry.status] || 'Not Studying'}
                          </span>
                        </div>
                        <p className="mefil-timer-label">{roleEntry.isRunning ? 'Running' : (roleEntry.remainingSeconds === 0 ? 'Completed' : 'Paused')}</p>
                        <div className="mefil-timer-value">{roleClock}</div>
                        <select
                          className="mefil-status-select"
                          value={roleEntry.status}
                          onChange={(e) => handleMefilStatusChange(e.target.value)}
                          disabled={!isSelf || mefilActionLoading}
                        >
                          {MEFIL_STATUS_OPTIONS.map((statusValue) => (
                            <option key={statusValue} value={statusValue}>
                              {MEFIL_STATUS_LABELS[statusValue]}
                            </option>
                          ))}
                        </select>
                        <div className="mefil-controls-row">
                          <button type="button" onClick={roleEntry.isRunning ? handlePomodoroPause : handlePomodoroStart} disabled={!isSelf || mefilActionLoading}>
                            {roleEntry.isRunning ? 'Pause' : 'Start'}
                          </button>
                          <button type="button" onClick={handlePomodoroReset} disabled={!isSelf || mefilActionLoading}>
                            Reset Timer
                          </button>
                          <button type="button" className="attack-btn" onClick={handleBossAttack} disabled={!isSelf || !canAttackBoss}>
                            {`Session Complete -> Attack (${ATTACK_DAMAGE} DMG)`}
                          </button>
                          <button type="button" className="distract-btn" onClick={handleMefilDistracted} disabled={!isSelf || !canUseDistracted}>
                            {`I got distracted (-${DISTRACT_DAMAGE} HP)`}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <div className="pomodoro-controls">
                  <button type="button" onClick={handleQuestReset} disabled={mefilActionLoading || !canUseMefilActions}>
                    Reset Quest
                  </button>
                </div>

                {questLoading ? <p className="mefil-status">Syncing quest...</p> : null}
                {questError ? <p className="mefil-error">{questError}</p> : null}

                <div className="mefil-chat-card" aria-label="Mefil chat">
                  <div className="mefil-chat-head">
                    <h3>{`${MEFIL_ROLES[mefilRole]} Chat`}</h3>
                    <span>Live update: 1s · 24h only</span>
                  </div>
                  <div className="mefil-chat-messages" ref={mefilChatMessagesRef}>
                    {mefilChatLoading ? (
                      <p className="mefil-chat-empty">Loading chat...</p>
                    ) : mefilChatNotes.length === 0 ? (
                      <p className="mefil-chat-empty">No recent messages in the last 24 hours.</p>
                    ) : (
                      mefilChatNotes.map((note) => (
                        <article key={note.noteId} className="mefil-chat-message">
                          <p>{note.text}</p>
                          <time className="mefil-chat-meta">{formatKalamTimestamp(note.createdAt)}</time>
                        </article>
                      ))
                    )}
                  </div>
                  {mefilChatError ? <p className="mefil-chat-error">{mefilChatError}</p> : null}
                  <form className="mefil-chat-composer" onSubmit={handleSendMefilNote}>
                    <textarea
                      ref={mefilChatInputRef}
                      className="mefil-chat-input"
                      rows="2"
                      placeholder={`Write as ${MEFIL_ROLES[mefilRole]}...`}
                      value={mefilChatInput}
                      onChange={(e) => setMefilChatInput(e.target.value)}
                      maxLength={KALAM_MAX_TEXT_LENGTH}
                      disabled={mefilChatSaving}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          e.currentTarget.form?.requestSubmit();
                        }
                      }}
                    />
                    <button type="submit" className="mefil-chat-send-btn" disabled={mefilChatSaving}>
                      {mefilChatSaving ? 'Sending...' : 'Send'}
                    </button>
                  </form>
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}

      {isKalamOpen ? (
        <div className="kalam-overlay" role="dialog" aria-modal="true" aria-label="Kalam chat" onClick={handleCloseKalam}>
          <section className="kalam-modal" onClick={(e) => e.stopPropagation()}>
            <div className="kalam-header">
              <h2>Kalam</h2>
              <button type="button" className="kalam-close-btn" onClick={handleCloseKalam}>Close</button>
            </div>

            <div className="kalam-room-tabs" role="tablist" aria-label="Kalam rooms">
              {Object.entries(KALAM_ROOMS).map(([roomKey, roomLabel]) => (
                <button
                  key={roomKey}
                  type="button"
                  role="tab"
                  aria-selected={kalamRoom === roomKey}
                  className={`kalam-room-tab ${kalamRoom === roomKey ? 'kalam-room-tab-active' : ''}`}
                  onClick={() => handleSwitchKalamRoom(roomKey)}
                >
                  {roomLabel}
                </button>
              ))}
            </div>

            <div className="kalam-messages" ref={kalamMessagesRef}>
              {kalamLoading ? (
                <p className="kalam-empty">Loading notes...</p>
              ) : kalamNotes.length === 0 ? (
                <p className="kalam-empty">No notes yet. Start the conversation.</p>
              ) : (
                kalamNotes.map((note) => (
                  <article key={note.noteId} className="kalam-message">
                    <p>{note.text}</p>
                    <time className="kalam-meta">{formatKalamTimestamp(note.createdAt)}</time>
                  </article>
                ))
              )}
            </div>

            {kalamError ? <p className="kalam-error">{kalamError}</p> : null}

            <form className="kalam-composer" onSubmit={handleSendKalamNote}>
              <textarea
                className="kalam-input"
                rows="3"
                placeholder={`Write in ${KALAM_ROOMS[kalamRoom]}...`}
                value={kalamInput}
                onChange={(e) => setKalamInput(e.target.value)}
                maxLength={KALAM_MAX_TEXT_LENGTH}
                disabled={kalamSaving}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <button type="submit" className="kalam-send-btn" disabled={kalamSaving}>
                {kalamSaving ? 'Sending...' : 'Send'}
              </button>
            </form>
          </section>
        </div>
      ) : null}

      {isMehfilOpen && activeMehfilPoem && (
        <div className="mehfil-overlay" role="dialog" aria-modal="true" aria-label="Mehfil Mode" onClick={closeMehfil}>
          <section className="mehfil-panel" onClick={(e) => e.stopPropagation()}>
            <div className="mehfil-header">
              <h2 className="mehfil-title">{activeMehfilPoem.title}</h2>
              <div className="mehfil-poet">{activeMehfilPoem.poet}</div>
            </div>

            <div className="mehfil-lines" dir="auto">
              {poemLines.length > 0 ? (
                poemLines.map((line, index) => (
                  <p
                    key={`${activeMehfilPoem._id}-${index}`}
                    className={`mehfil-line ${index < safeRevealedLineCount ? 'visible' : ''}${line.trim() ? '' : ' mehfil-line-empty'}`}
                  >
                    {line || '\u00A0'}
                  </p>
                ))
              ) : (
                <p className="mehfil-line visible mehfil-line-empty">&nbsp;</p>
              )}
            </div>

            <div className="mehfil-progress-wrap">
              <span className="mehfil-progress-label">Line {safeRevealedLineCount} / {totalMehfilLines}</span>
              <div className="mehfil-progress">
                <span style={{ width: `${mehfilProgress}%` }}></span>
              </div>
            </div>

            <div className="mehfil-controls">
              <button type="button" className="mehfil-btn" onClick={goToPrevPoem}>Prev Poem</button>
              <button type="button" className="mehfil-btn" onClick={goToNextPoem}>Next Poem</button>
              <button type="button" className="mehfil-btn mehfil-btn-primary" onClick={revealNextLine}>Reveal Next Line</button>
              <button type="button" className="mehfil-btn" onClick={resetReveal}>Reset</button>
              <button type="button" className="mehfil-btn mehfil-btn-ghost" onClick={cycleTheme}>{`Theme: ${THEME_LABELS[currentTheme]}`}</button>
              <button type="button" className="mehfil-btn mehfil-btn-ghost" onClick={closeMehfil}>Close</button>
            </div>
          </section>
        </div>
      )}

      <div className="persistent-player-host" aria-hidden="true">
        <div id="youtube-persistent-player"></div>
      </div>
    </div>
  );
}

export default App;
