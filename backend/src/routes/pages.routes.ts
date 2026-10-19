import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticateJWT, authorizeAdmin } from '../middlewares/auth.middleware';
import { RESERVED_SLUGS } from '../data/reservedSlugs';
import { syncMenuPublishedForUrl } from '../utils/menuSync';

// NEW FILE - the "Seiten" CMS feature: lets an admin create an entirely new
// page (title, slug, description, header image, content) that goes live at
// its own top-level URL, unlike pagecontent/pagegallery/pagemedia which only
// edit EXISTING hardcoded pages. See the Page model comment in schema.prisma.
// The page body is authored with the Unlayer drag-and-drop editor (same
// library as the AcyMailing newsletter templates - frontend/src/admin/
// AcyMailing/Templates.tsx) via frontend/src/admin/Pages.tsx: `body` is the
// rendered HTML actually shown on the public page, `design` is Unlayer's own
// JSON design state, reloaded into the editor for further edits.
// To revert: delete this file, remove its mount in index.ts, and drop the
// Page model.

const router = Router();

router.use((req, res, next) => {
  res.header('Access-Control-Expose-Headers', 'Content-Range');
  next();
});

const normalizeSlug = (value: string) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// Admin: list all pages
router.get('/', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const { _sort, _order, _start, _end, q } = req.query;
    const skip = _start ? parseInt(_start as string) : 0;
    const take = _end ? parseInt(_end as string) - skip : 50;
    const orderBy: any = _sort ? { [_sort as string]: _order === 'DESC' ? 'desc' : 'asc' } : { createdAt: 'desc' };
    const whereClause: any = q
      ? { OR: [{ title: { contains: String(q) } }, { slug: { contains: String(q) } }] }
      : {};

    const totalCount = await prisma.page.count({ where: whereClause });
    const pages = await prisma.page.findMany({ where: whereClause, skip, take, orderBy });

    res.set('Content-Range', `pages ${skip}-${skip + pages.length}/${totalCount}`);
    res.json(pages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Pages' });
  }
});

// Public: list published, nav-visible pages - used to build the "Seiten" nav dropdown.
// Excludes slug "home" - that page renders at "/" and already has its own
// "HOME" nav link (Header.tsx), so listing it here too would be a duplicate.
router.get('/public', async (req, res) => {
  try {
    const pages = await prisma.page.findMany({
      where: { status: 'published', showInNav: true, slug: { not: 'home' } },
      select: { slug: true, title: true, navLabel: true },
      orderBy: { title: 'asc' },
    });
    res.json(pages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Pages' });
  }
});

// Public: get a single published page by slug
router.get('/public/:slug', async (req, res) => {
  try {
    const page = await prisma.page.findUnique({ where: { slug: req.params.slug } });
    if (!page || page.status !== 'published') {
      return res.status(404).json({ error: 'Page not found' });
    }
    res.json(page);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Page' });
  }
});

// Admin: get one by id
router.get('/:id', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const page = await prisma.page.findUnique({ where: { id: req.params.id as string } });
    if (!page) return res.status(404).json({ error: 'Page not found' });
    res.json(page);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Page' });
  }
});

// Admin: create
router.post('/', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const slug = normalizeSlug(req.body.slug || req.body.title);
    if (!slug) return res.status(400).json({ error: 'Slug ist erforderlich' });
    if (RESERVED_SLUGS.has(slug)) {
      return res.status(400).json({ error: `Der Slug "${slug}" ist reserviert und kann nicht verwendet werden.` });
    }
    const { title, metaDescription, headerImageUrl, status, showInNav, navLabel, body, design } = req.body;
    const page = await prisma.page.create({
      data: { slug, title, metaDescription, headerImageUrl, status, showInNav, navLabel, body, design },
    });
    res.status(201).json(page);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(400).json({ error: 'Dieser Slug wird bereits verwendet.' });
    }
    res.status(500).json({ error: 'Failed to create Page' });
  }
});

