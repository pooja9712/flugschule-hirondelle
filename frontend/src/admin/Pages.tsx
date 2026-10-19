import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import EmailEditor from 'react-email-editor';
import { useNotify } from 'react-admin';
import { SafeHtml } from '../components/common/SafeHtml';
import { LightboxProvider } from '../components/common/Lightbox';
import { isSessionExpiredError } from './sessionExpiry';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import UploadIcon from '@mui/icons-material/Upload';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ArticleIcon from '@mui/icons-material/Article'; // PAGE ARTICLE MODE
import SearchIcon from '@mui/icons-material/Search';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import DynamicFormIcon from '@mui/icons-material/DynamicForm';
import MailOutlineIcon from '@mui/icons-material/Email';

// "Seiten" - the CMS feature that lets an admin create an entirely new page
// from scratch (title, URL slug, description, header image, content) that
// goes live at its own URL with no code change - unlike PageContent/
// PageGallery/PageMedia (Komponenten group) which only edit EXISTING
// hardcoded pages. The body is authored with the same Unlayer drag-and-drop
// editor used for the AcyMailing newsletter templates (see
// frontend/src/admin/AcyMailing/Templates.tsx for the reference
// implementation this mirrors) via the `react-email-editor` package, run in
// `displayMode: 'web'` (div/flex-based responsive HTML) rather than
// 'email' (table-based) since this renders on a live webpage, not in an
// email client. `body` stores the exported HTML actually shown on the
// public page; `design` stores Unlayer's own JSON so a saved page can be
// reloaded into the editor for further edits.
//
// This is a bespoke screen (plain fetch, not react-admin's data provider/
// <Edit>/<Create>) because the Unlayer widget needs to fill the whole
// screen and doesn't fit react-admin's per-field <Input> model - same
// reasoning as AcyTemplates.tsx. Registered as a CustomRoute at /admin/pages
// in AdminApp.tsx (not a <Resource list/edit/create>). To revert: delete
// this file, its CustomRoutes entry in AdminApp.tsx, and its sidebar entry
// in CustomMenu.tsx.

// Kept in sync with backend/src/data/reservedSlugs.ts - every top-level
// static path segment App.tsx's router already uses. A page created with
// one of these slugs would be silently unreachable (shadowed by the
// existing static route), so it's rejected here AND on the backend.
const RESERVED_SLUGS = new Set([
  'news', 'downloads', 'partner', 'search', 'events', 'ausbildung', 'performance',
  'reisen', 'buchungskalender', 'tandem', 'service', 'infos', 'agb',
  'widerrufsbelehrung', 'faq', 'datenschutz', 'impressum', 'bewertung',
  'veranstaltungsorte', 'veranstaltungsort', 'veranstalter', 'shop', 'anmeldung',
  'profil', 'booking-success', 'booking-cancel', 'newsletter', 'admin',
]);

const normalizeSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// Unlayer's exportHtml gives back a full document whose <head><style> block
// is the ONLY thing that makes .u-row/.u-col-* actually lay out as columns
// (display:flex + flex-basis percentages) - but that <style> tag never
// survives DOMPurify's sanitization on the public page (confirmed: even
// ADD_TAGS: ['style'] doesn't let it through), so saving just doc.body.
// innerHTML silently collapses every multi-column row to one column.
// Fix: mount the exported HTML for real (style tag included) in a hidden
// node attached to the live document, so the browser actually computes the
// layout, then copy the resulting display/flex-basis/max-width/width onto
// each row/column as an inline style="..." attribute - which DOES survive
// DOMPurify, since it's just a normal HTML attribute. This is necessarily a
// desktop-viewport snapshot: Unlayer's own mobile-stacking @media query
// can't be preserved this way, only the resulting property VALUES at
// today's admin-browser width, but that's still a large improvement over
// the columns not showing side-by-side at all.
const inlineUnlayerLayoutCss = (html: string): string => {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const styleText = Array.from(doc.head.querySelectorAll('style')).map((s) => s.textContent || '').join('\n');

    const tempStyle = document.createElement('style');
    tempStyle.textContent = styleText;
    document.head.appendChild(tempStyle);

    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-99999px';
    container.style.top = '0';
    container.style.width = '1200px';
    container.innerHTML = doc.body.innerHTML;
    document.body.appendChild(container);

    // Rows saved before contentWidth was fixed to 1200px in onEditorLoad
    // (or any row someone narrows again by hand) still carry Unlayer's
    // email-default max-width:500px on their own .container div - stretch
    // those to fill whatever width the live page actually gives them
    // instead of leaving a narrow island surrounded by empty gutters.
    container.querySelectorAll<HTMLElement>('.u-row > .container').forEach((el) => {
      el.style.maxWidth = '100%';
    });

    container.querySelectorAll('.u-row').forEach((rowEl) => {
      const cs = getComputedStyle(rowEl);
      (rowEl as HTMLElement).style.display = cs.display;
      (rowEl as HTMLElement).style.flexWrap = 'wrap'; // let narrow viewports wrap instead of squeezing columns
      const rowWidth = (rowEl as HTMLElement).offsetWidth || 1;
      rowEl.querySelectorAll(':scope > .u-col').forEach((colEl) => {
        const pct = (((colEl as HTMLElement).offsetWidth / rowWidth) * 100).toFixed(4) + '%';
        (colEl as HTMLElement).style.flex = `1 1 ${pct}`;
        (colEl as HTMLElement).style.maxWidth = pct;
      });
    });

    const result = container.innerHTML;
    document.body.removeChild(container);
    document.head.removeChild(tempStyle);
    return result;
  } catch (e) {
    console.error('Failed to inline Unlayer layout CSS, saving as-is', e);
    try {
      return new DOMParser().parseFromString(html, 'text/html').body.innerHTML;
    } catch {
      return html;
    }
  }
};

