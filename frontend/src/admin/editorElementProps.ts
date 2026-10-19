import type { Editor } from 'tinymce';
import { FROM_ATTR, HIDDEN_ATTR, UNTIL_ATTR, isValidDay } from '../utils/blockVisibility';

// "Element: Farben & Eigenschaften" dialog for the TinyMCE editor
// (RichHtmlInput.tsx) - opened from the floating element toolbar, the
// toolbar's palette button or the right-click menu (editorElementClipboard.ts).
// Works on whatever element is picked: heading, text block, card, section,
// button/link, image, table / row / cell. Sets text, background and border
// colour (with a palette), background image, link target, CSS classes and
// raw inline CSS. Everything goes through editor.dom so TinyMCE's own
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

export const describeElement = (el: Element): string => {
  const name = TAG_NAMES[el.nodeName] || el.nodeName.toLowerCase();
  const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean)[0];
  return cls ? `${name} .${cls}` : name;
};

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
  bgImage: { value: string };
  href: string;
  newTab: boolean;
  src: { value: string };
  alt: string;
  className: string;
  style: string;
  status: 'published' | 'hidden';
  from: string;
  until: string;
}

export const openElementPropsDialog = (editor: Editor, el: HTMLElement, onDone: () => void, { blockVisibility = false } = {}) => {
  const dom = editor.dom;
  const isImg = el.nodeName === 'IMG';
  const link = (el.nodeName === 'A' ? el : el.closest('a')) as HTMLAnchorElement | null;
  const inTable = !!el.closest('table');

  const initial: DialogData = {
    textColor: toHex(el.style.color),
    bgColor: toHex(el.style.backgroundColor),
    borderColor: toHex(el.style.borderColor),
    childrenToo: false,
    scope: 'self',
    bgImage: { value: bgUrlOf(el) },
    href: link?.getAttribute('href') || '',
    newTab: link?.getAttribute('target') === '_blank',
    src: { value: isImg ? el.getAttribute('src') || '' : '' },
    alt: isImg ? el.getAttribute('alt') || '' : '',
    className: el.getAttribute('class') || '',
    style: el.getAttribute('style') || '',
    status: el.hasAttribute(HIDDEN_ATTR) ? 'hidden' : 'published',
    from: el.getAttribute(FROM_ATTR) || '',
    until: el.getAttribute(UNTIL_ATTR) || '',
  };

  const colorItems: any[] = [
    {
      type: 'grid',
      columns: 3,
      items: [
        { type: 'colorinput', name: 'textColor', label: 'Textfarbe' },
        { type: 'colorinput', name: 'bgColor', label: 'Hintergrundfarbe' },
        { type: 'colorinput', name: 'borderColor', label: 'Rahmenfarbe' },
      ],
    },
  ];
  if (!isImg) colorItems.push({ type: 'checkbox', name: 'childrenToo', label: 'Textfarbe auch auf alle enthaltenen Elemente anwenden (Überschriften, Texte, Links)' });
  if (inTable) {
    colorItems.push({
      type: 'selectbox',
      name: 'scope',
      label: 'Farben anwenden auf',
      items: [
        { value: 'self', text: `Ausgewähltes Element (${describeElement(el)})` },
        { value: 'table', text: 'Ganze Tabelle' },
        { value: 'row', text: 'Aktuelle Zeile' },
        { value: 'cells', text: 'Alle Zellen' },
        { value: 'header', text: 'Kopfzeile' },
      ],
    });
  }

  const otherItems: any[] = [];
  if (isImg) {
    otherItems.push(
      { type: 'urlinput', name: 'src', label: 'Bildquelle', filetype: 'image' },
      { type: 'input', name: 'alt', label: 'Alternativtext' },
    );
  } else {
    otherItems.push({ type: 'urlinput', name: 'bgImage', label: 'Hintergrundbild (leer = keins)', filetype: 'image' });
  }
  if (link) {
    otherItems.push(
      { type: 'input', name: 'href', label: el === link ? 'Link-Ziel (URL)' : 'Link-Ziel des umgebenden Links (URL)' },
      { type: 'checkbox', name: 'newTab', label: 'In neuem Fenster öffnen' },
    );
  }
  otherItems.push(
    { type: 'input', name: 'className', label: 'CSS-Klassen' },
    { type: 'textarea', name: 'style', label: 'Inline-CSS (style)', maximized: false },
  );

  // Joomla's module Status + "Veröffentlichung starten/beenden", per element.
  const visibilityItems: any[] = [
    { type: 'htmlpanel', html: '<p style="margin:0 0 8px;color:#555">Wie ein Modul in Joomla: ausblenden statt löschen, oder nur in einem Zeitraum anzeigen. Ausgeblendete Elemente bleiben im Editor (blass, rot umrandet) und können jederzeit wieder eingeblendet werden.</p>' },
    { type: 'selectbox', name: 'status', label: 'Status', items: [{ value: 'published', text: 'Veröffentlicht (sichtbar)' }, { value: 'hidden', text: 'Versteckt (nicht auf der Webseite)' }] },
    { type: 'grid', columns: 2, items: [
      { type: 'input', name: 'from', label: 'Anzeigen ab (JJJJ-MM-TT, leer = sofort)', placeholder: '2027-01-15' },
      { type: 'input', name: 'until', label: 'Anzeigen bis (JJJJ-MM-TT, leer = unbegrenzt)', placeholder: '2027-02-28' },
    ] },
  ];

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
      if (data.style !== initial.style) dom.setAttrib(el, 'style', data.style.trim() || null);
      if (data.className !== initial.className) dom.setAttrib(el, 'class', data.className.trim() || null);

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

      if (isImg && data.src.value !== initial.src.value) dom.setAttrib(el, 'src', data.src.value);
      if (isImg && data.alt !== initial.alt) dom.setAttrib(el, 'alt', data.alt);
      if (!isImg && data.bgImage.value !== initial.bgImage.value) {
        if (data.bgImage.value) dom.setStyles(el, { 'background-image': `url('${data.bgImage.value}')`, 'background-size': el.style.backgroundSize || 'cover', 'background-position': el.style.backgroundPosition || 'center' });
        else dom.setStyle(el, 'background-image', '');
      }
      if (blockVisibility && data.status !== initial.status) dom.setAttrib(el, HIDDEN_ATTR, data.status === 'hidden' ? '1' : null);
      if (blockVisibility) ([['from', FROM_ATTR], ['until', UNTIL_ATTR]] as const).forEach(([key, attr]) => {
        const value = data[key].trim();
        if (value !== initial[key]) dom.setAttrib(el, attr, isValidDay(value) ? value : null);
      });
      if (link && (data.href !== initial.href || data.newTab !== initial.newTab)) {
        dom.setAttrib(link, 'href', data.href);
        dom.setAttrib(link, 'target', data.newTab ? '_blank' : null);
        dom.setAttrib(link, 'rel', data.newTab ? 'noopener noreferrer' : null);
      }
    });
    editor.nodeChanged();
    onDone();
  };

  editor.windowManager.open({
    title: `Element bearbeiten: ${describeElement(el)}`,
    size: 'medium',
    body: {
      type: 'tabpanel',
      tabs: [
        { name: 'colors', title: 'Farben', items: colorItems },
        { name: 'props', title: 'Eigenschaften', items: otherItems },
        ...(blockVisibility ? [{ name: 'visibility', title: 'Sichtbarkeit', items: visibilityItems }] : []),
      ],
    },
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
      const d = api.getData() as DialogData;
      const bad = [d.from, d.until].map((v) => v.trim()).filter((v) => v && !isValidDay(v));
      if (bad.length) {
        editor.notificationManager.open({ text: `Ungültiges Datum: ${bad.join(', ')} - bitte im Format JJJJ-MM-TT (z.B. 2027-01-15).`, type: 'warning', timeout: 4000 });
        return;
      }
      apply(api.getData() as unknown as DialogData);
      api.close();
    },
  } as any);
};
