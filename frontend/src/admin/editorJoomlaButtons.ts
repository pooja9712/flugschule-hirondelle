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

interface DownloadCategory { title: string; files: { title: string; fileUrl: string }[] }

// Download categories + files (Admin > Downloads), for "CMS-Inhalt > Download".
const loadDownloads = (): Promise<DownloadCategory[]> =>
  fetch('/api/downloads/public')
    .then((r) => (r.ok ? r.json() : []))
    .then((cats: DownloadCategory[]) => cats.filter((c) => c.files?.length))
    .catch(() => []);

const pageLinkList = () => new Promise<LinkItem[]>((resolve) => loadPageLinkList(resolve));

// YouTube id (+ start second) from any usual link: watch?v=, youtu.be/,
// /embed/, /shorts/, /live/, or a bare 11-character id.
export const parseYouTube = (input: string): { id: string; start: number } | null => {
  const v = input.trim();
  const m = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([\w-]{11})/.exec(v)
    || /^([\w-]{11})$/.exec(v);
  if (!m) return null;
  const t = /[?&](?:t|start)=(?:(\d+)h)?(?:(\d+)m)?(\d+)s?/.exec(v);
  const start = t ? (Number(t[1] || 0) * 3600) + (Number(t[2] || 0) * 60) + Number(t[3] || 0) : 0;
  return { id: m[1], start };
};

