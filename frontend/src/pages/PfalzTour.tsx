import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banner } from '../components/common/Banner';
import { Search } from 'lucide-react';
import { EventComments } from '../components/common/EventComments';
import { useLightbox } from '../components/common/Lightbox';
import { GutscheinBox } from '../components/common/GutscheinBox';
import { usePageGallery } from '../hooks/usePageGallery';
import { SafeHtml } from '../components/common/SafeHtml';

// Old site's actual "Simple Image Gallery" filenames for this page
// (/images/bilder/2-tour-pfalz/*), in their real order.
// Used only as a fallback now - see usePageGallery below - so the page keeps
// looking exactly like this until an admin configures a gallery for the
// "pfalz-tour" slug in Admin > Seitenmedien.
const FALLBACK_GALLERY = [
  'GP020005.jpg', 'IMG_7770.jpg', 'Pfalztour.jpg', 'Platzhalterbild.jpg', 'pfalz1.jpg',
  'pfalz111.jpg', 'pfalz18.jpg', 'pfalz2.jpg', 'pfalz3.jpg', 'pfalz5.jpg',
  'pfalz7.jpg', 'pfalz9.jpg',
].map((f) => `/images/tour-pfalz/${f}`);

interface Badge { label: string; color: string }

interface PfalzTourData {
  eyebrow: string;
  title: string;
  heroImage: string;
  heroImageAlt: string;
  introHeading: string;
  introParagraphsHtml: string;
  tourdatenHeading: string;
  tourdatenItems: string[];
  anreiseHeading: string;
  anreiseParagraph: string;
  leistungenHeading: string;
  leistungen: string[];
  badges: Badge[];
  bookingButtonText: string;
  bookingButtonLink: string;
  priceLabel: string;
  price: string;
  voraussetzungText: string;
  scheduleButtonText: string;
  scheduleButtonLink: string;
  gutscheinHeading: string;
  gutscheinDescription: string;
}

const DEFAULT_CONTENT: PfalzTourData = {
  eyebrow: 'REISEN',
  title: 'Pfalz-Tour',
  heroImage: '/images/reisen/pfalz.jpg',
  heroImageAlt: 'Pfalz-Tour',
  introHeading: 'In der Südpfalz gibt es schöne Startplätze die allemal einen Besuch wert sind.',
  introParagraphsHtml:
    '<p class="mb-4">Die Duddefliecher in der Südpfalz mischen unter den Topfliegern der deutschen Gleitschirmwettbewerbe mit. Der deutsche Meister 2012/13, Achim Torn, kommt ebenfalls aus der Südpfalz. Die Buckel der Südpfälzer haben einen Höhenunterschied von bis zu 320 m. Es werden von dort regelmäßig schöne Streckenflüge in den DHV-XC eingereicht. Stundenlange Thermikflüge sind hier ebenso möglich.</p>' +
    '<p class="mb-4">Wir werden mit euch bis zu 7 Startplätze besuchen und euch die nötige Einweisung für diese Fluggelände geben, damit ihr später auch mal als Gast in der Südpfalz fliegen könnt. Wer weiß, vielleicht gefällt es euch ja so gut, dass ihr gleich Mitglied im heimischen Verein werden wollt.</p>' +
    '<p>Die Tour wird von Alex geführt, der diese Gelände wie seine Westentasche kennt. Alex fliegt fast alle seine Streckenflüge von der Südpfalz aus und kann euch bei einem kleinen Streckenvortrag viele Tipps für den Thermikeinstieg geben.</p>',
  tourdatenHeading: 'Tourdaten',
  tourdatenItems: [
    'Beginn: Freitag ab ca. 15:00 Uhr',
    'Ende: Sonntag open End',
  ],
  anreiseHeading: 'Anreise, Unterkunft und Verpflegung',
  anreiseParagraph:
    'Der genaue Treffpunkt wird den Teilnehmern kurz vor Reisebeginn per Email bekannt gegeben - wir schauen, welcher Berg am Freitag direkt taugt. Es empfiehlt sich eine Unterkunft irgendwo zwischen Annweiler / Dernbach und Landau zu buchen – von Annweiler aus ist jeder der 7 Startberge innerhalb von 5 bis 15 Autominuten zu erreichen! Eschbach oder Leinsweiler sind auch für die Abendplanung eine gute Option zum Übernachten. Abends kehren wir gemeinsam ein zu einem zünftigen Abendessen und natürlich ner Pfälzer Weinschorle :-)',
  leistungenHeading: 'Unsere Leistungen',
  leistungen: [
    'professionelle Betreuung durch unsere Fluglehrer',
    'Gelände- und spezielle Theorieeinweisung fürs Soaring, Thermikfliegen, Streckenfliegen',
    'tägliches Flugwetterbriefing',
    'Einweisungsbestätigung für die Flugberge',
    'Funkbetreuung',
    'Geländegebühr vor Ort 15,- € für die Tour',
    'exkl. Übernachtungskosten',
  ],
  badges: [
    { label: 'Streckenflugtraining', color: '#E58E26' },
    { label: 'Thermik- und Flugtechniktraining', color: '#34963B' },
    { label: 'Soaringtraining', color: '#80C533' },
  ],
  bookingButtonText: 'Reise buchen',
  bookingButtonLink: '/events?category=Reisen',
  priceLabel: 'Tourpreis',
  price: '350,- €',
  voraussetzungText: 'Voraussetzung: mindestens 5 Teilnehmer, A-Schein / Sopi',
  scheduleButtonText: 'Termine > siehe Kalender',
  scheduleButtonLink: '/events?search=Pfalz',
  gutscheinHeading: 'Tour Verschenken',
  gutscheinDescription: 'Die Tour ist auch als Geschenk-Gutschein möglich',
};

