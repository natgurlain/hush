// Toolbar popup: a rail of supported sites (opens on the site you're on), that site's switches, a live count of
// what's hidden on the current tab, a master switch and a 15-minute pause. Site data comes from sites.js.
import { byId, favicon, h, switchControl } from "./shared.js";

const PAUSE_MINUTES = 15;

let settings: HushSettings;
let selected: HushSite;
let here: { site?: HushSite; tabId?: number } = {};
/** Result of asking the current tab's content script; null = no answer (tab opened before Hush was installed). */
let hiddenHere: number | null = null;

function rememberedSite(): HushSite | undefined {
  try {
    return HUSH_SITES.find((s) => s.id === localStorage.getItem("site"));
  } catch {
    return undefined;
  }
}

async function load(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let host = "";
  try {
    host = new URL(tab?.url ?? "").hostname;
  } catch {
    // New tab, settings page and similar have no usable URL.
  }
  here = { site: hushSiteFor(host), tabId: tab?.id };
  settings = hushMerge((await chrome.storage.local.get("settings")).settings as Partial<HushSettings> | undefined);
  selected = here.site ?? rememberedSite() ?? HUSH_SITES[0]!;
  render();
  await refreshCount();
}

async function save(next: HushSettings): Promise<void> {
  settings = next;
  render();
  await chrome.storage.local.set({ settings });
  setTimeout(() => void refreshCount(), 300);
}

async function refreshCount(): Promise<void> {
  if (!here.site || here.tabId === undefined) return;
  try {
    const reply = (await chrome.tabs.sendMessage(here.tabId, { type: "hush-count" })) as { hidden: number } | undefined;
    hiddenHere = reply?.hidden ?? null;
  } catch {
    hiddenHere = null;
  }
  render();
}

function paused(): boolean {
  return settings.pausedUntil > Date.now();
}

function render(): void {
  // Master switch and banner.
  const on = settings.enabled;
  byId("global-label").textContent = on ? "On" : "Off";
  byId("global-switch").replaceChildren(switchControl(on, "Hush on or off", (checked) => void save({ ...settings, enabled: checked })));
  const banner = byId("banner");
  banner.hidden = on && !paused();
  banner.className = on ? "banner" : "banner off";
  if (!on) {
    banner.replaceChildren(h("span", {}, "Hush is off. Nothing is hidden."));
  } else if (paused()) {
    const left = Math.max(0, Math.ceil((settings.pausedUntil - Date.now()) / 1000));
    const resume = h("button", { className: "btn sm", type: "button", textContent: "Resume now" });
    resume.addEventListener("click", () => void save({ ...settings, pausedUntil: 0 }));
    banner.replaceChildren(h("span", {}, "Paused · ", h("b", { className: "num", textContent: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` }), " left"), resume);
  }
  byId<HTMLButtonElement>("pause").hidden = !on || paused();

  // Site rail.
  byId("rail").replaceChildren(
    ...HUSH_SITES.map((site) => {
      const tile = h("button", { className: `tile${settings.sites[site.id]?.on ? "" : " site-off"}`, type: "button", title: site.name });
      tile.setAttribute("aria-pressed", String(site === selected));
      tile.append(favicon(site.hosts[0]!, 22), site.name);
      if (site === here.site) tile.append(h("i", { className: "here", title: "You're on this site" }));
      tile.addEventListener("click", () => {
        selected = site;
        try {
          localStorage.setItem("site", site.id);
        } catch {
          // Remembering the last site is a convenience only.
        }
        render();
      });
      return tile;
    }),
  );

  // Selected site panel.
  const state = settings.sites[selected.id]!;
  const isHere = selected === here.site;
  let meta: (Node | string)[];
  if (isHere && hiddenHere !== null && state.on && on && !paused()) {
    meta = [h("span", { className: "count", textContent: `${hiddenHere} ${hiddenHere === 1 ? "thing" : "things"} hidden on this page` })];
  } else {
    meta = [isHere ? "You're on this site" : state.on ? `${enabledCount(selected)} of ${selected.features.length} hidden` : "Showing everything"];
  }
  const head = h(
    "div",
    { className: "panel-head" },
    favicon(selected.hosts[0]!, 28),
    h("div", { className: "panel-title" }, h("b", { textContent: selected.name }), h("span", {}, ...meta)),
    switchControl(state.on, `Hush on ${selected.name}`, (checked) => void save(withSite(selected, { ...state, on: checked }))),
  );

  const rows = h("ul", { className: `rows${state.on && on && !paused() ? "" : " dim"}` });
  for (const feature of selected.features) rows.append(featureRow(feature, state));

  const children: Node[] = [head];
  if (isHere && hiddenHere === null && state.on && on && !paused()) {
    const reload = h("button", { className: "btn sm", type: "button", textContent: "Reload" });
    reload.addEventListener("click", () => {
      if (here.tabId !== undefined) void chrome.tabs.reload(here.tabId);
      window.close();
    });
    children.push(h("div", { className: "reload" }, h("span", { textContent: "Reload this tab to start hiding." }), reload));
  }
  children.push(rows);
  byId("panel").replaceChildren(...children);
}

function featureRow(feature: HushFeature, state: HushSettings["sites"][string]): HTMLLIElement {
  const text = h("div", { className: "row-text" }, h("b", { textContent: feature.label }), h("span", { textContent: feature.hint, title: feature.hint }));
  if (feature.kind === "toggle") {
    const value = state.values[feature.id] === true;
    const control = switchControl(value, feature.label, (checked) => void save(withSite(selected, { ...state, values: { ...state.values, [feature.id]: checked } })), true);
    return h("li", { className: "row" }, text, control);
  }
  const group = h("div", { className: "segmented sm" });
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", feature.label);
  for (const option of feature.options) {
    const button = h("button", { type: "button", textContent: option.label });
    button.setAttribute("aria-pressed", String(state.values[feature.id] === option.value));
    button.addEventListener("click", () => void save(withSite(selected, { ...state, values: { ...state.values, [feature.id]: option.value } })));
    group.append(button);
  }
  return h("li", { className: "row choice" }, text, group);
}

function enabledCount(site: HushSite): number {
  const values = settings.sites[site.id]!.values;
  return site.features.filter((f) => (f.kind === "toggle" ? values[f.id] === true : values[f.id] !== f.options[0]!.value)).length;
}

function withSite(site: HushSite, state: HushSettings["sites"][string]): HushSettings {
  return { ...settings, sites: { ...settings.sites, [site.id]: state } };
}

byId("pause").addEventListener("click", () => void save({ ...settings, pausedUntil: Date.now() + PAUSE_MINUTES * 60_000 }));
setInterval(() => paused() && render(), 1000);
void load();
