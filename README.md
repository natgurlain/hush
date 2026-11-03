# Hush

A small, dependency-free browser extension for **Brave** (and any Chromium browser) that hides the parts of
websites built to keep you scrolling: feeds, Shorts, trends, suggestions and more. The site stays useful; the slot
machine goes away.

| Site | What you can hide |
|---|---|
| **YouTube** | Home recommendations (or open Subscriptions instead), Shorts (Shorts links open as normal videos), sidebar suggestions, end screens, comments, Explore menu; thumbnails shown, blurred or hidden |
| **X** | Trends, who to follow, promoted posts, like/repost/view counts, the whole home timeline; switch "For you" to "Following" |
| **Reddit** | Home, Popular and All feeds, right sidebar, trending searches, Popular/Explore links, promoted posts, comments |
| **Facebook** | News Feed, Stories, Reels and Video, Marketplace, right column |
| **Instagram** | Home feed, Explore, Reels |
| **LinkedIn** | Feed, News and games, ads, notification counts |

- **No flicker.** Hiding is plain CSS added before the page draws, and every switch applies instantly to open tabs
  without a reload.
- **One popup.** It opens on the site you're on, shows how many things are hidden on the page, and has a
  15-minute pause and a master switch.
- **Private.** Settings stay in the browser's local storage. No accounts, servers or analytics.

## Build

You need [Node.js](https://nodejs.org) 18 or newer. TypeScript and the Chrome API type definitions are the only
packages, used at build time; the extension itself is plain JavaScript with no runtime dependencies.

```bash
npm install
```

```bash
npm run build
```

The ready-to-load extension is written to `dist/`.

## Install in Brave

1. Open `brave://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose the `dist` folder.
4. Pin Hush: click the puzzle-piece icon in the toolbar, then the pin next to Hush.
5. Open YouTube (or another supported site) and click the moon icon to choose what to hide.

The same steps work in Chrome (`chrome://extensions`), Edge and other Chromium browsers. Tabs that were already open
before installing need one reload; the popup offers a **Reload** button for that. After rebuilding, click the reload
arrow on Hush's card in the extensions page.

## How it works

| File | Role |
|---|---|
| `src/sites.ts` | Every supported site: how to tell its pages apart, and the CSS selectors, redirects and small tweaks behind each switch. |
| `src/content.ts` | Runs on supported sites at page start. Adds one `<style>` built from your settings, keeps track of in-app navigation, applies redirects, and answers the popup's "how much is hidden here?" |
| `src/popup.ts` | The toolbar popup. |
| `src/background.ts` | Keeps the toolbar icon in sync: green on, amber paused, gray off. |
| `scripts/make-icons.mjs` | Regenerates the toolbar icons (`node scripts/make-icons.mjs`). |

### When something stops being hidden

Sites change their markup often. Each switch's selectors live in one place in `src/sites.ts`, and every selector is
its own CSS rule, so one outdated selector never breaks the others. To fix one, inspect the element in DevTools, update
the selector, rebuild and reload. Pull requests with updated selectors are welcome.

Selectors were checked on YouTube's live search page. The others follow each site's markup as of November 2026 but
haven't been checked against a signed-in account yet.

## Author

Made by [@natgurlain](https://x.com/natgurlain). MIT licensed.
