import { Box, MenuItem, TextField } from '@mui/material';
import { normalizeDuplicateSlug } from './FixedDuplicateMetaFields';

// Editing one of the 6 fixed pages' OWN title/URL/publish-status (not a
// duplicate's - see FixedDuplicateMetaFields for that) - see
// FixedPageSettings model / fixedPageSettings.routes.ts. Renaming the URL
// only changes where the page resolves; the old hardcoded route always
// keeps working via a redirect (FixedPageGate.tsx). No "Im Menü"/"Menü-
// Beschriftung" fields here, unlike a duplicate: these pages are always in
// the site's hardcoded Header/Footer nav and there's no mechanism to hide
// or rename them there.

export interface PrimaryPageSettings {
  title: string;
  slug: string | null; // null for Home while it stays at "/"
  kind?: string;
  status: string;
}

export const PrimaryPageSettingsFields = ({
  settings,
  onChange,
}: {
  settings: PrimaryPageSettings;
  onChange: (next: PrimaryPageSettings) => void;
}) => (
  <Box sx={{ p: 2, mb: 3, border: '1px solid #e2e8f0', borderRadius: 1, display: 'flex', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap', bgcolor: '#fff' }}>
    <TextField
      label="Titel"
      value={settings.title}
      onChange={(e) => onChange({ ...settings, title: e.target.value })}
      size="small"
      fullWidth={false}
      sx={{ width: 220 }}
    />
    <TextField
      label="URL"
      value={settings.slug ?? ''}
      onChange={(e) => onChange({ ...settings, slug: e.target.value })}
      onBlur={(e) => onChange({ ...settings, slug: normalizeDuplicateSlug(e.target.value) })}
      placeholder={settings.kind === 'home' ? '/' : undefined}
      slotProps={{ inputLabel: { shrink: true } }}
      helperText={settings.kind === 'home' ? 'Leer = Startseite unter /' : 'Die alte URL leitet automatisch hierher weiter'}
      size="small"
      fullWidth={false}
      sx={{ width: 220 }}
    />
    <TextField
      select
      label="Status"
      value={settings.status}
      onChange={(e) => onChange({ ...settings, status: e.target.value })}
      size="small"
      fullWidth={false}
      sx={{ width: 160 }}
    >
      <MenuItem value="published">Veröffentlicht</MenuItem>
      <MenuItem value="draft">Entwurf</MenuItem>
    </TextField>
  </Box>
);
