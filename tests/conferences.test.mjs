import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countdown, formatTime, isPast, makeCalendar, needsScheduleUpdate, nextGate,
  paperOf, planningEdition, prerequisites, shiftDate, timestamp,
} from '../lib/conferences.mjs';
import { validDate, validateEntries } from '../scripts/validate-data.mjs';

const source = 'https://conference.example/call/';
const milestone = (kind, date, label = kind) => ({ kind, label, date, timezone: date.includes('T') ? 'AoE' : 'Not specified', source });
const fixture = (overrides = {}) => ({
  id: 'sample-2026', series: 'sample', name: 'Sample', fullName: 'Sample Conference',
  year: 2026, category: 'graphics', topics: ['animation'], cycleYears: 1,
  website: 'https://conference.example/', editionSource: source, checkedAt: '2026-10-22',
  event: { start: '2026-08-08', end: '2026-08-10', location: 'Original host' },
  notes: 'Official full-paper schedule.',
  milestones: [milestone('abstract', '2026-01-15T23:59:00-12:00'), milestone('paper', '2026-01-22T23:59:00-12:00')],
  ...overrides,
});
const utc = value => Date.parse(value);
const unfold = calendar => calendar.replace(/\r\n[ \t]/g, '');

test('estimated schedules request an update from 60 calendar days before the first required step', () => {
  const estimated = { ...fixture(), estimated: true, milestones: [milestone('abstract', '2027-01-15'), milestone('paper', '2027-01-22')] };
  assert.equal(needsScheduleUpdate(estimated, utc('2026-11-15T23:59:59Z')), false);
  assert.equal(needsScheduleUpdate(estimated, utc('2026-11-16T00:00:00Z')), true);
  assert.equal(needsScheduleUpdate(estimated, utc('2027-01-15T23:59:59Z')), true);
  assert.equal(needsScheduleUpdate(estimated, utc('2027-01-22T23:59:59Z')), true);
  assert.equal(needsScheduleUpdate(estimated, utc('2027-01-23T00:00:00Z')), false);
  assert.equal(needsScheduleUpdate({ ...estimated, estimated: false }, utc('2027-01-15T12:00:00Z')), false);
});

test('update reminders survive an estimated prerequisite passing and ignore unrelated missing metadata', () => {
  const entry = { ...fixture(), estimated: true, event: { start: '2027-07-01', end: '2027-07-03', location: 'Confirmed host' }, milestones: [milestone('abstract', '2027-01-01'), milestone('paper', '2027-04-15')] };
  assert.equal(needsScheduleUpdate(entry, utc('2027-01-02T00:00:00Z')), true);
  assert.equal(needsScheduleUpdate({ ...entry, estimated: false, event: { start: null, end: null, location: null } }, utc('2027-04-01T00:00:00Z')), false);
});

test('recommended abstracts are shown in the schedule but do not control countdowns or update reminders', () => {
  const entry = { ...fixture(), estimated: true, milestones: [
    { ...milestone('abstract', '2027-04-13'), required: false },
    milestone('paper', '2027-04-15'),
  ] };
  const now = utc('2027-02-13T12:00:00Z');
  assert.equal(prerequisites(entry).length, 0);
  assert.equal(nextGate(entry, now).date, '2027-04-15');
  assert.equal(needsScheduleUpdate(entry, now), false);
  assert.equal(needsScheduleUpdate(entry, utc('2027-02-14T00:00:00Z')), true);
});

test('AoE remains open through the following UTC morning and closes at the exact deadline', () => {
  const date = '2026-05-12T23:59:00-12:00';
  assert.equal(timestamp(date), utc('2026-05-13T11:59:00Z'));
  assert.equal(isPast(date, utc('2026-05-13T11:58:59Z')), false);
  assert.equal(isPast(date, utc('2026-05-13T11:59:00Z')), true);
  assert.equal(countdown(date, utc('2026-05-13T10:59:00Z')), '1h 0m');
});

