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

// Component for falling Chinar leaves
const FallingLeaves = () => {
  const [leaves, setLeaves] = useState([]);

  useEffect(() => {
    const interval = setInterval(() => {
      const id = Date.now();
      const left = Math.random() * 100;
      const duration = 5 + Math.random() * 10;
      const size = 20 + Math.random() * 30;

      setLeaves((prev) => [...prev, { id, left, duration, size }]);

      // Clean up old leaves
      setTimeout(() => {
        setLeaves((prev) => prev.filter((l) => l.id !== id));
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
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const audioRef = useRef(null);
  const galleryScrollYRef = useRef(0);
  const musicSrc = `${import.meta.env.BASE_URL}audio/rumi-oceans-of-love.mp3`;
  const [formData, setFormData] = useState({ title: '', poet: 'Ahmad Faraz', content: '', tags: [] });
  const [editingPoemId, setEditingPoemId] = useState(null);
  const [editData, setEditData] = useState({ title: '', poet: 'Ahmad Faraz', content: '', tags: [] });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [isMehfilOpen, setIsMehfilOpen] = useState(false);
  const [activeMehfilPoemId, setActiveMehfilPoemId] = useState(null);
  const [revealedLineCount, setRevealedLineCount] = useState(1);

  const isKnownPoet = (poetName) => POETS.includes(poetName);
  const selectPoetValue = (poetName) => (isKnownPoet(poetName) ? poetName : OTHER_POET_VALUE);
  const selectedPoem = poems.find((poem) => poem._id === selectedPoemId) || null;
  const getPreviewLines = (content) => {
    if (typeof content !== 'string') return [''];
    const lines = content.split(/\r?\n/);
    return lines.slice(0, 2);
  };

  const activeMehfilPoem = poems.find((poem) => poem._id === activeMehfilPoemId) || null;
  const poemLines = activeMehfilPoem ? activeMehfilPoem.content.split(/\r?\n/) : [];
  const totalMehfilLines = Math.max(poemLines.length, 1);
  const safeRevealedLineCount = Math.min(Math.max(revealedLineCount, 1), totalMehfilLines);
  const mehfilProgress = (safeRevealedLineCount / totalMehfilLines) * 100;

  useEffect(() => {
    fetchPoems();
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsMusicPlaying(true);
    const handlePause = () => setIsMusicPlaying(false);
    const handleError = () => {
      setIsMusicPlaying(false);
      console.error('Music playback failed.');
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handlePause);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handlePause);
      audio.removeEventListener('error', handleError);
    };
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

  const toggleMusic = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      try {
        await audio.play();
      } catch (err) {
        setIsMusicPlaying(false);
        console.error('Unable to start music playback:', err);
      }
      return;
    }

    audio.pause();
  };

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

      {/* 🎶 MYSTIC FLUTE (NEY) */}
      <audio
        ref={audioRef}
        src={musicSrc}
        preload="auto"
        loop
      />
      <div className="music-control" onClick={toggleMusic} title="Toggle Mystic Flute">
        {isMusicPlaying ? '🔇' : '🎵'}
      </div>
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

        <nav>
          <button onClick={() => setView('gallery')} className={view === 'gallery' ? 'active' : ''}>The Sema</button>
          <button onClick={() => setView('plant')} className={view === 'plant' ? 'active' : ''}>Inscribe Verse</button>
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
              <button type="button" className="mehfil-btn mehfil-btn-ghost" onClick={toggleMusic}>{isMusicPlaying ? 'Mute Music' : 'Play Music'}</button>
              <button type="button" className="mehfil-btn mehfil-btn-ghost" onClick={() => setIsDarkMode((prev) => !prev)}>{isDarkMode ? 'Light Mode' : 'Lights Out'}</button>
              <button type="button" className="mehfil-btn mehfil-btn-ghost" onClick={closeMehfil}>Close</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
