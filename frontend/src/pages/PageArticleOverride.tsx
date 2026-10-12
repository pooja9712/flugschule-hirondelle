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
import { SafeHtml } from '../components/common/SafeHtml';

// Cached per page key for the session, so moving between pages doesn't
// refetch (and briefly blank) pages already checked once.
const cache = new Map<string, string | null>();

export const PageArticleOverride = ({ articleKey, children }: { articleKey: string; children: ReactNode }) => {
  const { search } = useLocation();
  const forceOriginal = new URLSearchParams(search).get('original') === '1';
  const [fetched, setFetched] = useState<{ key: string; html: string | null } | undefined>(
    cache.has(articleKey) ? { key: articleKey, html: cache.get(articleKey)! } : undefined,
  );

  useEffect(() => {
    if (forceOriginal || cache.has(articleKey)) {
      if (cache.has(articleKey)) setFetched({ key: articleKey, html: cache.get(articleKey)! });
      return;
    }
    let cancelled = false;
    const done = (html: string | null) => {
      cache.set(articleKey, html);
      if (!cancelled) setFetched({ key: articleKey, html });
    };
    // Never leave a page blank if the request hangs - fall back to the
    // original design after 2s.
    const timer = setTimeout(() => { if (!cancelled) setFetched({ key: articleKey, html: null }); }, 2000);
    fetch(`/api/page-articles/public/${encodeURIComponent(articleKey)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => done(typeof data?.html === 'string' ? data.html : null))
      .catch(() => done(null))
      .finally(() => clearTimeout(timer));
    return () => { cancelled = true; clearTimeout(timer); };
  }, [articleKey, forceOriginal]);

  if (forceOriginal) return <>{children}</>;

  // Same stale-instance guard as FixedPageGate: ignore a result that
  // belongs to the previous page.
  const result = fetched?.key === articleKey ? fetched : undefined;
  if (result === undefined) return null;
  if (result.html === null) return <>{children}</>;

  return (
    <div className="w-full bg-white font-luxurysans pb-20">
      <Banner />
      <section className="pt-16 md:pt-24 pb-12">
        <div className="container mx-auto px-4 lg:px-8 max-w-[1200px]">
          <SafeHtml html={result.html} className="home-body-content page-article-body" />
        </div>
      </section>
    </div>
  );
};
