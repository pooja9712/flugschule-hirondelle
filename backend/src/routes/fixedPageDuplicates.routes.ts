import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticateJWT, authorizeAdmin } from '../middlewares/auth.middleware';
import { RESERVED_SLUGS } from '../data/reservedSlugs';
import { DEFAULTS as HOME_DEFAULTS } from './homecontent.routes';
import { DEFAULTS as SITE_PAGE_DEFAULTS } from './sitePageContent.routes';
import { syncMenuPublishedForUrl } from '../utils/menuSync';

// A TRUE same-design duplicate of one of the 6 fixed pages (see the
// FixedPageDuplicate model comment in schema.prisma): unlike Pages.tsx's
// other "Duplizieren" (which builds a generic Unlayer/Seiten page that can
// only approximate the layout), this stores a copy of the source page's
// DATA as a normal SitePageContent row keyed by the new slug, and records
// which hardcoded component (Ausbildung.tsx etc.) should render it - see
// frontend/src/pages/FixedPageRouter.tsx, which every :slug request checks
// against GET /public/:slug before falling back to the Seiten/Unlayer
// DynamicPage. The result is pixel-identical to the original, because it's
// rendered by the exact same React component.

const router = Router();

const FIXED_KINDS = [
  'home', 'ausbildung', 'performance', 'reisen', 'service', 'infos',
  // /infos/* sub-pages - same duplicate mechanism.
  'team', 'gelaende', 'wetter', 'medien', 'gruppenevents', 'gutscheine', 'versicherungen',
  // /ausbildung/* and /performance/* sub-pages - same duplicate mechanism.
  'schnupperkurs', 'l-schein', 'a-schein', 'b-schein', 'windenschein', 'tandemschein', 'ausbildungskonzept',
  'sicherheitstraining', 'rettungsgeraetetraining', 'groundhandling',
  // /reisen/* tour sub-pages - same duplicate mechanism.
  'brasilien-tour', 'kolumbien-tour', 'suedafrika-tour', 'bassano-tour', 'griechenland-tour',
  'slowenien-tour', 'bergamo-tour', 'savoye-tour', 'vogesen-tour', 'pfalz-tour',
  // /service/* sub-pages - same duplicate mechanism.
  '2-jahres-check', 'rettungspacken', 'trimmtuning', 'reparatur',
  // /infos/gelaende/* detail sub-pages - same duplicate mechanism.
  'billings', 'erlau', 'gadern', 'lindenfels', 'nonrod-nordost', 'nonrod',
  'stauf', 'winterkasten', 'bad-kreuznach', 'herrenteich',
  'faq', 'tandem',
] as const;
type FixedKind = (typeof FIXED_KINDS)[number];

const KIND_LABELS: Record<FixedKind, string> = {
  home: 'Startseite',
  ausbildung: 'Ausbildung',
  performance: 'Performance',
  reisen: 'Reisen',
  service: 'Service',
  infos: 'Infos / Kontakt',
  team: 'Team',
  gelaende: 'Fluggelände',
  wetter: 'Wetter',
  medien: 'Medien',
  gruppenevents: 'Gruppenevents',
  gutscheine: 'Gutscheine',
  versicherungen: 'Versicherungen',
  schnupperkurs: 'Schnupperkurs',
  'l-schein': 'L-Schein',
  'a-schein': 'A-Schein',
  'b-schein': 'B-Schein',
  windenschein: 'Windenschein',
  tandemschein: 'Tandemschein',
  ausbildungskonzept: 'Ausbildungskonzept',
  sicherheitstraining: 'Sicherheitstraining',
  rettungsgeraetetraining: 'Rettungsgerätetraining',
  groundhandling: 'Groundhandling',
  'brasilien-tour': 'Brasilien-Tour',
  'kolumbien-tour': 'Kolumbien-Tour',
  'suedafrika-tour': 'Südafrika-Tour',
  'bassano-tour': 'Bassano-Tour',
  'griechenland-tour': 'Griechenland-Tour',
  'slowenien-tour': 'Slowenien-Tour',
  'bergamo-tour': 'Bergamo-Tour',
  'savoye-tour': 'Savoyer Alpentour',
  'vogesen-tour': 'Vogesen-Tour',
  'pfalz-tour': 'Pfalz-Tour',
  '2-jahres-check': '2-Jahres-Check',
  rettungspacken: 'Rettungsgeräte-Packservice',
  trimmtuning: 'Trimmtuning',
  reparatur: 'Reparatur-Service',
  billings: 'Billings',
  erlau: 'Erlau',
  gadern: 'Gadern',
  lindenfels: 'Lindenfels',
  'nonrod-nordost': 'Nonrod Nordost',
  nonrod: 'Nonroder Höhe',
  stauf: 'Stauf',
  winterkasten: 'Winterkasten',
  'bad-kreuznach': 'Bad Kreuznach',
  herrenteich: 'Herrenteich',
  faq: 'FAQ',
  tandem: 'Tandem',
};

