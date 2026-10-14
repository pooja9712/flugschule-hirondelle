// =====================================================================
// PAGE ARTICLE MODE (Joomla-style body content) - added 2026-10-11
// ---------------------------------------------------------------------
// Admin screen for one page's optional "Artikel" body (route
// /admin/page-article/:key, opened from the article icon in Admin > Seiten).
// When "Artikel-Modus" is on, the public page body is replaced by this HTML
// (see pages/PageArticleOverride.tsx); header/footer menus and the banner
// slider stay as they are. Switching it off, or "Original wiederherstellen",
// brings the built-in design back immediately - nothing of the original
// page content is changed by this screen.
//
// TO REVERT: delete this file and its route + import in AdminApp.tsx and
// the article icon in Pages.tsx (all marked "PAGE ARTICLE MODE").
// =====================================================================
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useNotify } from 'react-admin';
import { Alert, Box, Button, Card, CardContent, CircularProgress, FormControlLabel, Switch, Typography } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RestoreIcon from '@mui/icons-material/Restore';
import { RichHtmlInput } from './RichHtmlInput';

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('auth')}` });

// Loads the public page (original design, "?original=1") in a hidden iframe
// and copies its rendered body - everything below the banner slider - as a
// starting point for the article. Waits until the page's own content
// requests have finished, i.e. its HTML stops changing.
const importRenderedPage = (path: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:1280px;height:900px;border:0;';
    iframe.src = `${path}${path.includes('?') ? '&' : '?'}original=1`;
    let last = '';
    let stableTicks = 0;
    let elapsed = 0;
    const finish = (html: string | null) => {
      clearInterval(poll);
      iframe.remove();
      if (html) resolve(html);
      else reject(new Error('Seiteninhalt konnte nicht gelesen werden.'));
    };
    const read = () => {
      const doc = iframe.contentDocument;
      const pageRoot = doc?.querySelector('main')?.firstElementChild;
      if (!pageRoot) return '';
      const clone = pageRoot.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('[data-site-banner]').forEach((el) => el.remove());
      return clone.innerHTML.trim();
    };
    const poll = setInterval(() => {
      elapsed += 500;
      const html = read();
      if (html && html === last) stableTicks += 1;
      else stableTicks = 0;
      last = html;
      if (stableTicks >= 4 && html.length > 50) finish(html);
      else if (elapsed >= 20000) finish(last || null);
    }, 500);
    document.body.appendChild(iframe);
  });

export const PageArticleEditor = () => {
  const notify = useNotify();
  const navigate = useNavigate();
  const { key = '' } = useParams<{ key: string }>();
  const [searchParams] = useSearchParams();
  const pagePath = searchParams.get('path') || `/${key}`;
  const pageTitle = searchParams.get('title') || key;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [html, setHtml] = useState('');
  const [exists, setExists] = useState(false);
  const [editorKey, setEditorKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/page-articles/${encodeURIComponent(key)}`, { headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setEnabled(!!data.enabled);
        setHtml(data.html || '');
        setExists(!!data.exists);
      })
      .catch(() => notify('Fehler beim Laden', { type: 'error' }))
      .finally(() => setLoading(false));
  }, [key, notify]);

  const save = () => {
    if (enabled && !html.trim()) {
      notify('Der Artikel ist leer - bitte zuerst Inhalt einfügen oder den Artikel-Modus ausschalten.', { type: 'warning' });
      return;
    }
    setSaving(true);
    fetch(`/api/page-articles/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ enabled, html }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        setExists(true);
        notify(enabled ? 'Gespeichert - die Seite zeigt jetzt den Artikel.' : 'Gespeichert - die Seite zeigt das Original-Design.', { type: 'success' });
      })
      .catch(() => notify('Fehler beim Speichern', { type: 'error' }))
      .finally(() => setSaving(false));
  };

  const importPage = () => {
    if (html.trim() && !window.confirm('Den aktuellen Artikel-Inhalt durch den Inhalt der Live-Seite ersetzen?')) return;
    setImporting(true);
    importRenderedPage(pagePath)
      .then((imported) => {
        setHtml(imported);
        setEditorKey((k) => k + 1);
        notify('Seiteninhalt übernommen - jetzt bearbeiten und speichern.', { type: 'success' });
      })
      .catch((err) => notify(err.message, { type: 'error' }))
      .finally(() => setImporting(false));
  };

  const restoreOriginal = () => {
    if (!window.confirm('Artikel löschen und das Original-Design der Seite wiederherstellen?')) return;
    fetch(`/api/page-articles/${encodeURIComponent(key)}`, { method: 'DELETE', headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error();
        setEnabled(false);
        setHtml('');
        setExists(false);
        setEditorKey((k) => k + 1);
        notify('Original-Design wiederhergestellt.', { type: 'success' });
      })
      .catch(() => notify('Fehler beim Wiederherstellen', { type: 'error' }));
  };

  if (loading) return <Box sx={{ p: 3 }}><Typography>Lade...</Typography></Box>;

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/admin/pages')}>Seiten</Button>
          <Typography variant="h5">{pageTitle} - Artikel-Inhalt</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button component="a" href={pagePath} target="_blank" rel="noopener noreferrer" variant="outlined" startIcon={<OpenInNewIcon />}>
            Vorschau
          </Button>
          <Button variant="contained" color="success" startIcon={<SaveIcon />} onClick={save} disabled={saving}>Speichern</Button>
        </Box>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        Wie ein Beitrag in Joomla: Ist der Artikel-Modus aktiv, zeigt die Seite <strong>{pagePath}</strong> diesen frei gestaltbaren Inhalt
        statt ihres eingebauten Layouts. Kopf-/Fußmenü und Banner-Slider bleiben unverändert. Ausschalten oder „Original wiederherstellen“
        bringt das ursprüngliche Design sofort zurück.
      </Alert>

      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <FormControlLabel
            control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />}
            label={<Typography sx={{ fontWeight: 600 }}>{enabled ? 'Artikel-Modus aktiv' : 'Artikel-Modus aus (Original-Design)'}</Typography>}
          />
          <Box sx={{ flexGrow: 1 }} />
          <Button
            variant="outlined"
            startIcon={importing ? <CircularProgress size={16} /> : <ContentCopyIcon />}
            onClick={importPage}
            disabled={importing}
          >
            Inhalt der aktuellen Seite übernehmen
          </Button>
          {exists && (
            <Button variant="outlined" color="error" startIcon={<RestoreIcon />} onClick={restoreOriginal}>
              Original wiederherstellen
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <RichHtmlInput
            key={editorKey}
            label="Seiteninhalt"
            value={html}
            onChange={setHtml}
            minRows={20}
            bodyClass="home-body-content page-article-body"
            contentMaxWidth={1200}
            helperText="Tipp: „Inhalt der aktuellen Seite übernehmen“ kopiert das jetzige Design als Startpunkt. Formulare und interaktive Elemente der Originalseite werden dabei zu statischem Inhalt."
          />
        </CardContent>
      </Card>
    </Box>
  );
};
