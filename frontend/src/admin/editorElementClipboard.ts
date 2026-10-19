import type { Editor } from 'tinymce';
import { describeElement, linkOf, openElementPropsDialog } from './editorElementProps';
import { FROM_ATTR, HIDDEN_ATTR, UNTIL_ATTR, isBlockLive } from '../utils/blockVisibility';

// Element-level editing for the TinyMCE editor (RichHtmlInput.tsx),
// Joomla/page-builder style:
// - clicking anything picks that element (heading, text, button, image,
//   card, table cell...). It gets a dashed outline plus a small floating
//   toolbar naming it, with: select parent, copy, cut, paste, duplicate,
//   move up/down, colours & properties, delete
// - "Übergeordnetes Element" widens the pick to the surrounding element,
//   e.g. from a card's title to the whole card
// - selected text -> Copy copies exactly that text
// - Paste puts a copied element right after the matching element around the
//   pick (a copied card lands next to the card you clicked), anything else
//   at the cursor. Content copied outside the editor is pasted like Ctrl+V.
// The copy is also written to the system clipboard, so Ctrl+V works too and
// content can be moved between editors.

// Editor-only outline marker. Stripped from saved content (PreProcess below)
// and from anything copied (cleanHtml).
const ACTIVE_ATTR = 'data-hb-active';
const TOOLBAR_ID = 'hb-element-toolbar';

// Inline formatting is never picked on its own - a click on bold text picks
// the paragraph/heading it sits in. (Links are picked: they're buttons.)
const INLINE_FORMAT = new Set(['STRONG', 'EM', 'B', 'I', 'U', 'S', 'SPAN', 'SUB', 'SUP', 'SMALL', 'FONT', 'BR', 'CODE', 'MARK', 'STRIKE', 'TBODY', 'THEAD']);

const cleanHtml = (el: Element): string => {
  const copy = el.cloneNode(true) as Element;
  copy.removeAttribute(ACTIVE_ATTR);
  copy.querySelectorAll(`[${ACTIVE_ATTR}]`).forEach((n) => n.removeAttribute(ACTIVE_ATTR));
  return copy.outerHTML;
};

interface ClipEntry {
  html: string;
  plain: string;
  // Set when a whole element was copied: paste then looks for an element
  // with the same tag + classes to insert next to.
  elTag?: string;
  elClass?: string;
}

// Shared by every editor on the page, so content can move between fields.
let clip: ClipEntry | null = null;

export const ELEMENT_CLIPBOARD_CSS =
  // Hidden / scheduled blocks (blockVisibility.ts) stay editable but stand out.
  `[${HIDDEN_ATTR}]{opacity:.45;outline:2px dashed #d32f2f !important;outline-offset:-2px;}` +
  `[${FROM_ATTR}]:not([${HIDDEN_ATTR}]),[${UNTIL_ATTR}]:not([${HIDDEN_ATTR}]){outline:2px dashed #e67e22 !important;outline-offset:-2px;}` +
  `[${ACTIVE_ATTR}]{outline:2px dashed #53a8c7 !important;outline-offset:2px;}` +
  `#${TOOLBAR_ID}{all:initial;position:absolute;z-index:2147483000;display:none;align-items:center;gap:1px;background:#1A1F24;border-radius:4px;padding:2px;box-shadow:0 2px 8px rgba(0,0,0,.35);font:12px/1 sans-serif;}` +
  `#${TOOLBAR_ID} span{all:initial;color:#fff;font:600 11px/1 sans-serif;padding:0 8px 0 6px;white-space:nowrap;max-width:340px;overflow:hidden;text-overflow:ellipsis;}` +
  `#${TOOLBAR_ID} button{all:initial;cursor:pointer;width:26px;height:24px;display:inline-flex;align-items:center;justify-content:center;border-radius:3px;color:#fff;fill:#fff;}` +
  `#${TOOLBAR_ID} button:hover{background:#53a8c7;}` +
  `#${TOOLBAR_ID} button.hb-danger:hover{background:#d32f2f;}` +
  `#${TOOLBAR_ID} svg{width:18px;height:18px;fill:#fff;}`;

