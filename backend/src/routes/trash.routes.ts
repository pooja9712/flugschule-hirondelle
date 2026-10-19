import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticateJWT, authorizeAdmin } from '../middlewares/auth.middleware';

const router = Router();

// WordPress-style "Papierkorb" - lists everything a "Löschen" click has
// moved here (see ContentTrash model). Restoring recreates the original
// row from the snapshot; deleting here is the actual, permanent delete.
//
// Optional `?kinds=a,b,c` filters to just those `kind` values, so separate
// features can each show their own trash instead of one mixed list - see
// frontend/src/admin/Trash.tsx's `kinds` prop (Pages vs Galerie).
router.get('/', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const { kinds } = req.query;
    const kindList = typeof kinds === 'string' ? kinds.split(',').filter(Boolean) : undefined;
    const items = await prisma.contentTrash.findMany({
      where: kindList ? { kind: { in: kindList } } : undefined,
      orderBy: { deletedAt: 'desc' },
    });
    res.json(items);
  } catch (error) {
    console.error('Error fetching trash:', error);
    res.status(500).json({ error: 'Failed to fetch trash' });
  }
});

router.post('/:id/restore', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const item = await prisma.contentTrash.findUnique({ where: { id: String(req.params.id) } });
    if (!item) return res.status(404).json({ error: 'Not found' });

    const data = item.data as any;
    if (item.kind === 'page') {
      const existingSlug = await prisma.page.findUnique({ where: { slug: data.slug } });
      if (existingSlug) {
        return res.status(400).json({ error: `Die URL "${data.slug}" wird bereits von einer anderen Seite verwendet. Bitte diese zuerst umbenennen.` });
      }
      const { articleData, ...pageData } = data;
      await prisma.page.create({ data: { ...pageData, id: item.refId } });
      if (articleData) {
        const articleId = `article--${pageData.slug}`;
        await prisma.sitePageContent.upsert({ where: { id: articleId }, update: { data: articleData }, create: { id: articleId, data: articleData } });
      }
    } else if (item.kind === 'homecontent') {
      await prisma.homeContent.upsert({ where: { id: item.refId }, update: data, create: { ...data, id: item.refId } });
    } else if (item.kind === 'sitepagecontent') {
      await prisma.sitePageContent.upsert({ where: { id: item.refId }, update: { data: data.data }, create: { id: item.refId, data: data.data } });
    } else if (item.kind === 'fixedpageduplicate') {
      const existingSlug = await prisma.fixedPageDuplicate.findUnique({ where: { slug: data.slug } });
      const slugTakenByPage = await prisma.page.findUnique({ where: { slug: data.slug } });
      if (existingSlug || slugTakenByPage) {
        return res.status(400).json({ error: `Die URL "${data.slug}" wird bereits verwendet. Bitte diese zuerst umbenennen.` });
      }
      await prisma.sitePageContent.upsert({ where: { id: data.slug }, update: { data: data.contentData }, create: { id: data.slug, data: data.contentData } });
      if (data.articleData) {
        const articleId = `article--${data.slug}`;
        await prisma.sitePageContent.upsert({ where: { id: articleId }, update: { data: data.articleData }, create: { id: articleId, data: data.articleData } });
      }
      await prisma.fixedPageDuplicate.create({ data: { id: item.refId, slug: data.slug, kind: data.kind, title: data.title, showInNav: data.showInNav, navLabel: data.navLabel } });
    } else if (item.kind === 'fixedpagesettings') {
      if (data.slug) {
        const existingSlug = await prisma.fixedPageSettings.findFirst({ where: { slug: data.slug, NOT: { kind: data.kind } } });
        const slugTakenByPage = await prisma.page.findUnique({ where: { slug: data.slug } });
        const slugTakenByDup = await prisma.fixedPageDuplicate.findUnique({ where: { slug: data.slug } });
        if (existingSlug || slugTakenByPage || slugTakenByDup) {
          return res.status(400).json({ error: `Die URL "${data.slug}" wird bereits verwendet. Bitte diese zuerst umbenennen.` });
        }
      }
      await prisma.fixedPageSettings.upsert({
        where: { kind: data.kind },
        update: { slug: data.slug, title: data.title, status: data.status },
        create: { id: item.refId, kind: data.kind, slug: data.slug, title: data.title, status: data.status },
      });
    } else if (item.kind === 'pagegallery') {
      const existingSlug = await prisma.pageGallery.findUnique({ where: { slug: data.slug } });
      if (existingSlug) {
        return res.status(400).json({ error: `Für die Seite "${data.slug}" existiert bereits eine Galerie. Bitte diese zuerst löschen oder umbenennen.` });
      }
      await prisma.pageGallery.create({ data: { ...data, id: item.refId } });
    } else {
      return res.status(400).json({ error: 'Unknown trash kind' });
    }

    await prisma.contentTrash.delete({ where: { id: item.id } });
    res.json({ ok: true });
  } catch (error) {
    console.error('Error restoring from trash:', error);
    res.status(500).json({ error: 'Failed to restore' });
  }
});

router.delete('/:id', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    await prisma.contentTrash.deleteMany({ where: { id: String(req.params.id) } });
    res.json({ ok: true });
  } catch (error) {
    console.error('Error permanently deleting trash item:', error);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

export default router;