// Each kind's default (un-renamed) URL, and whether it also has its own
// FixedPageSettings row (title/URL/publish-status - only the original 6
// have one, since only they have a top-level hardcoded route of their own
// to redirect from on rename). This is the SINGLE registry the "Seiten"
// pickers in Pages.tsx and MenuManager.tsx both read via GET /kinds below -
// adding a genuinely new fixed page means adding it to FIXED_KINDS/
// KIND_LABELS/FIXED_PAGE_URLS here (plus its own React component wired into
// FixedPageRouter.tsx's KIND_COMPONENTS, its own admin editor route, and a
// DEFAULTS entry in sitePageContent.routes.ts for its content) and it then
// appears automatically in every admin picker, with nothing else to update.
const FIXED_PAGE_URLS: Record<FixedKind, string> = {
  home: '/',
  ausbildung: '/ausbildung',
  performance: '/performance',
  reisen: '/reisen',
  service: '/service',
  infos: '/infos',
  team: '/infos/team',
  gelaende: '/infos/gelaende',
  wetter: '/infos/wetter',
  medien: '/infos/medien',
  gruppenevents: '/infos/gruppenevents',
  gutscheine: '/infos/gutscheine',
  versicherungen: '/infos/versicherungen',
  schnupperkurs: '/ausbildung/schnupperkurs',
  'l-schein': '/ausbildung/l-schein',
  'a-schein': '/ausbildung/a-schein',
  'b-schein': '/ausbildung/b-schein',
  windenschein: '/ausbildung/windenschein',
  tandemschein: '/ausbildung/tandemschein',
  ausbildungskonzept: '/ausbildung/ausbildungskonzept',
  sicherheitstraining: '/performance/sicherheitstraining',
  rettungsgeraetetraining: '/performance/rettungsgeraetetraining',
  groundhandling: '/performance/groundhandling',
  'brasilien-tour': '/reisen/brasilien-tour',
  'kolumbien-tour': '/reisen/kolumbien-tour',
  'suedafrika-tour': '/reisen/suedafrika-tour',
  'bassano-tour': '/reisen/bassano-tour',
  'griechenland-tour': '/reisen/griechenland-tour',
  'slowenien-tour': '/reisen/slowenien-tour',
  'bergamo-tour': '/reisen/bergamo-tour',
  'savoye-tour': '/reisen/savoye-tour',
  'vogesen-tour': '/reisen/vogesen-tour',
  'pfalz-tour': '/reisen/pfalz-tour',
  '2-jahres-check': '/service/2-jahres-check',
  rettungspacken: '/service/rettungspacken',
  trimmtuning: '/service/trimmtuning',
  reparatur: '/service/reparatur',
  billings: '/infos/gelaende/billings',
  erlau: '/infos/gelaende/erlau',
  gadern: '/infos/gelaende/gadern',
  lindenfels: '/infos/gelaende/lindenfels',
  'nonrod-nordost': '/infos/gelaende/nonrod-nordost',
  nonrod: '/infos/gelaende/nonrod',
  stauf: '/infos/gelaende/stauf',
  winterkasten: '/infos/gelaende/winterkasten',
  'bad-kreuznach': '/infos/gelaende/bad-kreuznach',
  herrenteich: '/infos/gelaende/herrenteich',
  faq: '/faq',
  tandem: '/tandem',
};
const KINDS_WITH_SETTINGS = new Set<FixedKind>([
  'home',
  'ausbildung',
  'performance',
  'reisen',
  'service',
  'infos',
  'team',
  'gelaende',
  'wetter',
  'medien',
  'gruppenevents',
  'gutscheine',
  'versicherungen',
  'schnupperkurs',
  'l-schein',
  'a-schein',
  'b-schein',
  'windenschein',
  'tandemschein',
  'ausbildungskonzept',
  'sicherheitstraining',
  'rettungsgeraetetraining',
  'groundhandling',
  'brasilien-tour',
  'kolumbien-tour',
  'suedafrika-tour',
  'bassano-tour',
  'griechenland-tour',
  'slowenien-tour',
  'bergamo-tour',
  'savoye-tour',
  'vogesen-tour',
  'pfalz-tour',
  '2-jahres-check',
  'rettungspacken',
  'trimmtuning',
  'reparatur',
  'billings',
  'erlau',
  'gadern',
  'lindenfels',
  'nonrod-nordost',
  'nonrod',
  'stauf',
  'winterkasten',
  'bad-kreuznach',
  'herrenteich',
  'faq',
  'tandem',
]);

