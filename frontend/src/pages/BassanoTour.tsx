import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banner } from '../components/common/Banner';
import { Search } from 'lucide-react';
import { EventComments } from '../components/common/EventComments';
import { useLightbox } from '../components/common/Lightbox';
import { GutscheinBox } from '../components/common/GutscheinBox';
import { usePageGallery } from '../hooks/usePageGallery';

// Old site's actual "Simple Image Gallery" filenames for this page
// (/images/bilder/2-tour-bassano/*), in their real order.
// Used only as a fallback now - see usePageGallery below - so the page keeps
// looking exactly like this until an admin configures a gallery for the
// "bassano-tour" slug in Admin > Seitenmedien.
const FALLBACK_GALLERY = [
  'Bassano_3331.jpg', 'Bassano_3356.jpg', 'Bassano_3407.jpg', 'Bassano_3447.jpg', 'Bassano_3477.jpg',
  'Bassano_3503.jpg', 'Bassano_3516.jpg', 'Bassano_3525.jpg', 'Bassano_3674.jpg', 'Bassano_3679.jpg',
  'Bassano_3721.jpg', 'Bassano_3729.jpg', 'Bassano_3733.jpg', 'Bassano_6516.jpg', 'DSC03562.jpg',
  'DSC03619.jpg', 'DSC03657.jpg', 'DSC03674.jpg', 'IMG_4950.jpg', 'IMG_4952.jpg',
  'IMG_7386.JPG', 'IMG_7389.JPG', 'IMG_7413.JPG', 'itemimg-bassano.jpg',
].map((f) => `/images/tour-bassano/${f}`);

interface Badge { label: string; color: string }

interface BassanoTourData {
  eyebrow: string;
  heading: string;
  heroImage: string;
  heroAlt: string;
  section1Heading: string;
  section1Paragraph: string;
  fluggebietHeading: string;
  fluggebietParagraph1: string;
  fluggebietListItems: string[];
  fluggebietParagraph2: string;
  fuerWenHeading: string;
  fuerWenParagraph: string;
  anreiseHeading: string;
  anreiseParagraph: string;
  leistungenHeading: string;
  leistungen: string[];
  flyerImage: string;
  flyerAlt: string;
  badges: Badge[];
  bookingButtonText: string;
  bookingButtonLink: string;
  priceLabel: string;
  price: string;
  requirementText: string;
  scheduleButtonText: string;
  scheduleButtonLink: string;
  gutscheinHeading: string;
  gutscheinDescription: string;
}

