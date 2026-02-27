const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser());

const PORT = process.env.PORT || 5070;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/poetry-royal';
const clientDistPath = path.resolve(__dirname, '../client/dist');
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || `${APP_BASE_URL}/api/spotify/callback`;
const SPOTIFY_AUTH_SCOPES = [
    'streaming',
    'user-read-email',
    'user-read-private',
    'user-read-playback-state',
    'user-modify-playback-state'
];
const SPOTIFY_ACCOUNTS_BASE = 'https://accounts.spotify.com';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const SPOTIFY_REFRESH_COOKIE = 'spotify_refresh_token';
const SPOTIFY_STATE_COOKIE = 'spotify_oauth_state';
const SPOTIFY_REFRESH_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const OAUTH_STATE_TTL_MS = 1000 * 60 * 10;
const IS_PROD = process.env.NODE_ENV === 'production';
const MEFIL_SESSION_COOKIE = 'mefil_session';
const MEFIL_SESSION_SECRET = String(process.env.MEFIL_SESSION_SECRET || '');
const MEFIL_BELAL_PASSWORD = String(process.env.MEFIL_BELAL_PASSWORD || '');
const MEFIL_RUTBAH_PASSWORD = String(process.env.MEFIL_RUTBAH_PASSWORD || '');
const parsedMefilSessionTtlDays = Number.parseInt(String(process.env.MEFIL_SESSION_TTL_DAYS || '30'), 10);
const MEFIL_SESSION_TTL_DAYS = Number.isFinite(parsedMefilSessionTtlDays) && parsedMefilSessionTtlDays > 0
    ? parsedMefilSessionTtlDays
    : 30;
const MEFIL_SESSION_TTL_MS = MEFIL_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

const normalizeTags = (tags) => [...new Set(
    (Array.isArray(tags) ? tags : [])
        .map((tag) => String(tag).trim())
        .filter(Boolean)
)].slice(0, 6);

mongoose.connect(MONGO_URI)
    .then(() => console.log('🏛️ Shahi Darbar Connected (MongoDB)'))
    .catch((err) => console.error('Error connecting to Shahi Darbar:', err));

const Poem = mongoose.model('Poem', new mongoose.Schema({
    title: { type: String, required: true },
    poet: { type: String, required: true },
    content: { type: String, required: true },
    tags: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now }
}));

const MusicSettings = mongoose.model('MusicSettings', new mongoose.Schema({
    scope: { type: String, required: true, unique: true, default: 'global' },
    playlists: [{
        _id: false,
        playlistId: { type: String, required: true },
        url: { type: String, required: true },
        createdAt: { type: Date, default: Date.now }
    }],
    activePlaylistId: { type: String, default: null },
    spotifyPlaylists: [{
        _id: false,
        playlistId: { type: String, required: true },
        url: { type: String, required: true },
        createdAt: { type: Date, default: Date.now }
    }],
    activeSpotifyPlaylistId: { type: String, default: null },
    youtubePlaylists: [{
        _id: false,
        playlistId: { type: String, required: true },
        url: { type: String, required: true },
        createdAt: { type: Date, default: Date.now }
    }],
    activeYoutubePlaylistId: { type: String, default: null },
    selfCreatedCount: { type: Number, default: 0 },
    lastCelebratedMilestone: { type: Number, default: 0 },
    streakDays: { type: Number, default: 0 },
    streakLastDate: { type: String, default: null },
    dailyGoalCount: { type: Number, default: 1 },
    dailyProgressCount: { type: Number, default: 0 },
    dailyQuestDateKey: { type: String, default: null },
    kalamRooms: {
        rutbah: [{
            _id: false,
            noteId: { type: String, required: true },
            text: { type: String, required: true },
            createdAt: { type: Date, default: Date.now }
        }],
        belal: [{
            _id: false,
            noteId: { type: String, required: true },
            text: { type: String, required: true },
            createdAt: { type: Date, default: Date.now }
        }]
    },
    mefilRooms: {
        rutbah: [{
            _id: false,
            noteId: { type: String, required: true },
            text: { type: String, required: true },
            createdAt: { type: Date, default: Date.now }
        }],
        belal: [{
            _id: false,
            noteId: { type: String, required: true },
            text: { type: String, required: true },
            createdAt: { type: Date, default: Date.now }
        }]
    },
    mefilQuest: {
        bossName: { type: String, default: 'The Aadhaar OTP Rakshas' },
        bossHp: { type: Number, default: 500 },
        bossMaxHp: { type: Number, default: 500 },
        teamHp: { type: Number, default: 100 },
        teamMaxHp: { type: Number, default: 100 },
        status: { type: String, default: 'active' },
        lastActionType: { type: String, default: null },
        lastActor: { type: String, default: null },
        lastDamage: { type: Number, default: null }
    },
    mefilPresence: {
        belal: {
            status: { type: String, default: 'not_studying' },
            isRunning: { type: Boolean, default: false },
            remainingSeconds: { type: Number, default: 1500 },
            durationSeconds: { type: Number, default: 1500 },
            endsAt: { type: Date, default: null },
            updatedAt: { type: Date, default: null }
        },
        rutbah: {
            status: { type: String, default: 'not_studying' },
            isRunning: { type: Boolean, default: false },
            remainingSeconds: { type: Number, default: 1500 },
            durationSeconds: { type: Number, default: 1500 },
            endsAt: { type: Date, default: null },
            updatedAt: { type: Date, default: null }
        }
    }
}, { timestamps: true }));

const spotifyConfigured = () => Boolean(SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET && SPOTIFY_REDIRECT_URI);

const setCookie = (res, key, value, maxAge) => {
    res.cookie(key, value, {
        httpOnly: true,
        secure: IS_PROD,
        sameSite: 'lax',
        path: '/',
        maxAge
    });
};

const clearCookie = (res, key) => {
    res.clearCookie(key, {
        httpOnly: true,
        secure: IS_PROD,
        sameSite: 'lax',
        path: '/'
    });
};

const parseSpotifyApiError = async (response, fallback) => {
    try {
        const data = await response.json();
        const message = data?.error?.message || data?.error_description || data?.error || fallback;
        return String(message);
    } catch (err) {
        return fallback;
    }
};

const parseSpotifyPlaylistId = (rawUrl) => {
    const text = String(rawUrl || '').trim();
    if (!text) return null;

    let parsedUrl;
    try {
        parsedUrl = new URL(text);
    } catch (err) {
        return null;
    }

    if (!['open.spotify.com', 'www.open.spotify.com'].includes(parsedUrl.hostname)) {
        return null;
    }

    const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
    if (pathParts.length !== 2 || pathParts[0] !== 'playlist') {
        return null;
    }

    const playlistId = pathParts[1];
    if (!/^[a-zA-Z0-9]+$/.test(playlistId)) {
        return null;
    }

    return playlistId;
};

const isYouTubeAutoMixId = (playlistId) => String(playlistId || '').toUpperCase().startsWith('RD');

const isStableYouTubePlaylistId = (playlistId) => /^[A-Za-z0-9_-]+$/.test(String(playlistId || ''))
    && !isYouTubeAutoMixId(playlistId);

const parseYouTubePlaylistInput = (rawUrl) => {
    const text = String(rawUrl || '').trim();
    if (!text) {
        return { playlistId: null, error: 'YouTube playlist URL is required' };
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(text);
    } catch (err) {
        return { playlistId: null, error: 'Invalid URL. Paste a full YouTube playlist link.' };
    }

    const host = parsedUrl.hostname.toLowerCase();
    const allowedHosts = ['youtube.com', 'www.youtube.com', 'm.youtube.com'];
    if (!allowedHosts.includes(host)) {
        return { playlistId: null, error: 'Only youtube.com playlist URLs are supported.' };
    }

    const pathname = parsedUrl.pathname.replace(/\/+$/, '');
    if (pathname !== '/playlist') {
        return { playlistId: null, error: 'Use a YouTube playlist URL like https://www.youtube.com/playlist?list=...' };
    }

    const listId = parsedUrl.searchParams.get('list');
    if (!listId) {
        return { playlistId: null, error: 'Playlist ID is missing in URL.' };
    }

    if (!/^[A-Za-z0-9_-]+$/.test(listId)) {
        return { playlistId: null, error: 'Invalid YouTube playlist ID.' };
    }

    if (isYouTubeAutoMixId(listId)) {
        return { playlistId: null, error: 'YouTube auto-mix/radio links are not supported. Paste a real playlist URL.' };
    }

    return {
        playlistId: listId,
        error: null,
        normalizedUrl: `https://www.youtube.com/playlist?list=${listId}`
    };
};

const normalizePlaylistArray = (playlists) => {
    const seen = new Set();
    const cleaned = [];

    for (const playlist of Array.isArray(playlists) ? playlists : []) {
        const playlistId = String(playlist?.playlistId || '').trim();
        const url = String(playlist?.url || '').trim();
        if (!playlistId || !url || seen.has(playlistId)) continue;
        seen.add(playlistId);
        cleaned.push({
            playlistId,
            url,
            createdAt: playlist?.createdAt || new Date()
        });
    }

    return cleaned;
};

const playlistArraysEqual = (left, right) => {
    const sourceLeft = Array.isArray(left) ? left : [];
    const sourceRight = Array.isArray(right) ? right : [];
    if (sourceLeft.length !== sourceRight.length) return false;

    for (let index = 0; index < sourceLeft.length; index += 1) {
        const leftPlaylist = sourceLeft[index];
        const rightPlaylist = sourceRight[index];
        const leftId = String(leftPlaylist?.playlistId || '').trim();
        const rightId = String(rightPlaylist?.playlistId || '').trim();
        const leftUrl = String(leftPlaylist?.url || '').trim();
        const rightUrl = String(rightPlaylist?.url || '').trim();
        if (leftId !== rightId || leftUrl !== rightUrl) {
            return false;
        }
    }

    return true;
};

