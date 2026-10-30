export const DAY = 86_400_000;
export const categories = {
  graphics: { label: 'Graphics', short: 'CG', color: '#168560' },
  vision: { label: 'Vision', short: 'CV', color: '#4b79a4' },
  robotics: { label: 'Robotics', short: 'RB', color: '#a66b3c' },
  hci: { label: 'VR / HCI', short: 'XR', color: '#8767aa' },
  ai: { label: 'AI / ML', short: 'AI', color: '#248b72' },
};
export const isDateOnly = date => /^\d{4}-\d{2}-\d{2}$/.test(date);

// A date without a published time is never turned into an exact deadline.
// UTC noon is only a stable sorting/display coordinate, not a cutoff.
export const timestamp = date => Date.parse(isDateOnly(date) ? `${date}T12:00:00Z` : date);
export function isPast(date, now) {
  return isDateOnly(date) ? date < new Date(now).toISOString().slice(0, 10) : timestamp(date) <= now;
}
export const paperOf = entry => entry.milestones.find(m => m.kind === 'paper');
export const prerequisites = entry => entry.milestones.filter(m => m.required !== false && ['abstract', 'registration'].includes(m.kind) && timestamp(m.date) <= timestamp(paperOf(entry).date));
export function nextGate(entry, now) {
  return [...prerequisites(entry), paperOf(entry)].filter(Boolean).filter(m => !isPast(m.date, now)).sort((a, b) => timestamp(a.date) - timestamp(b.date))[0] || paperOf(entry);
}
export function needsScheduleUpdate(entry, now) {
  if (!entry.estimated || isPast(paperOf(entry).date, now)) return false;
  // Keep the reminder after an estimated prerequisite passes, until the paper closes.
  const firstStep = [...prerequisites(entry), paperOf(entry)].sort((a, b) => timestamp(a.date) - timestamp(b.date))[0];
  const deadlineDay = Date.parse(`${firstStep.date.slice(0, 10)}T00:00:00Z`);
  const today = Date.parse(`${new Date(now).toISOString().slice(0, 10)}T00:00:00Z`);
  return (deadlineDay - today) / DAY <= 60;
}
export function shiftDate(date, years) {
  if (!date) return null;
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  const shiftedYear = year + years;
  const lastDay = new Date(Date.UTC(shiftedYear, month, 0)).getUTCDate();
  return `${shiftedYear}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}
export function planningEdition(entry, now) {
  const paper = paperOf(entry);
  if (!isPast(paper.date, now)) return { ...entry, estimated: false, basisYear: entry.year };
  let years = entry.cycleYears;
  while (isPast(shiftDate(paper.date, years), now)) years += entry.cycleYears;
  const year = entry.year + years;
  const announced = entry.announcedEvents?.[year];
  return {
    ...entry, id: `${entry.series}-${year}-estimated`, year, estimated: true,
    basisYear: entry.year, basis: entry, yearsShifted: years,
    event: announced || { start: null, end: null, location: null },
    // Conference dates and locations are not inferred from an earlier host.
    milestones: entry.milestones.map(m => ({ ...m, date: shiftDate(m.date, years), timezone: 'Estimated date', originalDate: m.date })),
  };
}
export function countdown(date, now, estimated = false) {
  if (isPast(date, now)) return 'Closed';
  if (isDateOnly(date) || estimated) {
    const days = Math.round((Date.parse(`${date.slice(0, 10)}T00:00:00Z`) - Date.parse(`${new Date(now).toISOString().slice(0, 10)}T00:00:00Z`)) / DAY);
    return days === 0 ? (estimated ? 'Around today' : 'Today · time TBA') : `~${days} ${days === 1 ? 'day' : 'days'}`;
  }
  const minutes = Math.max(0, Math.floor((timestamp(date) - now) / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor(minutes % 1440 / 60);
  return days > 0 ? `${days}d ${hours}h` : `${hours}h ${minutes % 60}m`;
}
export function formatDate(date, mode = 'source', options = {}) {
  if (!date) return 'To be announced';
  const dateOnly = isDateOnly(date);
  const source = mode === 'source' || dateOnly;
  const value = source ? new Date(`${date.slice(0, 10)}T12:00:00Z`) : new Date(date);
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: source || mode === 'utc' ? 'UTC' : undefined, ...options }).format(value);
}
export function formatTime(milestone, mode = 'source') {
  if (isDateOnly(milestone.date)) return milestone.timezone === 'Estimated date' ? 'Planning estimate' : 'Time not published';
  if (mode === 'source') return `${milestone.date.slice(11, 16)} ${milestone.timezone}`;
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short', timeZone: mode === 'utc' ? 'UTC' : undefined }).format(new Date(milestone.date));
}
export function filterEntries(entries, { category = 'all', query = '', status = 'all', savedOnly = false, saved = [], sort = 'deadline', archived = false }, now) {
  const search = query.trim().toLowerCase();
  return entries.filter(e => (category === 'all' || e.category === category)
    && (!search || [e.name, e.fullName, ...e.topics, e.year, e.event?.location].join(' ').toLowerCase().includes(search))
    && (status === 'all' || (status === 'estimated' ? e.estimated : !e.estimated))
    && (!savedOnly || saved.includes(e.series)))
    .sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      const deadline = entry => timestamp((!archived && sort === 'next-step' ? nextGate(entry, now) : paperOf(entry)).date);
      const direction = archived && sort !== 'oldest' ? -1 : 1;
      return direction * (deadline(a) - deadline(b));
    });
}
const escapeICS = text => String(text).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
const utcICS = date => new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
function foldICS(line) {
  let parts = [], part = '', bytes = 0;
  for (const char of line) {
    const length = new TextEncoder().encode(char).length;
    if (bytes + length > 75) { parts.push(part); part = ' '; bytes = 1; }
    part += char; bytes += length;
  }
  parts.push(part);
  return parts.join('\r\n');
}
export function makeCalendar(entries, now, includePast = false) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Jose Luis Ponton//Conference Planner//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Conference deadlines'];
  for (const entry of entries) {
    for (const [index, m] of entry.milestones.entries()) {
      if (m.kind !== 'paper') continue;
      if (!includePast && isPast(m.date, now)) continue;
      const dateOnly = isDateOnly(m.date);
      const description = `${entry.estimated ? `ESTIMATE ONLY: shifted ${entry.yearsShifted} year(s) from ${entry.basisYear}. Verify the new call before submitting.\n` : ''}${formatTime(m)}\n${entry.notes || ''}\nSource: ${m.source}\nChecked: ${entry.checkedAt}`;
      lines.push('BEGIN:VEVENT', `UID:${entry.id}-${m.kind}-${index}@conference-planner`, `DTSTAMP:${utcICS(now)}`, `SUMMARY:${escapeICS(`${entry.estimated ? '[ESTIMATE] ' : ''}${entry.name} ${entry.year} · ${m.label}`)}`);
      if (dateOnly) {
        const nextDay = new Date(Date.parse(`${m.date}T00:00:00Z`) + DAY).toISOString().slice(0, 10).replaceAll('-', '');
        lines.push(`DTSTART;VALUE=DATE:${m.date.replaceAll('-', '')}`, `DTEND;VALUE=DATE:${nextDay}`);
      } else {
        lines.push(`DTSTART:${utcICS(m.date)}`, `DTEND:${utcICS(timestamp(m.date) + 60_000)}`);
      }
      lines.push(`DESCRIPTION:${escapeICS(description)}`, `URL:${m.source}`, `STATUS:${entry.estimated ? 'TENTATIVE' : 'CONFIRMED'}`, 'TRANSP:TRANSPARENT', 'END:VEVENT');
    }
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldICS).join('\r\n') + '\r\n';
}
