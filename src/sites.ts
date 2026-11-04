// What Hush can hide on each site. This file is a plain (global) script so the content script can load it
// next to content.js; the popup and background read the same data from globalThis.HUSH_SITES.
//
// Sites change their markup often. When something stops hiding, fix the selector here: each selector is
// emitted as its own CSS rule, so one broken selector never disables the others.

interface HushToggle {
  kind: "toggle";
  id: string;
  label: string;
  hint: string;
  default: boolean;
  /** Elements to hide (display: none). Use :root[data-hush-page="…"] to limit a selector to one page. */
  hide?: string[];
  /** Extra raw CSS while enabled. */
  css?: string;
  /** Where to send the browser instead of `url`, or null to stay. Checked on load and on in-app navigation. */
  redirect?: (url: URL) => string | null;
  /** Idempotent DOM tweak run on every navigation tick while enabled. */
  run?: () => void;
}

interface HushChoice {
  kind: "choice";
  id: string;
  label: string;
  hint: string;
  default: string;
  options: { value: string; label: string; css?: string }[];
}

type HushFeature = HushToggle | HushChoice;

interface HushSite {
  id: string;
  name: string;
  /** Registrable domains; subdomains match too. */
  hosts: string[];
  /** Page kind for the current URL, exposed as <html data-hush-page="…">. */
  page: (url: URL) => string;
  features: HushFeature[];
}

/** The message shown where a feed used to be. */
function hushPlaceholder(selector: string, text: string): string {
  return `${selector}::before { content: "${text}"; display: block; margin: 72px auto; max-width: 420px; padding: 18px 22px;
    border-radius: 16px; text-align: center; font: 500 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #6f6e69; background: rgba(127, 127, 127, 0.08); border: 1px solid rgba(127, 127, 127, 0.16); }`;
}