const serializeSource = (playlists, activePlaylistId) => ({
    playlists: normalizePlaylistArray(playlists).map((playlist) => ({
        playlistId: playlist.playlistId,
        url: playlist.url,
        createdAt: playlist.createdAt
    })),
    activePlaylistId: activePlaylistId || null
});

const parseKalamRoom = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return KALAM_ROOMS.includes(normalized) ? normalized : null;
};

const buildKalamNoteId = () => (
    typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : crypto.randomBytes(16).toString('hex')
);

const sanitizeKalamText = (value) => {
    const normalized = String(value || '').replace(/\r\n/g, '\n').trim();
    if (!normalized) {
        return { text: null, error: 'Note text is required' };
    }
    if (normalized.length > KALAM_MAX_TEXT_LENGTH) {
        return { text: null, error: `Note is too long. Max ${KALAM_MAX_TEXT_LENGTH} characters.` };
    }
    return { text: normalized, error: null };
};

const normalizeKalamNotes = (notes) => {
    const seen = new Set();
    const normalized = [];

    for (const note of Array.isArray(notes) ? notes : []) {
        const rawText = String(note?.text || '').replace(/\r\n/g, '\n').trim();
        if (!rawText) continue;
        const text = rawText.length > KALAM_MAX_TEXT_LENGTH
            ? rawText.slice(0, KALAM_MAX_TEXT_LENGTH)
            : rawText;
        const noteId = String(note?.noteId || '').trim() || buildKalamNoteId();
        if (seen.has(noteId)) continue;
        seen.add(noteId);

        const parsedCreatedAt = new Date(note?.createdAt || Date.now());
        const createdAt = Number.isFinite(parsedCreatedAt.getTime()) ? parsedCreatedAt : new Date();

        normalized.push({ noteId, text, createdAt });
    }

    normalized.sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());

    if (normalized.length > KALAM_MAX_NOTES_PER_ROOM) {
        return normalized.slice(normalized.length - KALAM_MAX_NOTES_PER_ROOM);
    }
    return normalized;
};

const kalamNotesEqual = (left, right) => {
    const sourceLeft = Array.isArray(left) ? left : [];
    const sourceRight = Array.isArray(right) ? right : [];
    if (sourceLeft.length !== sourceRight.length) return false;

    for (let index = 0; index < sourceLeft.length; index += 1) {
        const leftNote = sourceLeft[index];
        const rightNote = sourceRight[index];
        const leftId = String(leftNote?.noteId || '').trim();
        const rightId = String(rightNote?.noteId || '').trim();
        const leftText = String(leftNote?.text || '');
        const rightText = String(rightNote?.text || '');
        const leftDate = new Date(leftNote?.createdAt || 0);
        const rightDate = new Date(rightNote?.createdAt || 0);
        const leftCreatedAt = Number.isFinite(leftDate.getTime()) ? leftDate.toISOString() : '';
        const rightCreatedAt = Number.isFinite(rightDate.getTime()) ? rightDate.toISOString() : '';

        if (leftId !== rightId || leftText !== rightText || leftCreatedAt !== rightCreatedAt) {
            return false;
        }
    }

    return true;
};

const normalizeKalamRooms = (musicSettings) => {
    const existingRooms = musicSettings.kalamRooms && typeof musicSettings.kalamRooms === 'object'
        ? musicSettings.kalamRooms
        : {};
    const normalizedRutbah = normalizeKalamNotes(existingRooms.rutbah);
    const normalizedBelal = normalizeKalamNotes(existingRooms.belal);
    const existingRutbah = Array.isArray(existingRooms.rutbah) ? existingRooms.rutbah : [];
    const existingBelal = Array.isArray(existingRooms.belal) ? existingRooms.belal : [];

    const changed = (
        !musicSettings.kalamRooms
        || !kalamNotesEqual(existingRutbah, normalizedRutbah)
        || !kalamNotesEqual(existingBelal, normalizedBelal)
    );

    musicSettings.kalamRooms = {
        rutbah: normalizedRutbah,
        belal: normalizedBelal
    };

    return changed;
};

const serializeKalamRoom = (room, notes) => ({
    room,
    notes: normalizeKalamNotes(notes).map((note) => ({
        noteId: note.noteId,
        text: note.text,
        createdAt: note.createdAt
    }))
});

const parseMefilRole = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return KALAM_ROOMS.includes(normalized) ? normalized : null;
};

const mefilAuthConfigured = () => Boolean(
    MEFIL_SESSION_SECRET
    && MEFIL_BELAL_PASSWORD
    && MEFIL_RUTBAH_PASSWORD
);

const parseRoleFromUsername = (value) => parseMefilRole(value);

const getMefilPasswordForRole = (role) => {
    if (role === 'belal') return MEFIL_BELAL_PASSWORD;
    if (role === 'rutbah') return MEFIL_RUTBAH_PASSWORD;
    return '';
};

const verifyMefilCredentials = (username, password) => {
    const role = parseRoleFromUsername(username);
    if (!role) return null;
    const expectedPassword = getMefilPasswordForRole(role);
    const providedPassword = String(password || '');
    if (!expectedPassword || !providedPassword) return null;
    if (providedPassword !== expectedPassword) return null;
    return role;
};

const encodeBase64Url = (value) => Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

const decodeBase64Url = (value) => {
    const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    const paddingLength = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + '='.repeat(paddingLength);
    return Buffer.from(padded, 'base64').toString('utf8');
};

const signMefilSession = (role, exp) => {
    const payload = encodeBase64Url(JSON.stringify({ role, exp }));
    const signature = crypto
        .createHmac('sha256', MEFIL_SESSION_SECRET)
        .update(payload)
        .digest('base64url');
    return `${payload}.${signature}`;
};

const verifyMefilSession = (token) => {
    if (!token || !MEFIL_SESSION_SECRET) return null;
    const [payload, signature] = String(token).split('.');
    if (!payload || !signature) return null;

    const expectedSignature = crypto
        .createHmac('sha256', MEFIL_SESSION_SECRET)
        .update(payload)
        .digest('base64url');

    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (signatureBuffer.length !== expectedBuffer.length) return null;
    if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

    let parsedPayload;
    try {
        parsedPayload = JSON.parse(decodeBase64Url(payload));
    } catch (err) {
        return null;
    }

    const role = parseMefilRole(parsedPayload?.role);
    const exp = Number.parseInt(String(parsedPayload?.exp || ''), 10);
    if (!role || !Number.isFinite(exp) || exp <= Date.now()) {
        return null;
    }

    return { role, exp };
};

const setMefilSessionCookie = (res, token) => {
    res.cookie(MEFIL_SESSION_COOKIE, token, {
        httpOnly: true,
        secure: IS_PROD,
        sameSite: 'lax',
        path: '/',
        maxAge: MEFIL_SESSION_TTL_MS
    });
};

const clearMefilSessionCookie = (res) => {
    res.clearCookie(MEFIL_SESSION_COOKIE, {
        httpOnly: true,
        secure: IS_PROD,
        sameSite: 'lax',
        path: '/'
    });
};

const requireMefilAuth = (req, res, next) => {
    const token = req.cookies?.[MEFIL_SESSION_COOKIE];
    const session = verifyMefilSession(token);
    if (!session) {
        clearMefilSessionCookie(res);
        return res.status(401).json({ error: 'Mefil login required' });
    }

    req.mefilRole = session.role;
    return next();
};

const readMefilRequestedRole = (req, value, fieldName = 'role') => {
    if (value === undefined || value === null || String(value).trim() === '') {
        return { role: req.mefilRole, error: null };
    }
    const parsedRole = parseMefilRole(value);
    if (!parsedRole) {
        return { role: null, error: `Valid ${fieldName} is required: belal or rutbah`, status: 400 };
    }
    if (parsedRole !== req.mefilRole) {
        return { role: null, error: 'Role mismatch', status: 403 };
    }
    return { role: req.mefilRole, error: null };
};

const normalizeMefilQuest = (quest) => {
    const source = quest && typeof quest === 'object' ? quest : {};
    const parsedBossMax = Number.parseInt(String(source.bossMaxHp ?? MEFIL_BOSS_MAX_HP), 10);
    const parsedTeamMax = Number.parseInt(String(source.teamMaxHp ?? MEFIL_TEAM_MAX_HP), 10);
    const bossMaxHp = Number.isFinite(parsedBossMax) && parsedBossMax > 0 ? parsedBossMax : MEFIL_BOSS_MAX_HP;
    const teamMaxHp = Number.isFinite(parsedTeamMax) && parsedTeamMax > 0 ? parsedTeamMax : MEFIL_TEAM_MAX_HP;
    const parsedBossHp = Number.parseInt(String(source.bossHp ?? bossMaxHp), 10);
    const parsedTeamHp = Number.parseInt(String(source.teamHp ?? teamMaxHp), 10);
    const bossHp = Number.isFinite(parsedBossHp) ? Math.max(0, Math.min(bossMaxHp, parsedBossHp)) : bossMaxHp;
    const teamHp = Number.isFinite(parsedTeamHp) ? Math.max(0, Math.min(teamMaxHp, parsedTeamHp)) : teamMaxHp;
    const status = bossHp <= 0 ? 'won' : (teamHp <= 0 ? 'lost' : 'active');
    const lastActionType = source.lastActionType === 'attack' || source.lastActionType === 'distracted'
        ? source.lastActionType
        : null;
    const lastActor = parseMefilRole(source.lastActor);
    const parsedLastDamage = Number.parseInt(String(source.lastDamage ?? ''), 10);
    const lastDamage = Number.isFinite(parsedLastDamage) ? parsedLastDamage : null;

    return {
        bossName: String(source.bossName || 'The Aadhaar OTP Rakshas').trim() || 'The Aadhaar OTP Rakshas',
        bossHp,
        bossMaxHp,
        teamHp,
        teamMaxHp,
        status,
        lastActionType,
        lastActor,
        lastDamage
    };
};

