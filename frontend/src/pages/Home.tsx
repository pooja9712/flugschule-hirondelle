import { Link } from 'react-router-dom';
import { Banner } from '../components/common/Banner';
import { SafeHtml } from '../components/common/SafeHtml';
import { useState, useEffect } from 'react';

// Fallbacks match the page's current live copy exactly, so nothing changes
// visually until an admin actually edits something in Admin > Startseite
// (see backend HomeContent model / homecontent.routes.ts). Home.tsx's
// JSX/Tailwind layout itself never changes here, only the words/photos/
// links plugged into it.
const DEFAULT_PROMO_CARDS = [
  { title: 'Fliegen Lernen', boldLine: 'Der Anfang einer neuen Leidenschaft!', description: 'Reinschnuppern beim 1-Tageskurs oder Schnupperwochenende', image: '/images/startbuttons/startbutton_schnuppern.jpg', link: '/ausbildung/schnupperkurs' },
  { title: 'Shop Geöffnet', boldLine: 'Mittwoch, 2.9.26 16-19 Uhr', description: 'Alex und Sarah sind für euch in Weinheim im Laden, bitte unbedingt voranmelden!', image: '/images/startbuttons/gutschein.jpg', link: '/infos' },
  // Old's real "On Tour" home-page box links to a pre-filtered search of
  // the real event list (veranstaltungen/eventlist/.../Kolumbien/...),
  // showing the actual bookable upcoming tour (dates/price/waitlist state) -
  // not a static content page about the tour. /events is this app's real
  // equivalent of that eventlist view (see Events.tsx's ?search= param).
  { title: 'On Tour...', boldLine: '23.1. - 6.2.2027 | Kolumbien', description: 'Fliegen über den grünen Landschaften des Valle del Cauca in den besten Fluggebieten von Cali Richtung Medellin...', image: '/images/bilder/2-tour-kolumbien/Kolumbien_3997_2.jpg', link: '/events?search=Kolumbien' },
];
// slug matches the member's real anchor id on /infos/team (Team.tsx),
// itself confirmed against old's real per-person anchors
// (fs-hirondelle.de/team#alex etc.) - lets each home preview photo link
// straight to that person instead of just the top of the team page.
const DEFAULT_TEAM_MEMBERS = [
  { name: 'Alex', image: '/images/team/schlink.jpg', slug: 'alex' },
  { name: 'Sarah', image: '/images/team/sarah.jpg', slug: 'sarah' },
  { name: 'Tobi', image: '/images/team/tobi.jpg', slug: 'tobi' },
  { name: 'Holger', image: '/images/team/holger.jpg', slug: 'holger' },
  { name: 'Markus', image: '/images/team/markus.jpg', slug: 'markus' },
];
const DEFAULT_HOCH_HINAUS_HTML =
  '<p>Willkommen bei der Flugschule Hirondelle, der Gleitschirmschule im Rhein-Main-Neckar Dreieck. Fliegen lernen mit dem <a href="/infos/team">Team Hirondelle</a> heißt: Persönliche und individuelle auf den Schüler zugeschnittene Ausbildung. Unser Team besteht aus sehr erfahrenen und ambitionierten Fluglehrern.</p>' +
  '<p>Alles natürlich an genialen Schulungshängen im Raum Odenwald, Kraichtal, Nahetal und in der Pfalz.</p>';
const DEFAULT_SECTION_TITLES = {
  newsEyebrow: 'AKTUELLES',
  newsTitle: 'NEWS',
  hochHinausEyebrowPrefix: '...mit dem',
  hochHinausEyebrowLinkText: 'Team Hirondelle',
  hochHinausTitle: 'HOCH HINAUS',
};

