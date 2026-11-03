// Runs at document_start on supported sites (after sites.js). Injects one <style> built from the user's settings,
// keeps <html data-hush-page> current across in-app navigation, applies redirects, and answers the popup's
// "how many things are hidden here?" question. A plain script: content scripts can't be ES modules.
{
  const site = hushSiteFor(location.hostname);
  if (site) {
    const style = document.createElement("style");
    style.id = "hush-style";
    let settings = hushDefaults();
    let lastHref = "";
    let resumeTimer = 0;

    const apply = () => {
      style.textContent = hushCss(site, settings);
      // Keep the element last in <html> so it wins over page styles added later.
      if (style.parentNode !== document.documentElement || style.nextSibling) document.documentElement.append(style);
      clearTimeout(resumeTimer);
      if (settings.pausedUntil > Date.now()) resumeTimer = setTimeout(apply, settings.pausedUntil - Date.now() + 50);
    };

    const active = () => style.textContent !== "";

    /** Page kind, redirects and DOM tweaks; runs on load and whenever the URL changes. */
    const tick = () => {
      const url = new URL(location.href);
      if (location.href !== lastHref) {
        lastHref = location.href;
        document.documentElement.dataset.hushPage = site.page(url);
        if (active()) {
          for (const feature of site.features) {
            if (feature.kind !== "toggle" || !feature.redirect || settings.sites[site.id]?.values[feature.id] !== true) continue;
            const target = feature.redirect(url);
            if (target && target !== url.pathname + url.search) {
              location.replace(target);
              return;
            }
          }
        }
      }
      if (!active()) return;
      for (const feature of site.features) {
        if (feature.kind === "toggle" && feature.run && settings.sites[site.id]?.values[feature.id] === true) feature.run();
      }
    };

    document.documentElement.dataset.hushPage = site.page(new URL(location.href));
    // Hide with the defaults immediately so feeds don't flash while stored settings load.
    apply();

    chrome.storage.local.get("settings").then(({ settings: stored }) => {
      settings = hushMerge(stored as Partial<HushSettings> | undefined);
      apply();
      tick();
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes.settings) return;
      settings = hushMerge(changes.settings.newValue as Partial<HushSettings> | undefined);
      apply();
      lastHref = ""; // re-run redirects with the new settings
      tick();
    });

    // Single-page apps change the URL without reloading; a cheap poll catches every kind of navigation.
    setInterval(tick, 400);
    // Pages sometimes re-append their own styles at the end of <html>; keep ours last.
    document.addEventListener("DOMContentLoaded", apply);

    chrome.runtime.onMessage.addListener((message: { type?: string }, _sender, sendResponse) => {
      if (message.type !== "hush-count") return false;
      let hidden = 0;
      if (active()) {
        for (const selector of hushHiddenSelectors(site, settings)) {
          try {
            hidden += document.querySelectorAll(selector).length;
          } catch {
            // A selector this browser can't parse simply counts as nothing.
          }
        }
      }
      sendResponse({ site: site.id, hidden });
      return false;
    });
  }
}