const mefilQuestEqual = (left, right) => {
    const leftQuest = normalizeMefilQuest(left);
    const rightQuest = normalizeMefilQuest(right);
    return (
        leftQuest.bossName === rightQuest.bossName
        && leftQuest.bossHp === rightQuest.bossHp
        && leftQuest.bossMaxHp === rightQuest.bossMaxHp
        && leftQuest.teamHp === rightQuest.teamHp
        && leftQuest.teamMaxHp === rightQuest.teamMaxHp
        && leftQuest.status === rightQuest.status
        && leftQuest.lastActionType === rightQuest.lastActionType
        && leftQuest.lastActor === rightQuest.lastActor
        && leftQuest.lastDamage === rightQuest.lastDamage
    );
};

const normalizeMefilRooms = (musicSettings) => {
    const existingRooms = musicSettings.mefilRooms && typeof musicSettings.mefilRooms === 'object'
        ? musicSettings.mefilRooms
        : {};
    const normalizedRutbah = normalizeKalamNotes(existingRooms.rutbah);
    const normalizedBelal = normalizeKalamNotes(existingRooms.belal);
    const existingRutbah = Array.isArray(existingRooms.rutbah) ? existingRooms.rutbah : [];
    const existingBelal = Array.isArray(existingRooms.belal) ? existingRooms.belal : [];

    const changed = (
        !musicSettings.mefilRooms
        || !kalamNotesEqual(existingRutbah, normalizedRutbah)
        || !kalamNotesEqual(existingBelal, normalizedBelal)
    );

    musicSettings.mefilRooms = {
        rutbah: normalizedRutbah,
        belal: normalizedBelal
    };

    return changed;
};

const serializeMefilRoom = (room, notes) => serializeKalamRoom(room, notes);
const serializeMefilQuest = (quest) => normalizeMefilQuest(quest);

const parseMefilStatus = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return MEFIL_STATUS_VALUES.includes(normalized) ? normalized : null;
};

const normalizeMefilPresenceEntry = (entry) => {
    const source = entry && typeof entry === 'object' ? entry : {};
    const status = parseMefilStatus(source.status) || 'not_studying';
    const parsedDuration = Number.parseInt(String(source.durationSeconds ?? MEFIL_POMODORO_SECONDS), 10);
    const durationSeconds = Number.isFinite(parsedDuration) && parsedDuration > 0
        ? parsedDuration
        : MEFIL_POMODORO_SECONDS;
    const parsedRemaining = Number.parseInt(String(source.remainingSeconds ?? durationSeconds), 10);
    const remainingSeconds = Number.isFinite(parsedRemaining)
        ? Math.max(0, Math.min(durationSeconds, parsedRemaining))
        : durationSeconds;
    const rawEndsAt = source.endsAt ? new Date(source.endsAt) : null;
    const endsAt = rawEndsAt && Number.isFinite(rawEndsAt.getTime()) ? rawEndsAt : null;
    const rawUpdatedAt = source.updatedAt ? new Date(source.updatedAt) : null;
    const updatedAt = rawUpdatedAt && Number.isFinite(rawUpdatedAt.getTime()) ? rawUpdatedAt : null;
    const isRunning = Boolean(source.isRunning) && Boolean(endsAt);

    return {
        status,
        isRunning,
        remainingSeconds,
        durationSeconds,
        endsAt,
        updatedAt
    };
};

const setMefilPresenceRole = (musicSettings, role, entry) => {
    const normalized = normalizeMefilPresenceEntry(entry);
    musicSettings.set(`mefilPresence.${role}`, {
        status: normalized.status,
        isRunning: normalized.isRunning,
        remainingSeconds: normalized.remainingSeconds,
        durationSeconds: normalized.durationSeconds,
        endsAt: normalized.endsAt || null,
        updatedAt: normalized.updatedAt || null
    });
    musicSettings.markModified(`mefilPresence.${role}`);
    return normalized;
};

const mefilPresenceEntryEqual = (left, right) => {
    const normalizedLeft = normalizeMefilPresenceEntry(left);
    const normalizedRight = normalizeMefilPresenceEntry(right);
    const leftEndsAt = normalizedLeft.endsAt ? normalizedLeft.endsAt.toISOString() : '';
    const rightEndsAt = normalizedRight.endsAt ? normalizedRight.endsAt.toISOString() : '';
    const leftUpdatedAt = normalizedLeft.updatedAt ? normalizedLeft.updatedAt.toISOString() : '';
    const rightUpdatedAt = normalizedRight.updatedAt ? normalizedRight.updatedAt.toISOString() : '';

    return (
        normalizedLeft.status === normalizedRight.status
        && normalizedLeft.isRunning === normalizedRight.isRunning
        && normalizedLeft.remainingSeconds === normalizedRight.remainingSeconds
        && normalizedLeft.durationSeconds === normalizedRight.durationSeconds
        && leftEndsAt === rightEndsAt
        && leftUpdatedAt === rightUpdatedAt
    );
};

const normalizeMefilPresence = (musicSettings) => {
    const currentPresence = musicSettings.mefilPresence && typeof musicSettings.mefilPresence === 'object'
        ? musicSettings.mefilPresence
        : {};
    const normalizedBelal = normalizeMefilPresenceEntry(currentPresence.belal);
    const normalizedRutbah = normalizeMefilPresenceEntry(currentPresence.rutbah);
    const changed = (
        !currentPresence
        || !mefilPresenceEntryEqual(currentPresence.belal, normalizedBelal)
        || !mefilPresenceEntryEqual(currentPresence.rutbah, normalizedRutbah)
    );

    musicSettings.mefilPresence = {
        belal: normalizedBelal,
        rutbah: normalizedRutbah
    };

    return changed;
};

const resolveMefilPresence = (musicSettings, { persistCompletion = false } = {}) => {
    const now = new Date();
    const sourcePresence = musicSettings.mefilPresence && typeof musicSettings.mefilPresence === 'object'
        ? musicSettings.mefilPresence
        : {};
    const roles = ['belal', 'rutbah'];
    const normalizedPresence = {};
    let changed = false;

    for (const role of roles) {
        const normalized = normalizeMefilPresenceEntry(sourcePresence[role]);
        if (normalized.isRunning && normalized.endsAt) {
            const remaining = Math.ceil((normalized.endsAt.getTime() - now.getTime()) / 1000);
            if (remaining <= 0) {
                normalized.isRunning = false;
                normalized.remainingSeconds = 0;
                normalized.status = 'break';
                normalized.endsAt = null;
                normalized.updatedAt = now;
                changed = true;
            }
        }
        normalizedPresence[role] = normalized;
    }

    if (changed || !mefilPresenceEntryEqual(sourcePresence.belal, normalizedPresence.belal) || !mefilPresenceEntryEqual(sourcePresence.rutbah, normalizedPresence.rutbah)) {
        musicSettings.mefilPresence = normalizedPresence;
        musicSettings.markModified('mefilPresence');
    }

    if (persistCompletion && changed) {
        return musicSettings.save().then(() => musicSettings.mefilPresence);
    }

    return Promise.resolve(musicSettings.mefilPresence);
};

const serializeMefilPresence = (presenceSource) => {
    const now = new Date();
    const roles = ['belal', 'rutbah'];
    const payload = {};
    for (const role of roles) {
        const normalized = normalizeMefilPresenceEntry(presenceSource?.[role]);
        let remainingSeconds = normalized.remainingSeconds;
        if (normalized.isRunning && normalized.endsAt) {
            const computedRemaining = Math.ceil((normalized.endsAt.getTime() - now.getTime()) / 1000);
            remainingSeconds = Math.max(0, Math.min(normalized.durationSeconds, computedRemaining));
        }
        payload[role] = {
            status: normalized.status,
            isRunning: normalized.isRunning,
            remainingSeconds,
            durationSeconds: normalized.durationSeconds,
            endsAt: normalized.endsAt ? normalized.endsAt.toISOString() : null,
            updatedAt: normalized.updatedAt ? normalized.updatedAt.toISOString() : null
        };
    }
    return payload;
};

const serializeMefilState = async (musicSettings, options = {}) => {
    await resolveMefilPresence(musicSettings, options);
    return {
        quest: serializeMefilQuest(musicSettings.mefilQuest),
        presence: serializeMefilPresence(musicSettings.mefilPresence)
    };
};

const LEVELS = [
    { title: 'Murid', min: 0, max: 2 },
    { title: 'Raahi', min: 3, max: 5 },
    { title: 'Dervish', min: 6, max: 9 },
    { title: 'Arif', min: 10, max: 14 },
    { title: 'Fanaa', min: 15, max: Number.POSITIVE_INFINITY }
];

const CELEBRATION_SECONDS = 10;
const DAILY_GOAL_DEFAULT = 1;
const KALAM_ROOMS = ['rutbah', 'belal'];
const KALAM_MAX_TEXT_LENGTH = 500;
const KALAM_MAX_NOTES_PER_ROOM = 300;
const MEFIL_BOSS_MAX_HP = 500;
const MEFIL_TEAM_MAX_HP = 100;
const MEFIL_ATTACK_DAMAGE = 25;
const MEFIL_DISTRACT_DAMAGE = 20;
const MEFIL_POMODORO_SECONDS = 25 * 60;
const MEFIL_STATUS_VALUES = ['active', 'break', 'not_studying'];

const normalizeNonNegativeInteger = (value, fallback = 0) => {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
    return parsed;
};

const normalizePositiveInteger = (value, fallback = 1) => {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return parsed;
};

const isValidDateKey = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));

const toUtcDateKey = (value = new Date()) => {
    const date = value instanceof Date ? value : new Date(value);
    return date.toISOString().slice(0, 10);
};

const parseDateKeyToUtcMs = (dateKey) => {
    if (!isValidDateKey(dateKey)) return null;
    const parsed = new Date(`${dateKey}T00:00:00.000Z`);
    const ms = parsed.getTime();
    return Number.isFinite(ms) ? ms : null;
};

