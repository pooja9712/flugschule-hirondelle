import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateJWT, authorizeAdmin } from '../middlewares/auth.middleware';

const router = Router();

// Old Matukio's real "Medien" tab (Inhalt > Medien) is Joomla core's generic
// com_media file manager, rooted at the site's images/ folder - this mirrors
// that by rooting at the frontend's OWN public/images (the source directory
// vite copies into dist/ on every build), not frontend/dist/images directly.
// Writing into dist/ would get wiped/overwritten on the next `vite build`
// (vite empties outDir by default); public/images survives every future
// build and deploy exactly like backend/public/uploads already does (an
// uncommitted-to-git runtime directory `git pull` never touches). index.ts
// serves it live at /images (ahead of the frontendDist static catch-all) so
// an upload here is usable immediately, with no rebuild required - same
// immediacy as old's real Medien tab.
const MEDIA_ROOT = path.join(process.cwd(), '..', 'frontend', 'public', 'images');
if (!fs.existsSync(MEDIA_ROOT)) {
  fs.mkdirSync(MEDIA_ROOT, { recursive: true });
}

const ALLOWED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt'
]);
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

// Resolves a client-supplied relative path against MEDIA_ROOT and rejects
// anything that would escape it (path traversal via "../", absolute paths,
// etc.) - every route below goes through this before touching the filesystem.
function resolveMediaPath(relPath: unknown): string {
  const rel = typeof relPath === 'string' ? relPath : '';
  const normalized = path.normalize(rel).replace(/^([/\\]|\.\.[/\\]?)+/, '');
  const target = path.resolve(MEDIA_ROOT, normalized);
  if (target !== MEDIA_ROOT && !target.startsWith(MEDIA_ROOT + path.sep)) {
    throw new Error('Invalid path');
  }
  return target;
}

function toRelative(absPath: string): string {
  return path.relative(MEDIA_ROOT, absPath).split(path.sep).join('/');
}

// Strips any directory components and disallowed characters from a filename/
// folder name supplied by the client - defense in depth alongside
// resolveMediaPath (which only guards the *directory* part of a request).
function sanitizeName(name: string): string {
  return path.basename(name).replace(/[/\\]/g, '').trim();
}

router.get('/', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const dir = resolveMediaPath(req.query.path);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      return res.status(404).json({ message: 'Ordner nicht gefunden' });
    }
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const relBase = toRelative(dir);

    const folders = entries
      .filter((e) => e.isDirectory())
      .map((e) => ({ name: e.name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));

    const files = entries
      .filter((e) => e.isFile())
      .map((e) => {
        const ext = path.extname(e.name).toLowerCase();
        const stat = fs.statSync(path.join(dir, e.name));
        const relPath = relBase ? `${relBase}/${e.name}` : e.name;
        return {
          name: e.name,
          size: stat.size,
          isImage: IMAGE_EXTENSIONS.has(ext),
          url: `/images/${relPath}`,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));

    res.json({ path: relBase, folders, files });
  } catch (error) {
    console.error('GET /media error:', error);
    res.status(400).json({ message: 'Ungültiger Pfad' });
  }
});

router.post('/folder', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const { path: parentPath, name } = req.body as { path?: string; name?: string };
    const safeName = sanitizeName(name || '');
    if (!safeName) return res.status(400).json({ message: 'Ordnername erforderlich' });

    const parentDir = resolveMediaPath(parentPath);
    const newDir = path.join(parentDir, safeName);
    if (!newDir.startsWith(parentDir + path.sep) && newDir !== parentDir) {
      return res.status(400).json({ message: 'Ungültiger Ordnername' });
    }
    if (fs.existsSync(newDir)) {
      return res.status(409).json({ message: 'Ordner existiert bereits' });
    }
    fs.mkdirSync(newDir);
    res.status(201).json({ message: 'Ordner erstellt' });
  } catch (error) {
    console.error('POST /media/folder error:', error);
    res.status(400).json({ message: 'Ordner konnte nicht erstellt werden' });
  }
});

const storage = multer.diskStorage({
  destination: function (req, _file, cb) {
    try {
      cb(null, resolveMediaPath((req.body as any)?.path));
    } catch {
      cb(new Error('Ungültiger Pfad'), '');
    }
  },
  filename: function (req, file, cb) {
    try {
      const dir = resolveMediaPath((req.body as any)?.path);
      const ext = path.extname(file.originalname);
      const base = sanitizeName(path.basename(file.originalname, ext)) || 'datei';
      let candidate = `${base}${ext}`;
      let i = 1;
      // Keep the real filename (unlike /uploads's random-suffix scheme) -
      // a media manager's whole point is admin-chosen, recognizable names -
      // but avoid silently overwriting an existing file on a name clash.
      while (fs.existsSync(path.join(dir, candidate))) {
        candidate = `${base}-${i}${ext}`;
        i += 1;
      }
      cb(null, candidate);
    } catch (err) {
      cb(err as Error, '');
    }
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new Error(`Dateityp ${ext || '(unbekannt)'} ist nicht erlaubt`));
    }
    cb(null, true);
  },
});

router.post('/upload', authenticateJWT, authorizeAdmin, (req, res, next) => {
  upload.array('files', 25)(req, res, (err: any) => {
    if (err) return res.status(400).json({ message: err.message || 'Upload fehlgeschlagen' });
    next();
  });
}, (req, res) => {
  const files = (req.files as Express.Multer.File[]) || [];
  res.status(201).json({ message: `${files.length} Datei(en) hochgeladen`, files: files.map((f) => f.filename) });
});

router.delete('/', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const { paths } = req.body as { paths?: string[] };
    if (!Array.isArray(paths) || paths.length === 0) {
      return res.status(400).json({ message: 'Keine Auswahl' });
    }
    for (const p of paths) {
      const target = resolveMediaPath(p);
      if (target === MEDIA_ROOT) continue; // never delete the root itself
      fs.rmSync(target, { recursive: true, force: true });
    }
    res.json({ message: `${paths.length} Element(e) gelöscht` });
  } catch (error) {
    console.error('DELETE /media error:', error);
    res.status(400).json({ message: 'Löschen fehlgeschlagen' });
  }
});

export default router;
