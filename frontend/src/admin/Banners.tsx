import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  IconButton,
  CircularProgress,
  TextField as MuiTextField,
  Switch,
  Tooltip,
  Autocomplete,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import UploadIcon from '@mui/icons-material/Upload';
import CloseIcon from '@mui/icons-material/Close';
import ImageIcon from '@mui/icons-material/Image';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { useNotify } from 'react-admin';
import { FIXED_PAGE_KINDS } from '../data/fixedPageKinds';

// Werbebanner, rebuilt as a custom two-group manager instead of a flat
// react-admin CRUD list of 71 individual rows (one per image) - the site
// only ever has two real slideshow slots (see Banner.tsx: "home" - the
// home page's own banner, "subpage" - every other page's shared banner),
// so this mirrors that directly: an overview with one card per slot, and
// clicking a card opens a thumbnail-grid manager (same interaction model
// as Gallery.tsx's GalleryImagesInput) with upload, drag-to-reorder,
// per-tile hide/show, title/link editing and delete - the "add, remove,
// hide, reorder" operations requested, all on the real AdBanner rows via
// the existing /api/banners REST routes (still one row per image; there's
// no single JSON-array field here to bind a form to, so this talks to the
// API directly instead of going through react-admin's data provider).
//
// On top of those 2 fixed slots: named banners the admin creates
// independently ("+ Neues Banner erstellen") and assigns to one or several
// pages at once (BannerGroup/BannerPageLink, see schema.prisma and
// bannerGroups.routes.ts) - replaces the earlier "pick a page first, then
// its banner" flow, which required a page to exist before a banner could
// be made for it and never let one banner cover more than one page.
interface AdBannerRow {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl?: string | null;
  position: string;
  published: boolean;
  order: number;
}

interface BannerGroupRow {
  id: string;
  name: string;
  builtIn: boolean;
  imageCount: number;
  thumb: string | null;
  pageKeys: string[];
}

