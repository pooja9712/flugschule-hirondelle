import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNotify } from 'react-admin';
import { type FixedDuplicateMeta, FixedDuplicateMetaFields } from './FixedDuplicateMetaFields';
import { type PrimaryPageSettings, PrimaryPageSettingsFields } from './PrimaryPageSettingsFields';
import { RichHtmlInput } from './RichHtmlInput';
import { JoomlaPageActions } from './JoomlaPageActions';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  CircularProgress,
  IconButton,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import UploadIcon from '@mui/icons-material/Upload';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { isSessionExpiredError } from './sessionExpiry';

// Makes the DATA on the (already fully designed, Tailwind-styled) home page
// editable - promo card text, the "Hoch Hinaus" copy, team member
// names/photos - without ever touching Home.tsx's layout/CSS. The 3 promo
// cards and 5 team members are fixed-count fields (not an add/remove
// ArrayInput) on purpose: the page's design has exactly that many boxes, so
// only their data is editable, matching how PageMedia already does this for
// the promo cards' images (galleryImages slots 7/8/9 on the "home" row).
// Modeled on CookieConsentConfigPage.tsx's plain-fetch/MUI pattern.

interface PromoCard {
  title: string;
  boldLine: string;
  description: string;
  image: string;
  link: string;
}

interface TeamMember {
  name: string;
  image: string;
}

interface HomeContentData {
  promoCards: PromoCard[];
  teamMembers: TeamMember[];
  teamLink: string;
  hochHinausHtml: string;
  newsEyebrow: string;
  newsTitle: string;
  hochHinausEyebrowPrefix: string;
  hochHinausEyebrowLinkText: string;
  hochHinausTitle: string;
  // Only used on a page DUPLICATE (contentId set) - a client asked for a
  // Joomla-article-style "one big editor for the whole page" instead of a
  // field per data point, which the real Startseite's fixed card-grid/team-
  // grid layout can't represent as free text without giving up that layout
  // entirely. So a duplicate's promoCards/teamMembers/hochHinaus* fields
  // above go unused once bodyHtml is non-empty - Home.tsx renders bodyHtml
  // in their place for a duplicate, same as this page's own "Seiten"/
  // DynamicPage.tsx CMS flow already does for an admin-authored page body.
  bodyHtml: string;
  // "html" once saved from the Joomla-style editor: the public page then
  // shows exactly bodyHtml, even when it is empty (Home.tsx).
  bodyMode?: string;
}

