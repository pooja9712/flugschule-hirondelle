import { useRef, useEffect, useMemo, useState, type DragEvent } from 'react';
import { useNotify } from 'react-admin';
import i18n from '../i18n';
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
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import UploadIcon from '@mui/icons-material/Upload';
import CloseIcon from '@mui/icons-material/Close';
import DescriptionIcon from '@mui/icons-material/Description';
import LinkIcon from '@mui/icons-material/Link';
import SearchIcon from '@mui/icons-material/Search';
import InputAdornment from '@mui/material/InputAdornment';
import Autocomplete from '@mui/material/Autocomplete';

// "Menü" - admin management for the header's top-level navigation items and
// their sub-items (Ausbildung > Schnupperkurs, etc.) AND the footer's flat
// link list, both backed by the same MenuItem/MenuSubItem models
// (menu.routes.ts), distinguished by MenuItem.location ("header" | "footer").
// Replaces what used to be hardcoded directly in Header.tsx/Footer.tsx.
// Drag-and-drop uses plain HTML5 drag events, no library. Registered as a
// CustomRoute at /admin/menu in AdminApp.tsx, right before Galerie in
// CustomMenu.tsx's Komponenten group.
//
// NOTHING on this page auto-saves: every edit to the menu structure (add,
// edit, delete, drag/reorder, nest, toggle Aktiv) only changes the local
// draft below. The whole tree is written to the database - and published to
// the live site - in one go when the admin clicks "Speichern" (POST
// /menu/save). "Verwerfen" reloads the last saved state.
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

interface PageOption { key: string; label: string; url: string }

// What is currently being dragged: an existing top-level item, an existing
// sub-item, or one or more pages from the left "Seiten" picker.
type DragSource =
  | { kind: 'item'; id: string }
  | { kind: 'sub'; parentId: string; id: string }
  | { kind: 'page'; entries: { label: string; url: string }[] };