test('date-only milestones retain uncertainty throughout their stated date', () => {
  const now = utc('2026-10-22T23:59:59Z');
  assert.equal(isPast('2026-10-22', now), false);
  assert.equal(isPast('2026-10-22', utc('2026-10-23T00:00:00Z')), true);
  assert.equal(countdown('2026-10-22', now), 'Today \u00b7 time TBA');
  assert.equal(countdown('2026-10-23', now), '~1 day');
  assert.equal(formatTime(milestone('paper', '2026-10-22')), 'Time not published');
  assert.equal(countdown('2026-10-22', now, true), 'Around today');
});

test('annual rollover removes false time precision and does not copy an earlier host', () => {
  const original = fixture();
  const result = planningEdition(original, utc('2026-10-22T12:00:00Z'));
  assert.equal(result.year, 2027);
  assert.equal(result.id, 'sample-2027-estimated');
  assert.equal(result.estimated, true);
  assert.equal(result.basisYear, 2026);
  assert.equal(paperOf(result).date, '2027-01-22');
  assert.equal(paperOf(result).originalDate, '2026-01-22T23:59:00-12:00');
  assert.equal(paperOf(result).timezone, 'Estimated date');
  assert.deepEqual(result.event, { start: null, end: null, location: null });
  assert.equal(paperOf(original).date, '2026-01-22T23:59:00-12:00');
});

test('stale biennial editions advance by the correct number of complete cycles', () => {
  const entry = fixture({ cycleYears: 2 });
  const result = planningEdition(entry, utc('2028-10-22T12:00:00Z'));
  assert.equal(result.year, 2030);
  assert.equal(result.yearsShifted, 4);
  assert.equal(paperOf(result).date, '2030-01-22');
});

test('leap-day projection clamps nonleap years without drifting future leap years', () => {
  assert.equal(shiftDate('2024-02-29T23:59:00-12:00', 1), '2025-02-28');
  assert.equal(shiftDate('2024-02-29', 4), '2028-02-29');
  const result = planningEdition(fixture({ year: 2024, milestones: [milestone('paper', '2024-02-29')], cycleYears: 4 }), utc('2027-10-22T12:00:00Z'));
  assert.equal(paperOf(result).date, '2028-02-29');
});

test('an official upcoming edition preserves its exact deadline and confirmed venue', () => {
  const entry = fixture();
  const result = planningEdition(entry, utc('2026-01-01T00:00:00Z'));
  assert.equal(result.estimated, false);
  assert.equal(result.year, 2026);
  assert.equal(paperOf(result).date, '2026-01-22T23:59:00-12:00');
  assert.deepEqual(result.event, entry.event);
});

test('a separately announced future event survives deadline projection', () => {
  const announced = { start: '2027-11-30', end: '2027-12-03', location: 'Tokyo, Japan', source };
  const entry = fixture({ announcedEvents: { 2027: announced } });
  const result = planningEdition(entry, utc('2026-10-22T00:00:00Z'));
  assert.deepEqual(result.event, announced);
  assert.equal(result.estimated, true);
});

test('next action selects earlier submission requirements, excluding later attendance registration', () => {
  const entry = fixture({ milestones: [
    milestone('paper', '2027-01-28T22:00:00+00:00'),
    milestone('registration', '2027-01-21T22:00:00+00:00', 'Submission form'),
    milestone('abstract', '2027-01-20T22:00:00+00:00'),
    milestone('registration', '2027-06-01', 'Author conference registration'),
  ] });
  assert.deepEqual(prerequisites(entry).map(m => m.label), ['Submission form', 'abstract']);
  assert.equal(nextGate(entry, utc('2027-01-01T00:00:00Z')).kind, 'abstract');
  assert.equal(nextGate(entry, utc('2027-01-21T00:00:00Z')).label, 'Submission form');
  assert.equal(nextGate(entry, utc('2027-01-22T00:00:00Z')).kind, 'paper');
});

