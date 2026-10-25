import { formatDate, formatTime, paperOf, prerequisites } from '../lib/conferences.mjs';
import { calendarParts, monthPosition } from './timeline.mjs';

export default function Timeline({ entries, now, zone, selectedId, onSelect, offset, setOffset, archived }) {
  const anchor = calendarParts(now, zone);
  const months = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(anchor.year, anchor.month + offset + i, 1)));
  const firstMonth = months[0].toISOString().slice(0, 10);
  const position = value => monthPosition(value, firstMonth, zone);
  const today = position(now);
  const zoneHelp = zone === 'source' ? 'Dates as published; today line uses UTC.' : zone === 'utc' ? 'Dates and today line use UTC.' : 'Dates and today line use your timezone.';
  return <section className="timeline-section" aria-label="Twelve month conference timeline">
    <div className="timeline-toolbar"><div><button aria-label="Previous six months" onClick={() => setOffset(offset - 6)}>←</button><strong>{formatDate(firstMonth, 'source', { day: undefined })} — {formatDate(months[11].toISOString().slice(0, 10), 'source', { day: undefined })}</strong><button aria-label="Next six months" onClick={() => setOffset(offset + 6)}>→</button><button className="text-button" onClick={() => setOffset(0)}>Today</button></div><div className="timeline-legend"><span><i className="legend-dot"/> Paper</span><span><i className="legend-square"/> Abstract / form</span><span><i className="legend-ring"/> Decision</span><span className="estimate-key">Dashed = estimated</span></div></div>
    <p className="timeline-help">{zoneHelp}</p>
    <div className="timeline-scroll" tabIndex={0} role="region" aria-label="Scrollable conference timeline"><div className="timeline-grid">
      <div className="timeline-header"><span>Conference</span><div>{months.map(month => <span key={month.toISOString()}>{new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(month)}</span>)}</div></div>
      {entries.map(entry => {
        const required = new Set(prerequisites(entry));
        const milestones = entry.milestones.filter(m => ['paper', 'notification'].includes(m.kind) || required.has(m));
        const visible = milestones.map(m => ({ milestone: m, point: position(m.date) })).filter(({ point }) => point >= 0 && point < 100);
        const points = visible.map(({ point }) => point);
        const expanded = selectedId === entry.id;
        return <div className="timeline-row" key={entry.id} data-area={entry.category}>
          <button className="timeline-name" aria-expanded={expanded} aria-controls="timeline-details" onClick={event => onSelect(entry.id, event.currentTarget)}>{entry.name}<span>{entry.year}{entry.estimated ? ' · est.' : ''}</span></button>
          <div className="timeline-track">
            {today >= 0 && today < 100 && <span className="today-line" style={{ left: `${today}%` }} aria-hidden="true"/>}
            {points.length > 1 && <div className={`milestone-bar ${entry.estimated ? 'estimated' : ''}`} style={{ left: `${Math.min(...points)}%`, width: `${Math.max(...points) - Math.min(...points)}%` }}/>} 
            {visible.map(({ milestone: m, point }, i) => {
              const label = `${m.label}: ${entry.estimated ? 'estimated ' : ''}${formatDate(m.date, zone)}, ${formatTime(m, zone)}`;
              return <button key={i} className={`timeline-marker ${m.kind} ${entry.estimated ? 'estimated' : ''}`} style={{ left: `${point}%` }} aria-label={`${entry.name} ${entry.year}: ${label}`} aria-expanded={expanded} aria-controls="timeline-details" title={label} onClick={event => onSelect(entry.id, event.currentTarget)}/>;
            })}
            {!visible.length && <span className="outside-range">{archived ? 'Schedule outside this range' : `Paper: ${formatDate(paperOf(entry).date, zone)}`} →</span>}
          </div>
        </div>;
      })}
    </div></div>
  </section>;
}

