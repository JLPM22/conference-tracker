# Conference tracker

A personal submission tracker for graphics, vision, robotics, VR/HCI and AI/ML conferences. It uses Next.js, React and Tailwind CSS, with a static export for GitHub Pages.

The dashboard combines official submission schedules with clearly labelled estimates for the next cycle. It includes paper and prerequisite deadlines, live countdowns, submission timelines, category and text filters, a saved shortlist, and calendar downloads.

The interface uses a white background, near-black text and outlines, and consistent research-area colors. Each row prioritizes the next required submission step. Expand it for the full schedule, official sources, event details; less-used sorting and certainty controls are under Filters.

## Run locally

Install Node.js 22 or newer, then run:

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:3000`. To check the production export:

```sh
npm test
npm run validate:data
npm run build
npm run preview
```

The build writes the website to `out/`. The dependency-free preview server serves that directory at `http://127.0.0.1:4173`, bound to loopback. Stop either server with Ctrl+C. `npm run build` also validates the conference data before compiling.

To reproduce a GitHub project URL such as `https://USERNAME.github.io/conferences/`, set the same base path for both build and preview. In PowerShell:

```powershell
$env:NEXT_PUBLIC_BASE_PATH = '/conferences'
npm run build
npm run preview
```

Then open `http://127.0.0.1:4173/conferences/`. To return to a root deployment, remove the variable and rebuild:

```powershell
Remove-Item Env:NEXT_PUBLIC_BASE_PATH -ErrorAction SilentlyContinue
npm run build
```

With the production preview running, `npm run test:browser` checks search, filters, persistence, downloads, timezone conversion, keyboard focus and layouts from 320 to 1440 pixels. It uses an isolated headless Chrome session; set `CHROME_PATH` for another Chrome installation and `PREVIEW_URL` for another preview address. The default address is `http://127.0.0.1:4173/conferences/`. Browser screenshots are written to `design-review/`, alongside the saved before views.

## Publish on GitHub Pages

The local implementation does not create a GitHub repository, push commits, change Pages settings, or publish a site. The included workflow is ready for those steps:

1. Create a GitHub repository and push this project, including `package-lock.json`, to its `main` branch. If using another branch, update `.github/workflows/deploy.yml`.
2. In the repository, open **Settings → Pages → Build and deployment** and select **GitHub Actions** as the source.
3. Open **Actions → Deploy conference tracker → Run workflow**, or push another commit to `main`.
4. The deployment job exposes the published URL once it succeeds.

The workflow installs dependencies with `npm ci`, runs the tests and data validation, exports the site, and publishes only `out/`. It passes `steps.pages.outputs.base_path` from `actions/configure-pages` to `NEXT_PUBLIC_BASE_PATH`, so the build uses the correct path for a project repository, a user site, or a configured custom domain. After changing the domain or repository path, run the workflow again: Next.js embeds the base path at build time. Configure any custom domain and DNS through GitHub Pages settings.

