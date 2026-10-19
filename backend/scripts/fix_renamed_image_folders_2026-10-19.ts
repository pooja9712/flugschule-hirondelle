import fs from 'fs';
import path from 'path';
import { prisma } from '../src/utils/prisma';

// Commit a436673 renamed image folders to the old site's prefixed names
// (a-schein -> 1-a-schein, windenschein -> 1-winde), but saved page content
// (SitePageContent rows, e.g. "ausbildung" and "a-schein") still pointed to
// the old folders, so those hero images were broken on the live pages and
// in the page editor. Found by checking every image on all 49 pages.
// Backs up every row it changes to scripts/backups first. Safe to re-run.
// Run with: npx tsx scripts/fix_renamed_image_folders_2026-10-19.ts
const REPLACEMENTS: Array<[string, string]> = [
  ['/images/a-schein/hero.jpg', '/images/1-a-schein/hero.jpg'],
  ['/images/windenschein/hero.jpg', '/images/1-winde/hero.jpg'],
];

async function main() {
  const rows = await prisma.sitePageContent.findMany();
  const changed: Array<{ id: string; data: unknown; fixed: string }> = [];
  for (const row of rows) {
    if (row.id.startsWith('versions--')) continue;
    const before = JSON.stringify(row.data);
    let after = before;
    for (const [from, to] of REPLACEMENTS) after = after.split(from).join(to);
    if (after !== before) changed.push({ id: row.id, data: row.data, fixed: after });
  }
  if (changed.length) {
    const file = path.join(__dirname, 'backups', 'SitePageContent_before_renamed_image_folders_fix_2026-10-19.json');
    if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(changed.map(({ id, data }) => ({ id, data })), null, 2));
  }
  for (const c of changed) {
    await prisma.sitePageContent.update({ where: { id: c.id }, data: { data: JSON.parse(c.fixed) } });
  }
  console.log('updated rows:', changed.map((c) => c.id).join(', ') || 'none');
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