export const PfalzTour = ({ contentId }: { contentId?: string } = {}) => {
  const { openGallery } = useLightbox();
  // Admin-managed gallery (falls back to FALLBACK_GALLERY above) - see
  // frontend/src/hooks/usePageGallery.ts
  const galleryImages = usePageGallery('pfalz-tour', FALLBACK_GALLERY);
  const [content, setContent] = useState<PfalzTourData>(DEFAULT_CONTENT);

  useEffect(() => {
    fetch(`/api/sitepagecontent/public/${contentId || 'pfalz-tour'}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setContent(data); })
      .catch((err) => console.error('Error fetching Pfalz-Tour content:', err));
  }, [contentId]);

  return (
    <div className="w-full bg-white font-luxurysans">
      {/* Banner Component */}
      <Banner />

      {/* Main Content Section */}
      <section className="pt-16 md:pt-24 pb-8 md:pb-12 px-4">
        <div className="max-w-[1200px] mx-auto">

          {/* Page Title (full width, above the two-column grid) */}
          <div className="mb-12">
            <p className="text-luxury-heading uppercase tracking-[0.2em] text-xs font-semibold mb-3">
              {content.eyebrow}
            </p>
            <h1 className="font-luxury text-4xl md:text-5xl text-luxury-dark uppercase">
              {content.title}
            </h1>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

          {/* Left Column (Content) */}
          <div className="lg:col-span-7 space-y-12">

            {/* Main Image */}
            <div className="w-full h-[400px] relative overflow-hidden rounded-sm shadow-sm">
              <img
                src={content.heroImage}
                alt={content.heroImageAlt}
                className="w-full h-full object-cover transition-transform duration-1000 hover:scale-105"
              />
            </div>

            {/* Content Blocks */}
            <div className="space-y-10 text-gray-600 font-light leading-relaxed text-justify">

              <div>
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic">{content.introHeading}</h3>
                <SafeHtml html={content.introParagraphsHtml} />
              </div>

              <div>
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic">{content.tourdatenHeading}</h3>
                <ul className="list-disc pl-5 space-y-2">
                  {content.tourdatenItems.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic">{content.anreiseHeading}</h3>
                <p>
                  {content.anreiseParagraph}
                </p>
              </div>

            </div>

            {/* Leistungen inside Left Column */}
            <div className="mt-12 pt-12 border-t border-gray-100">
              <h3 className="font-luxury text-3xl text-luxury-dark mb-8 uppercase tracking-wider border-b border-gray-200 pb-4 text-[#53a8c7]">{content.leistungenHeading}</h3>
              <ul className="space-y-4">
                {content.leistungen.map((item, idx) => (
                  <li key={idx} className="flex gap-4 items-start text-gray-600 font-light text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#53a8c7] mt-2 shrink-0"></span>
                    <span className="leading-relaxed whitespace-pre-line">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

          </div>

          {/* Right Column (Sidebar) */}
          <div className="lg:col-span-5 space-y-12">

            {/* Badges */}
            <div className="flex flex-col gap-1 w-full font-semibold text-white text-center text-sm">
              {content.badges.map((badge, idx) => (
                <div key={idx} style={{ backgroundColor: badge.color }} className="py-2">{badge.label}</div>
              ))}
            </div>

            {/* Booking Card */}
            <div className="bg-[#FAF9F7] p-8 border border-gray-100 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-[#53a8c7] transform origin-left transition-transform duration-500 scale-x-0 group-hover:scale-x-100"></div>

              <Link
                to={content.bookingButtonLink}
                className="block w-full bg-[#53a8c7] hover:bg-[#4396b5] text-white text-center py-3 text-lg font-semibold transition-colors mb-8 shadow-md flex items-center justify-center gap-2"
              >
                {content.bookingButtonText}
              </Link>

              <div className="space-y-6 mb-8 text-sm">
                <div>
                  <div className="flex justify-between items-start gap-4">
                    <p className="text-luxury-dark font-medium">{content.priceLabel}</p>
                    <div className="text-right">
                      <p className="font-medium text-luxury-dark whitespace-nowrap text-lg">{content.price}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <p className="text-gray-600 font-light mb-4">{content.voraussetzungText}</p>
                </div>
              </div>

              <Link to={content.scheduleButtonLink} className="block w-full bg-[#4a5f68] hover:bg-[#3d4f57] text-white text-center py-3 font-semibold shadow-md transition-colors">
                {content.scheduleButtonText}
              </Link>
            </div>

            <GutscheinBox
              heading={content.gutscheinHeading}
              description={content.gutscheinDescription}
              headingClassName="text-[#53a8c7]"
            />

            {/* Impressions Gallery */}
            {/* data-live-*: the Joomla-style page editor keeps this gallery live (utils/liveBlocks.tsx) */}
            <div data-live-block="gallery" data-live-slug="pfalz-tour" data-live-fallback={JSON.stringify(FALLBACK_GALLERY)}>
               <h3 className="font-luxury text-2xl text-[#53a8c7] mb-6 uppercase tracking-wider border-b border-gray-200 pb-4">
                 Impressionen
               </h3>
               <div className="grid grid-cols-3 gap-2">
                 {galleryImages.map((img, index) => (
                   <div
                     key={img}
                     className="relative aspect-square overflow-hidden group cursor-zoom-in bg-gray-100"
                     onClick={() => openGallery(
                       galleryImages.map((g) => ({ src: g, alt: 'Impression' })),
                       index
                     )}
                   >
                     <img
                       src={img}
                       alt={`Impression ${index + 1}`}
                       className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                     />
                     <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                       <Search className="w-5 h-5 text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]" />
                     </div>
                   </div>
                 ))}
               </div>
            </div>

          </div>

          </div>
        </div>

        <div id="comments" className="max-w-[1200px] mx-auto mt-12">
          <EventComments pageSlug="pfalz-tour" />
        </div>
      </section>

    </div>
  );
};
