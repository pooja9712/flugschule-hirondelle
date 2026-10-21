import { useEffect, useState } from 'react';

export interface BannerSlide {
  image: string;
  text?: string;
  linkUrl?: string;
}

interface AdBannerResponse {
  imageUrl: string;
  title: string;
  linkUrl?: string | null;
}

// Fetches one position's rows and resolves to a validated BannerSlide[],
// or null if that position has no usable rows at all (empty, or every
// image URL 404s) - lets the caller below try a fallback position next.
async function fetchValidatedSlides(
  position: string,
  withCaptions: boolean,
  cancelledRef: { current: boolean }
): Promise<BannerSlide[] | null> {
  // `pageKey` (not `position`) - resolved server-side through
  // BannerPageLink first (Admin > Werbebanner > a banner's "Seiten
  // zuweisen"), falling back to using this key as the raw position when no
  // banner is explicitly assigned to it (today's behavior, unchanged).
  const res = await fetch(`/api/banners/public?pageKey=${encodeURIComponent(position)}`);
  if (!res.ok) return null;
  const rows: AdBannerResponse[] = await res.json();
  if (cancelledRef.current || !Array.isArray(rows) || rows.length === 0) return null;
  const candidates: BannerSlide[] = rows.map((row) => ({
    image: row.imageUrl,
    text: withCaptions && row.title ? row.title : undefined,
    linkUrl: row.linkUrl || undefined,
  }));
  const valid = await Promise.all(
    candidates.map(
      (slide) =>
        new Promise<BannerSlide | null>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(slide);
          img.onerror = () => resolve(null);
          img.src = slide.image;
        })
    )
  );
  if (cancelledRef.current) return null;
  const usable = valid.filter((s): s is BannerSlide => s !== null);
  return usable.length > 0 ? usable : null;
}

/**
 * Loads the admin-managed banner slideshow for a position (any string -
 * "home", "subpage", a fixed page's own `kind`, or a Seiten page's slug;
 * see Admin > Werbebanner / Banner.tsx), falling back to `fallbackSlides`
 * (the site's original curated set) whenever no admin rows exist for that
 * position (or its optional `fallbackPosition`, tried next) or none of
 * their image URLs actually load.
 *
 * Every candidate URL is preloaded via a real Image() first, same as
 * usePageGallery/useValidatedImageList - Banner.tsx previously fetched this
 * same data with no validation, which meant a single stale/deleted upload
 * silently broke the whole slideshow the moment the fetch resolved. The
 * fix here goes one step further than those hooks: since the caller
 * doesn't just render a static grid but is actively mid-animation by the
 * time this resolves, returning a brand new array reference (as this hook
 * unavoidably does, fallback -> admin-configured) needs the caller to also
 * reset its own slide-index state when the array identity changes -
 * otherwise the old numeric slide index still points into the new array at
 * the wrong photo, or past the end of it. See Banner.tsx's `slides` effect.
 * `text` is only ever populated when `withCaptions` is true (the "home"
 * position) - every other position never shows a caption box, no matter
 * what's typed into its "Titel" field in the admin, matching the old site.
 */
export function useBannerSlides(
  position: string,
  fallbackSlides: BannerSlide[],
  withCaptions: boolean,
  fallbackPosition?: string
): BannerSlide[] {
  const [resolved, setResolved] = useState<BannerSlide[]>(fallbackSlides);

  useEffect(() => {
    const cancelledRef = { current: false };
    (async () => {
      try {
        let usable = await fetchValidatedSlides(position, withCaptions, cancelledRef);
        if (!usable && fallbackPosition && fallbackPosition !== position) {
          usable = await fetchValidatedSlides(fallbackPosition, withCaptions, cancelledRef);
        }
        if (!cancelledRef.current && usable) setResolved(usable);
      } catch {
        // Network/API error - silently keep fallbackSlides.
      }
    })();
    return () => {
      cancelledRef.current = true;
    };
  }, [position, withCaptions, fallbackPosition]);

  return resolved;
}