// `blockVisibility`: offer Joomla-style show/hide + scheduling per element
// (only where the public page applies it, see blockVisibility.ts).
export const registerElementClipboard = (editor: Editor, { blockVisibility = false } = {}) => {
  editor.ui.registry.addIcon('hb-arrow-up', '<svg width="24" height="24" viewBox="0 0 24 24"><path d="M12 5l-6 6h4v8h4v-8h4z"/></svg>');
  editor.ui.registry.addIcon('hb-arrow-down', '<svg width="24" height="24" viewBox="0 0 24 24"><path d="M12 19l6-6h-4V5h-4v8H6z"/></svg>');
  editor.ui.registry.addIcon('hb-palette', '<svg width="24" height="24" viewBox="0 0 24 24"><path d="M12 3a9 9 0 0 0 0 18c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-4.42-4.03-8-9-8zm-5.5 9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg>');
  const body = () => editor.getBody();
  let plainTextPaste = false;
  editor.on('PastePlainTextToggle', (e: { state: boolean }) => { plainTextPaste = e.state; });

  // ---------- picking ----------
  let picked: HTMLElement | null = null;
  let lastClick = 0;
  // Set by a toolbar button press: the click that follows must not re-pick
  // whatever ends up under the cursor once the toolbar has moved.
  let ignoreClickUntil = 0;
  // Where the caret was when the current pick was made (by a click or a
  // toolbar action). The pick only follows the caret once it has moved
  // away from there - otherwise e.g. a duplicated card would lose its pick
  // to the caret still sitting in the original card.
  let pickAnchor: Node | null = null;

  const pickFrom = (node: Node | null): HTMLElement | null => {
    let n: Node | null = node;
    if (n && n.nodeType === 3) n = n.parentNode;
    while (n && n !== body() && n.nodeType === 1 && INLINE_FORMAT.has(n.nodeName)) n = n.parentNode;
    return n && n.nodeType === 1 && n !== body() && body().contains(n) ? (n as HTMLElement) : null;
  };

  const notify = (text: string, type: 'success' | 'info' | 'warning' = 'success') =>
    editor.notificationManager.open({ text, type, timeout: 2500 });

  // The element the selection covers exactly (a clicked image, or an element
  // picked via the element path), else null.
  const selectedElement = (): HTMLElement | null => {
    const rng = editor.selection.getRng();
    if (rng.collapsed) return null;
    if (rng.startContainer === rng.endContainer && rng.endOffset - rng.startOffset === 1) {
      const node = rng.startContainer.childNodes[rng.startOffset];
      if (node && node.nodeType === 1) return node as HTMLElement;
    }
    const node = editor.selection.getNode();
    return node.nodeName === 'IMG' ? (node as HTMLElement) : null;
  };

  const hasTextSelection = () => !editor.selection.isCollapsed() && !selectedElement();

  const currentPick = (): HTMLElement | null => {
    if (picked && body().contains(picked)) return picked;
    picked = pickFrom(selectedElement() || editor.selection.getNode());
    return picked;
  };

  // What Copy/Cut act on right now: selected text, else the picked element.
  const currentTarget = (): { element: HTMLElement | null; html: string; plain: string } | null => {
    if (hasTextSelection()) {
      return { element: null, html: editor.selection.getContent(), plain: editor.selection.getContent({ format: 'text' }) };
    }
    const el = currentPick();
    if (!el) return null;
    return { element: el, html: cleanHtml(el), plain: el.nodeName === 'IMG' ? (el.getAttribute('alt') || 'Bild') : el.textContent || '' };
  };

  const caretNode = (): Node => selectedElement() || editor.selection.getNode();

  const changed = () => {
    pickAnchor = caretNode();
    editor.nodeChanged();
    scheduleToolbar();
  };

  // ---------- clipboard ----------
  const writeSystemClipboard = (entry: ClipEntry) => {
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return;
      navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([entry.html], { type: 'text/html' }),
          'text/plain': new Blob([entry.plain || ' '], { type: 'text/plain' }),
        }),
      ]).catch(() => { /* internal clipboard still works */ });
    } catch { /* internal clipboard still works */ }
  };

  const copy = (): boolean => {
    const target = currentTarget();
    if (!target || !target.html.trim()) {
      notify('Nichts zum Kopieren ausgewählt - ein Element anklicken oder Text markieren.', 'info');
      return false;
    }
    clip = {
      html: target.html,
      plain: target.plain,
      elTag: target.element?.nodeName,
      elClass: target.element ? target.element.getAttribute('class') || '' : undefined,
    };
    writeSystemClipboard(clip);
    notify(target.element ? `${describeElement(target.element)} kopiert` : 'Text kopiert');
    return true;
  };

  const cut = () => {
    const target = currentTarget();
    if (!copy() || !target) return;
    editor.undoManager.transact(() => {
      if (target.element) editor.dom.remove(target.element);
      else editor.selection.setContent('');
    });
    if (target.element) picked = null;
    changed();
  };

  const insertEntry = (entry: ClipEntry) => {
    const anchorBase = currentPick();
    let inserted: Element | null = null;
    editor.undoManager.transact(() => {
      if (entry.elTag && anchorBase) {
        // Next to the nearest element of the same kind (card next to card,
        // row next to row), else right after the picked element.
        const sameKind = editor.dom.getParent(
          anchorBase,
          (n: Node) => n.nodeName === entry.elTag && ((n as Element).getAttribute('class') || '') === entry.elClass,
          body(),
        ) as HTMLElement | null;
        const sameTag = editor.dom.getParent(anchorBase, (n: Node) => n.nodeName === entry.elTag, body()) as HTMLElement | null;
        const anchor = (sameKind && sameKind !== body() && sameKind) || (sameTag && sameTag !== body() && sameTag) || anchorBase;
        anchor.insertAdjacentHTML('afterend', entry.html);
        inserted = anchor.nextElementSibling;
        return;
      }
      editor.insertContent(entry.html);
    });
    if (inserted) picked = inserted;
    changed();
  };

  const paste = async () => {
    let sysHtml: string | null = null;
    let sysText: string | null = null;
    let readFailed = false;
    try {
      if (navigator.clipboard?.read) {
        for (const item of await navigator.clipboard.read()) {
          if (item.types.includes('text/html')) sysHtml = await (await item.getType('text/html')).text();
          if (item.types.includes('text/plain')) sysText = await (await item.getType('text/plain')).text();
        }
      } else if (navigator.clipboard?.readText) {
        sysText = await navigator.clipboard.readText();
      } else {
        readFailed = true;
      }
    } catch {
      readFailed = true;
    }

    const ownCopy = !!clip && (readFailed || (sysText ?? '').trim() === (clip.plain || ' ').trim());

    // "Als Text einfügen" switched on -> plain text only, like Ctrl+V.
    if (plainTextPaste) {
      const text = ownCopy ? clip!.plain : sysText;
      if (text) editor.execCommand('mceInsertClipboardContent', false, { text });
      else notify('Zwischenablage ist leer oder der Zugriff wurde blockiert - bitte Strg+V verwenden.', 'warning');
      return;
    }

    // Our own copy (still on the system clipboard, or clipboard reading not
    // allowed) -> element-aware paste.
    if (ownCopy && clip) {
      insertEntry(clip);
      return;
    }
    if (sysHtml) { editor.execCommand('mceInsertClipboardContent', false, { html: sysHtml }); return; }
    if (sysText) { editor.execCommand('mceInsertClipboardContent', false, { text: sysText }); return; }
    notify('Zwischenablage ist leer oder der Zugriff wurde blockiert - bitte Strg+V verwenden.', 'warning');
  };

  // ---------- element actions ----------
  const requirePick = (what: string): HTMLElement | null => {
    const el = currentPick();
    if (!el) notify(`Zuerst ein Element anklicken, um es zu ${what}.`, 'info');
    return el;
  };

  const duplicate = () => {
    const target = requirePick('duplizieren');
    if (!target) return;
    editor.undoManager.transact(() => target.insertAdjacentHTML('afterend', cleanHtml(target)));
    picked = target.nextElementSibling as HTMLElement | null;
    changed();
    notify(`${describeElement(target)} dupliziert`);
  };

  const selectParent = () => {
    const el = currentPick();
    const parent = el?.parentElement;
    if (!parent || parent === body()) { notify('Kein übergeordnetes Element vorhanden.', 'info'); return; }
    picked = pickFrom(parent) || parent;
    // Collapse any text/image selection, so the outline (not a blue text
    // highlight) shows what's picked.
    if (!editor.selection.isCollapsed()) editor.selection.collapse(true);
    changed();
  };

  const selectChild = () => {
    const el = currentPick();
    const child = el?.firstElementChild as HTMLElement | null;
    if (!child) { notify('Kein untergeordnetes Element vorhanden.', 'info'); return; }
    picked = child;
    changed();
  };

  const move = (dir: -1 | 1) => {
    const el = requirePick('verschieben');
    if (!el) return;
    const sibling = dir < 0 ? el.previousElementSibling : el.nextElementSibling;
    if (!sibling) { notify(dir < 0 ? 'Element ist bereits ganz oben.' : 'Element ist bereits ganz unten.', 'info'); return; }
    editor.undoManager.transact(() => (dir < 0 ? sibling.before(el) : sibling.after(el)));
    changed();
    el.scrollIntoView({ block: 'nearest' });
  };

  const remove = () => {
    const el = requirePick('löschen');
    if (!el) return;
    const parent = el.parentElement;
    editor.undoManager.transact(() => editor.dom.remove(el));
    picked = parent && parent !== body() ? parent : null;
    changed();
    notify(`${describeElement(el)} gelöscht - Rückgängig mit Strg+Z`);
  };

  // Joomla's publish/unpublish toggle, for one element.
  const toggleHidden = () => {
    const el = requirePick('ein- oder auszublenden');
    if (!el) return;
    const hide = !el.hasAttribute(HIDDEN_ATTR);
    editor.undoManager.transact(() => editor.dom.setAttrib(el, HIDDEN_ATTR, hide ? '1' : null));
    changed();
    notify(hide ? `${describeElement(el)} ausgeblendet - erscheint nicht mehr auf der Webseite` : `${describeElement(el)} wieder sichtbar`);
  };

  // Opens TinyMCE's link dialog for the picked button / linked card / linked
  // image (or adds a link to a picked text or image).
  const editLink = () => {
    const el = requirePick('zu verlinken');
    if (!el) return;
    const a = linkOf(el);
    if (el.nodeName === 'IMG') editor.selection.select(el);
    else editor.selection.select(a || el, !a);
    editor.execCommand('mceLink');
  };

  const editProps = () => {
    const el = requirePick('bearbeiten');
    if (el) openElementPropsDialog(editor, el, changed, { blockVisibility });
  };

  // ---------- outline + floating toolbar ----------
  // Never let the outline marker reach the saved HTML.
  editor.on('PreProcess', (e: { node: Element }) => {
    e.node.querySelectorAll(`[${ACTIVE_ATTR}]`).forEach((n) => n.removeAttribute(ACTIVE_ATTR));
    if (e.node.hasAttribute?.(ACTIVE_ATTR)) e.node.removeAttribute(ACTIVE_ATTR);
  });

  let outlined: Element | null = null;
  let toolbar: HTMLDivElement | null = null;
  let label: HTMLSpanElement | null = null;
  let scheduled = false;

  const icon = (name: string, fallback: string) => {
    const svg = editor.ui.registry.getAll().icons[name];
    return svg || `<b style="color:#fff;font:700 13px sans-serif">${fallback}</b>`;
  };

  const buildToolbar = (): HTMLDivElement => {
    const doc = editor.getDoc();
    const bar = doc.createElement('div');
    bar.id = TOOLBAR_ID;
    bar.setAttribute('data-mce-bogus', 'all');
    label = doc.createElement('span');
    bar.appendChild(label);
    const buttons: Array<[string, string, string, () => void, string?]> = [
      ['chevron-up', '⤒', 'Übergeordnetes Element auswählen', selectParent],
      ['chevron-down', '⤓', 'Erstes Unterelement auswählen', selectChild],
      ['copy', 'C', 'Kopieren', () => { copy(); }],
      ['cut', 'X', 'Ausschneiden', cut],
      ['paste', 'V', 'Einfügen (nach diesem Element)', () => { void paste(); }],
      ['duplicate', '2', 'Duplizieren', duplicate],
      ['hb-arrow-up', '↑', 'Nach oben verschieben', () => move(-1)],
      ['hb-arrow-down', '↓', 'Nach unten verschieben', () => move(1)],
      ['link', '🔗', 'Link bearbeiten / hinzufügen', editLink],
      ...(blockVisibility ? [['preview', '👁', 'Ein-/Ausblenden (veröffentlicht / versteckt)', toggleHidden] as [string, string, string, () => void]] : []),
      ['hb-palette', '🎨', 'Farben, Eigenschaften & Sichtbarkeit', editProps],
      ['remove', '🗑', 'Element löschen', remove, 'hb-danger'],
    ];
    buttons.forEach(([iconName, fallback, title, action, cls]) => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.title = title;
      if (cls) b.className = cls;
      b.innerHTML = icon(iconName, fallback);
      // Act on mousedown: by "click" time TinyMCE may already have moved
      // the caret and the toolbar with it, so the click would miss.
      b.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        ignoreClickUntil = Date.now() + 600;
        if (e.button === 0) action();
      });
      b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); });
      bar.appendChild(b);
    });
    bar.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
    // Outside <body>, so it is never part of the content.
    doc.documentElement.appendChild(bar);
    return bar;
  };

  const positionToolbar = () => {
    scheduled = false;
    const doc = editor.getDoc();
    const win = editor.getWin();
    if (!doc || !win) return;
    if (!toolbar || !doc.documentElement.contains(toolbar)) toolbar = buildToolbar();
    const el = picked && body().contains(picked) ? picked : null;

    if (outlined && outlined !== el) outlined.removeAttribute(ACTIVE_ATTR);
    if (el && el.nodeName !== 'IMG') el.setAttribute(ACTIVE_ATTR, '1');
    outlined = el;

    if (!el) { toolbar.style.display = 'none'; return; }
    const state = el.hasAttribute(HIDDEN_ATTR) ? ' (versteckt)'
      : el.hasAttribute(FROM_ATTR) || el.hasAttribute(UNTIL_ATTR) ? (isBlockLive(el) ? ' (zeitgesteuert)' : ' (zeitgesteuert, gerade nicht sichtbar)') : '';
    const href = linkOf(el)?.getAttribute('href');
    label!.textContent = describeElement(el) + state + (href ? `  →  ${href}` : '');
    label!.title = describeElement(el);
    toolbar.style.display = 'flex';
    const rect = el.getBoundingClientRect();
    const barH = toolbar.offsetHeight || 28;
    const barW = toolbar.offsetWidth || 300;
    const viewW = doc.documentElement.clientWidth;
    let top = rect.top - barH - 4;
    // No room above (top of the editor, or element scrolled half out) ->
    // show it just inside the element's top edge.
    if (top < 0) top = Math.max(0, Math.min(rect.top, win.innerHeight - barH) + 4);
    const left = Math.max(0, Math.min(rect.left, viewW - barW - 4));
    toolbar.style.top = `${top + win.scrollY}px`;
    toolbar.style.left = `${left + win.scrollX}px`;
  };

  // A microtask, not requestAnimationFrame: rAF doesn't run while the
  // admin tab is in the background, which left the outline stale.
  const scheduleToolbar = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(positionToolbar);
  };

  editor.on('click', (e: MouseEvent) => {
    lastClick = Date.now();
    const target = e.target as Node;
    if ((toolbar && toolbar.contains(target)) || Date.now() < ignoreClickUntil) return;
    picked = pickFrom(target);
    pickAnchor = caretNode();
    scheduleToolbar();
  });

  editor.on('NodeChange', () => {
    // A click picks exactly what was clicked (even an empty overlay box the
    // caret can't go into) - don't let the caret move that follows override it.
    const node = caretNode();
    if (picked && !body().contains(picked)) picked = null;
    if (node !== pickAnchor && Date.now() - lastClick > 400) {
      if (!picked || (picked !== node && !picked.contains(node))) picked = pickFrom(node);
      pickAnchor = node;
    }
    scheduleToolbar();
  });

  editor.on('init', () => {
    editor.getWin().addEventListener('scroll', scheduleToolbar);
    editor.getWin().addEventListener('resize', scheduleToolbar);
  });
  editor.on('input keyup SetContent ResizeEditor FullscreenStateChanged', scheduleToolbar);
  editor.on('SetContent', () => { if (picked && !body().contains(picked)) picked = null; });

  // ---------- buttons / menu items ----------
  const items: Array<[string, string, string, () => void]> = [
    ['clipboardCopy', 'copy', 'Kopieren (Element / Text / Bild)', () => { copy(); }],
    ['clipboardCut', 'cut', 'Ausschneiden', cut],
    ['clipboardPaste', 'paste', 'Einfügen', () => { void paste(); }],
    ['selectParent', 'chevron-up', 'Übergeordnetes Element auswählen', selectParent],
    ['duplicateBlock', 'duplicate', 'Element duplizieren', duplicate],
    ['elementProps', 'hb-palette', 'Element: Farben, Eigenschaften & Sichtbarkeit', editProps],
    ...(blockVisibility ? [['toggleElementHidden', 'preview', 'Element ein-/ausblenden', toggleHidden] as [string, string, string, () => void]] : []),
    ['moveElementUp', 'hb-arrow-up', 'Element nach oben verschieben', () => move(-1)],
    ['moveElementDown', 'hb-arrow-down', 'Element nach unten verschieben', () => move(1)],
    ['deleteElement', 'remove', 'Element löschen', remove],
  ];
  items.forEach(([name, iconName, text, onAction]) => {
    editor.ui.registry.addButton(name, { icon: iconName, tooltip: text, onAction });
    editor.ui.registry.addMenuItem(name, { icon: iconName, text, onAction });
  });
};
