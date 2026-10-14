import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticateJWT, authorizeAdmin } from '../middlewares/auth.middleware';

const router = Router();

// Builds the current live MenuItem/MenuSubItem tree for one location, same
// shape as the admin GET /menuitems - shared by the publish endpoint below
// and by the public GET routes' fallback for a location with no snapshot
// yet (a brand-new site, or right after this feature was added).
async function loadLiveTree(location: 'header' | 'footer') {
  return prisma.menuItem.findMany({
    where: { location },
    include: { subItems: { orderBy: { order: 'asc' } } },
    orderBy: { order: 'asc' },
  });
}

// Every edit in MenuManager.tsx (drag reorder, nest/promote, toggle
// Aktiv, add/edit/delete) saves straight to MenuItem/MenuSubItem right
// away, same as before - nothing is lost if the admin navigates off mid-
// edit. But the public site does NOT read those tables directly: it reads
// the last-PUBLISHED snapshot in MenuSnapshot instead, so none of those
// edits reach the live header/footer until the admin explicitly clicks
// "Speichern" there (POST /menu/publish below), which re-snapshots the
// current tree. See the MenuSnapshot model comment in schema.prisma.
async function loadPublicTree(location: 'header' | 'footer') {
  const snapshot = await prisma.menuSnapshot.findUnique({ where: { location } });
  const items: any[] = snapshot ? JSON.parse(snapshot.data) : await loadLiveTree(location);
  return items
    .filter((i) => i.published)
    .map((i) => ({ ...i, subItems: (i.subItems || []).filter((s: any) => s.published) }));
}