const HUSH_SITES: HushSite[] = [
  {
    id: "youtube",
    name: "YouTube",
    hosts: ["youtube.com"],
    page: (url) =>
      url.pathname === "/" ? "home"
      : url.pathname === "/watch" ? "watch"
      : url.pathname.startsWith("/shorts/") ? "shorts"
      : url.pathname === "/results" ? "search"
      : url.pathname.startsWith("/feed/subscriptions") ? "subscriptions"
      : "other",
    features: [
      {
        kind: "toggle",
        id: "home",
        label: "Home recommendations",
        hint: "The endless grid on the home page",
        default: true,
        hide: [':root[data-hush-page="home"] ytd-browse[page-subtype="home"] #primary'],
        css: hushPlaceholder(':root[data-hush-page="home"] ytd-browse[page-subtype="home"]', "Recommendations hidden by Hush. Search for what you came for."),
      },
      {
        kind: "toggle",
        id: "subscriptions",
        label: "Open Subscriptions instead",
        hint: "Home goes straight to channels you follow",
        default: false,
        redirect: (url) => (url.pathname === "/" ? "/feed/subscriptions" : null),
      },
      {
        kind: "toggle",
        id: "shorts",
        label: "Shorts",
        hint: "Shelves and menu; links open as normal videos",
        default: true,
        hide: [
          "ytd-reel-shelf-renderer",
          "ytd-rich-shelf-renderer[is-shorts]",
          "ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts])",
          "grid-shelf-view-model:has(a[href^='/shorts/'])",
          "ytd-video-renderer:has(a[href^='/shorts/'])",
          "ytm-shorts-lockup-view-model-v2",
          "ytd-guide-entry-renderer:has(a[title='Shorts'])",
          "ytd-mini-guide-entry-renderer:has(a[title='Shorts'])",
          // Filter chips carry no attribute naming them, so run() tags the "Shorts" chip.
          "[data-hush-tag~='shorts']",
        ],
        run: () => {
          for (const chip of document.querySelectorAll<HTMLElement>("yt-chip-cloud-chip-renderer:not([data-hush-tag])")) {
            if (chip.textContent?.trim() === "Shorts") chip.dataset.hushTag = "shorts";
          }
        },
        redirect: (url) => {
          const id = url.pathname.match(/^\/shorts\/([\w-]+)/)?.[1];
          return id ? `/watch?v=${id}` : null;
        },
      },
      {
        kind: "toggle",
        id: "related",
        label: "Sidebar suggestions",
        hint: "Up next, beside the player",
        default: true,
        hide: ["ytd-watch-flexy #secondary #related", "ytd-watch-next-secondary-results-renderer"],
      },
      {
        kind: "toggle",
        id: "endscreen",
        label: "End-screen suggestions",
        hint: "The video wall when a video ends",
        default: true,
        hide: [".ytp-endscreen-content", ".ytp-ce-element", ".videowall-endscreen", ".ytp-autonav-endscreen-countdown-overlay"],
      },
      {
        kind: "toggle",
        id: "comments",
        label: "Comments",
        hint: "Everything below the video",
        default: false,
        hide: ["ytd-comments#comments"],
      },
      {
        kind: "toggle",
        id: "explore",
        label: "Explore menu",
        hint: "Trending, Gaming and more in the menu",
        default: false,
        hide: ["ytd-guide-section-renderer:has(a[href^='/feed/trending'])", "ytd-guide-section-renderer:has(a[href^='/gaming'])"],
      },
      {
        kind: "choice",
        id: "thumbnails",
        label: "Thumbnails",
        hint: "Less clickbait pull",
        default: "show",
        options: [
          { value: "show", label: "Show" },
          {
            value: "blur",
            label: "Blur",
            css: "ytd-thumbnail img, yt-thumbnail-view-model img, ytd-playlist-thumbnail img, .ytp-videowall-still-image { filter: blur(14px) saturate(0.6) !important; }",
          },
          {
            value: "hide",
            label: "Hide",
            css: "ytd-thumbnail img, yt-thumbnail-view-model img, ytd-playlist-thumbnail img, .ytp-videowall-still-image { visibility: hidden !important; }",
          },
        ],
      },
    ],
  },
  {
    id: "x",
    name: "X",
    hosts: ["x.com", "twitter.com"],
    page: (url) =>
      url.pathname === "/home" ? "home"
      : url.pathname.startsWith("/explore") ? "explore"
      : url.pathname.startsWith("/search") ? "search"
      : "other",
    features: [
      {
        kind: "toggle",
        id: "trends",
        label: "Trends",
        hint: "Sidebar and Explore page",
        default: true,
        hide: [
          "[data-testid='sidebarColumn'] section:has([data-testid='trend'])",
          "[data-testid='sidebarColumn'] div:has(> div > [aria-label^='Timeline: Trending'])",
          ":root[data-hush-page='explore'] [data-testid='primaryColumn'] [aria-label^='Timeline: Explore']",
        ],
      },
      {
        kind: "toggle",
        id: "follow",
        label: "Who to follow",
        hint: "Account suggestions everywhere",
        default: true,
        hide: [
          "[data-testid='sidebarColumn'] aside[aria-label='Who to follow']",
          "[data-testid='sidebarColumn'] aside[aria-label='Relevant people']",
          ":root[data-hush-page='home'] [data-testid='cellInnerDiv']:has([data-testid='UserCell'])",
        ],
      },
      {
        kind: "toggle",
        id: "promoted",
        label: "Promoted posts",
        hint: "Ads in the timeline",
        default: true,
        hide: ["[data-testid='cellInnerDiv']:has([data-testid='placementTracking'])"],
      },
      {
        kind: "toggle",
        id: "following",
        label: "Following, not For you",
        hint: "Home shows people you follow",
        default: false,
        run: () => {
          if (location.pathname !== "/home") return;
          const tabs = [...document.querySelectorAll<HTMLElement>("[data-testid='primaryColumn'] [role='tab']")];
          const following = tabs.find((t) => t.textContent?.trim() === "Following");
          if (following && following.getAttribute("aria-selected") !== "true" && tabs[0]?.getAttribute("aria-selected") === "true") following.click();
        },
      },
      {
        kind: "toggle",
        id: "metrics",
        label: "Likes, reposts and views",
        hint: "Read posts, not numbers",
        default: false,
        hide: [
          "[data-testid='like'] span",
          "[data-testid='unlike'] span",
          "[data-testid='retweet'] span",
          "[data-testid='unretweet'] span",
          "[data-testid='reply'] span",
          "a[href$='/analytics']",
        ],
      },
      {
        kind: "toggle",
        id: "timeline",
        label: "The whole home timeline",
        hint: "Post and search without the feed",
        default: false,
        hide: [":root[data-hush-page='home'] [data-testid='primaryColumn'] [aria-label^='Timeline: Your Home Timeline']"],
      },
    ],
  },
  {
    id: "reddit",
    name: "Reddit",
    hosts: ["reddit.com"],
    page: (url) =>
      /^\/(best|hot|new|top|rising)?\/?$/.test(url.pathname) ? "home"
      : url.pathname.startsWith("/r/popular") ? "popular"
      : url.pathname.startsWith("/r/all") ? "all"
      : /^\/r\/[^/]+\/comments\//.test(url.pathname) ? "post"
      : "other",
    features: [
      {
        kind: "toggle",
        id: "feeds",
        label: "Home, Popular and All feeds",
        hint: "Subreddits you open still work",
        default: true,
        hide: [
          ":root[data-hush-page='home'] shreddit-feed",
          ":root[data-hush-page='popular'] shreddit-feed",
          ":root[data-hush-page='all'] shreddit-feed",
        ],
        css: hushPlaceholder(":root[data-hush-page='home'] main", "Feed hidden by Hush. Open a subreddit you came for."),
      },
      {
        kind: "toggle",
        id: "sidebar",
        label: "Right sidebar",
        hint: "Popular communities, recent posts",
        default: true,
        hide: ["#right-sidebar-container", "[slot='right-sidebar']"],
      },
      {
        kind: "toggle",
        id: "trending",
        label: "Trending searches",
        hint: "Suggestions under the search box",
        default: true,
        hide: ["#reddit-trending-searches-partition-container", "faceplate-tracker[noun='trending_search']"],
      },
      {
        kind: "toggle",
        id: "nav",
        label: "Popular and Explore links",
        hint: "Shortcuts in the left menu",
        default: true,
        hide: ["faceplate-tracker:has(> a[href^='/r/popular'])", "faceplate-tracker:has(> a[href^='/explore'])", "a[href^='/r/popular']"],
      },
      {
        kind: "toggle",
        id: "ads",
        label: "Promoted posts",
        hint: "Ads in feeds and threads",
        default: true,
        hide: ["shreddit-ad-post", "shreddit-comments-page-ad"],
      },
      {
        kind: "toggle",
        id: "comments",
        label: "Comments",
        hint: "Read the post, skip the thread",
        default: false,
        hide: ["shreddit-comment-tree", "comment-body-header"],
      },
    ],
  },
  {
    id: "facebook",
    name: "Facebook",
    hosts: ["facebook.com"],
    page: (url) =>
      url.pathname === "/" || url.pathname === "/home.php" ? "home"
      : url.pathname.startsWith("/reel") || url.pathname.startsWith("/watch") ? "video"
      : url.pathname.startsWith("/marketplace") ? "marketplace"
      : "other",
    features: [
      {
        kind: "toggle",
        id: "feed",
        label: "News Feed",
        hint: "The home page; groups and profiles still work",
        default: true,
        // Facebook no longer always marks the feed with role="feed", so the whole middle column of the home page goes,
        // with the older feed markers kept in case [role='main'] changes.
        hide: [
          ":root[data-hush-page='home'] [role='main']",
          ":root[data-hush-page='home'] [role='feed']",
          ":root[data-hush-page='home'] [data-pagelet='MainFeed']",
          ":root[data-hush-page='home'] [data-pagelet^='FeedUnit']",
        ],
      },
      {
        kind: "toggle",
        id: "stories",
        label: "Stories",
        hint: "The tray at the top of the feed",
        default: true,
        hide: ["[aria-label='Stories']", "[aria-label='stories tray']", "div[data-pagelet='Stories']"],
      },
      {
        kind: "toggle",
        id: "video",
        label: "Reels and Video",
        hint: "Menu entries and the video pages",
        default: true,
        hide: ["div[data-pagelet*='Reels']", "a[href*='/reel/']", "a[href$='/watch/']", ":root[data-hush-page='video'] [role='main']"],
      },
      {
        kind: "toggle",
        id: "marketplace",
        label: "Marketplace",
        hint: "Menu entries and the Marketplace page",
        default: false,
        hide: ["a[href*='/marketplace/']", ":root[data-hush-page='marketplace'] [role='main']"],
      },
      {
        kind: "toggle",
        id: "rail",
        label: "Right column",
        hint: "Contacts, sponsored and birthdays",
        default: false,
        hide: [":root[data-hush-page='home'] [role='complementary']"],
      },
    ],
  },
  {
    id: "instagram",
    name: "Instagram",
    hosts: ["instagram.com"],
    page: (url) =>
      url.pathname === "/" ? "home"
      : url.pathname.startsWith("/explore") ? "explore"
      : url.pathname.startsWith("/reels") || url.pathname.startsWith("/reel/") ? "reels"
      : "other",
    features: [
      {
        kind: "toggle",
        id: "feed",
        label: "Home feed",
        hint: "Messages and profiles still work",
        default: true,
        hide: [":root[data-hush-page='home'] main article"],
      },
      {
        kind: "toggle",
        id: "explore",
        label: "Explore",
        hint: "Menu entry and the Explore grid",
        default: true,
        hide: ["a[href='/explore/']", ":root[data-hush-page='explore'] main"],
      },
      {
        kind: "toggle",
        id: "reels",
        label: "Reels",
        hint: "Menu entry and the Reels feed",
        default: true,
        hide: ["a[href='/reels/']", ":root[data-hush-page='reels'] main"],
      },
    ],
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    hosts: ["linkedin.com"],
    page: (url) => (url.pathname.startsWith("/feed") ? "home" : "other"),
    features: [
      {
        kind: "toggle",
        id: "feed",
        label: "Feed",
        hint: "Messages, jobs and profiles still work",
        default: true,
        hide: [":root[data-hush-page='home'] main .scaffold-finite-scroll", ":root[data-hush-page='home'] main [data-finite-scroll-hotkey-context='FEED']"],
      },
      {
        kind: "toggle",
        id: "news",
        label: "News and games",
        hint: "LinkedIn News and puzzles",
        default: true,
        hide: ["#feed-news-module", "aside section:has(#feed-news-module)", "aside [data-view-name='news-module']"],
      },
      {
        kind: "toggle",
        id: "ads",
        label: "Ads",
        hint: "Banner ads in the side columns",
        default: true,
        hide: [".ad-banner-container"],
      },
      {
        kind: "toggle",
        id: "badges",
        label: "Notification counts",
        hint: "The red numbers that pull you back in",
        default: false,
        hide: [".notification-badge", ".global-nav__nav .notification-badge--show"],
      },
    ],
  },
];

