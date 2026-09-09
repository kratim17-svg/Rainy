# Rainy

A personal anxiety-tracking app. Mobile-first Progressive Web App.

## Running it

Open a terminal and run:

```bash
cd ~/rainy
npm run dev
```

Then open <http://localhost:5173> in your browser. Leave the terminal open
while you work — it rebuilds as files change. Press `Ctrl+C` to stop it.

To see it on your phone (same wifi network):

```bash
npm run dev -- --host
```

The terminal prints a `Network:` address to open on the phone. Note that
"Add to home screen" and notifications need HTTPS, so those only work fully
on `localhost` or once the app is deployed.

Other commands:

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Check for code mistakes |

## Layout

```
src/
  data/               the data layer — all reading and writing
    index.js          what screens import
    schema.js         the four models and their fields  <- edit fields here
    collection.js     generic create/list/get/update/remove
    adapter.js        picks the active storage backend
    adapter.local.js  the localStorage implementation
  lib/
    theme.js          dark mode
  sw.js               service worker — offline cache and Web Push
  index.css           design tokens (colours, radii, type)
  App.jsx             TEMPORARY setup-check screen
```

## Using the data layer

```js
import { checkIns, brainDumps, notificationSettings } from './data'

const checkIn = await checkIns.create({ timeSlot: 'morning', score: 7 })

// a brain dump that followed the check-in
await brainDumps.create({ checkInId: checkIn.id, text: 'Too much at once' })

// or one started on its own
await brainDumps.create({ text: 'A thought on its own' })   // checkInId null

await notificationSettings.setSlot('morning', { time: '07:15' })
```

Every method returns a Promise, so use `await`. That is deliberate: when the
app moves to Supabase, only `adapter.js` changes — no screen code does.

**Collections** — `checkIns`, `brainDumps`, `breathingSessions`, `journalEntries`

| Method | |
| --- | --- |
| `create(fields)` | Add a record. Throws `ValidationError` on bad input. |
| `list(options)` | `{ where, sort, limit, offset }`. Newest first by default. |
| `get(id)` · `latest()` · `count(where)` | |
| `between(start, end)` | Records timestamped in a range. |
| `update(id, patch)` | Only the fields given are changed. |
| `remove(id)` · `clear()` | |
| `subscribe(fn)` | Fires on change, including from another tab. |

`where` takes equality matches, and an array means "any of":

```js
await checkIns.list({ where: { timeSlot: ['morning', 'night'] } })
await brainDumps.list({ where: { checkInId: null } })   // standalone only
```

**Settings** — `notificationSettings`

`get()` · `update(patch)` · `setSlot(slot, patch)` · `reset()` ·
`activeSlots()` · `subscribe(fn)`

**Helpers**

`relatedTo(checkInId)` · `standalone()` · `journalFor(date)` ·
`addJournalItem(text, date)` · `bandForScore(score)` · `toDateKey(date)` ·
`exportAll()` · `importAll()` · `clearAll()`

## The models

Defined in `src/data/schema.js` — the one file to edit when fields change.
Stored under `rainy:v1:<KEY>` in localStorage.

| Key | Shape |
| --- | --- |
| `CHECK_INS` | `id`, `timestamp`, `timeSlot`, `score` 0–10 |
| `BRAIN_DUMPS` | `id`, `checkInId` (nullable), `timestamp`, `text`, `wordFrequencies` |
| `BREATHING_SESSIONS` | `id`, `checkInId` (nullable), `timestamp`, `mode` `box`/`478`, `cyclesCompleted` |
| `JOURNAL_ENTRIES` | `id`, `date` (YYYY-MM-DD), `items[]`, `createdAt`, `updatedAt` |
| `NOTIFICATION_SETTINGS` | One object: four slots, each `{ enabled, time, default }` |

`checkInId` is `null` when a brain dump or breathing session was started on
its own rather than from a check-in.

Judgement calls worth knowing about, each changeable in one place:

- **Score bands.** `bandForScore` splits 0–10 as 0–3 low, 4–6 medium, 7–10 high.
- **Reminders start enabled.** They cannot fire until the browser grants
  notification permission, so this is a preference, not an intrusion.
- **Journal entries sort by `date`**, not by when they were written.
- **One entry per day** is assumed by `journalFor` and `addJournalItem` but is
  not enforced by the store itself.

## Design language

A soft-focus meadow seen through frosted glass. Floral imagery sits far back,
a scrim calms it, and content floats above on translucent sheets. Few controls,
each one large and obvious.

Everything is defined once in `src/index.css` and used as Tailwind classes.
Never hard-code a hex value in a component — the tokens flip in dark mode.

**Colour**

- Grounds: `bg-canvas` `bg-surface` `bg-sunken`
- Ink: `text-ink` `text-ink-soft` `text-ink-faint`
- Hairlines: `border-line`
- The three bands, each with a range:
  `text-low` `text-low-deep` `text-low-light` `bg-low-wash` — and the same
  for `med` and `high`

**Shape and depth**

- `rounded-card` 16px · `rounded-sheet` 28px · `rounded-pill` 99px
- `shadow-soft` `shadow-lift` — wide and faint, never a hard edge

**Components** (plain CSS classes, not Tailwind utilities)

| Class | What it is |
| --- | --- |
| `bloom-field` | The backdrop. Render once near the top of the app. |
| `sheet` | Translucent glass panel — the default container. |
| `sheet-solid` | Same, more opaque, for text-dense panels. |
| `orb` + `orb-low`/`orb-med`/`orb-high` | The gradient centrepiece. |
| `orb-soft` | Fully diffuse variant, no edge at all. |
| `control` | Circular icon button. |
| `control-primary` | The single main action on a screen. |
| `chip` | Pill for tags and choices. |
| `label` | Small letterspaced mono caps, for field labels. |
| `meter` | Hairline gradient progress bar. |

**Type**

System sans throughout, with a system mono stack reserved for `label` only.

## Where this differs from the original brief

Adapted from the visual references:

- The ground is a warmer cream (`#F7F5F0`) rather than `#F8F7F4`.
- Surfaces are translucent over floral imagery, not flat white.
- A mono face was added for small labels — the brief said system sans only.
- Each accent gained a deep and a light stop so it can be used as a gradient.
  The specified `#4A9B6F` / `#D4873A` / `#C4565A` remain the mid-tones.

The backdrops in `public/bloom-*.jpg` are generated, not stock photography, so
there is nothing to license and the app stays fully self-contained offline.
