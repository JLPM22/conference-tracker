import Icon from './Icon';
import SubmissionGuide from './SubmissionGuide';
import DeadlineSource from './DeadlineSource';
import { categories, DAY, countdown, formatDate, formatTime, isDateOnly, isPast, needsScheduleUpdate, nextGate, paperOf, prerequisites, timestamp } from '../lib/conferences.mjs';

const publicationLabels = {
  'journal-track': 'Journal publication track',
  'selected-journal': 'Selected papers → journal',
  'journal-extension': 'Invited journal extensions',
  'journal-transfer': 'Journal review transfer',
  'journal-presentation': 'Journal papers → presentation',
  proceedings: 'No journal track announced',
  unconfirmed: 'Journal route not yet confirmed',
};

export function submissionLabel(entry, milestone) {
  if (milestone.kind === 'paper' && milestone.label.toLowerCase().includes('final round')) return 'Paper · final round';
  if (milestone.kind === 'paper') return entry.series === 'rss' ? 'Invited final paper' : 'Paper submission';
  if (milestone.date === paperOf(entry).date) return 'Abstract + paper';
  if (milestone.kind === 'registration') return 'Submission form';
  if (entry.series === 'rss') return 'Extended abstract';
  return milestone.label.toLowerCase().includes('enrollment') ? 'Paper enrollment' : 'Abstract';
}

function Details({ entry, venues, now, zone, onExport, missedPrerequisites }) {
  const milestones = [...entry.milestones].sort((a, b) => timestamp(a.date) - timestamp(b.date));
  return (
    <div className="conference-details">
      <p className="venue-full-name">{entry.fullName}</p>
      {entry.estimated && (
        <p className="estimate-explanation">
          <Icon name="info" size={18} />
          <span>Estimated from the {entry.basisYear} schedule, shifted {entry.yearsShifted} {entry.yearsShifted === 1 ? 'year' : 'years'}.</span>
        </p>
      )}
      {missedPrerequisites.length > 0 && (
        <p className="estimate-explanation">
          <Icon name="alert" size={18} />
          <span>The {missedPrerequisites.map(milestone => milestone.label.toLowerCase()).join(' and ')} deadline has passed. You can use the remaining paper deadline only if you completed {missedPrerequisites.length === 1 ? 'that required step' : 'those required steps'} on time.</span>
        </p>
      )}
      <SubmissionGuide entry={entry} venues={venues} />
      <div className="detail-grid">
        <section className="schedule" aria-label={`${entry.name} submission schedule`}>
          <div className="detail-heading">
            <h3>{entry.estimated ? 'Projected schedule' : 'Submission schedule'}</h3>
            <button className="icon-button" onClick={() => onExport([entry])} aria-label={`Export ${entry.name} calendar`} title="Export paper deadline">
              <Icon name="download" size={18} />
            </button>
          </div>
          <ol className="milestones">
            {milestones.map((milestone, index) => (
              <li key={`${milestone.kind}-${index}`} className={`${isPast(milestone.date, now) ? 'past' : ''} ${milestone.kind === 'paper' ? 'paper-milestone' : ''}`}>
                <span className="milestone-dot" aria-hidden="true" />
                <span className="milestone-label">{milestone.label}</span>
                <div className="milestone-date">
                  <span className="milestone-date-source"><time dateTime={milestone.date}>{formatDate(milestone.date, zone)}</time><DeadlineSource entry={entry} milestone={milestone} /></span>
                  {!entry.estimated && <small>{formatTime(milestone, zone)}</small>}
                  {milestone.kind === 'paper' && !isPast(milestone.date, now) && <small className="paper-remaining">{countdown(milestone.date, now, entry.estimated)} to paper</small>}
                </div>
              </li>
            ))}
          </ol>
        </section>
        <aside className="detail-aside">
          {entry.core && <section className="venue-facts" aria-label="Ranking and publication">
            <h3>Ranking & publication</h3>
            <a className="text-link" href={entry.core.source} target="_blank" rel="noreferrer">{entry.core.edition}: {entry.core.rank || 'No entry found'} <Icon name="arrow" size={13} /></a>
            {entry.core.note && <p>{entry.core.note}</p>}
            {entry.publication && <>
              <h4>{publicationLabels[entry.publication.kind]}</h4>
              {entry.publication.journals.length > 0 && <ul>{entry.publication.journals.map(journal => <li key={journal}>{journal}</li>)}</ul>}
              <p>{entry.publication.note}</p>
              <a className="text-link" href={entry.publication.source} target="_blank" rel="noreferrer">Publication policy ({entry.publication.basisYear}) <Icon name="arrow" size={13} /></a>
              <p className="facts-checked">Checked {formatDate(entry.publication.checkedAt)}.</p>
            </>}
          </section>}
          <div className="event-info">
            <h3>Conference</h3>
            <p>{entry.event?.location || 'Location to be announced'}</p>
            {entry.event?.start && <p>{formatDate(entry.event.start)}{entry.event.end && entry.event.end !== entry.event.start ? ` – ${formatDate(entry.event.end)}` : ''}</p>}
            {entry.event?.source && <a className="text-link" href={entry.event.source} target="_blank" rel="noreferrer">Event website <Icon name="arrow" size={13} /></a>}
          </div>
        </aside>
      </div>
      <div className="source-footer">
        <div>
          <div className="source-links">
            <a className="source-link" href={entry.editionSource} target="_blank" rel="noreferrer">{entry.estimated ? `${entry.basisYear} call for papers` : 'Official call for papers'} <Icon name="arrow" size={14} /></a>
            {entry.paperFit && !entry.paperFit.guide && <a className="source-link" href={entry.paperFit.source} target="_blank" rel="noreferrer" title={`Proceedings; checked ${formatDate(entry.paperFit.checkedAt)}`}>Proceedings ({entry.paperFit.basisYear}) <Icon name="arrow" size={14} /></a>}
          </div>
          <span>Checked {formatDate(entry.checkedAt)}</span>
        </div>
      </div>
    </div>
  );
}

