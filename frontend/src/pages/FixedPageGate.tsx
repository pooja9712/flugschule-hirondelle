import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Banner, BannerPositionContext } from '../components/common/Banner';
import { PageArticleOverride } from './PageArticleOverride'; // PAGE ARTICLE MODE

interface PageSettings {
  slug: string | null;
  title: string;
  status: string;
}

// Wraps each of the 6 fixed pages' hardcoded routes in App.tsx (path=
// "ausbildung" etc.). Admin > Seiten lets these pages' title/URL/publish-
// status be edited (see FixedPageSettings model / fixedPageSettings.routes.ts)
// without ever touching the route itself - every existing Header/Footer
// link and every sub-route under it (e.g. ausbildung/schnupperkurs) keeps
// working unmodified:
// - status "draft" shows a "Diese Seite existiert nicht" message here
//   instead of the real page.
// - a renamed slug (different from `defaultSlug`) redirects this old,
//   hardcoded URL to the new one - which resolves via FixedPageRouter.tsx's
//   ":slug" catch-all, the same mechanism a "Seiten > Duplizieren" copy uses.
// Fails open (renders the real page) on a slow/failed settings fetch or a
// renamed slug only - a page should
// never go dark just because this one extra request didn't come back yet.
export const FixedPageGate = ({
  kind,
  defaultSlug,
  children,
}: {
  kind: string;
  defaultSlug: string | null;
  children: ReactNode;
}) => {
  // Tagged with the `kind` each fetch was actually for, not just the raw
  // settings - see why below.
  const [fetched, setFetched] = useState<{ kind: string; settings: PageSettings | null } | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/fixed-page-settings/public/${kind}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled) setFetched({ kind, settings: data }); })
      .catch(() => { if (!cancelled) setFetched({ kind, settings: null }); });
    return () => { cancelled = true; };
  }, [kind]);

  // This component sits at the same spot in the route tree across a
  // same-Layout navigation (e.g. clicking a "Weiterlesen" card from
  // /service to /service/2-jahres-check), so React reuses the same
  // instance and `fetched` still holds the PREVIOUS page's result for (at
  // least) the very first render after `kind` changes - useEffect only
  // resets state AFTER that render has already committed, too late to stop
  // it. Deriving `settings` here, by checking the fetch's own tagged
  // `kind` against the CURRENT `kind` during render itself, closes that
  // window completely: a stale result can never be mistaken for a fresh
  // one, so the "renamed slug" redirect below can never fire against data
  // that belongs to a different page.
  const settings = fetched?.kind === kind ? fetched.settings : undefined;

  // PAGE ARTICLE MODE: `page` = the normal page, or its Joomla-style article
  // body if an admin enabled one. To revert, use `children` directly again.
  const page = <PageArticleOverride articleKey={kind}>{children}</PageArticleOverride>;

  if (settings === undefined || settings === null) {
    return <BannerPositionContext.Provider value={kind}>{page}</BannerPositionContext.Provider>;
  }

  if (settings.status === 'draft') {
    return (
      <BannerPositionContext.Provider value={kind}>
        <div className="w-full bg-white pb-20">
          <Banner />
          <div className="container mx-auto px-4 py-20 text-center text-gray-500">
            Diese Seite existiert nicht.
          </div>
        </div>
      </BannerPositionContext.Provider>
    );
  }

  // Home (defaultSlug null) redirects "/" once it was given a URL of its own.
  if (settings.slug && settings.slug !== defaultSlug) {
    return <Navigate to={`/${settings.slug}`} replace />;
  }

  return <BannerPositionContext.Provider value={kind}>{page}</BannerPositionContext.Provider>;
};
