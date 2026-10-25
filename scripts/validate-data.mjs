import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { categories } from '../lib/conferences.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const requiredFiles = ['graphics.json', 'vision-robotics.json', 'vr-hci.json', 'ai.json'];
const kinds = new Set(['abstract', 'paper', 'supplementary', 'notification', 'camera-ready', 'rebuttal', 'registration']);
const datePattern = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(Z|[+-]\d{2}:\d{2}))?$/;
const identifierPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;

// Date.parse silently normalizes dates such as February 30, so verify each
// calendar component before accepting a source's date or timestamp.
export function validDate(value, dateOnly = false) {
  if (typeof value !== 'string') return false;
  const match = datePattern.exec(value);
  if (!match || (dateOnly && match[4])) return false;
  const [, yyyy, mm, dd, hh, minutes, seconds, offset] = match;
  const year = Number(yyyy), month = Number(mm), day = Number(dd);
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1) return false;
  if (day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return false;
  if (hh && (Number(hh) > 23 || Number(minutes) > 59 || Number(seconds) > 59)) return false;
  if (offset && offset !== 'Z') {
    const [hours, mins] = offset.slice(1).split(':').map(Number);
    if (hours > 14 || mins > 59 || (hours === 14 && mins !== 0)) return false;
  }
  return Number.isFinite(Date.parse(value));
}

