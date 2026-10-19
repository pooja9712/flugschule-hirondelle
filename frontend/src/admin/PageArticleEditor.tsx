// =====================================================================
// PAGE ARTICLE MODE (Joomla-style body content) - added 2026-10-11
// ---------------------------------------------------------------------
// The Joomla-style whole-page editor for every page in Admin > Seiten
// (route /admin/page-article/:key). One editor for the page body - like a
// Joomla module/article, with the same toolbar, "CMS-Inhalt", colour
// palette, per-block show/hide + publish dates, and "Versionen".
//
// A page that has no editor content yet gets its current live content
// copied in automatically (headings, texts, buttons/links, images,
// tables) - nothing changes on the site until "Speichern". With Status
// "Veröffentlicht" the public page body is this HTML (see
// pages/PageArticleOverride.tsx); header/footer menus and the banner
// slider stay as they are. "Original wiederherstellen" brings the built-in
// design back - the original page content is never changed by this screen.
//
// TO REVERT: delete this file and its route + import in AdminApp.tsx and
// the article icon in Pages.tsx (all marked "PAGE ARTICLE MODE").
// =====================================================================
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useNotify } from 'react-admin';
import { Alert, Box, Button, Card, CardContent, CircularProgress, FormControlLabel, Switch, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RestoreIcon from '@mui/icons-material/Restore';
import ListAltIcon from '@mui/icons-material/ListAlt';
import { RichHtmlInput } from './RichHtmlInput';
import { JoomlaPageActions } from './JoomlaPageActions';
import { prepareImportedPage } from '../utils/liveBlocks';

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('auth')}` });

// Loads the public page (original design, "?original=1") in a hidden iframe
// and copies its rendered body - everything below the banner slider. Waits
// until the page's own content requests have finished, i.e. its HTML stops
// changing.
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
      // Live parts (comments) become placeholders, FAQ items <details>.
      prepareImportedPage(clone);
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
  // The page's previous field-based editor, still reachable.
  const fieldsPath = searchParams.get('fields');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [html, setHtml] = useState('');
  const [fullWidth, setFullWidth] = useState(true);
  const [exists, setExists] = useState(false);
  const [editorKey, setEditorKey] = useState(0);

  const importPage = (confirmFirst: boolean) => {
    if (confirmFirst && html.trim() && !window.confirm('Den aktuellen Inhalt durch den Inhalt der Live-Seite ersetzen?')) return;
    setImporting(true);
    importRenderedPage(pagePath)
      .then((imported) => {
        setHtml(imported);
        setFullWidth(true);
        setEditorKey((k) => k + 1);
        notify('Inhalt der Seite übernommen - jetzt bearbeiten und speichern.', { type: 'info' });
      })
      .catch((err) => notify(err.message, { type: 'error' }))
      .finally(() => setImporting(false));
  };

  useEffect(() => {
    setLoading(true);
    fetch(`/api/page-articles/${encodeURIComponent(key)}`, { headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setExists(!!data.exists);
        setFullWidth(!!data.fullWidth);
        setHtml(data.html || '');
        // No editor content yet: start from the page as it is now, and
        // publish it with the first "Speichern" - like editing in Joomla.
        setEnabled(data.exists ? !!data.enabled : true);
        if (!data.exists || !data.html) importPage(false);
      })
      .catch(() => notify('Fehler beim Laden', { type: 'error' }))
      .finally(() => setLoading(false));
    // importPage only reads the path for this key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, notify]);

  const save = (): Promise<string | null> => {
    if (importing) {
      notify('Der Seiteninhalt wird noch geladen - bitte einen Moment warten.', { type: 'warning' });
      return Promise.resolve(null);
    }
    if (enabled && !html.trim() && !window.confirm('Der Inhalt ist leer - die Seite zeigt dann keinen Inhalt. Trotzdem speichern?')) {
      return Promise.resolve(null);
    }
    setSaving(true);
    return fetch(`/api/page-articles/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ enabled, html, fullWidth }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        setExists(true);
        notify(enabled ? 'Gespeichert - die Seite zeigt jetzt diesen Inhalt.' : 'Gespeichert - die Seite zeigt weiter das Original-Design.', { type: 'success' });
        return key;
      })
      .catch(() => {
        notify('Fehler beim Speichern', { type: 'error' });
        return null;
      })
      .finally(() => setSaving(false));
  };

  const restoreOriginal = () => {
    if (!window.confirm('Editor-Inhalt löschen und das Original-Design der Seite wiederherstellen?')) return;
    fetch(`/api/page-articles/${encodeURIComponent(key)}`, { method: 'DELETE', headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error();
        setExists(false);
        notify('Original-Design wiederhergestellt.', { type: 'success' });
        navigate('/admin/pages');
      })
      .catch(() => notify('Fehler beim Wiederherstellen', { type: 'error' }));
  };

  if (loading) return <Box sx={{ p: 3 }}><Typography>Lade...</Typography></Box>;

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h5">{pageTitle} - Seiteninhalt</Typography>
        <JoomlaPageActions
          versionsUrl={`/api/page-articles/${encodeURIComponent(key)}/versions`}
          previewPath={pagePath}
          saving={saving || importing}
          onSave={save}
          onRestore={(body) => setHtml(body)}
        />
      </Box>

      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <FormControlLabel
            control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />}
            label={(
              <Typography sx={{ fontWeight: 600 }}>
                {enabled ? 'Status: Veröffentlicht - die Seite zeigt diesen Inhalt' : 'Status: Aus - die Seite zeigt ihr Original-Design'}
              </Typography>
            )}
          />
          <Box sx={{ flexGrow: 1 }} />
          <Button
            variant="outlined"
            startIcon={importing ? <CircularProgress size={16} /> : <ContentCopyIcon />}
            onClick={() => importPage(true)}
            disabled={importing}
          >
            Inhalt der Live-Seite neu übernehmen
          </Button>
          {fieldsPath && (
            <Button variant="outlined" startIcon={<ListAltIcon />} onClick={() => navigate(fieldsPath)}>
              Felder-Editor (alt)
            </Button>
          )}
          {exists && (
            <Button variant="outlined" color="error" startIcon={<RestoreIcon />} onClick={restoreOriginal}>
              Original wiederherstellen
            </Button>
          )}
        </CardContent>
      </Card>

      {!exists && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {importing ? 'Der aktuelle Inhalt der Seite wird geladen…' : 'Der aktuelle Inhalt der Seite wurde übernommen.'} Auf der Webseite ändert sich erst etwas,
          wenn Sie <strong>Speichern</strong>. Kopf-/Fußmenü und Banner-Slider bleiben unverändert.
        </Alert>
      )}

      <Card>
        <CardContent>
          {importing && !html ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 4 }}><CircularProgress size={24} /><Typography>Seiteninhalt wird geladen…</Typography></Box>
          ) : (
            <RichHtmlInput
              key={editorKey}
              label="Seiteninhalt"
              value={html}
              onChange={setHtml}
              minRows={20}
              bodyClass={fullWidth ? '' : 'home-body-content page-article-body'}
              contentMaxWidth={fullWidth ? undefined : 1200}
              contentOnly
              blockVisibility
              helperText="Wie in Joomla: Element anklicken für Link, Farben, Sichtbarkeit; „Design-Vorschau“ zeigt die Seite mit ihrem Design. Formulare und interaktive Elemente der Originalseite werden beim Übernehmen zu statischem Inhalt."
            />
          )}
        </CardContent>
      </Card>
    </Box>
  );
};