const DEFAULTS: HomeContentData = {
  promoCards: [
    { title: '', boldLine: '', description: '', image: '', link: '' },
    { title: '', boldLine: '', description: '', image: '', link: '' },
    { title: '', boldLine: '', description: '', image: '', link: '' },
  ],
  teamMembers: [
    { name: '', image: '' },
    { name: '', image: '' },
    { name: '', image: '' },
    { name: '', image: '' },
    { name: '', image: '' },
  ],
  teamLink: '',
  hochHinausHtml: '',
  newsEyebrow: '',
  newsTitle: '',
  hochHinausEyebrowPrefix: '',
  hochHinausEyebrowLinkText: '',
  hochHinausTitle: '',
  bodyHtml: '',
};

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('auth')}` });

const ImageSlot = ({ url, onUploaded, label, shape = 'circle' }: { url: string; onUploaded: (url: string) => void; label: string; shape?: 'circle' | 'rect' }) => {
  const notify = useNotify();
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', headers: authHeaders(), body: formData });
      const data = await res.json();
      if (res.ok) onUploaded(data.url);
      else notify(data.message || 'Fehler beim Upload', { type: 'warning' });
    } catch {
      notify('Netzwerkfehler beim Upload', { type: 'warning' });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const dims = shape === 'circle' ? { width: 56, height: 56 } : { width: 96, height: 64 };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
      {url && (
        <Box sx={{ position: 'relative', ...dims }}>
          <Box
            component="img"
            src={url}
            alt=""
            sx={shape === 'circle' ? { ...dims, objectFit: 'cover', borderRadius: '50%' } : { ...dims, objectFit: 'cover', borderRadius: 1 }}
          />
          <IconButton
            size="small"
            onClick={() => onUploaded('')}
            title="Bild entfernen"
            sx={{ position: 'absolute', top: -8, right: -8, width: 20, height: 20, bgcolor: 'white', boxShadow: 1, '&:hover': { bgcolor: '#fee2e2' } }}
          >
            <CloseIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Box>
      )}
      <Button component="label" size="small" variant="outlined" startIcon={uploading ? <CircularProgress size={16} /> : <UploadIcon />} disabled={uploading}>
        {label}
        <input type="file" accept="image/*" hidden onChange={handleUpload} />
      </Button>
    </Box>
  );
};

export const HomeContentEditor = () => {
  const notify = useNotify();
  const navigate = useNavigate();
  // A fixed-page duplicate of the Startseite (see Pages.tsx > "Duplizieren")
  // stores its copied data as a SitePageContent row keyed by its own slug -
  // not a HomeContent row - so this editor hits a different endpoint when
  // editing one of those instead of the real Startseite.
  const { contentId } = useParams<{ contentId?: string }>();
  const previewPath = contentId ? `/${contentId}` : '/';
  // Joomla-style page editing (content-only canvas, Joomla action bar with
  // Versionen) - on trial for /home-3 first, to be rolled out to the other
  // pages once approved.
  const joomlaTrial = contentId === 'home-3';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState<HomeContentData>(DEFAULTS);
  const [dupMeta, setDupMeta] = useState<FixedDuplicateMeta | null>(null);
  const [primaryMeta, setPrimaryMeta] = useState<PrimaryPageSettings | null>(null);
  const [loadError, setLoadError] = useState(false);

  const [sessionExpired, setSessionExpired] = useState(false);
  const load = () => {
    setLoadError(false);
    const url = contentId ? `/api/sitepagecontent/${contentId}` : '/api/homecontent/default';
    Promise.all([
      fetch(url, { headers: authHeaders() }),
      contentId ? fetch(`/api/fixed-page-duplicates/${contentId}`, { headers: authHeaders() }) : Promise.resolve(null),
      contentId ? Promise.resolve(null) : fetch('/api/fixed-page-settings/home', { headers: authHeaders() }),
    ])
      .then(async ([contentRes, metaRes, primaryRes]) => {
        if (!contentRes.ok) throw new Error(`HTTP ${contentRes.status}`);
        const data = await contentRes.json();
        setContent({ ...DEFAULTS, ...(contentId ? data.data : data) });
        setDupMeta(metaRes && metaRes.ok ? await metaRes.json() : null);
        setPrimaryMeta(primaryRes && primaryRes.ok ? await primaryRes.json() : null);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        notify('Fehler beim Laden der Startseiten-Inhalte', { type: 'error' });
        setSessionExpired(isSessionExpiredError(err)); setLoadError(true);
        setLoading(false);
      });
  };

  useEffect(load, [contentId]);

  // Resolves to the page's slug after a successful save (it can change when
  // the URL field was edited), or null when saving failed.
  const handleSave = (): Promise<string | null> => {
    setSaving(true);
    let savedSlug: string | null = contentId || 'home';
    const url = contentId ? `/api/sitepagecontent/${contentId}` : '/api/homecontent/default';
    return fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(contentId ? { data: joomlaTrial ? { ...content, bodyMode: 'html' } : content } : content),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Speichern fehlgeschlagen');
        return res.json();
      })
      .then(async () => {
        if (dupMeta) {
          const res = await fetch(`/api/fixed-page-duplicates/${dupMeta.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify(dupMeta),
          });
          const updated = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(updated.error || 'Seiten-Einstellungen konnten nicht gespeichert werden');
          savedSlug = updated.slug;
          if (updated.slug !== contentId) navigate(`/admin/home-content/${updated.slug}`, { replace: true });
          else setDupMeta(updated);
        }
        if (primaryMeta) {
          const res = await fetch('/api/fixed-page-settings/home', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify(primaryMeta),
          });
          const updated = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(updated.error || 'Seiten-Einstellungen konnten nicht gespeichert werden');
          setPrimaryMeta(updated);
        }
      })
      .then(() => {
        notify('Startseiten-Inhalte gespeichert', { type: 'success' });
        return savedSlug;
      })
      .catch((err) => {
        notify(err.message || 'Fehler beim Speichern', { type: 'error' });
        return null;
      })
      .finally(() => setSaving(false));
  };

  const updatePromoCard = (index: number, field: keyof PromoCard, value: string) => {
    setContent((prev) => {
      const promoCards = [...prev.promoCards];
      promoCards[index] = { ...promoCards[index], [field]: value };
      return { ...prev, promoCards };
    });
  };

  const updateTeamMember = (index: number, field: keyof TeamMember, value: string) => {
    setContent((prev) => {
      const teamMembers = [...prev.teamMembers];
      teamMembers[index] = { ...teamMembers[index], [field]: value };
      return { ...prev, teamMembers };
    });
  };

  if (loading) return <Box sx={{ p: 3 }}><Typography>Lade...</Typography></Box>;

  if (loadError) {
    return (
      <Box sx={{ p: 3 }}>
        {sessionExpired ? (
          <Alert severity="warning" action={<Button color="inherit" size="small" href="/admin/login">Erneut einloggen</Button>}>
            Ihre Sitzung ist abgelaufen. Bitte loggen Sie sich erneut ein.
          </Alert>
        ) : (
          <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>Erneut versuchen</Button>}>
          Startseiten-Inhalte konnten nicht geladen werden. Bitte laden Sie die Seite neu, bevor Sie speichern.
        </Alert>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h5">Startseite - Inhalte</Typography>
        {joomlaTrial ? (
          <JoomlaPageActions
            versionsUrl={`/api/sitepagecontent/${encodeURIComponent(contentId!)}/versions`}
            previewPath={previewPath}
            saving={saving}
            onSave={handleSave}
            onRestore={(bodyHtml) => setContent((prev) => ({ ...prev, bodyHtml }))}
            editPathFor={(slug) => `/admin/home-content/${slug}`}
          />
        ) : (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button component="a" href={previewPath} target="_blank" rel="noopener noreferrer" variant="outlined" startIcon={<OpenInNewIcon />}>
            Vorschau
          </Button>
          <Button variant="contained" color="success" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving}>
            Speichern
          </Button>
        </Box>
        )}
      </Box>

      {dupMeta && <FixedDuplicateMetaFields meta={dupMeta} onChange={setDupMeta} />}
      {primaryMeta && <PrimaryPageSettingsFields settings={primaryMeta} onChange={setPrimaryMeta} />}

      {contentId ? (
        // A duplicate: one single free-form editor for the whole page body,
        // Joomla-article style - see the HomeContentData.bodyHtml comment
        // above for why this replaces every structured field below instead
        // of sitting alongside them.
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>Seiteninhalt</Typography>
            <Typography variant="body2" sx={{ color: '#666', mb: 2 }}>
              Alles auf dieser Seite (Kacheln, Hoch-Hinaus-Text, Team) wird hier als ein einziger, frei gestaltbarer Inhalt bearbeitet - wie ein Artikel in Joomla. Bilder über das Bild-Symbol einfügen.
            </Typography>
            <RichHtmlInput
              label=""
              value={content.bodyHtml}
              onChange={(html) => setContent({ ...content, bodyHtml: html })}
              minRows={18}
              helperText="Wie in Joomla: Menüleiste oben, weitere Werkzeuge über die Schaltfläche „…“. Über „HTML“ lässt sich der Quelltext direkt bearbeiten."
              bodyClass="home-body-content"
              contentMaxWidth={1200}
              contentOnly={joomlaTrial}
              blockVisibility={joomlaTrial}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Die 3 Highlight-Kacheln</Typography>
              <Grid container spacing={3}>
                {content.promoCards.map((card, i) => (
                  <Grid key={i} size={{ xs: 12, md: 4 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, color: '#666' }}>Kachel {i + 1}</Typography>
                    <ImageSlot
                      shape="rect"
                      url={card.image}
                      onUploaded={(url) => updatePromoCard(i, 'image', url)}
                      label={card.image ? 'Bild ersetzen' : 'Bild hochladen'}
                    />
                    <TextField
                      label="Titel"
                      fullWidth
                      value={card.title}
                      onChange={(e) => updatePromoCard(i, 'title', e.target.value)}
                      sx={{ mb: 2 }}
                    />
                    <TextField
                      label="Fettgedruckte Zeile"
                      fullWidth
                      value={card.boldLine}
                      onChange={(e) => updatePromoCard(i, 'boldLine', e.target.value)}
                      sx={{ mb: 2 }}
                    />
                    <TextField
                      label="Beschreibung"
                      fullWidth
                      multiline
                      minRows={2}
                      value={card.description}
                      onChange={(e) => updatePromoCard(i, 'description', e.target.value)}
                      sx={{ mb: 2 }}
                    />
                    <TextField
                      label="Link (Ziel beim Klick)"
                      fullWidth
                      value={card.link}
                      onChange={(e) => updatePromoCard(i, 'link', e.target.value)}
                      helperText="z.B. /ausbildung/schnupperkurs"
                    />
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Abschnitt "News"</Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField label="Kleiner Titel (oben)" fullWidth value={content.newsEyebrow} onChange={(e) => setContent({ ...content, newsEyebrow: e.target.value })} helperText='z.B. "AKTUELLES"' />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField label="Überschrift" fullWidth value={content.newsTitle} onChange={(e) => setContent({ ...content, newsTitle: e.target.value })} helperText='z.B. "NEWS"' />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Abschnitt "Hoch Hinaus"</Typography>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField label="Kleiner Titel - Text davor" fullWidth value={content.hochHinausEyebrowPrefix} onChange={(e) => setContent({ ...content, hochHinausEyebrowPrefix: e.target.value })} helperText='z.B. "...mit dem"' />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField label="Kleiner Titel - Link-Text" fullWidth value={content.hochHinausEyebrowLinkText} onChange={(e) => setContent({ ...content, hochHinausEyebrowLinkText: e.target.value })} helperText='z.B. "Team Hirondelle" (verlinkt zu /infos/team)' />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField label="Überschrift" fullWidth value={content.hochHinausTitle} onChange={(e) => setContent({ ...content, hochHinausTitle: e.target.value })} helperText='z.B. "HOCH HINAUS"' />
                </Grid>
              </Grid>
              <TextField
                fullWidth
                multiline
                minRows={5}
                label="Text"
                value={content.hochHinausHtml}
                onChange={(e) => setContent({ ...content, hochHinausHtml: e.target.value })}
                helperText='HTML wird unterstützt, z.B. <a href="/infos/team">Team Hirondelle</a> für einen Link.'
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Team-Mitglieder</Typography>
              <TextField
                label="Link (Ziel beim Klick auf ein Foto)"
                fullWidth
                value={content.teamLink}
                onChange={(e) => setContent({ ...content, teamLink: e.target.value })}
                helperText="z.B. /infos/team"
                sx={{ mb: 3 }}
              />
              <Grid container spacing={3}>
                {content.teamMembers.map((member, i) => (
                  <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
                    <ImageSlot
                      url={member.image}
                      onUploaded={(url) => updateTeamMember(i, 'image', url)}
                      label={member.image ? 'Foto ersetzen' : 'Foto hochladen'}
                    />
                    <TextField
                      label="Name"
                      fullWidth
                      value={member.name}
                      onChange={(e) => updateTeamMember(i, 'name', e.target.value)}
                    />
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
        <Button component="a" href={previewPath} target="_blank" rel="noopener noreferrer" variant="outlined" startIcon={<OpenInNewIcon />}>
          Vorschau
        </Button>
        <Button variant="contained" color="success" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving}>
          Speichern
        </Button>
      </Box>
    </Box>
  );
};
