import type { Editor } from 'tinymce';

// "Farben" dialog for the TinyMCE editor
// (RichHtmlInput.tsx) - opened from the floating element toolbar, the
// toolbar's palette button or the right-click menu (editorElementClipboard.ts).
// Works on whatever element is picked: heading, text block, card, section,
// button/link, image, table / row / cell. Sets text, background and border
// colour (with a palette). Everything goes through editor.dom so TinyMCE's own
// data-mce-* mirrors stay in sync and the change is saved.

const toHex = (value: string): string => {
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(value || '');
  if (!m) return value || '';
  return `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
};

const bgUrlOf = (el: HTMLElement): string => {
  const m = /url\((['"]?)(.*?)\1\)/.exec(el.style.backgroundImage || '');
  return m ? m[2] : '';
};

const TAG_NAMES: Record<string, string> = {
  H1: 'Überschrift 1', H2: 'Überschrift 2', H3: 'Überschrift 3', H4: 'Überschrift 4', H5: 'Überschrift 5', H6: 'Überschrift 6',
  P: 'Absatz', A: 'Link / Button', IMG: 'Bild', TABLE: 'Tabelle', TR: 'Tabellenzeile', TD: 'Tabellenzelle', TH: 'Kopfzelle',
  THEAD: 'Tabellenkopf', TBODY: 'Tabellenkörper', UL: 'Liste', OL: 'Nummerierte Liste', LI: 'Listenpunkt', SECTION: 'Bereich',
  DIV: 'Box', SPAN: 'Text', BLOCKQUOTE: 'Zitat', FIGURE: 'Abbildung', BUTTON: 'Button', HR: 'Trennlinie', IFRAME: 'Einbettung',
};

const BLOCK_CHILD = 'div,section,article,p,h1,h2,h3,h4,h5,h6,img,ul,ol,table,figure';
const short = (text: string, max = 30) => {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
};

// A plain-language name for the toolbar/dialogs - what the element is for an
// editor (Button, Bild, Text, Überschrift...), not its HTML tag or classes.
export const describeElement = (el: Element): string => {
  if (el.nodeName === 'A') {
    return el.querySelector(BLOCK_CHILD) ? 'Verlinkter Block' : `Button/Link „${short(el.textContent || '')}“`;
  }
  if (el.hasAttribute('data-hb-video') || el.querySelector?.(':scope > iframe[src*="youtube"]')) return 'YouTube-Video';
  if ((el as HTMLElement).style?.backgroundImage) return 'Hintergrundbild';
  if (el.nodeName === 'DIV' || el.nodeName === 'SECTION' || el.nodeName === 'ARTICLE') {
    return el.querySelector(BLOCK_CHILD) ? 'Bereich' : `Text „${short(el.textContent || '', 24)}“`;
  }
  return TAG_NAMES[el.nodeName] || el.nodeName.toLowerCase();
};

// The link an element is (or sits in), e.g. a button, a linked card or a
// linked image.
export const linkOf = (el: Element): HTMLAnchorElement | null =>
  (el.nodeName === 'A' ? el : el.closest('a')) as HTMLAnchorElement | null;

type Scope = 'self' | 'table' | 'row' | 'cells' | 'header';

const scopeTargets = (el: HTMLElement, scope: Scope): HTMLElement[] => {
  const table = el.closest('table') as HTMLTableElement | null;
  if (!table || scope === 'self') return [el];
  if (scope === 'table') return [table];
  if (scope === 'row') {
    const row = el.closest('tr');
    return row ? [row as HTMLElement] : [el];
  }
  if (scope === 'cells') return Array.from(table.querySelectorAll<HTMLElement>('td,th'));
  // Header: real <th> cells, else the first row.
  const ths = Array.from(table.querySelectorAll<HTMLElement>('th'));
  if (ths.length) return ths;
  const first = table.rows[0];
  return first ? Array.from(first.cells) as HTMLElement[] : [el];
};

interface DialogData {
  textColor: string;
  bgColor: string;
  borderColor: string;
  childrenToo: boolean;
  scope: Scope;
}

// A simple colours-only dialog (text, background, border). Links,
// visibility, images etc. have their own buttons in the element toolbar.
export const openElementPropsDialog = (editor: Editor, el: HTMLElement, onDone: () => void) => {
  const dom = editor.dom;
  const isImg = el.nodeName === 'IMG';
  const inTable = !!el.closest('table');

  const initial: DialogData = {
    textColor: toHex(el.style.color),
    bgColor: toHex(el.style.backgroundColor),
    borderColor: toHex(el.style.borderColor),
    childrenToo: false,
    scope: 'self',
  };

  const items: any[] = [
    { type: 'colorinput', name: 'textColor', label: 'Textfarbe' },
    { type: 'colorinput', name: 'bgColor', label: 'Hintergrundfarbe' },
    { type: 'colorinput', name: 'borderColor', label: 'Rahmenfarbe' },
  ];
  if (!isImg) items.push({ type: 'checkbox', name: 'childrenToo', label: 'Textfarbe auch für alle Texte darin' });
  if (inTable) {
    items.push({
      type: 'selectbox',
      name: 'scope',
      label: 'Anwenden auf',
      items: [
        { value: 'self', text: `Ausgewähltes Element (${describeElement(el)})` },
        { value: 'table', text: 'Ganze Tabelle' },
        { value: 'row', text: 'Aktuelle Zeile' },
        { value: 'cells', text: 'Alle Zellen' },
        { value: 'header', text: 'Kopfzeile' },
      ],
    });
  }

  const setColor = (target: HTMLElement, prop: string, value: string) => {
    if (prop === 'border-color' && value) {
      const current = target.ownerDocument.defaultView?.getComputedStyle(target).borderStyle;
      if (!current || current === 'none') {
        dom.setStyles(target, { border: `1px solid ${value}` });
        return;
      }
    }
    dom.setStyle(target, prop, value || '');
  };

  const apply = (data: DialogData) => {
    editor.undoManager.transact(() => {
      const targets = scopeTargets(el, data.scope);
      const self = data.scope === 'self';
      // For the element itself only touch what changed (an emptied field
      // removes that colour); for a wider scope apply every value given.
      const colors: Array<[keyof DialogData, string]> = [['textColor', 'color'], ['bgColor', 'background-color'], ['borderColor', 'border-color']];
      colors.forEach(([key, prop]) => {
        const value = (data[key] as string).trim();
        if (self ? value === initial[key] : !value) return;
        targets.forEach((t) => setColor(t, prop, value));
      });
      if (data.childrenToo && data.textColor.trim()) {
        targets.forEach((t) => t.querySelectorAll<HTMLElement>('*').forEach((child) => {
          if (child.nodeName !== 'IMG' && child.nodeName !== 'BR') dom.setStyle(child, 'color', data.textColor.trim());
        }));
      }
    });
    editor.nodeChanged();
    onDone();
  };

  editor.windowManager.open({
    title: `Farben: ${describeElement(el)}`,
    size: 'normal',
    body: { type: 'panel', items },
    initialData: initial as any,
    buttons: [
      { type: 'custom', name: 'clearColors', text: 'Farben entfernen' },
      { type: 'cancel', text: 'Abbrechen' },
      { type: 'submit', text: 'Übernehmen', primary: true },
    ],
    onAction: (api: any, details: { name: string }) => {
      if (details.name === 'clearColors') api.setData({ textColor: '', bgColor: '', borderColor: '' } as any);
    },
    onSubmit: (api: any) => {
      apply(api.getData() as unknown as DialogData);
      api.close();
    },
  } as any);
};
