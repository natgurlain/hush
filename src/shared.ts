// Small DOM helpers for the popup.

/** Element factory: h("div", { className: "x" }, "text", child). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  for (const child of children) if (child) node.append(child);
  return node;
}

export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
}

/** <img> with a site's favicon from the browser cache (needs the "favicon" permission). */
export function favicon(host: string, size = 16): HTMLImageElement {
  const img = h("img", { className: "favicon", alt: "", width: size, height: size });
  img.src = chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(`https://${host}`)}&size=${size * 2}`);
  return img;
}

/** An accessible on/off switch. */
export function switchControl(checked: boolean, label: string, onChange: (checked: boolean) => void, small = false): HTMLButtonElement {
  const button = h("button", { className: small ? "switch sm" : "switch", type: "button" });
  button.setAttribute("role", "switch");
  button.setAttribute("aria-checked", String(checked));
  button.setAttribute("aria-label", label);
  button.addEventListener("click", () => onChange(button.getAttribute("aria-checked") !== "true"));
  return button;
}