test('calendar export keeps exact deadlines in UTC and unknown times as all-day events', () => {
  const entry = fixture({ milestones: [
    milestone('paper', '2026-05-12T23:59:00-12:00'),
    milestone('notification', '2026-12-31'),
  ] });
  const calendar = unfold(makeCalendar([entry], utc('2026-01-01T00:00:00Z')));
  assert.match(calendar, /DTSTART:20260513T115900Z\r\nDTEND:20260513T120000Z/);
  assert.match(calendar, /DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101/);
  assert.equal((calendar.match(/STATUS:CONFIRMED/g) || []).length, 2);
  assert.match(calendar, /DTSTAMP:20260101T000000Z/);
});

test('calendar estimates are tentative, explicitly labeled, and contain their historical basis', () => {
  const now = utc('2026-10-22T12:00:00Z');
  const entry = planningEdition(fixture(), now);
  const calendar = unfold(makeCalendar([entry], now));
  assert.match(calendar, /SUMMARY:\[ESTIMATE\] Sample 2027/);
  assert.match(calendar, /STATUS:TENTATIVE/);
  assert.doesNotMatch(calendar, /STATUS:CONFIRMED/);
  assert.match(calendar, /ESTIMATE ONLY: shifted 1 year\(s\) from 2026/);
  assert.match(calendar, /DTSTART;VALUE=DATE:20270122/);
});

test('calendar escaping and UTF-8 folding preserve punctuation, newlines, and multibyte characters', () => {
  const name = 'Visual, Motion; \\ Research';
  const notes = 'First line\nSecond, line; path \\ folder. ' + '\u00e9\u6771\u4eac\u{1f9ea}'.repeat(30);
  const entry = fixture({ name, notes });
  const calendar = makeCalendar([entry], utc('2026-01-01T00:00:00Z'));
  for (const line of calendar.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75, `ICS line exceeds 75 octets: ${line}`);
  assert.ok(calendar.includes('\r\n '), 'long lines should be folded');
  assert.equal(calendar.replace(/\r\n/g, '').includes('\n'), false, 'must use CRLF physical line endings');
  const unfolded = unfold(calendar);
  assert.ok(unfolded.includes('SUMMARY:Visual\\, Motion\\; \\\\ Research'));
  assert.ok(unfolded.includes('First line\\nSecond\\, line\\; path \\\\ folder.'));
  assert.ok(unfolded.includes('\u00e9\u6771\u4eac\u{1f9ea}'.repeat(30)));
});

test('past deadlines are omitted from normal export but retained in archive export', () => {
  const entry = fixture();
  const now = utc('2026-10-22T12:00:00Z');
  assert.doesNotMatch(makeCalendar([entry], now), /BEGIN:VEVENT/);
  assert.equal((makeCalendar([entry], now, true).match(/BEGIN:VEVENT/g) || []).length, 2);
});

test('validation rejects impossible dates and timestamps without an explicit timezone', () => {
  for (const invalid of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-00-01', '2026-01-00', '2026-01-02T23:59:00', '2026-01-02T24:00:00+00:00', '2026-01-02T23:59:00+14:01']) {
    assert.equal(validDate(invalid), false, invalid);
  }
  for (const valid of ['2028-02-29', '2026-01-02T23:59:59-12:00', '2026-01-02T00:00:00+00:00']) assert.equal(validDate(valid), true, valid);
});

test('validation catches duplicate series, missing papers, unsafe sources, and invalid announced events', () => {
  assert.deepEqual(validateEntries([fixture()]), []);
  assert.ok(validateEntries([fixture(), fixture()]).some(error => error.includes('series is duplicated')));
  assert.ok(validateEntries([fixture({ milestones: [] })]).some(error => error.includes('exactly one paper')));
  assert.ok(validateEntries([fixture({ editionSource: 'http://conference.example/' })]).some(error => error.includes('absolute HTTPS URL')));
  assert.ok(validateEntries([fixture({ announcedEvents: { 2027: { start: '2027-02-30', end: null, location: null, source } } })]).some(error => error.includes('.start must be a real')));
});