The implementation follows the official [Next.js static export guide](https://nextjs.org/docs/app/guides/static-exports), [Next.js basePath reference](https://nextjs.org/docs/app/api-reference/config/next-config-js/basePath), and [GitHub Pages custom workflow guide](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Conference data and updates

The JSON arrays in `data/` contain manually checked official conference schedules. The files group venues by research area; each record describes a particular edition and submission track. All displayed source links point back to the conference's official call or schedule. `checkedAt` records the date that a person verified that record, not the time of the latest build or page view.

The catalog includes CEIG, WACV, HRI and SGP. WACV and SGP use their final submission round; earlier rounds and alternative tracks are described in the catalog notes. HRI is grouped under VR/HCI. SGP is grouped under Graphics, with its Computer Graphics Forum publication route.

The header shows the static export's build timestamp as “Last updated,” in Europe/Berlin time. It changes when the site is rebuilt, not when a visitor refreshes. Per-conference source-check dates remain separate.

Estimated schedules show an “Update needed” reminder starting 60 calendar days before the first required submission step. The reminder remains until that paper deadline closes or official dates replace the estimate. It does not depend on whether the location or event dates are known. Set `required: false` on a recommended abstract milestone so it stays visible without controlling the countdown or reminder.

Each record has `core` metadata (rank, edition, source and verification date) and a `publication` policy (route, journal names, source edition, explanation and verification date). ICORE2026 is preferred. Older CORE entries are explicitly dated; a missing entry is distinct from the portal's Unranked classification. Publication policies distinguish direct journal tracks, selected journal papers, invited extensions, review transfers and presentation of already accepted journal articles. Policies remain tied to their verified edition when submission dates are estimated.

Each conference record contains:

| Field | Meaning |
| --- | --- |
| `id`, `series`, `name`, `fullName`, `year` | Unique edition identifier, stable venue/track key, display names, and conference edition year. |
| `category`, `topics` | One of `graphics`, `vision`, `robotics`, `hci`, `ai`, plus searchable research topics. |
| `cycleYears` | Years between editions, normally `1`; use `2` for a biennial venue. |
| `website`, `editionSource`, `checkedAt` | Official website, official schedule URL, and verification date (`YYYY-MM-DD`). |
| `event` | Official conference `start`, `end`, and `location`; unknown values are `null`. An optional `source` gives the announcement URL. |
| `milestones` | Submission and review dates, each with `kind`, `label`, `date`, `timezone`, and its official `source`. A `paper` milestone is required. |
| `announcedEvents` | Optional future event announcements keyed by edition year, independent of submission estimates. |
| `notes` | Track scope, prerequisite requirements, extensions, and source caveats. |
| `paperFit` | Brief `scope` and `emphasis` based on recent published papers (`basis: "published-papers"`), with the proceedings `source`, sampled publication year `basisYear`, `sampleSize`, and independent `checkedAt`. Its `guide` describes observed `contribution` and evaluation (`evidence`) patterns, plus `comparisons` (`series` and `difference`) with venues in the same area. Peer names and proceedings links resolve from the catalog. Keep the publication year unchanged when projecting deadlines. |

Milestone kinds are `abstract`, `paper`, `supplementary`, `notification`, `camera-ready`, `rebuttal`, and `registration`. Preserve the official deadline's timezone: use an ISO timestamp with an explicit offset only when the time is published, for example `2027-03-01T23:59:59-12:00` for an explicitly stated AoE deadline. When only the date is known, use `2027-03-01`; never infer AoE or invent a time. Use `Not specified` when the source gives no timezone. Abstract submission and paper-registration prerequisites should be included so that the paper deadline does not hide an earlier gate.

To refresh Paper fit, read recent accepted papers and their evaluation sections across several relevant topics. Write general findings without naming individual papers in the interface; link the proceedings collection. Update the source year, sample count, and check date. Local research notes and paper URLs belong in the ignored `qa/` folder.

To update a venue:

1. Read its official paper call and important-dates page. Check the track, abstract prerequisite, timezone, revisions, extensions, notification and final-version dates.
2. Update the record for the latest confirmed edition, including its `id`, `year`, milestone sources and `checkedAt`. Keep the stable `series` key so saved preferences continue to work.
3. Add known future conference dates or locations under `announcedEvents` if the new submission schedule is still unpublished.
4. Run `npm run validate:data`, `npm test`, and `npm run build`; then commit and push the update.

Do not replace a confirmed date with a guess in the JSON. Once the latest confirmed paper deadline has passed, the application advances by `cycleYears` until the projected paper date is upcoming. It preserves the prior month and day, handles February 29 by using February 28 in a non-leap year, and shifts the other milestones by the same number of years. All projected milestones become date-only estimates, with their source edition retained for comparison. This is a planning heuristic; dates can move substantially between editions.

Conference dates and locations are kept separate from submission estimates. The application uses a matching official `announcedEvents` entry when available; otherwise the new event remains unannounced. It does not copy a previous host city or invent conference dates.

The site does not scrape conference pages, automatically verify changes, or automatically promote an estimate to an official deadline. The display advances automatically using the browser clock, refreshed every 30 seconds and when the tab visibility changes; confirming a new schedule requires a data edit. The global freshness notice uses the oldest record's `checkedAt` conservatively, and each expanded venue shows its own check date.

## Browser data and calendar behavior

Countdowns use the browser's current clock. Published timestamps can be viewed in their source timezone, local time or UTC. Date-only values and estimates show approximate calendar-day countdowns, without claiming an exact submission cutoff.

Saved conferences stay in `localStorage` in the current browser and origin. They are not uploaded or synchronized between devices. Clearing site data removes them; switching between a localhost preview, a GitHub domain and a custom domain uses separate storage.

Downloaded `.ics` files are snapshots, not subscribed calendar feeds. Later website changes do not update imported events. Estimated events are labelled and marked tentative; date-only milestones become all-day events. Recheck the official call before submitting and replace old calendar entries when dates change.

## Fonts and attribution

The local Inter and Outfit font files come from the existing portfolio, keeping typography consistent without loading fonts from a third-party service. Their SIL Open Font License notices are retained in [`app/fonts/Inter-LICENSE.txt`](app/fonts/Inter-LICENSE.txt) and [`app/fonts/Outfit-LICENSE.txt`](app/fonts/Outfit-LICENSE.txt). Keep those notices when redistributing the fonts.