const getUtcDayDiff = (fromDateKey, toDateKey) => {
    const fromMs = parseDateKeyToUtcMs(fromDateKey);
    const toMs = parseDateKeyToUtcMs(toDateKey);
    if (fromMs === null || toMs === null) return Number.POSITIVE_INFINITY;
    return Math.floor((toMs - fromMs) / 86400000);
};

const getSecondsUntilNextUtcDay = (baseDate = new Date()) => {
    const now = baseDate instanceof Date ? baseDate : new Date(baseDate);
    const nowMs = now.getTime();
    if (!Number.isFinite(nowMs)) return 0;
    const nextMidnightMs = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        0, 0, 0, 0
    );
    return Math.max(0, Math.floor((nextMidnightMs - nowMs) / 1000));
};

const resolveLevelState = (countValue) => {
    const count = Math.max(0, normalizeNonNegativeInteger(countValue, 0));
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
    const progress = isMax
        ? 100
        : Math.min(100, Math.max(0, ((count - currentLevel.min + 1) / span) * 100));

    return {
        levelTitle: currentLevel.title,
        nextLevelTitle: nextLevel?.title || currentLevel.title,
        nextGoal,
        progress,
        isMax
    };
};

const getCompletionMilestone = (count) => {
    for (const level of LEVELS) {
        if (level.max === Number.POSITIVE_INFINITY) {
            if (count === level.min) return count;
            continue;
        }
        if (count === level.max) return count;
    }
    return null;
};

const normalizeLevelUpFields = (musicSettings) => {
    let changed = false;

    const normalizedCount = normalizeNonNegativeInteger(musicSettings.selfCreatedCount, 0);
    if (musicSettings.selfCreatedCount !== normalizedCount) {
        musicSettings.selfCreatedCount = normalizedCount;
        changed = true;
    }

    const normalizedMilestone = normalizeNonNegativeInteger(musicSettings.lastCelebratedMilestone, 0);
    if (musicSettings.lastCelebratedMilestone !== normalizedMilestone) {
        musicSettings.lastCelebratedMilestone = normalizedMilestone;
        changed = true;
    }

    const normalizedStreakDays = normalizeNonNegativeInteger(musicSettings.streakDays, 0);
    if (musicSettings.streakDays !== normalizedStreakDays) {
        musicSettings.streakDays = normalizedStreakDays;
        changed = true;
    }

    const normalizedStreakLastDate = isValidDateKey(musicSettings.streakLastDate) ? musicSettings.streakLastDate : null;
    if (musicSettings.streakLastDate !== normalizedStreakLastDate) {
        musicSettings.streakLastDate = normalizedStreakLastDate;
        changed = true;
    }

    const normalizedDailyGoal = normalizePositiveInteger(musicSettings.dailyGoalCount, DAILY_GOAL_DEFAULT);
    if (musicSettings.dailyGoalCount !== normalizedDailyGoal) {
        musicSettings.dailyGoalCount = normalizedDailyGoal;
        changed = true;
    }

    const normalizedDailyProgress = Math.min(
        normalizeNonNegativeInteger(musicSettings.dailyProgressCount, 0),
        normalizedDailyGoal
    );
    if (musicSettings.dailyProgressCount !== normalizedDailyProgress) {
        musicSettings.dailyProgressCount = normalizedDailyProgress;
        changed = true;
    }

    const normalizedDailyQuestDateKey = isValidDateKey(musicSettings.dailyQuestDateKey) ? musicSettings.dailyQuestDateKey : null;
    if (musicSettings.dailyQuestDateKey !== normalizedDailyQuestDateKey) {
        musicSettings.dailyQuestDateKey = normalizedDailyQuestDateKey;
        changed = true;
    }

    return changed;
};

const refreshStreakForToday = (musicSettings, todayKey = toUtcDateKey()) => {
    const streakLastDate = isValidDateKey(musicSettings.streakLastDate) ? musicSettings.streakLastDate : null;
    const dayGap = streakLastDate ? getUtcDayDiff(streakLastDate, todayKey) : Number.POSITIVE_INFINITY;
    let changed = false;

    if (streakLastDate && dayGap > 1) {
        if (musicSettings.streakDays !== 0) {
            musicSettings.streakDays = 0;
            changed = true;
        }
    }

    return {
        changed,
        dayGap: Number.isFinite(dayGap) ? dayGap : Number.POSITIVE_INFINITY
    };
};

const syncDailyQuestForToday = (musicSettings, todayKey = toUtcDateKey()) => {
    let changed = false;
    const currentGoal = normalizePositiveInteger(musicSettings.dailyGoalCount, DAILY_GOAL_DEFAULT);
    const currentQuestDate = isValidDateKey(musicSettings.dailyQuestDateKey) ? musicSettings.dailyQuestDateKey : null;
    if (currentQuestDate !== todayKey) {
        musicSettings.dailyQuestDateKey = todayKey;
        musicSettings.dailyProgressCount = 0;
        changed = true;
    }

    const clampedProgress = Math.min(
        normalizeNonNegativeInteger(musicSettings.dailyProgressCount, 0),
        currentGoal
    );
    if (musicSettings.dailyProgressCount !== clampedProgress) {
        musicSettings.dailyProgressCount = clampedProgress;
        changed = true;
    }

    return { changed };
};

const serializeLevelUp = (musicSettings, todayKey = toUtcDateKey()) => {
    const count = normalizeNonNegativeInteger(musicSettings.selfCreatedCount, 0);
    const streakDays = normalizeNonNegativeInteger(musicSettings.streakDays, 0);
    const streakLastDate = isValidDateKey(musicSettings.streakLastDate) ? musicSettings.streakLastDate : null;
    const dayGap = streakLastDate ? getUtcDayDiff(streakLastDate, todayKey) : Number.POSITIVE_INFINITY;
    const level = resolveLevelState(count);
    const dailyGoalCount = normalizePositiveInteger(musicSettings.dailyGoalCount, DAILY_GOAL_DEFAULT);
    const dailyProgressCount = Math.min(normalizeNonNegativeInteger(musicSettings.dailyProgressCount, 0), dailyGoalCount);
    const dailyQuestDateKey = isValidDateKey(musicSettings.dailyQuestDateKey) ? musicSettings.dailyQuestDateKey : todayKey;
    const dailyCompleted = dailyProgressCount >= dailyGoalCount;

    return {
        count,
        levelTitle: level.levelTitle,
        progress: level.progress,
        nextLevelTitle: level.nextLevelTitle,
        nextGoal: level.nextGoal,
        isMax: level.isMax,
        streakDays,
        isStreakGlowOn: streakDays >= 2 && dayGap <= 1,
        streakLastDate,
        dailyGoalCount,
        dailyProgressCount,
        dailyCompleted,
        dailyQuestDateKey,
        secondsUntilReset: getSecondsUntilNextUtcDay(new Date())
    };
};

const getOrCreateMusicSettings = async () => MusicSettings.findOneAndUpdate(
    { scope: 'global' },
    {
        $setOnInsert: {
            scope: 'global',
            playlists: [],
            activePlaylistId: null,
            spotifyPlaylists: [],
            activeSpotifyPlaylistId: null,
            youtubePlaylists: [],
            activeYoutubePlaylistId: null,
            selfCreatedCount: 0,
            lastCelebratedMilestone: 0,
            streakDays: 0,
            streakLastDate: null,
            dailyGoalCount: DAILY_GOAL_DEFAULT,
            dailyProgressCount: 0,
            dailyQuestDateKey: null,
            kalamRooms: {
                rutbah: [],
                belal: []
            },
            mefilRooms: {
                rutbah: [],
                belal: []
            },
            mefilQuest: {
                bossName: 'The Aadhaar OTP Rakshas',
                bossHp: MEFIL_BOSS_MAX_HP,
                bossMaxHp: MEFIL_BOSS_MAX_HP,
                teamHp: MEFIL_TEAM_MAX_HP,
                teamMaxHp: MEFIL_TEAM_MAX_HP,
                status: 'active',
                lastActionType: null,
                lastActor: null,
                lastDamage: null
            },
            mefilPresence: {
                belal: {
                    status: 'not_studying',
                    isRunning: false,
                    remainingSeconds: MEFIL_POMODORO_SECONDS,
                    durationSeconds: MEFIL_POMODORO_SECONDS,
                    endsAt: null,
                    updatedAt: null
                },
                rutbah: {
                    status: 'not_studying',
                    isRunning: false,
                    remainingSeconds: MEFIL_POMODORO_SECONDS,
                    durationSeconds: MEFIL_POMODORO_SECONDS,
                    endsAt: null,
                    updatedAt: null
                }
            }
        }
    },
    { upsert: true, new: true }
);

