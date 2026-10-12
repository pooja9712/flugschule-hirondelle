import { useRef, useEffect, useState, type DragEvent } from 'react';
import { useNotify } from 'react-admin';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem as SelectMenuItem,
  Paper,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import UploadIcon from '@mui/icons-material/Upload';
import CloseIcon from '@mui/icons-material/Close';
import DescriptionIcon from '@mui/icons-material/Description';
import LinkIcon from '@mui/icons-material/Link';

// "Menü" - admin management for the header's top-level navigation items and
// their sub-items (Ausbildung > Schnupperkurs, etc.) AND the footer's flat
// link list, both backed by the same MenuItem/MenuSubItem models
// (menu.routes.ts), distinguished by MenuItem.location ("header" | "footer").
// Replaces what used to be hardcoded directly in Header.tsx/Footer.tsx.
// Drag-and-drop reordering mirrors Gallery.tsx's GalleryImagesInput (plain
// HTML5 drag events, no library). Registered as a CustomRoute at /admin/menu
// in AdminApp.tsx, right before Galerie in CustomMenu.tsx's Komponenten
// group.
//
// Footer items never have sub-items (the footer is a flat link list, not a
// dropdown nav), so the "Header"/"Footer" tab below hides all sub-item UI
// while on the Footer tab.
//
// Shop, the "Seiten" dropdown (auto-populated from admin-created pages) and
// the Konto/login menu are NOT managed here - they stay hardcoded in
// Header.tsx since they carry auth/e-commerce behavior beyond a label+link.

interface SubItemRow {
  id: string;
  menuItemId: string;
  label: string;
  url: string;
  target: string;
  imageUrl?: string | null;
  published: boolean;
  order: number;
}

