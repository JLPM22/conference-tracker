import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect as playwrightExpect } from '@playwright/test';
import { planningEdition } from '../lib/conferences.mjs';

const expect = playwrightExpect.configure({ timeout: 10_000 });

// Run against the built GitHub Pages preview, in a fresh browser context.
// PREVIEW_URL and CHROME_PATH can point to another preview or Chrome install.
const previewUrl = process.env.PREVIEW_URL || 'http://127.0.0.1:4173/conferences/';
const artifactDirectory = fileURLToPath(new URL('../design-review/', import.meta.url));
const records = (await Promise.all(['graphics', 'vision-robotics', 'vr-hci', 'ai'].map(async name =>
  JSON.parse(await readFile(new URL(`../data/${name}.json`, import.meta.url), 'utf8'))
))).flat();
const totalConferences = records.length;
const categoryCount = category => records.filter(entry => entry.category === category).length;
const officialCount = records.filter(entry => !planningEdition(entry, Date.now()).estimated).length;
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 1,
  timezoneId: 'Europe/Berlin',
  reducedMotion: 'reduce',
  acceptDownloads: true,
});
const page = await context.newPage();
page.setDefaultTimeout(10_000);
const errors = [];
page.on('pageerror', error => errors.push(`Page: ${error.message}`));
page.on('console', message => {
  if (message.type() === 'error') errors.push(`Console: ${message.text()}`);
});
const cards = page.locator('article.conference-card');
const search = () => page.getByLabel('Search conferences', { exact: true });
const button = name => page.getByRole('button', { name, exact: true });
const log = message => console.log(`PASS ${message}`);
const screenshot = async name => {
  await page.evaluate(() => document.activeElement?.blur());
  await page.mouse.move(0, 0);
  await page.screenshot({
    path: `${artifactDirectory}/${name}.png`,
    fullPage: false,
    animations: 'disabled',
    caret: 'hide',
  });
};
async function filtersOpen() {
  const certainty = page.getByRole('combobox', { name: 'Date certainty', exact: true });
  if (!await certainty.isVisible()) await page.getByRole('button', { name: /^Filters(?:\s+\d+)?$/ }).click();
  await expect(certainty).toBeVisible();
}
async function filtersClosed() {
  const certainty = page.getByRole('combobox', { name: 'Date certainty', exact: true });
  if (await certainty.isVisible()) await page.getByRole('button', { name: /^Filters(?:\s+\d+)?$/ }).click();
}
async function assertNoPageOverflow(width) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }));
  assert.ok(dimensions.document <= dimensions.viewport,
    `At ${width}px, document width ${dimensions.document}px exceeds viewport ${dimensions.viewport}px`);
}

