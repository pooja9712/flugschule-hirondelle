// Joomla-style publishing for single blocks inside a whole-page body.
// On the old Joomla site every homepage button was its own module that the
// team switched on/off per season (Status) or scheduled ("Veröffentlichung
// starten/beenden"). In the one-window page editor the same is done per
// element (editorElementProps.ts > "Sichtbarkeit"); the public page drops
// hidden or out-of-schedule elements (SafeHtml.tsx).
//   data-hb-hidden="1"            never shown publicly
//   data-hb-from="YYYY-MM-DD"     shown from that day on
//   data-hb-until="YYYY-MM-DD"    shown up to and including that day

export const HIDDEN_ATTR = 'data-hb-hidden';
export const FROM_ATTR = 'data-hb-from';
export const UNTIL_ATTR = 'data-hb-until';

export const isValidDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Whether an element is live right now (ISO day strings compare correctly as text).
export const isBlockLive = (el: Element, day = today()): boolean => {
  if (el.hasAttribute(HIDDEN_ATTR)) return false;
  const from = el.getAttribute(FROM_ATTR);
  const until = el.getAttribute(UNTIL_ATTR);
  if (from && isValidDay(from) && day < from) return false;
  if (until && isValidDay(until) && day > until) return false;
  return true;
};

// Removes every block that isn't live from a parsed HTML container.
export const removeUnpublishedBlocks = (root: Element) => {
  root.querySelectorAll(`[${HIDDEN_ATTR}],[${FROM_ATTR}],[${UNTIL_ATTR}]`).forEach((el) => {
    if (!isBlockLive(el)) el.remove();
  });
};