/** Stored settings: a master switch, a pause, and per-site on/off plus feature values. */
interface HushSettings {
  enabled: boolean;
  /** Epoch ms; 0 = not paused. */
  pausedUntil: number;
  sites: Record<string, { on: boolean; values: Record<string, boolean | string> }>;
}

function hushDefaults(): HushSettings {
  const sites: HushSettings["sites"] = {};
  for (const site of HUSH_SITES) {
    sites[site.id] = { on: true, values: Object.fromEntries(site.features.map((f) => [f.id, f.default])) };
  }
  return { enabled: true, pausedUntil: 0, sites };
}

/** Stored settings merged over defaults, so features added later get their default value. */
function hushMerge(stored: Partial<HushSettings> | undefined): HushSettings {
  const base = hushDefaults();
  if (!stored) return base;
  for (const site of HUSH_SITES) {
    const saved = stored.sites?.[site.id];
    if (saved) base.sites[site.id] = { on: saved.on ?? true, values: { ...base.sites[site.id]!.values, ...saved.values } };
  }
  return { ...base, enabled: stored.enabled ?? true, pausedUntil: stored.pausedUntil ?? 0 };
}

function hushSiteFor(hostname: string): HushSite | undefined {
  const host = hostname.replace(/^www\./, "");
  return HUSH_SITES.find((s) => s.hosts.some((h) => host === h || host.endsWith(`.${h}`)));
}

/** The CSS for one site under the given settings; empty when Hush is off, paused or the site is off. */
function hushCss(site: HushSite, settings: HushSettings, now = Date.now()): string {
  const state = settings.sites[site.id];
  if (!settings.enabled || settings.pausedUntil > now || !state?.on) return "";
  const rules: string[] = [];
  for (const feature of site.features) {
    const value = state.values[feature.id];
    if (feature.kind === "toggle" && value === true) {
      for (const selector of feature.hide ?? []) rules.push(`${selector} { display: none !important; }`);
      if (feature.css) rules.push(feature.css);
    } else if (feature.kind === "choice") {
      const option = feature.options.find((o) => o.value === value);
      if (option?.css) rules.push(option.css);
    }
  }
  return rules.join("\n");
}

/** Selectors currently hidden for a site (for the "N hidden on this page" counter). */
function hushHiddenSelectors(site: HushSite, settings: HushSettings): string[] {
  const state = settings.sites[site.id];
  if (!state) return [];
  return site.features.flatMap((f) => (f.kind === "toggle" && state.values[f.id] === true ? f.hide ?? [] : []));
}

(globalThis as { HUSH_SITES?: HushSite[] }).HUSH_SITES = HUSH_SITES;
