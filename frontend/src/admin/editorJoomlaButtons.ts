import type { Editor } from 'tinymce';
import { openMediaBrowser } from './editorMediaBrowser';

// The extra buttons Joomla's TinyMCE has on top of stock TinyMCE, rebuilt
// for RichHtmlInput.tsx:
// - "CMS-Inhalt" (Joomla's "CMS Content" / editor-xtd buttons): image or
//   file from the media folders, link to a site page, page break, read more
// - "Vorlagen" (Joomla's jtemplate button): ready-made layout blocks
// - the site's own colours in every colour palette
// - the site's menu pages in the link dialog's "Link list"
// Snippets use inline styles rather than Tailwind classes: Tailwind only
// ships classes it finds in the source code, not ones typed into content.

// [hex, name] pairs, flattened the way TinyMCE's color_map wants them.
export const COLOR_MAP = [
  '53A8C7', 'Hirondelle Blau',
  '339ACA', 'Überschrift Blau',
  '3A85A4', 'Hirondelle Dunkelblau',
  '6EB7D1', 'Hirondelle Hellblau',
  '1A1F24', 'Luxury Dunkel',
  '394553', 'Schiefer',
  'FAF9F7', 'Creme',
  '6B7280', 'Textgrau',
  '000000', 'Schwarz',
  '434343', 'Dunkelgrau',
  '999999', 'Grau',
  'E5E7EB', 'Hellgrau',
  'FFFFFF', 'Weiß',
  'C0392B', 'Rot',
  'E67E22', 'Orange',
  'F1C40F', 'Gelb',
  '27AE60', 'Grün',
  '16A085', 'Petrol',
  '2980B9', 'Blau',
  '8E44AD', 'Violett',
  'FDECEA', 'Rot hell',
  'FFF4E5', 'Orange hell',
  'EDF7ED', 'Grün hell',
  'E8F4FA', 'Blau hell',
];

interface MenuNode { label: string; url: string; subItems?: MenuNode[] }
type LinkItem = { title: string; value: string } | { title: string; menu: LinkItem[] };

let pageLinks: Promise<LinkItem[]> | null = null;

// TinyMCE link_list: the header + footer menus, nested like the menu.
export const loadPageLinkList = (success: (list: LinkItem[]) => void) => {
  pageLinks ??= Promise.all([
    fetch('/api/menu/public').then((r) => (r.ok ? r.json() : [])).catch(() => []),
    fetch('/api/footerlinks/public').then((r) => (r.ok ? r.json() : [])).catch(() => []),
  ]).then(([header, footer]: [MenuNode[], MenuNode[]]) => {
    const toItem = (n: MenuNode): LinkItem =>
      n.subItems?.length
        ? { title: n.label, menu: [{ title: `${n.label} (Übersicht)`, value: n.url }, ...n.subItems.map(toItem)] }
        : { title: n.label, value: n.url };
    const list: LinkItem[] = [{ title: 'Startseite', value: '/' }, ...header.map(toItem)];
    if (footer.length) list.push({ title: 'Fußzeile', menu: footer.map(toItem) });
    return list;
  });
  pageLinks.then(success).catch(() => success([]));
};

const P = 'font-family:Jost,sans-serif;color:#6b7280;line-height:1.8;margin:0 0 1rem;';
const H2 = 'font-family:Cormorant Garamond,serif;color:#1A1F24;text-transform:uppercase;letter-spacing:.02em;font-size:2.25rem;margin:0 0 1.25rem;';
const H3 = 'font-family:Cormorant Garamond,serif;font-style:italic;color:#339aca;font-size:1.4rem;margin:0 0 .75rem;';
const BTN = 'display:inline-block;background:#53a8c7;color:#ffffff;text-transform:uppercase;letter-spacing:.15em;font-size:12px;font-weight:600;padding:14px 32px;text-decoration:none;';
const IMG = 'width:100%;height:220px;object-fit:cover;display:block;';

const card = (n: number) =>
  `<div style="background:#ffffff;box-shadow:0 4px 16px rgba(0,0,0,.08);">` +
  `<img src="/images/startbuttons/startbutton_schnuppern.jpg" alt="Bild ${n}" style="${IMG}">` +
  `<div style="padding:24px;"><h3 style="${H3}">Titel ${n}</h3><p style="${P}">Kurze Beschreibung der Kachel.</p>` +
  `<a href="/ausbildung" style="${BTN}">Mehr erfahren</a></div></div>`;

