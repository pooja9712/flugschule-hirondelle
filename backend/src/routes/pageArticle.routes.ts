// =====================================================================
// PAGE ARTICLE MODE (Joomla-style body content) - added 2026-10-11
// ---------------------------------------------------------------------
// Optional per-page "Artikel" body: when enabled for a page, the public
// page shows this free HTML (edited with the full TinyMCE editor) instead
// of its built-in body layout. Header, footer menus and the banner slider
// are untouched. Off by default, so every page keeps its current design
// until an admin explicitly switches article mode on.
//
// Storage: rows in the existing SitePageContent table with id
// "article--<pageKey>" (pageKey = fixed page kind, e.g. "ausbildung", or a
// duplicate's slug). No schema change.
//
// TO REVERT THIS FEATURE COMPLETELY:
//   1. delete this file and its `app.use('/api/page-articles', ...)` line
//      in src/index.ts (marked "PAGE ARTICLE MODE")
//   2. frontend: see the "PAGE ARTICLE MODE" comments (PageArticleOverride.tsx,
//      FixedPageGate.tsx, FixedPageRouter.tsx, PageArticleEditor.tsx,
//      AdminApp.tsx, Pages.tsx, Banner.tsx)
//   3. optional DB cleanup: DELETE FROM SitePageContent WHERE id LIKE 'article--%';
// =====================================================================
import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { keepVersion, listVersions } from '../utils/pageVersions';
import { authenticateJWT, authorizeAdmin } from '../middlewares/auth.middleware';

const router = Router();

const ID_PREFIX = 'article--';
const KEY_PATTERN = /^[a-z0-9][a-z0-9-]{0,150}$/;

interface PageArticleData {
  enabled: boolean;
  html: string;
  // Copied from the rendered page: its sections bring their own width/
  // spacing, so the public page renders it without the article container.
  fullWidth?: boolean;
}

const EMPTY: PageArticleData = { enabled: false, html: '', fullWidth: false };

const rowId = (key: string) => `${ID_PREFIX}${key}`;

const parseKey = (raw: unknown): string | null => {
  const key = String(raw || '').toLowerCase();
  return KEY_PATTERN.test(key) ? key : null;
};

// Public: only answers when article mode is switched on, so the page falls
// back to its normal design on 404.
router.get('/public/:key', async (req, res) => {
  try {
    const key = parseKey(req.params.key);
    if (!key) return res.status(404).json({ error: 'Not found' });
    const row = await prisma.sitePageContent.findUnique({ where: { id: rowId(key) } });
    const data = (row?.data || null) as PageArticleData | null;
    if (!data?.enabled) return res.status(404).json({ error: 'Not found' });
    res.set('Cache-Control', 'no-store');
    res.json({ html: data.html || '', fullWidth: !!data.fullWidth });
  } catch (error) {
    console.error('Error fetching public page article:', error);
    res.status(500).json({ error: 'Failed to fetch page article' });
  }
});

// Joomla-style "Versionen": previous bodies, kept on every save.
router.get('/:key/versions', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const key = parseKey(req.params.key);
    if (!key) return res.status(400).json({ error: 'Ungültige Seite' });
    res.json(await listVersions(rowId(key)));
  } catch (error) {
    console.error('Error fetching page article versions:', error);
    res.status(500).json({ error: 'Failed to fetch versions' });
  }
});

router.get('/:key', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const key = parseKey(req.params.key);
    if (!key) return res.status(400).json({ error: 'Ungültige Seite' });
    const row = await prisma.sitePageContent.findUnique({ where: { id: rowId(key) } });
    res.json({ ...EMPTY, ...((row?.data || {}) as object), exists: !!row });
  } catch (error) {
    console.error('Error fetching page article:', error);
    res.status(500).json({ error: 'Failed to fetch page article' });
  }
});

router.put('/:key', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const key = parseKey(req.params.key);
    if (!key) return res.status(400).json({ error: 'Ungültige Seite' });
    const data: PageArticleData = {
      enabled: !!req.body?.enabled,
      html: typeof req.body?.html === 'string' ? req.body.html : '',
      fullWidth: !!req.body?.fullWidth,
    };
    const existing = await prisma.sitePageContent.findUnique({ where: { id: rowId(key) } });
    await keepVersion(rowId(key), (existing?.data as any)?.html, data.html);
    await prisma.sitePageContent.upsert({
      where: { id: rowId(key) },
      update: { data: data as any },
      create: { id: rowId(key), data: data as any },
    });
    res.json({ ...data, exists: true });
  } catch (error) {
    console.error('Error saving page article:', error);
    res.status(500).json({ error: 'Failed to save page article' });
  }
});

// Removes the article entirely - the page shows its original design again.
router.delete('/:key', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const key = parseKey(req.params.key);
    if (!key) return res.status(400).json({ error: 'Ungültige Seite' });
    await prisma.sitePageContent.deleteMany({ where: { id: rowId(key) } });
    res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting page article:', error);
    res.status(500).json({ error: 'Failed to delete page article' });
  }
});

export default router;