export default function ConferenceCard({ entry, venues = [], now, zone, saved, onSave, expanded, onExpand, archived, onExport }) {
  const paper = paperOf(entry);
  const earlierStep = archived ? paper : nextGate(entry, now);
  const missedPrerequisites = !entry.estimated && !archived ? prerequisites(entry).filter(milestone => isPast(milestone.date, now)) : [];
  const dueSoon = !archived && !entry.estimated && !isPast(paper.date, now) && (timestamp(paper.date) - now) / DAY <= 30;
  const updateNeeded = !archived && needsScheduleUpdate(entry, now);
  const separatePrerequisite = earlierStep.kind !== 'paper' && timestamp(earlierStep.date) !== timestamp(paper.date);
  const summaryId = `summary-${entry.id}`;
  const accessibleSummary = [
    `${entry.name} ${entry.year}, ${categories[entry.category].label}.`,
    entry.estimated ? `Estimated from the ${entry.basisYear} schedule.` : 'Official deadline.',
    entry.core ? `${entry.core.edition}: ${entry.core.rank || 'no entry found'}.` : '',
    `${submissionLabel(entry, paper)}: ${formatDate(paper.date, zone)}${entry.estimated ? '.' : `, ${formatTime(paper, zone)}.`}`,
    separatePrerequisite ? `${submissionLabel(entry, earlierStep)}: ${formatDate(earlierStep.date, zone)}.` : '',
    entry.paperFit ? `Paper fit: ${entry.paperFit.scope}. Emphasis: ${entry.paperFit.emphasis}.` : '',
    archived ? 'Submission closed.' : `${countdown(paper.date, now, entry.estimated)} remaining to paper submission.`,
    missedPrerequisites.length > 0 ? 'An earlier required step has closed. The remaining deadline applies only if you completed it on time.' : '',
  ].filter(Boolean).join(' ');

  return (
    <article className={`conference-card ${expanded ? 'is-expanded' : ''} ${dueSoon ? 'due-soon' : ''}`} data-area={entry.category} aria-label={`${entry.name} ${entry.year}`}>
      {/* Referenced hidden text supplies a description without a second browse-mode copy. */}
      <span id={summaryId} hidden>{accessibleSummary}</span>
      <div className="conference-summary">
        <div className="row-content">
          <button className="row-open" onClick={() => onExpand(entry.id)} aria-expanded={expanded} aria-controls={`details-${entry.id}`} aria-describedby={summaryId} aria-label={`${expanded ? 'Hide' : 'Show'} ${entry.name} details`} />
          <span className="venue-summary">
            <span className="venue-name">{entry.name} <span>{entry.year}</span></span>
            <span className="venue-meta">
              <span className="area-tag">{categories[entry.category].label}</span>
              {entry.core && <span className="rank-tag" title={`${entry.core.edition}${entry.core.note ? ': ' + entry.core.note : ''}`}>{entry.core.edition === 'ICORE2026' ? 'CORE' : entry.core.edition.replace('CORE', 'CORE ')} {entry.core.rank || '—'}</span>}
            </span>
          </span>
          <span className="action-summary">
            <span className="action-label">{submissionLabel(entry, paper)}</span>
            <span className="deadline-date">
              <time dateTime={paper.date}>{formatDate(paper.date, zone)}</time>
              {entry.estimated ? <span className="status-badge estimate" title={`Deadline estimated from the ${entry.basisYear} schedule`}>Estimated</span> : <span className="status-badge official" title="Official deadline" aria-label="Official deadline"><Icon name="check" size={17} /></span>}
              <DeadlineSource entry={entry} milestone={paper} />
            </span>
            {!entry.estimated && <span className="deadline-time">{formatTime(paper, zone)}</span>}
            {separatePrerequisite && <span className="paper-follows"><span>{submissionLabel(entry, earlierStep)}: {formatDate(earlierStep.date, zone)}</span><DeadlineSource entry={entry} milestone={earlierStep} /></span>}
            {missedPrerequisites.length > 0 && <span className="prerequisite-warning"><Icon name="alert" size={13} /> Earlier step closed</span>}
          </span>
          {entry.paperFit && <span className="paper-fit">
            <span className="paper-fit-label" aria-hidden="true">Paper fit</span>
            <strong>{entry.paperFit.scope}</strong>
            <span className="paper-fit-emphasis">{entry.paperFit.emphasis}</span>
          </span>}
          <span className="countdown">
            <strong>{countdown(paper.date, now, entry.estimated)}</strong>
            <span className="mobile-countdown-label">{archived ? 'Submission closed' : isDateOnly(paper.date) ? 'approximately left' : 'left to submit'}</span>
          </span>
          <Icon name="chevron" size={19} className="expand-icon" />
        </div>
        <button className={`icon-button save-button ${saved ? 'saved' : ''}`} aria-label={`${saved ? 'Unsave' : 'Save'} ${entry.name}`} title={saved ? 'Remove bookmark' : 'Save conference'} aria-pressed={saved} onClick={() => onSave(entry.series)}>
          <Icon name="bookmark" />
        </button>
      </div>
      {updateNeeded && <p className="update-warning">
        <Icon name="alert" size={17} />
        <span><strong>Update needed.</strong> Official dates are likely available. Update this tracker.</span>
      </p>}
      <div id={`details-${entry.id}`} hidden={!expanded}>
        {expanded && <Details entry={entry} venues={venues} now={now} zone={zone} onExport={onExport} missedPrerequisites={missedPrerequisites} />}
      </div>
    </article>
  );
}
