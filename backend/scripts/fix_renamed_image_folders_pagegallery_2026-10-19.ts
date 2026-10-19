import fs from 'fs';
import path from 'path';
import { prisma } from '../src/utils/prisma';

// Commit a436673 renamed image folders to the old site's prefixed names, but
// the Admin > Galerie rows (PageGallery.images) for these pages still pointed
// to the old folders, so their images were missing in the galleries on the
// pages and in the admin. fix_renamed_image_folders_2026-10-19.ts only fixed
// two hero images in SitePageContent. A path is only rewritten when the file
// really exists in the new folder. Backs up every row it changes to
// scripts/backups first. Safe to re-run.
// Run with: npx tsx scripts/fix_renamed_image_folders_pagegallery_2026-10-19.ts
const FOLDERS: Array<[string, string]> = [
  ['/images/a-schein/', '/images/1-a-schein/'],
  ['/images/refresher/', '/images/1-refresher/'],
  ['/images/rettungsgeraete/', '/images/1-rettungsgeraete/'],
  ['/images/windenschein/', '/images/1-winde/'],
];
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'frontend', 'public');

const fixPath = (src: string): string => {
  for (const [from, to] of FOLDERS) {
    if (!src.startsWith(from)) continue;
    const next = to + src.slice(from.length);
    return fs.existsSync(path.join(PUBLIC_DIR, next)) ? next : src;
  }
  return src;
};

async function main() {
  const rows = await prisma.pageGallery.findMany();
  const changed: Array<{ id: string; slug: string; images: string | null; fixed: string[] }> = [];
  const unresolved: string[] = [];
  for (const row of rows) {
    // `images` is a JSON string array stored as text.
    let images: string[] = [];
    try { images = JSON.parse(row.images || '[]'); } catch { continue; }
    if (!Array.isArray(images)) continue;
    const fixed = images.map(fixPath);
    fixed.forEach((src) => { if (FOLDERS.some(([from]) => src.startsWith(from))) unresolved.push(`${row.slug}: ${src}`); });
    if (JSON.stringify(fixed) !== JSON.stringify(images)) changed.push({ id: row.id, slug: row.slug, images: row.images, fixed });
  }
  if (changed.length) {
    const file = path.join(__dirname, 'backups', 'PageGallery_before_renamed_image_folders_fix_2026-10-19.json');
    if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(changed.map(({ id, slug, images }) => ({ id, slug, images })), null, 2));
  }
  for (const c of changed) {
    await prisma.pageGallery.update({ where: { id: c.id }, data: { images: JSON.stringify(c.fixed) } });
  }
  console.log('updated galleries:', changed.map((c) => `${c.slug} (${c.fixed.length})`).join(', ') || 'none');
  if (unresolved.length) console.log('NOT FOUND in new folders:\n' + unresolved.join('\n'));
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
