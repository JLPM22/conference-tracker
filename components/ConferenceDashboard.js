'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { categories, DAY, filterEntries, formatDate, isPast, makeCalendar, paperOf, planningEdition, timestamp } from '../lib/conferences.mjs';
import ConferenceCard from './ConferenceCard';
import Icon from './Icon';
import Timeline from './Timeline';

function downloadCalendar(entries, now, includePast) {
  const url = URL.createObjectURL(new Blob([makeCalendar(entries, now, includePast)], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = entries.length === 1 ? `${entries[0].id}.ics` : 'conference-deadlines.ics';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ConferenceDashboard({ conferences }) {
  const checkedDate = conferences.map(entry => entry.checkedAt).sort()[0];
  const [now, setNow] = useState(null);
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [saved, setSaved] = useState([]);
  const [savedOnly, setSavedOnly] = useState(false);
  const [view, setView] = useState('list');
  const [period, setPeriod] = useState('upcoming');
  const [sort, setSort] = useState('deadline');
  const [zone, setZone] = useState('source');
  const [expanded, setExpanded] = useState(null);
  const [timelineOffset, setTimelineOffset] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const timelineDetails = useRef(null);
  const timelineTrigger = useRef(null);
  const pendingTimelineFocus = useRef(null);
  const searchInput = useRef(null);

  useEffect(() => {
    setNow(Date.now());
    try {
      const data = JSON.parse(localStorage.getItem('conference-planner-v1') || '{}');
      if (Array.isArray(data.saved)) setSaved(data.saved.filter(value => typeof value === 'string'));

    } catch { setStorageWarning(true); }
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    const refresh = () => setNow(Date.now());
    const focusSearch = event => {
      if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        event.preventDefault();
        searchInput.current?.focus();
      }
    };
    document.addEventListener('keydown', focusSearch);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('keydown', focusSearch);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  const persist = (nextSaved) => {
    try { localStorage.setItem('conference-planner-v1', JSON.stringify({ saved: nextSaved })); }
    catch { setStorageWarning(true); }
  };
  const toggleSave = series => {
    const next = saved.includes(series) ? saved.filter(item => item !== series) : [...saved, series];
    setSaved(next);
    persist(next);
  };
  const planning = useMemo(() => now ? conferences.map(entry => planningEdition(entry, now)) : [], [conferences, now]);
  const archived = period === 'past';
  const entries = archived ? conferences.filter(entry => isPast(paperOf(entry).date, now)).map(entry => ({ ...entry, estimated: false })) : planning;
  const filtered = filterEntries(entries, { category, query, status, savedOnly, saved, sort }, now || 0);
  const selected = filtered.find(entry => entry.id === expanded);
  const advancedCount = Number(status !== 'all') + Number(sort !== 'deadline');
  const hasFilters = category !== 'all' || query.trim() || savedOnly || advancedCount > 0;
  const clearFilters = () => { setCategory('all'); setQuery(''); setStatus('all'); setSavedOnly(false); setSort('deadline'); };
  const changePeriod = value => { setPeriod(value); setStatus('all'); setExpanded(null); };
  const onExport = exported => downloadCalendar(exported, now, archived);
  const scrollBehavior = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
  const selectTimeline = (id, trigger) => {
    if (expanded === id) {
      pendingTimelineFocus.current = null;
      setExpanded(null);
      if (!trigger && timelineTrigger.current?.isConnected) {
        timelineTrigger.current.focus({ preventScroll: true });
        timelineTrigger.current.scrollIntoView({ behavior: scrollBehavior(), block: 'nearest' });
      }
    } else {
      timelineTrigger.current = trigger || null;
      pendingTimelineFocus.current = id;
      setExpanded(id);
    }
  };
  const expand = id => view === 'timeline' ? selectTimeline(id) : setExpanded(expanded === id ? null : id);
  useEffect(() => {
    if (view !== 'timeline' || !selected || pendingTimelineFocus.current !== selected.id || !timelineDetails.current) return;
    pendingTimelineFocus.current = null;
    timelineDetails.current.focus({ preventScroll: true });
    timelineDetails.current.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
  }, [selected, view]);

  return (
    <>
      <header className="site-header">
        <div className="site-container header-content">
          <a className="identity" href="https://joseluisponton.com/">Jose Luis Ponton <Icon name="arrow" size={16} /></a>
          <button className="export-button" disabled={!filtered.length} onClick={() => onExport(filtered)} title="Export the displayed schedules, including labeled estimates">
            <Icon name="download" size={18} /><span>Export calendar</span>
          </button>
        </div>
      </header>

      <main id="main-content" className="site-container">
        <div className="page-heading">
          <h1>Conference tracker<span aria-hidden="true">.</span></h1>
          <div className="period-switch" aria-label="Submission cycle">
            <button aria-label="Upcoming submissions" aria-pressed={!archived} onClick={() => changePeriod('upcoming')}>Upcoming</button>
            <button aria-label="Closed submissions" aria-pressed={archived} onClick={() => changePeriod('past')}>Closed</button>
          </div>
        </div>

        <section className="planner" aria-label="Find conferences">
          <div className="toolbar">
            <label className="search-box">
              <Icon name="search" />
              <input ref={searchInput} type="search" aria-label="Search conferences" placeholder="Find a conference, topic, or place" value={query} onChange={event => setQuery(event.target.value)} />
              <kbd aria-hidden="true">/</kbd>
            </label>
            <button className={`tool-button saved-filter ${savedOnly ? 'active' : ''}`} aria-label="Saved conferences" aria-pressed={savedOnly} onClick={() => setSavedOnly(!savedOnly)}>
              <Icon name="bookmark" size={18} /><span>Saved</span>{saved.length > 0 && <span className="button-count">{saved.length}</span>}
            </button>
            <button className={`tool-button filter-toggle ${filtersOpen ? 'active' : ''}`} aria-expanded={filtersOpen} aria-controls="advanced-filters" onClick={() => setFiltersOpen(!filtersOpen)}>
              <Icon name="filter" size={19} /><span>Filters</span>{advancedCount > 0 && <span className="button-count">{advancedCount}</span>}
            </button>
            <div className="view-switch" aria-label="Display">
              <button title="List view" aria-label="List view" aria-pressed={view === 'list'} onClick={() => setView('list')}><Icon name="list" size={19} /></button>
              <button title="Timeline view" aria-label="Timeline view" aria-pressed={view === 'timeline'} onClick={() => setView('timeline')}><Icon name="timeline" size={19} /></button>
            </div>
          </div>

          <div id="advanced-filters" className="advanced-filters" hidden={!filtersOpen}>
            <label>Date certainty<select aria-label="Date certainty" value={status} onChange={event => setStatus(event.target.value)}>
              <option value="all">Official + estimated</option><option value="official">Official only</option><option value="estimated" disabled={archived}>Estimates only</option>
            </select></label>
            <label>Sort by<select aria-label="Sort conferences" value={sort} onChange={event => setSort(event.target.value)}>
              <option value="deadline">Next submission step</option><option value="paper">Paper deadline</option><option value="name">Conference name</option>
            </select></label>
          </div>

          <div className="category-tabs" aria-label="Research area">
            <button aria-pressed={category === 'all'} onClick={() => setCategory('all')}>All areas</button>
            {Object.entries(categories).map(([key, value]) => <button key={key} data-area={key} aria-pressed={category === key} onClick={() => setCategory(key)}><span className="category-dot" aria-hidden="true" />{value.label}</button>)}
          </div>

          <div className="results-meta">
            <div><span role="status">{now ? `${filtered.length} ${filtered.length === 1 ? 'conference' : 'conferences'}` : 'Loading conferences…'}</span>{hasFilters && <button className="reset-filters" onClick={clearFilters}>Clear filters <Icon name="close" size={12} /></button>}</div>
            <label className="timezone-control"><Icon name="globe" size={16} /><span className="sr-only">Times</span><select aria-label="Display timezone" value={zone} onChange={event => setZone(event.target.value)}>
              <option value="source">As published</option><option value="local">My timezone</option><option value="utc">UTC</option>
            </select></label>
          </div>

          {storageWarning && <p className="storage-warning"><Icon name="alert" size={18} /> Browser storage is unavailable. Bookmarks will last for this visit only.</p>}
          {!now ? (
            <div className="empty-state"><Icon name="clock" size={32} /><h2>One moment…</h2><p>Calculating deadlines with your current time.</p><noscript>Enable JavaScript to view schedules and live countdowns.</noscript></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <Icon name={savedOnly ? 'bookmark' : 'search'} size={32} />
              <h2>{savedOnly && saved.length === 0 ? 'A little space for your shortlist.' : 'No matching conferences.'}</h2>
              <p>{savedOnly && saved.length === 0 ? 'Bookmark a venue to keep it here.' : 'Try another search or clear your filters.'}</p>
              {/* The reset above remains the single action for clearing filters. */}
            </div>
          ) : (
            <>
              {view === 'timeline' && <Timeline entries={filtered} now={now} zone={zone} selectedId={selected?.id} onSelect={selectTimeline} offset={timelineOffset} setOffset={setTimelineOffset} archived={archived} />}
              {view === 'list' && <div className="list-heading" aria-hidden="true"><span>Conference</span><span>Next submission step</span><span title="Typical work and what to emphasize">Paper fit</span><span>Time left</span><span /></div>}
              <div className="conference-list" ref={timelineDetails} id={view === 'timeline' ? 'timeline-details' : undefined} role={view === 'timeline' ? 'region' : undefined} tabIndex={view === 'timeline' ? -1 : undefined} aria-label={view === 'timeline' ? selected ? `${selected.name} ${selected.year} submission details` : 'Selected conference details' : undefined} hidden={view === 'timeline' && !selected}>
                {(view === 'timeline' ? selected ? [selected] : [] : filtered).map(entry => (
                  <ConferenceCard key={entry.id} entry={entry} venues={conferences} now={now} zone={zone} saved={saved.includes(entry.series)} onSave={toggleSave} expanded={expanded === entry.id} onExpand={expand} archived={archived} onExport={onExport} />
                ))}
              </div>
            </>
          )}
        </section>

        <footer className="planner-footer">
          <details className="about-dates">
            <summary><Icon name="info" size={17} /> About this tracker <Icon name="chevron" size={14} /></summary>
            <div>
              <p><strong>Official or estimated.</strong> The check icon means an official source. Estimates shift the previous verified schedule to the next annual or biennial cycle.</p>
              <p><strong>The first step matters.</strong> Abstracts and submission forms may close before the full paper. The countdown follows the next required step; expand a conference for its full schedule and sources.</p>
              <p><strong>Times stay explicit.</strong> AoE is UTC−12. Unknown times and estimates show approximate day counts. Official announcements are updated manually; countdowns update automatically.</p>
              <p><strong>Paper fit.</strong> Expected contributions, evaluation methods and comparisons with related conferences.</p>
              <p><strong>Your planning stays yours.</strong> Bookmarks live in this browser. Calendar downloads are snapshots, with estimates marked tentative; later changes do not sync.</p>
            </div>
          </details>
          <p className="freshness">Sources checked from {formatDate(checkedDate)}{now && now - timestamp(checkedDate) > 30 * DAY ? ' · Check the calls for updates' : ''}</p>
        </footer>
      </main>
    </>
  );
}
