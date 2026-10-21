// One-time backfill for the new named-banner feature (Admin > Werbebanner).
// Seeds BannerGroup rows for the 2 built-in slots ("home"/"subpage") and
// for any other `position` already in use on AdBanner (e.g. a page-specific
// banner created through the old "Bestimmte Seite auswählen" flow before
// this feature existed), plus a BannerPageLink so each shows up already
// assigned to its own page in the new UI. Safe to re-run - every write is
// an upsert/skip-if-exists.
import { prisma } from '../src/utils/prisma';

async function main() {
  const positions = await prisma.adBanner.findMany({ select: { position: true }, distinct: ['position'] });
  const ids = positions.map((p) => p.position);
  console.log('Positions in use on AdBanner:', ids);

  const names: Record<string, string> = { home: 'Startseite', subpage: 'Andere Seiten' };

  for (const id of ids) {
    const existing = await prisma.bannerGroup.findUnique({ where: { id } });
    if (existing) {
      console.log(`BannerGroup ${id} already exists, skipping`);
      continue;
    }
    let name = names[id];
    if (!name) {
      const page = await prisma.page.findUnique({ where: { slug: id } });
      name = page?.title || id;
    }
    await prisma.bannerGroup.create({ data: { id, name } });
    console.log(`Created BannerGroup ${id} ("${name}")`);

    if (id !== 'home' && id !== 'subpage') {
      const link = await prisma.bannerPageLink.findUnique({ where: { pageKey: id } });
      if (!link) {
        await prisma.bannerPageLink.create({ data: { pageKey: id, bannerGroupId: id } });
        console.log(`Linked page "${id}" -> BannerGroup ${id}`);
      }
    }
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
