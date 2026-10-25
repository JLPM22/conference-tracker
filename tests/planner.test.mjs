import test from 'node:test';
import assert from 'node:assert/strict';
import { filterEntries, planningEdition, nextGate } from '../lib/conferences.mjs';

// Fixed fixtures keep these behavior tests independent of future source updates.
function record(name, year, category, paper, abstract, cycleYears = 1) {
  const series = name.toLowerCase();
  const milestone = (kind, date) => ({ kind, date, label: kind, timezone: 'AoE', source: 'https://example.org/call' });
  return {
    id: `${series}-${year}`, series, name, fullName: `${name} conference`, year, category, cycleYears,
    topics: category === 'robotics' ? ['robot learning'] : ['human motion'],
    checkedAt: '2026-10-22', event: { start: null, end: null, location: null },
    milestones: [milestone('paper', paper), ...(abstract ? [milestone('abstract', abstract)] : [])],
  };
}
const records = [
  record('SIGGRAPH', 2027, 'graphics', '2027-01-28T22:00:00Z', '2027-01-21T22:00:00Z'),
  record('CVPR', 2027, 'vision', '2026-11-16T23:59:00-12:00', '2026-11-10T23:59:00-12:00'),
  record('RSS', 2027, 'robotics', '2027-04-16T23:59:00-12:00', '2026-12-04T23:59:00-12:00'),
  record('IROS', 2027, 'robotics', '2027-03-01'),
  record('CoRL', 2026, 'robotics', '2026-05-28'),
  record('CHI', 2027, 'hci', '2026-09-10T23:59:00-12:00'),
  record('ECCV', 2026, 'vision', '2026-03-05T23:00:00+01:00', null, 2),
];
const now = Date.parse('2026-10-22T12:00:00Z');
const editions = records.map(entry => planningEdition(entry, now));

test('planner separates known future calls from projected submission cycles', () => {
  assert.equal(editions.length, 7);
  assert.deepEqual(editions.filter(entry => !entry.estimated).map(entry => entry.series).sort(), ['cvpr', 'iros', 'rss', 'siggraph']);
  assert.equal(editions.find(entry => entry.series === 'eccv').year, 2028);
  assert.equal(editions.find(entry => entry.series === 'chi').year, 2028);
  const rss = editions.find(entry => entry.series === 'rss');
  assert.equal(nextGate(rss, now).date, '2026-12-04T23:59:00-12:00');
});

test('research area, certainty, search and bookmark filters combine without losing their meaning', () => {
  const filtered = filterEntries(editions, { category: 'robotics', query: 'robot learning', status: 'estimated', savedOnly: true, saved: ['corl', 'rss'] }, now);
  assert.deepEqual(filtered.map(entry => entry.series), ['corl']);
  assert.deepEqual(filterEntries(editions, { query: '  CvPr  ', status: 'official' }, now).map(entry => entry.series), ['cvpr']);
  assert.equal(filterEntries(editions, { savedOnly: true, saved: [] }, now).length, 0);
  assert.equal(filterEntries(editions, { query: 'not-a-conference' }, now).length, 0);
});

test('sorting by earliest prerequisite prioritizes RSS before its invited final paper', () => {
  const official = editions.filter(entry => !entry.estimated);
  assert.deepEqual(filterEntries(official, { sort: 'deadline' }, now).map(entry => entry.series), ['cvpr', 'rss', 'siggraph', 'iros']);
  assert.deepEqual(filterEntries(official, { sort: 'paper' }, now).map(entry => entry.series), ['cvpr', 'siggraph', 'iros', 'rss']);
});

test('closed conferences default to newest paper deadline first, with optional oldest and name sorting', () => {
  const closed = records.filter(entry => ['corl', 'chi', 'eccv'].includes(entry.series));
  assert.deepEqual(filterEntries(closed, { archived: true }, now).map(entry => entry.series), ['chi', 'corl', 'eccv']);
  assert.deepEqual(filterEntries(closed, { archived: true, sort: 'oldest' }, now).map(entry => entry.series), ['eccv', 'corl', 'chi']);
  assert.deepEqual(filterEntries(closed, { archived: true, sort: 'name' }, now).map(entry => entry.series), ['chi', 'corl', 'eccv']);
});