const DEFAULT_CONTENT: BassanoTourData = {
  eyebrow: 'REISEN',
  heading: 'Bassano-Tour',
  heroImage: '/images/reisen/bassano.jpg',
  heroAlt: 'Bassano-Tour',
  section1Heading: 'Gleitschirm-Thermik-Strecken-Fliegen Bassano',
  section1Paragraph: 'Bassano ist das unbestrittene Mekka der Gleitschirm- und Drachenszene in den Südalpen. Besonders im Winter und zeitigen Frühjahr trifft sich hier die Szene. Daher ist im Winterhalbjahr vor allem an Wochenenden viel los. Die Thermik ist ganzjährig interessant und kann schon früh im Jahr für Streckenflüge genutzt werden. Es bietet ca. 320 fliegbare Tage pro Jahr. Von wunderschönen, stundenlangen Thermikflügen mit herrlichem Blick auf die Poebene bis zu schönen Streckenflügen. Bassano bietet mehrere Startplätze die bequem mit einem Shuttlebus erreicht werden können.',
  fluggebietHeading: 'Das Fluggebiet',
  fluggebietParagraph1: 'Das Bergmassiv Monte Grappa mit seinen ca. 1.600 Höhenmetern ist eine riesige langgezogene Bergkette, welche südlich ausgerichtet ist und für zuverlässige Thermik sorgt. Es gibt zahlreiche Startmöglichkeiten für fast alle Windrichtungen.',
  fluggebietListItems: [
    'O-Startplatz: Antenna Costalunga, 755 m NN',
    'S-Startplatz: Da Bepi, 829 m NN',
    'W-Startplatz: Casette, 975 m NN',
    'SSO-Startplatz: Campeggia, 1.080 m NN',
    'SO-Startplatz: Panettone - Cima Grappa, 1.563 m NN',
  ],
  fluggebietParagraph2: 'Bei entsprechendem Wetter sind Tagesausflüge in die benachbarten unbekannteren Fluggebiete geplant.',
  fuerWenHeading: 'Für wen ist die Reise gedacht?',
  fuerWenParagraph: 'Für diejenigen, die in einem entspannten Fluggebiet ihre ersten Thermikerfahrungen sammeln wollen, sowie den ambitionierten Genussflieger der sich an seine ersten kleinen Strecken ran tasten will.',
  anreiseHeading: 'Anreise, Unterkunft und Verpflegung',
  anreiseParagraph: 'Wir wollen im Hotel in der Nähe vom Landeplatz einchecken. Dort können Doppelzimmer oder auch Einzelzimmer gebucht werden (Orga über uns), jeweils inkl. Frühstück. Alternativ könnt ihr auf dem angeschlossenen Campingplatz unterkommen. Nach dem Fliegen lassen wir den Tag in geselliger Runde bei gemeinsamem Abendessen ausklingen und lassen uns von der italienischen Küche verwöhnen.',
  leistungenHeading: 'Leistungen',
  leistungen: [
    'professionelle Betreuung durch unsere Fluglehrer',
    'Gelände- und spezielle Theorieeinweisung fürs Soaring, Thermikfliegen, Streckenfliegen',
    'Flugwetterbriefing',
    'Funkbetreuung',
    'Videoanalyse',
    'exkl. Anreise, Unterkunft, Verpflegung, Auffahrten',
    'exkl. Geländegebühren',
    'exkl. Eintrittspreise für das Alternativprogramm',
    'exkl. Auslandskrankenversicherung inkl. Rücktransport',
  ],
  flyerImage: '/images/flyers/bassano.png',
  flyerAlt: 'Flugschule Hirondelle Flyer Bassano',
  badges: [
    { label: 'Streckenflugtraining', color: '#E58E26' },
    { label: 'Thermik- und Flugtechniktraining', color: '#34963B' },
    { label: 'Soaringtraining', color: '#80C533' },
  ],
  bookingButtonText: 'Reise buchen',
  bookingButtonLink: '/events?category=Reisen',
  priceLabel: 'Tourpreis',
  price: '850,- €',
  requirementText: 'Voraussetzung: mindestens A-Schein / Sopi',
  scheduleButtonText: 'Termine > siehe Kalender',
  scheduleButtonLink: '/events?search=Bassano',
  gutscheinHeading: 'Tour Verschenken',
  gutscheinDescription: 'Die Tour ist auch als Geschenk-Gutschein möglich',
};

export const BassanoTour = ({ contentId }: { contentId?: string } = {}) => {
  const { openGallery } = useLightbox();
  // Admin-managed gallery (falls back to FALLBACK_GALLERY above) - see
  // frontend/src/hooks/usePageGallery.ts
  const galleryImages = usePageGallery('bassano-tour', FALLBACK_GALLERY);
  const [content, setContent] = useState<BassanoTourData>(DEFAULT_CONTENT);

  useEffect(() => {
    fetch(`/api/sitepagecontent/public/${contentId || 'bassano-tour'}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setContent(data); })
      .catch((err) => console.error('Error fetching Bassano-Tour content:', err));
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
                alt={content.heroAlt}
                className="w-full h-full object-cover transition-transform duration-1000 hover:scale-105"
              />
            </div>

            {/* Content Blocks */}
            <div className="space-y-10 text-gray-600 font-light leading-relaxed text-justify">

              <div>
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic">{content.section1Heading}</h3>
                <p className="mb-4">
                  {content.section1Paragraph}
                </p>
              </div>

              <div>
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic">{content.fluggebietHeading}</h3>
                <p className="mb-4">
                  {content.fluggebietParagraph1}
                </p>
                <ul className="list-disc pl-5 mb-4 space-y-1 text-gray-600">
                  {content.fluggebietListItems.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
                <p>
                  {content.fluggebietParagraph2}
                </p>
              </div>

              <div>
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic">{content.fuerWenHeading}</h3>
                <p>
                  {content.fuerWenParagraph}
                </p>
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
              <ul className="space-y-4 mb-12">
                {content.leistungen.map((item, idx) => (
                  <li key={idx} className="flex gap-4 items-start text-gray-600 font-light text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#53a8c7] mt-2 shrink-0"></span>
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>

              {/* Flyer Mockup Image */}
              <div className="w-full max-w-xs mx-auto">
                <img src={content.flyerImage} alt={content.flyerAlt} className="w-full h-auto rounded-md shadow-2xl rotate-[-2deg] hover:rotate-0 transition-transform duration-500" />
          </div>
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
                  <p className="text-gray-600 font-light mb-4">{content.requirementText}</p>
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
            <div data-live-block="gallery" data-live-slug="bassano-tour" data-live-fallback={JSON.stringify(FALLBACK_GALLERY)}>
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
          <EventComments pageSlug="bassano-tour" />
        </div>
      </section>

    </div>
  );
};
