import { prisma } from '../src/utils/prisma';

// Creates /home-3 - a copy of the /home-2 Startseite duplicate - as a test
// page for the Joomla-style whole-page editor (Admin > Seiten > Startseite 3
// > Bearbeiten). Same rows the admin "Duplizieren" button writes (see
// fixedPageDuplicates.routes.ts POST /:id/duplicate), just with a fixed slug.
// Safe to re-run: does nothing if home-3 already exists.
// Run with: npx tsx scripts/create_home3_test_page_2026-10-18.ts
async function main() {
  if (await prisma.fixedPageDuplicate.findUnique({ where: { slug: 'home-3' } })) {
    console.log('home-3 already exists - nothing to do');
    return;
  }
  const source = await prisma.sitePageContent.findUnique({ where: { id: 'home-2' } });
  if (!source) throw new Error('home-2 content not found');
  await prisma.sitePageContent.create({ data: { id: 'home-3', data: source.data as any } });
  const dup = await prisma.fixedPageDuplicate.create({
    data: { slug: 'home-3', kind: 'home', title: 'Startseite 3 (Test Editor)', showInNav: false },
  });
  console.log('created', dup);
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
