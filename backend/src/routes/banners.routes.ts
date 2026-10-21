import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticateJWT, authorizeAdmin } from '../middlewares/auth.middleware';

const router = Router();

// GET active banners for public. Two ways to ask:
// - ?position= : the raw AdBanner.position/slot key directly (legacy;
//   still used for position="home"/"subpage" since those never need
//   resolving).
// - ?pageKey= : a page's own key ("home", "subpage", a fixed page's
//   `kind`, or a Seiten page's slug) - resolved through BannerPageLink
//   first (Admin > Werbebanner > a banner's "Seiten zuweisen"), falling
//   back to using pageKey itself as the position when no link exists -
//   exactly today's implicit 1:1 behavior for a page with no banner
//   explicitly assigned to it.
// Omitting both keeps the old unfiltered behavior for any other caller.
router.get('/public', async (req, res) => {
  try {
    let { position, pageKey } = req.query;
    if (pageKey && !position) {
      const link = await prisma.bannerPageLink.findUnique({ where: { pageKey: pageKey as string } });
      position = link ? link.bannerGroupId : (pageKey as string);
    }
    const banners = await prisma.adBanner.findMany({
      where: { published: true, ...(position ? { position: position as string } : {}) },
      orderBy: { order: 'asc' }
    });
    res.set('Cache-Control', 'no-store');
    res.json(banners);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Admin routes for AdBanners
router.get('/', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const { _sort, _order, _start, _end, position } = req.query;
    const skip = _start ? Number(_start) : 0;
    const take = _end ? Number(_end) - skip : 100;
    const orderBy: any = _sort ? { [_sort as string]: _order ? (_order as string).toLowerCase() : 'asc' } : { order: 'asc' };
    const where = position ? { position: position as string } : {};

    const [banners, total] = await Promise.all([
      prisma.adBanner.findMany({ where, skip, take, orderBy }),
      prisma.adBanner.count({ where })
    ]);
    res.set('Content-Range', `banners ${skip}-${skip + banners.length}/${total}`);
    res.json(banners);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/:id', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const banner = await prisma.adBanner.findUnique({ where: { id: req.params.id as string } });
    if (!banner) return res.status(404).json({ message: 'Not found' });
    res.json(banner);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const banner = await prisma.adBanner.create({ data: req.body });
    res.status(201).json(banner);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const banner = await prisma.adBanner.update({
      where: { id: req.params.id as string },
      data: req.body
    });
    res.json(banner);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/:id', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    await prisma.adBanner.delete({ where: { id: req.params.id as string } });
    res.json({ id: req.params.id });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