interface PageRow {
  id: string;
  title: string;
  slug: string;
  metaDescription?: string | null;
  headerImageUrl?: string | null;
  body?: string | null;
  design?: string | null;
  status: string;
  showInNav: boolean;
  navLabel?: string | null;
}

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('auth')}` });

// A 401/403 (expired/invalid token) was showing up as a generic "Fehler
// beim Duplizieren"/"...Löschen" with no indication the real problem was
// just needing to log back in - this makes that case say so explicitly,
// falling back to the backend's own error/message field otherwise.
const describeApiError = (res: Response, data: any, fallback: string): string => {
  if (res.status === 401 || res.status === 403) return 'Sitzung abgelaufen - bitte neu anmelden und erneut versuchen.';
  return data?.error || data?.message || fallback;
};

// The site's other main pages already have a hand-built React/Tailwind
// design (see Home.tsx, Ausbildung.tsx, etc.) and their own dedicated
// data-only editors (HomeContentEditor.tsx and siblings) - they were never
// part of the Page/Unlayer model above. Listed here too, WordPress-Pages-
// style, purely so the admin has ONE list to click into instead of hunting
// through a sidebar submenu. "Löschen" here can't remove the page itself -
// e.g. /ausbildung is a real route in App.tsx that always exists - so it
// deletes the saved customization row instead (DELETE deletePath), which
// resets the page back to its hardcoded default text/images/links.
// `hasSettings: true` means this kind also has a FixedPageSettings row
// (title/URL/publish-status, redirect-based rename - see
// fixedPageSettings.routes.ts) on top of its content. The 7 /infos/* sub-
// pages don't: they have no top-level hardcoded route of their own to
// redirect from, so only their content (and, below, a full Duplizieren via
// FixedPageDuplicate) is editable, same as the original 6.
const FIXED_PAGES = [
  { title: 'Startseite', editPath: '/admin/home-content', previewPath: '/', deletePath: '/api/homecontent/default', kind: 'home', hasSettings: true },
  { title: 'Ausbildung', editPath: '/admin/ausbildung-content', previewPath: '/ausbildung', deletePath: '/api/sitepagecontent/ausbildung', kind: 'ausbildung', hasSettings: true },
  { title: 'Performance', editPath: '/admin/performance-content', previewPath: '/performance', deletePath: '/api/sitepagecontent/performance', kind: 'performance', hasSettings: true },
  { title: 'Reisen', editPath: '/admin/reisen-content', previewPath: '/reisen', deletePath: '/api/sitepagecontent/reisen', kind: 'reisen', hasSettings: true },
  { title: 'Service', editPath: '/admin/service-content', previewPath: '/service', deletePath: '/api/sitepagecontent/service', kind: 'service', hasSettings: true },
  { title: 'Infos / Kontakt', editPath: '/admin/infos-content', previewPath: '/infos', deletePath: '/api/sitepagecontent/infos', kind: 'infos', hasSettings: true },
  { title: 'Team', editPath: '/admin/team-content', previewPath: '/infos/team', deletePath: '/api/sitepagecontent/team', kind: 'team', hasSettings: true },
  { title: 'Fluggelände', editPath: '/admin/gelaende-content', previewPath: '/infos/gelaende', deletePath: '/api/sitepagecontent/gelaende', kind: 'gelaende', hasSettings: true },
  { title: 'Wetter', editPath: '/admin/wetter-content', previewPath: '/infos/wetter', deletePath: '/api/sitepagecontent/wetter', kind: 'wetter', hasSettings: true },
  { title: 'Medien', editPath: '/admin/medien-content', previewPath: '/infos/medien', deletePath: '/api/sitepagecontent/medien', kind: 'medien', hasSettings: true },
  { title: 'Gruppenevents', editPath: '/admin/gruppenevents-content', previewPath: '/infos/gruppenevents', deletePath: '/api/sitepagecontent/gruppenevents', kind: 'gruppenevents', hasSettings: true },
  { title: 'Gutscheine', editPath: '/admin/gutscheine-content', previewPath: '/infos/gutscheine', deletePath: '/api/sitepagecontent/gutscheine', kind: 'gutscheine', hasSettings: true },
  { title: 'Versicherungen', editPath: '/admin/versicherungen-content', previewPath: '/infos/versicherungen', deletePath: '/api/sitepagecontent/versicherungen', kind: 'versicherungen', hasSettings: true },
  { title: 'Schnupperkurs', editPath: '/admin/schnupperkurs-content', previewPath: '/ausbildung/schnupperkurs', deletePath: '/api/sitepagecontent/schnupperkurs', kind: 'schnupperkurs', hasSettings: true },
  { title: 'L-Schein', editPath: '/admin/l-schein-content', previewPath: '/ausbildung/l-schein', deletePath: '/api/sitepagecontent/l-schein', kind: 'l-schein', hasSettings: true },
  { title: 'A-Schein', editPath: '/admin/a-schein-content', previewPath: '/ausbildung/a-schein', deletePath: '/api/sitepagecontent/a-schein', kind: 'a-schein', hasSettings: true },
  { title: 'B-Schein', editPath: '/admin/b-schein-content', previewPath: '/ausbildung/b-schein', deletePath: '/api/sitepagecontent/b-schein', kind: 'b-schein', hasSettings: true },
  { title: 'Windenschein', editPath: '/admin/windenschein-content', previewPath: '/ausbildung/windenschein', deletePath: '/api/sitepagecontent/windenschein', kind: 'windenschein', hasSettings: true },
  { title: 'Tandemschein', editPath: '/admin/tandemschein-content', previewPath: '/ausbildung/tandemschein', deletePath: '/api/sitepagecontent/tandemschein', kind: 'tandemschein', hasSettings: true },
  { title: 'Ausbildungskonzept', editPath: '/admin/ausbildungskonzept-content', previewPath: '/ausbildung/ausbildungskonzept', deletePath: '/api/sitepagecontent/ausbildungskonzept', kind: 'ausbildungskonzept', hasSettings: true },
  { title: 'Sicherheitstraining', editPath: '/admin/sicherheitstraining-content', previewPath: '/performance/sicherheitstraining', deletePath: '/api/sitepagecontent/sicherheitstraining', kind: 'sicherheitstraining', hasSettings: true },
  { title: 'Rettungsgerätetraining', editPath: '/admin/rettungsgeraetetraining-content', previewPath: '/performance/rettungsgeraetetraining', deletePath: '/api/sitepagecontent/rettungsgeraetetraining', kind: 'rettungsgeraetetraining', hasSettings: true },
  { title: 'Groundhandling', editPath: '/admin/groundhandling-content', previewPath: '/performance/groundhandling', deletePath: '/api/sitepagecontent/groundhandling', kind: 'groundhandling', hasSettings: true },
  { title: 'Brasilien-Tour', editPath: '/admin/brasilien-tour-content', previewPath: '/reisen/brasilien-tour', deletePath: '/api/sitepagecontent/brasilien-tour', kind: 'brasilien-tour', hasSettings: true },
  { title: 'Kolumbien-Tour', editPath: '/admin/kolumbien-tour-content', previewPath: '/reisen/kolumbien-tour', deletePath: '/api/sitepagecontent/kolumbien-tour', kind: 'kolumbien-tour', hasSettings: true },
  { title: 'Südafrika-Tour', editPath: '/admin/suedafrika-tour-content', previewPath: '/reisen/suedafrika-tour', deletePath: '/api/sitepagecontent/suedafrika-tour', kind: 'suedafrika-tour', hasSettings: true },
  { title: 'Bassano-Tour', editPath: '/admin/bassano-tour-content', previewPath: '/reisen/bassano-tour', deletePath: '/api/sitepagecontent/bassano-tour', kind: 'bassano-tour', hasSettings: true },
  { title: 'Griechenland-Tour', editPath: '/admin/griechenland-tour-content', previewPath: '/reisen/griechenland-tour', deletePath: '/api/sitepagecontent/griechenland-tour', kind: 'griechenland-tour', hasSettings: true },
  { title: 'Slowenien-Tour', editPath: '/admin/slowenien-tour-content', previewPath: '/reisen/slowenien-tour', deletePath: '/api/sitepagecontent/slowenien-tour', kind: 'slowenien-tour', hasSettings: true },
  { title: 'Bergamo-Tour', editPath: '/admin/bergamo-tour-content', previewPath: '/reisen/bergamo-tour', deletePath: '/api/sitepagecontent/bergamo-tour', kind: 'bergamo-tour', hasSettings: true },
  { title: 'Savoyer Alpentour', editPath: '/admin/savoye-tour-content', previewPath: '/reisen/savoye-tour', deletePath: '/api/sitepagecontent/savoye-tour', kind: 'savoye-tour', hasSettings: true },
  { title: 'Vogesen-Tour', editPath: '/admin/vogesen-tour-content', previewPath: '/reisen/vogesen-tour', deletePath: '/api/sitepagecontent/vogesen-tour', kind: 'vogesen-tour', hasSettings: true },
  { title: 'Pfalz-Tour', editPath: '/admin/pfalz-tour-content', previewPath: '/reisen/pfalz-tour', deletePath: '/api/sitepagecontent/pfalz-tour', kind: 'pfalz-tour', hasSettings: true },
  { title: '2-Jahres-Check', editPath: '/admin/2-jahres-check-content', previewPath: '/service/2-jahres-check', deletePath: '/api/sitepagecontent/2-jahres-check', kind: '2-jahres-check', hasSettings: true },
  { title: 'Rettungsgeräte-Packservice', editPath: '/admin/rettungspacken-content', previewPath: '/service/rettungspacken', deletePath: '/api/sitepagecontent/rettungspacken', kind: 'rettungspacken', hasSettings: true },
  { title: 'Trimmtuning', editPath: '/admin/trimmtuning-content', previewPath: '/service/trimmtuning', deletePath: '/api/sitepagecontent/trimmtuning', kind: 'trimmtuning', hasSettings: true },
  { title: 'Reparatur-Service', editPath: '/admin/reparatur-content', previewPath: '/service/reparatur', deletePath: '/api/sitepagecontent/reparatur', kind: 'reparatur', hasSettings: true },
  { title: 'Billings', editPath: '/admin/billings-content', previewPath: '/infos/gelaende/billings', deletePath: '/api/sitepagecontent/billings', kind: 'billings', hasSettings: true },
  { title: 'Erlau', editPath: '/admin/erlau-content', previewPath: '/infos/gelaende/erlau', deletePath: '/api/sitepagecontent/erlau', kind: 'erlau', hasSettings: true },
  { title: 'Gadern', editPath: '/admin/gadern-content', previewPath: '/infos/gelaende/gadern', deletePath: '/api/sitepagecontent/gadern', kind: 'gadern', hasSettings: true },
  { title: 'Lindenfels', editPath: '/admin/lindenfels-content', previewPath: '/infos/gelaende/lindenfels', deletePath: '/api/sitepagecontent/lindenfels', kind: 'lindenfels', hasSettings: true },
  { title: 'Nonrod Nordost', editPath: '/admin/nonrod-nordost-content', previewPath: '/infos/gelaende/nonrod-nordost', deletePath: '/api/sitepagecontent/nonrod-nordost', kind: 'nonrod-nordost', hasSettings: true },
  { title: 'Nonroder Höhe', editPath: '/admin/nonrod-content', previewPath: '/infos/gelaende/nonrod', deletePath: '/api/sitepagecontent/nonrod', kind: 'nonrod', hasSettings: true },
  { title: 'Stauf', editPath: '/admin/stauf-content', previewPath: '/infos/gelaende/stauf', deletePath: '/api/sitepagecontent/stauf', kind: 'stauf', hasSettings: true },
  { title: 'Winterkasten', editPath: '/admin/winterkasten-content', previewPath: '/infos/gelaende/winterkasten', deletePath: '/api/sitepagecontent/winterkasten', kind: 'winterkasten', hasSettings: true },
  { title: 'Bad Kreuznach', editPath: '/admin/bad-kreuznach-content', previewPath: '/infos/gelaende/bad-kreuznach', deletePath: '/api/sitepagecontent/bad-kreuznach', kind: 'bad-kreuznach', hasSettings: true },
  { title: 'Herrenteich', editPath: '/admin/herrenteich-content', previewPath: '/infos/gelaende/herrenteich', deletePath: '/api/sitepagecontent/herrenteich', kind: 'herrenteich', hasSettings: true },
  { title: 'FAQ', editPath: '/admin/faq-content', previewPath: '/faq', deletePath: '/api/sitepagecontent/faq', kind: 'faq', hasSettings: true },
  { title: 'Tandem', editPath: '/admin/tandem-content', previewPath: '/tandem', deletePath: '/api/sitepagecontent/tandem', kind: 'tandem', hasSettings: true },
];

// The fixed pages' titles are fixed German text, so a plain substring
// search would miss an admin typing the English word instead (e.g.
// "contact" for "Infos / Kontakt") - these extra terms (both languages)
// are matched in addition to the visible title/URL. Custom Seiten pages
// need no such list since their title is whatever the admin typed.
const FIXED_PAGE_SEARCH_TERMS: Record<string, string[]> = {
  home: ['home', 'startseite', 'start'],
  ausbildung: ['ausbildung', 'training', 'education', 'courses', 'schulung'],
  performance: ['performance', 'leistung'],
  reisen: ['reisen', 'travel', 'trips', 'tours', 'reise'],
  service: ['service', 'dienstleistung'],
  infos: ['infos', 'kontakt', 'info', 'contact', 'information'],
  team: ['team', 'crew', 'mannschaft'],
  gelaende: ['gelände', 'gelaende', 'terrain', 'site', 'location', 'fluggelände'],
  wetter: ['wetter', 'weather'],
  medien: ['medien', 'media', 'videos'],
  gruppenevents: ['gruppenevents', 'group events', 'events'],
  gutscheine: ['gutscheine', 'vouchers', 'gift cards', 'geschenk'],
  versicherungen: ['versicherungen', 'insurance'],
  schnupperkurs: ['schnupperkurs', 'schnuppern', 'taster course', 'trial course'],
  'l-schein': ['l-schein', 'lschein', 'grundkurs', 'basic course'],
  'a-schein': ['a-schein', 'aschein', 'höhenflugkurs', 'hoehenflugkurs'],
  'b-schein': ['b-schein', 'bschein', 'streckenflug'],
  windenschein: ['windenschein', 'winde', 'winch'],
  tandemschein: ['tandemschein', 'tandem', 'passagierflug'],
  ausbildungskonzept: ['ausbildungskonzept', 'concept', 'ausbildungswege'],
  sicherheitstraining: ['sicherheitstraining', 'safety training', 'gardasee'],
  rettungsgeraetetraining: ['rettungsgerätetraining', 'rettungsgeraetetraining', 'reserve training'],
  groundhandling: ['groundhandling', 'ground handling'],
  'brasilien-tour': ['brasilien', 'brazil', 'brasilien-tour'],
  'kolumbien-tour': ['kolumbien', 'colombia', 'kolumbien-tour'],
  'suedafrika-tour': ['südafrika', 'suedafrika', 'south africa', 'suedafrika-tour'],
  'bassano-tour': ['bassano', 'bassano-tour'],
  'griechenland-tour': ['griechenland', 'greece', 'griechenland-tour'],
  'slowenien-tour': ['slowenien', 'slovenia', 'slowenien-tour'],
  'bergamo-tour': ['bergamo', 'bergamo-tour'],
  'savoye-tour': ['savoye', 'savoyen', 'savoy', 'savoye-tour'],
  'vogesen-tour': ['vogesen', 'vosges', 'vogesen-tour'],
  'pfalz-tour': ['pfalz', 'palatinate', 'pfalz-tour'],
  '2-jahres-check': ['2-jahres-check', 'jahrescheck', 'check', 'wartung', 'maintenance'],
  rettungspacken: ['rettungspacken', 'rettungsgeräte', 'rettungsgeraete', 'packservice', 'reserve packing'],
  trimmtuning: ['trimmtuning', 'trim tuning', 'trimmung'],
  reparatur: ['reparatur', 'repair'],
  billings: ['billings', 'fluggelände billings'],
  erlau: ['erlau', 'fluggelände erlau'],
  gadern: ['gadern', 'fluggelände gadern'],
  lindenfels: ['lindenfels', 'fluggelände lindenfels'],
  'nonrod-nordost': ['nonrod nordost', 'nonrod-nordost'],
  nonrod: ['nonrod', 'nonroder höhe', 'nonroder hoehe'],
  stauf: ['stauf', 'fluggelände stauf'],
  winterkasten: ['winterkasten', 'fluggelände winterkasten'],
  'bad-kreuznach': ['bad kreuznach', 'bad-kreuznach', 'mergesfeld'],
  herrenteich: ['herrenteich', 'fluggelände herrenteich'],
  faq: ['faq', 'fragen', 'häufig gestellte fragen', 'haeufig gestellte fragen', 'questions'],
  tandem: ['tandem', 'tandemflug', 'passagierflug'],
};

const textMatches = (query: string, ...values: Array<string | null | undefined>) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return values.some((v) => (v || '').toLowerCase().includes(q));
};

// Strips query/hash and a trailing slash so a menu item's `url` and a
// page's own resolved preview path compare equal even with small
// formatting differences (e.g. a trailing "/").
const normalizeUrl = (url: string) => (url || '').split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';

// A TRUE same-design duplicate of one of the 6 fixed pages above (see
// FixedPageDuplicate model / fixedPageDuplicates.routes.ts): rendered by the
// exact same hardcoded component as the original (FixedPageRouter.tsx on
// the frontend), so its design is pixel-identical - unlike "Duplizieren" on
// a custom Seiten/Unlayer page below, which copies real Unlayer blocks.
interface FixedDuplicateRow {
  id: string;
  slug: string;
  kind: string;
  title: string;
  showInNav: boolean;
  navLabel?: string | null;
}

// Live settings for one of the 6 fixed pages themselves - see
// FixedPageSettings model / fixedPageSettings.routes.ts.
interface FixedPageSettingsRow {
  kind: string;
  slug: string | null;
  title: string;
  status: string;
}

// The header nav tree (see MenuManager.tsx / menu.routes.ts), used only to
// GROUP this same list of pages/duplicates/custom pages by where they
// actually sit in the site's navigation instead of listing them flat - an
// admin thinking "where's the Ausbildung page's sub-pages" can look under
// the "Ausbildung" menu item the same way they'd find it in Menü itself.
interface MenuItemRow {
  id: string;
  label: string;
  url: string;
  subItems: { id: string; label: string; url: string }[];
}

export const PagesManager = () => {
  const notify = useNotify();
  const navigate = useNavigate();
  const emailEditorRef = useRef<any>(null);
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A live preview rendered BELOW the Unlayer canvas, using the real site's
  // own CSS (SafeHtml + .dynamic-page-content, same as DynamicPage.tsx) -
  // Unlayer's own editing canvas runs inside an isolated iframe that never
  // loads this site's Tailwind stylesheet, so anything beyond Unlayer's own
  // built-in block styling (a custom HTML block with Tailwind classes, for
  // instance) looks broken/unstyled while editing even though it renders
  // correctly once actually published - this closes that gap without
  // leaving the drag-and-drop editor at all.
  const [previewHtml, setPreviewHtml] = useState('');

  const refreshPreview = () => {
    const editor = emailEditorRef.current?.editor;
    if (!editor) return;
    editor.exportHtml((data: { html?: string }) => {
      // data.html can come back undefined if the export races the iframe's
      // own readiness - inlineUnlayerLayoutCss would otherwise coerce that
      // to the literal string "undefined" via DOMParser (confirmed: this
      // is exactly what showed up in the live preview once). Guard instead
      // of trusting the payload.
      if (!data?.html) return;
      setPreviewHtml(inlineUnlayerLayoutCss(data.html));
    });
  };

  const handleDesignUpdated = () => {
    if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    previewDebounceRef.current = setTimeout(refreshPreview, 600);
  };

  const [pages, setPages] = useState<PageRow[]>([]);
  const [fixedDuplicates, setFixedDuplicates] = useState<FixedDuplicateRow[]>([]);
  const [fixedSettings, setFixedSettings] = useState<Record<string, FixedPageSettingsRow>>({});
  const [menuItems, setMenuItems] = useState<MenuItemRow[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'flat' | 'menu'>('flat');
  const [loading, setLoading] = useState(true);
  // fetchPages()/fetchFixedDuplicates() below used to swallow a 401/403
  // (expired login - tokens last 1 day) into a silent empty array: a custom
  // Page (like a "Seiten"-converted duplicate) would just vanish from the
  // list with zero indication why, indistinguishable from "never created".
  // Same root cause already fixed across the ~50 ...ContentEditor.tsx pages
  // (see sessionExpiry.ts) - PagesManager was missed there since it's a
  // list/editor hybrid, not that same boilerplate shape.
  const [sessionExpired, setSessionExpired] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [editing, setEditing] = useState<PageRow | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugError, setSlugError] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [headerImageUrl, setHeaderImageUrl] = useState('');
  const [status, setStatus] = useState('published');
  const [showInNav, setShowInNav] = useState(true);
  const [navLabel, setNavLabel] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formPickerOpen, setFormPickerOpen] = useState(false);
  const [availableForms, setAvailableForms] = useState<{ id: string; title: string }[]>([]);
  const [formsLoading, setFormsLoading] = useState(false);
  const [selectedFormId, setSelectedFormId] = useState('');
  const [newsletterFormPickerOpen, setNewsletterFormPickerOpen] = useState(false);
  const [availableNewsletterForms, setAvailableNewsletterForms] = useState<{ id: string; name: string }[]>([]);
  const [newsletterFormsLoading, setNewsletterFormsLoading] = useState(false);
  const [selectedNewsletterFormId, setSelectedNewsletterFormId] = useState('');

  const fetchPages = () => {
    setLoading(true);
    fetch('/api/pages?_start=0&_end=200', { headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => { setSessionExpired(false); setPages(Array.isArray(data) ? data : []); })
      .catch((err) => {
        if (isSessionExpiredError(err)) setSessionExpired(true);
        else notify('Fehler beim Laden der Seiten', { type: 'error' });
      })
      .finally(() => setLoading(false));
  };

  const fetchFixedDuplicates = () => {
    fetch('/api/fixed-page-duplicates', { headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setFixedDuplicates(Array.isArray(data) ? data : []))
      .catch((err) => {
        if (isSessionExpiredError(err)) setSessionExpired(true);
        else notify('Fehler beim Laden der Seiten-Duplikate', { type: 'error' });
      });
  };

  // Live title/URL/status for the 6 fixed pages THEMSELVES (editable via
  // "Seiten-Einstellungen" in their content editors - see
  // FixedPageSettings model / fixedPageSettings.routes.ts), keyed by kind
  // so each FIXED_PAGES row can show its current values instead of the
  // hardcoded defaults once an admin has renamed/drafted one.
  const fetchFixedSettings = () => {
    fetch('/api/fixed-page-settings', { headers: authHeaders() })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const byKind: Record<string, FixedPageSettingsRow> = {};
        (Array.isArray(data) ? data : []).forEach((row: FixedPageSettingsRow) => { byKind[row.kind] = row; });
        setFixedSettings(byKind);
      })
      .catch(() => notify('Fehler beim Laden der Seiten-Einstellungen', { type: 'error' }));
  };

  // The header nav tree, purely for the "Nach Menü" grouping view below -
  // fetched once regardless of which view is active so switching to it is
  // instant, same as the other lists here.
  const fetchMenuItems = () => {
    setMenuLoading(true);
    fetch('/api/menuitems?location=header', { headers: authHeaders() })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setMenuItems(Array.isArray(data) ? data : []))
      .catch(() => notify('Fehler beim Laden der Menüstruktur', { type: 'error' }))
      .finally(() => setMenuLoading(false));
  };

  useEffect(fetchPages, []);
  useEffect(fetchFixedDuplicates, []);
  useEffect(fetchFixedSettings, []);
  useEffect(fetchMenuItems, []);

  const openCreate = () => {
    setEditing(null);
    setTitle('');
    setSlug('');
    setSlugError('');
    setMetaDescription('');
    setHeaderImageUrl('');
    setStatus('published');
    setShowInNav(true);
    setNavLabel('');
    setIsEditorOpen(true);
  };

  const openEdit = (page: PageRow) => {
    setEditing(page);
    setTitle(page.title);
    setSlug(page.slug);
    setSlugError('');
    setMetaDescription(page.metaDescription || '');
    setHeaderImageUrl(page.headerImageUrl || '');
    setStatus(page.status);
    setShowInNav(page.showInNav);
    setNavLabel(page.navLabel || '');
    setIsEditorOpen(true);
  };

  // PAGE ARTICLE MODE: "/admin/pages?editPage=<id>" (the Joomla editor's
  // "Felder-Editor (alt)" link for custom pages) opens that page's Unlayer
  // editor directly.
  const [searchParams, setSearchParams] = useSearchParams();
  const editPageParam = searchParams.get('editPage');
  useEffect(() => {
    if (!editPageParam) return;
    const target = pages.find((p) => p.id === editPageParam);
    if (!target) return;
    openEdit(target);
    setSearchParams({}, { replace: true });
    // openEdit only sets editor state for the page found here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editPageParam, pages]);

  const closeEditor = () => {
    setIsEditorOpen(false);
    setEditing(null);
    setPreviewHtml('');
  };

  const onEditorLoad = () => {
    if (editing?.design) {
      try {
        emailEditorRef.current?.editor?.loadDesign(JSON.parse(editing.design));
      } catch (e) {
        console.error('Failed to parse page design JSON', e);
      }
    }
    // Unlayer defaults every row's content width to 500px (an email-template
    // default, since the same editor is also used for AcyMailing newsletters
    // - see EditEmail.tsx). Left alone, that's the actual root cause of the
    // "alignment problem" reported for Seiten pages: a 500px-wide island of
    // content sitting inside DynamicPage.tsx's ~1200px container, with huge
    // empty gutters on both sides, no matter how careful the design is.
    // Setting it here makes the editor's own canvas match the live page's
    // real width, so what the admin designs is what actually renders -
    // applies to rows added from here on; existing pages' already-saved
    // rows are additionally corrected at export time, see
    // inlineUnlayerLayoutCss below.
    emailEditorRef.current?.editor?.setBodyValues({ contentWidth: '1200px' });
  };

  // onLoad fires as soon as the editor INSTANCE exists - early enough for
  // loadDesign (which just posts a message into the iframe) but confirmed
  // too early for exportHtml: calling it from onLoad kept getting back a
  // `data` with no usable `design.body` (crashed once with "Cannot read
  // properties of undefined (reading 'body')", then after a 500ms guess-
  // delay just silently produced an empty/undefined export instead - the
  // canvas stayed on "No content here" and the live-preview panel rendered
  // the literal string "undefined"). onReady is the SDK's own signal that
  // the iframe bridge has actually finished initializing and operations
  // like exportHtml are safe to call - using it instead of a fixed delay
  // fixes the race at its root rather than guessing a bigger number.
  const onEditorReady = () => {
    const editor = emailEditorRef.current?.editor;
    if (!editor) return;

    if (!editing?.design && editing?.body) {
      // This page has real HTML (body) but no Unlayer design JSON of its
      // own yet - e.g. a page migrated in by a script, never actually
      // authored through this editor. NEVER hand-build a design object
      // from scratch here (confirmed the hard way: a hand-crafted design
      // missing Unlayer's own internal bookkeeping fields - counters, node
      // ids, etc. - "loads" with no thrown error, but leaves the editor in
      // a broken state that crashes the whole admin app the moment
      // anything touches it afterward). Instead, ask Unlayer for ITS OWN
      // freshly-initialized design via exportHtml() first, then push body
      // in as a single content block - the exact same proven-safe
      // row-append pattern insertGallery/insertForm/insertNewsletterForm
      // already use elsewhere in this file.
      const bodyToInsert = editing.body;
      editor.exportHtml((data: any) => {
        const design = data?.design;
        if (!design?.body?.rows) {
          console.error('exportHtml returned no usable design on ready, skipping body import', data);
          refreshPreview();
          return;
        }
        design.body.rows.push({
          cells: [1],
          columns: [{ contents: [{ type: 'text', values: { text: bodyToInsert, padding: '0px' } }], values: {} }],
          values: {},
        });
        editor.loadDesign(design);
        refreshPreview();
      });
    } else {
      refreshPreview();
    }
  };

  // Lets a Seiten page embed the same admin-managed gallery (Admin >
  // Galerie) that the hardcoded pages use via usePageGallery - Unlayer
  // itself can only ever export static HTML, so this inserts a plain
  // placeholder div carrying this page's slug as a data attribute; the live
  // DynamicPage.tsx finds that placeholder after render and mounts the
  // actual gallery into it via a React portal (see PageGalleryBlock.tsx).
  // Requires the URL field to be filled in first, since the placeholder has
  // to be tied to a real slug - "Admin > Galerie" is where the images for
  // that slug then get uploaded/managed, exactly as for any other page.
  const insertGallery = () => {
    const normalizedSlug = normalizeSlug(slug || title);
    if (!normalizedSlug) {
      notify('Bitte zuerst Titel oder URL ausfüllen, bevor eine Galerie eingefügt wird.', { type: 'warning' });
      return;
    }
    const editor = emailEditorRef.current?.editor;
    if (!editor) return;
    const placeholderHtml =
      `<div class="page-gallery-block" data-gallery-slug="${normalizedSlug}" ` +
      `style="border:2px dashed #0ea5e9;padding:24px;text-align:center;color:#0ea5e9;font-family:sans-serif;font-size:14px;">` +
      `📷 Galerie-Platzhalter (Bilder unter Admin &gt; Galerie &gt; "${normalizedSlug}" verwalten)</div>`;

    editor.exportHtml((data: any) => {
      const design = data.design;
      design.body.rows.push({
        cells: [1],
        columns: [{
          contents: [{
            type: 'text',
            values: { text: placeholderHtml, padding: '0px' }
          }],
          values: {}
        }],
        values: {}
      });
      editor.loadDesign(design);
    });
  };

  // "Formular einfügen" - same real placeholder-div bridge as Galerie above
  // (see DynamicPage.tsx's PLACEHOLDER_RE/PageFormBlock), just keyed by
  // form id instead of the page's own slug since a page can embed ANY
  // existing form (Admin > Formulare), not just one tied to itself.
  const openFormPicker = () => {
    setSelectedFormId('');
    setFormPickerOpen(true);
    setFormsLoading(true);
    fetch('/api/formconfigs?_start=0&_end=100', { headers: authHeaders() })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setAvailableForms(Array.isArray(data) ? data.map((f: any) => ({ id: f.id, title: f.title })) : []))
      .catch(() => notify('Fehler beim Laden der Formulare', { type: 'error' }))
      .finally(() => setFormsLoading(false));
  };

  const insertForm = () => {
    if (!selectedFormId) return;
    const editor = emailEditorRef.current?.editor;
    if (!editor) return;
    const chosen = availableForms.find((f) => f.id === selectedFormId);
    const placeholderHtml =
      `<div class="page-form-block" data-form-id="${selectedFormId}" ` +
      `style="border:2px dashed #0ea5e9;padding:24px;text-align:center;color:#0ea5e9;font-family:sans-serif;font-size:14px;">` +
      `📝 Formular-Platzhalter ("${chosen?.title || selectedFormId}")</div>`;

    editor.exportHtml((data: any) => {
      const design = data.design;
      design.body.rows.push({
        cells: [1],
        columns: [{
          contents: [{
            type: 'text',
            values: { text: placeholderHtml, padding: '0px' }
          }],
          values: {}
        }],
        values: {}
      });
      editor.loadDesign(design);
    });
    setFormPickerOpen(false);
  };

  // "Newsletter-Formular einfügen" - same placeholder-div bridge again, this
  // time for an AcyMailing subscription form (Admin > AcyMailing > Formulare)
  // instead of a Visforms form.
  const openNewsletterFormPicker = () => {
    setSelectedNewsletterFormId('');
    setNewsletterFormPickerOpen(true);
    setNewsletterFormsLoading(true);
    fetch('/api/newsletterforms?_start=0&_end=100', { headers: authHeaders() })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setAvailableNewsletterForms(Array.isArray(data) ? data.map((f: any) => ({ id: f.id, name: f.name })) : []))
      .catch(() => notify('Fehler beim Laden der Newsletter-Formulare', { type: 'error' }))
      .finally(() => setNewsletterFormsLoading(false));
  };

  const insertNewsletterForm = () => {
    if (!selectedNewsletterFormId) return;
    const editor = emailEditorRef.current?.editor;
    if (!editor) return;
    const chosen = availableNewsletterForms.find((f) => f.id === selectedNewsletterFormId);
    const placeholderHtml =
      `<div class="page-newsletter-form-block" data-newsletter-form-id="${selectedNewsletterFormId}" ` +
      `style="border:2px dashed #0ea5e9;padding:24px;text-align:center;color:#0ea5e9;font-family:sans-serif;font-size:14px;">` +
      `📧 Newsletter-Formular-Platzhalter ("${chosen?.name || selectedNewsletterFormId}")</div>`;

    editor.exportHtml((data: any) => {
      const design = data.design;
      design.body.rows.push({
        cells: [1],
        columns: [{
          contents: [{
            type: 'text',
            values: { text: placeholderHtml, padding: '0px' }
          }],
          values: {}
        }],
        values: {}
      });
      editor.loadDesign(design);
    });
    setNewsletterFormPickerOpen(false);
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', headers: authHeaders(), body: formData });
      const data = await res.json();
      if (res.ok) setHeaderImageUrl(data.url);
      else notify(data.message || 'Fehler beim Upload', { type: 'warning' });
    } catch {
      notify('Netzwerkfehler beim Upload', { type: 'warning' });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleSlugBlur = () => {
    const normalized = normalizeSlug(slug || title);
    setSlug(normalized);
    setSlugError(RESERVED_SLUGS.has(normalized) ? `"${normalized}" ist reserviert und kann nicht verwendet werden.` : '');
  };

  const handleSave = () => {
    if (!title.trim()) {
      notify('Titel ist erforderlich', { type: 'warning' });
      return;
    }
    const normalizedSlug = normalizeSlug(slug || title);
    if (RESERVED_SLUGS.has(normalizedSlug)) {
      notify(`"${normalizedSlug}" ist reserviert und kann nicht verwendet werden.`, { type: 'warning' });
      return;
    }

    setSaving(true);
    emailEditorRef.current?.editor?.exportHtml(async (data: { design: any; html: string }) => {
      const { design, html } = data;
      // Unlayer's exportHtml returns a full HTML document - only the <body>
      // content is embedded into the page template (which already has its
      // own <html>/<head>/nav/footer), so pull just that out. The <head>'s
      // <style> block can't come along for the ride (DOMPurify strips any
      // <style> tag on render, even with ADD_TAGS - confirmed empirically),
      // but that block is what makes a multi-column row (.u-row/.u-col-*)
      // actually sit side-by-side instead of collapsing to one column. Fix:
      // inlineUnlayerLayoutCss below renders the exported HTML in a real,
      // hidden DOM node so the browser computes the layout for real, then
      // bakes the resulting display/flex-basis/width values onto each
      // element as inline style="..." (which DOES survive DOMPurify).
      const bodyHtml = inlineUnlayerLayoutCss(html);

      try {
        const url = editing ? `/api/pages/${editing.id}` : '/api/pages';
        const method = editing ? 'PUT' : 'POST';
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({
            title,
            slug: normalizedSlug,
            metaDescription,
            headerImageUrl,
            status,
            showInNav,
            navLabel,
            body: bodyHtml,
            design: JSON.stringify(design),
          }),
        });
        const resData = await res.json().catch(() => ({}));
        if (!res.ok) {
          notify(resData.error || 'Fehler beim Speichern', { type: 'error' });
          return;
        }
        notify('Seite gespeichert', { type: 'success' });
        closeEditor();
        fetchPages();
      } catch {
        notify('Netzwerkfehler beim Speichern', { type: 'error' });
      } finally {
        setSaving(false);
      }
    });
  };

  const handleDuplicate = async (page: PageRow) => {
    try {
      const res = await fetch(`/api/pages/${page.id}/duplicate`, { method: 'POST', headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(describeApiError(res, data, 'Fehler beim Duplizieren'), { type: 'error' });
        return;
      }
      notify(`Duplikat erstellt: "${data.title}" - auf "Bearbeiten" klicken um sie umzubenennen`, { type: 'success' });
      fetchPages();
    } catch {
      notify('Netzwerkfehler beim Duplizieren', { type: 'error' });
    }
  };

  const handleDuplicateFixed = async (page: (typeof FIXED_PAGES)[number]) => {
    try {
      const res = await fetch('/api/fixed-page-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ kind: page.kind }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(describeApiError(res, data, 'Fehler beim Duplizieren'), { type: 'error' });
        return;
      }
      notify(`Duplikat erstellt: "${data.title}" - mit exakt dem gleichen Design wie "${page.title}". Auf "Bearbeiten" klicken um Inhalte anzupassen oder umzubenennen.`, { type: 'success' });
      fetchFixedDuplicates();
    } catch {
      notify('Netzwerkfehler beim Duplizieren', { type: 'error' });
    }
  };

  const handleDuplicateFixedDuplicate = async (dup: FixedDuplicateRow) => {
    try {
      const res = await fetch(`/api/fixed-page-duplicates/${dup.id}/duplicate`, { method: 'POST', headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(describeApiError(res, data, 'Fehler beim Duplizieren'), { type: 'error' });
        return;
      }
      notify(`Duplikat erstellt: "${data.title}" - auf "Bearbeiten" klicken um sie umzubenennen`, { type: 'success' });
      fetchFixedDuplicates();
    } catch {
      notify('Netzwerkfehler beim Duplizieren', { type: 'error' });
    }
  };

  const handleDeleteFixedDuplicate = async (dup: FixedDuplicateRow) => {
    try {
      const res = await fetch(`/api/fixed-page-duplicates/${dup.id}`, { method: 'DELETE', headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(describeApiError(res, data, 'Fehler beim Löschen'), { type: 'error' });
        return;
      }
      notify('In den Papierkorb verschoben', { type: 'success' });
      fetchFixedDuplicates();
    } catch {
      notify('Netzwerkfehler beim Löschen', { type: 'error' });
    }
  };

  const handleDelete = async (page: PageRow) => {
    try {
      const res = await fetch(`/api/pages/${page.id}`, { method: 'DELETE', headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(describeApiError(res, data, 'Fehler beim Löschen'), { type: 'error' });
        return;
      }
      notify('In den Papierkorb verschoben', { type: 'success' });
      fetchPages();
    } catch {
      notify('Netzwerkfehler beim Löschen', { type: 'error' });
    }
  };

  const handleResetFixedPage = async (page: (typeof FIXED_PAGES)[number]) => {
    try {
      const contentRes = await fetch(page.deletePath, { method: 'DELETE', headers: authHeaders() });
      const data = await contentRes.json().catch(() => ({}));
      if (!contentRes.ok) {
        notify(describeApiError(contentRes, data, 'Fehler beim Löschen'), { type: 'error' });
        return;
      }
      if (!page.hasSettings) {
        notify(`"${page.title}" in den Papierkorb verschoben`, { type: 'success' });
        return;
      }
      const settingsRes = await fetch(`/api/fixed-page-settings/${page.kind}`, { method: 'DELETE', headers: authHeaders() });
      if (!settingsRes.ok) {
        notify('Inhalte zurückgesetzt, aber Titel/URL/Status konnten nicht zurückgesetzt werden', { type: 'warning' });
      } else {
        notify(`"${page.title}" in den Papierkorb verschoben`, { type: 'success' });
      }
      fetchFixedSettings();
    } catch {
      notify('Netzwerkfehler beim Löschen', { type: 'error' });
    }
  };

  if (isEditorOpen) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 96px)' }}>
        <Box sx={{ p: 2, borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', bgcolor: '#fff' }}>
          <IconButton onClick={closeEditor} title="Zurück"><ArrowBackIcon /></IconButton>
          <TextField label="Titel" value={title} onChange={(e) => setTitle(e.target.value)} size="small" fullWidth={false} sx={{ width: 180 }} />
          <TextField
            label="URL"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            onBlur={handleSlugBlur}
            error={!!slugError}
            helperText={slugError || 'z.B. ueber-uns'}
            size="small"
            fullWidth={false}
            sx={{ width: 180 }}
          />
          <TextField select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} size="small" fullWidth={false} sx={{ width: 140 }}>
            <MenuItem value="published">Veröffentlicht</MenuItem>
            <MenuItem value="draft">Entwurf</MenuItem>
          </TextField>
          <Button
            component="label"
            size="small"
            variant="outlined"
            startIcon={uploading ? <CircularProgress size={16} /> : <UploadIcon />}
            disabled={uploading}
          >
            {headerImageUrl ? 'Titelbild ersetzen' : 'Titelbild hochladen'}
            <input type="file" accept="image/*" hidden onChange={handleUpload} />
          </Button>
          {headerImageUrl && <Box component="img" src={headerImageUrl} alt="" sx={{ height: 36, borderRadius: 1 }} />}
          <Button variant="outlined" startIcon={<PhotoLibraryIcon />} onClick={insertGallery}>
            Galerie einfügen
          </Button>
          <Button variant="outlined" startIcon={<DynamicFormIcon />} onClick={openFormPicker}>
            Formular einfügen
          </Button>
          <Button variant="outlined" startIcon={<MailOutlineIcon />} onClick={openNewsletterFormPicker}>
            Newsletter-Formular einfügen
          </Button>
          <Box sx={{ flexGrow: 1 }} />
          <Button variant="contained" color="success" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving}>
            Speichern
          </Button>
        </Box>
        <Box sx={{ flex: 1 }}>
          <EmailEditor
            ref={emailEditorRef}
            onLoad={onEditorLoad}
            onReady={onEditorReady}
            onDesignUpdated={handleDesignUpdated}
            style={{ minHeight: '100%' }}
            options={{ locale: 'de-DE', displayMode: 'web' }}
          />
        </Box>

        {/* Live-Vorschau: renders the same exported HTML with the real site's
            CSS (SafeHtml, .dynamic-page-content) instead of Unlayer's own
            isolated iframe styling - updates automatically a moment after
            any block is added/moved/edited above. */}
        <Box sx={{ borderTop: '1px solid #e0e0e0', bgcolor: '#f4f6f8' }}>
          <Box sx={{ px: 2, py: 1, borderBottom: '1px solid #e0e0e0', bgcolor: '#fff' }}>
            <Typography variant="subtitle2" sx={{ color: '#666' }}>Live-Vorschau (so sieht die Seite live aus)</Typography>
          </Box>
          <Box sx={{ bgcolor: '#fff', maxWidth: '1200px', mx: 'auto', px: 4, py: 4 }}>
            {previewHtml ? (
              // SafeHtml calls useLightbox() unconditionally (for click-to-
              // zoom on content images) - the admin app has no
              // LightboxProvider anywhere in its tree (only the public site
              // does), so without this wrapper it throws "useLightbox must
              // be used within a LightboxProvider" the instant any preview
              // with an image renders, crashing the whole admin app.
              <LightboxProvider>
                <SafeHtml html={previewHtml} className="dynamic-page-content" />
              </LightboxProvider>
            ) : (
              <Typography variant="body2" sx={{ color: '#999', textAlign: 'center', py: 4 }}>Vorschau wird geladen...</Typography>
            )}
          </Box>
        </Box>

        <Dialog open={formPickerOpen} onClose={() => setFormPickerOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Formular einfügen</DialogTitle>
          <DialogContent>
            {formsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={28} /></Box>
            ) : availableForms.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Keine Formulare vorhanden. Unter Admin &gt; Formulare kann eines angelegt werden.
              </Typography>
            ) : (
              <TextField
                select
                fullWidth
                label="Formular"
                value={selectedFormId}
                onChange={(e) => setSelectedFormId(e.target.value)}
                margin="dense"
              >
                {availableForms.map((f) => (
                  <MenuItem key={f.id} value={f.id}>{f.title}</MenuItem>
                ))}
              </TextField>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setFormPickerOpen(false)}>Abbrechen</Button>
            <Button variant="contained" onClick={insertForm} disabled={!selectedFormId}>Einfügen</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={newsletterFormPickerOpen} onClose={() => setNewsletterFormPickerOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Newsletter-Formular einfügen</DialogTitle>
          <DialogContent>
            {newsletterFormsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={28} /></Box>
            ) : availableNewsletterForms.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Keine Newsletter-Formulare vorhanden. Unter Flugschule Mailing &gt; Formulare kann eines angelegt werden.
              </Typography>
            ) : (
              <TextField
                select
                fullWidth
                label="Newsletter-Formular"
                value={selectedNewsletterFormId}
                onChange={(e) => setSelectedNewsletterFormId(e.target.value)}
                margin="dense"
              >
                {availableNewsletterForms.map((f) => (
                  <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>
                ))}
              </TextField>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setNewsletterFormPickerOpen(false)}>Abbrechen</Button>
            <Button variant="contained" onClick={insertNewsletterForm} disabled={!selectedNewsletterFormId}>Einfügen</Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  const filteredFixedPages = FIXED_PAGES.filter((page) => {
    const live = fixedSettings[page.kind];
    return textMatches(
      search,
      page.title,
      page.previewPath,
      live?.title,
      live?.slug ? `/${live.slug}` : null,
      ...(FIXED_PAGE_SEARCH_TERMS[page.kind] || [])
    );
  });
  const filteredFixedDuplicates = fixedDuplicates.filter((dup) =>
    textMatches(search, dup.title, `/${dup.slug}`, dup.navLabel, ...(FIXED_PAGE_SEARCH_TERMS[dup.kind] || []))
  );
  const filteredPages = pages.filter((page) => textMatches(search, page.title, page.slug, page.metaDescription, page.navLabel));
  const noResults =
    !loading &&
    !!search.trim() &&
    filteredFixedPages.length === 0 &&
    filteredFixedDuplicates.length === 0 &&
    filteredPages.length === 0;

  // One combined, paginated list (fixed pages incl. /infos/* sub-pages +
  // their duplicates + custom Seiten pages) so a single "Zeilen pro Seite"
  // control (matching Gallery.tsx's react-admin pagination) covers
  // everything, instead of separately-scrolling sections - sorted A-Z by
  // title (German collation) so it reads as one alphabetical list rather
  // than fixed/duplicate/custom pages each clustered in their own order.
  type DisplayRow =
    | { key: string; rowKind: 'fixed'; page: (typeof FIXED_PAGES)[number] }
    | { key: string; rowKind: 'duplicate'; dup: FixedDuplicateRow }
    | { key: string; rowKind: 'custom'; page: PageRow };
  // Title shown in the "Titel" column - same fallback logic each row type
  // already uses when rendering, pulled out here too so the flat "Alle
  // Seiten" view can be sorted A-Z across fixed pages, duplicates and
  // custom Seiten pages together, not just within each group.
  const rowTitle = (row: DisplayRow): string => {
    if (row.rowKind === 'fixed') return fixedSettings[row.page.kind]?.title || row.page.title;
    if (row.rowKind === 'duplicate') return row.dup.title;
    return row.page.title;
  };

  const allRows: DisplayRow[] = [
    ...filteredFixedPages.map((page): DisplayRow => ({ key: `fixed:${page.kind}`, rowKind: 'fixed', page })),
    ...filteredFixedDuplicates.map((dup): DisplayRow => ({ key: `dup:${dup.id}`, rowKind: 'duplicate', dup })),
    ...(loading ? [] : filteredPages.map((page): DisplayRow => ({ key: `custom:${page.id}`, rowKind: 'custom', page }))),
  ].sort((a, b) => rowTitle(a).localeCompare(rowTitle(b), 'de', { sensitivity: 'base' }));
  const pageCount = Math.max(1, Math.ceil(allRows.length / perPage));
  const clampedPage = Math.min(page, pageCount);
  const startIdx = (clampedPage - 1) * perPage;
  const pageRows = allRows.slice(startIdx, startIdx + perPage);
  const rangeStart = allRows.length === 0 ? 0 : startIdx + 1;
  const rangeEnd = Math.min(startIdx + perPage, allRows.length);

  // The same URL logic each row already renders in its own TableCell below
  // - pulled out here too so a row can be matched against a menu item's
  // `url` for the "Nach Menü" grouping.
  const rowUrl = (row: DisplayRow): string => {
    if (row.rowKind === 'fixed') {
      const live = fixedSettings[row.page.kind];
      return live?.slug ? `/${live.slug}` : row.page.previewPath;
    }
    if (row.rowKind === 'duplicate') return `/${row.dup.slug}`;
    return row.page.slug === 'home' ? '/' : `/${row.page.slug}`;
  };

  // Groups the same rows above by where they sit in the header nav
  // (MenuManager.tsx) instead of listing them flat: each top-level menu
  // item becomes a group (rendered as its own row when it resolves to an
  // editable page, e.g. "Ausbildung"), with its sub-items' matching pages
  // indented underneath (e.g. Schnupperkurs, L-Schein, ...). A menu entry
  // that doesn't resolve to any editable page (an external link, a
  // functional route like /buchungskalender, a tour page not in this CMS)
  // is simply left out rather than shown as a dead row. Pages that exist
  // but aren't in the header menu at all (footer-only links, pages nobody
  // added to nav yet) land in a trailing "Nicht im Menü" bucket so nothing
  // silently disappears from the list.
  const urlToRow = new Map<string, DisplayRow>();
  allRows.forEach((row) => urlToRow.set(normalizeUrl(rowUrl(row)), row));
  const matchedKeys = new Set<string>();
  const menuGroups = menuItems.map((item) => {
    const ownRow = urlToRow.get(normalizeUrl(item.url));
    if (ownRow) matchedKeys.add(ownRow.key);
    const subRows = item.subItems
      .map((sub) => urlToRow.get(normalizeUrl(sub.url)))
      .filter((row): row is DisplayRow => !!row);
    subRows.forEach((row) => matchedKeys.add(row.key));
    return { label: item.label, ownRow, subRows };
  });
  const unmatchedRows = allRows.filter((row) => !matchedKeys.has(row.key));

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  // `indent` > 0 only in the "Nach Menü" view, for a row shown nested under
  // its parent menu item (e.g. Schnupperkurs under Ausbildung) - purely a
  // visual cue (extra left padding + a small tree marker), the row itself
  // behaves identically either way.
  // PAGE ARTICLE MODE - opens the Joomla-style body editor for a page.
  // `fieldsPath`: the page's older field-based editor, linked from there.
  const articleEditorUrl = (key: string, path: string, title: string, fieldsPath?: string) =>
    `/admin/page-article/${encodeURIComponent(key)}?path=${encodeURIComponent(path)}&title=${encodeURIComponent(title)}${fieldsPath ? `&fields=${encodeURIComponent(fieldsPath)}` : ''}`;
  const openArticleEditor = (key: string, path: string, title: string, fieldsPath?: string) =>
    navigate(articleEditorUrl(key, path, title, fieldsPath));
  // The old field editor, with a way back to the new one (BackToArticleEditor.tsx).
  const openFieldsEditor = (key: string, path: string, title: string, fieldsPath: string) =>
    navigate(fieldsPath, { state: { backToArticle: articleEditorUrl(key, path, title, fieldsPath) } });

  const renderRow = (row: DisplayRow, indent = 0) => {
    const titleCellSx = { pl: indent ? 2 + indent * 3 : 2 };
    const indentMarker = indent > 0 && <Typography component="span" sx={{ color: '#bbb', mr: 1 }}>↳</Typography>;

    if (row.rowKind === 'fixed') {
      const { page } = row;
      const live = fixedSettings[page.kind];
      const title = live?.title || page.title;
      const previewPath = live?.slug ? `/${live.slug}` : page.previewPath;
      return (
        <TableRow key={row.key} hover onClick={() => openArticleEditor(page.kind, previewPath, title, page.editPath)} sx={{ cursor: 'pointer' }}>
          <TableCell sx={titleCellSx}>{indentMarker}{title}</TableCell>
          <TableCell>{previewPath}</TableCell>
          <TableCell>{live?.status === 'draft' ? 'Entwurf' : 'Veröffentlicht'}</TableCell>
          <TableCell align="right" onClick={(e) => e.stopPropagation()}>
            <IconButton
              size="small"
              component="a"
              href={previewPath}
              target="_blank"
              rel="noopener noreferrer"
              title="Vorschau (öffnet die Seite in einem neuen Tab)"
            >
              <OpenInNewIcon fontSize="small" />
            </IconButton>
            {/* PAGE ARTICLE MODE - Bearbeiten opens the Joomla-style page editor; the older field editor stays reachable */}
            <IconButton size="small" onClick={() => openArticleEditor(page.kind, previewPath, title, page.editPath)} title="Bearbeiten">
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => openFieldsEditor(page.kind, previewPath, title, page.editPath)} title="Felder-Editor (alt)">
              <ArticleIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => handleDuplicateFixed(page)} title="Duplizieren (erstellt eine neue Seite mit exakt dem gleichen Design/Layout)">
              <ContentCopyIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => handleResetFixedPage(page)} title="Löschen (setzt Inhalte, Titel, URL und Status auf die Standardwerte zurück)">
              <DeleteIcon fontSize="small" color="error" />
            </IconButton>
          </TableCell>
        </TableRow>
      );
    }
    if (row.rowKind === 'duplicate') {
      const { dup } = row;
      const original = FIXED_PAGES.find((p) => p.kind === dup.kind);
      const editPath = original ? `${original.editPath}/${dup.slug}` : undefined;
      // Every copy (Startseite included) opens the Joomla-style page editor,
      // which starts from the copy's current content - same as the originals.
      const openEdit = () => openArticleEditor(dup.slug, `/${dup.slug}`, dup.title, editPath);
      return (
        <TableRow
          key={row.key}
          hover
          onClick={openEdit}
          sx={{ cursor: 'pointer' }}
        >
          <TableCell sx={titleCellSx}>{indentMarker}{dup.title}</TableCell>
          <TableCell>{`/${dup.slug}`}</TableCell>
          <TableCell>Veröffentlicht</TableCell>
          <TableCell align="right" onClick={(e) => e.stopPropagation()}>
            <IconButton
              size="small"
              component="a"
              href={`/${dup.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Vorschau (öffnet die Seite in einem neuen Tab)"
            >
              <OpenInNewIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={openEdit} title="Bearbeiten">
              <EditIcon fontSize="small" />
            </IconButton>
            {/* PAGE ARTICLE MODE - the older field editor stays reachable */}
            {editPath && (
              <IconButton size="small" onClick={() => openFieldsEditor(dup.slug, `/${dup.slug}`, dup.title, editPath)} title="Felder-Editor (alt)">
                <ArticleIcon fontSize="small" />
              </IconButton>
            )}
            <IconButton size="small" onClick={() => handleDuplicateFixedDuplicate(dup)} title="Duplizieren (erstellt eine weitere Kopie mit gleichem Design/Inhalt)">
              <ContentCopyIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => handleDeleteFixedDuplicate(dup)} title="Löschen">
              <DeleteIcon fontSize="small" color="error" />
            </IconButton>
          </TableCell>
        </TableRow>
      );
    }
    const { page } = row;
    // PAGE ARTICLE MODE: custom pages open the Joomla-style editor too (the
    // "home" slug would clash with the Startseite's own key - Unlayer only).
    const openCustom = () => {
      if (page.slug === 'home') openEdit(page);
      else openArticleEditor(page.slug, `/${page.slug}`, page.title, `/admin/pages?editPage=${encodeURIComponent(page.id)}`);
    };
    return (
      <TableRow key={row.key} hover onClick={openCustom} sx={{ cursor: 'pointer' }}>
        <TableCell sx={titleCellSx}>
          {indentMarker}
          {page.title}
          {page.slug === 'home' && (
            <Typography component="span" variant="caption" sx={{ color: '#0ea5e9', ml: 1 }}>
              (Startseite)
            </Typography>
          )}
        </TableCell>
        <TableCell>{page.slug === 'home' ? '/' : `/${page.slug}`}</TableCell>
        <TableCell>{page.status === 'published' ? 'Veröffentlicht' : 'Entwurf'}</TableCell>
        <TableCell align="right" onClick={(e) => e.stopPropagation()}>
          <IconButton
            size="small"
            component="a"
            href={page.slug === 'home' ? '/' : `/${page.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Vorschau (öffnet die Seite in einem neuen Tab)"
          >
            <OpenInNewIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={openCustom} title="Bearbeiten">
            <EditIcon fontSize="small" />
          </IconButton>
          {/* PAGE ARTICLE MODE - the Unlayer page builder stays reachable */}
          {page.slug !== 'home' && (
            <IconButton size="small" onClick={() => openEdit(page)} title="Unlayer-Editor (alt)">
              <ArticleIcon fontSize="small" />
            </IconButton>
          )}
          <IconButton size="small" onClick={() => handleDuplicate(page)} title="Duplizieren (erstellt eine Kopie mit gleichem Design/Inhalt)">
            <ContentCopyIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => handleDelete(page)} title="Löschen">
            <DeleteIcon fontSize="small" color="error" />
          </IconButton>
        </TableCell>
      </TableRow>
    );
  };

  // Grouped ("Nach Menü") table body: each menu item with an editable page
  // of its own renders that row, its matching sub-items indented beneath -
  // a group with nothing editable at all (own page AND every sub-item
  // unmatched) is left out entirely. Anything editable that isn't in the
  // header menu follows under "Nicht im Menü".
  const groupedRows: React.ReactNode[] = [];
  menuGroups.forEach((group, i) => {
    if (!group.ownRow && group.subRows.length === 0) return;
    if (group.ownRow) {
      groupedRows.push(renderRow(group.ownRow, 0));
    } else {
      groupedRows.push(
        <TableRow key={`menu-group:${i}`}>
          <TableCell colSpan={4} sx={{ fontWeight: 700, bgcolor: '#f8fafc', color: '#555' }}>{group.label}</TableCell>
        </TableRow>
      );
    }
    group.subRows.forEach((row) => groupedRows.push(renderRow(row, 1)));
  });
  if (unmatchedRows.length > 0) {
    groupedRows.push(
      <TableRow key="unmatched-header">
        <TableCell colSpan={4} sx={{ fontWeight: 700, bgcolor: '#f8fafc', color: '#555' }}>Nicht im Menü</TableCell>
      </TableRow>
    );
    unmatchedRows.forEach((row) => groupedRows.push(renderRow(row, 1)));
  }

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h5">Seiten</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<RestoreFromTrashIcon />} onClick={() => navigate('/admin/trash')}>Papierkorb</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Neue Seite</Button>
        </Box>
      </Box>
      {sessionExpired && (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={<Button color="inherit" size="small" href="/admin/login">Erneut einloggen</Button>}
        >
          Ihre Sitzung ist abgelaufen - nur die fest einprogrammierten Seiten (z.B. "Startseite") werden angezeigt. Bitte neu einloggen, um auch selbst erstellte Seiten zu sehen.
        </Alert>
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          placeholder="Suchen (Titel oder URL - auf Deutsch oder Englisch)"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          size="small"
          sx={{ flex: 1, minWidth: 240 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: '#999' }} />
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>
      <Paper variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Titel</TableCell>
              <TableCell>URL</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Aktionen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {viewMode === 'flat' ? (
              <>
                {noResults && (
                  <TableRow><TableCell colSpan={4} align="center">Keine Seiten gefunden für "{search}".</TableCell></TableRow>
                )}
                {loading && pageRows.length === 0 && (
                  <TableRow><TableCell colSpan={4} align="center">Lädt...</TableCell></TableRow>
                )}
                {pageRows.map((row) => renderRow(row))}
              </>
            ) : (
              <>
                {menuLoading && (
                  <TableRow><TableCell colSpan={4} align="center">Lädt Menüstruktur...</TableCell></TableRow>
                )}
                {!menuLoading && noResults && (
                  <TableRow><TableCell colSpan={4} align="center">Keine Seiten gefunden für "{search}".</TableCell></TableRow>
                )}
                {!menuLoading && !noResults && groupedRows}
              </>
            )}
          </TableBody>
        </Table>
        {viewMode === 'flat' && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 2, px: 2, py: 1, borderTop: '1px solid #e2e8f0' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ color: '#666' }}>Zeilen pro Seite:</Typography>
              <TextField
                select
                value={perPage}
                onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
                size="small"
                variant="standard"
                sx={{ width: 56 }}
              >
                <MenuItem value={10}>10</MenuItem>
                <MenuItem value={25}>25</MenuItem>
                <MenuItem value={50}>50</MenuItem>
              </TextField>
            </Box>
            <Typography variant="body2" sx={{ color: '#666' }}>
              {rangeStart}-{rangeEnd} von {allRows.length}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <IconButton size="small" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={clampedPage <= 1}>
                <ChevronLeftIcon fontSize="small" />
              </IconButton>
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                <Box
                  key={n}
                  onClick={() => setPage(n)}
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    bgcolor: n === clampedPage ? '#e2e8f0' : 'transparent',
                    fontWeight: n === clampedPage ? 700 : 400,
                    '&:hover': { bgcolor: '#f1f5f9' },
                  }}
                >
                  {n}
                </Box>
              ))}
              <IconButton size="small" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={clampedPage >= pageCount}>
                <ChevronRightIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  );
};
