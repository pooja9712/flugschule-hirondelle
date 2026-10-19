import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticateJWT, authorizeAdmin } from '../middlewares/auth.middleware';
import { RESERVED_SLUGS } from '../data/reservedSlugs';
import { syncMenuPublishedForUrl } from '../utils/menuSync';

// Editable title/URL/publish-status for the 13 fixed pages THEMSELVES - see
// the FixedPageSettings model comment in schema.prisma for the full
// rationale (redirect-based rename, home's slug never editable, drafts
// gated at both the old and new URL via FixedPageGate.tsx).

const router = Router();

const FIXED_KINDS = [
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

// The hardcoded React route each kind's page lives at today (App.tsx) -
// also each row's default `slug` value, and the one slug value that's
// always allowed even though it's in RESERVED_SLUGS (renaming back to your
// own default is a no-op, not a collision with another page). The 7
// /infos/* sub-pages live nested under /infos/<kind> but, like every other
// fixed page, redirect to a top-level /<slug> once renamed (see
// FixedPageGate.tsx) - same mechanism a "Seiten > Duplizieren" copy uses.
const DEFAULT_SLUGS: Record<FixedKind, string | null> = {
  home: null,
  ausbildung: 'ausbildung',
  performance: 'performance',
  reisen: 'reisen',
  service: 'service',
  infos: 'infos',
  team: 'team',
  gelaende: 'gelaende',
  wetter: 'wetter',
  medien: 'medien',
  gruppenevents: 'gruppenevents',
  gutscheine: 'gutscheine',
  versicherungen: 'versicherungen',
  schnupperkurs: 'schnupperkurs',
  'l-schein': 'l-schein',
  'a-schein': 'a-schein',
  'b-schein': 'b-schein',
  windenschein: 'windenschein',
  tandemschein: 'tandemschein',
  ausbildungskonzept: 'ausbildungskonzept',
  sicherheitstraining: 'sicherheitstraining',
  rettungsgeraetetraining: 'rettungsgeraetetraining',
  groundhandling: 'groundhandling',
  'brasilien-tour': 'brasilien-tour',
  'kolumbien-tour': 'kolumbien-tour',
  'suedafrika-tour': 'suedafrika-tour',
  'bassano-tour': 'bassano-tour',
  'griechenland-tour': 'griechenland-tour',
  'slowenien-tour': 'slowenien-tour',
  'bergamo-tour': 'bergamo-tour',
  'savoye-tour': 'savoye-tour',
  'vogesen-tour': 'vogesen-tour',
  'pfalz-tour': 'pfalz-tour',
  '2-jahres-check': '2-jahres-check',
  rettungspacken: 'rettungspacken',
  trimmtuning: 'trimmtuning',
  reparatur: 'reparatur',
  billings: 'billings',
  erlau: 'erlau',
  gadern: 'gadern',
  lindenfels: 'lindenfels',
  'nonrod-nordost': 'nonrod-nordost',
  nonrod: 'nonrod',
  stauf: 'stauf',
  winterkasten: 'winterkasten',
  'bad-kreuznach': 'bad-kreuznach',
  herrenteich: 'herrenteich',
  faq: 'faq',
  tandem: 'tandem',
};

const normalizeSlug = (value: string) =>
  String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

async function slugTaken(slug: string, ownKind: FixedKind): Promise<boolean> {
  const isOwnDefault = DEFAULT_SLUGS[ownKind] === slug;
  if (!isOwnDefault && RESERVED_SLUGS.has(slug)) return true;
  const [page, dup, other] = await Promise.all([
    prisma.page.findUnique({ where: { slug } }),
    prisma.fixedPageDuplicate.findUnique({ where: { slug } }),
    prisma.fixedPageSettings.findFirst({ where: { slug, NOT: { kind: ownKind } } }),
  ]);
  return !!page || !!dup || !!other;
}

async function getOrCreate(kind: FixedKind) {
  let row = await prisma.fixedPageSettings.findUnique({ where: { kind } });
  if (!row) {
    row = await prisma.fixedPageSettings.create({
      data: { kind, slug: DEFAULT_SLUGS[kind], title: KIND_LABELS[kind] },
    });
  }
  return row;
}

// Public: current slug/title/status for a kind - FixedPageGate.tsx checks
// this at the page's own hardcoded route to decide whether to show it,
// hide it (draft) or redirect to a renamed slug.
router.get('/public/:kind', async (req, res) => {
  try {
    const kind = String(req.params.kind) as FixedKind;
    if (!FIXED_KINDS.includes(kind)) return res.status(404).json({ error: 'Unknown page' });
    const row = await getOrCreate(kind);
    res.json({ slug: row.slug, title: row.title, status: row.status });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve page settings' });
  }
});

// Public: does this slug belong to a RENAMED fixed page? Checked by
// FixedPageRouter.tsx after the fixed-page-duplicates check and before
// falling back to the Seiten/Unlayer DynamicPage.
router.get('/public/by-slug/:slug', async (req, res) => {
  try {
    const row = await prisma.fixedPageSettings.findUnique({ where: { slug: String(req.params.slug) } });
    if (!row || row.status !== 'published') return res.status(404).json({ error: 'Not found' });
    res.json({ kind: row.kind, title: row.title });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve page' });
  }
});

// Admin: list all (auto-creating any missing rows with defaults)
router.get('/', authenticateJWT, authorizeAdmin, async (_req, res) => {
  try {
    const rows = await Promise.all(FIXED_KINDS.map((kind) => getOrCreate(kind)));
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch page settings' });
  }
});

// Admin: get one
router.get('/:kind', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const kind = String(req.params.kind) as FixedKind;
    if (!FIXED_KINDS.includes(kind)) return res.status(404).json({ error: 'Unknown page' });
    res.json(await getOrCreate(kind));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch page settings' });
  }
});

