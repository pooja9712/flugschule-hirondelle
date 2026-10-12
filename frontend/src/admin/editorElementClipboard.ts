import type { Editor } from 'tinymce';

// Element-level copy/cut/paste for the TinyMCE editor (RichHtmlInput.tsx),
// Joomla/page-builder style:
// - click inside a box (card, column, section...) -> Copy copies that whole
//   box; the box that will be taken is outlined while the cursor is in it
// - "Übergeordnetes Element" widens the selection to the surrounding box
// - selected text or a clicked image -> Copy copies exactly that
// - Paste puts a copied box right after the matching box under the cursor
//   (e.g. a copied card lands next to the card you clicked), anything else
//   at the cursor. Content copied outside the editor is pasted like Ctrl+V.
// The copy is also written to the system clipboard, so Ctrl+V works too and
// content can be moved between editors.

const BOX_SELECTOR = 'div,section,article,aside,figure,table,blockquote,ul,ol,header,footer,nav';
// Editor-only outline marker. Stripped from saved content (PreProcess below)
// and from anything copied (cleanHtml).
const ACTIVE_ATTR = 'data-hb-active';

const cleanHtml = (el: Element): string => {
  const copy = el.cloneNode(true) as Element;
  copy.removeAttribute(ACTIVE_ATTR);
  copy.querySelectorAll(`[${ACTIVE_ATTR}]`).forEach((n) => n.removeAttribute(ACTIVE_ATTR));
  return copy.outerHTML;
};

interface ClipEntry {
  html: string;
  plain: string;
  // Set when a whole box was copied: paste then looks for a box with the same
  // tag + classes to insert next to.
  boxTag?: string;
  boxClass?: string;
}

// Shared by every editor on the page, so content can move between fields.
let clip: ClipEntry | null = null;

export const ELEMENT_CLIPBOARD_CSS =
  `[${ACTIVE_ATTR}]{outline:2px dashed #53a8c7 !important;outline-offset:2px;}`;