const migrateLegacyMusicSettings = async (musicSettings) => {
    let changed = false;

    if (normalizeLevelUpFields(musicSettings)) {
        changed = true;
    }

    if (normalizeKalamRooms(musicSettings)) {
        changed = true;
    }

    if (normalizeMefilRooms(musicSettings)) {
        changed = true;
    }

    if (normalizeMefilPresence(musicSettings)) {
        changed = true;
    }

    const normalizedMefilQuest = normalizeMefilQuest(musicSettings.mefilQuest);
    if (!mefilQuestEqual(musicSettings.mefilQuest, normalizedMefilQuest)) {
        musicSettings.mefilQuest = normalizedMefilQuest;
        changed = true;
    }

    const normalizedSpotifyPlaylists = normalizePlaylistArray(musicSettings.spotifyPlaylists);
    if (!playlistArraysEqual(normalizedSpotifyPlaylists, musicSettings.spotifyPlaylists)) {
        changed = true;
    }
    musicSettings.spotifyPlaylists = normalizedSpotifyPlaylists;

    const normalizedYouTubePlaylists = normalizePlaylistArray(musicSettings.youtubePlaylists);
    const sanitizedYouTubePlaylists = normalizedYouTubePlaylists
        .filter((playlist) => isStableYouTubePlaylistId(playlist.playlistId))
        .map((playlist) => ({
            ...playlist,
            url: `https://www.youtube.com/playlist?list=${playlist.playlistId}`
        }));
    if (!playlistArraysEqual(sanitizedYouTubePlaylists, musicSettings.youtubePlaylists)) {
        changed = true;
    }
    musicSettings.youtubePlaylists = sanitizedYouTubePlaylists;

    const hasLegacy = normalizePlaylistArray(musicSettings.playlists).length > 0;
    if (musicSettings.spotifyPlaylists.length === 0 && hasLegacy) {
        musicSettings.spotifyPlaylists = normalizePlaylistArray(musicSettings.playlists);
        changed = true;
    }

    if (!musicSettings.activeSpotifyPlaylistId && musicSettings.activePlaylistId) {
        const legacyActive = String(musicSettings.activePlaylistId);
        const exists = musicSettings.spotifyPlaylists.some((playlist) => playlist.playlistId === legacyActive);
        musicSettings.activeSpotifyPlaylistId = exists ? legacyActive : musicSettings.spotifyPlaylists[0]?.playlistId || null;
        changed = true;
    }

    const spotifyActiveExists = musicSettings.spotifyPlaylists.some((playlist) => playlist.playlistId === musicSettings.activeSpotifyPlaylistId);
    if (!spotifyActiveExists) {
        const nextActive = musicSettings.spotifyPlaylists[0]?.playlistId || null;
        if (musicSettings.activeSpotifyPlaylistId !== nextActive) {
            musicSettings.activeSpotifyPlaylistId = nextActive;
            changed = true;
        }
    }

    const youtubeActiveExists = musicSettings.youtubePlaylists.some((playlist) => playlist.playlistId === musicSettings.activeYoutubePlaylistId);
    if (!youtubeActiveExists) {
        const nextActive = musicSettings.youtubePlaylists[0]?.playlistId || null;
        if (musicSettings.activeYoutubePlaylistId !== nextActive) {
            musicSettings.activeYoutubePlaylistId = nextActive;
            changed = true;
        }
    }

    if (changed) {
        await musicSettings.save();
    }

    return musicSettings;
};

const getMusicSettings = async () => {
    const settings = await getOrCreateMusicSettings();
    return migrateLegacyMusicSettings(settings);
};

const spotifyTokenRequest = async (bodyParams) => {
    const body = new URLSearchParams(bodyParams).toString();
    const basicAuth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');

    const response = await fetch(`${SPOTIFY_ACCOUNTS_BASE}/api/token`, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${basicAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body
    });

    if (!response.ok) {
        const message = await parseSpotifyApiError(response, 'Spotify token request failed');
        const error = new Error(message);
        error.status = response.status;
        throw error;
    }

    return response.json();
};

const refreshSpotifyAccessToken = async (refreshToken) => {
    const data = await spotifyTokenRequest({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
    });

    if (!data?.access_token) {
        const error = new Error('Invalid Spotify token response');
        error.status = 401;
        throw error;
    }

    return {
        accessToken: data.access_token,
        expiresIn: data.expires_in,
        refreshToken: data.refresh_token || null
    };
};

const getSpotifyAccessFromRequest = async (req, res) => {
    const storedRefreshToken = req.cookies?.[SPOTIFY_REFRESH_COOKIE];
    if (!storedRefreshToken) {
        const error = new Error('Spotify login required');
        error.status = 401;
        throw error;
    }

    const refreshed = await refreshSpotifyAccessToken(storedRefreshToken);
    if (refreshed.refreshToken) {
        setCookie(res, SPOTIFY_REFRESH_COOKIE, refreshed.refreshToken, SPOTIFY_REFRESH_TTL_MS);
    }

    return refreshed;
};

const spotifyApiRequest = async (accessToken, method, endpoint, { body, query } = {}) => {
    const queryString = query ? `?${new URLSearchParams(query).toString()}` : '';
    const response = await fetch(`${SPOTIFY_API_BASE}${endpoint}${queryString}`, {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined
    });

    if (response.ok) {
        if (response.status === 204) return { ok: true, data: null };
        try {
            const data = await response.json();
            return { ok: true, data };
        } catch (err) {
            return { ok: true, data: null };
        }
    }

    const message = await parseSpotifyApiError(response, 'Spotify API request failed');
    return { ok: false, status: response.status, message };
};

const requireSpotifyLogin = async (req, res, next) => {
    try {
        if (!spotifyConfigured()) {
            return res.status(500).json({ error: 'Spotify is not configured on server' });
        }

        const tokenData = await getSpotifyAccessFromRequest(req, res);
        req.spotifyAccessToken = tokenData.accessToken;
        next();
    } catch (err) {
        clearCookie(res, SPOTIFY_REFRESH_COOKIE);
        res.status(err.status || 401).json({ error: 'Spotify login required' });
    }
};

app.get('/api/poems', async (req, res) => {
    try {
        const poems = await Poem.find().sort({ createdAt: -1 });
        res.json(poems);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch' });
    }
});

app.post('/api/poems', async (req, res) => {
    try {
        const payload = {
            ...req.body,
            tags: normalizeTags(req.body.tags)
        };
        const newPoem = new Poem(payload);
        await newPoem.save();
        res.status(201).json(newPoem);
    } catch (err) {
        res.status(500).json({ error: 'Failed to save' });
    }
});

app.put('/api/poems/:id', async (req, res) => {
    try {
        const payload = {
            title: req.body.title,
            poet: req.body.poet,
            content: req.body.content,
            tags: normalizeTags(req.body.tags)
        };
        const updatedPoem = await Poem.findByIdAndUpdate(
            req.params.id,
            payload,
            { new: true, runValidators: true }
        );
        if (!updatedPoem) {
            return res.status(404).json({ error: 'Poem not found' });
        }
        res.json(updatedPoem);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update' });
    }
});

app.delete('/api/poems/:id', async (req, res) => {
    try {
        await Poem.findByIdAndDelete(req.params.id);
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete' });
    }
});

app.get('/api/levelup', async (req, res) => {
    try {
        const musicSettings = await getMusicSettings();
        const todayKey = toUtcDateKey();
        const streakState = refreshStreakForToday(musicSettings, todayKey);
        const dailyQuestState = syncDailyQuestForToday(musicSettings, todayKey);
        if (streakState.changed || dailyQuestState.changed) {
            await musicSettings.save();
        }
        res.json(serializeLevelUp(musicSettings, todayKey));
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch level up progress' });
    }
});

app.post('/api/levelup/increment', async (req, res) => {
    try {
        const musicSettings = await getMusicSettings();
        const todayKey = toUtcDateKey();
        const dailyQuestState = syncDailyQuestForToday(musicSettings, todayKey);

        const currentCount = normalizeNonNegativeInteger(musicSettings.selfCreatedCount, 0);
        const nextCount = currentCount + 1;
        musicSettings.selfCreatedCount = nextCount;

        const previousStreakDays = normalizeNonNegativeInteger(musicSettings.streakDays, 0);
        const previousStreakDate = isValidDateKey(musicSettings.streakLastDate) ? musicSettings.streakLastDate : null;
        const dayGap = previousStreakDate ? getUtcDayDiff(previousStreakDate, todayKey) : Number.POSITIVE_INFINITY;
        let nextStreakDays = previousStreakDays;
        let streakUpdated = false;

        if (!previousStreakDate) {
            nextStreakDays = 1;
            streakUpdated = true;
        } else if (dayGap === 1) {
            nextStreakDays = previousStreakDays + 1;
            streakUpdated = true;
        } else if (dayGap > 1) {
            nextStreakDays = 1;
            streakUpdated = true;
        }

        musicSettings.streakDays = nextStreakDays;
        musicSettings.streakLastDate = todayKey;

        const dailyGoalCount = normalizePositiveInteger(musicSettings.dailyGoalCount, DAILY_GOAL_DEFAULT);
        const previousDailyProgress = Math.min(
            normalizeNonNegativeInteger(musicSettings.dailyProgressCount, 0),
            dailyGoalCount
        );
        const nextDailyProgress = Math.min(dailyGoalCount, previousDailyProgress + 1);
        musicSettings.dailyProgressCount = nextDailyProgress;
        musicSettings.dailyQuestDateKey = todayKey;
        const questJustCompleted = previousDailyProgress < dailyGoalCount && nextDailyProgress >= dailyGoalCount;

        const milestone = getCompletionMilestone(nextCount);
        const lastCelebratedMilestone = normalizeNonNegativeInteger(musicSettings.lastCelebratedMilestone, 0);
        const celebrate = Boolean(milestone && milestone > lastCelebratedMilestone);
        if (celebrate) {
            musicSettings.lastCelebratedMilestone = milestone;
        }

        await musicSettings.save();

        res.json({
            ...serializeLevelUp(musicSettings, todayKey),
            celebrate,
            celebrationSeconds: CELEBRATION_SECONDS,
            streakUpdated,
            questJustCompleted,
            dailyQuestReset: dailyQuestState.changed
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to increment level up progress' });
    }
});

app.get('/api/spotify/login', (req, res) => {
    if (!spotifyConfigured()) {
        return res.status(500).json({ error: 'Spotify is not configured on server' });
    }

    const state = crypto.randomBytes(16).toString('hex');
    setCookie(res, SPOTIFY_STATE_COOKIE, state, OAUTH_STATE_TTL_MS);

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: SPOTIFY_CLIENT_ID,
        scope: SPOTIFY_AUTH_SCOPES.join(' '),
        redirect_uri: SPOTIFY_REDIRECT_URI,
        state
    });

    res.redirect(`${SPOTIFY_ACCOUNTS_BASE}/authorize?${params.toString()}`);
});

