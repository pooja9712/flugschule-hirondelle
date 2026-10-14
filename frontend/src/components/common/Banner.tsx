import React, { createContext, useContext, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useBannerSlides } from '../../hooks/useBannerSlides';

// Set by FixedPageGate.tsx (the shared wrapper around all 47 fixed pages'
// routes) to that page's own `kind`, so a per-page banner slot (Admin >
// Werbebanner > "Bestimmte Seite auswählen") can be looked up without every
// one of those 47 page components passing a `position` prop to its own
// bare `<Banner />` call. `null` outside a FixedPageGate (DynamicPage.tsx
// passes its own `position` prop directly instead, since it isn't one).
export const BannerPositionContext = createContext<string | null>(null);

interface BannerSlide {
  image: string;
  text?: string;
  linkUrl?: string;
}

// Old site actually runs two separate slideshow modules (verified against
// the live site's HTML): "top" (id 127) on the home page only, with
// caption text baked into each slide, and "topseite" (id 140) on every
// other page, sharing most of the same photo pool but with NO caption
// text at all. That's why captions only ever appear on the home banner.
const HOME_SLIDES: BannerSlide[] = [
  { image: '/images/headers/slider4.jpg', text: 'Erlebe die Freiheit des Fliegens' },
  { image: '/images/headers/slider_gardasee.jpg', text: 'Sicherheitstraining am Gardasee' },
  { image: '/images/headers/slider_griechenland2.jpg', text: 'Türkisblaues Meer' },
  { image: '/images/headers/slider1.jpg' },
  { image: '/images/headers/sliderbschein.jpg', text: 'Genuss unter den Wolken' },
  { image: '/images/headers/slider11.jpg', text: "Fliegen im Sommer an der Düne..." },
  { image: '/images/headers/P1030577.jpg', text: '... und im Winter im Schnee' },
  { image: '/images/headers/slider_groundhandling.jpg', text: 'Groundhandling auf der Wiese' },
  { image: '/images/headers/P1030623.jpg', text: 'Traumhafte Ausblicke von ganz oben' },
  { image: '/images/headers/slider_bergamo.jpg' },
  { image: '/images/headers/slider_kolumbien1.jpg', text: 'Über den Zuckerrohrfeldern in Kolumbien' },
  { image: '/images/headers/DSC00324.jpg' },
  { image: '/images/headers/slider_pfalz.jpg', text: 'Burgumrundung im Pfälzerwald' },
  { image: '/images/headers/slider2.jpg', text: 'Ausbildung auf höchstem Niveau', linkUrl: '/' },
  { image: '/images/headers/DSC05188.png' },
  { image: '/images/headers/slider_allgu.jpg', text: 'Allgäuer Höhenluft' },
  { image: '/images/headers/slider_brasilien.jpg', text: 'Unter der Sonne Brasiliens' },
  { image: '/images/headers/slider_bassano.jpg', text: 'Bassano - das Mekka der Gleitschirmszene' },
  { image: '/images/headers/slider3.jpg', text: "Doppelt fliegt's besser: Tandemflüge" },
  { image: '/images/headers/slider_griechenland1.jpg', text: 'Griechenland - einmal die Küste abfliegen' },
  { image: '/images/headers/slider_griechenland3.jpg', text: 'Sightseeing von oben' },
  { image: '/images/headers/slider_griechenland4.jpg' },
  { image: '/images/headers/slider_griechenland5.jpg', text: 'Gechillt beim Landecocktail' },
  { image: '/images/headers/slider_kolumbien3.jpg', text: 'Packservice am Landeplatz' },
  { image: '/images/headers/slider_kolumbien4.jpg' },
  { image: '/images/headers/slider_kolumbien5.jpg' },
  { image: '/images/headers/slider_sa6.jpg', text: 'Im Sandkasten Südafrikas' },
  { image: '/images/headers/slider_pfalz2.jpg' },
  { image: '/images/headers/slider_sa4.jpg' },
  { image: '/images/headers/slider_pfalz3.jpg', text: 'Vom Pfälzer Rebenmeer in die Rheinebene' },
  { image: '/images/headers/slider_sa1.jpg' },
  { image: '/images/headers/slider_sa2.jpg', text: 'Paradiesisch an der Paradise Ridge in Südafrika' },
  { image: '/images/headers/slider_sa3.jpg' },
  { image: '/images/headers/slider_spanien.jpg' },
  { image: '/images/headers/slider_slowenien.jpg' },
  { image: '/images/headers/slider_sa5.jpg' },
  { image: '/images/headers/slider_stubai.jpg', text: 'Das Stubaital' },
];

