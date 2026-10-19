import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banner } from '../components/common/Banner';
import { Search } from 'lucide-react';
import { EventComments } from '../components/common/EventComments';
import { useLightbox } from '../components/common/Lightbox';
import { GutscheinBox } from '../components/common/GutscheinBox';
import { usePageGallery } from '../hooks/usePageGallery';

// Old site's actual "Simple Image Gallery" filenames for this page
// (/images/bilder/2-tour-slowenien/*), in their real order.
// Used only as a fallback now - see usePageGallery below - so the page keeps
// looking exactly like this until an admin configures a gallery for the
// "slowenien-tour" slug in Admin > Seitenmedien.
const FALLBACK_GALLERY = [
  'KobalaStart.jpg', 'Landeplatz.jpg', 'Liak.jpg', 'Slowenien_0523.jpg', 'Slowenien_0530.jpg',
  'Slowenien_0537.jpg', 'Slowenien_0551.jpg', 'Slowenien_0564.jpg', 'Slowenien_0575.jpg', 'Slowenien_0599.jpg',
  'Slowenien_0629.jpg', 'Slowenien_0635.jpg', 'Slowenien_0639.jpg', 'Slowenien_0640.jpg', 'Slowenien_0646.jpg',
  'Slowenien_0656.jpg', 'Soca.jpg', 'Soca2.jpg', 'Stol.jpg', 'Wandern2.jpg',
].map((f) => `/images/tour-slowenien/${f}`);

interface ContentBlock { heading: string; paragraphs: string[] }
interface Badge { label: string; color: string }

interface SlowenienTourData {
  eyebrow: string;
  heading: string;
  heroImage: string;
  heroImageAlt: string;
  contentBlocks: ContentBlock[];
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

const DEFAULT_CONTENT: SlowenienTourData = {
  eyebrow: 'REISEN',
  heading: 'Slowenien-Tour',
  heroImage: '/images/reisen/slowenien.jpg',
  heroImageAlt: 'Slowenien-Tour',
  contentBlocks: [
    {
      heading: 'Thermik und Streckenfliegen in Slowenien in den julischen Alpen',
      paragraphs: [
        'Hier könnt ihr erste Thermik- und Streckenflugerfahrungen sammeln, den 15 km B-Schein-Flug oder natürlich auch richtig lange Streckenflüge machen. Die ständige Erreichbarkeit von komfortablen Landewiesen ermöglichen ein entspanntes Streckenfliegen. Den Tag beenden wir dann mit einem verlängerten Abgleiter in die Abendsonne und einem Lande-Lasco.',
      ],
    },
    {
      heading: 'Fluggebiete',
      paragraphs: [
        'Unsere Hauptstartplätze liegen entlang der türkisblauen Soča in der Nähe von Kobarid und Tolmin. Je nach Windrichtung starten wir auf dem Stol (1.400 m) oder auf dem Kobala (1.100 m) bei Tolmin. Ein weiteres Fluggebiet ist der Liak Nähe Nova Gorica, eine wunderschöne riesige Soaringkante für stundenlange entspannte Flüge.',
      ],
    },
    {
      heading: 'Für wen ist die Reise gedacht?',
      paragraphs: [
        'Für diejenigen, die in einem entspannten Fluggebiet ihre ersten Soaring- und Thermikerfahrungen sammeln wollen sowie für den ambitionierten Genussflieger, der sich an seine ersten kleinen Strecken rantasten will. Aber auch der bereits erfahrene Streckenpilot kann hier weitere XC-Punkte sammeln. Mindestvoraussetzung ist der A-Schein oder Sopi.',
        'An nicht fliegbaren Tagen, gibt es einige Möglichkeiten in dieser Gegend schöne Ausflüge zu unternehmen oder je nach Wind Groundhandling, Kajaktouren, Rafting, Baden in der Soča, wandern – sehenswerter Naturpark direkt bei Tolmin, Höhlenbesichtigungen, Mountainbiking oder einfach nur der Soča zu chillen.',
      ],
    },
    {
      heading: 'Anreise, Unterkunft und Verpflegung',
      paragraphs: [
        'Die Anreise nach Slowenien erfolgt selbst oder mit unserem Flugschulbus. Wir übernachten in Slowenien auf dem Campingplatz – alternativ haben wir Kontakt zu Vermietern von Ferienwohnungen und Pensionen, dort können wir Zimmer vermitteln. Die Erlebnisse des Tages lassen wir dann abends in gemütlicher Runde nochmals in einer der vielen gemütlichen Lokale bei einem Lasco oder slowenischen Wein und natürlich Čevapčiči Revue passieren.',
      ],
    },
  ],
  leistungenHeading: 'Unsere Leistungen',
  leistungen: [
    'professionelle Betreuung durch unsere Fluglehrer',
    'Gelände- und spezielle Theorieeinweisung fürs Soaring, Thermikfliegen, Streckenfliegen',
    'Flugwetterbriefing',
    'Funkbetreuung',
    'exkl. Anreise, Unterkunft, Verpflegung, Auffahrten',
    'exkl. Geländegebühren',
    'exkl. Eintrittspreise für das Alternativprogramm',
    'exkl. Auslandskrankenversicherung inkl. Rücktransport\n(bitte unbedingt abschließen - gibt es z. B. für 13,90 € /Jahr beim ADAC)',
  ],
  badges: [
    { label: 'Streckenflugtraining', color: '#E58E26' },
    { label: 'Thermik- und Flugtechniktraining', color: '#34963B' },
    { label: 'Soaringtraining', color: '#80C533' },
    { label: 'Groundhandlingtraining', color: '#3274B7' },
  ],
  bookingButtonText: 'Reise buchen',
  bookingButtonLink: '/events?category=Reisen',
  priceLabel: 'Tourpreis',
  price: '890,- €',
  voraussetzungText: 'Voraussetzung: mindestens A-Schein / Sopi',
  scheduleButtonText: 'Termine > siehe Kalender',
  scheduleButtonLink: '/events?search=Slowenien',
  gutscheinHeading: 'Tour Verschenken',
  gutscheinDescription: 'Die Tour ist auch als Geschenk-Gutschein möglich',
};

export const SlowenienTour = ({ contentId }: { contentId?: string } = {}) => {
  const { openGallery } = useLightbox();
  // Admin-managed gallery (falls back to FALLBACK_GALLERY above) - see
  // frontend/src/hooks/usePageGallery.ts
  const galleryImages = usePageGallery('slowenien-tour', FALLBACK_GALLERY);
  const [content, setContent] = useState<SlowenienTourData>(DEFAULT_CONTENT);

  useEffect(() => {
    fetch(`/api/sitepagecontent/public/${contentId || 'slowenien-tour'}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setContent(data); })
      .catch((err) => console.error('Error fetching Slowenien-Tour content:', err));
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
              {content.heading}
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
              {content.contentBlocks.map((block, i) => (
                <div key={i}>
                  <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic">{block.heading}</h3>
                  {block.paragraphs.map((p, pi) => (
                    <p key={pi} className={pi < block.paragraphs.length - 1 ? 'mb-4' : undefined}>
                      {p}
                    </p>
                  ))}
                </div>
              ))}
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
              {content.badges.map((badge, i) => (
                <div key={i} style={{ backgroundColor: badge.color }} className="py-2">{badge.label}</div>
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
            <div data-live-block="gallery" data-live-slug="slowenien-tour" data-live-fallback={JSON.stringify(FALLBACK_GALLERY)}>
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
          <EventComments pageSlug="slowenien-tour" />
        </div>
      </section>

    </div>
  );
};
