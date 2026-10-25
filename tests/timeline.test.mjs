import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarParts, monthPosition } from '../components/timeline.mjs';

test('unequal-length months still begin at their exact equal-width timeline boundaries', () => {
  const start = '2026-10-01';
  assert.equal(monthPosition('2027-03-01T00:00:00+00:00', start), 5 / 12 * 100);
  assert.equal(monthPosition('2027-05-01T00:00:00+00:00', start), 7 / 12 * 100);
  assert.ok(monthPosition('2027-02-28T23:59:59+00:00', start) < 5 / 12 * 100);
  assert.equal(monthPosition('2027-10-01T00:00:00+00:00', start), 100);
});

test('AoE month-end deadlines move into the next column when displayed in UTC', () => {
  const deadline = '2027-01-31T23:59:00-12:00';
  const start = '2027-01-01';
  assert.ok(monthPosition(deadline, start, 'source') < 100 / 12);
  assert.ok(monthPosition(deadline, start, 'utc') > 100 / 12);
  assert.deepEqual(calendarParts(deadline, 'utc'), { year: 2027, month: 1, day: 1, hour: 11, minute: 59, second: 0 });
});

test('unknown times stay on the stated calendar date in every display timezone', () => {
  const date = '2028-02-29';
  const source = monthPosition(date, '2028-01-01', 'source');
  assert.equal(monthPosition(date, '2028-01-01', 'utc'), source);
  assert.equal(monthPosition(date, '2028-01-01', 'local'), source);
  assert.ok(source > 100 / 12 && source < 200 / 12);
});

test('local timeline coordinates use the same local calendar fields as displayed dates', () => {
  const instant = '2027-01-31T23:59:00-12:00';
  const local = new Date(instant);
  assert.deepEqual(calendarParts(instant, 'local'), {
    year: local.getFullYear(), month: local.getMonth(), day: local.getDate(),
    hour: local.getHours(), minute: local.getMinutes(), second: local.getSeconds(),
  });
});