const BUILT_IN_INFO: Record<string, { label: string; description: string }> = {
  home: {
    label: 'Startseite',
    description: 'Slideshow ganz oben auf der Startseite - Titel wird als Bildunterschrift angezeigt.',
  },
  subpage: {
    label: 'Andere Seiten',
    description: 'Gemeinsame Slideshow für alle übrigen Seiten (ohne eigenes Banner) - Titel wird hier nirgends angezeigt.',
  },
};

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('auth')}` });

const fetchBannersForPosition = async (position: string): Promise<AdBannerRow[]> => {
  const res = await fetch(`/api/banners?position=${position}&_sort=order&_order=ASC&_end=1000`, {
    headers: authHeaders(),
  });
  if (!res.ok) return [];
  return res.json();
};

const fetchGroups = async (): Promise<BannerGroupRow[]> => {
  const res = await fetch('/api/banner-groups', { headers: authHeaders() });
  if (!res.ok) return [];
  return res.json();
};

interface PageOption {
  kind: string;
  title: string;
}

// Shared by the overview (unused now, kept for the manage screen's "Seiten
// zuweisen" picker) and previously the old page-first flow.
const usePageOptions = () => {
  const notify = useNotify();
  const [pageOptions, setPageOptions] = useState<PageOption[]>(FIXED_PAGE_KINDS);
  useEffect(() => {
    fetch('/api/pages?_start=0&_end=200', { headers: authHeaders() })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const seiten: PageOption[] = Array.isArray(data)
          ? data.map((p: any) => ({ kind: p.slug, title: p.title }))
          : [];
        setPageOptions([...FIXED_PAGE_KINDS, ...seiten]);
      })
      .catch(() => notify('Seiten konnten nicht geladen werden', { type: 'warning' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return pageOptions;
};

// Landing screen at /admin/banners - the 2 built-in slots, then every
// admin-created named banner, each as its own card showing a live
// thumbnail + image count + how many pages currently show it.
export const BannerGroupsOverview = () => {
  const navigate = useNavigate();
  const notify = useNotify();
  const [groups, setGroups] = useState<BannerGroupRow[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = () => {
    fetchGroups().then(setGroups);
  };
  useEffect(load, []);

  const builtIns = (groups || []).filter((g) => g.builtIn);
  const custom = (groups || []).filter((g) => !g.builtIn);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const res = await fetch('/api/banner-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Fehler beim Erstellen');
      setCreateOpen(false);
      setNewName('');
      navigate(`/admin/banners/manage/${data.id}`);
    } catch (err: any) {
      notify(err.message || 'Fehler beim Erstellen', { type: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, group: BannerGroupRow) => {
    e.stopPropagation();
    if (!window.confirm(`"${group.name}" wirklich löschen? Alle seine Bilder werden entfernt und betroffene Seiten zeigen wieder "Andere Seiten".`)) return;
    const res = await fetch(`/api/banner-groups/${group.id}`, { method: 'DELETE', headers: authHeaders() });
    if (res.ok) {
      notify('Banner gelöscht', { type: 'success' });
      load();
    } else {
      notify('Fehler beim Löschen', { type: 'error' });
    }
  };

  const renderCard = (group: BannerGroupRow, deletable: boolean) => (
    <Box
      key={group.id}
      onClick={() => navigate(`/admin/banners/manage/${group.id}`)}
      sx={{
        width: 320,
        border: '1px solid #e0e0e0',
        borderRadius: '10px',
        overflow: 'hidden',
        cursor: 'pointer',
        bgcolor: '#fff',
        position: 'relative',
        transition: 'box-shadow 0.15s, transform 0.15s',
        '&:hover': { boxShadow: '0 4px 16px rgba(0,0,0,0.12)', transform: 'translateY(-2px)' },
      }}
    >
      <Box sx={{ height: 160, bgcolor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {group.thumb ? (
          <Box component="img" src={group.thumb} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <ImageIcon sx={{ fontSize: 40, color: '#bbb' }} />
        )}
      </Box>
      {deletable && (
        <IconButton
          size="small"
          onClick={(e) => handleDelete(e, group)}
          title="Banner löschen"
          sx={{
            position: 'absolute', top: 8, right: 8,
            bgcolor: 'rgba(0,0,0,0.55)', color: '#fff', '&:hover': { bgcolor: 'rgba(200,0,0,0.8)' },
          }}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      )}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {BUILT_IN_INFO[group.id]?.label || group.name}
          </Typography>
          <Typography variant="caption" sx={{ color: '#888' }}>
            {group.imageCount} Bild{group.imageCount === 1 ? '' : 'er'}
            {!group.builtIn && ` · ${group.pageKeys.length} Seite${group.pageKeys.length === 1 ? '' : 'n'}`}
          </Typography>
        </Box>
        <ChevronRightIcon sx={{ color: '#999', flexShrink: 0 }} />
      </Box>
    </Box>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ mb: 0.5 }}>Werbebanner</Typography>
      <Typography variant="body2" sx={{ color: '#666', mb: 3 }}>
        Die Startseite und alle übrigen Seiten haben jeweils eine eigene Bilder-Slideshow - hier auswählen, um
        Bilder hinzuzufügen, zu entfernen, auszublenden oder neu anzuordnen.
      </Typography>
      {groups === null ? (
        <CircularProgress size={24} />
      ) : (
        <>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 4 }}>
            {builtIns.map((g) => renderCard(g, false))}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="h6">Eigene Banner</Typography>
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
              Neues Banner erstellen
            </Button>
          </Box>
          {custom.length === 0 ? (
            <Box sx={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
              py: 4, border: '1px dashed #ccc', borderRadius: '8px', color: '#999',
            }}>
              <ImageIcon fontSize="large" />
              <Typography variant="body2">Noch keine eigenen Banner erstellt.</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {custom.map((g) => renderCard(g, true))}
            </Box>
          )}
        </>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Neues Banner erstellen</DialogTitle>
        <DialogContent>
          <MuiTextField
            autoFocus
            label="Name des Banners"
            fullWidth
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            sx={{ mt: 1 }}
            placeholder="z. B. Sommer-Aktion"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Abbrechen</Button>
          <Button variant="contained" disabled={!newName.trim() || creating} onClick={handleCreate}>
            {creating ? 'Erstellt...' : 'Erstellen'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// One thumbnail tile in the manager grid below - image, drag handle,
// hide/show switch, inline title/link fields (revealed via the edit
// icon so the grid stays compact by default) and a remove button.
const BannerTile = ({
  banner,
  index,
  isHomeGroup,
  dragIndex,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onTogglePublished,
  onFieldSave,
  onRemove,
}: {
  banner: AdBannerRow;
  index: number;
  isHomeGroup: boolean;
  dragIndex: number | null;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onTogglePublished: (banner: AdBannerRow) => void;
  onFieldSave: (banner: AdBannerRow, field: 'title' | 'linkUrl', value: string) => void;
  onRemove: (banner: AdBannerRow) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState(banner.title);
  const [linkUrl, setLinkUrl] = useState(banner.linkUrl || '');

  return (
    <Box
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      sx={{
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        overflow: 'hidden',
        bgcolor: '#fff',
        opacity: dragIndex === index ? 0.4 : banner.published ? 1 : 0.55,
      }}
    >
      <Box sx={{ position: 'relative', aspectRatio: '16 / 9', cursor: 'grab', bgcolor: '#f5f5f5' }}>
        <Box component="img" src={banner.imageUrl} alt={banner.title} loading="lazy" sx={{
          width: '100%', height: '100%', objectFit: 'cover', display: 'block',
        }} />
        <IconButton
          size="small"
          onClick={() => onRemove(banner)}
          sx={{
            position: 'absolute', top: 4, right: 4,
            bgcolor: 'rgba(0,0,0,0.6)', color: '#fff', '&:hover': { bgcolor: 'rgba(200,0,0,0.8)' },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
        {!banner.published && (
          <Box sx={{
            position: 'absolute', bottom: 0, left: 0, right: 0, bgcolor: 'rgba(0,0,0,0.65)',
            color: '#fff', fontSize: '11px', textAlign: 'center', py: 0.25,
          }}>
            Ausgeblendet
          </Box>
        )}
      </Box>
      <Box sx={{ p: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5 }}>
          <Typography
            variant="body2"
            onClick={() => setExpanded((e) => !e)}
            sx={{ cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}
            title="Klicken zum Bearbeiten"
          >
            {banner.title || <em style={{ color: '#999' }}>Ohne Titel</em>}
          </Typography>
          <Tooltip title={banner.published ? 'Sichtbar - klicken zum Ausblenden' : 'Ausgeblendet - klicken zum Anzeigen'}>
            <Switch size="small" checked={banner.published} onChange={() => onTogglePublished(banner)} />
          </Tooltip>
        </Box>
        {expanded && (
          <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <MuiTextField
              label={isHomeGroup ? 'Titel (Bildunterschrift)' : 'Titel (nur intern, keine Bildunterschrift)'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => { if (title !== banner.title) onFieldSave(banner, 'title', title); }}
              size="small"
              fullWidth
            />
            <MuiTextField
              label="Ziel-Link (optional)"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onBlur={() => { if (linkUrl !== (banner.linkUrl || '')) onFieldSave(banner, 'linkUrl', linkUrl); }}
              size="small"
              fullWidth
            />
          </Box>
        )}
      </Box>
    </Box>
  );
};

// "Seiten zuweisen" - only shown for a custom (non-built-in) banner: which
// pages currently show THIS banner. Claiming a page here steals it away
// from whatever banner (if any) had it before, server-side
// (bannerGroups.routes.ts PUT /:id/pages) - a page can only show one
// banner at a time.
const PageAssignment = ({ groupId }: { groupId: string }) => {
  const notify = useNotify();
  const pageOptions = usePageOptions();
  const [selected, setSelected] = useState<PageOption[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/banner-groups/${groupId}/pages`, { headers: authHeaders() })
      .then((res) => (res.ok ? res.json() : []))
      .then((keys: string[]) => setSelected(keys.map((k) => pageOptions.find((p) => p.kind === k) || { kind: k, title: k })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, pageOptions.length]);

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/banner-groups/${groupId}/pages`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ pageKeys: selected.map((p) => p.kind) }),
      });
      if (!res.ok) throw new Error();
      notify('Seiten gespeichert', { type: 'success' });
    } catch {
      notify('Fehler beim Speichern', { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ mb: 3, p: 2, border: '1px solid #e0e0e0', borderRadius: '8px', bgcolor: '#fafafa' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>Seiten zuweisen</Typography>
      <Typography variant="body2" sx={{ color: '#666', mb: 1.5 }}>
        Auf welchen Seiten dieses Banner angezeigt wird - mehrere Seiten gleichzeitig möglich. Eine Seite zeigt
        immer nur ein Banner; wird sie hier hinzugefügt, verliert sie automatisch ihr vorheriges eigenes Banner.
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <Autocomplete
          multiple
          options={pageOptions}
          getOptionLabel={(o) => o.title}
          isOptionEqualToValue={(a, b) => a.kind === b.kind}
          value={selected || []}
          onChange={(_, value) => setSelected(value)}
          loading={selected === null}
          sx={{ minWidth: 360, flex: 1 }}
          renderInput={(params) => <MuiTextField {...params} label="Seiten" size="small" />}
        />
        <Button variant="contained" size="small" disabled={saving || selected === null} onClick={handleSave}>
          {saving ? 'Speichert...' : 'Speichern'}
        </Button>
      </Box>
    </Box>
  );
};

// The manager itself, at /admin/banners/manage/:position.
export const BannerGroupManager = () => {
  const { position } = useParams<{ position: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const notify = useNotify();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [banners, setBanners] = useState<AdBannerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [group, setGroup] = useState<BannerGroupRow | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const isHomeGroup = position === 'home';
  const isBuiltIn = position === 'home' || position === 'subpage';
  // Query param from the overview's old nav, kept only as an instant label
  // before the real fetch below resolves - avoids a blank-title flash.
  const queryTitle = searchParams.get('title');

  const load = () => {
    if (!position) return;
    setLoading(true);
    fetchBannersForPosition(position).then((rows) => {
      setBanners(rows);
      setLoading(false);
    });
  };

  useEffect(load, [position]);

  useEffect(() => {
    if (!position) return;
    fetchGroups().then((groups) => {
      const found = groups.find((g) => g.id === position);
      if (found) setGroup(found);
    });
  }, [position]);

  const uploadOne = async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', headers: authHeaders(), body: formData });
      const data = await res.json();
      if (res.ok) return data.url;
      notify(data.message || `Fehler beim Upload von ${file.name}`, { type: 'warning' });
      return null;
    } catch {
      notify(`Netzwerkfehler beim Upload von ${file.name}`, { type: 'warning' });
      return null;
    }
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0 || !position) return;
    setUploading(true);
    const uploaded = await Promise.all(Array.from(files).map(uploadOne));
    const successUrls = uploaded.filter((u): u is string => !!u);
    await Promise.all(
      successUrls.map((imageUrl, i) =>
        fetch('/api/banners', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({
            title: '',
            imageUrl,
            position,
            order: banners.length + i,
            published: true,
          }),
        })
      )
    );
    if (successUrls.length > 0) {
      notify(successUrls.length === 1 ? 'Bild hinzugefügt' : `${successUrls.length} Bilder hinzugefügt`, { type: 'success' });
      load();
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleTogglePublished = async (banner: AdBannerRow) => {
    setBanners((prev) => prev.map((b) => (b.id === banner.id ? { ...b, published: !b.published } : b)));
    await fetch(`/api/banners/${banner.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ published: !banner.published }),
    });
  };

  const handleFieldSave = async (banner: AdBannerRow, field: 'title' | 'linkUrl', value: string) => {
    setBanners((prev) => prev.map((b) => (b.id === banner.id ? { ...b, [field]: value } : b)));
    await fetch(`/api/banners/${banner.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ [field]: value }),
    });
    notify('Gespeichert', { type: 'success' });
  };

  const handleRemove = async (banner: AdBannerRow) => {
    setBanners((prev) => prev.filter((b) => b.id !== banner.id));
    await fetch(`/api/banners/${banner.id}`, { method: 'DELETE', headers: authHeaders() });
    notify('Bild entfernt', { type: 'success' });
  };

  // Persists the whole new order (every row's `order` set to its new
  // index) - simplest correct approach for a list this size (well under
  // 100 rows even for the fuller "home" group).
  const persistOrder = async (ordered: AdBannerRow[]) => {
    await Promise.all(
      ordered.map((b, i) =>
        b.order === i
          ? Promise.resolve()
          : fetch(`/api/banners/${b.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', ...authHeaders() },
              body: JSON.stringify({ order: i }),
            })
      )
    );
  };

  const moveTo = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= banners.length || to >= banners.length) return;
    const next = [...banners];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setBanners(next);
    persistOrder(next);
  };

  const startRename = () => {
    setNameDraft(group?.name || '');
    setRenaming(true);
  };

  const saveRename = async () => {
    const name = nameDraft.trim();
    if (!name || !position) { setRenaming(false); return; }
    const res = await fetch(`/api/banner-groups/${position}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setGroup((g) => (g ? { ...g, name } : g));
      notify('Name gespeichert', { type: 'success' });
    } else {
      notify('Fehler beim Speichern', { type: 'error' });
    }
    setRenaming(false);
  };

  const handleDeleteGroup = async () => {
    if (!position || isBuiltIn) return;
    if (!window.confirm('Dieses Banner wirklich löschen? Alle seine Bilder werden entfernt und betroffene Seiten zeigen wieder "Andere Seiten".')) return;
    const res = await fetch(`/api/banner-groups/${position}`, { method: 'DELETE', headers: authHeaders() });
    if (res.ok) {
      notify('Banner gelöscht', { type: 'success' });
      navigate('/admin/banners');
    } else {
      notify('Fehler beim Löschen', { type: 'error' });
    }
  };

  const title = BUILT_IN_INFO[position || '']?.label || group?.name || queryTitle || position;
  const description = BUILT_IN_INFO[position || '']?.description
    || 'Eigenes Banner - weist du unten einer oder mehreren Seiten zu. Eine Seite ohne eigenes Banner zeigt weiterhin "Andere Seiten".';

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <IconButton onClick={() => navigate('/admin/banners')} title="Zurück zur Übersicht">
          <ArrowBackIcon />
        </IconButton>
        {renaming ? (
          <>
            <MuiTextField
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') setRenaming(false); }}
              size="small"
              autoFocus
            />
            <Button size="small" variant="contained" onClick={saveRename}>Speichern</Button>
            <Button size="small" onClick={() => setRenaming(false)}>Abbrechen</Button>
          </>
        ) : (
          <>
            <Typography variant="h5">{title}</Typography>
            {!isBuiltIn && (
              <IconButton size="small" onClick={startRename} title="Umbenennen">
                <EditIcon fontSize="small" />
              </IconButton>
            )}
          </>
        )}
        {!isBuiltIn && (
          <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
            <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={handleDeleteGroup}>
              Banner löschen
            </Button>
          </Box>
        )}
      </Box>
      <Typography variant="body2" sx={{ color: '#666', mb: 3, ml: 6 }}>
        {description}
      </Typography>

      {!isBuiltIn && position && <PageAssignment groupId={position} />}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Button
          variant="contained"
          size="small"
          startIcon={uploading ? <CircularProgress size={16} color="inherit" /> : <UploadIcon />}
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? 'Lädt hoch...' : 'Bilder hochladen'}
        </Button>
        <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={(e) => handleFilesSelected(e.target.files)} />
        <Typography variant="body2" sx={{ color: '#666' }}>
          {banners.length === 0 ? 'Noch keine Bilder' : `${banners.length} Bild${banners.length === 1 ? '' : 'er'} - per Ziehen neu anordnen`}
        </Typography>
      </Box>

      {loading ? (
        <CircularProgress size={24} />
      ) : banners.length === 0 ? (
        <Box sx={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
          py: 6, border: '1px dashed #ccc', borderRadius: '8px', color: '#999',
        }}>
          <ImageIcon fontSize="large" />
          <Typography variant="body2">Für diese Slideshow wurden noch keine Bilder hinzugefügt.</Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
          {banners.map((banner, index) => (
            <BannerTile
              key={banner.id}
              banner={banner}
              index={index}
              isHomeGroup={isHomeGroup}
              dragIndex={dragIndex}
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex !== null) moveTo(dragIndex, index);
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              onTogglePublished={handleTogglePublished}
              onFieldSave={handleFieldSave}
              onRemove={handleRemove}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};