interface ItemRow {
  id: string;
  label: string;
  url: string;
  target: string;
  published: boolean;
  order: number;
  subItems: SubItemRow[];
}

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('auth')}`,
  'Content-Type': 'application/json',
});

const describeApiError = (res: Response, fallback: string): string => {
  if (res.status === 401 || res.status === 403) return 'Sitzung abgelaufen - bitte neu anmelden und erneut versuchen.';
  return fallback;
};

const emptyItemForm = { label: '', url: '', target: '_self', published: true };
const emptySubItemForm = { label: '', url: '', target: '_self', imageUrl: '', published: true };

// The hand-built "fixed" pages (same set as Pages.tsx's own list), offered
// in the left "Seiten" picker alongside admin-created Seiten pages, so an
// admin can add an existing page to the menu by ticking a checkbox instead
// of retyping its URL - the same "pick from Pages" flow WordPress's own
// Appearance > Menus screen uses. This list is fetched from GET
// /api/fixed-page-duplicates/kinds (the same registry Pages.tsx reads) -
// NOT hardcoded here - so a new fixed page (e.g. a future /infos/* sub-page)
// shows up in this picker automatically the moment it's added to that
// registry, with nothing in this file to update. Only kinds with
// `hasSettings: true` get their title/URL live-overridden from
// /api/fixed-page-settings below (a rename, e.g. Ausbildung -> "Training"
// at /education) - the rest always use their fixed `defaultUrl`.
interface FixedPageKindInfo { kind: string; label: string; defaultUrl: string; hasSettings: boolean }

export const MenuManager = () => {
  const notify = useNotify();
  const [location, setLocation] = useState<'header' | 'footer'>('header');
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemRow | null>(null);
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [savingItem, setSavingItem] = useState(false);

  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [subParentId, setSubParentId] = useState<string | null>(null);
  const [editingSubItem, setEditingSubItem] = useState<SubItemRow | null>(null);
  const [subItemForm, setSubItemForm] = useState(emptySubItemForm);
  const [savingSubItem, setSavingSubItem] = useState(false);
  const [uploadingSubItemImage, setUploadingSubItemImage] = useState(false);
  const subItemFileInputRef = useRef<HTMLInputElement>(null);

  const [dirty, setDirty] = useState(false);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  // None of this page's many fetches used to distinguish a 401/403 (expired
  // login, tokens last 1 day) from "there's genuinely nothing here yet" -
  // they all just fell back to an empty array/list on any non-ok response,
  // so an expired session silently showed "No menu items/pages available"
  // instead of a clear "please log back in", indistinguishable from actual
  // data loss. Set by any of the fetches below hitting 401/403.
  const [sessionExpired, setSessionExpired] = useState(false);

  // --- Mobile-Menü Kontaktangaben (Header.tsx's mobile drawer footer) ---
  const [contactInfo, setContactInfo] = useState({ siteName: '', addressLine1: '', addressLine2: '', phone: '', email: '' });
  const [contactLoading, setContactLoading] = useState(true);
  const [contactSaving, setContactSaving] = useState(false);

  // Flags sessionExpired instead of just falling through to the caller's
  // own empty-state fallback, for a 401/403 specifically - any other
  // non-ok response still just falls back silently, same as before.
  const flagIfSessionExpired = (res: Response) => {
    if (res.status === 401 || res.status === 403) setSessionExpired(true);
  };

  useEffect(() => {
    fetch('/api/header-contact', { headers: authHeaders() })
      .then((res) => {
        if (res.ok) return res.json();
        flagIfSessionExpired(res);
        return null;
      })
      .then((data) => {
        if (data) setContactInfo({ siteName: data.siteName, addressLine1: data.addressLine1, addressLine2: data.addressLine2, phone: data.phone, email: data.email });
      })
      .catch(() => notify('Fehler beim Laden der Kontaktangaben', { type: 'error' }))
      .finally(() => setContactLoading(false));
  }, []);

  const saveContactInfo = async () => {
    setContactSaving(true);
    try {
      const res = await fetch('/api/header-contact', { method: 'PUT', headers: authHeaders(), body: JSON.stringify(contactInfo) });
      if (!res.ok) throw new Error(describeApiError(res, 'Fehler beim Speichern'));
      notify('Kontaktangaben gespeichert', { type: 'success' });
    } catch (e: any) {
      notify(e.message || 'Fehler beim Speichern', { type: 'error' });
    } finally {
      setContactSaving(false);
    }
  };

  const [dragItemIndex, setDragItemIndex] = useState<number | null>(null);
  const [dragSubItem, setDragSubItem] = useState<{ parentId: string; index: number } | null>(null);
  // Feedback for what dropping onto a top-level item's row will do: reorder
  // before/after it, or ("into") nest the dragged item/sub-item as one of
  // its own Untermenüpunkte. Computed live from the pointer's vertical
  // position within the row during dragover.
  const [overTarget, setOverTarget] = useState<{ index: number; mode: 'before' | 'after' | 'into' } | null>(null);

  // --- "Menüpunkt hinzufügen" picker (left panel) ---
  const [fixedPageKinds, setFixedPageKinds] = useState<FixedPageKindInfo[]>([]);
  const [fixedPageSettings, setFixedPageSettings] = useState<Record<string, { slug: string | null; title: string }>>({});
  const [customPages, setCustomPages] = useState<{ key: string; label: string; url: string }[]>([]);
  const [duplicatePages, setDuplicatePages] = useState<{ key: string; label: string; url: string }[]>([]);
  const [selectedPageKeys, setSelectedPageKeys] = useState<Set<string>>(new Set());
  const [customLinkLabel, setCustomLinkLabel] = useState('');
  const [customLinkUrl, setCustomLinkUrl] = useState('');
  const [addingSelected, setAddingSelected] = useState(false);
  const [addingCustomLink, setAddingCustomLink] = useState(false);

  // The full fixed-page registry (see fixedPageDuplicates.routes.ts's
  // GET /kinds) - every kind listed there appears in the picker below, so a
  // newly-added fixed page needs no change in this file.
  useEffect(() => {
    fetch('/api/fixed-page-duplicates/kinds', { headers: authHeaders() })
      .then((res) => { if (res.ok) return res.json(); flagIfSessionExpired(res); return []; })
      .then((data: FixedPageKindInfo[]) => setFixedPageKinds(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Live title/URL for kinds with `hasSettings: true`, keyed by kind - same
  // source Pages.tsx itself reads (fetchFixedSettings), so a renamed fixed
  // page (e.g. Ausbildung -> "Training" at /education via "Seiten-
  // Einstellungen") shows up here with its actual current title/URL instead
  // of the default.
  useEffect(() => {
    fetch('/api/fixed-page-settings', { headers: authHeaders() })
      .then((res) => { if (res.ok) return res.json(); flagIfSessionExpired(res); return []; })
      .then((data: { kind: string; slug: string | null; title: string }[]) => {
        const byKind: Record<string, { slug: string | null; title: string }> = {};
        (Array.isArray(data) ? data : []).forEach((row) => { byKind[row.kind] = row; });
        setFixedPageSettings(byKind);
      })
      .catch(() => {});
  }, []);

  // Same admin endpoint Admin > Seiten (Pages.tsx) itself lists from, so
  // every custom-created page shown there - published or draft, nav-visible
  // or not - appears in this picker too, not just the subset /pages/public
  // exposes for the live site's own "Seiten" dropdown. "home" is excluded
  // since it's covered by the Startseite fixed-page entry above.
  useEffect(() => {
    fetch('/api/pages?_start=0&_end=200', { headers: authHeaders() })
      .then((res) => { if (res.ok) return res.json(); flagIfSessionExpired(res); return []; })
      .then((data: { slug: string; title: string; navLabel?: string | null }[]) => {
        setCustomPages(
          (Array.isArray(data) ? data : [])
            .filter((p) => p.slug !== 'home')
            .map((p) => ({ key: `page:${p.slug}`, label: p.navLabel || p.title, url: `/${p.slug}` }))
        );
      })
      .catch(() => {});
  }, []);

  // A "Duplizieren" copy of one of the 6 fixed pages (Pages.tsx > Seiten,
  // rendered by FixedPageRouter.tsx at its own slug) is stored as a
  // FixedPageDuplicate, NOT a Page row - Admin > Seiten lists both in one
  // table, so this picker needs both too, or a duplicated page (like
  // "testtttt") would silently be missing from it.
  useEffect(() => {
    fetch('/api/fixed-page-duplicates', { headers: authHeaders() })
      .then((res) => { if (res.ok) return res.json(); flagIfSessionExpired(res); return []; })
      .then((data: { slug: string; title: string; navLabel?: string | null }[]) => {
        setDuplicatePages(
          (Array.isArray(data) ? data : []).map((d) => ({ key: `dup:${d.slug}`, label: d.navLabel || d.title, url: `/${d.slug}` }))
        );
      })
      .catch(() => {});
  }, []);

  const fixedPages = fixedPageKinds.map((d) => {
    const live = d.hasSettings ? fixedPageSettings[d.kind] : undefined;
    const label = live?.title || d.label;
    const url = d.kind === 'home' ? '/' : live?.slug ? `/${live.slug}` : d.defaultUrl;
    return { key: `fixed:${d.kind}`, label, url };
  });

  useEffect(() => {
    setSelectedPageKeys(new Set());
  }, [location]);

  const pageOptions = [...fixedPages, ...customPages, ...duplicatePages];

  const togglePageSelected = (key: string) => {
    setSelectedPageKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Shared by both "add selected pages" and "add custom link": always
  // creates a new top-level MenuItem. Nesting an entry under another item as
  // a sub-item is still done from the Menüstruktur panel on the right (the
  // per-item "Untermenüpunkt hinzufügen" button), not from this picker.
  const addEntriesToMenu = async (entries: { label: string; url: string }[]) => {
    if (entries.length === 0) return;
    try {
      for (const entry of entries) {
        await fetch('/api/menuitems', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ label: entry.label, url: entry.url, target: '_self', published: true, location }),
        });
      }
      notify(entries.length === 1 ? 'Zum Menü hinzugefügt' : `${entries.length} Einträge zum Menü hinzugefügt`, { type: 'success' });
      fetchItems();
    } catch {
      notify('Fehler beim Hinzufügen', { type: 'error' });
    }
  };

  const addSelectedPages = async () => {
    const entries = pageOptions.filter((p) => selectedPageKeys.has(p.key)).map((p) => ({ label: p.label, url: p.url }));
    if (entries.length === 0) {
      notify('Bitte mindestens eine Seite auswählen.', { type: 'warning' });
      return;
    }
    setAddingSelected(true);
    await addEntriesToMenu(entries);
    setSelectedPageKeys(new Set());
    setAddingSelected(false);
  };

  const addCustomLink = async () => {
    if (!customLinkLabel.trim() || !customLinkUrl.trim()) {
      notify('Bitte Link-Text und URL eingeben.', { type: 'warning' });
      return;
    }
    setAddingCustomLink(true);
    await addEntriesToMenu([{ label: customLinkLabel.trim(), url: customLinkUrl.trim() }]);
    setCustomLinkLabel('');
    setCustomLinkUrl('');
    setAddingCustomLink(false);
  };

  const fetchItems = () => {
    setLoading(true);
    fetch(`/api/menuitems?location=${location}`, { headers: authHeaders() })
      .then((res) => { if (res.ok) return res.json(); flagIfSessionExpired(res); return []; })
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => notify('Fehler beim Laden des Menüs', { type: 'error' }))
      .finally(() => setLoading(false));
    fetchPublishStatus();
  };

  useEffect(fetchItems, [location]);

  // --- Publish (the live MenuItem/MenuSubItem tree above is what admin
  // edits always save to immediately - the PUBLIC site instead reads the
  // separate, explicitly-published MenuSnapshot, so none of those edits
  // reach the front-end until "Speichern" here. See menu.routes.ts. ---

  const fetchPublishStatus = () => {
    fetch(`/api/menu/publish-status?location=${location}`, { headers: authHeaders() })
      .then((res) => { if (res.ok) return res.json(); flagIfSessionExpired(res); return null; })
      .then((data) => {
        if (!data) return;
        setDirty(!!data.dirty);
        setPublishedAt(data.publishedAt);
      })
      .catch(() => {});
  };

  const publishMenu = async () => {
    setPublishing(true);
    try {
      const res = await fetch('/api/menu/publish', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ location }),
      });
      if (!res.ok) throw new Error(describeApiError(res, 'Fehler beim Veröffentlichen'));
      notify(location === 'header' ? 'Hauptmenü veröffentlicht' : 'Footer-Links veröffentlicht', { type: 'success' });
      fetchPublishStatus();
    } catch (e: any) {
      notify(e.message || 'Fehler beim Veröffentlichen', { type: 'error' });
    } finally {
      setPublishing(false);
    }
  };

  const toggleExpanded = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  // --- Top-level items ---

  const openCreateItem = () => {
    setEditingItem(null);
    setItemForm(emptyItemForm);
    setItemDialogOpen(true);
  };

  const openEditItem = (item: ItemRow) => {
    setEditingItem(item);
    setItemForm({ label: item.label, url: item.url, target: item.target, published: item.published });
    setItemDialogOpen(true);
  };

  const saveItem = async () => {
    if (!itemForm.label.trim()) {
      notify('Bitte einen Titel eingeben.', { type: 'warning' });
      return;
    }
    setSavingItem(true);
    try {
      const url = editingItem ? `/api/menuitems/${editingItem.id}` : '/api/menuitems';
      const method = editingItem ? 'PUT' : 'POST';
      const body = editingItem ? { ...itemForm, order: editingItem.order } : { ...itemForm, location };
      const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(body) });
      if (!res.ok) throw new Error(describeApiError(res, 'Fehler beim Speichern'));
      notify(editingItem ? 'Menüpunkt gespeichert' : 'Menüpunkt erstellt', { type: 'success' });
      setItemDialogOpen(false);
      fetchItems();
    } catch (e: any) {
      notify(e.message || 'Fehler beim Speichern', { type: 'error' });
    } finally {
      setSavingItem(false);
    }
  };

  const deleteItem = async (item: ItemRow) => {
    const confirmMsg = location === 'header'
      ? `"${item.label}" und alle seine Untermenüpunkte wirklich löschen?`
      : `"${item.label}" wirklich aus dem Footer löschen?`;
    if (!window.confirm(confirmMsg)) return;
    try {
      const res = await fetch(`/api/menuitems/${item.id}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) throw new Error(describeApiError(res, 'Fehler beim Löschen'));
      notify('Menüpunkt gelöscht', { type: 'success' });
      fetchItems();
    } catch (e: any) {
      notify(e.message || 'Fehler beim Löschen', { type: 'error' });
    }
  };

  const togglePublishedItem = async (item: ItemRow) => {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, published: !i.published } : i)));
    try {
      await fetch(`/api/menuitems/${item.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ label: item.label, url: item.url, target: item.target, published: !item.published, order: item.order }),
      });
      fetchPublishStatus();
    } catch {
      notify('Fehler beim Aktualisieren', { type: 'error' });
      fetchItems();
    }
  };

  const moveItem = async (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
    try {
      await fetch('/api/menuitems/reorder', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(next.map((i, idx) => ({ id: i.id, order: idx }))),
      });
      fetchPublishStatus();
    } catch {
      notify('Fehler beim Sortieren', { type: 'error' });
      fetchItems();
    }
  };

  // Drag a top-level item onto another top-level item's row (the middle
  // band, see computeDropMode below) to make it a sub-item of that item
  // instead of reordering it. Rejected server-side (with a clear message)
  // if the dragged item has its own sub-items already, since this menu is
  // only 2 levels deep.
  const nestItemUnder = async (source: ItemRow, target: ItemRow) => {
    try {
      const res = await fetch(`/api/menuitems/${source.id}/nest`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ targetId: target.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || describeApiError(res, 'Fehler beim Verschachteln'));
      notify(`"${source.label}" ist jetzt ein Untermenüpunkt von "${target.label}"`, { type: 'success' });
      setExpanded((prev) => ({ ...prev, [target.id]: true }));
      fetchItems();
    } catch (e: any) {
      notify(e.message || 'Fehler beim Verschachteln', { type: 'error' });
    }
  };

  // Drag a sub-item onto a DIFFERENT top-level item's row to move it into
  // that item's sub-items instead of its current parent's.
  const reparentSubItem = async (source: { parentId: string; index: number }, target: ItemRow) => {
    const parent = items.find((i) => i.id === source.parentId);
    const sub = parent?.subItems[source.index];
    if (!sub) return;
    try {
      const res = await fetch(`/api/menusubitems/${sub.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          label: sub.label, url: sub.url, target: sub.target, imageUrl: sub.imageUrl || '',
          published: sub.published, order: target.subItems.length, menuItemId: target.id,
        }),
      });
      if (!res.ok) throw new Error(describeApiError(res, 'Fehler beim Verschieben'));
      notify(`"${sub.label}" wurde zu "${target.label}" verschoben`, { type: 'success' });
      setExpanded((prev) => ({ ...prev, [target.id]: true }));
      fetchItems();
    } catch (e: any) {
      notify(e.message || 'Fehler beim Verschieben', { type: 'error' });
    }
  };

  // The reverse of nestItemUnder: pulls a sub-item back out to become its
  // own top-level item. Triggered from a button on the sub-item row rather
  // than a drag gesture (there's no obvious empty drop zone to drag it
  // onto), but shares the same backend "un-nest" idea.
  const promoteSubItem = async (sub: SubItemRow) => {
    try {
      const res = await fetch(`/api/menusubitems/${sub.id}/promote`, { method: 'POST', headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || describeApiError(res, 'Fehler beim Verschieben'));
      notify(`"${sub.label}" ist jetzt ein eigener Menüpunkt`, { type: 'success' });
      fetchItems();
    } catch (e: any) {
      notify(e.message || 'Fehler beim Verschieben', { type: 'error' });
    }
  };

  // Where within a top-level row the pointer is decides what dropping there
  // does: top/bottom edge = reorder before/after, middle band = nest into
  // it. A sub-item being dragged always means "nest here" (there's no
  // "reorder top-level items around a sub-item" concept), and the footer
  // tab never nests (footer is a flat list), so both skip the band split.
  const computeDropMode = (e: DragEvent<HTMLElement>): 'before' | 'after' | 'into' => {
    if (dragSubItem || location === 'footer') return dragSubItem ? 'into' : 'before';
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientY - rect.top) / rect.height;
    if (ratio < 0.25) return 'before';
    if (ratio > 0.75) return 'after';
    return 'into';
  };

  // --- Sub-items ---

  const openCreateSubItem = (parentId: string) => {
    setSubParentId(parentId);
    setEditingSubItem(null);
    setSubItemForm(emptySubItemForm);
    setSubDialogOpen(true);
  };

  const openEditSubItem = (parentId: string, sub: SubItemRow) => {
    setSubParentId(parentId);
    setEditingSubItem(sub);
    setSubItemForm({ label: sub.label, url: sub.url, target: sub.target, imageUrl: sub.imageUrl || '', published: sub.published });
    setSubDialogOpen(true);
  };

  const uploadSubItemImage = async (file: File) => {
    setUploadingSubItemImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('auth')}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setSubItemForm((prev) => ({ ...prev, imageUrl: data.url }));
      } else {
        notify(data.message || 'Fehler beim Hochladen', { type: 'warning' });
      }
    } catch {
      notify('Netzwerkfehler beim Hochladen', { type: 'warning' });
    } finally {
      setUploadingSubItemImage(false);
      if (subItemFileInputRef.current) subItemFileInputRef.current.value = '';
    }
  };

  const saveSubItem = async () => {
    if (!subItemForm.label.trim() || !subParentId) {
      notify('Bitte einen Titel eingeben.', { type: 'warning' });
      return;
    }
    setSavingSubItem(true);
    try {
      const url = editingSubItem ? `/api/menusubitems/${editingSubItem.id}` : '/api/menusubitems';
      const method = editingSubItem ? 'PUT' : 'POST';
      const body = editingSubItem
        ? { ...subItemForm, order: editingSubItem.order }
        : { ...subItemForm, menuItemId: subParentId };
      const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(body) });
      if (!res.ok) throw new Error(describeApiError(res, 'Fehler beim Speichern'));
      notify(editingSubItem ? 'Untermenüpunkt gespeichert' : 'Untermenüpunkt erstellt', { type: 'success' });
      setSubDialogOpen(false);
      fetchItems();
    } catch (e: any) {
      notify(e.message || 'Fehler beim Speichern', { type: 'error' });
    } finally {
      setSavingSubItem(false);
    }
  };

  const deleteSubItem = async (sub: SubItemRow) => {
    if (!window.confirm(`"${sub.label}" wirklich löschen?`)) return;
    try {
      const res = await fetch(`/api/menusubitems/${sub.id}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) throw new Error(describeApiError(res, 'Fehler beim Löschen'));
      notify('Untermenüpunkt gelöscht', { type: 'success' });
      fetchItems();
    } catch (e: any) {
      notify(e.message || 'Fehler beim Löschen', { type: 'error' });
    }
  };

  const togglePublishedSubItem = async (sub: SubItemRow) => {
    setItems((prev) =>
      prev.map((i) => ({
        ...i,
        subItems: i.subItems.map((s) => (s.id === sub.id ? { ...s, published: !s.published } : s)),
      }))
    );
    try {
      await fetch(`/api/menusubitems/${sub.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ label: sub.label, url: sub.url, target: sub.target, published: !sub.published, order: sub.order }),
      });
      fetchPublishStatus();
    } catch {
      notify('Fehler beim Aktualisieren', { type: 'error' });
      fetchItems();
    }
  };

  const moveSubItem = async (parentId: string, from: number, to: number) => {
    const parent = items.find((i) => i.id === parentId);
    if (!parent || from === to || from < 0 || to < 0 || from >= parent.subItems.length || to >= parent.subItems.length) return;
    const nextSubs = [...parent.subItems];
    const [moved] = nextSubs.splice(from, 1);
    nextSubs.splice(to, 0, moved);
    setItems((prev) => prev.map((i) => (i.id === parentId ? { ...i, subItems: nextSubs } : i)));
    try {
      await fetch('/api/menusubitems/reorder', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(nextSubs.map((s, idx) => ({ id: s.id, order: idx }))),
      });
      fetchPublishStatus();
    } catch {
      notify('Fehler beim Sortieren', { type: 'error' });
      fetchItems();
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ mb: 1 }}>
        <Typography variant="h5">Menü</Typography>
        <Typography variant="body2" sx={{ color: '#666' }}>
          {location === 'header'
            ? 'Verwaltet die Hauptnavigation der Webseite (Header) und ihre Untermenüpunkte.'
            : 'Verwaltet die Link-Liste im Footer der Webseite.'}
        </Typography>
      </Box>

      {sessionExpired && (
        <Alert severity="warning" sx={{ mb: 2 }} action={<Button color="inherit" size="small" href="/admin/login">Erneut einloggen</Button>}>
          Ihre Sitzung ist abgelaufen. Die leeren Listen unten bedeuten nicht, dass Menüpunkte/Seiten gelöscht wurden - bitte loggen Sie sich erneut ein und laden Sie die Seite neu.
        </Alert>
      )}

      <Tabs value={location} onChange={(_, v) => { setLocation(v); setExpanded({}); }} sx={{ mb: 2, borderBottom: '1px solid #e0e0e0' }}>
        <Tab label="Header" value="header" />
        <Tab label="Footer" value="footer" />
      </Tabs>

      {/* Every edit below (drag, toggle, add/edit/delete, nest/promote)
          saves immediately - but only to the working menu, not the live
          site. The live header/footer only picks up those changes once
          "Speichern" here publishes them (see loadPublicTree in
          menu.routes.ts), so an admin can freely rearrange things without
          it going live mid-edit. */}
      <Paper
        variant="outlined"
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, mb: 2,
          bgcolor: dirty ? '#fff8e1' : '#f6f8f6',
          borderColor: dirty ? '#f0c14b' : undefined,
        }}
      >
        <Typography variant="body2" sx={{ flex: 1, color: dirty ? '#8a6d1f' : '#557a5e' }}>
          {dirty
            ? (location === 'header' ? 'Das Hauptmenü hat ungespeicherte Änderungen - auf der Webseite ist noch der zuletzt veröffentlichte Stand zu sehen.' : 'Der Footer hat ungespeicherte Änderungen - auf der Webseite ist noch der zuletzt veröffentlichte Stand zu sehen.')
            : (publishedAt ? 'Veröffentlicht.' : 'Noch nichts veröffentlicht.')}
        </Typography>
        <Button
          variant="contained"
          color={dirty ? 'warning' : 'success'}
          size="small"
          onClick={publishMenu}
          disabled={publishing || !dirty}
        >
          {publishing ? 'Wird veröffentlicht...' : (location === 'header' ? 'Menü veröffentlichen' : 'Footer veröffentlichen')}
        </Button>
      </Paper>

      {/* Kontaktangaben am Ende des mobilen Menüs (Header.tsx's Sidebar-Menü,
          unter der Navigation) - Name/Adresse/Telefon/E-Mail waren bisher
          fest im Code hinterlegt. Speichert sofort (kein Entwurf/
          Veröffentlichen-Mechanismus wie bei der Menüstruktur oben), da es
          nur dieses eine Feld-Set ist. */}
      {location === 'header' && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>Kontaktangaben im mobilen Menü</Typography>
          <Typography variant="body2" sx={{ color: '#666', mb: 2 }}>
            Wird unten im aufklappbaren Menü auf dem Handy angezeigt (unter den Menüpunkten, über den Social-Icons).
          </Typography>
          {contactLoading ? (
            <Typography variant="body2" sx={{ color: '#999' }}>Lädt...</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 480 }}>
              <TextField
                label="Name" size="small" fullWidth
                value={contactInfo.siteName}
                onChange={(e) => setContactInfo({ ...contactInfo, siteName: e.target.value })}
              />
              <TextField
                label="Adresse Zeile 1" size="small" fullWidth placeholder="Weinheim, 69469,"
                value={contactInfo.addressLine1}
                onChange={(e) => setContactInfo({ ...contactInfo, addressLine1: e.target.value })}
              />
              <TextField
                label="Adresse Zeile 2" size="small" fullWidth placeholder="Deutschland"
                value={contactInfo.addressLine2}
                onChange={(e) => setContactInfo({ ...contactInfo, addressLine2: e.target.value })}
              />
              <TextField
                label="Telefon" size="small" fullWidth
                value={contactInfo.phone}
                onChange={(e) => setContactInfo({ ...contactInfo, phone: e.target.value })}
              />
              <TextField
                label="E-Mail" size="small" fullWidth
                value={contactInfo.email}
                onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })}
              />
              <Box>
                <Button variant="contained" size="small" onClick={saveContactInfo} disabled={contactSaving}>
                  {contactSaving ? 'Wird gespeichert...' : 'Speichern'}
                </Button>
              </Box>
            </Box>
          )}
        </Paper>
      )}

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexDirection: { xs: 'column', md: 'row' } }}>

        {/* Left panel - "Menüpunkt hinzufügen", mirrors WordPress's Appearance > Menus
            "Add menu items" panel: pick existing pages or type a custom link, then
            choose whether it becomes a new top-level entry or a sub-item of an
            existing one (header only - the footer is always a flat list). */}
        <Paper variant="outlined" sx={{ width: { xs: '100%', md: 320 }, flexShrink: 0, p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>Menüpunkt hinzufügen</Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <DescriptionIcon fontSize="small" sx={{ color: '#666' }} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>Seiten</Typography>
          </Box>
          <Box sx={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #eee', borderRadius: '6px', mb: 1.5 }}>
            {pageOptions.length === 0 && (
              <Typography variant="body2" sx={{ color: '#999', p: 1.5 }}>Keine Seiten gefunden.</Typography>
            )}
            {pageOptions.map((p) => (
              <Box key={p.key} sx={{ display: 'flex', alignItems: 'center', px: 0.5 }}>
                <Checkbox size="small" checked={selectedPageKeys.has(p.key)} onChange={() => togglePageSelected(p.key)} />
                <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.label}</Typography>
              </Box>
            ))}
          </Box>

          <Button
            fullWidth variant="outlined" size="small"
            onClick={addSelectedPages}
            disabled={addingSelected || selectedPageKeys.size === 0}
          >
            {addingSelected ? 'Wird hinzugefügt...' : 'Zum Menü hinzufügen'}
          </Button>

          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <LinkIcon fontSize="small" sx={{ color: '#666' }} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>Eigener Link</Typography>
          </Box>
          <TextField
            fullWidth size="small" label="URL" placeholder="https://... oder /pfad"
            value={customLinkUrl} onChange={(e) => setCustomLinkUrl(e.target.value)}
            sx={{ mb: 1 }}
          />
          <TextField
            fullWidth size="small" label="Link-Text"
            value={customLinkLabel} onChange={(e) => setCustomLinkLabel(e.target.value)}
            sx={{ mb: 1.5 }}
          />
          <Button
            fullWidth variant="outlined" size="small"
            onClick={addCustomLink}
            disabled={addingCustomLink || !customLinkLabel.trim() || !customLinkUrl.trim()}
          >
            {addingCustomLink ? 'Wird hinzugefügt...' : 'Zum Menü hinzufügen'}
          </Button>
        </Paper>

        {/* Right panel - "Menüstruktur": the current ordered/nested tree, drag to
            reorder within a level, expand a header item to manage its sub-items. */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Menüstruktur</Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={openCreateItem}>
              {location === 'header' ? 'Manueller Eintrag' : 'Manueller Footer-Link'}
            </Button>
          </Box>
          {location === 'header' && !loading && items.length > 0 && (
            <Typography variant="body2" sx={{ color: '#999', mb: 1 }}>
              Tipp: einen Menüpunkt auf die Mitte eines anderen ziehen, um ihn zu dessen Untermenüpunkt zu machen - auf den oberen/unteren Rand ziehen, um nur die Reihenfolge zu ändern.
            </Typography>
          )}

          {loading && items.length === 0 && (
            <Typography sx={{ mt: 3, color: '#999' }}>Lädt...</Typography>
          )}

          {!loading && items.length === 0 && (
            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', color: '#999', mt: 2 }}>
              {location === 'header' ? 'Noch keine Menüpunkte vorhanden.' : 'Noch keine Footer-Links vorhanden.'}
            </Paper>
          )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
        {items.map((item, index) => (
          <Paper
            key={item.id}
            variant="outlined"
            draggable
            onDragStart={() => setDragItemIndex(index)}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragItemIndex === index) return;
              setOverTarget({ index, mode: computeDropMode(e) });
            }}
            onDrop={(e) => {
              e.preventDefault();
              const mode = computeDropMode(e);
              if (dragSubItem) {
                if (dragSubItem.parentId !== item.id) reparentSubItem(dragSubItem, item);
              } else if (dragItemIndex !== null && dragItemIndex !== index) {
                if (mode === 'into') nestItemUnder(items[dragItemIndex], item);
                else moveItem(dragItemIndex, index);
              }
              setDragItemIndex(null);
              setDragSubItem(null);
              setOverTarget(null);
            }}
            onDragEnd={() => { setDragItemIndex(null); setDragSubItem(null); setOverTarget(null); }}
            sx={{
              opacity: dragItemIndex === index ? 0.4 : 1,
              transition: 'box-shadow 0.1s, background-color 0.1s',
              ...(overTarget?.index === index && overTarget.mode === 'into'
                ? { boxShadow: (t) => `inset 0 0 0 2px ${t.palette.primary.main}`, bgcolor: 'action.hover' }
                : overTarget?.index === index && overTarget.mode === 'before'
                ? { boxShadow: (t) => `inset 0 2px 0 0 ${t.palette.primary.main}` }
                : overTarget?.index === index && overTarget.mode === 'after'
                ? { boxShadow: (t) => `inset 0 -2px 0 0 ${t.palette.primary.main}` }
                : {}),
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5 }}>
              <DragIndicatorIcon sx={{ color: '#aaa', cursor: 'grab' }} fontSize="small" />
              {location === 'header' && (
                <IconButton size="small" onClick={() => toggleExpanded(item.id)}>
                  {expanded[item.id] ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                </IconButton>
              )}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{item.label}</Typography>
                <Typography variant="body2" sx={{ color: '#666' }}>
                  <span>{item.url || '—'}</span>
                  {location === 'header' && item.subItems.length > 0 && (
                    <span>{` · ${item.subItems.length} Untermenüpunkt${item.subItems.length === 1 ? '' : 'e'}`}</span>
                  )}
                </Typography>
              </Box>
              <FormControlLabel
                sx={{ mr: 0 }}
                control={<Switch size="small" checked={item.published} onChange={() => togglePublishedItem(item)} />}
                label={<Typography variant="body2">Aktiv</Typography>}
              />
              <IconButton size="small" onClick={() => openEditItem(item)} title="Bearbeiten"><EditIcon fontSize="small" /></IconButton>
              <IconButton size="small" onClick={() => deleteItem(item)} title="Löschen"><DeleteIcon fontSize="small" color="error" /></IconButton>
            </Box>

            {/* Always mounted (never conditionally removed from the tree) so
                switching the Header/Footer tab can't yank this out mid-
                animation while `in` is still true - that abrupt unmount is
                what crashes Collapse/react-transition-group with a
                "removeChild" DOM error. `in` itself already stays false for
                footer items since the expand chevron above is header-only. */}
            <Collapse in={location === 'header' && !!expanded[item.id]} timeout="auto" unmountOnExit>
              <Box sx={{ pl: 6, pr: 2, pb: 2 }}>
                {item.subItems.length === 0 && (
                  <Typography variant="body2" sx={{ color: '#999', mb: 1 }}>Keine Untermenüpunkte.</Typography>
                )}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {item.subItems.map((sub, subIndex) => (
                    <Box
                      key={sub.id}
                      draggable
                      onDragStart={(e) => { e.stopPropagation(); setDragSubItem({ parentId: item.id, index: subIndex }); }}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (dragSubItem && dragSubItem.parentId === item.id) moveSubItem(item.id, dragSubItem.index, subIndex);
                        setDragSubItem(null);
                      }}
                      onDragEnd={(e) => { e.stopPropagation(); setDragSubItem(null); }}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 1, p: 1,
                        border: '1px solid #eee', borderRadius: '6px',
                        opacity: dragSubItem?.parentId === item.id && dragSubItem.index === subIndex ? 0.4 : 1,
                      }}
                    >
                      <DragIndicatorIcon sx={{ color: '#ccc', cursor: 'grab' }} fontSize="small" />
                      {sub.imageUrl && (
                        <Box component="img" src={sub.imageUrl} alt="" sx={{ width: 36, height: 36, objectFit: 'cover', borderRadius: '4px', border: '1px solid #e0e0e0' }} />
                      )}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{sub.label}</Typography>
                        <Typography variant="caption" sx={{ color: '#888' }}>{sub.url || '—'}</Typography>
                      </Box>
                      <Switch size="small" checked={sub.published} onChange={() => togglePublishedSubItem(sub)} />
                      <IconButton size="small" onClick={() => promoteSubItem(sub)} title="Zu eigenem Menüpunkt machen"><ArrowUpwardIcon fontSize="small" /></IconButton>
                      <IconButton size="small" onClick={() => openEditSubItem(item.id, sub)} title="Bearbeiten"><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" onClick={() => deleteSubItem(sub)} title="Löschen"><DeleteIcon fontSize="small" color="error" /></IconButton>
                    </Box>
                  ))}
                </Box>
                <Button size="small" startIcon={<AddIcon />} sx={{ mt: 1 }} onClick={() => openCreateSubItem(item.id)}>
                  Untermenüpunkt hinzufügen
                </Button>
              </Box>
            </Collapse>
          </Paper>
        ))}
      </Box>
        </Box>
      </Box>

      {/* Top-level item dialog */}
      <Dialog open={itemDialogOpen} onClose={() => setItemDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          {location === 'header'
            ? (editingItem ? 'Menüpunkt bearbeiten' : 'Neuer Menüpunkt')
            : (editingItem ? 'Footer-Link bearbeiten' : 'Neuer Footer-Link')}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Titel" fullWidth autoFocus
            value={itemForm.label}
            onChange={(e) => setItemForm({ ...itemForm, label: e.target.value })}
          />
          <TextField
            label="URL" fullWidth placeholder="/ausbildung"
            helperText="Interner Pfad (z.B. /ausbildung) oder vollständige externe URL."
            value={itemForm.url}
            onChange={(e) => setItemForm({ ...itemForm, url: e.target.value })}
          />
          <TextField
            select label="Öffnen in" fullWidth
            value={itemForm.target}
            onChange={(e) => setItemForm({ ...itemForm, target: e.target.value })}
          >
            <SelectMenuItem value="_self">Gleicher Tab</SelectMenuItem>
            <SelectMenuItem value="_blank">Neuer Tab</SelectMenuItem>
          </TextField>
          <FormControlLabel
            control={<Switch checked={itemForm.published} onChange={(e) => setItemForm({ ...itemForm, published: e.target.checked })} />}
            label="Aktiv (im Menü sichtbar)"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setItemDialogOpen(false)}>Abbrechen</Button>
          <Button variant="contained" onClick={saveItem} disabled={savingItem}>Speichern</Button>
        </DialogActions>
      </Dialog>

      {/* Sub-item dialog */}
      <Dialog open={subDialogOpen} onClose={() => setSubDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingSubItem ? 'Untermenüpunkt bearbeiten' : 'Neuer Untermenüpunkt'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Titel" fullWidth autoFocus
            value={subItemForm.label}
            onChange={(e) => setSubItemForm({ ...subItemForm, label: e.target.value })}
          />
          <TextField
            label="URL" fullWidth placeholder="/ausbildung/schnupperkurs"
            helperText="Interner Pfad oder vollständige externe URL."
            value={subItemForm.url}
            onChange={(e) => setSubItemForm({ ...subItemForm, url: e.target.value })}
          />
          <TextField
            select label="Öffnen in" fullWidth
            value={subItemForm.target}
            onChange={(e) => setSubItemForm({ ...subItemForm, target: e.target.value })}
          >
            <SelectMenuItem value="_self">Gleicher Tab</SelectMenuItem>
            <SelectMenuItem value="_blank">Neuer Tab</SelectMenuItem>
          </TextField>

          <Box>
            <Typography variant="body2" sx={{ mb: 1, color: '#555' }}>
              Bild (optional - wenn ALLE Untermenüpunkte eines Menüpunkts ein Bild haben, wird dieser als Bilder-Menü wie "Reisen" dargestellt)
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {subItemForm.imageUrl ? (
                <Box sx={{ position: 'relative' }}>
                  <Box component="img" src={subItemForm.imageUrl} alt="" sx={{ width: 72, height: 72, objectFit: 'cover', borderRadius: '6px', border: '1px solid #e0e0e0' }} />
                  <IconButton
                    size="small"
                    onClick={() => setSubItemForm({ ...subItemForm, imageUrl: '' })}
                    sx={{ position: 'absolute', top: -8, right: -8, bgcolor: '#fff', border: '1px solid #ddd', '&:hover': { bgcolor: '#fee' } }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              ) : (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={uploadingSubItemImage ? <CircularProgress size={16} /> : <UploadIcon />}
                  disabled={uploadingSubItemImage}
                  onClick={() => subItemFileInputRef.current?.click()}
                >
                  {uploadingSubItemImage ? 'Lädt hoch...' : 'Bild hochladen'}
                </Button>
              )}
              <input
                ref={subItemFileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => e.target.files?.[0] && uploadSubItemImage(e.target.files[0])}
              />
            </Box>
          </Box>

          <FormControlLabel
            control={<Switch checked={subItemForm.published} onChange={(e) => setSubItemForm({ ...subItemForm, published: e.target.checked })} />}
            label="Aktiv (im Menü sichtbar)"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSubDialogOpen(false)}>Abbrechen</Button>
          <Button variant="contained" onClick={saveSubItem} disabled={savingSubItem}>Speichern</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
