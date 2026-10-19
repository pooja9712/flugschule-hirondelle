import { prisma } from './prisma';

// Joomla-style content history ("Versionen") for whole-page bodies: before a
// body is overwritten, the previous one is kept in a SitePageContent row
// "versions--<rowId>" (newest first, MAX_VERSIONS kept). Admin only - the
// public routes never serve these rows. Used by sitePageContent.routes.ts
// (Startseite copies, bodyHtml) and pageArticle.routes.ts (page editor, html).

export const VERSIONS_PREFIX = 'versions--';
const MAX_VERSIONS = 20;
export interface BodyVersion { savedAt: string; bodyHtml: string }

export const keepVersion = async (rowId: string, oldBody: unknown, newBody: unknown) => {
  if (typeof oldBody !== 'string' || !oldBody || oldBody === newBody) return;
  const id = VERSIONS_PREFIX + rowId;
  const row = await prisma.sitePageContent.findUnique({ where: { id } });
  const versions = [{ savedAt: new Date().toISOString(), bodyHtml: oldBody }, ...(((row?.data as any)?.versions || []) as BodyVersion[])]
    .slice(0, MAX_VERSIONS);
  await prisma.sitePageContent.upsert({
    where: { id },
    update: { data: { versions } as any },
    create: { id, data: { versions } as any },
  });
};

export const listVersions = async (rowId: string): Promise<BodyVersion[]> => {
  const row = await prisma.sitePageContent.findUnique({ where: { id: VERSIONS_PREFIX + rowId } });
  return ((row?.data as any)?.versions || []) as BodyVersion[];
};