// "topseite" module's slides, in its own order - a different subset of the
// same photo pool, deliberately with no `text` (so no caption box ever
// renders for these, matching the old site's subpages exactly).
const SUBPAGE_SLIDES: BannerSlide[] = [
  { image: '/images/headers/slider11.jpg' },
  { image: '/images/headers/P1030623.jpg' },
  { image: '/images/headers/slider_sa4.jpg' },
  { image: '/images/headers/slider_griechenland4.jpg' },
  { image: '/images/headers/slider_griechenland1.jpg' },
  { image: '/images/headers/slider4.jpg' },
  { image: '/images/headers/slider_bergamo.jpg' },
  { image: '/images/headers/slider_pfalz3.jpg' },
  { image: '/images/headers/slider_sa2.jpg' },
  { image: '/images/headers/slider_spanien.jpg' },
  { image: '/images/headers/slider_kolumbien1.jpg' },
  { image: '/images/headers/slider_sa5.jpg' },
  { image: '/images/headers/slider_bassano.jpg' },
  { image: '/images/headers/slider_pfalz2.jpg' },
  { image: '/images/headers/slider_allgu.jpg' },
  { image: '/images/headers/slider_stubai.jpg' },
  { image: '/images/headers/slider3.jpg' },
  { image: '/images/headers/slider_sa6.jpg' },
  { image: '/images/headers/slider_groundhandling.jpg' },
  { image: '/images/headers/slider2.jpg' },
  { image: '/images/headers/slider_slowenien.jpg' },
  { image: '/images/headers/slider_griechenland3.jpg' },
  { image: '/images/headers/slider_kolumbien3.jpg' },
  { image: '/images/headers/slider_griechenland5.jpg' },
  { image: '/images/headers/slider_pfalz.jpg' },
  { image: '/images/headers/slider_kolumbien4.jpg' },
  { image: '/images/headers/slider1.jpg' },
  { image: '/images/headers/slider_brasilien.jpg' },
  { image: '/images/headers/slider_gardasee.jpg' },
  { image: '/images/headers/P1030577.jpg' },
  { image: '/images/headers/slider_teneriffa.jpg' },
  { image: '/images/headers/slider_sa1.jpg' },
  { image: '/images/headers/slider_kolumbien5.jpg' },
  { image: '/images/headers/slider_griechenland2.jpg' },
];

// Matches the actual old-site slider (SlideshowCK / camera.min.js's
// "kenburns" fx, verified by decompiling the live site's own JS): on every
// transition it picks the pan corner at random - `Math.random() < .5` for
// each axis independently (left/right, top/bottom) - not a deterministic
// per-slide pattern. Re-picked fresh each time a slide becomes active.
function randomTransformOrigin(): string {
  const vertical = Math.random() < 0.5 ? 'top' : 'bottom';
  const horizontal = Math.random() < 0.5 ? 'left' : 'right';
  return `${vertical} ${horizontal}`;
}

