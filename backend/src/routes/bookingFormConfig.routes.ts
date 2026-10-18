import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticateJWT, authorizeAdmin } from '../middlewares/auth.middleware';

const router = Router();

// Public endpoint for the frontend booking form. ?formId= resolves an
// event's Event.customBookingFormId (old's real per-event "Individuelles
// Buchungsformular" override) - falls back to "default" if omitted, not
// found, or itself resolves to "default".
router.get('/public', async (req, res) => {
  try {
    const formId = typeof req.query.formId === 'string' && req.query.formId ? req.query.formId : 'default';
    let config = formId !== 'default' ? await prisma.bookingFormConfig.findUnique({ where: { id: formId } }) : null;
    if (!config) {
      config = await prisma.bookingFormConfig.findUnique({ where: { id: 'default' } });
    }
    res.json(config || { steps: [] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Admin: list every custom (non-default) form for the per-event dropdown.
router.get('/list', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const configs = await prisma.bookingFormConfig.findMany({
      where: { id: { not: 'default' } },
      select: { id: true, name: true },
      orderBy: { updatedAt: 'desc' }
    });
    res.json(configs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// We only need to manage a single config object with id "default"

router.get('/', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    let config = await prisma.bookingFormConfig.findUnique({
      where: { id: 'default' }
    });

    if (!config) {
      // Create a default if it doesn't exist
      config = await prisma.bookingFormConfig.create({
        data: {
          id: 'default',
          steps: [
            {
              id: 'step-1',
              title: 'Anmeldung',
              fields: []
            }
          ]
        }
      });
    }

    // Since react-admin expects a list for data provider queries (even if we just need one)
    // we can return it as an array to make it easy for standard `useListContext` or `useGetOne`.
    // Let's support both. If query has id, return just that.
    
    // React-admin getList expects Array
    res.set('Content-Range', `bookingFormConfig 0-1/1`);
    res.set('Access-Control-Expose-Headers', 'Content-Range');
    res.json([config]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/:id', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    let config = await prisma.bookingFormConfig.findUnique({
      where: { id: req.params.id as string }
    });
    
    if (!config && req.params.id === 'default') {
       config = await prisma.bookingFormConfig.create({
        data: {
          id: 'default',
          steps: [
            {
              id: 'step-1',
              title: 'Anmeldung',
              fields: []
            }
          ]
        }
      });
    }

    if (!config) return res.status(404).json({ message: 'Not found' });
    res.json(config);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const data: any = { steps: req.body.steps };
    if (req.body.name !== undefined) data.name = req.body.name;
    const config = await prisma.bookingFormConfig.update({
      where: { id: req.params.id as string },
      data
    });
    res.json(config);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
