import Icon from './Icon';
import { formatDate } from '../lib/conferences.mjs';

export default function DeadlineSource({ entry, milestone }) {
  const context = entry.estimated ? `${entry.basisYear} estimate basis` : `${entry.year} source`;
  const label = `${entry.name}: ${milestone.label} — ${context}`;
  const location = milestone.sourceSection || new URL(milestone.source).hostname;
  const originalDate = milestone.originalDate || milestone.date;
  return <a className="deadline-source" href={milestone.source} target="_blank" rel="noreferrer"
    aria-label={label} aria-description={`${location} · ${formatDate(originalDate)}`} title={`${label}\n${location} · ${formatDate(originalDate)}`}>
    <Icon name="link" size={14} />
  </a>;
}