// Admin: update
router.put('/:id', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const slug = normalizeSlug(req.body.slug);
    if (!slug) return res.status(400).json({ error: 'Slug ist erforderlich' });
    if (RESERVED_SLUGS.has(slug)) {
      return res.status(400).json({ error: `Der Slug "${slug}" ist reserviert und kann nicht verwendet werden.` });
    }
    const { title, metaDescription, headerImageUrl, status, showInNav, navLabel, body, design } = req.body;
    const before = await prisma.page.findUnique({ where: { id: req.params.id as string }, select: { slug: true } });
    const page = await prisma.page.update({
      where: { id: req.params.id as string },
      data: { slug, title, metaDescription, headerImageUrl, status, showInNav, navLabel, body, design },
    });
    // Its page-editor content ("article--<slug>", pageArticle.routes.ts) and
    // that content's versions move along with a renamed URL.
    if (before && before.slug !== page.slug) {
      await prisma.sitePageContent.updateMany({ where: { id: `article--${before.slug}` }, data: { id: `article--${page.slug}` } });
      await prisma.sitePageContent.updateMany({ where: { id: `versions--article--${before.slug}` }, data: { id: `versions--article--${page.slug}` } });
    }
    await syncMenuPublishedForUrl(`/${page.slug}`, page.status !== 'draft');
    res.json(page);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(400).json({ error: 'Dieser Slug wird bereits verwendet.' });
    }
    res.status(500).json({ error: 'Failed to update Page' });
  }
});

// Admin: duplicate - WordPress-"Duplicate This"-style clone: copies the
// body/design (so the new page looks 100% identical to the source) and
// title/metaDescription/headerImageUrl, with its own auto-generated unique
// slug so it never collides with the original. Published (not draft) so
// the admin can immediately open the new URL and see it looks right,
// without needing to remember to publish it first - showInNav is copied
// from the source, same as everything else. The admin then clicks
// "Bearbeiten" on the new row - same Titel/URL fields already at the top
// of the editor - to rename it, exactly like WordPress's duplicate-then-
// rename flow.
router.post('/:id/duplicate', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const source = await prisma.page.findUnique({ where: { id: req.params.id as string } });
    if (!source) return res.status(404).json({ error: 'Page not found' });

    const baseSlug = normalizeSlug(`${source.slug}-kopie`);
    let slug = baseSlug;
    let suffix = 2;
    while (await prisma.page.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    const copy = await prisma.page.create({
      data: {
        slug,
        title: `${source.title} (Kopie)`,
        metaDescription: source.metaDescription,
        headerImageUrl: source.headerImageUrl,
        body: source.body,
        design: source.design,
        status: 'published',
        showInNav: source.showInNav,
        navLabel: source.navLabel,
      },
    });
    // The page-editor content ("article--<slug>", pageArticle.routes.ts) is
    // what the page actually shows once edited there - copy it too.
    const article = await prisma.sitePageContent.findUnique({ where: { id: `article--${source.slug}` } });
    if (article) {
      await prisma.sitePageContent.upsert({
        where: { id: `article--${slug}` },
        update: { data: article.data as any },
        create: { id: `article--${slug}`, data: article.data as any },
      });
    }
    res.status(201).json(copy);
  } catch (error) {
    console.error('Error duplicating page:', error);
    res.status(500).json({ error: 'Failed to duplicate Page' });
  }
});

// Admin: delete - WordPress-style trash, not a hard delete: snapshot the
// row into ContentTrash first so it can be restored from Admin > Papierkorb
// (see trash.routes.ts), then remove it here so its slug frees up.
router.delete('/:id', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const page = await prisma.page.findUnique({ where: { id: req.params.id as string } });
    if (!page) return res.status(404).json({ error: 'Page not found' });
    const { id, createdAt, updatedAt, ...data } = page;
    // Its page-editor content goes to the trash with it (restored together,
    // trash.routes.ts), so a later page with the same URL starts clean.
    const article = await prisma.sitePageContent.findUnique({ where: { id: `article--${page.slug}` } });
    await prisma.contentTrash.create({ data: { kind: 'page', refId: page.id, title: page.title, data: { ...data, articleData: article?.data ?? null } as any } });
    await prisma.sitePageContent.deleteMany({ where: { id: `article--${page.slug}` } });
    await prisma.page.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Page moved to trash' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete Page' });
  }
});

export default router;