// Admin: update title/slug/status
router.put('/:kind', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const kind = String(req.params.kind) as FixedKind;
    if (!FIXED_KINDS.includes(kind)) return res.status(404).json({ error: 'Unknown page' });
    const existing = await getOrCreate(kind);

    const title = String(req.body.title ?? existing.title).trim() || KIND_LABELS[kind];
    const status = req.body.status === 'draft' ? 'draft' : 'published';

    // Home has no default slug: empty keeps it at "/", a slug moves it there
    // ("/" then redirects to it, FixedPageGate.tsx) like any other rename.
    const slug = normalizeSlug(req.body.slug ?? existing.slug ?? '') || DEFAULT_SLUGS[kind];
    if (slug && slug !== existing.slug && (await slugTaken(slug, kind))) {
      return res.status(400).json({ error: `Der Slug "${slug}" wird bereits verwendet.` });
    }

    const updated = await prisma.fixedPageSettings.update({
      where: { kind },
      data: { title, status, slug },
    });
    const url = kind === 'home' ? '/' : `/${updated.slug}`;
    await syncMenuPublishedForUrl(url, status !== 'draft');
    res.json(updated);
  } catch (error) {
    console.error('Error updating fixed page settings:', error);
    res.status(500).json({ error: 'Failed to update page settings' });
  }
});

// Admin: reset to defaults - WordPress-style trash, mirroring the other
// routes here: snapshot the current row into ContentTrash before resetting
// it, so a rename/draft can be undone from Admin > Papierkorb.
router.delete('/:kind', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const kind = String(req.params.kind) as FixedKind;
    if (!FIXED_KINDS.includes(kind)) return res.status(404).json({ error: 'Unknown page' });
    const existing = await prisma.fixedPageSettings.findUnique({ where: { kind } });
    if (existing) {
      await prisma.contentTrash.create({
        data: {
          kind: 'fixedpagesettings',
          refId: existing.id,
          title: existing.title,
          data: { kind, slug: existing.slug, title: existing.title, status: existing.status },
        },
      });
    }
    await prisma.fixedPageSettings.deleteMany({ where: { kind } });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset page settings' });
  }
});

export default router;
export { FIXED_KINDS, KIND_LABELS, DEFAULT_SLUGS };
export type { FixedKind };