// Where a drop lands. parentId null = the top level, otherwise inside that
// item's sub-items. targetId is the row hovered (null for the "append at
// the end" zones); "into" = nest under the hovered top-level item.
interface DropTarget {
  parentId: string | null;
  targetId: string | null;
  mode: 'before' | 'after' | 'into' | 'end';
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

// Temporary client-side id for entries not saved yet - the "new-" prefix
// tells POST /menu/save to let the database assign a real id instead.
const tempId = () => `new-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// Only the fields that actually matter for "has anything changed", so the
// dirty check isn't thrown off by order/createdAt/etc.
const serializeTree = (items: ItemRow[]) =>
  JSON.stringify(
    items.map((i) => ({
      id: i.id, label: i.label, url: i.url, target: i.target, published: i.published,
      subItems: i.subItems.map((s) => ({ id: s.id, label: s.label, url: s.url, target: s.target, imageUrl: s.imageUrl || '', published: s.published })),
    }))
  );

// The hand-built "fixed" pages (same set as Pages.tsx's own list), offered
// in the left "Seiten" picker alongside admin-created Seiten pages, so an
// admin can add an existing page to the menu by ticking a checkbox or
// dragging it into the Menüstruktur instead of retyping its URL - the same
// "pick from Pages" flow WordPress's own Appearance > Menus screen uses.
// This list is fetched from GET /api/fixed-page-duplicates/kinds (the same
// registry Pages.tsx reads) - NOT hardcoded here - so a new fixed page shows
// up in this picker automatically. Only kinds with `hasSettings: true` get
// their title/URL live-overridden from /api/fixed-page-settings below.
interface FixedPageKindInfo { kind: string; label: string; defaultUrl: string; hasSettings: boolean }

// --- Bilingual page search (left "Seiten" picker) ---
// Pages only have one (mostly German) title, so typing "contact" would never
// find "Kontakt". The search therefore also tries the other language's word:
// German<->English pairs come from the site's own i18n.ts texts (same key in
// "de" and "en", short values only) plus the manual list below for common
// menu words not covered there. Title AND URL are searched, so English slugs
// like /education match too.
const MANUAL_SEARCH_PAIRS: [string, string][] = [
  ['startseite', 'home'], ['kontakt', 'contact'], ['impressum', 'imprint'], ['impressum', 'legal notice'],
  ['datenschutz', 'privacy'], ['agb', 'terms'], ['ausbildung', 'training'], ['ausbildung', 'education'],
  ['reisen', 'travel'], ['reise', 'trip'], ['kalender', 'calendar'], ['buchung', 'booking'], ['anmeldung', 'registration'],
  ['termine', 'dates'], ['termine', 'events'], ['veranstaltung', 'event'], ['kurs', 'course'], ['preise', 'prices'],
  ['wetter', 'weather'], ['gelände', 'terrain'], ['fluggebiet', 'flying site'], ['galerie', 'gallery'], ['medien', 'media'],
  ['über uns', 'about'], ['infos', 'information'], ['neuigkeiten', 'news'], ['gutschein', 'voucher'], ['geschenk', 'gift'],
  ['fragen', 'faq'], ['ausrüstung', 'equipment'], ['schnupperkurs', 'trial course'], ['grundkurs', 'basic course'],
  ['höhenflug', 'high altitude'], ['sicherheit', 'safety'], ['lehrer', 'instructor'], ['fluglehrer', 'instructor'],
  ['anfahrt', 'directions'], ['laden', 'store'], ['warenkorb', 'cart'], ['konto', 'account'], ['bewertungen', 'reviews'],
  ['tandemflug', 'tandem flight'], ['leistungen', 'services'], ['unterkunft', 'accommodation'],
];

// Case-, accent- and umlaut-insensitive: "A"/"a", "Ä"/"ä"/"ae"/"a" and
// "ß"/"ss" all compare equal. Applied to both the query and the page text.
const normalizeSearch = (s: string) =>
  s
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const buildSearchPairs = (): [string, string][] => {
  const pairs: [string, string][] = [...MANUAL_SEARCH_PAIRS];
  // Only the navigation/footer link texts - the rest of i18n.ts is page
  // copy (sentences, form labels) that would just add noise.
  const de = i18n.getResourceBundle('de', 'translation') || {};
  const en = i18n.getResourceBundle('en', 'translation') || {};
  (['nav', 'footer'] as const).forEach((section) => {
    const a = de[section] || {};
    const b = en[section] || {};
    Object.keys(a).forEach((k) => {
      if (typeof a[k] === 'string' && typeof b[k] === 'string' && a[k].split(/\s+/).length <= 3) pairs.push([a[k], b[k]]);
    });
  });
  return pairs
    .map(([x, y]) => [normalizeSearch(x), normalizeSearch(y)] as [string, string])
    .filter(([x, y]) => x && y && x !== y);
};

// How well a page matches the query (higher = better, -1 = no match). Only
// STARTING letters count - the title (or URL) has to begin with what was
// typed, so "a" finds "Ausbildung" but not "Kontakt". Ranked: title first,
// then URL, then pages found via the German<->English translation (from 3
// letters on, e.g. "cont" -> "Kontakt").
const scorePage = (p: PageOption, query: string, pairs: [string, string][]): number => {
  const q = normalizeSearch(query);
  if (!q) return 0;
  const label = normalizeSearch(p.label);
  const slug = normalizeSearch(p.url);
  // Starting letters only - never a match in the middle of a word.
  if (label.startsWith(q)) return 100;
  if (slug.startsWith(q)) return 60;
  if (q.length < 3) return -1;
  let best = -1;
  pairs.forEach(([de, en]) => {
    const other = de.startsWith(q) ? en : en.startsWith(q) ? de : null;
    if (!other) return;
    if (label.startsWith(other)) best = Math.max(best, 40);
    else if (slug.startsWith(other)) best = Math.max(best, 30);
  });
  return best;
};

// Filters and ranks pages for the query; original order breaks ties.
const searchPages = (options: PageOption[], query: string, pairs: [string, string][]): PageOption[] => {
  if (!normalizeSearch(query)) return options;
  return options
    .map((p, i) => ({ p, i, score: scorePage(p, query, pairs) }))
    .filter((r) => r.score >= 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((r) => r.p);
};

export const MenuManager = () => {
  const notify = useNotify();
  const [location, setLocation] = useState<'header' | 'footer'>('header');
  const [items, setItems] = useState<ItemRow[]>([]);
  const [savedTree, setSavedTree] = useState('[]');
  const [loading, setLoading] = useState(true);
  // Every item starts closed; this tracks the ones the admin opened (or
  // that were opened automatically by dropping/adding a sub-item into them).
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemRow | null>(null);
  const [itemForm, setItemForm] = useState(emptyItemForm);

  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [subParentId, setSubParentId] = useState<string | null>(null);
  const [editingSubItem, setEditingSubItem] = useState<SubItemRow | null>(null);
  const [subItemForm, setSubItemForm] = useState(emptySubItemForm);
  const [uploadingSubItemImage, setUploadingSubItemImage] = useState(false);
  const subItemFileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  // The server's own "live tables differ from the published snapshot" flag
  // (e.g. a page was set to draft, which deactivates its menu entry via
  // menuSync.ts) - lets the admin publish that even with no local edits.
  const [serverDirty, setServerDirty] = useState(false);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);

  const localDirty = serializeTree(items) !== savedTree;
  const dirty = localDirty || serverDirty;

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

  const [drag, setDrag] = useState<DragSource | null>(null);
  const [over, setOver] = useState<DropTarget | null>(null);

  // --- "Menüpunkt hinzufügen" picker (left panel) ---
  const [fixedPageKinds, setFixedPageKinds] = useState<FixedPageKindInfo[]>([]);
  const [fixedPageSettings, setFixedPageSettings] = useState<Record<string, { slug: string | null; title: string }>>({});
  const [customPages, setCustomPages] = useState<PageOption[]>([]);
  const [duplicatePages, setDuplicatePages] = useState<PageOption[]>([]);
  const [selectedPageKeys, setSelectedPageKeys] = useState<Set<string>>(new Set());
  const [customLinkLabel, setCustomLinkLabel] = useState('');
  const [customLinkUrl, setCustomLinkUrl] = useState('');

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

  const fixedPages: PageOption[] = fixedPageKinds.map((d) => {
    const live = d.hasSettings ? fixedPageSettings[d.kind] : undefined;
    const label = live?.title || d.label;
    const url = d.kind === 'home' ? '/' : live?.slug ? `/${live.slug}` : d.defaultUrl;
    return { key: `fixed:${d.kind}`, label, url };
  });

  useEffect(() => {
    setSelectedPageKeys(new Set());
  }, [location]);

  const pageOptions = [...fixedPages, ...customPages, ...duplicatePages];

  const [pageSearch, setPageSearch] = useState('');
  const searchPairs = useMemo(buildSearchPairs, []);
  const visiblePageOptions = searchPages(pageOptions, pageSearch, searchPairs);

  const togglePageSelected = (key: string) => {
    setSelectedPageKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Warn before closing/reloading the tab with unsaved menu changes.
  useEffect(() => {
    if (!localDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [localDirty]);

  // --- Load / save ---

  const fetchPublishStatus = () => {
    fetch(`/api/menu/publish-status?location=${location}`, { headers: authHeaders() })
      .then((res) => { if (res.ok) return res.json(); flagIfSessionExpired(res); return null; })
      .then((data) => {
        if (!data) return;
        setServerDirty(!!data.dirty);
        setPublishedAt(data.publishedAt);
      })
      .catch(() => {});
  };

  const fetchItems = () => {
    setLoading(true);
    fetch(`/api/menuitems?location=${location}`, { headers: authHeaders() })
      .then((res) => { if (res.ok) return res.json(); flagIfSessionExpired(res); return []; })
      .then((data) => {
        const tree: ItemRow[] = Array.isArray(data) ? data : [];
        setItems(tree);
        setSavedTree(serializeTree(tree));
      })
      .catch(() => notify('Fehler beim Laden des Menüs', { type: 'error' }))
      .finally(() => setLoading(false));
    fetchPublishStatus();
  };

  useEffect(fetchItems, [location]);

  // The ONLY place menu changes are persisted: writes the whole draft tree
  // and publishes it to the live site in one request.
  const saveMenu = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/menu/save', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ location, items }),
      });
      if (!res.ok) throw new Error(describeApiError(res, 'Fehler beim Speichern'));
      const tree: ItemRow[] = await res.json();
      setItems(tree);
      setSavedTree(serializeTree(tree));
      notify(location === 'header' ? 'Hauptmenü gespeichert' : 'Footer-Links gespeichert', { type: 'success' });
      fetchPublishStatus();
    } catch (e: any) {
      notify(e.message || 'Fehler beim Speichern', { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const discardChanges = () => {
    if (!window.confirm('Alle ungespeicherten Änderungen verwerfen?')) return;
    fetchItems();
  };

  const switchLocation = (next: 'header' | 'footer') => {
    if (localDirty && !window.confirm('Es gibt ungespeicherte Änderungen. Wechseln und Änderungen verwerfen?')) return;
    setLocation(next);
    setExpanded({});
  };

  const toggleExpanded = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  const isExpanded = (id: string) => location === 'header' && !!expanded[id];

  // --- Local tree helpers (none of these touch the server) ---

  const newItem = (entry: { label: string; url: string; target?: string; published?: boolean }): ItemRow => ({
    id: tempId(), label: entry.label, url: entry.url, target: entry.target || '_self',
    published: entry.published ?? true, order: 0, subItems: [],
  });

  const newSub = (parentId: string, entry: { label: string; url: string; target?: string; imageUrl?: string | null; published?: boolean }): SubItemRow => ({
    id: tempId(), menuItemId: parentId, label: entry.label, url: entry.url, target: entry.target || '_self',
    imageUrl: entry.imageUrl || null, published: entry.published ?? true, order: 0,
  });

  const addEntriesToMenu = (entries: { label: string; url: string }[]) => {
    if (entries.length === 0) return;
    setItems((prev) => [...prev, ...entries.map((e) => newItem(e))]);
  };

  const addSelectedPages = () => {
    const entries = pageOptions.filter((p) => selectedPageKeys.has(p.key)).map((p) => ({ label: p.label, url: p.url }));
    if (entries.length === 0) {
      notify('Bitte mindestens eine Seite auswählen.', { type: 'warning' });
      return;
    }
    addEntriesToMenu(entries);
    setSelectedPageKeys(new Set());
  };

  const addCustomLink = () => {
    if (!customLinkLabel.trim() || !customLinkUrl.trim()) {
      notify('Bitte Link-Text und URL eingeben.', { type: 'warning' });
      return;
    }
    addEntriesToMenu([{ label: customLinkLabel.trim(), url: customLinkUrl.trim() }]);
    setCustomLinkLabel('');
    setCustomLinkUrl('');
  };

  // Applies one drag-and-drop to the local tree: lifts the dragged entry out
  // of wherever it was (or creates new ones for dragged pages), then drops
  // it at the target - as a top-level item or as a sub-item, converting
  // between the two as needed. The menu is only 2 levels deep, so an item
  // that has its own sub-items can't become a sub-item itself.
  const applyDrop = (source: DragSource, target: DropTarget) => {
    if (source.kind === 'item' && target.parentId === null && target.targetId === source.id) return;
    if (source.kind === 'sub' && target.targetId === source.id) return;
    if (source.kind === 'item' && target.parentId === source.id) return;

    const intoSubs = target.parentId !== null || target.mode === 'into';
    const movingItem = source.kind === 'item' ? items.find((i) => i.id === source.id) : undefined;
    if (intoSubs && movingItem && movingItem.subItems.length > 0) {
      notify(`"${movingItem.label}" hat eigene Untermenüpunkte und kann nicht selbst zu einem Untermenüpunkt werden.`, { type: 'warning' });
      return;
    }

    // 1. Lift the moving entries out of the tree.
    let tree = items.map((i) => ({ ...i, subItems: [...i.subItems] }));
    let moving: { id: string; label: string; url: string; target: string; published: boolean; imageUrl?: string | null; subItems?: SubItemRow[] }[] = [];
    if (source.kind === 'item') {
      const found = tree.find((i) => i.id === source.id);
      if (!found) return;
      moving = [found];
      tree = tree.filter((i) => i.id !== source.id);
    } else if (source.kind === 'sub') {
      const parent = tree.find((i) => i.id === source.parentId);
      const found = parent?.subItems.find((s) => s.id === source.id);
      if (!parent || !found) return;
      moving = [found];
      parent.subItems = parent.subItems.filter((s) => s.id !== source.id);
    } else {
      moving = source.entries.map((e) => ({ id: tempId(), label: e.label, url: e.url, target: '_self', published: true }));
    }

    // 2. Drop them at the target.
    if (!intoSubs) {
      const asItems: ItemRow[] = moving.map((m) => ({
        id: m.id, label: m.label, url: m.url, target: m.target, published: m.published, order: 0,
        subItems: m.subItems || [],
      }));
      let pos = tree.length;
      if (target.targetId) {
        const idx = tree.findIndex((i) => i.id === target.targetId);
        if (idx >= 0) pos = target.mode === 'after' ? idx + 1 : idx;
      }
      tree.splice(pos, 0, ...asItems);
    } else {
      const parentId = target.parentId ?? target.targetId;
      const parent = tree.find((i) => i.id === parentId);
      if (!parent) return;
      const asSubs: SubItemRow[] = moving.map((m) => ({
        id: m.id, menuItemId: parent.id, label: m.label, url: m.url, target: m.target,
        imageUrl: m.imageUrl || null, published: m.published, order: 0,
      }));
      let pos = parent.subItems.length;
      if (target.parentId !== null && target.targetId) {
        const idx = parent.subItems.findIndex((s) => s.id === target.targetId);
        if (idx >= 0) pos = target.mode === 'after' ? idx + 1 : idx;
      }
      parent.subItems.splice(pos, 0, ...asSubs);
      setExpanded((prev) => ({ ...prev, [parent.id]: true }));
    }
    setItems(tree);
  };

  const startDrag = (e: DragEvent<HTMLElement>, source: DragSource) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    // Firefox won't start a drag without some data set.
    e.dataTransfer.setData('text/plain', '');
    // Deferred on purpose: setting it synchronously re-renders mid-dragstart
    // (drop zones appear, the row fades, layout shifts), and Chrome aborts a
    // drag whose DOM changes during dragstart - the drag ended instantly.
    setTimeout(() => setDrag(source), 0);
  };

  const endDrag = () => { setDrag(null); setOver(null); };

  const handleDragOver = (e: DragEvent<HTMLElement>, target: DropTarget) => {
    e.preventDefault();
    if (!drag) return;
    e.dataTransfer.dropEffect = 'move';
    e.stopPropagation();
    if (over?.parentId !== target.parentId || over?.targetId !== target.targetId || over?.mode !== target.mode) setOver(target);
  };

  const handleDrop = (e: DragEvent<HTMLElement>, target: DropTarget) => {
    e.preventDefault();
    e.stopPropagation();
    if (drag) applyDrop(drag, target);
    endDrag();
  };

  // Where within a top-level row the pointer is decides what dropping there
  // does: top/bottom edge = place before/after it, middle band = nest into
  // it as a sub-item. The footer never nests (flat list), so it just splits
  // the row in half.
  const topRowMode = (e: DragEvent<HTMLElement>): 'before' | 'after' | 'into' => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientY - rect.top) / rect.height;
    if (location === 'footer') return ratio < 0.5 ? 'before' : 'after';
    if (ratio < 0.25) return 'before';
    if (ratio > 0.75) return 'after';
    return 'into';
  };

  const subRowMode = (e: DragEvent<HTMLElement>): 'before' | 'after' => {
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientY - rect.top < rect.height / 2 ? 'before' : 'after';
  };

  const indicatorSx = (parentId: string | null, targetId: string | null) => {
    if (!over || over.parentId !== parentId || over.targetId !== targetId) return {};
    if (over.mode === 'into' || over.mode === 'end') return { boxShadow: (t: any) => `inset 0 0 0 2px ${t.palette.primary.main}`, bgcolor: 'action.hover' };
    if (over.mode === 'before') return { boxShadow: (t: any) => `inset 0 3px 0 0 ${t.palette.primary.main}` };
    return { boxShadow: (t: any) => `inset 0 -3px 0 0 ${t.palette.primary.main}` };
  };

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

  const applyItemDialog = () => {
    if (!itemForm.label.trim()) {
      notify('Bitte einen Titel eingeben.', { type: 'warning' });
      return;
    }
    const form = { ...itemForm, label: itemForm.label.trim(), url: itemForm.url.trim() };
    if (editingItem) {
      setItems((prev) => prev.map((i) => (i.id === editingItem.id ? { ...i, ...form } : i)));
    } else {
      setItems((prev) => [...prev, newItem(form)]);
    }
    setItemDialogOpen(false);
  };

  const deleteItem = (item: ItemRow) => {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  };

  const togglePublishedItem = (item: ItemRow) => {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, published: !i.published } : i)));
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

  // The image file itself has to be uploaded to get a URL, but the menu
  // entry only remembers it once "Speichern" is clicked.
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

  const applySubItemDialog = () => {
    if (!subItemForm.label.trim() || !subParentId) {
      notify('Bitte einen Titel eingeben.', { type: 'warning' });
      return;
    }
    const form = { ...subItemForm, label: subItemForm.label.trim(), url: subItemForm.url.trim() };
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== subParentId) return i;
        if (editingSubItem) {
          return { ...i, subItems: i.subItems.map((s) => (s.id === editingSubItem.id ? { ...s, ...form, imageUrl: form.imageUrl || null } : s)) };
        }
        return { ...i, subItems: [...i.subItems, newSub(i.id, form)] };
      })
    );
    setExpanded((prev) => ({ ...prev, [subParentId]: true }));
    setSubDialogOpen(false);
  };

  const deleteSubItem = (parentId: string, sub: SubItemRow) => {
    setItems((prev) => prev.map((i) => (i.id === parentId ? { ...i, subItems: i.subItems.filter((s) => s.id !== sub.id) } : i)));
  };

  const togglePublishedSubItem = (parentId: string, sub: SubItemRow) => {
    setItems((prev) =>
      prev.map((i) => (i.id === parentId ? { ...i, subItems: i.subItems.map((s) => (s.id === sub.id ? { ...s, published: !s.published } : s)) } : i))
    );
  };

  // "Seite auswählen" in both dialogs: fills URL (and the title, if still
  // empty) from an existing page instead of typing it by hand.
  // Searchable with the same German/English matching as the left picker.
  const pagePicker = (onPick: (p: PageOption) => void) => (
    <Autocomplete
      options={pageOptions}
      value={null}
      blurOnSelect
      getOptionLabel={(p) => p.label}
      isOptionEqualToValue={(a, b) => a.key === b.key}
      filterOptions={(opts, { inputValue }) => searchPages(opts, inputValue, searchPairs)}
      noOptionsText="Keine passende Seite gefunden"
      onChange={(_, p) => { if (p) onPick(p); }}
      renderOption={(props, p) => (
        <li {...props} key={p.key}>
          {p.label}
          <Typography component="span" variant="caption" sx={{ color: '#999', ml: 1 }}>{p.url}</Typography>
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Seite suchen / auswählen (optional)"
          helperText="Übernimmt URL und Titel einer bestehenden Seite - oder unten eine eigene URL eingeben."
        />
      )}
    />
  );

  const showDropZones = !!drag;

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

      <Tabs value={location} onChange={(_, v) => switchLocation(v)} sx={{ mb: 2, borderBottom: '1px solid #e0e0e0' }}>
        <Tab label="Header" value="header" />
        <Tab label="Footer" value="footer" />
      </Tabs>

      {/* Kontaktangaben am Ende des mobilen Menüs (Header.tsx's Sidebar-Menü,
          unter der Navigation) - hat einen eigenen Speichern-Button, da es
          nur dieses eine Feld-Set ist. */}
      {location === 'header' && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Kontaktangaben im mobilen Menü</Typography>
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
            "Add menu items" panel: tick pages and add them, or drag a page
            straight into the Menüstruktur (onto an item's middle = as its
            Untermenüpunkt). */}
        <Paper variant="outlined" sx={{ width: { xs: '100%', md: 320 }, flexShrink: 0, p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>Menüpunkt hinzufügen</Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <DescriptionIcon fontSize="small" sx={{ color: '#666' }} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>Seiten</Typography>
          </Box>
          <TextField
            fullWidth size="small" placeholder="Seite suchen / Search page"
            value={pageSearch}
            onChange={(e) => setPageSearch(e.target.value)}
            sx={{ mb: 1 }}
            slotProps={{
              input: {
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                endAdornment: pageSearch ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setPageSearch('')}><CloseIcon fontSize="small" /></IconButton>
                  </InputAdornment>
                ) : undefined,
              },
            }}
          />
          <Box sx={{ maxHeight: 260, overflowY: 'auto', border: '1px solid #eee', borderRadius: '6px', mb: 1.5 }}>
            {visiblePageOptions.length === 0 && (
              <Typography variant="body2" sx={{ color: '#999', p: 1.5 }}>
                {pageSearch ? 'Keine passende Seite gefunden.' : 'Keine Seiten gefunden.'}
              </Typography>
            )}
            {visiblePageOptions.map((p) => (
              <Box
                key={p.key}
                draggable
                onDragStart={(e) => {
                  // Dragging a ticked page drags all ticked pages together.
                  const entries = selectedPageKeys.has(p.key)
                    ? pageOptions.filter((o) => selectedPageKeys.has(o.key)).map((o) => ({ label: o.label, url: o.url }))
                    : [{ label: p.label, url: p.url }];
                  startDrag(e, { kind: 'page', entries });
                }}
                onDragEnd={endDrag}
                sx={{ display: 'flex', alignItems: 'center', px: 0.5, cursor: 'grab', '&:hover': { bgcolor: '#f7f7f7' } }}
              >
                <DragIndicatorIcon sx={{ color: '#ccc' }} fontSize="small" />
                <Checkbox size="small" checked={selectedPageKeys.has(p.key)} onChange={() => togglePageSelected(p.key)} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.label}</Typography>
                  <Typography variant="caption" sx={{ color: '#999', display: 'block', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.url}</Typography>
                </Box>
              </Box>
            ))}
          </Box>

          <Button
            fullWidth variant="outlined" size="small"
            onClick={addSelectedPages}
            disabled={selectedPageKeys.size === 0}
          >
            Zum Menü hinzufügen
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
            disabled={!customLinkLabel.trim() || !customLinkUrl.trim()}
          >
            Zum Menü hinzufügen
          </Button>
        </Paper>

        {/* Right panel - "Menüstruktur": the current ordered/nested tree. */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Menüstruktur</Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={openCreateItem}>
              {location === 'header' ? 'Manueller Eintrag' : 'Manueller Footer-Link'}
            </Button>
          </Box>
          {/* Nothing in the Menüstruktur is saved until "Speichern" is
              clicked - that single click writes the whole menu and puts it
              live (POST /menu/save). */}
          <Paper
            variant="outlined"
            sx={{
              display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, mb: 1,
              bgcolor: dirty ? '#fff8e1' : '#f6f8f6',
              borderColor: dirty ? '#f0c14b' : undefined,
            }}
          >
            <Typography variant="body2" sx={{ flex: 1, color: dirty ? '#8a6d1f' : '#557a5e' }}>
              {localDirty
                ? 'Ungespeicherte Änderungen - erst nach Klick auf "Speichern" übernommen.'
                : serverDirty
                ? 'Die Webseite zeigt noch einen älteren Stand.'
                : (publishedAt ? 'Alle Änderungen gespeichert.' : 'Noch nichts gespeichert.')}
            </Typography>
            {localDirty && (
              <Button size="small" onClick={discardChanges} disabled={saving}>Verwerfen</Button>
            )}
            <Button
              variant="contained"
              color={dirty ? 'warning' : 'success'}
              size="small"
              onClick={saveMenu}
              disabled={saving || !dirty}
            >
              {saving ? 'Wird gespeichert...' : 'Speichern'}
            </Button>
          </Paper>

          {loading && items.length === 0 && (
            <Typography sx={{ mt: 3, color: '#999' }}>Lädt...</Typography>
          )}

          {!loading && items.length === 0 && !showDropZones && (
            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', color: '#999', mt: 2 }}>
              {location === 'header' ? 'Noch keine Menüpunkte vorhanden.' : 'Noch keine Footer-Links vorhanden.'}
            </Paper>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
            {items.map((item) => (
              <Paper
                key={item.id}
                variant="outlined"
                sx={{ opacity: drag?.kind === 'item' && drag.id === item.id ? 0.4 : 1 }}
              >
                <Box
                  draggable
                  onDragStart={(e) => startDrag(e, { kind: 'item', id: item.id })}
                  onDragEnd={endDrag}
                  onDragOver={(e) => handleDragOver(e, { parentId: null, targetId: item.id, mode: topRowMode(e) })}
                  onDrop={(e) => handleDrop(e, { parentId: null, targetId: item.id, mode: topRowMode(e) })}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1, p: 1.5, borderRadius: 1,
                    transition: 'box-shadow 0.1s, background-color 0.1s',
                    ...indicatorSx(null, item.id),
                  }}
                >
                  <DragIndicatorIcon sx={{ color: '#aaa', cursor: 'grab' }} fontSize="small" />
                  {location === 'header' && (
                    <IconButton size="small" onClick={() => toggleExpanded(item.id)}>
                      {isExpanded(item.id) ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
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
                    "removeChild" DOM error. */}
                <Collapse in={isExpanded(item.id)} timeout="auto" unmountOnExit>
                  <Box sx={{ pl: 6, pr: 2, pb: 2 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {item.subItems.map((sub) => (
                        <Box
                          key={sub.id}
                          draggable
                          onDragStart={(e) => startDrag(e, { kind: 'sub', parentId: item.id, id: sub.id })}
                          onDragEnd={endDrag}
                          onDragOver={(e) => handleDragOver(e, { parentId: item.id, targetId: sub.id, mode: subRowMode(e) })}
                          onDrop={(e) => handleDrop(e, { parentId: item.id, targetId: sub.id, mode: subRowMode(e) })}
                          sx={{
                            display: 'flex', alignItems: 'center', gap: 1, p: 1,
                            border: '1px solid #eee', borderRadius: '6px', bgcolor: '#fff',
                            opacity: drag?.kind === 'sub' && drag.id === sub.id ? 0.4 : 1,
                            ...indicatorSx(item.id, sub.id),
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
                          <Switch size="small" checked={sub.published} onChange={() => togglePublishedSubItem(item.id, sub)} />
                          <IconButton size="small" onClick={() => openEditSubItem(item.id, sub)} title="Bearbeiten"><EditIcon fontSize="small" /></IconButton>
                          <IconButton size="small" onClick={() => deleteSubItem(item.id, sub)} title="Löschen"><DeleteIcon fontSize="small" color="error" /></IconButton>
                        </Box>
                      ))}
                      {/* Append-at-the-end drop zone - also the only drop
                          target when an item has no sub-items yet. */}
                      {(item.subItems.length === 0 || showDropZones) && (
                        <Box
                          onDragOver={(e) => handleDragOver(e, { parentId: item.id, targetId: null, mode: 'end' })}
                          onDrop={(e) => handleDrop(e, { parentId: item.id, targetId: null, mode: 'end' })}
                          sx={{
                            p: 1, border: '1px dashed #ccc', borderRadius: '6px', textAlign: 'center',
                            ...indicatorSx(item.id, null),
                          }}
                        >
                          <Typography variant="caption" sx={{ color: '#999' }}>
                            {showDropZones ? 'Hierher ziehen, um als Untermenüpunkt einzufügen' : 'Keine Untermenüpunkte - Seite oder Menüpunkt hierher ziehen'}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                    <Button size="small" startIcon={<AddIcon />} sx={{ mt: 1 }} onClick={() => openCreateSubItem(item.id)}>
                      Untermenüpunkt hinzufügen
                    </Button>
                  </Box>
                </Collapse>
              </Paper>
            ))}

            {/* Top-level append zone - shown while dragging, so a sub-item or
                page can be dropped at the very end of the menu. */}
            {showDropZones && (
              <Box
                onDragOver={(e) => handleDragOver(e, { parentId: null, targetId: null, mode: 'end' })}
                onDrop={(e) => handleDrop(e, { parentId: null, targetId: null, mode: 'end' })}
                sx={{
                  p: 2, border: '2px dashed #ccc', borderRadius: '6px', textAlign: 'center',
                  ...indicatorSx(null, null),
                }}
              >
                <Typography variant="body2" sx={{ color: '#999' }}>
                  {location === 'header' ? 'Hierher ziehen, um als eigenen Menüpunkt am Ende einzufügen' : 'Hierher ziehen, um am Ende einzufügen'}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      {/* Top-level item dialog - applies to the local draft only. */}
      <Dialog open={itemDialogOpen} onClose={() => setItemDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          {location === 'header'
            ? (editingItem ? 'Menüpunkt bearbeiten' : 'Neuer Menüpunkt')
            : (editingItem ? 'Footer-Link bearbeiten' : 'Neuer Footer-Link')}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
          {pagePicker((p) => setItemForm((prev) => ({ ...prev, url: p.url, label: prev.label.trim() ? prev.label : p.label })))}
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setItemDialogOpen(false)}>Abbrechen</Button>
          <Button variant="contained" onClick={applyItemDialog}>Übernehmen</Button>
        </DialogActions>
      </Dialog>

      {/* Sub-item dialog - applies to the local draft only. */}
      <Dialog open={subDialogOpen} onClose={() => setSubDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingSubItem ? 'Untermenüpunkt bearbeiten' : 'Neuer Untermenüpunkt'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
          {pagePicker((p) => setSubItemForm((prev) => ({ ...prev, url: p.url, label: prev.label.trim() ? prev.label : p.label })))}
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
          <Box>
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSubDialogOpen(false)}>Abbrechen</Button>
          <Button variant="contained" onClick={applySubItemDialog} disabled={uploadingSubItemImage}>Übernehmen</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