app.get('/api/spotify/callback', async (req, res) => {
    try {
        if (!spotifyConfigured()) {
            return res.status(500).json({ error: 'Spotify is not configured on server' });
        }

        const callbackError = req.query.error;
        if (callbackError) {
            return res.redirect(`${APP_BASE_URL}/?spotify_error=${encodeURIComponent(String(callbackError))}`);
        }

        const state = String(req.query.state || '');
        const code = String(req.query.code || '');
        const expectedState = String(req.cookies?.[SPOTIFY_STATE_COOKIE] || '');

        if (!state || !expectedState || state !== expectedState) {
            clearCookie(res, SPOTIFY_STATE_COOKIE);
            return res.redirect(`${APP_BASE_URL}/?spotify_error=invalid_state`);
        }

        if (!code) {
            clearCookie(res, SPOTIFY_STATE_COOKIE);
            return res.redirect(`${APP_BASE_URL}/?spotify_error=missing_code`);
        }

        const tokenData = await spotifyTokenRequest({
            grant_type: 'authorization_code',
            code,
            redirect_uri: SPOTIFY_REDIRECT_URI
        });

        if (!tokenData?.refresh_token) {
            clearCookie(res, SPOTIFY_STATE_COOKIE);
            return res.redirect(`${APP_BASE_URL}/?spotify_error=missing_refresh_token`);
        }

        setCookie(res, SPOTIFY_REFRESH_COOKIE, tokenData.refresh_token, SPOTIFY_REFRESH_TTL_MS);
        clearCookie(res, SPOTIFY_STATE_COOKIE);
        res.redirect(`${APP_BASE_URL}/?spotify=connected`);
    } catch (err) {
        clearCookie(res, SPOTIFY_STATE_COOKIE);
        res.redirect(`${APP_BASE_URL}/?spotify_error=callback_failed`);
    }
});

app.get('/api/spotify/session', async (req, res) => {
    try {
        if (!spotifyConfigured()) {
            return res.json({ loggedIn: false, configured: false });
        }

        const tokenData = await getSpotifyAccessFromRequest(req, res);
        const profileResponse = await spotifyApiRequest(tokenData.accessToken, 'GET', '/me');

        if (!profileResponse.ok) {
            clearCookie(res, SPOTIFY_REFRESH_COOKIE);
            return res.json({ loggedIn: false, configured: true });
        }

        res.json({
            loggedIn: true,
            configured: true,
            profile: {
                id: profileResponse.data?.id || null,
                displayName: profileResponse.data?.display_name || profileResponse.data?.id || 'Spotify User'
            }
        });
    } catch (err) {
        clearCookie(res, SPOTIFY_REFRESH_COOKIE);
        res.json({ loggedIn: false, configured: spotifyConfigured() });
    }
});

app.post('/api/spotify/logout', (req, res) => {
    clearCookie(res, SPOTIFY_REFRESH_COOKIE);
    clearCookie(res, SPOTIFY_STATE_COOKIE);
    res.json({ ok: true });
});

app.get('/api/spotify/access-token', requireSpotifyLogin, async (req, res) => {
    try {
        const tokenData = await getSpotifyAccessFromRequest(req, res);
        res.json({ accessToken: tokenData.accessToken, expiresIn: tokenData.expiresIn });
    } catch (err) {
        clearCookie(res, SPOTIFY_REFRESH_COOKIE);
        res.status(401).json({ error: 'Spotify login required' });
    }
});

app.post('/api/spotify/player/transfer', requireSpotifyLogin, async (req, res) => {
    const deviceId = String(req.body?.deviceId || '').trim();
    if (!deviceId) {
        return res.status(400).json({ error: 'Device ID is required' });
    }

    const transferResult = await spotifyApiRequest(req.spotifyAccessToken, 'PUT', '/me/player', {
        body: {
            device_ids: [deviceId],
            play: false
        }
    });

    if (!transferResult.ok) {
        return res.status(transferResult.status || 502).json({ error: transferResult.message });
    }

    res.json({ ok: true });
});

app.post('/api/spotify/player/play', requireSpotifyLogin, async (req, res) => {
    const playlistId = String(req.body?.playlistId || '').trim();
    const deviceId = String(req.body?.deviceId || '').trim();

    if (!playlistId || !/^[a-zA-Z0-9]+$/.test(playlistId)) {
        return res.status(400).json({ error: 'Valid playlist ID is required' });
    }
    if (!deviceId) {
        return res.status(400).json({ error: 'Device ID is required' });
    }

    const transferResult = await spotifyApiRequest(req.spotifyAccessToken, 'PUT', '/me/player', {
        body: {
            device_ids: [deviceId],
            play: false
        }
    });

    if (!transferResult.ok) {
        return res.status(transferResult.status || 502).json({ error: transferResult.message });
    }

    const playResult = await spotifyApiRequest(req.spotifyAccessToken, 'PUT', '/me/player/play', {
        query: { device_id: deviceId },
        body: {
            context_uri: `spotify:playlist:${playlistId}`
        }
    });

    if (!playResult.ok) {
        return res.status(playResult.status || 502).json({ error: playResult.message });
    }

    res.json({ ok: true });
});

app.post('/api/spotify/player/pause', requireSpotifyLogin, async (req, res) => {
    const deviceId = String(req.body?.deviceId || '').trim();
    const pauseResult = await spotifyApiRequest(req.spotifyAccessToken, 'PUT', '/me/player/pause', {
        query: deviceId ? { device_id: deviceId } : undefined
    });

    if (!pauseResult.ok) {
        return res.status(pauseResult.status || 502).json({ error: pauseResult.message });
    }

    res.json({ ok: true });
});

app.get('/api/music/spotify/playlists', requireSpotifyLogin, async (req, res) => {
    try {
        const musicSettings = await getMusicSettings();
        res.json(serializeSource(musicSettings.spotifyPlaylists, musicSettings.activeSpotifyPlaylistId));
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch Spotify playlists' });
    }
});

app.post('/api/music/spotify/playlists', requireSpotifyLogin, async (req, res) => {
    try {
        const playlistId = parseSpotifyPlaylistId(req.body?.url);
        if (!playlistId) {
            return res.status(400).json({ error: 'Invalid Spotify playlist URL' });
        }

        const musicSettings = await getMusicSettings();
        const duplicate = musicSettings.spotifyPlaylists.some((playlist) => playlist.playlistId === playlistId);
        if (duplicate) {
            return res.status(400).json({ error: 'Playlist already exists' });
        }

        musicSettings.spotifyPlaylists.push({
            playlistId,
            url: `https://open.spotify.com/playlist/${playlistId}`
        });

        if (!musicSettings.activeSpotifyPlaylistId) {
            musicSettings.activeSpotifyPlaylistId = playlistId;
        }

        await musicSettings.save();
        res.status(201).json(serializeSource(musicSettings.spotifyPlaylists, musicSettings.activeSpotifyPlaylistId));
    } catch (err) {
        res.status(500).json({ error: 'Failed to add Spotify playlist' });
    }
});

app.patch('/api/music/spotify/playlists/active', requireSpotifyLogin, async (req, res) => {
    try {
        const playlistId = String(req.body?.playlistId || '').trim();
        if (!playlistId) {
            return res.status(400).json({ error: 'Playlist ID is required' });
        }

        const musicSettings = await getMusicSettings();
        const exists = musicSettings.spotifyPlaylists.some((playlist) => playlist.playlistId === playlistId);
        if (!exists) {
            return res.status(400).json({ error: 'Playlist not found' });
        }

        musicSettings.activeSpotifyPlaylistId = playlistId;
        await musicSettings.save();
        res.json(serializeSource(musicSettings.spotifyPlaylists, musicSettings.activeSpotifyPlaylistId));
    } catch (err) {
        res.status(500).json({ error: 'Failed to activate Spotify playlist' });
    }
});

app.delete('/api/music/spotify/playlists/:playlistId', requireSpotifyLogin, async (req, res) => {
    try {
        const playlistId = String(req.params.playlistId || '').trim();
        if (!playlistId) {
            return res.status(400).json({ error: 'Playlist ID is required' });
        }

        const musicSettings = await getMusicSettings();
        const exists = musicSettings.spotifyPlaylists.some((playlist) => playlist.playlistId === playlistId);
        if (!exists) {
            return res.status(400).json({ error: 'Playlist not found' });
        }

        musicSettings.spotifyPlaylists = musicSettings.spotifyPlaylists.filter((playlist) => playlist.playlistId !== playlistId);
        if (musicSettings.activeSpotifyPlaylistId === playlistId) {
            musicSettings.activeSpotifyPlaylistId = musicSettings.spotifyPlaylists[0]?.playlistId || null;
        }

        await musicSettings.save();
        res.json(serializeSource(musicSettings.spotifyPlaylists, musicSettings.activeSpotifyPlaylistId));
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete Spotify playlist' });
    }
});

app.get('/api/music/youtube/playlists', async (req, res) => {
    try {
        const musicSettings = await getMusicSettings();
        res.json(serializeSource(musicSettings.youtubePlaylists, musicSettings.activeYoutubePlaylistId));
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch YouTube playlists' });
    }
});

app.post('/api/music/youtube/playlists', async (req, res) => {
    try {
        const parsedPlaylist = parseYouTubePlaylistInput(req.body?.url);
        if (parsedPlaylist.error || !parsedPlaylist.playlistId) {
            return res.status(400).json({ error: parsedPlaylist.error || 'Invalid YouTube playlist URL' });
        }
        const playlistId = parsedPlaylist.playlistId;

        const musicSettings = await getMusicSettings();
        const duplicate = musicSettings.youtubePlaylists.some((playlist) => playlist.playlistId === playlistId);
        if (duplicate) {
            return res.status(400).json({ error: 'Playlist already exists' });
        }

        musicSettings.youtubePlaylists.push({
            playlistId,
            url: parsedPlaylist.normalizedUrl
        });

        if (!musicSettings.activeYoutubePlaylistId) {
            musicSettings.activeYoutubePlaylistId = playlistId;
        }

        await musicSettings.save();
        res.status(201).json(serializeSource(musicSettings.youtubePlaylists, musicSettings.activeYoutubePlaylistId));
    } catch (err) {
        res.status(500).json({ error: 'Failed to add YouTube playlist' });
    }
});