export const registerElementClipboard = (editor: Editor) => {
  const body = () => editor.getBody();
  let plainTextPaste = false;
  editor.on('PastePlainTextToggle', (e: { state: boolean }) => { plainTextPaste = e.state; });

  // A "box" is a layout container - including a link wrapping block content,
  // which is how the promo cards are built (<a class="... group"><div>...).
  const isBox = (node: Node): boolean => {
    if (node.nodeType !== 1 || node === body()) return false;
    const el = node as Element;
    return el.matches(BOX_SELECTOR) || (el.nodeName === 'A' && !!el.querySelector('div,section,img,h1,h2,h3,h4,h5,h6,p'));
  };

  const boxOf = (node: Node | null): HTMLElement | null => {
    if (!node) return null;
    const box = editor.dom.getParent(node as Element, isBox, body()) as HTMLElement | null;
    return box && box !== body() ? box : null;
  };

  // The element the selection covers exactly (a clicked image, or a box
  // picked via the element path / "Übergeordnetes Element"), else null.
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

  // What Copy/Cut/Duplicate act on right now.
  const currentTarget = (): { element: HTMLElement | null; html: string; plain: string } | null => {
    const el = selectedElement();
    if (el) return { element: el, html: cleanHtml(el), plain: el.nodeName === 'IMG' ? (el.getAttribute('alt') || 'Bild') : el.textContent || '' };
    if (!editor.selection.isCollapsed()) {
      return { element: null, html: editor.selection.getContent(), plain: editor.selection.getContent({ format: 'text' }) };
    }
    const box = boxOf(editor.selection.getNode());
    return box ? { element: box, html: cleanHtml(box), plain: box.textContent || '' } : null;
  };

  const notify = (text: string, type: 'success' | 'info' | 'warning' = 'success') =>
    editor.notificationManager.open({ text, type, timeout: 2500 });

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
      notify('Nichts zum Kopieren ausgewählt - in ein Element klicken oder Text markieren.', 'info');
      return false;
    }
    const copiedBox = !!target.element && target.element.nodeName !== 'IMG' && isBox(target.element);
    clip = {
      html: target.html,
      plain: target.plain,
      boxTag: copiedBox ? target.element!.nodeName : undefined,
      boxClass: copiedBox ? target.element!.getAttribute('class') || '' : undefined,
    };
    writeSystemClipboard(clip);
    if (target.element && target.element.nodeName !== 'IMG' && editor.selection.isCollapsed()) {
      editor.selection.select(target.element);
    }
    notify(copiedBox ? 'Element kopiert' : target.element?.nodeName === 'IMG' ? 'Bild kopiert' : 'Text kopiert');
    return true;
  };

  const cut = () => {
    const target = currentTarget();
    if (!copy() || !target) return;
    editor.undoManager.transact(() => {
      if (target.element) editor.dom.remove(target.element);
      else editor.selection.setContent('');
    });
    editor.nodeChanged();
  };

  const insertEntry = (entry: ClipEntry) => {
    editor.undoManager.transact(() => {
      if (entry.boxTag) {
        const node = selectedElement() || editor.selection.getNode();
        const sameKind = editor.dom.getParent(
          node as Element,
          (n: Node) => n.nodeName === entry.boxTag && ((n as Element).getAttribute('class') || '') === entry.boxClass,
          body(),
        ) as HTMLElement | null;
        const anchor = sameKind && sameKind !== body() ? sameKind : boxOf(node);
        if (anchor) {
          anchor.insertAdjacentHTML('afterend', entry.html);
          return;
        }
      }
      editor.insertContent(entry.html);
    });
    editor.nodeChanged();
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

  const duplicate = () => {
    const el = selectedElement();
    const target = el || boxOf(editor.selection.getNode());
    if (!target) { notify('In ein Element klicken, um es zu duplizieren.', 'info'); return; }
    editor.undoManager.transact(() => target.insertAdjacentHTML('afterend', cleanHtml(target)));
    editor.nodeChanged();
    notify('Element dupliziert');
  };

  const selectParent = () => {
    const el = selectedElement();
    const target = el ? boxOf(el.parentElement) : boxOf(editor.selection.getNode());
    if (!target) { notify('Kein übergeordnetes Element vorhanden.', 'info'); return; }
    editor.selection.select(target);
    editor.nodeChanged();
  };

  // Never let the outline marker reach the saved HTML.
  editor.on('PreProcess', (e: { node: Element }) => {
    e.node.querySelectorAll(`[${ACTIVE_ATTR}]`).forEach((n) => n.removeAttribute(ACTIVE_ATTR));
    if (e.node.hasAttribute?.(ACTIVE_ATTR)) e.node.removeAttribute(ACTIVE_ATTR);
  });

  // Outline the box Copy would take, so it's clear what gets copied.
  let active: Element | null = null;
  editor.on('NodeChange', () => {
    const el = selectedElement();
    const target = el && el.nodeName !== 'IMG' ? el : boxOf(editor.selection.getNode());
    if (active && active !== target) active.removeAttribute(ACTIVE_ATTR);
    if (target) target.setAttribute(ACTIVE_ATTR, '1');
    active = target;
  });

  const items: Array<[string, string, string, () => void, string?]> = [
    ['clipboardCopy', 'copy', 'Kopieren (Element / Text / Bild)', () => { copy(); }],
    ['clipboardCut', 'cut', 'Ausschneiden', cut],
    ['clipboardPaste', 'paste', 'Einfügen', () => { void paste(); }],
    ['selectParent', 'chevron-up', 'Übergeordnetes Element auswählen', selectParent],
    ['duplicateBlock', 'duplicate', 'Element duplizieren', duplicate],
  ];
  items.forEach(([name, icon, text, onAction]) => {
    editor.ui.registry.addButton(name, { icon, tooltip: text, onAction });
    editor.ui.registry.addMenuItem(name, { icon, text, onAction });
  });
};