try {
  await mkdir(artifactDirectory, { recursive: true });
  const response = await page.goto(previewUrl, { waitUntil: 'networkidle' });
  assert.ok(response?.ok(), `Preview failed to load: ${response?.status()} ${previewUrl}`);
  await expect(cards).toHaveCount(totalConferences);
  log(`${totalConferences} conferences load in the GitHub Pages preview`);
  const updatedAt = await page.locator('.site-updated time').getAttribute('datetime');
  assert.ok(Number.isFinite(Date.parse(updatedAt)), 'Last updated must contain a build timestamp');
  await expect(page.locator('.site-updated')).toContainText('Last updated');
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('.site-updated time').getAttribute('datetime'), updatedAt);
  await search().fill('SGP');
  await expect(cards).toHaveCount(1);
  await button('Show SGP details').click();
  await expect(cards.first()).toContainText('Computer Graphics Forum');
  await expect(cards.first()).toContainText('ICORE2026: B');
  await expect(cards.first()).toContainText('Singapore');
  await expect(cards.first()).toContainText('Paper · final round');
  await expect(cards.first()).toContainText('15 Apr 2027');
  await page.evaluate(() => window.scrollTo(0, 0));
  await screenshot('sgp-and-last-updated');
  await search().fill('');
  await button('Hide SGP details').click();
  log('SGP details and persistent build timestamp are correct');

  await search().fill('CVPR');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('CVPR');
  await expect(button('Show CVPR details')).toHaveAccessibleDescription(/Official deadline.*Paper enrollment.*10 Nov 2026.*remaining/);
  await search().fill('a conference that does not exist');
  await expect(cards).toHaveCount(0);
  await button('Clear filters').click();
  await expect(search()).toHaveValue('');
  await expect(cards).toHaveCount(totalConferences);
  log('Search and empty-state reset work');

  await button('Graphics').click();
  await expect(button('Graphics')).toHaveAttribute('aria-pressed', 'true');
  await expect(cards).toHaveCount(categoryCount('graphics'));
  await expect(page.getByRole('button', { name: 'Show SIGGRAPH details', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show CVPR details', exact: true })).toHaveCount(0);
  await button('All areas').click();
  await expect(cards).toHaveCount(totalConferences);
  for (const name of ['CEIG', 'WACV', 'HRI']) await expect(button(`Show ${name} details`)).toHaveCount(1);
  for (const name of ['GRIVAPP', 'CGI-AI', 'UIST', 'IJCAI', 'AISTATS']) await expect(button(`Show ${name} details`)).toHaveCount(0);
  log('Research areas and requested catalog changes are correct');

  await button('AI / ML').click();
  await expect(cards).toHaveCount(categoryCount('ai'));
  for (const name of ['ICLR', 'NeurIPS', 'AAAI', 'ICML']) {
    await expect(button(`Show ${name} details`)).toHaveCount(1);
  }
  await button('VR / HCI').click();
  await expect(cards).toHaveCount(categoryCount('hci'));
  await expect(button('Show ACM SAP details')).toHaveCount(1);
  await button('All areas').click();
  await search().fill('Applied Perception');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('ACM SAP');
  await search().fill('');
  log('AI venues are available and ACM SAP appears once under VR / HCI');

  await search().fill('CVPR');
  await button('Save CVPR').click();
  await expect(button('Unsave CVPR')).toHaveAttribute('aria-pressed', 'true');
  await button('Show CVPR details').click();
  await expect(page.getByRole('region', { name: 'Ranking and publication' })).toContainText('ICORE2026: A*');
  await search().fill('');
  await button('Saved conferences').click();
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('CVPR');
  await page.reload({ waitUntil: 'networkidle' });
  await expect(cards).toHaveCount(totalConferences);
  await search().fill('CVPR');
  await expect(button('Unsave CVPR')).toHaveAttribute('aria-pressed', 'true');
  await button('Show CVPR details').click();
  log('Bookmarks and shortlist filtering survive a reload');

  // This context is test-owned; cleanup keeps the review images free of QA bookmarks.
  await page.evaluate(() => localStorage.removeItem('conference-planner-v1'));
  await page.reload({ waitUntil: 'networkidle' });
  await expect(cards).toHaveCount(totalConferences);
  await filtersOpen();
  const certainty = page.getByRole('combobox', { name: 'Date certainty', exact: true });
  await certainty.selectOption('official');
  await expect(cards).toHaveCount(officialCount);
  await certainty.selectOption('all');
  await expect(cards).toHaveCount(totalConferences);
  const sorting = page.getByRole('combobox', { name: 'Sort conferences', exact: true });
  await sorting.selectOption('name');
  await expect(cards.first()).toContainText('3DV');
  await sorting.selectOption('deadline');
  const timezone = page.getByRole('combobox', { name: 'Display timezone', exact: true });
  await timezone.selectOption('local');
  await expect(timezone).toHaveValue('local');
  await search().fill('CVPR');
  await expect(cards.first()).toContainText(/CET|CEST|GMT\+1|GMT\+2/);
  await timezone.selectOption('source');
  await search().fill('');
  await filtersClosed();
  log('Date certainty, sorting, and the Berlin timezone conversion work');

  await button('Closed submissions').click();
  await expect(button('Closed submissions')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => cards.count()).toBeGreaterThan(0);
  await expect(cards.first()).toContainText('Closed');
  const closedNames = await cards.evaluateAll(elements => elements.map(element => element.querySelector('.venue-name').textContent.trim()));
  const closedDates = closedNames.map(name => records.find(entry => `${entry.name} ${entry.year}` === name).milestones.find(m => m.kind === 'paper').date);
  const closedTimes = closedDates.map(date => Date.parse(date.length === 10 ? `${date}T12:00:00Z` : date));
  assert.deepEqual(closedTimes, [...closedTimes].sort((a, b) => b - a), 'Closed conferences must default to newest deadline first');
  await filtersOpen();
  await expect(page.getByRole('combobox', { name: 'Sort conferences' })).toHaveValue('deadline');
  await page.getByRole('combobox', { name: 'Sort conferences' }).selectOption('oldest');
  await button('Upcoming submissions').click();
  await expect(page.getByRole('combobox', { name: 'Sort conferences' })).toHaveValue('deadline');
  await filtersClosed();
  await expect(cards).toHaveCount(totalConferences);
  log('Closed and upcoming submission cycles are accessible');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export calendar/i }).click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /\.ics$/i, 'Calendar export must produce an .ics file');
  assert.equal(await download.failure(), null, 'Calendar download should complete');
  log(`Calendar export downloads ${download.suggestedFilename()}`);

  await button('Timeline view').click();
  await expect(page.getByRole('region', { name: 'Scrollable conference timeline', exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await screenshot('after-timeline');
  await page.getByRole('button', { name: /^SIGGRAPH\s+2027(?:\s*[·.]\s*est\.)?$/ }).click();
  const timelineDetails = page.getByRole('region', { name: /SIGGRAPH 2027 submission details/ });
  await expect(timelineDetails).toBeVisible();
  await expect(timelineDetails).toBeFocused();
  await button('Hide SIGGRAPH details').click();
  await expect(page.getByRole('button', { name: /^SIGGRAPH\s+2027(?:\s*[·.]\s*est\.)?$/ })).toBeFocused();
  await button('List view').click();
  await expect(cards).toHaveCount(totalConferences);
  log('Timeline selection focuses details and closing restores focus');

  await search().fill('CVPR');
  await button('Show CVPR details').click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await screenshot('after-details');
  await button('Hide CVPR details').click();
  await search().fill('');
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width === 390 ? 1000 : 1100 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await assertNoPageOverflow(width);
    await expect(search()).toBeVisible();
    await expect(cards.first()).toBeVisible();
    if (width === 1440) await screenshot('after-desktop');
    if (width === 390) await screenshot('after-mobile');
    log(`No horizontal page overflow at ${width}px`);
  }
  assert.deepEqual(errors, [], `Browser errors:\n${errors.join('\n')}`);
  log('No page exceptions or console errors');
  // Exercise the reminder with a future clock, without changing the catalog.
  const reminderPage = await context.newPage();
  try {
    await reminderPage.clock.install({ time: new Date('2027-02-13T12:00:00Z') });
    await reminderPage.goto(previewUrl, { waitUntil: 'networkidle' });
    await reminderPage.getByLabel('Search conferences', { exact: true }).fill('SGP');
    await expect(reminderPage.locator('.update-warning')).toHaveCount(0);
    await reminderPage.clock.setFixedTime(new Date('2027-02-14T12:00:00Z'));
    await reminderPage.clock.runFor(31_000);
    await expect(reminderPage.locator('.update-warning')).toContainText('Update needed.');
    assert.equal(await reminderPage.locator('.site-updated time').getAttribute('datetime'), updatedAt);
    for (const width of [1440, 390, 320]) {
      await reminderPage.setViewportSize({ width, height: 1000 });
      assert.ok(await reminderPage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `Reminder overflows at ${width}px`);
      await expect(reminderPage.locator('.update-warning')).toBeVisible();
      if (width !== 320) await reminderPage.screenshot({ path: `${artifactDirectory}/update-warning-${width}.png`, fullPage: false });
    }
    await reminderPage.getByLabel('Search conferences', { exact: true }).fill('');
    const official = reminderPage.locator('article.conference-card').filter({ has: reminderPage.locator('.status-badge.official') });
    await expect(official.locator('.update-warning')).toHaveCount(0);
    await reminderPage.getByRole('button', { name: 'Closed submissions', exact: true }).click();
    await expect(reminderPage.locator('.update-warning')).toHaveCount(0);
    log('60-day reminder appears automatically, fits mobile, and excludes official and closed schedules');
  } finally {
    await reminderPage.close();
  }
  console.log(`Review screenshots saved to ${artifactDirectory}`);
} finally {
  await context.close();
  await browser.close();
}