const normalizeSlug = (value: string) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

async function slugTaken(slug: string): Promise<boolean> {
  if (RESERVED_SLUGS.has(slug)) return true;
  const [page, dup] = await Promise.all([
    prisma.page.findUnique({ where: { slug } }),
    prisma.fixedPageDuplicate.findUnique({ where: { slug } }),
  ]);
  return !!page || !!dup;
}

// The content editors (AusbildungContentEditor.tsx etc.) only know a
// duplicate by its slug (the :contentId route param), not its internal id -
// so admin lookups/updates here accept either.
const findByIdOrSlug = (idOrSlug: string) =>
  prisma.fixedPageDuplicate.findFirst({ where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] } });

// Public: does this slug resolve to a fixed-page duplicate? Used by
// FixedPageRouter.tsx on every catch-all page load, before it falls back
// to the Seiten/Unlayer DynamicPage.
router.get('/public/:slug', async (req, res) => {
  try {
    const dup = await prisma.fixedPageDuplicate.findUnique({ where: { slug: String(req.params.slug) } });
    if (!dup || dup.status !== 'published') return res.status(404).json({ error: 'Not found' });
    res.json({ kind: dup.kind, contentId: dup.slug, title: dup.title });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve page' });
  }
});

// Admin: list all
router.get('/', authenticateJWT, authorizeAdmin, async (_req, res) => {
  try {
    const items = await prisma.fixedPageDuplicate.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch duplicates' });
  }
});

// Admin: the full registry of fixed-page kinds (label/default URL/whether
// it has its own FixedPageSettings row) - consumed by Pages.tsx (Seiten
// list) and MenuManager.tsx ("Seiten" add-to-menu picker) so both stay in
// sync with FIXED_KINDS above without their own separate hardcoded list.
// Declared before the "/:id" route below so "kinds" is never swallowed as
// an :id value.
router.get('/kinds', authenticateJWT, authorizeAdmin, async (_req, res) => {
  res.json(
    FIXED_KINDS.map((kind) => ({
      kind,
      label: KIND_LABELS[kind],
      defaultUrl: FIXED_PAGE_URLS[kind],
      hasSettings: KINDS_WITH_SETTINGS.has(kind),
    }))
  );
});

// Admin: get one (by id or slug) - used by the content editors to load the
// duplicate's own title/URL/status/nav settings alongside its content.
router.get('/:id', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const dup = await findByIdOrSlug(req.params.id as string);
    if (!dup) return res.status(404).json({ error: 'Not found' });
    res.json(dup);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch duplicate' });
  }
});

// Admin: create a duplicate of one of the 6 fixed pages
router.post('/', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const kind = String(req.body.kind || '') as FixedKind;
    if (!FIXED_KINDS.includes(kind)) return res.status(400).json({ error: 'Unknown fixed page' });

    let data: any;
    if (kind === 'home') {
      const row = await prisma.homeContent.findUnique({ where: { id: 'default' } });
      data = row ? { ...row } : HOME_DEFAULTS;
      delete data.id;
      delete data.updatedAt;
    } else {
      const row = await prisma.sitePageContent.findUnique({ where: { id: kind } });
      data = row ? row.data : SITE_PAGE_DEFAULTS[kind];
    }

    const baseSlug = `${kind}-kopie`;
    let slug = baseSlug;
    let suffix = 2;
    while (await slugTaken(slug)) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    await prisma.sitePageContent.create({ data: { id: slug, data } });
    const dup = await prisma.fixedPageDuplicate.create({
      data: { slug, kind, title: `${KIND_LABELS[kind]} (Kopie)`, showInNav: false },
    });
    res.status(201).json(dup);
  } catch (error) {
    console.error('Error creating fixed page duplicate:', error);
    res.status(500).json({ error: 'Failed to duplicate page' });
  }
});

