// Joomla-style image picker for the TinyMCE editor (RichHtmlInput.tsx):
// browse the site's media folders (same API as Admin > Medien, see
// MediaManager.tsx / backend media.routes.ts) or upload a new file, and get
// back the chosen URL. Plain DOM on purpose - it opens from inside TinyMCE
// dialogs/callbacks, outside React.

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('auth')}` });

interface MediaListing {
  path: string;
  folders: { name: string }[];
  files: { name: string; url: string; isImage: boolean }[];
}

const listFolder = (path: string): Promise<MediaListing> =>
  fetch(`/api/media?path=${encodeURIComponent(path)}`, { headers: authHeaders() }).then((res) => {
    if (!res.ok) throw new Error('Ordner konnte nicht geladen werden');
    return res.json();
  });

export const uploadEditorFile = (file: Blob, filename: string): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file, filename);
  return fetch('/api/upload', { method: 'POST', headers: authHeaders(), body: formData })
    .then((res) => res.json().then((data) => ({ res, data })))
    .then(({ res, data }) => {
      if (res.ok && data.url) return data.url as string;
      throw new Error(data.message || 'Fehler beim Upload');
    });
};

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, css: string, text = ''): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.style.cssText = css;
  if (text) node.textContent = text;
  return node;
};

const BTN = 'border:1px solid #c4c4c4;background:#fff;border-radius:4px;padding:6px 12px;cursor:pointer;font:14px sans-serif;';

// `accept` limits the upload button (e.g. "image/*"); `imagesOnly` hides
// non-image files in the listing.
export const openMediaBrowser = ({ imagesOnly = true, accept = 'image/*' } = {}): Promise<string | null> =>
  new Promise((resolve) => {
    // Above TinyMCE's own dialogs (z-index ~1300).
    const backdrop = el('div', 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:20000;display:flex;align-items:center;justify-content:center;');
    const box = el('div', 'background:#fff;width:min(900px,94vw);height:min(640px,88vh);border-radius:8px;display:flex;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,.3);font:14px sans-serif;color:#222;');
    const head = el('div', 'display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid #e5e5e5;');
    const title = el('strong', 'font-size:16px;margin-right:auto;', 'Medien auswählen');
    const upBtn = el('button', BTN, '⬆ Ordner hoch');
    const uploadBtn = el('button', `${BTN}background:#53a8c7;color:#fff;border-color:#53a8c7;`, 'Hochladen');
    const closeBtn = el('button', BTN, 'Abbrechen');
    const crumb = el('div', 'padding:8px 16px;color:#666;font-size:13px;border-bottom:1px solid #f0f0f0;');
    const grid = el('div', 'flex:1;overflow:auto;padding:16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:12px;align-content:start;');
    head.append(title, upBtn, uploadBtn, closeBtn);
    box.append(head, crumb, grid);
    backdrop.append(box);
    document.body.append(backdrop);

    let current = '';
    const finish = (url: string | null) => {
      backdrop.remove();
      document.removeEventListener('keydown', onKey, true);
      resolve(url);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); finish(null); } };
    document.addEventListener('keydown', onKey, true);
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) finish(null); });
    closeBtn.onclick = () => finish(null);

    const tile = (label: string, onClick: () => void, thumb?: string, icon = '📁') => {
      const t = el('button', 'border:1px solid #e0e0e0;border-radius:6px;background:#fafafa;cursor:pointer;padding:6px;display:flex;flex-direction:column;align-items:center;gap:6px;min-height:130px;');
      t.title = label;
      if (thumb) {
        const img = el('img', 'width:100%;height:90px;object-fit:cover;border-radius:4px;background:#eee;');
        img.src = thumb;
        img.loading = 'lazy';
        t.append(img);
      } else {
        t.append(el('div', 'font-size:48px;line-height:90px;', icon));
      }
      t.append(el('span', 'font-size:12px;word-break:break-all;text-align:center;max-height:32px;overflow:hidden;', label));
      t.onclick = onClick;
      return t;
    };

    const load = (path: string) => {
      grid.replaceChildren(el('div', 'color:#888;', 'Lade...'));
      listFolder(path)
        .then((data) => {
          current = data.path || '';
          crumb.textContent = `/images/${current}`;
          upBtn.disabled = !current;
          upBtn.style.opacity = current ? '1' : '.4';
          const items: HTMLElement[] = [];
          data.folders.forEach((f) => items.push(tile(f.name, () => load(current ? `${current}/${f.name}` : f.name))));
          data.files
            .filter((f) => !imagesOnly || f.isImage)
            .forEach((f) => items.push(tile(f.name, () => finish(f.url), f.isImage ? f.url : undefined, '📄')));
          if (!items.length) items.push(el('div', 'color:#888;grid-column:1/-1;', 'Dieser Ordner ist leer.'));
          grid.replaceChildren(...items);
        })
        .catch((err) => grid.replaceChildren(el('div', 'color:#c00;', err.message)));
    };

    upBtn.onclick = () => load(current.split('/').slice(0, -1).join('/'));
    uploadBtn.onclick = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        uploadBtn.textContent = 'Lädt...';
        uploadEditorFile(file, file.name)
          .then(finish)
          .catch((err) => { alert(err.message); uploadBtn.textContent = 'Hochladen'; });
      };
      input.click();
    };

    load('');
  });
