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
import { checkIns, journalEntries } from './data'

await checkIns.create({ level: 4, triggers: ['work'], note: 'Tight chest' })

const recent = await checkIns.list({ limit: 7 })
const one = await checkIns.get(id)
await checkIns.update(id, { note: 'Eased off after a walk' })
await checkIns.remove(id)
```

Every method returns a Promise, so use `await`. That is deliberate: when the
app moves to Supabase, only `adapter.js` changes — no screen code does.

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
