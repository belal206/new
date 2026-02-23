import React, { useState, useEffect, useRef } from 'react';
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

const normalizeTags = (tags) => [...new Set(
  (Array.isArray(tags) ? tags : [])
    .map((tag) => String(tag).trim())
    .filter(Boolean)
)].slice(0, 6);

const readErrorMessage = async (res, fallbackMessage) => {
  try {
    const data = await res.json();
    return data?.error || fallbackMessage;
  } catch (err) {
    return fallbackMessage;
  }
};

const applySourcePayload = (payload, setPlaylists, setActivePlaylistId) => {
  const nextPlaylists = Array.isArray(payload?.playlists) ? payload.playlists : [];
  const nextActivePlaylistId = typeof payload?.activePlaylistId === 'string' ? payload.activePlaylistId : null;
  setPlaylists(nextPlaylists);
  setActivePlaylistId(nextActivePlaylistId);
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
  const [poems, setPoems] = useState([]);
  const [view, setView] = useState('gallery');
  const [selectedPoemId, setSelectedPoemId] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const galleryScrollYRef = useRef(0);

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
  const activeYoutubePlaylist = youtubePlaylists.find((playlist) => playlist.playlistId === activeYoutubePlaylistId) || null;

  const getPreviewLines = (content) => {
    if (typeof content !== 'string') return [''];
    return content.split(/\r?\n/).slice(0, 2);
  };

  const poemLines = activeMehfilPoem ? activeMehfilPoem.content.split(/\r?\n/) : [];
  const totalMehfilLines = Math.max(poemLines.length, 1);
  const safeRevealedLineCount = Math.min(Math.max(revealedLineCount, 1), totalMehfilLines);
  const mehfilProgress = (safeRevealedLineCount / totalMehfilLines) * 100;

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
      youtubePlayerRef.current.loadPlaylist({
        listType: 'playlist',
        list: playlistId,
        index: 0,
        startSeconds: 0
      });
      youtubePlayerRef.current.playVideo();
      setYoutubeNowPlaying(true);
      setYoutubePlayerError('');
    } catch (err) {
      console.error(err);
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
    fetchYouTubePlaylists();
    fetchSpotifySession();
  }, []);

  useEffect(() => {
    if (!spotifyLoggedIn) {
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
  }, [spotifyLoggedIn]);

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
            }
            if (event.data === window.YT.PlayerState.PAUSED || event.data === window.YT.PlayerState.ENDED) {
              setYoutubeNowPlaying(false);
            }
          },
          onError: () => {
            setYoutubePlayerError('YouTube playback failed for this playlist.');
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
    if (!isMehfilOpen) return undefined;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isMehfilOpen]);

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
    document.body.classList.toggle('dark-mode', isDarkMode);
    return () => {
      document.body.classList.remove('dark-mode');
    };
  }, [isDarkMode]);

  useEffect(() => {
    if (view === 'detail' && selectedPoemId && !selectedPoem) {
      setView('gallery');
      setSelectedPoemId(null);
      requestAnimationFrame(() => {
        window.scrollTo({ top: galleryScrollYRef.current, behavior: 'auto' });
      });
    }
  }, [view, selectedPoemId, selectedPoem]);

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

    setYoutubeSaving(true);
    try {
      const res = await fetch('/api/music/youtube/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
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
    <div className={`sanctuary-root ${isDarkMode ? 'theme-dark' : ''}`}>
      <div className="mehrab-frame"></div>
      <FallingLeaves />

      <button
        type="button"
        className="theme-control"
        onClick={() => setIsDarkMode((prev) => !prev)}
        title="Toggle Lights Out"
        aria-label="Toggle dark mode"
      >
        {isDarkMode ? '☀︎' : '☾'}
      </button>

      <div className="main-sanctuary">
        <header>
          <div className="bismillah">﷽</div>
          <h1>Sufi Dervish</h1>
          <p>A Dance of Words and Silence for Her Soul</p>
        </header>

        <nav className="top-nav">
          <button onClick={() => setView('gallery')} className={view === 'gallery' ? 'active' : ''}>The Sema</button>
          <button onClick={() => setView('plant')} className={view === 'plant' ? 'active' : ''}>Inscribe Verse</button>
          <button onClick={() => setView('music')} className={view === 'music' ? 'active' : ''}>Music</button>
        </nav>

        <main>
          {view === 'gallery' ? (
            <div className="poem-list">
              {poems.map((poem) => (
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
          ) : view === 'detail' && selectedPoem ? (
            <section className="poem-detail-view">
              <article className="poem-detail-card">
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
                    <h2>{selectedPoem.title}</h2>
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
                  <p className="music-subtitle">Spotify login + YouTube playlists with continuous playback across tabs.</p>
                </div>
                <div className="music-auth-right">
                  {!spotifyConfigured ? (
                    <span className="music-auth-badge music-auth-badge-warning">Spotify not configured on server</span>
                  ) : spotifyLoggedIn ? (
                    <>
                      <span className="music-auth-badge">Spotify: {spotifyProfile?.displayName || 'Connected'}</span>
                      <button type="button" className="music-auth-btn" onClick={handleSpotifyLogout}>Logout</button>
                    </>
                  ) : (
                    <button type="button" className="music-auth-btn" onClick={handleSpotifyLogin} disabled={spotifyAuthLoading}>
                      {spotifyAuthLoading ? 'Checking...' : 'Login with Spotify'}
                    </button>
                  )}
                </div>
              </div>

              {spotifyAuthError ? <p className="music-error">{spotifyAuthError}</p> : null}

              <div className="music-source-grid">
                <article className="music-source-card">
                  <h3>Spotify Playlists</h3>
                  <form className="music-form" onSubmit={handleAddSpotifyPlaylist}>
                    <input
                      type="url"
                      className="music-url-input"
                      placeholder="https://open.spotify.com/playlist/..."
                      value={spotifyUrlInput}
                      onChange={(e) => setSpotifyUrlInput(e.target.value)}
                      required
                      disabled={!spotifyLoggedIn || spotifySaving}
                    />
                    <button type="submit" disabled={!spotifyLoggedIn || spotifySaving}>
                      {spotifySaving ? 'Saving...' : 'Add Spotify'}
                    </button>
                  </form>

                  <div className="music-player-controls">
                    <button type="button" onClick={pauseSpotifyPlayback} disabled={!spotifyNowPlaying || spotifySaving}>Pause Spotify</button>
                    <span className="music-status">{spotifyNowPlaying ? 'Playing' : 'Paused'} · {spotifyPlayerReady ? 'Player Ready' : 'Player Starting'}</span>
                  </div>

                  {spotifyError ? <p className="music-error">{spotifyError}</p> : null}
                  {spotifyPlayerError ? <p className="music-error">{spotifyPlayerError}</p> : null}

                  {spotifyLoading ? (
                    <p className="music-empty-state">Loading Spotify playlists...</p>
                  ) : spotifyPlaylists.length === 0 ? (
                    <p className="music-empty-state">No Spotify playlists yet.</p>
                  ) : (
                    <ul className="playlist-list">
                      {spotifyPlaylists.map((playlist, index) => {
                        const isActive = playlist.playlistId === activeSpotifyPlaylistId;
                        return (
                          <li key={playlist.playlistId} className={`playlist-item ${isActive ? 'playlist-item-active' : ''}`}>
                            <div className="playlist-item-meta">
                              <strong>{`Spotify ${index + 1}`}</strong>
                              <span>{isActive ? 'Active Playlist' : 'Saved Playlist'}</span>
                              <a href={playlist.url} target="_blank" rel="noreferrer">Open on Spotify</a>
                            </div>
                            <div className="playlist-item-actions">
                              <button
                                type="button"
                                onClick={() => handleActivateSpotifyPlaylist(playlist.playlistId)}
                                disabled={!spotifyLoggedIn || spotifySaving}
                              >
                                {isActive ? 'Play Active' : 'Activate + Play'}
                              </button>
                              <button
                                type="button"
                                className="playlist-delete-btn"
                                onClick={() => handleDeleteSpotifyPlaylist(playlist.playlistId)}
                                disabled={!spotifyLoggedIn || spotifySaving}
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

                  <div className="music-player-controls">
                    <button type="button" onClick={pauseYouTubePlayback} disabled={!youtubeNowPlaying || youtubeSaving}>Pause YouTube</button>
                    <span className="music-status">{youtubeNowPlaying ? 'Playing' : 'Paused'} · {youtubePlayerReady ? 'Player Ready' : 'Player Starting'}</span>
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

                  {activeYoutubePlaylist ? (
                    <div className="youtube-preview-wrap">
                      <iframe
                        title="YouTube Playlist Preview"
                        src={`https://www.youtube.com/embed/videoseries?list=${activeYoutubePlaylist.playlistId}`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                      ></iframe>
                    </div>
                  ) : null}
                </article>
              </div>
            </section>
          ) : null}
        </main>

        <footer>
          Made with love for the soul. 🌬️
        </footer>
      </div>

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
              <button type="button" className="mehfil-btn mehfil-btn-ghost" onClick={() => setIsDarkMode((prev) => !prev)}>{isDarkMode ? 'Light Mode' : 'Lights Out'}</button>
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
