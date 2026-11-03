// Service worker: keeps the toolbar icon in sync with Hush's state (green on, amber paused, gray off) and flips it
// back when a pause ends. A plain script so it can load the shared site data with importScripts.
declare function importScripts(...urls: string[]): void;
importScripts("sites.js");

const RESUME_ALARM = "resume";

async function syncIcon(): Promise<void> {
  const { settings: stored } = await chrome.storage.local.get("settings");
  const settings = hushMerge(stored as Partial<HushSettings> | undefined);
  const now = Date.now();
  const state = !settings.enabled ? "off" : settings.pausedUntil > now ? "paused" : "on";
  await chrome.action.setIcon({ path: Object.fromEntries([16, 32, 48].map((size) => [size, `icons/${state}-${size}.png`])) });
  await chrome.action.setTitle({
    title: state === "on" ? "Hush is on" : state === "paused" ? `Hush is paused until ${new Date(settings.pausedUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Hush is off",
  });
  if (state === "paused") await chrome.alarms.create(RESUME_ALARM, { when: settings.pausedUntil + 500 });
}

chrome.runtime.onInstalled.addListener(() => void syncIcon());
chrome.runtime.onStartup.addListener(() => void syncIcon());
chrome.alarms.onAlarm.addListener((alarm) => alarm.name === RESUME_ALARM && void syncIcon());
chrome.storage.onChanged.addListener((changes, area) => area === "local" && changes.settings && void syncIcon());