const youTubeEmbed = (id: string, start: number, title: string) =>
  `<div data-hb-video="youtube" style="position:relative;width:100%;padding-bottom:56.25%;height:0;overflow:hidden;margin:0 0 1.5rem;">`
  + `<iframe src="https://www.youtube-nocookie.com/embed/${id}${start ? `?start=${start}` : ''}" title="${title.replace(/"/g, '&quot;') || 'YouTube-Video'}" `
  + 'style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" '
  + 'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" '
  + 'referrerpolicy="strict-origin-when-cross-origin" allowfullscreen loading="lazy"></iframe></div>';

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

  // A link with the selected text (or the given label) as its text.
  const insertLink = (href: string, label: string) => {
    const text = editor.selection.isCollapsed() ? editor.dom.encode(label) : editor.selection.getContent();
    editor.undoManager.transact(() => editor.insertContent(`<a href="${editor.dom.encode(href)}">${text}</a>`));
    editor.nodeChanged();
  };
  const linkMenuItems = (items: LinkItem[]): any[] => items.map((item) =>
    'menu' in item
      ? { type: 'nestedmenuitem', text: item.title, getSubmenuItems: () => linkMenuItems(item.menu) }
      : { type: 'menuitem', text: item.title, onAction: () => insertLink(item.value, item.title) });
  const downloadMenuItems = (cats: DownloadCategory[]): any[] => cats.length
    ? cats.map((c) => ({
      type: 'nestedmenuitem',
      text: c.title,
      getSubmenuItems: () => c.files.map((file) => ({ type: 'menuitem', text: file.title, onAction: () => insertLink(file.fileUrl, file.title) })),
    }))
    : [{ type: 'menuitem', text: 'Keine Downloads vorhanden', enabled: false, onAction: () => {} }];

  const insertReadmore = () => insertBlock('<hr id="system-readmore">');

  // "YouTube-Video": paste a link, get a responsive embed. With a video
  // selected (or its block picked) it replaces that video.
  const currentVideo = (): { box: HTMLElement | null; src: string; title: string } => {
    const node = editor.selection.getNode() as HTMLElement;
    const box = (node.closest?.('[data-hb-video]') || node.querySelector?.('[data-hb-video]')) as HTMLElement | null;
    const frame = (box || node).querySelector?.('iframe') || (node.nodeName === 'IFRAME' ? node : null);
    const src = frame?.getAttribute('src') || node.getAttribute?.('data-mce-p-src') || '';
    return { box: box || (frame ? (node.closest('.mce-preview-object') as HTMLElement | null) || node : null), src, title: frame?.getAttribute('title') || '' };
  };
  const openYouTubeDialog = () => {
    const current = currentVideo();
    const known = parseYouTube(current.src);
    editor.windowManager.open({
      title: known ? 'YouTube-Video ändern' : 'YouTube-Video einfügen',
      body: {
        type: 'panel',
        items: [
          { type: 'input', name: 'url', label: 'YouTube-Link (z.B. https://www.youtube.com/watch?v=… oder https://youtu.be/…)' },
          { type: 'input', name: 'title', label: 'Titel (für Barrierefreiheit, optional)' },
          { type: 'htmlpanel', html: '<p style="margin:4px 0 0;color:#666">Das Video wird in voller Breite (16:9) und datenschutzfreundlich (youtube-nocookie) eingebettet. Eine Startzeit im Link (&amp;t=90s) wird übernommen.</p>' },
        ],
      },
      initialData: { url: known ? `https://www.youtube.com/watch?v=${known.id}${known.start ? `&t=${known.start}s` : ''}` : '', title: current.title },
      buttons: [{ type: 'cancel', text: 'Abbrechen' }, { type: 'submit', text: known ? 'Ändern' : 'Einfügen', primary: true }],
      onSubmit: (api: any) => {
        const data = api.getData() as { url: string; title: string };
        const yt = parseYouTube(data.url);
        if (!yt) {
          editor.notificationManager.open({ text: 'Das ist kein gültiger YouTube-Link.', type: 'warning', timeout: 3000 });
          return;
        }
        const html = youTubeEmbed(yt.id, yt.start, data.title.trim());
        if (known && current.box) {
          editor.undoManager.transact(() => {
            current.box!.insertAdjacentHTML('afterend', html);
            editor.dom.remove(current.box!);
          });
          editor.nodeChanged();
        } else {
          insertBlock(html);
        }
        api.close();
      },
    } as any);
  };
  editor.addCommand('hbYouTube', openYouTubeDialog);
  editor.ui.registry.addIcon('hb-youtube', '<svg width="24" height="24" viewBox="0 0 24 24"><path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15V9l5.2 3z"/></svg>');
  editor.ui.registry.addButton('hbYouTube', { icon: 'hb-youtube', tooltip: 'YouTube-Video einfügen / ändern', onAction: openYouTubeDialog });
  editor.ui.registry.addMenuItem('hbYouTube', { icon: 'hb-youtube', text: 'YouTube-Video', onAction: openYouTubeDialog });

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
    // Same entries as Joomla's "CMS Inhalt" (Beitrag, Medien, Menü, Download),
    // plus page break / read more / templates. Menü and Download are loaded
    // when the menu opens.
    fetch: (done) => {
      Promise.all([pageLinkList(), loadDownloads()]).then(([pages, downloads]) => done([
      { type: 'menuitem', icon: 'link', text: 'Beitrag / Seite (Link-Dialog)', onAction: () => editor.execCommand('mceLink') },
      { type: 'menuitem', icon: 'image', text: 'Medien: Bild', onAction: () => { void insertMediaImage(); } },
      { type: 'menuitem', icon: 'document-properties', text: 'Medien: Datei (Download-Link)', onAction: () => { void insertMediaFile(); } },
      { type: 'menuitem', icon: 'hb-youtube', text: 'YouTube-Video', onAction: openYouTubeDialog },
      { type: 'nestedmenuitem', icon: 'link', text: 'Menü', getSubmenuItems: () => linkMenuItems(pages) },
      { type: 'nestedmenuitem', icon: 'save', text: 'Download', getSubmenuItems: () => downloadMenuItems(downloads) },
      { type: 'menuitem', icon: 'page-break', text: 'Seitenumbruch', onAction: () => editor.execCommand('mcePageBreak') },
      { type: 'menuitem', icon: 'horizontal-rule', text: 'Weiterlesen', onAction: insertReadmore },
      { type: 'nestedmenuitem', icon: 'template', text: 'Vorlage', getSubmenuItems: () => templateItems() },
      ] as any));
    },
  });
};