// GET published header nav, nested (Public) - consumed by Header.tsx
router.get('/menu/public', async (req, res) => {
  try {
    res.json(await loadPublicTree('header'));
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET published footer links, flat (Public) - consumed by Footer.tsx. Footer
// items never have subItems (the footer is a flat link list), so this stays
// a plain array instead of the nested shape /menu/public returns.
router.get('/footerlinks/public', async (req, res) => {
  try {
    const items = await loadPublicTree('footer');
    res.json(items.map(({ subItems, ...rest }) => rest));
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Admin: publish - snapshots the current MenuItem/MenuSubItem tree for one
// location (?location=header|footer in the body) into MenuSnapshot, so the
// live site picks up everything edited since the last publish in one go.
// This is the "Speichern" button in MenuManager.tsx's Menüstruktur panel.
router.post('/menu/publish', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const location = req.body.location === 'footer' ? 'footer' : 'header';
    const items = await loadLiveTree(location);
    await prisma.menuSnapshot.upsert({
      where: { location },
      update: { data: JSON.stringify(items) },
      create: { location, data: JSON.stringify(items) },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Admin: save the whole menu tree for one location in one go - the
// "Speichern" button in MenuManager.tsx. The admin page edits everything
// (add, edit, delete, reorder, nest, toggle Aktiv) purely in local state,
// with nothing persisted until this is called. Body:
//   { location, items: [{ id?, label, url, target, published,
//                          subItems: [{ id?, label, url, target, imageUrl, published }] }] }
// Replaces the location's MenuItem/MenuSubItem rows with exactly this tree
// (keeping existing ids where given, so nothing that remembers an id breaks),
// then publishes it to MenuSnapshot so the live site picks it up right away.
router.post('/menu/save', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const location = req.body.location === 'footer' ? 'footer' : 'header';
    const items: any[] = Array.isArray(req.body.items) ? req.body.items : [];
    // Ids the client made up for not-yet-saved entries are dropped so the
    // database assigns real ones.
    const keepId = (id: unknown) => (typeof id === 'string' && id && !id.startsWith('new-') ? { id } : {});
    const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);

    await prisma.$transaction(async (tx) => {
      await tx.menuItem.deleteMany({ where: { location } });
      for (const [index, item] of items.entries()) {
        const created = await tx.menuItem.create({
          data: {
            ...keepId(item.id),
            label: str(item.label).trim() || 'Ohne Titel',
            url: str(item.url),
            target: item.target === '_blank' ? '_blank' : '_self',
            published: item.published !== false,
            location,
            order: index,
          },
        });
        // Footer is a flat link list - never store sub-items there.
        const subItems: any[] = location === 'header' && Array.isArray(item.subItems) ? item.subItems : [];
        for (const [subIndex, sub] of subItems.entries()) {
          await tx.menuSubItem.create({
            data: {
              ...keepId(sub.id),
              menuItemId: created.id,
              label: str(sub.label).trim() || 'Ohne Titel',
              url: str(sub.url),
              target: sub.target === '_blank' ? '_blank' : '_self',
              imageUrl: str(sub.imageUrl) || null,
              published: sub.published !== false,
              order: subIndex,
            },
          });
        }
      }
    }, { timeout: 20000 });

    const tree = await loadLiveTree(location);
    await prisma.menuSnapshot.upsert({
      where: { location },
      update: { data: JSON.stringify(tree) },
      create: { location, data: JSON.stringify(tree) },
    });
    res.json(tree);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Admin: whether the currently live tree for this location has unpublished
// changes - compares it against the last-published snapshot so
// MenuManager.tsx can show/hide a "ungespeicherte Änderungen" hint without
// the admin having to guess.
router.get('/menu/publish-status', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const location = req.query.location === 'footer' ? 'footer' : 'header';
    const [live, snapshot] = await Promise.all([
      loadLiveTree(location),
      prisma.menuSnapshot.findUnique({ where: { location } }),
    ]);
    const dirty = JSON.stringify(live) !== (snapshot?.data ?? null);
    res.json({ dirty, publishedAt: snapshot?.updatedAt ?? null });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Admin routes for MenuItems (top-level entries, header or footer). Both
// MenuManager.tsx tabs (Header/Footer) hit these same endpoints, filtered by
// ?location=header|footer (defaults to "header").
router.get('/menuitems', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const location = req.query.location === 'footer' ? 'footer' : 'header';
    const items = await prisma.menuItem.findMany({
      where: { location },
      include: { subItems: { orderBy: { order: 'asc' } } },
      orderBy: { order: 'asc' },
    });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/menuitems', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const { label, url, target, published } = req.body;
    const location = req.body.location === 'footer' ? 'footer' : 'header';
    const count = await prisma.menuItem.count({ where: { location } });
    const item = await prisma.menuItem.create({
      data: { label, url, target, published, location, order: count },
    });
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/menuitems/:id', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const { label, url, target, published, order } = req.body;
    const item = await prisma.menuItem.update({
      where: { id: req.params.id as string },
      data: { label, url, target, published, order },
    });
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/menuitems/:id', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    await prisma.menuItem.delete({ where: { id: req.params.id as string } });
    res.json({ id: req.params.id as string });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Bulk reorder of top-level items - body: [{ id, order }, ...]
router.post('/menuitems/reorder', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const updates = Array.isArray(req.body) ? req.body : [];
    await prisma.$transaction(
      updates.map((u: { id: string; order: number }) =>
        prisma.menuItem.update({ where: { id: u.id }, data: { order: u.order } })
      )
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Drag-and-drop "nest": turns a top-level MenuItem into a MenuSubItem of
// another MenuItem (MenuManager.tsx's Menüstruktur panel - dropping one
// item directly onto another). Only a 2-level tree is supported (item ->
// subItems, no subItems of subItems), so an item that already has its own
// subItems is rejected rather than silently orphaning/flattening them.
router.post('/menuitems/:id/nest', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const targetId = req.body.targetId as string;
    if (!targetId || targetId === id) return res.status(400).json({ message: 'Ungültiges Ziel' });
    const [item, target] = await Promise.all([
      prisma.menuItem.findUnique({ where: { id: id as string }, include: { subItems: true } }),
      prisma.menuItem.findUnique({ where: { id: targetId } }),
    ]);
    if (!item || !target) return res.status(404).json({ message: 'Menüpunkt nicht gefunden' });
    if (item.location !== target.location) return res.status(400).json({ message: 'Menüpunkte aus unterschiedlichen Bereichen können nicht verschachtelt werden' });
    if (item.subItems.length > 0) {
      return res.status(400).json({ message: `"${item.label}" hat eigene Untermenüpunkte und kann nicht selbst zu einem Untermenüpunkt werden. Bitte zuerst dessen Untermenüpunkte entfernen oder verschieben.` });
    }
    const count = await prisma.menuSubItem.count({ where: { menuItemId: targetId } });
    const subItem = await prisma.$transaction(async (tx) => {
      const created = await tx.menuSubItem.create({
        data: { menuItemId: targetId, label: item.label, url: item.url, target: item.target, published: item.published, order: count },
      });
      await tx.menuItem.delete({ where: { id: id as string } });
      return created;
    });
    res.status(201).json(subItem);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Admin routes for MenuSubItems (submenu entries of a MenuItem)
router.post('/menusubitems', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const { menuItemId, label, url, target, imageUrl, published } = req.body;
    const count = await prisma.menuSubItem.count({ where: { menuItemId } });
    const subItem = await prisma.menuSubItem.create({
      data: { menuItemId, label, url, target, imageUrl: imageUrl || null, published, order: count },
    });
    res.status(201).json(subItem);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/menusubitems/:id', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const { label, url, target, imageUrl, published, order, menuItemId } = req.body;
    const data: Record<string, unknown> = { label, url, target, imageUrl: imageUrl || null, published, order };
    // Only set when present - reparenting to a different MenuItem (drag onto
    // another item's row) is optional and separate from a plain field edit.
    if (menuItemId) data.menuItemId = menuItemId;
    const subItem = await prisma.menuSubItem.update({
      where: { id: req.params.id as string },
      data,
    });
    res.json(subItem);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// "Promote": turns a MenuSubItem back into its own top-level MenuItem (the
// reverse of /menuitems/:id/nest above) - triggered by a button on the
// sub-item row in MenuManager.tsx, not a drag gesture (there's no obvious
// empty drop zone to represent "top level" to drag onto).
router.post('/menusubitems/:id/promote', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const sub = await prisma.menuSubItem.findUnique({ where: { id: req.params.id as string }, include: { menuItem: true } });
    if (!sub) return res.status(404).json({ message: 'Nicht gefunden' });
    const location = sub.menuItem.location;
    const count = await prisma.menuItem.count({ where: { location } });
    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.menuItem.create({
        data: { label: sub.label, url: sub.url, target: sub.target, published: sub.published, location, order: count },
      });
      await tx.menuSubItem.delete({ where: { id: sub.id } });
      return created;
    });
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/menusubitems/:id', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    await prisma.menuSubItem.delete({ where: { id: req.params.id as string } });
    res.json({ id: req.params.id as string });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Bulk reorder of one item's sub-items - body: [{ id, order }, ...]
router.post('/menusubitems/reorder', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const updates = Array.isArray(req.body) ? req.body : [];
    await prisma.$transaction(
      updates.map((u: { id: string; order: number }) =>
        prisma.menuSubItem.update({ where: { id: u.id }, data: { order: u.order } })
      )
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
