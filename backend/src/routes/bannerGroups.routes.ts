import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticateJWT, authorizeAdmin } from '../middlewares/auth.middleware';

const router = Router();

// Named banners (Admin > Werbebanner > "+ Neues Banner erstellen") that can
// be assigned to one or several pages at once - see schema.prisma's
// BannerGroup/BannerPageLink comments and banners.routes.ts's /public
// ?pageKey= resolution. "home" and "subpage" (Startseite / Andere Seiten)
// are BannerGroup rows too (seeded once, see
// scripts/backfill_banner_groups.ts), protected from rename/delete here so
// every banner - built-in or admin-created - goes through one code path.
const BUILT_IN_IDS = ['home', 'subpage'];

router.get('/', authenticateJWT, authorizeAdmin, async (_req, res) => {
  try {
    const groups = await prisma.bannerGroup.findMany({
      include: { pageLinks: { select: { pageKey: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const withCounts = await Promise.all(
      groups.map(async (g) => {
        const [count, first] = await Promise.all([
          prisma.adBanner.count({ where: { position: g.id } }),
          prisma.adBanner.findFirst({ where: { position: g.id }, orderBy: { order: 'asc' } }),
        ]);
        return {
          id: g.id,
          name: g.name,
          builtIn: BUILT_IN_IDS.includes(g.id),
          imageCount: count,
          thumb: first?.imageUrl || null,
          pageKeys: g.pageLinks.map((l) => l.pageKey),
        };
      })
    );
    res.json(withCounts);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ message: 'Name ist erforderlich' });
    const group = await prisma.bannerGroup.create({ data: { name } });
    res.status(201).json(group);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ message: 'Name ist erforderlich' });
    const group = await prisma.bannerGroup.update({ where: { id: req.params.id as string }, data: { name } });
    res.json(group);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/:id', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const id = req.params.id as string;
    if (BUILT_IN_IDS.includes(id)) {
      return res.status(400).json({ message: 'Startseite und Andere Seiten können nicht gelöscht werden' });
    }
    // BannerPageLink rows cascade via the FK; AdBanner's `position` is a
    // plain string match (no real FK to BannerGroup), so its image rows
    // need an explicit cleanup here.
    await prisma.$transaction([
      prisma.adBanner.deleteMany({ where: { position: id } }),
      prisma.bannerGroup.delete({ where: { id } }),
    ]);
    res.json({ id });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Current page assignments for one banner.
router.get('/:id/pages', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const links = await prisma.bannerPageLink.findMany({ where: { bannerGroupId: req.params.id as string } });
    res.json(links.map((l) => l.pageKey));
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Replaces this banner's full set of page assignments. A page can only
// show one banner, so claiming a pageKey here silently steals it away from
// whatever banner (if any) held it before - matches "set it for multiple
// pages" being driven from the banner's own side, not each page's.
router.put('/:id/pages', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const id = req.params.id as string;
    const pageKeys: string[] = Array.isArray(req.body?.pageKeys) ? req.body.pageKeys.filter((k: unknown) => typeof k === 'string' && k) : [];
    await prisma.$transaction([
      prisma.bannerPageLink.deleteMany({ where: { bannerGroupId: id } }),
      prisma.bannerPageLink.deleteMany({ where: { pageKey: { in: pageKeys } } }),
      prisma.bannerPageLink.createMany({ data: pageKeys.map((pageKey) => ({ pageKey, bannerGroupId: id })) }),
    ]);
    res.json({ ok: true, pageKeys });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