app.patch('/api/music/youtube/playlists/active', async (req, res) => {
    try {
        const playlistId = String(req.body?.playlistId || '').trim();
        if (!playlistId) {
            return res.status(400).json({ error: 'Playlist ID is required' });
        }

        const musicSettings = await getMusicSettings();
        const exists = musicSettings.youtubePlaylists.some((playlist) => playlist.playlistId === playlistId);
        if (!exists) {
            return res.status(400).json({ error: 'Playlist not found' });
        }

        musicSettings.activeYoutubePlaylistId = playlistId;
        await musicSettings.save();
        res.json(serializeSource(musicSettings.youtubePlaylists, musicSettings.activeYoutubePlaylistId));
    } catch (err) {
        res.status(500).json({ error: 'Failed to activate YouTube playlist' });
    }
});

app.delete('/api/music/youtube/playlists/:playlistId', async (req, res) => {
    try {
        const playlistId = String(req.params.playlistId || '').trim();
        if (!playlistId) {
            return res.status(400).json({ error: 'Playlist ID is required' });
        }

        const musicSettings = await getMusicSettings();
        const exists = musicSettings.youtubePlaylists.some((playlist) => playlist.playlistId === playlistId);
        if (!exists) {
            return res.status(400).json({ error: 'Playlist not found' });
        }

        musicSettings.youtubePlaylists = musicSettings.youtubePlaylists.filter((playlist) => playlist.playlistId !== playlistId);
        if (musicSettings.activeYoutubePlaylistId === playlistId) {
            musicSettings.activeYoutubePlaylistId = musicSettings.youtubePlaylists[0]?.playlistId || null;
        }

        await musicSettings.save();
        res.json(serializeSource(musicSettings.youtubePlaylists, musicSettings.activeYoutubePlaylistId));
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete YouTube playlist' });
    }
});

app.post('/api/mefil/auth/login', (req, res) => {
    if (!mefilAuthConfigured()) {
        return res.status(500).json({ error: 'Mefil auth is not configured on server' });
    }

    const role = verifyMefilCredentials(req.body?.username, req.body?.password);
    if (!role) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const exp = Date.now() + MEFIL_SESSION_TTL_MS;
    const token = signMefilSession(role, exp);
    setMefilSessionCookie(res, token);
    return res.json({ ok: true, role });
});

app.get('/api/mefil/auth/session', (req, res) => {
    if (!mefilAuthConfigured()) {
        return res.json({ loggedIn: false, role: null });
    }

    const session = verifyMefilSession(req.cookies?.[MEFIL_SESSION_COOKIE]);
    if (!session) {
        clearMefilSessionCookie(res);
        return res.json({ loggedIn: false, role: null });
    }

    return res.json({ loggedIn: true, role: session.role });
});

app.post('/api/mefil/auth/logout', (req, res) => {
    clearMefilSessionCookie(res);
    res.json({ ok: true });
});

app.get('/api/mefil/state', requireMefilAuth, async (req, res) => {
    try {
        const musicSettings = await getMusicSettings();
        const payload = await serializeMefilState(musicSettings, { persistCompletion: true });
        res.json(payload);
    } catch (err) {
        console.error('[MEFIL /api/mefil/state]', err?.message || err);
        res.status(500).json({ error: 'Failed to fetch Mefil state' });
    }
});

app.get('/api/mefil/quest', requireMefilAuth, async (req, res) => {
    try {
        const musicSettings = await getMusicSettings();
        await resolveMefilPresence(musicSettings, { persistCompletion: true });
        res.json(serializeMefilQuest(musicSettings.mefilQuest));
    } catch (err) {
        console.error('[MEFIL /api/mefil/quest]', err?.message || err);
        res.status(500).json({ error: 'Failed to fetch Mefil quest' });
    }
});

app.patch('/api/mefil/status', requireMefilAuth, async (req, res) => {
    try {
        const roleResolution = readMefilRequestedRole(req, req.body?.role, 'role');
        if (roleResolution.error) {
            return res.status(roleResolution.status || 400).json({ error: roleResolution.error });
        }
        const role = roleResolution.role;
        const status = parseMefilStatus(req.body?.status);
        if (!status) {
            return res.status(400).json({ error: 'Valid status is required: active, break, not_studying' });
        }

        const musicSettings = await getMusicSettings();
        await resolveMefilPresence(musicSettings, { persistCompletion: true });
        const nextPresence = normalizeMefilPresenceEntry(musicSettings.mefilPresence?.[role]);
        nextPresence.status = status;
        nextPresence.updatedAt = new Date();
        setMefilPresenceRole(musicSettings, role, nextPresence);
        await musicSettings.save();
        res.json({ presence: serializeMefilPresence(musicSettings.mefilPresence) });
    } catch (err) {
        console.error('[MEFIL /api/mefil/status]', err?.message || err);
        res.status(500).json({ error: 'Failed to update Mefil status' });
    }
});

app.post('/api/mefil/pomodoro/start', requireMefilAuth, async (req, res) => {
    try {
        const roleResolution = readMefilRequestedRole(req, req.body?.role, 'role');
        if (roleResolution.error) {
            return res.status(roleResolution.status || 400).json({ error: roleResolution.error });
        }
        const role = roleResolution.role;
        const musicSettings = await getMusicSettings();
        await resolveMefilPresence(musicSettings, { persistCompletion: true });

        const serializedPresence = serializeMefilPresence(musicSettings.mefilPresence);
        const currentPresence = normalizeMefilPresenceEntry(musicSettings.mefilPresence?.[role]);
        const computedRemaining = serializedPresence?.[role]?.remainingSeconds ?? currentPresence.remainingSeconds;
        const baseRemaining = computedRemaining > 0 ? computedRemaining : currentPresence.durationSeconds;
        const now = new Date();
        currentPresence.remainingSeconds = baseRemaining;
        currentPresence.isRunning = true;
        currentPresence.endsAt = new Date(now.getTime() + (baseRemaining * 1000));
        currentPresence.status = 'active';
        currentPresence.updatedAt = now;
        setMefilPresenceRole(musicSettings, role, currentPresence);
        await musicSettings.save();

        res.json({ presence: serializeMefilPresence(musicSettings.mefilPresence) });
    } catch (err) {
        console.error('[MEFIL /api/mefil/pomodoro/start]', err?.message || err);
        res.status(500).json({ error: 'Failed to start Pomodoro' });
    }
});

app.post('/api/mefil/pomodoro/pause', requireMefilAuth, async (req, res) => {
    try {
        const roleResolution = readMefilRequestedRole(req, req.body?.role, 'role');
        if (roleResolution.error) {
            return res.status(roleResolution.status || 400).json({ error: roleResolution.error });
        }
        const role = roleResolution.role;
        const musicSettings = await getMusicSettings();
        await resolveMefilPresence(musicSettings, { persistCompletion: true });

        const serializedPresence = serializeMefilPresence(musicSettings.mefilPresence);
        const nextPresence = normalizeMefilPresenceEntry(musicSettings.mefilPresence?.[role]);
        nextPresence.remainingSeconds = serializedPresence?.[role]?.remainingSeconds ?? nextPresence.remainingSeconds;
        nextPresence.isRunning = false;
        nextPresence.endsAt = null;
        nextPresence.updatedAt = new Date();
        setMefilPresenceRole(musicSettings, role, nextPresence);
        await musicSettings.save();
        res.json({ presence: serializeMefilPresence(musicSettings.mefilPresence) });
    } catch (err) {
        console.error('[MEFIL /api/mefil/pomodoro/pause]', err?.message || err);
        res.status(500).json({ error: 'Failed to pause Pomodoro' });
    }
});

app.post('/api/mefil/pomodoro/reset', requireMefilAuth, async (req, res) => {
    try {
        const roleResolution = readMefilRequestedRole(req, req.body?.role, 'role');
        if (roleResolution.error) {
            return res.status(roleResolution.status || 400).json({ error: roleResolution.error });
        }
        const role = roleResolution.role;
        const musicSettings = await getMusicSettings();
        await resolveMefilPresence(musicSettings, { persistCompletion: true });
        const nextPresence = normalizeMefilPresenceEntry(musicSettings.mefilPresence?.[role]);
        nextPresence.remainingSeconds = nextPresence.durationSeconds;
        nextPresence.isRunning = false;
        nextPresence.endsAt = null;
        nextPresence.updatedAt = new Date();
        setMefilPresenceRole(musicSettings, role, nextPresence);
        await musicSettings.save();
        res.json({ presence: serializeMefilPresence(musicSettings.mefilPresence) });
    } catch (err) {
        console.error('[MEFIL /api/mefil/pomodoro/reset]', err?.message || err);
        res.status(500).json({ error: 'Failed to reset Pomodoro' });
    }
});

app.post('/api/mefil/pomodoro/complete-attack', requireMefilAuth, async (req, res) => {
    try {
        const roleResolution = readMefilRequestedRole(req, req.body?.role, 'role');
        if (roleResolution.error) {
            return res.status(roleResolution.status || 400).json({ error: roleResolution.error });
        }
        const role = roleResolution.role;
        const musicSettings = await getMusicSettings();
        await resolveMefilPresence(musicSettings, { persistCompletion: true });
        const serializedPresence = serializeMefilPresence(musicSettings.mefilPresence);
        const currentPresence = serializedPresence?.[role];
        if (!currentPresence || currentPresence.isRunning || currentPresence.remainingSeconds > 0) {
            return res.status(400).json({ error: 'Pomodoro must be complete before attacking.' });
        }

        const quest = normalizeMefilQuest(musicSettings.mefilQuest);
        if (quest.status !== 'active') {
            return res.status(400).json({ error: 'Quest is not active.' });
        }

        quest.bossHp = Math.max(0, quest.bossHp - MEFIL_ATTACK_DAMAGE);
        quest.status = quest.bossHp <= 0 ? 'won' : (quest.teamHp <= 0 ? 'lost' : 'active');
        quest.lastActionType = 'attack';
        quest.lastActor = role;
        quest.lastDamage = MEFIL_ATTACK_DAMAGE;
        musicSettings.mefilQuest = quest;
        musicSettings.markModified('mefilQuest');

        const nextPresence = normalizeMefilPresenceEntry(musicSettings.mefilPresence?.[role]);
        nextPresence.isRunning = false;
        nextPresence.remainingSeconds = nextPresence.durationSeconds;
        nextPresence.endsAt = null;
        nextPresence.status = 'break';
        nextPresence.updatedAt = new Date();
        setMefilPresenceRole(musicSettings, role, nextPresence);

        await musicSettings.save();
        const payload = await serializeMefilState(musicSettings);
        res.json(payload);
    } catch (err) {
        console.error('[MEFIL /api/mefil/pomodoro/complete-attack]', err?.message || err);
        res.status(500).json({ error: 'Failed to complete Pomodoro attack' });
    }
});

