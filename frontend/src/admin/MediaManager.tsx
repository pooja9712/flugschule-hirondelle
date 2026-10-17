import { useEffect, useState, Fragment } from 'react';
import { useNotify } from 'react-admin';
import {
    Box, Typography, IconButton, Tooltip, TextField, Button, Checkbox,
    Breadcrumbs, Link, CircularProgress, Dialog, DialogTitle, DialogContent,
    DialogActions, Collapse,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import UploadIcon from '@mui/icons-material/Upload';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import DeleteIcon from '@mui/icons-material/Delete';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HomeIcon from '@mui/icons-material/Home';

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('auth')}` });

type Entry = { name: string };
type FileEntry = { name: string; size: number; isImage: boolean; url: string };
type Listing = { path: string; folders: Entry[]; files: FileEntry[] };

async function fetchListing(relPath: string): Promise<Listing> {
    const res = await fetch(`/api/media?path=${encodeURIComponent(relPath)}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Ordner konnte nicht geladen werden');
    return res.json();
}

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Recursive, lazily-loaded sidebar folder tree - old's own "Lokal" tree only
// ever shows what's been expanded too, it doesn't eagerly fetch the whole
// filesystem up front.
const TreeNode = ({ relPath, name, currentPath, onNavigate, depth }: {
    relPath: string; name: string; currentPath: string; onNavigate: (p: string) => void; depth: number;
}) => {
    const [open, setOpen] = useState(false);
    const [children, setChildren] = useState<Entry[] | null>(null);
    const [loading, setLoading] = useState(false);
    const isActive = currentPath === relPath;
    const isAncestor = currentPath.startsWith(relPath + '/');

    const toggle = async () => {
        if (!open && children === null) {
            setLoading(true);
            try {
                const data = await fetchListing(relPath);
                setChildren(data.folders);
            } finally {
                setLoading(false);
            }
        }
        setOpen((o) => !o);
    };

    // Auto-expand (without re-navigating) when the current path is inside
    // this branch, so deep-linking / breadcrumb clicks keep the tree in sync.
    useEffect(() => {
        if (isAncestor && !open) {
            toggle();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPath]);

    return (
        <>
            <Box
                sx={{
                    display: 'flex', alignItems: 'center', gap: 0.5, pl: depth * 2, py: 0.5,
                    cursor: 'pointer', borderRadius: 1,
                    bgcolor: isActive ? '#e0f2fe' : 'transparent',
                    '&:hover': { bgcolor: isActive ? '#e0f2fe' : '#f1f5f9' },
                }}
            >
                <Box onClick={toggle} sx={{ display: 'flex', alignItems: 'center' }}>
                    {loading ? <CircularProgress size={14} /> : open ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                </Box>
                <FolderIcon fontSize="small" sx={{ color: '#64748b' }} />
                <Typography variant="body2" onClick={() => onNavigate(relPath)} sx={{ fontWeight: isActive ? 700 : 400 }}>
                    {name}
                </Typography>
            </Box>
            <Collapse in={open} unmountOnExit>
                {(children || []).map((c) => (
                    <TreeNode
                        key={c.name}
                        relPath={relPath ? `${relPath}/${c.name}` : c.name}
                        name={c.name}
                        currentPath={currentPath}
                        onNavigate={onNavigate}
                        depth={depth + 1}
                    />
                ))}
            </Collapse>
        </>
    );
};

export const MediaManager = () => {
    const notify = useNotify();
    const [currentPath, setCurrentPath] = useState('');
    const [listing, setListing] = useState<Listing | null>(null);
    const [loading, setLoading] = useState(false);
    const [rootFolders, setRootFolders] = useState<Entry[] | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState('');
    const [newFolderOpen, setNewFolderOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [uploading, setUploading] = useState(false);

    const load = async (p: string) => {
        setLoading(true);
        try {
            const data = await fetchListing(p);
            setListing(data);
            setSelected(new Set());
        } catch {
            notify('Ordner konnte nicht geladen werden', { type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(currentPath); }, [currentPath]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { fetchListing('').then((d) => setRootFolders(d.folders)).catch(() => {}); }, []);

    const navigate = (p: string) => setCurrentPath(p);

    const relOf = (name: string) => (currentPath ? `${currentPath}/${name}` : name);

    const toggleSelect = (name: string) => {
        setSelected((s) => {
            const next = new Set(s);
            if (next.has(name)) next.delete(name); else next.add(name);
            return next;
        });
    };

    const handleUpload = async (fileList: FileList | null) => {
        if (!fileList || fileList.length === 0) return;
        setUploading(true);
        try {
            const formData = new FormData();
            // 'path' must be appended before the files - the backend's multer
            // destination callback needs req.body.path already parsed, which
            // only works if this field is read from the stream first.
            formData.append('path', currentPath);
            Array.from(fileList).forEach((f) => formData.append('files', f));
            const res = await fetch('/api/media/upload', { method: 'POST', headers: authHeaders(), body: formData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            notify(data.message || 'Hochgeladen', { type: 'success' });
            load(currentPath);
        } catch (e: any) {
            notify(e.message || 'Upload fehlgeschlagen', { type: 'error' });
        } finally {
            setUploading(false);
        }
    };

    const createFolder = async () => {
        if (!newFolderName.trim()) return;
        try {
            const res = await fetch('/api/media/folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify({ path: currentPath, name: newFolderName.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            notify('Ordner erstellt', { type: 'success' });
            setNewFolderOpen(false);
            setNewFolderName('');
            setRootFolders(null);
            fetchListing('').then((d) => setRootFolders(d.folders)).catch(() => {});
            load(currentPath);
        } catch (e: any) {
            notify(e.message || 'Ordner konnte nicht erstellt werden', { type: 'error' });
        }
    };

    const deleteSelected = async () => {
        if (selected.size === 0) return;
        if (!window.confirm(`${selected.size} Element(e) wirklich löschen?`)) return;
        try {
            const res = await fetch('/api/media', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify({ paths: Array.from(selected).map(relOf) }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            notify(data.message || 'Gelöscht', { type: 'success' });
            setRootFolders(null);
            fetchListing('').then((d) => setRootFolders(d.folders)).catch(() => {});
            load(currentPath);
        } catch (e: any) {
            notify(e.message || 'Löschen fehlgeschlagen', { type: 'error' });
        }
    };

    const crumbs = currentPath ? currentPath.split('/') : [];

    const term = search.trim().toLowerCase();
    const shownFolders = (listing?.folders || []).filter((f) => !term || f.name.toLowerCase().includes(term));
    const shownFiles = (listing?.files || []).filter((f) => !term || f.name.toLowerCase().includes(term));

    return (
        <Box sx={{ display: 'flex', gap: 2, p: 2, height: 'calc(100vh - 140px)' }}>
            <Box sx={{ width: 260, flexShrink: 0, borderRight: '1px solid #e2e8f0', pr: 2, overflowY: 'auto' }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>Lokal</Typography>
                <Box
                    sx={{
                        display: 'flex', alignItems: 'center', gap: 0.5, py: 0.5, cursor: 'pointer', borderRadius: 1,
                        bgcolor: currentPath === '' ? '#e0f2fe' : 'transparent',
                        '&:hover': { bgcolor: currentPath === '' ? '#e0f2fe' : '#f1f5f9' },
                    }}
                    onClick={() => navigate('')}
                >
                    <HomeIcon fontSize="small" sx={{ color: '#64748b' }} />
                    <Typography variant="body2" sx={{ fontWeight: currentPath === '' ? 700 : 400 }}>images</Typography>
                </Box>
                {(rootFolders || []).map((f) => (
                    <TreeNode key={f.name} relPath={f.name} name={f.name} currentPath={currentPath} onNavigate={navigate} depth={1} />
                ))}
            </Box>

            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Button startIcon={<UploadIcon />} variant="outlined" component="label" disabled={uploading}>
                        Hochladen
                        <input type="file" multiple hidden onChange={(e) => handleUpload(e.target.files)} />
                    </Button>
                    <Button startIcon={<CreateNewFolderIcon />} variant="outlined" onClick={() => setNewFolderOpen(true)}>
                        Neues Verzeichnis anlegen
                    </Button>
                    <Button startIcon={<DeleteIcon />} variant="outlined" color="error" disabled={selected.size === 0} onClick={deleteSelected}>
                        Löschen
                    </Button>
                    <Box sx={{ flex: 1 }} />
                    <TextField size="small" placeholder="Suchen" value={search} onChange={(e) => setSearch(e.target.value)} />
                </Box>

                <Breadcrumbs sx={{ mb: 2 }}>
                    <Link component="button" underline="hover" onClick={() => navigate('')}>images</Link>
                    {crumbs.map((c, i) => {
                        const p = crumbs.slice(0, i + 1).join('/');
                        return (
                            <Link key={p} component="button" underline="hover" onClick={() => navigate(p)}>
                                {c}
                            </Link>
                        );
                    })}
                </Breadcrumbs>

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
                ) : (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, overflowY: 'auto' }}>
                        {shownFolders.length === 0 && shownFiles.length === 0 && (
                            <Typography variant="body2" color="text.secondary">Dieser Ordner ist leer.</Typography>
                        )}
                        {shownFolders.map((f) => (
                            <Fragment key={`d-${f.name}`}>
                                <Box
                                    sx={{
                                        width: 140, p: 1, borderRadius: 1, border: '1px solid #e2e8f0',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5,
                                        position: 'relative', cursor: 'pointer',
                                        bgcolor: selected.has(f.name) ? '#e0f2fe' : '#fff',
                                        '&:hover': { bgcolor: selected.has(f.name) ? '#e0f2fe' : '#f8fafc' },
                                    }}
                                    onDoubleClick={() => navigate(relOf(f.name))}
                                >
                                    <Checkbox
                                        size="small"
                                        checked={selected.has(f.name)}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={() => toggleSelect(f.name)}
                                        sx={{ position: 'absolute', top: 0, left: 0 }}
                                    />
                                    <FolderIcon sx={{ fontSize: 56, color: '#94a3b8' }} />
                                    <Typography variant="caption" noWrap sx={{ width: '100%', textAlign: 'center' }} title={f.name}>
                                        {f.name}
                                    </Typography>
                                </Box>
                            </Fragment>
                        ))}
                        {shownFiles.map((f) => (
                            <Box
                                key={`f-${f.name}`}
                                sx={{
                                    width: 140, p: 1, borderRadius: 1, border: '1px solid #e2e8f0',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5,
                                    position: 'relative',
                                    bgcolor: selected.has(f.name) ? '#e0f2fe' : '#fff',
                                }}
                            >
                                <Checkbox
                                    size="small"
                                    checked={selected.has(f.name)}
                                    onChange={() => toggleSelect(f.name)}
                                    sx={{ position: 'absolute', top: 0, left: 0 }}
                                />
                                {f.isImage ? (
                                    <Tooltip title={f.name}>
                                        <a href={f.url} target="_blank" rel="noreferrer">
                                            <Box
                                                component="img"
                                                src={f.url}
                                                sx={{ width: 90, height: 70, objectFit: 'cover', borderRadius: 0.5, mt: 1.5 }}
                                            />
                                        </a>
                                    </Tooltip>
                                ) : (
                                    <Tooltip title={f.name}>
                                        <a href={f.url} target="_blank" rel="noreferrer" style={{ marginTop: 20 }}>
                                            <InsertDriveFileIcon sx={{ fontSize: 56, color: '#94a3b8' }} />
                                        </a>
                                    </Tooltip>
                                )}
                                <Typography variant="caption" noWrap sx={{ width: '100%', textAlign: 'center' }} title={f.name}>
                                    {f.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">{formatSize(f.size)}</Typography>
                            </Box>
                        ))}
                    </Box>
                )}
            </Box>

            <Dialog open={newFolderOpen} onClose={() => setNewFolderOpen(false)}>
                <DialogTitle>Neues Verzeichnis anlegen</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus fullWidth margin="dense" label="Ordnername"
                        value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') createFolder(); }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setNewFolderOpen(false)}>Abbrechen</Button>
                    <Button variant="contained" onClick={createFolder}>Anlegen</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};