// Admin: duplicate an EXISTING duplicate (a "copy of a copy") - copies its
// current content and kind under a new auto-incrementing slug, same as
// duplicating one of the 6 originals above but sourced from this row's own
// SitePageContent instead of the live original.
router.post('/:id/duplicate', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const source = await findByIdOrSlug(req.params.id as string);
    if (!source) return res.status(404).json({ error: 'Not found' });

    const content = await prisma.sitePageContent.findUnique({ where: { id: source.slug } });
    const data = content?.data ?? {};

    const baseSlug = `${source.slug}-kopie`;
    let slug = baseSlug;
    let suffix = 2;
    while (await slugTaken(slug)) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    await prisma.sitePageContent.create({ data: { id: slug, data } });
    const dup = await prisma.fixedPageDuplicate.create({
      data: { slug, kind: source.kind, title: `${source.title} (Kopie)`, showInNav: false },
    });
    res.status(201).json(dup);
  } catch (error) {
    console.error('Error duplicating fixed page duplicate:', error);
    res.status(500).json({ error: 'Failed to duplicate page' });
  }
});

// Admin: rename (title/slug/showInNav/navLabel) - the content itself is
// edited the normal way, via /api/sitepagecontent/:slug (same editor
// screens as the originals, just pointed at this slug instead).
router.put('/:id', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const existing = await findByIdOrSlug(req.params.id as string);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const newSlug = normalizeSlug(req.body.slug ?? existing.slug);
    if (!newSlug) return res.status(400).json({ error: 'Slug ist erforderlich' });
    if (newSlug !== existing.slug && (await slugTaken(newSlug))) {
      return res.status(400).json({ error: `Der Slug "${newSlug}" wird bereits verwendet.` });
    }

    if (newSlug !== existing.slug) {
      const content = await prisma.sitePageContent.findUnique({ where: { id: existing.slug } });
      await prisma.sitePageContent.create({ data: { id: newSlug, data: content?.data ?? {} } });
      await prisma.sitePageContent.delete({ where: { id: existing.slug } });
      // Its content history ("Versionen", sitePageContent.routes.ts) moves along.
      await prisma.sitePageContent.updateMany({ where: { id: `versions--${existing.slug}` }, data: { id: `versions--${newSlug}` } });
    }

    const updated = await prisma.fixedPageDuplicate.update({
      where: { id: existing.id },
      data: {
        slug: newSlug,
        title: req.body.title ?? existing.title,
        status: req.body.status ?? existing.status,
        showInNav: req.body.showInNav ?? existing.showInNav,
        navLabel: req.body.navLabel ?? existing.navLabel,
      },
    });
    await syncMenuPublishedForUrl(`/${updated.slug}`, updated.status !== 'draft');
    res.json(updated);
  } catch (error) {
    console.error('Error updating fixed page duplicate:', error);
    res.status(500).json({ error: 'Failed to update duplicate' });
  }
});

// Admin: delete - WordPress-style trash, mirroring pages.routes.ts: snapshot
// both the registry row and its content into ContentTrash before removing
// them, so restoring recreates the exact same duplicate.
router.delete('/:id', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const dup = await prisma.fixedPageDuplicate.findUnique({ where: { id: req.params.id as string } });
    if (!dup) return res.status(404).json({ error: 'Not found' });
    const content = await prisma.sitePageContent.findUnique({ where: { id: dup.slug } });

    await prisma.contentTrash.create({
      data: {
        kind: 'fixedpageduplicate',
        refId: dup.id,
        title: dup.title,
        data: { slug: dup.slug, kind: dup.kind, title: dup.title, showInNav: dup.showInNav, navLabel: dup.navLabel, contentData: content?.data ?? {} },
      },
    });
    await prisma.sitePageContent.deleteMany({ where: { id: dup.slug } });
    await prisma.fixedPageDuplicate.delete({ where: { id: dup.id } });
    res.json({ message: 'Moved to trash' });
  } catch (error) {
    console.error('Error deleting fixed page duplicate:', error);
    res.status(500).json({ error: 'Failed to delete duplicate' });
  }
});

export default router;
export { FIXED_KINDS, KIND_LABELS };
export type { FixedKind };