interface HomeContentData {
  promoCards: typeof DEFAULT_PROMO_CARDS;
  teamMembers: typeof DEFAULT_TEAM_MEMBERS;
  teamLink: string;
  hochHinausHtml: string;
  newsEyebrow: string;
  newsTitle: string;
  hochHinausEyebrowPrefix: string;
  hochHinausEyebrowLinkText: string;
  hochHinausTitle: string;
  // Only ever set on a page duplicate (see HomeContentEditor.tsx's own
  // comment on this same field) - a single free-form admin-authored HTML
  // blob that replaces the promo-cards/news/hoch-hinaus/team sections below
  // entirely when present, instead of sitting alongside them.
  bodyHtml?: string;
  // "html": saved from the Joomla-style editor - see bodyOnly below.
  bodyMode?: string;
}

// contentId is set only when this component is rendered as a fixed-page
// duplicate (see FixedPageRouter.tsx) - it points at the copied
// SitePageContent row instead of the real HomeContent row, so the
// duplicate can be edited independently while looking pixel-identical.
export const Home = ({ contentId }: { contentId?: string } = {}) => {
  const [media, setMedia] = useState<any>(null);
  const [homeContent, setHomeContent] = useState<HomeContentData | null>(null);

  useEffect(() => {
    const url = contentId ? `/api/sitepagecontent/public/${contentId}` : '/api/homecontent/public';
    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setHomeContent(data))
      .catch((err) => console.error('Error fetching home content:', err));
  }, [contentId]);

  const promoCards = homeContent?.promoCards?.length === 3 ? homeContent.promoCards : DEFAULT_PROMO_CARDS;
  const teamMembers = homeContent?.teamMembers?.length === 5 ? homeContent.teamMembers : DEFAULT_TEAM_MEMBERS;
  const hochHinausHtml = homeContent?.hochHinausHtml || DEFAULT_HOCH_HINAUS_HTML;
  const newsEyebrow = homeContent?.newsEyebrow || DEFAULT_SECTION_TITLES.newsEyebrow;
  const newsTitle = homeContent?.newsTitle || DEFAULT_SECTION_TITLES.newsTitle;
  const hochHinausEyebrowPrefix = homeContent?.hochHinausEyebrowPrefix || DEFAULT_SECTION_TITLES.hochHinausEyebrowPrefix;
  const hochHinausEyebrowLinkText = homeContent?.hochHinausEyebrowLinkText || DEFAULT_SECTION_TITLES.hochHinausEyebrowLinkText;
  const hochHinausTitle = homeContent?.hochHinausTitle || DEFAULT_SECTION_TITLES.hochHinausTitle;
  const teamLink = homeContent?.teamLink || '/infos/team';
  // A page saved from the Joomla-style editor (bodyMode "html") always shows
  // exactly its body - an emptied body means an empty page, not a fallback
  // to the built-in design below.
  const bodyOnly = !!contentId && homeContent?.bodyMode === 'html';
  const customBodyHtml = contentId ? homeContent?.bodyHtml : undefined;
  // Only ever promotes an admin-uploaded URL once the browser has actually
  // confirmed it loads - otherwise a stale/deleted upload would flash the
  // correct local fallback in, then silently swap to a broken image once
  // the fetch above resolves (fallback -> real -> broken, visibly delayed).
  const [validatedImages, setValidatedImages] = useState<Record<number, string>>({});

  useEffect(() => {
    fetch(`/api/pagemedia/public/home`)
      .then(res => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then(data => setMedia(data))
      .catch(err => console.error('Error fetching home media:', err));
  }, []);

  useEffect(() => {
    if (!media?.galleryImages) return;
    let cancelled = false;
    Object.entries(media.galleryImages as Record<string, string>).forEach(([idxStr, url]) => {
      if (!url) return;
      const index = Number(idxStr);
      const img = new Image();
      img.onload = () => {
        if (!cancelled) setValidatedImages((prev) => ({ ...prev, [index]: url }));
      };
      img.src = url;
    });
    return () => {
      cancelled = true;
    };
  }, [media]);

  const getImage = (index: number, fallbackSrc: string) => {
    return validatedImages[index] || fallbackSrc;
  };

  // Loads Facebook's XFBML SDK once (the old site's own template already
  // pulls in this same connect.facebook.net/sdk.js#xfbml=1 script) so the
  // fb-page div below renders as the real page timeline. A bare
  // <iframe src="https://www.facebook.com/plugins/page.php?..."> (the
  // previous approach here) is Meta's older embed method and gets hit
  // with a "Log into Facebook" wall far more often than the officially
  // supported fb-page/XFBML integration.
  useEffect(() => {
    const scriptId = 'facebook-jssdk';
    if (document.getElementById(scriptId)) {
      (window as any).FB?.XFBML.parse();
      return;
    }
    if (!document.getElementById('fb-root')) {
      const root = document.createElement('div');
      root.id = 'fb-root';
      document.body.appendChild(root);
    }
    const js = document.createElement('script');
    js.id = scriptId;
    js.src = '//connect.facebook.net/de_DE/sdk.js#xfbml=1&version=v19.0';
    js.async = true;
    document.body.appendChild(js);
  }, []);

  return (
    <div className="w-full bg-white font-luxurysans">

      {/* 1. HERO SECTION */}
      <Banner variant="home" />

      {/* 2. INTRO TEXT SECTION - temporarily disabled, kept for future re-enable
      <section className="py-24 md:py-32 bg-white px-4 text-center border-b border-gray-100">
        <div className="max-w-4xl mx-auto">
          <p className="text-luxury-heading uppercase tracking-[0.2em] text-xs font-semibold mb-8">
            LEIDENSCHAFT FÜRS FLIEGEN TRIFFT AUF PROFESSIONELLE AUSBILDUNG
          </p>
          <p className="font-luxury font-bold text-3xl md:text-5xl text-luxury-dark leading-[1.4] mx-auto">
            Die Flugschule Hirondelle bietet moderne Ausbildung mit unvergleichlichen Fluggebieten und erfahrenen Fluglehrern.
          </p>
        </div>
      </section>
      */}

      {/* 3. IMAGE GALLERY - temporarily disabled, kept for future re-enable
      <section className="w-full overflow-hidden relative">
        {(() => {
          const galleryImages = [
            getSquareImage(0, '/images/ausbildung-6.jpg'),
            getSquareImage(1, '/images/ausbildung-5.jpg'),
            getSquareImage(2, '/images/ausbildung-4.jpg'),
          ];
          const prevGallery = () => setGalleryIndex((i) => (i - 1 + galleryImages.length) % galleryImages.length);
          const nextGallery = () => setGalleryIndex((i) => (i + 1) % galleryImages.length);
          return (
            <>
              {/* Desktop / tablet: 3 images side by side }
              <div className="hidden md:flex h-[600px] relative">
                {galleryImages.map((src, i) => (
                  <div key={i} className="w-1/3 h-full overflow-hidden relative group">
                    <img src={src} alt={`Gallery ${i + 1}`} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors duration-500"></div>
                  </div>
                ))}
              </div>

              {/* Mobile: one image at a time, swipe-style carousel }
              <div className="md:hidden h-[400px] relative">
                {galleryImages.map((src, i) => (
                  <div
                    key={i}
                    className={`absolute inset-0 transition-opacity duration-500 ${i === galleryIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                  >
                    <img src={src} alt={`Gallery ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
                <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none">
                  <button onClick={prevGallery} className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg pointer-events-auto" aria-label="Vorheriges Bild">
                    <ChevronLeft className="w-5 h-5 text-luxury-dark" />
                  </button>
                  <button onClick={nextGallery} className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg pointer-events-auto" aria-label="Nächstes Bild">
                    <ChevronRight className="w-5 h-5 text-luxury-dark" />
                  </button>
                </div>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                  {galleryImages.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setGalleryIndex(i)}
                      className={`w-2 h-2 rounded-full transition-colors ${i === galleryIndex ? 'bg-white' : 'bg-white/50'}`}
                      aria-label={`Gehe zu Bild ${i + 1}`}
                    />
                  ))}
                </div>
              </div>
            </>
          );
        })()}
      </section>
      */}

      {/* 4. EXPERIENCES CARDS (LUXURY THEME) - temporarily disabled, kept for future re-enable
      <section className="py-24 bg-[#FAF9F7] px-4">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <p className="text-luxury-heading uppercase tracking-[0.2em] text-xs font-semibold mb-4">
              ERLEBEN SIE ULTIMATIVE FLUGERLEBNISSE
            </p>
            <h2 className="font-luxury text-4xl md:text-6xl text-luxury-dark">IHR FLUGPARADIES</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

            {/* Card 1 }
            <div className="relative h-[550px] group overflow-hidden bg-white shadow-sm cursor-pointer">
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                style={{ backgroundImage: `url("${getImage(3, '/images/ausbildung-1.jpg')}")` }}
              ></div>
              <div className="absolute inset-0 bg-gradient-to-t from-luxury-dark/90 via-luxury-dark/20 to-transparent"></div>

              {/* Inner Border }
              <div className="absolute inset-4 border border-luxury-gold/50 pointer-events-none z-10 transition-colors group-hover:border-luxury-gold"></div>

              {/* Price Badge }
              <div className="absolute top-8 left-8 bg-white px-4 py-2 z-20 shadow-md">
                <span className="text-luxury-dark text-xs font-bold tracking-widest">120€ / PERSON</span>
              </div>

              <div className="absolute bottom-8 left-8 right-8 z-20">
                <p className="text-white uppercase tracking-[0.2em] text-[10px] font-bold mb-2">
                  EINSTIEG
                </p>
                <h3 className="font-luxury text-white text-3xl mb-4">Schnupperkurs</h3>
                <Link to="/ausbildung" className="text-white/90 uppercase tracking-widest text-[11px] font-medium flex items-center gap-2 group-hover:text-luxury-gold transition-colors">
                  DETAILS ANSEHEN <span className="text-sm">›</span>
                </Link>
              </div>
            </div>

            {/* Card 2 }
            <div className="relative h-[550px] group overflow-hidden bg-white shadow-sm cursor-pointer">
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                style={{ backgroundImage: `url("${getImage(4, '/images/ausbildung-2.jpg')}")` }}
              ></div>
              <div className="absolute inset-0 bg-gradient-to-t from-luxury-dark/90 via-luxury-dark/20 to-transparent"></div>
              <div className="absolute inset-4 border border-luxury-gold/50 pointer-events-none z-10 transition-colors group-hover:border-luxury-gold"></div>

              <div className="absolute top-8 left-8 bg-white px-4 py-2 z-20 shadow-md">
                <span className="text-luxury-dark text-xs font-bold tracking-widest">590€ / PERSON</span>
              </div>

              <div className="absolute bottom-8 left-8 right-8 z-20">
                <p className="text-white uppercase tracking-[0.2em] text-[10px] font-bold mb-2">
                  AUSBILDUNG
                </p>
                <h3 className="font-luxury text-white text-3xl mb-4">Grundkurs</h3>
                <Link to="/ausbildung" className="text-white/90 uppercase tracking-widest text-[11px] font-medium flex items-center gap-2 group-hover:text-luxury-gold transition-colors">
                  DETAILS ANSEHEN <span className="text-sm">›</span>
                </Link>
              </div>
            </div>

            {/* Card 3 }
            <div className="relative h-[550px] group overflow-hidden bg-white shadow-sm cursor-pointer">
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                style={{ backgroundImage: `url("${getImage(5, '/images/ausbildung-3.jpg')}")` }}
              ></div>
              <div className="absolute inset-0 bg-gradient-to-t from-luxury-dark/90 via-luxury-dark/20 to-transparent"></div>
              <div className="absolute inset-4 border border-luxury-gold/50 pointer-events-none z-10 transition-colors group-hover:border-luxury-gold"></div>

              <div className="absolute top-8 left-8 bg-white px-4 py-2 z-20 shadow-md">
                <span className="text-luxury-dark text-xs font-bold tracking-widest">950€ / PERSON</span>
              </div>

              <div className="absolute bottom-8 left-8 right-8 z-20">
                <p className="text-white uppercase tracking-[0.2em] text-[10px] font-bold mb-2">
                  AUSBILDUNG
                </p>
                <h3 className="font-luxury text-white text-3xl mb-4">Höhenflugkurs</h3>
                <Link to="/ausbildung" className="text-white/90 uppercase tracking-widest text-[11px] font-medium flex items-center gap-2 group-hover:text-luxury-gold transition-colors">
                  DETAILS ANSEHEN <span className="text-sm">›</span>
                </Link>
              </div>
            </div>

            {/* Card 4 }
            <div className="relative h-[550px] group overflow-hidden bg-white shadow-sm cursor-pointer">
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                style={{ backgroundImage: `url("${getImage(6, '/images/ausbildung-4.jpg')}")` }}
              ></div>
              <div className="absolute inset-0 bg-gradient-to-t from-luxury-dark/90 via-luxury-dark/20 to-transparent"></div>
              <div className="absolute inset-4 border border-luxury-gold/50 pointer-events-none z-10 transition-colors group-hover:border-luxury-gold"></div>

              <div className="absolute top-8 left-8 bg-white px-4 py-2 z-20 shadow-md">
                <span className="text-luxury-dark text-xs font-bold tracking-widest">1450€ / PERSON</span>
              </div>

              <div className="absolute bottom-8 left-8 right-8 z-20">
                <p className="text-white uppercase tracking-[0.2em] text-[10px] font-bold mb-2">
                  REISEN
                </p>
                <h3 className="font-luxury text-white text-3xl mb-4">Kolumbien Tour</h3>
                <Link to="/reisen" className="text-white/90 uppercase tracking-widest text-[11px] font-medium flex items-center gap-2 group-hover:text-luxury-gold transition-colors">
                  DETAILS ANSEHEN <span className="text-sm">›</span>
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>
      */}

      {bodyOnly || customBodyHtml ? (
        <section className="pt-8 pb-24 bg-white">
          <div className="container mx-auto px-4 lg:px-8 max-w-[1200px]">
            <SafeHtml html={customBodyHtml || ''} className="home-body-content" />
          </div>
        </section>
      ) : (
      <>
      {/* 5. PROMO CARDS (From Old Website) / UNSERE HIGHLIGHTS - KEPT, just the
          tagline+heading text above the cards was removed per request
          (commented out below, not deleted, in case it's wanted back later)
          <div className="text-center mb-16">
            <p className="text-luxury-heading uppercase tracking-[0.2em] text-xs font-semibold mb-4">
              ENTDECKEN SIE MEHR
            </p>
            <h2 className="font-luxury text-4xl md:text-6xl text-luxury-dark">UNSERE HIGHLIGHTS</h2>
          </div>
      */}
      <section className="pt-8 pb-24 bg-white relative z-30 border-t border-gray-100">
        <div className="container mx-auto px-4 lg:px-8 max-w-[1200px]">

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

            {/* Box 1: Fliegen Lernen - old site's box links to /ausbildung/schnupperkurs */}
            <Link to={promoCards[0].link || DEFAULT_PROMO_CARDS[0].link} className="relative h-[400px] group overflow-hidden bg-white shadow-xl cursor-pointer block">
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                style={{ backgroundImage: `url("${getImage(7, promoCards[0].image || DEFAULT_PROMO_CARDS[0].image)}")` }}
              ></div>
              <div className="absolute inset-0 bg-gradient-to-t from-luxury-dark/90 via-luxury-dark/40 to-black/20"></div>
              <div className="absolute inset-4 border border-white/20 pointer-events-none z-10 transition-colors group-hover:border-luxury-gold/50"></div>

              <div className="absolute top-8 left-8 right-8 z-20 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full border border-white flex items-center justify-center overflow-hidden bg-white">
                  <img src="/google.png" alt="Logo" className="w-full h-full object-contain" />
                </div>
                <h3 className="font-luxury text-white text-2xl uppercase tracking-widest">{promoCards[0].title}</h3>
              </div>

              <div className="absolute bottom-8 left-8 right-8 z-20">
                <p className="text-white font-bold text-sm mb-2">{promoCards[0].boldLine}</p>
                <SafeHtml html={promoCards[0].description} className="text-white/80 text-sm font-light leading-relaxed" />
              </div>
            </Link>

            {/* Box 2: Shop Geöffnet - old site's box links to /infos */}
            <Link to={promoCards[1].link || DEFAULT_PROMO_CARDS[1].link} className="relative h-[400px] group overflow-hidden bg-white shadow-xl cursor-pointer block">
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                style={{ backgroundImage: `url("${getImage(8, promoCards[1].image || DEFAULT_PROMO_CARDS[1].image)}")` }}
              ></div>
              <div className="absolute inset-0 bg-gradient-to-t from-luxury-dark/90 via-luxury-dark/40 to-black/20"></div>
              <div className="absolute inset-4 border border-white/20 pointer-events-none z-10 transition-colors group-hover:border-luxury-gold/50"></div>

              <div className="absolute top-8 left-8 right-8 z-20 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full border border-white flex items-center justify-center overflow-hidden bg-white">
                  <img src="/google.png" alt="Logo" className="w-full h-full object-contain" />
                </div>
                <h3 className="font-luxury text-white text-2xl uppercase tracking-widest">{promoCards[1].title}</h3>
              </div>

              <div className="absolute bottom-8 left-8 right-8 z-20">
                <p className="text-white font-bold text-sm mb-2">{promoCards[1].boldLine}</p>
                <SafeHtml html={promoCards[1].description} className="text-white/80 text-sm font-light leading-relaxed" />
              </div>
            </Link>

            {/* Box 3: On Tour - links to the real event list pre-filtered
                by search term, matching old's real eventlist behavior (see
                DEFAULT_PROMO_CARDS' own comment above). */}
            <Link to={promoCards[2].link || DEFAULT_PROMO_CARDS[2].link} className="relative h-[400px] group overflow-hidden bg-white shadow-xl cursor-pointer block">
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                style={{ backgroundImage: `url("${getImage(9, promoCards[2].image || DEFAULT_PROMO_CARDS[2].image)}")` }}
              ></div>
              <div className="absolute inset-0 bg-gradient-to-t from-luxury-dark/90 via-luxury-dark/40 to-black/20"></div>
              <div className="absolute inset-4 border border-white/20 pointer-events-none z-10 transition-colors group-hover:border-luxury-gold/50"></div>

              <div className="absolute top-8 left-8 right-8 z-20 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full border border-white flex items-center justify-center overflow-hidden bg-white">
                  <img src="/google.png" alt="Logo" className="w-full h-full object-contain" />
                </div>
                <h3 className="font-luxury text-white text-2xl uppercase tracking-widest">{promoCards[2].title}</h3>
              </div>

              <div className="absolute bottom-8 left-8 right-8 z-20">
                <p className="text-white font-bold text-sm mb-2">{promoCards[2].boldLine}</p>
                <SafeHtml html={promoCards[2].description} className="text-white/80 text-sm font-light leading-relaxed" />
              </div>
            </Link>

          </div>
        </div>
      </section>

      {/* 6. NEWS & HOCH HINAUS (CONTENT FROM OLD SITE) - KEPT */}
      <section className="pt-8 pb-24 bg-white border-b border-gray-100">
        <div className="container mx-auto px-4 lg:px-8 max-w-[1200px] flex flex-col lg:flex-row gap-16">

          {/* Left: NEWS */}
          <div className="w-full lg:w-5/12 flex flex-col">
            <div className="mb-10">
              <p className="text-luxury-heading uppercase tracking-[0.2em] text-xs font-semibold mb-3">
                {newsEyebrow}
              </p>
              <h2 className="font-luxury text-4xl md:text-5xl text-luxury-dark">{newsTitle}</h2>
            </div>

            <div className="w-full overflow-hidden h-[500px] flex items-start justify-start">
               {/* Facebook Page Plugin - official fb-page/XFBML embed, parsed
                   by the SDK script loaded above. data-adapt-container-width
                   makes the SDK measure this div's ACTUAL rendered CSS width
                   at parse time and use that for the iframe - since the div
                   itself had no width of its own (only the data-width hint,
                   which isn't real CSS), it was collapsing to the width of
                   its tiny fallback link text before the SDK ever got to it,
                   locking the plugin into a much narrower iframe than
                   intended. w-full makes it fill this column first.

                   Attributes match the old site's own live module exactly
                   (hiron_modules id 132, "HOME // Facebook 500px"):
                   data-show-posts="true" + small-header instead of the
                   fuller data-tabs="timeline" widget - the simpler
                   posts-only view we'd been using data-tabs for instead. */}
               <div
                  className="fb-page w-full"
                  data-href="https://www.facebook.com/fshirondelle"
                  data-width="500"
                  data-height="500"
                  data-small-header="true"
                  data-adapt-container-width="true"
                  data-hide-cover="false"
                  data-show-facepile="false"
                  data-show-posts="true"
               >
                  <blockquote cite="https://www.facebook.com/fshirondelle" className="fb-xfbml-parse-ignore">
                    <a href="https://www.facebook.com/fshirondelle">Flugschule Hirondelle</a>
                  </blockquote>
               </div>
            </div>
          </div>

          {/* Right: HOCH HINAUS & TEAM */}
          <div className="w-full lg:w-7/12 flex flex-col">
            <div className="mb-10">
              <p className="text-luxury-heading uppercase tracking-[0.2em] text-xs font-semibold mb-3">
                {hochHinausEyebrowPrefix} <Link to={teamLink} className="hover:underline">{hochHinausEyebrowLinkText}</Link>
              </p>
              <h2 className="font-luxury text-4xl md:text-5xl text-luxury-dark">{hochHinausTitle}</h2>
            </div>

            <SafeHtml
              html={hochHinausHtml}
              className="font-sans text-gray-500 font-light leading-relaxed text-sm md:text-base space-y-6 mb-16 [&_a]:text-[#428bca] [&_a:hover]:text-[#2a6496] [&_a:hover]:underline [&_a]:font-bold"
            />

            {/* Team Members - top row: Alex & Sarah, bottom row: the rest.
                Each member links to their own anchor on /infos/team
                (matching old's real per-person links, e.g.
                fs-hirondelle.de/team#alex), not just the page top. Falls
                back to the plain team page link if a member has no slug
                (e.g. old admin-edited HomeContent saved before slugs
                existed). */}
            <div className="flex flex-col gap-y-12">
              <div className="flex justify-center gap-x-10 sm:gap-x-16">
                {teamMembers.slice(0, 2).map((member) => (
                  <Link key={member.name} to={(member as any).slug ? `${teamLink}#${(member as any).slug}` : teamLink} className="flex flex-col items-center group cursor-pointer">
                    <div className="w-28 h-28 rounded-full overflow-hidden mb-4 border border-luxury-gold/30 group-hover:border-luxury-gold transition-colors p-1">
                      <img src={member.image} className="w-full h-full rounded-full object-cover" alt={member.name} />
                    </div>
                    <span className="font-luxury text-lg text-luxury-dark tracking-wide">{member.name}</span>
                  </Link>
                ))}
              </div>
              <div className="flex flex-wrap justify-center gap-x-6 sm:gap-x-10 gap-y-10">
                {teamMembers.slice(2).map((member) => (
                  <Link key={member.name} to={(member as any).slug ? `${teamLink}#${(member as any).slug}` : teamLink} className="flex flex-col items-center group cursor-pointer">
                    <div className="w-28 h-28 rounded-full overflow-hidden mb-4 border border-luxury-gold/30 group-hover:border-luxury-gold transition-colors p-1">
                      <img src={member.image} className="w-full h-full rounded-full object-cover" alt={member.name} />
                    </div>
                    <span className="font-luxury text-lg text-luxury-dark tracking-wide">{member.name}</span>
                  </Link>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>
      </>
      )}

      {/* 7. THE ESSENTIALS (SERVICES) / UNSER ANGEBOT - temporarily disabled, kept for future re-enable
      <section className="pt-8 pb-24 bg-white px-4">
        <div className="max-w-[1200px] mx-auto flex flex-col lg:flex-row gap-16">

          {/* Left: Text & Icons }
          <div className="w-full lg:w-1/2">
            <p className="text-luxury-heading uppercase tracking-[0.2em] text-xs font-semibold mb-4">
              ENTDECKEN SIE UNSERE DIENSTLEISTUNGEN
            </p>
            <h2 className="font-luxury text-5xl md:text-6xl text-luxury-dark mb-16">UNSER ANGEBOT</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-12 gap-x-8">
              {/* Service 1 }
              <div className="flex gap-4">
                <Car className="w-10 h-10 text-luxury-gold flex-shrink-0 stroke-[1.5]" />
                <div>
                  <h4 className="font-luxury text-2xl text-luxury-dark mb-2">Shuttle-Service</h4>
                  <p className="text-gray-500 text-sm font-light leading-relaxed">
                    Bequemer Transport direkt zu den Startplätzen in unserem komfortablen Schulbus.
                  </p>
                </div>
              </div>

              {/* Service 2 }
              <div className="flex gap-4">
                <img src="/google.png" alt="Logo" className="w-10 h-10 flex-shrink-0 object-contain" />
                <div>
                  <h4 className="font-luxury text-2xl text-luxury-dark mb-2">Moderne Ausrüstung</h4>
                  <p className="text-gray-500 text-sm font-light leading-relaxed">
                    Wir stellen die neueste und sicherste Ausrüstung für deine Flüge zur Verfügung.
                  </p>
                </div>
              </div>

              {/* Service 3 }
              <div className="flex gap-4">
                <Laptop className="w-10 h-10 text-luxury-gold flex-shrink-0 stroke-[1.5]" />
                <div>
                  <h4 className="font-luxury text-2xl text-luxury-dark mb-2">Online-Theorie</h4>
                  <p className="text-gray-500 text-sm font-light leading-relaxed">
                    Bereite dich bequem von zu Hause mit unserer digitalen Lernplattform vor.
                  </p>
                </div>
              </div>

              {/* Service 4 }
              <div className="flex gap-4">
                <Sun className="w-10 h-10 text-luxury-gold flex-shrink-0 stroke-[1.5]" />
                <div>
                  <h4 className="font-luxury text-2xl text-luxury-dark mb-2">Wetterbriefing</h4>
                  <p className="text-gray-500 text-sm font-light leading-relaxed">
                    Tägliche detaillierte Wetteranalysen für maximale Sicherheit am Berg.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Image Collage }
          <div className="w-full lg:w-1/2 flex gap-4 h-[600px]">
            <div className="w-1/2 h-full pt-12">
              <img
                src={getImage(10, '/images/ausbildung-2.jpg')}
                alt="Essential 1"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="w-1/2 h-full pb-12">
              <img
                src={getImage(11, '/images/ausbildung-3.jpg')}
                alt="Essential 2"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

        </div>
      </section>
      */}

    </div>
  );
};