app.post('/api/mefil/attack', requireMefilAuth, async (req, res) => {
    try {
        const roleResolution = readMefilRequestedRole(req, req.body?.role, 'role');
        if (roleResolution.error) {
            return res.status(roleResolution.status || 400).json({ error: roleResolution.error });
        }
        const actor = roleResolution.role;
        const musicSettings = await getMusicSettings();
        await resolveMefilPresence(musicSettings, { persistCompletion: true });
        const quest = normalizeMefilQuest(musicSettings.mefilQuest);

        if (quest.status === 'active') {
            quest.bossHp = Math.max(0, quest.bossHp - MEFIL_ATTACK_DAMAGE);
            quest.status = quest.bossHp <= 0 ? 'won' : (quest.teamHp <= 0 ? 'lost' : 'active');
            quest.lastActionType = 'attack';
            quest.lastActor = actor;
            quest.lastDamage = MEFIL_ATTACK_DAMAGE;
            musicSettings.mefilQuest = quest;
            musicSettings.markModified('mefilQuest');
            await musicSettings.save();
        }

        res.json(serializeMefilQuest(quest));
    } catch (err) {
        console.error('[MEFIL /api/mefil/attack]', err?.message || err);
        res.status(500).json({ error: 'Failed to apply Mefil attack' });
    }
});

app.post('/api/mefil/distracted', requireMefilAuth, async (req, res) => {
    try {
        const roleResolution = readMefilRequestedRole(req, req.body?.role, 'role');
        if (roleResolution.error) {
            return res.status(roleResolution.status || 400).json({ error: roleResolution.error });
        }
        const actor = roleResolution.role;
        const musicSettings = await getMusicSettings();
        await resolveMefilPresence(musicSettings, { persistCompletion: true });
        const quest = normalizeMefilQuest(musicSettings.mefilQuest);

        if (quest.status === 'active') {
            quest.teamHp = Math.max(0, quest.teamHp - MEFIL_DISTRACT_DAMAGE);
            quest.status = quest.bossHp <= 0 ? 'won' : (quest.teamHp <= 0 ? 'lost' : 'active');
            quest.lastActionType = 'distracted';
            quest.lastActor = actor;
            quest.lastDamage = MEFIL_DISTRACT_DAMAGE;
            musicSettings.mefilQuest = quest;
            musicSettings.markModified('mefilQuest');

            const serializedPresence = serializeMefilPresence(musicSettings.mefilPresence);
            const nextPresence = normalizeMefilPresenceEntry(musicSettings.mefilPresence?.[actor]);
            nextPresence.remainingSeconds = serializedPresence?.[actor]?.remainingSeconds ?? nextPresence.remainingSeconds;
            nextPresence.isRunning = false;
            nextPresence.endsAt = null;
            nextPresence.status = 'not_studying';
            nextPresence.updatedAt = new Date();
            setMefilPresenceRole(musicSettings, actor, nextPresence);

            await musicSettings.save();
        }

        res.json(serializeMefilQuest(quest));
    } catch (err) {
        console.error('[MEFIL /api/mefil/distracted]', err?.message || err);
        res.status(500).json({ error: 'Failed to apply Mefil distraction' });
    }
});

app.post('/api/mefil/reset', requireMefilAuth, async (req, res) => {
    try {
        const roleResolution = readMefilRequestedRole(req, req.body?.role, 'role');
        if (roleResolution.error) {
            return res.status(roleResolution.status || 400).json({ error: roleResolution.error });
        }

        const musicSettings = await getMusicSettings();
        const resetQuest = normalizeMefilQuest({
            bossName: 'The Aadhaar OTP Rakshas',
            bossHp: MEFIL_BOSS_MAX_HP,
            bossMaxHp: MEFIL_BOSS_MAX_HP,
            teamHp: MEFIL_TEAM_MAX_HP,
            teamMaxHp: MEFIL_TEAM_MAX_HP,
            status: 'active',
            lastActionType: null,
            lastActor: null,
            lastDamage: null
        });
        musicSettings.mefilQuest = resetQuest;
        musicSettings.markModified('mefilQuest');
        await musicSettings.save();
        res.json(serializeMefilQuest(resetQuest));
    } catch (err) {
        console.error('[MEFIL /api/mefil/reset]', err?.message || err);
        res.status(500).json({ error: 'Failed to reset Mefil quest' });
    }
});

app.get('/api/mefil/chat', requireMefilAuth, async (req, res) => {
    try {
        const roomResolution = readMefilRequestedRole(req, req.query?.room, 'room');
        if (roomResolution.error) {
            return res.status(roomResolution.status || 400).json({ error: roomResolution.error });
        }
        const room = roomResolution.role;
        const musicSettings = await getMusicSettings();
        const notes = musicSettings?.mefilRooms?.[room] || [];
        res.json(serializeMefilRoom(room, notes));
    } catch (err) {
        console.error('[MEFIL /api/mefil/chat GET]', err?.message || err);
        res.status(500).json({ error: 'Failed to fetch Mefil chat' });
    }
});

app.post('/api/mefil/chat', requireMefilAuth, async (req, res) => {
    try {
        const roomResolution = readMefilRequestedRole(req, req.body?.room, 'room');
        if (roomResolution.error) {
            return res.status(roomResolution.status || 400).json({ error: roomResolution.error });
        }
        const room = roomResolution.role;
        const sanitizedText = sanitizeKalamText(req.body?.text);
        if (sanitizedText.error || !sanitizedText.text) {
            return res.status(400).json({ error: sanitizedText.error || 'Message text is required' });
        }

        const musicSettings = await getMusicSettings();
        const currentNotes = musicSettings?.mefilRooms?.[room] || [];
        const nextNotes = normalizeKalamNotes([
            ...currentNotes,
            {
                noteId: buildKalamNoteId(),
                text: sanitizedText.text,
                createdAt: new Date()
            }
        ]);

        musicSettings.set(`mefilRooms.${room}`, nextNotes);
        musicSettings.markModified(`mefilRooms.${room}`);
        await musicSettings.save();
        res.status(201).json(serializeMefilRoom(room, nextNotes));
    } catch (err) {
        console.error('[MEFIL /api/mefil/chat POST]', err?.message || err);
        res.status(500).json({ error: 'Failed to save Mefil message' });
    }
});

app.get('/api/kalam/notes', async (req, res) => {
    try {
        const room = parseKalamRoom(req.query?.room);
        if (!room) {
            return res.status(400).json({ error: 'Valid room is required: rutbah or belal' });
        }

        const musicSettings = await getMusicSettings();
        const notes = musicSettings?.kalamRooms?.[room] || [];
        res.json(serializeKalamRoom(room, notes));
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch Kalam notes' });
    }
});

app.post('/api/kalam/notes', async (req, res) => {
    try {
        const room = parseKalamRoom(req.body?.room);
        if (!room) {
            return res.status(400).json({ error: 'Valid room is required: rutbah or belal' });
        }

        const sanitizedText = sanitizeKalamText(req.body?.text);
        if (sanitizedText.error || !sanitizedText.text) {
            return res.status(400).json({ error: sanitizedText.error || 'Note text is required' });
        }

        const musicSettings = await getMusicSettings();
        const currentNotes = musicSettings?.kalamRooms?.[room] || [];
        const nextNotes = normalizeKalamNotes([
            ...currentNotes,
            {
                noteId: buildKalamNoteId(),
                text: sanitizedText.text,
                createdAt: new Date()
            }
        ]);

        musicSettings.kalamRooms = {
            ...musicSettings.kalamRooms,
            [room]: nextNotes
        };
        musicSettings.markModified('kalamRooms');
        await musicSettings.save();

        res.status(201).json(serializeKalamRoom(room, nextNotes));
    } catch (err) {
        res.status(500).json({ error: 'Failed to save Kalam note' });
    }
});

app.get('/api/seed', async (req, res) => {
    const seeds = [
        { title: 'Ranjish Hi Sahi', poet: 'Ahmad Faraz', content: 'Ranjish hi sahi dil hi dukhane ke liye aa...\nAa phir se mujhe chhod ke jaane ke liye aa.', tags: ['Longing', 'Heartbreak'] },
        { title: 'Suna Hai Log', poet: 'Ahmad Faraz', content: 'Suna hai log usay aankh bhar ke dekhte hain\nSo us ke sheher mein kuchh din theher ke dekhte hain.', tags: ['Romantic', 'Nostalgic'] },
        { title: 'Hazaron Khwahishen', poet: 'Mirza Ghalib', content: 'Hazaron khwahishen aisi ke har khwahish pe dam nikle\nBohat niklay mere armaan lekin phir bhi kam nikle', tags: ['Melancholic', 'Longing'] }
    ];
    await Poem.insertMany(seeds);
    res.send('Royal seeds planted.');
});

app.get('/healthz', (req, res) => {
    res.json({ ok: true });
});

if (process.env.NODE_ENV === 'production') {
    app.use(express.static(clientDistPath));

    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api/')) {
            return next();
        }
        res.sendFile(path.join(clientDistPath, 'index.html'));
    });
}

app.listen(PORT, () => console.log(`Royal API on ${PORT}`));