interface BannerProps {
  // Old site only shows the home page's slideshow with caption text
  // overlaid ("top" module); every other page uses a separate, caption-
  // free slideshow ("topseite" module) STYLE (logo size/position, overlap,
  // caption support). Defaulting to 'subpage' means the ~50 other pages
  // that just render <Banner /> need no changes. Purely visual - separate
  // from `position` below, which is about CONTENT (which images play).
  variant?: 'home' | 'subpage';
  // Which Werbebanner slot's images/captions to show - a genuinely new,
  // per-page capability (old's real site only ever had the 2 slots above;
  // every page here can now additionally get its own dedicated slot,
  // Admin > Werbebanner > "Bestimmte Seite auswählen"). Explicit prop
  // (DynamicPage.tsx passes its own page's slug) takes priority; falls
  // back to BannerPositionContext (set by FixedPageGate.tsx for the 47
  // fixed pages) so none of them need to pass this themselves, then to
  // `variant` itself for anything rendering <Banner /> completely bare.
  position?: string;
}

export const Banner = ({ variant = 'subpage', position }: BannerProps) => {
  const contextPosition = useContext(BannerPositionContext);
  const contentPosition = position || contextPosition || variant;
  // A page with no own banner configured yet (i.e. every page, until an
  // admin explicitly adds images under its own slot) falls back to the
  // shared "subpage" slot - exactly today's behavior - before finally
  // falling back to the hardcoded curated set below. "home" never needs
  // that middle tier: it already IS the top tier.
  const sharedFallbackPosition = contentPosition !== 'home' && contentPosition !== 'subpage' ? 'subpage' : undefined;
  const isHome = contentPosition === 'home';

  // Admin-manageable again (Admin > Werbebanner), reconnected via
  // useBannerSlides - which is what actually fixes the previous "some
  // images play, then it snaps back to the first image" bug: every
  // candidate URL is preloaded and validated before ever being swapped in,
  // and the `slides` effect below resets activeSlides whenever this
  // array's identity changes, so a mid-animation swap can never leave a
  // stale index pointing at the wrong photo. Falls back to the site's own
  // curated set (below) whenever neither this page's own position nor the
  // shared "subpage" one has been configured, or none of their image URLs
  // actually load.
  const fallback = variant === 'home' ? HOME_SLIDES : SUBPAGE_SLIDES;
  const slides = useBannerSlides(contentPosition, fallback, isHome, sharedFallbackPosition);

  // Camera.js keeps exactly two slides "active" at any moment - the newest
  // (fading/zooming in) and the one before it (already fully zoomed in,
  // about to be silently replaced). Removing the older one lets it
  // transition back to rest instead of snapping, but since a newer opaque
  // slide already covers it, that reverse transition is never actually
  // seen. `activeSlides` mirrors that exact two-element sliding window,
  // oldest first, each entry carrying the random pan corner it was given
  // the moment it became active.
  // Starts empty (not [{index:0,...}]) so the very first slide gets a real
  // "opacity 0, scale 1" frame painted before the mount effect below
  // activates it - otherwise the browser paints it already at its final
  // opacity/scale with nothing to transition from, so the first image
  // would sit frozen (no crossfade, no zoom) until the second slide takes
  // over. The real SlideshowCK plugin fades/zooms in its first slide too
  // (just with a faster 400ms crossfade override), so this restores that.
  const [activeSlides, setActiveSlides] = useState<{ index: number; origin: string }[]>([]);

  // Re-runs (not just on mount) whenever `slides` itself changes identity -
  // i.e. the moment useBannerSlides swaps from the fallback array to a
  // validated admin-configured one (or back) - so a stale index from the
  // previous array can never end up pointing at the wrong photo, or past
  // the end of a shorter one.
  useEffect(() => {
    setActiveSlides([{ index: 0, origin: randomTransformOrigin() }]);
  }, [slides]);

  const nextSlide = () => {
    setActiveSlides((prev) => {
      const last = prev[prev.length - 1]?.index ?? 0;
      return [...prev, { index: (last + 1) % slides.length, origin: randomTransformOrigin() }].slice(-2);
    });
  };

  const prevSlide = () => {
    setActiveSlides((prev) => {
      const last = prev[prev.length - 1]?.index ?? 0;
      return [...prev, { index: (last - 1 + slides.length) % slides.length, origin: randomTransformOrigin() }].slice(-2);
    });
  };

  // Auto-play - old site's SlideshowCK module (id 127) params: time=7000ms
  // per slide before auto-advance, verified against the live DB.
  useEffect(() => {
    const timer = setInterval(() => {
      nextSlide();
    }, 7000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length]);

  const currentSlide = activeSlides[activeSlides.length - 1]?.index ?? 0;
  const currentSlideData = slides[currentSlide] || slides[0];

  if (!currentSlideData) return null;

  // Measured directly against the live old site (both the home and
  // subpage sliders): height is always exactly 40% of the slideshow's own
  // width (which is always the full viewport width, on every page), with
  // a 150px floor - confirmed at viewports from 280px up to 2560px wide.
  // Identical formula for home and subpage; no separate sizing needed.
  //
  // On subpages specifically (not home), the old site's banner div starts
  // at top:6px (not 0) while the 40px fixed nav renders opaque on top of
  // it - so only 34px of the banner is actually hidden, not the full 40.
  // Kept exactly as-is per explicit request. The box height itself is now
  // a fixed 432px VISIBLE (i.e. measured from the nav's bottom edge) on
  // desktop, replacing the old 40vw-based box height for this variant -
  // box height 466px - the 34px overlap = 432px visible. Desktop only;
  // mobile and the home variant are untouched.
  const subpageDesktopOverlap = variant === 'subpage' ? 'md:-mt-[34px]' : '';
  const subpageDesktopHeight = variant === 'subpage' ? 'md:h-[466px]' : '';

  return (
    // data-site-banner: PAGE ARTICLE MODE - lets PageArticleEditor's "copy
    // current page" import skip the slider (harmless otherwise).
    <section data-site-banner className={`relative w-full h-[max(40vw,150px)] ${subpageDesktopHeight} flex flex-col items-center justify-center text-center text-white overflow-hidden group ${subpageDesktopOverlap}`}>

      {/* Background Images - Ken Burns effect matched to the old site's
          actual SlideshowCK params (time: 7000, transPeriod: 3000): the
          opacity crossfade runs linearly over the 3s transPeriod while the
          zoom (100% -> 130%, i.e. scale 1 -> 1.3) runs over 2x the slide
          time (14s, eased like jQuery's default "swing"), so it's still
          visibly zooming well after the crossfade itself is done - toward
          the random corner picked for that activation (randomTransformOrigin)
          rather than the center. Exactly two slides carry the "active"
          state at once (activeSlides), matching the plugin's own
          two-slide overlap technique instead of a single instantaneous
          swap. */}
      {slides.map((slide, index) => {
        const entryRank = activeSlides.findIndex((entry) => entry.index === index); // -1, 0 (older-active) or 1 (newer-active)
        const entry = entryRank !== -1 ? activeSlides[entryRank] : undefined;
        const isActive = !!entry;
        const origin = entry?.origin ?? 'center center';
        return (
          <div
            key={index}
            className="absolute inset-0 bg-cover bg-no-repeat"
            style={{
              backgroundImage: `url("${slide.image}")`,
              backgroundPosition: origin,
              transformOrigin: origin,
              opacity: isActive ? 1 : 0,
              transform: isActive ? 'scale(1.3)' : 'scale(1)',
              transitionProperty: 'opacity, transform',
              transitionDuration: '3000ms, 14000ms',
              transitionTimingFunction: 'linear, ease-in-out',
              zIndex: entryRank === 1 ? 2 : entryRank === 0 ? 1 : 0,
            }}
          >
            {/* Subtle overlay for text readability */}
            <div className="absolute inset-0 bg-black/10"></div>
          </div>
        );
      })}

      {/* Logo - old site positions its logo absolutely so it overlaps the
          banner images instead of sitting in the nav bar (.logo img,
          position:absolute). Measured on the live site (banner's own
          top-left as origin, since our fixed header is now the same 40px
          height as the old site's): home sits ~9-10px into the banner on
          both mobile and desktop; subpages sit noticeably lower (~15px
          mobile, ~40px desktop) and use a smaller logo. Anchored to the
          same centered max-w-[1200px] container (with the `relative` this
          needs to actually work, unlike an earlier attempt that dropped
          it) as the nav bar and page content below, with the same left-4
          md:left-8 inset Header.tsx uses, so the logo lines up with HOME
          in the nav and with the content's edge - not just the raw
          viewport edge. Header.tsx no longer renders a logo; this is the
          only one. */}
      <div className="absolute inset-x-0 top-0 z-20 pointer-events-none">
        <div className="relative mx-auto max-w-[1200px] h-0">
          <Link
            to="/"
            className={`pointer-events-auto absolute left-4 md:left-8 ${
              variant === 'home' ? 'top-[9px] md:top-[10px]' : 'top-[15px] md:top-[40px]'
            }`}
          >
            <img
              src="/logo.svg"
              alt="Flugschule Hirondelle"
              className={variant === 'home' ? 'w-[180px] md:w-[300px] h-auto object-contain' : 'w-[150px] md:w-[250px] h-auto object-contain'}
            />
          </Link>
        </div>
      </div>

      {/* Name Plate Container - Aligned to bottom left of container.
          Old site hides the caption below 630px (.camera_caption_title
          { display: none }) - hidden here below sm (640px) to match.
          Vertical position measured directly against the live site (its
          .camera_caption sits at top:55% of the slideshow, landing the
          caption box's own center at ~61% down the banner - notably
          closer to the middle, near the prev/next arrows, not hugging the
          bottom edge). Expressed as a vw padding (not a fixed px or a %,
          which resolves against width not height) because the banner's
          own height is itself `max(40vw,150px)`, so a vw value scales
          with it proportionally instead of drifting off at other sizes. */}
      <div className="absolute inset-0 z-20 hidden sm:flex items-end pb-[14vw]">
        <div className="container mx-auto px-4 lg:px-8 max-w-[1200px] w-full flex justify-start">

          {/* Conditionally render Name Plate */}
          {currentSlideData.text && (
            <div className="bg-[#53a8c7]/65 inline-flex items-center gap-1.5 md:gap-2 pl-4 pr-10 py-1.5 md:py-2 max-w-full backdrop-blur-[2px]">
              {/* Old site's actual icotitleslide.png (verified against the
                  live site's own CSS: .camera_caption_title background) -
                  a white ring + swallow silhouette on transparent, not a
                  filled circle, so no wrapper fill or invert filter needed. */}
              <div className="w-9 h-9 md:w-11 md:h-11 flex items-center justify-center shrink-0">
                <img
                  src="/icotitleslide.png"
                  alt="Logo"
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Italic Text */}
              {currentSlideData.linkUrl ? (
                <a href={currentSlideData.linkUrl} target="_blank" rel="noopener noreferrer" className="text-white text-[22px] italic font-normal tracking-wide drop-shadow-sm text-left leading-tight truncate hover:underline">
                  {currentSlideData.text}
                </a>
              ) : (
                <p className="text-white text-[22px] italic font-normal tracking-wide drop-shadow-sm text-left leading-tight truncate">
                  {currentSlideData.text}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation Buttons - desktop only, hidden on mobile per request */}
      <button
        onClick={prevSlide}
        className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-30 items-center justify-center text-white hover:text-white/80 transition-colors drop-shadow-md"
        aria-label="Vorheriges Bild"
      >
        <ChevronLeft className="w-10 h-10 md:w-12 md:h-12 stroke-[1.5]" />
      </button>

      <button
        onClick={nextSlide}
        className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-30 items-center justify-center text-white hover:text-white/80 transition-colors drop-shadow-md"
        aria-label="Nächstes Bild"
      >
        <ChevronRight className="w-10 h-10 md:w-12 md:h-12 stroke-[1.5]" />
      </button>

    </section>
  );
};
