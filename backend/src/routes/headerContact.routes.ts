import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticateJWT, authorizeAdmin } from '../middlewares/auth.middleware';

const router = Router();

export async function getOrCreateConfig() {
  let config = await prisma.headerContactInfo.findUnique({ where: { id: 'default' } });
  if (!config) {
    config = await prisma.headerContactInfo.create({ data: { id: 'default' } });
  }
  return config;
}

// Public - read-only, used by the mobile header drawer. No auth required.
router.get('/public', async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    res.json(config);
  } catch (error) {
    console.error('Error fetching header contact info:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Admin - full read/write.
router.get('/', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    res.json(config);
  } catch (error) {
    console.error('Error fetching header contact info:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const { siteName, addressLine1, addressLine2, phone, email } = req.body;
    const data = { siteName, addressLine1, addressLine2, phone, email };

    const config = await prisma.headerContactInfo.upsert({
      where: { id: 'default' },
      update: data,
      create: { id: 'default', ...data },
    });

    res.json(config);
  } catch (error) {
    console.error('Error updating header contact info:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