const TEMPLATES: Array<{ title: string; html: string }> = [
  { title: 'Überschrift + Text', html: `<h2 style="${H2}">Überschrift</h2><p style="${P}">Hier steht Ihr Text.</p>` },
  { title: 'Button / Link-Button', html: `<p><a href="/ausbildung" style="${BTN}">Jetzt buchen</a></p>` },
  {
    title: 'Zwei Spalten',
    html: `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:32px;margin:0 0 2rem;">` +
      `<div><h3 style="${H3}">Linke Spalte</h3><p style="${P}">Text der linken Spalte.</p></div>` +
      `<div><h3 style="${H3}">Rechte Spalte</h3><p style="${P}">Text der rechten Spalte.</p></div></div>`,
  },
  {
    title: 'Drei Kacheln mit Bild und Button',
    html: `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:32px;margin:0 0 2rem;">${card(1)}${card(2)}${card(3)}</div>`,
  },
  {
    title: 'Bild links, Text rechts',
    html: `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:32px;align-items:center;margin:0 0 2rem;">` +
      `<img src="/images/startbuttons/gutschein.jpg" alt="Bild" style="width:100%;display:block;">` +
      `<div><h2 style="${H2}">Überschrift</h2><p style="${P}">Text neben dem Bild.</p><a href="/infos" style="${BTN}">Mehr erfahren</a></div></div>`,
  },
  {
    title: 'Tabelle mit Links',
    html: `<table style="border-collapse:collapse;width:100%;margin:0 0 2rem;" border="1"><thead><tr style="background-color:#53a8c7;color:#ffffff;">` +
      `<th style="padding:10px;border-color:#e5e7eb;text-align:left;">Kurs</th><th style="padding:10px;border-color:#e5e7eb;text-align:left;">Datum</th><th style="padding:10px;border-color:#e5e7eb;text-align:left;">Preis</th><th style="padding:10px;border-color:#e5e7eb;text-align:left;">Link</th></tr></thead><tbody>` +
      ['Schnupperkurs', 'L-Schein', 'A-Schein'].map((k, i) =>
        `<tr><td style="padding:10px;border-color:#e5e7eb;">${k}</td><td style="padding:10px;border-color:#e5e7eb;">01.0${i + 1}.2027</td><td style="padding:10px;border-color:#e5e7eb;">${(i + 1) * 150} €</td>` +
        `<td style="padding:10px;border-color:#e5e7eb;"><a href="/events" style="color:#53a8c7;">Details</a></td></tr>`).join('') +
      `</tbody></table>`,
  },
  {
    title: 'Hinweis-Box (farbig)',
    html: `<div style="background-color:#e8f4fa;border-left:4px solid #53a8c7;padding:20px 24px;margin:0 0 2rem;"><h3 style="${H3}">Hinweis</h3><p style="${P}margin:0;">Wichtiger Hinweis-Text.</p></div>`,
  },
  {
    title: 'Farbiger Bereich (volle Breite)',
    html: `<section style="background-color:#FAF9F7;padding:64px 24px;margin:0 0 2rem;text-align:center;"><h2 style="${H2}">Bereichs-Überschrift</h2><p style="${P}">Text im Bereich.</p><a href="/ausbildung" style="${BTN}">Mehr erfahren</a></section>`,
  },
  { title: 'Abstand', html: `<div style="height:48px;"></div>` },
];

export const registerJoomlaButtons = (editor: Editor) => {
  const insertBlock = (html: string) => {
    // Inside a linked card/button a block can't go at the caret (a link in
    // a link is invalid and TinyMCE turns the inner one into a <div>), so it
    // goes right after the outermost surrounding link instead.
    const links = editor.dom.getParents(editor.selection.getNode(), 'a', editor.getBody()) as HTMLElement[];
    const outerLink = links[links.length - 1];
    editor.undoManager.transact(() => {
      if (outerLink) outerLink.insertAdjacentHTML('afterend', html);
      else editor.insertContent(html);
    });
    editor.nodeChanged();
  };

  const insertMediaImage = () =>
    openMediaBrowser().then((url) => {
      if (!url) return;
      const alt = decodeURIComponent(url.split('/').pop() || '').replace(/\.[a-z0-9]+$/i, '');
      insertBlock(`<img src="${url}" alt="${editor.dom.encode(alt)}">`);
    });

  const insertMediaFile = () =>
    openMediaBrowser({ imagesOnly: false, accept: '*/*' }).then((url) => {
      if (!url) return;
      const name = decodeURIComponent(url.split('/').pop() || url);
      const text = editor.selection.isCollapsed() ? editor.dom.encode(name) : editor.selection.getContent();
      insertBlock(`<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`);
    });

  const insertReadmore = () => insertBlock('<hr id="system-readmore">');

  editor.ui.registry.addMenuItem('hbMediaImage', { icon: 'image', text: 'Bild aus Medien', onAction: () => { void insertMediaImage(); } });
  editor.ui.registry.addMenuItem('hbMediaFile', { icon: 'document-properties', text: 'Datei aus Medien (Download-Link)', onAction: () => { void insertMediaFile(); } });
  editor.ui.registry.addMenuItem('hbReadmore', { icon: 'horizontal-rule', text: 'Weiterlesen', onAction: insertReadmore });

  const templateItems = () => TEMPLATES.map((t) => ({ type: 'menuitem' as const, text: t.title, onAction: () => insertBlock(t.html) }));

  editor.ui.registry.addMenuButton('hbTemplates', {
    icon: 'template',
    tooltip: 'Vorlage einfügen',
    fetch: (done) => done(templateItems()),
  });
  editor.ui.registry.addNestedMenuItem('hbTemplatesMenu', {
    icon: 'template',
    text: 'Vorlage',
    getSubmenuItems: () => templateItems(),
  });

  editor.ui.registry.addMenuButton('hbCmsContent', {
    text: 'CMS-Inhalt',
    tooltip: 'CMS-Inhalt einfügen',
    fetch: (done) => done([
      { type: 'menuitem', icon: 'image', text: 'Bild aus Medien', onAction: () => { void insertMediaImage(); } },
      { type: 'menuitem', icon: 'document-properties', text: 'Datei aus Medien (Download-Link)', onAction: () => { void insertMediaFile(); } },
      { type: 'menuitem', icon: 'link', text: 'Link zu einer Seite / URL', onAction: () => editor.execCommand('mceLink') },
      { type: 'menuitem', icon: 'page-break', text: 'Seitenumbruch', onAction: () => editor.execCommand('mcePageBreak') },
      { type: 'menuitem', icon: 'horizontal-rule', text: 'Weiterlesen', onAction: insertReadmore },
      { type: 'nestedmenuitem', icon: 'template', text: 'Vorlage', getSubmenuItems: () => templateItems() },
    ]),
  });
};