function httpsURL(value) {
  if (typeof value !== 'string' || /\s/.test(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && Boolean(parsed.hostname) && !parsed.username && !parsed.password;
  } catch { return false; }
}

export function validateEntries(entries, file = 'data', seenIds = new Set(), seenSeries = new Set()) {
  const errors = [];
  const check = (condition, field, message) => { if (!condition) errors.push(`${file}: ${field} ${message}`); };
  if (!Array.isArray(entries)) return [`${file}: expected a JSON array`];
  check(entries.length > 0, 'dataset', 'must contain at least one conference');
  for (const [index, entry] of entries.entries()) {
    const at = `[${index}]${entry?.id ? ` (${entry.id})` : ''}`;
    if (!isObject(entry)) { check(false, at, 'must be an object'); continue; }
    for (const field of ['id', 'series', 'name', 'fullName', 'notes']) {
      check(nonempty(entry[field]), `${at}.${field}`, 'must be a nonempty string');
    }
    for (const field of ['id', 'series']) check(identifierPattern.test(entry[field] || ''), `${at}.${field}`, 'must use lowercase letters, numbers, and hyphens');
    check(!seenIds.has(entry.id), `${at}.id`, 'is duplicated');
    check(!seenSeries.has(entry.series), `${at}.series`, 'is duplicated; keep one source edition per series');
    seenIds.add(entry.id); seenSeries.add(entry.series);
    check(Number.isInteger(entry.year) && entry.year >= 1900 && entry.year <= 2200, `${at}.year`, 'must be an integer from 1900 to 2200');
    check(entry.id === `${entry.series}-${entry.year}`, `${at}.id`, 'must match series-year');
    check(Object.hasOwn(categories, entry.category), `${at}.category`, `must be one of ${Object.keys(categories).join(', ')}`);
    check(Number.isInteger(entry.cycleYears) && entry.cycleYears >= 1 && entry.cycleYears <= 10, `${at}.cycleYears`, 'must be an integer from 1 to 10');
    check(Array.isArray(entry.topics) && entry.topics.length > 0 && entry.topics.every(nonempty), `${at}.topics`, 'must be a nonempty array of strings');
    for (const field of ['website', 'editionSource']) check(httpsURL(entry[field]), `${at}.${field}`, 'must be an absolute HTTPS URL');
    check(validDate(entry.checkedAt, true), `${at}.checkedAt`, 'must be a real YYYY-MM-DD date');
    if (entry.core !== undefined) {
      check(isObject(entry.core) && (entry.core.rank === null || nonempty(entry.core.rank)), `${at}.core`, 'must contain a rank or explicit null for no matching entry');
      check(nonempty(entry.core?.edition) && httpsURL(entry.core?.source) && validDate(entry.core?.checkedAt, true), `${at}.core`, 'must record the ranking edition, HTTPS source and check date');
    }
    if (entry.publication !== undefined) {
      const policy = entry.publication;
      check(isObject(policy) && ['journal-track', 'selected-journal', 'journal-extension', 'journal-transfer', 'journal-presentation', 'proceedings', 'unconfirmed'].includes(policy.kind), `${at}.publication`, 'must use a recognized publication route');
      check(Array.isArray(policy?.journals) && policy.journals.every(nonempty), `${at}.publication.journals`, 'must be an array of journal names');
      check(nonempty(policy?.note) && httpsURL(policy?.source) && Number.isInteger(policy?.basisYear) && validDate(policy?.checkedAt, true), `${at}.publication`, 'must record context, source, policy edition and check date');
    }
    if (entry.paperFit !== undefined) {
      const fit = entry.paperFit;
      check(isObject(fit) && nonempty(fit.scope) && nonempty(fit.emphasis), `${at}.paperFit`, 'must describe typical contributions and evaluation emphasis');
      check(httpsURL(fit?.source) && validDate(fit?.checkedAt, true), `${at}.paperFit`, 'must record a proceedings HTTPS source and check date');
      check(fit?.basis === 'published-papers' && Number.isInteger(fit?.sampleSize) && fit.sampleSize >= 2, `${at}.paperFit`, 'must be based on a sample of at least two published papers');
      check(Number.isInteger(fit?.basisYear) && fit.basisYear >= 1900 && fit.basisYear <= 2200, `${at}.paperFit.basisYear`, 'must identify the sampled publication year');
      if (fit?.guide !== undefined) {
        const guide = fit.guide;
        check(isObject(guide) && nonempty(guide.contribution) && nonempty(guide.evidence), `${at}.paperFit.guide`, 'must describe the contribution and supporting evidence');
        check(Array.isArray(guide?.comparisons) && guide.comparisons.length > 0 && guide.comparisons.every(comparison => isObject(comparison) && nonempty(comparison.series) && nonempty(comparison.difference) && comparison.series !== entry.series), `${at}.paperFit.guide.comparisons`, 'must contain named comparisons with other venues');
      }
    }

    const validateEvent = (event, field, year, sourceRequired = false) => {
      if (!isObject(event)) { check(false, field, 'must be an event object'); return; }
      for (const date of ['start', 'end']) {
        check(event[date] === null || validDate(event[date], true), `${field}.${date}`, 'must be a real YYYY-MM-DD date or null');
      }
      if (validDate(event.start, true) && validDate(event.end, true)) check(event.start <= event.end, field, 'must end on or after its start date');
      if (validDate(event.start, true)) check(Number(event.start.slice(0, 4)) === year, `${field}.start`, 'must fall in the edition year');
      check(event.location === null || nonempty(event.location), `${field}.location`, 'must be a location string or null');
      if (sourceRequired || event.source !== undefined) check(httpsURL(event.source), `${field}.source`, 'must be an absolute HTTPS URL');
    };
    validateEvent(entry.event, `${at}.event`, entry.year);
    if (entry.announcedEvents !== undefined) {
      check(isObject(entry.announcedEvents), `${at}.announcedEvents`, 'must be an object keyed by future edition year');
      if (isObject(entry.announcedEvents)) for (const [year, event] of Object.entries(entry.announcedEvents)) {
        check(/^\d{4}$/.test(year) && Number(year) > entry.year && Number(year) <= 2200, `${at}.announcedEvents.${year}`, 'must describe a future edition year');
        validateEvent(event, `${at}.announcedEvents.${year}`, Number(year), true);
      }
    }
    if (!Array.isArray(entry.milestones)) { check(false, `${at}.milestones`, 'must be an array'); continue; }
    check(entry.milestones.filter(m => m?.kind === 'paper').length === 1, `${at}.milestones`, 'must contain exactly one paper deadline');
    for (const [number, milestone] of entry.milestones.entries()) {
      const field = `${at}.milestones[${number}]`;
      if (!isObject(milestone)) { check(false, field, 'must be an object'); continue; }
      check(kinds.has(milestone.kind), `${field}.kind`, 'is not a supported milestone kind');
      check(nonempty(milestone.label), `${field}.label`, 'must be a nonempty string');
      check(validDate(milestone.date), `${field}.date`, 'must be a real date, with seconds and an explicit UTC offset when timed');
      check(nonempty(milestone.timezone), `${field}.timezone`, 'must name the source timezone or state Not specified');
      if (typeof milestone.date === 'string' && milestone.date.includes('T')) {
        check(!['Not specified', 'Estimated date'].includes(milestone.timezone), `${field}.timezone`, 'cannot claim an exact time without a confirmed source timezone');
        if (milestone.timezone === 'AoE') check(milestone.date.endsWith('-12:00'), `${field}.date`, 'must use UTC-12:00 for AoE');
      }
      check(httpsURL(milestone.source), `${field}.source`, 'must be an absolute HTTPS URL');
    }
  }
  return errors;
}

export async function validateData(directory = resolve(root, 'data')) {
  const errors = [], seenIds = new Set(), seenSeries = new Set();
  let files;
  try { files = (await readdir(directory)).filter(name => name.endsWith('.json')).sort(); }
  catch (error) { return { errors: [`Cannot read ${directory}: ${error.message}`], count: 0, files: [] }; }
  for (const name of requiredFiles) if (!files.includes(name)) errors.push(`Missing required dataset: ${name}`);
  let count = 0;
  const catalog = [];
  for (const file of files) {
    try {
      const entries = JSON.parse(await readFile(resolve(directory, file), 'utf8'));
      errors.push(...validateEntries(entries, file, seenIds, seenSeries));
      if (Array.isArray(entries)) { count += entries.length; catalog.push(...entries.filter(isObject)); }
    } catch (error) { errors.push(`${file}: ${error.message}`); }
  }
  const bySeries = new Map(catalog.map(entry => [entry.series, entry]));
  for (const entry of catalog) {
    const comparisons = entry.paperFit?.guide?.comparisons;
    if (!Array.isArray(comparisons)) continue;
    const compared = new Set();
    for (const comparison of comparisons) {
      const peer = bySeries.get(comparison?.series);
      if (!peer?.paperFit || peer.category !== entry.category) errors.push(`${entry.id}: comparison ${comparison?.series} must reference a venue with publication findings in the same research area`);
      if (compared.has(comparison?.series)) errors.push(`${entry.id}: comparison ${comparison?.series} is duplicated`);
      compared.add(comparison?.series);
    }
  }
  return { errors, count, files };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await validateData();
  if (result.errors.length) {
    console.error(`Conference data validation failed:\n${result.errors.map(error => `- ${error}`).join('\n')}`);
    process.exitCode = 1;
  } else console.log(`Validated ${result.count} conferences across ${result.files.length} datasets.`);
}
