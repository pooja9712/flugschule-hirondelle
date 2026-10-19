import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotify } from 'react-admin';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, List, ListItem, ListItemText, Typography,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import CheckIcon from '@mui/icons-material/Check';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import HistoryIcon from '@mui/icons-material/History';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { SafeHtml } from '../components/common/SafeHtml';

// Joomla's editor action bar for a whole-page body (like Content > Site
// Modules > Edit): Speichern, Speichern & Schließen, Als Kopie speichern,
// Versionen (content history with preview + restore), Vorschau, Schließen.
// Versions are kept by the backend on every save (sitePageContent.routes.ts,
// "versions--<slug>"); restoring only loads the old body into the editor -
// it goes live with the next save, exactly like Joomla.

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('auth')}` });

interface Version { savedAt: string; bodyHtml: string }

interface Props {
  slug: string;
  previewPath: string;
  saving: boolean;
  // Resolves to the (possibly renamed) slug, or null when saving failed.
  onSave: () => Promise<string | null>;
  onRestore: (bodyHtml: string) => void;
  editPathFor: (slug: string) => string;
}

export const JoomlaPageActions = ({ slug, previewPath, saving, onSave, onRestore, editPathFor }: Props) => {
  const navigate = useNavigate();
  const notify = useNotify();
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [preview, setPreview] = useState<Version | null>(null);

  const close = () => navigate('/admin/pages');

  const saveAndClose = () => onSave().then((ok) => { if (ok) close(); });

  const saveAsCopy = () =>
    onSave().then(async (saved) => {
      if (!saved) return;
      const res = await fetch(`/api/fixed-page-duplicates/${encodeURIComponent(saved)}/duplicate`, { method: 'POST', headers: authHeaders() });
      const dup = await res.json().catch(() => ({}));
      if (!res.ok) { notify(dup.error || 'Kopie konnte nicht erstellt werden', { type: 'error' }); return; }
      notify(`Kopie „${dup.title}“ erstellt - Sie bearbeiten jetzt die Kopie.`, { type: 'success' });
      navigate(editPathFor(dup.slug));
    });

  const openVersions = () => {
    setVersions([]);
    fetch(`/api/sitepagecontent/${encodeURIComponent(slug)}/versions`, { headers: authHeaders() })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then(setVersions)
      .catch(() => { setVersions(null); notify('Versionen konnten nicht geladen werden', { type: 'error' }); });
  };

  const restore = (v: Version) => {
    onRestore(v.bodyHtml);
    setPreview(null);
    setVersions(null);
    notify('Version geladen - mit „Speichern“ wird sie wieder live.', { type: 'info' });
  };

  const fmt = (iso: string) => new Date(iso).toLocaleString('de-DE');

  return (
    <>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button variant="contained" color="success" startIcon={<SaveIcon />} onClick={() => { void onSave(); }} disabled={saving}>Speichern</Button>
        <Button variant="outlined" color="success" startIcon={<CheckIcon />} onClick={() => { void saveAndClose(); }} disabled={saving}>Speichern &amp; Schließen</Button>
        <Button variant="outlined" startIcon={<ContentCopyIcon />} onClick={() => { void saveAsCopy(); }} disabled={saving}>Als Kopie speichern</Button>
        <Button variant="outlined" startIcon={<HistoryIcon />} onClick={openVersions}>Versionen</Button>
        <Button variant="outlined" component="a" href={previewPath} target="_blank" rel="noopener noreferrer" startIcon={<OpenInNewIcon />}>Vorschau</Button>
        <Button variant="outlined" color="error" startIcon={<CloseIcon />} onClick={close}>Schließen</Button>
      </Box>

      <Dialog open={versions !== null} onClose={() => setVersions(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Versionen</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
            Bei jedem Speichern wird der vorherige Seiteninhalt hier aufbewahrt (die letzten 20).
          </Typography>
          {versions && versions.length === 0 && <Typography sx={{ py: 2 }}>Noch keine früheren Versionen - sie entstehen beim nächsten Speichern.</Typography>}
          <List dense>
            {versions?.map((v) => (
              <ListItem
                key={v.savedAt}
                divider
                secondaryAction={
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button size="small" onClick={() => setPreview(v)}>Ansehen</Button>
                    <Button size="small" variant="contained" onClick={() => restore(v)}>Wiederherstellen</Button>
                  </Box>
                }
              >
                <ListItemText sx={{ pr: 30 }} slotProps={{ secondary: { noWrap: true } }} primary={fmt(v.savedAt)} secondary={`${v.bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)}…`} />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions><Button onClick={() => setVersions(null)}>Schließen</Button></DialogActions>
      </Dialog>

      <Dialog open={!!preview} onClose={() => setPreview(null)} maxWidth="lg" fullWidth>
        <DialogTitle>Version vom {preview && fmt(preview.savedAt)}</DialogTitle>
        <DialogContent dividers>
          {preview && <SafeHtml html={preview.bodyHtml} className="home-body-content" />}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreview(null)}>Zurück</Button>
          {preview && <Button variant="contained" onClick={() => restore(preview)}>Wiederherstellen</Button>}
        </DialogActions>
      </Dialog>
    </>
  );
};
