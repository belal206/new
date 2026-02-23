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
    activeYoutubePlaylistId: { type: String, default: null }
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

const parseYouTubePlaylistId = (rawUrl) => {
    const text = String(rawUrl || '').trim();
    if (!text) return null;

    let parsedUrl;
    try {
        parsedUrl = new URL(text);
    } catch (err) {
        return null;
    }

    const host = parsedUrl.hostname.toLowerCase();
    const allowedHosts = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'];
    if (!allowedHosts.includes(host)) {
        return null;
    }

    const pathname = parsedUrl.pathname;
    const listId = parsedUrl.searchParams.get('list');
    if (!listId) {
        return null;
    }

    const isPlaylistPath = pathname === '/playlist';
    const isWatchPath = pathname === '/watch';
    const isShortPath = host === 'youtu.be';

    if (!(isPlaylistPath || isWatchPath || isShortPath)) {
        return null;
    }

    if (!/^[A-Za-z0-9_-]+$/.test(listId)) {
        return null;
    }

    return listId;
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

const serializeSource = (playlists, activePlaylistId) => ({
    playlists: normalizePlaylistArray(playlists).map((playlist) => ({
        playlistId: playlist.playlistId,
        url: playlist.url,
        createdAt: playlist.createdAt
    })),
    activePlaylistId: activePlaylistId || null
});

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
            activeYoutubePlaylistId: null
        }
    },
    { upsert: true, new: true }
);

const migrateLegacyMusicSettings = async (musicSettings) => {
    let changed = false;

    musicSettings.spotifyPlaylists = normalizePlaylistArray(musicSettings.spotifyPlaylists);
    musicSettings.youtubePlaylists = normalizePlaylistArray(musicSettings.youtubePlaylists);

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
        const playlistId = parseYouTubePlaylistId(req.body?.url);
        if (!playlistId) {
            return res.status(400).json({ error: 'Invalid YouTube playlist URL' });
        }

        const musicSettings = await getMusicSettings();
        const duplicate = musicSettings.youtubePlaylists.some((playlist) => playlist.playlistId === playlistId);
        if (duplicate) {
            return res.status(400).json({ error: 'Playlist already exists' });
        }

        musicSettings.youtubePlaylists.push({
            playlistId,
            url: `https://www.youtube.com/playlist?list=${playlistId}`
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
