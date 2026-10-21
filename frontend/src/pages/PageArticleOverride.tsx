// =====================================================================
// PAGE ARTICLE MODE (Joomla-style body content) - added 2026-10-11
// ---------------------------------------------------------------------
// Wraps a page's normal component. If an admin switched on "Artikel-Modus"
// for this page (Admin > Seiten > article icon, see PageArticleEditor.tsx),
// the page body is replaced by that free HTML; the banner slider stays on
// top and the header/footer menus (Layout.tsx) are never touched. With no
// article (the default) the original page renders exactly as before.
//
// "?original=1" in the URL always shows the original design (used by the
// editor's "copy current page" import and handy for comparing).
//
// TO REVERT: delete this file and remove its usage in FixedPageGate.tsx and
// FixedPageRouter.tsx (marked "PAGE ARTICLE MODE"). Backend side is
// described in backend/src/routes/pageArticle.routes.ts.
// =====================================================================
import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Banner } from '../components/common/Banner';
import { LiveHtml } from '../utils/liveBlocks';

// Cached per page key for the session, so moving between pages doesn't
// refetch (and briefly blank) pages already checked once.
interface Article { html: string; fullWidth: boolean }
const cache = new Map<string, Article | null>();

export const PageArticleOverride = ({ articleKey, children }: { articleKey: string; children: ReactNode }) => {
  const { search } = useLocation();
  const forceOriginal = new URLSearchParams(search).get('original') === '1';
  const [fetched, setFetched] = useState<{ key: string; article: Article | null } | undefined>(
    cache.has(articleKey) ? { key: articleKey, article: cache.get(articleKey)! } : undefined,
  );

  useEffect(() => {
    if (forceOriginal || cache.has(articleKey)) {
      if (cache.has(articleKey)) setFetched({ key: articleKey, article: cache.get(articleKey)! });
      return;
    }
    let cancelled = false;
    const done = (article: Article | null) => {
      cache.set(articleKey, article);
      if (!cancelled) setFetched({ key: articleKey, article });
    };
    // Never leave a page blank if the request hangs - fall back to the
    // original design after 2s.
    const timer = setTimeout(() => { if (!cancelled) setFetched({ key: articleKey, article: null }); }, 2000);
    fetch(`/api/page-articles/public/${encodeURIComponent(articleKey)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => done(typeof data?.html === 'string' ? { html: data.html, fullWidth: !!data.fullWidth } : null))
      .catch(() => done(null))
      .finally(() => clearTimeout(timer));
    return () => { cancelled = true; clearTimeout(timer); };
  }, [articleKey, forceOriginal]);

  if (forceOriginal) return <>{children}</>;

  // Same stale-instance guard as FixedPageGate: ignore a result that
  // belongs to the previous page.
  const result = fetched?.key === articleKey ? fetched : undefined;
  if (result === undefined) return null;
  if (result.article === null) return <>{children}</>;

  // Copied from the page's own design: its sections bring their own width
  // and spacing, so no extra container (and no article text styles).
  // `position={articleKey}` (not just `variant`) so this page's own
  // banner slot (Admin > Werbebanner > "Bestimmte Seite auswählen") is
  // still picked up once Artikel-Modus is on - this used to rely on
  // BannerPositionContext for that, which only FixedPageGate.tsx's 6
  // hardcoded-route pages provide; a custom Seiten page (routed via
  // FixedPageRouter.tsx straight into this component, no Provider) always
  // silently fell back to the shared "Andere Seiten" banner instead,
  // exactly as if its own slot had never been configured.
  if (result.article.fullWidth) {
    return (
      <div className="w-full bg-white font-luxurysans">
        <Banner variant={articleKey === 'home' ? 'home' : 'subpage'} position={articleKey} />
        <LiveHtml html={result.article.html} className="page-article-body" />
      </div>
    );
  }

  return (
    <div className="w-full bg-white font-luxurysans pb-20">
      <Banner variant={articleKey === 'home' ? 'home' : 'subpage'} position={articleKey} />
      <section className="pt-16 md:pt-24 pb-12">
        <div className="container mx-auto px-4 lg:px-8 max-w-[1200px]">
          <LiveHtml html={result.article.html} className="home-body-content page-article-body" />
        </div>
      </section>
    </div>
  );
};
