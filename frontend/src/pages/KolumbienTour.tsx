import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banner } from '../components/common/Banner';
import { Search } from 'lucide-react';
import { EventComments } from '../components/common/EventComments';
import { useLightbox } from '../components/common/Lightbox';
import { GutscheinBox } from '../components/common/GutscheinBox';
import { usePageGallery } from '../hooks/usePageGallery';

// Old site's actual "Simple Image Gallery" filenames for this page
// (/images/bilder/2-tour-kolumbien/*), in their real order.
// Used only as a fallback now - see usePageGallery below - so the page keeps
// looking exactly like this until an admin configures a gallery for the
// "kolumbien-tour" slug in Admin > Seitenmedien.
const FALLBACK_GALLERY = [
  'Kolumbien.jpg', 'Kolumbien_0325.jpg', 'Kolumbien_2.jpg', 'Kolumbien_3.jpg', 'Kolumbien_3.png',
  'Kolumbien_3915.jpg', 'Kolumbien_3934.jpg', 'Kolumbien_3937.jpg', 'Kolumbien_3938.jpg', 'Kolumbien_3944.jpg',
  'Kolumbien_3958.jpg', 'Kolumbien_3961.jpg', 'Kolumbien_3979.jpg', 'Kolumbien_3985.jpg', 'Kolumbien_3991.jpg',
  'Kolumbien_3992.jpg', 'Kolumbien_3996.jpg', 'Kolumbien_3997_2.jpg', 'Kolumbien_4.jpg', 'Kolumbien_4003.jpg',
  'Kolumbien_4024.jpg', 'Kolumbien_4026.jpg', 'Kolumbien_4042.jpg', 'Kolumbien_4047.jpg', 'Kolumbien_4049.jpg',
  'Kolumbien_4097.jpg', 'Kolumbien_5457.jpg', 'Kolumbien_5470.jpg', 'Kolumbien_8764.jpg', 'Kolumbien_8904.jpg',
  'Kolumbien_8955.jpg', 'Kolumbien_8963.jpg', 'Kolumbien_8969.jpg', 'Kolumbien_8973.jpg', 'Kolumbien_8978_2.jpg',
  'Kolumbien_8979.jpg', 'Kolumbien_9008.jpg', 'Kolumbien_9013.jpg', 'Kolumbien_9026.jpg', 'Kolumbien_9055.jpg',
  'Kolumbien_9094.jpg', 'Kolumbien_9095.jpg', 'Kolumbien_9123.jpg', 'Kolumbien_9197.jpg', 'Kolumbien_9202.jpg',
  'Kolumbien_9227.jpg', 'Kolumbien_9237.jpg', 'Kolumbien_9253.jpg', 'Kolumbien_9274.jpg', 'Kolumbien_9325.jpg',
  'Kolumbien_9346.jpg', 'Kolumbien_9353.jpg', 'Kolumbien_9382.jpg', 'Kolumbien_9FD1.jpg',
].map((f) => `/images/tour-kolumbien/${f}`);

interface Station { icon: string; heading: string; text: string }
interface Badge { label: string; color: string }

interface KolumbienTourData {
  eyebrow: string;
  title: string;
  heroImage: string;
  heroAlt: string;
  block1Heading: string;
  block1Paragraph1: string;
  block1Paragraph2: string;
  block2Heading: string;
  block2Intro: string;
  block2Paragraph: string;
  block2Stations: Station[];
  block3Heading: string;
  block3Paragraph1: string;
  block3Paragraph2: string;
  block4Heading: string;
  block4Paragraph1: string;
  block4Paragraph2: string;
  leistungenHeading: string;
  leistungen: string[];
  badges: Badge[];
  bookingButtonText: string;
  bookingButtonLink: string;
  priceLabel: string;
  price: string;
  priceNote: string;
  scheduleButtonText: string;
  scheduleButtonLink: string;
  gutscheinHeading: string;
  gutscheinDescription: string;
}

const DEFAULT_CONTENT: KolumbienTourData = {
  eyebrow: 'REISEN',
  title: 'Kolumbien-Tour',
  heroImage: '/images/reisen/kolumbien.jpg',
  heroAlt: 'Kolumbien-Tour',
  block1Heading: 'Thermik- und Streckenfliegen in Kolumbien',
  block1Paragraph1: 'Wir fliegen über den grünen Landschaften des Valle del Cauca. Dabei genießen wir die großartige Gastfreundschaft der Kolumbianer und befliegen über mehrere Stationen die besten Fluggebiete von Cali Richtung Medellin. Die sanfte Thermik und das breite Tal mit zahllosen Landemöglichkeiten laden zu gemeinsamen Thermik- und Streckenflügen ein.',
  block1Paragraph2: "Wir befliegen zuerst die Fluggebiete von Piedechinche, die in unmittelbarer Nähe zu Cali liegen. Weiter geht's Richtung Norden mit 3 weiteren Stops und diversen Fluggebieten im Valle de Cauca bis Medellin, wo wir unsere Tour beenden.",
  block2Heading: 'Fluggebiete',
  block2Intro: 'Valle del Cauca',
  block2Paragraph: 'Mit den bekannten Fluggebieten Roldanillo, dem Austragungsort des PWC 2011 und Super Finals 2013, Ansermanuevo, La Pintada und Piedechinche. Roldanillo liegt 1000 m über dem Meeresspiegel. Das Klima ist tropisch warm, die westliche Kette der Anden sperrt die Zufuhr von kühler und feuchter Luft vom Pazifischen Ozean. Die Durchschnittstemperatur liegt zw. 26° - 28° C . Die trockenen Jahreszeiten sind Dezember bis März und Juli bis August, der Rest ist Regenzeit. Die Stationen im Einzelnen:',
  block2Stations: [
    {
      icon: '📍',
      heading: 'Piedechinche – Der Auftakt in den Anden',
      text: 'Unsere Reise beginnt südlich von Cali im grünen Herz des Valle del Cauca. In Piedechinche, nahe Palmira, liegt unsere erste Unterkunft – umgeben von Zuckerrohrfeldern und ersten genialen Fluggebieten. Hier sammeln wir die ersten Thermikstunden bei stabilen Bedingungen mit spektakulärem Blick auf das Tal.',
    },
    {
      icon: '🗺️',
      heading: 'La Unión – Vielfalt in der Luft & am Boden',
      text: 'Weiter geht\'s nach La Unión, bekannt für seine exzellenten Flugspots: Ansermanuevo, Roldanillo und Apía. Die Region ist das Zentrum des kolumbianischen Gleitschirmfliegens und hat schon internationale Wettbewerbe beherbergt. Neben dem Fliegen erwarten uns Kolumbiens typischer Kaffee, kleine Dörfer mit kolonialem Flair und beeindruckende Berglandschaften.',
    },
    {
      icon: '🏕️',
      heading: 'Jericó – Hoch über dem Tal',
      text: 'Ein echter Geheimtipp ist unser nächster Stopp: Jericó, ein charmantes Bergstädtchen mit Top-Flugbedingungen. Die Szenerie rund um die schroffen Hänge und grünen Hochplateaus bietet beste Voraussetzungen für Thermik, Soaring – und atemberaubende Aussicht.',
    },
    {
      icon: '🌇',
      heading: 'Finale in Medellín – Kultur, Kaffee & Cityvibes',
      text: 'Zum Abschluss der Reise lassen wir es uns in Medellín, der „Stadt des ewigen Frühlings", gutgehen. Neben einem möglichen Flugspot am Stadtrand steht hier auch Sightseeing auf dem Programm: lebendige Märkte, Street Art in Comuna 13, Seilbahnfahrten über die Stadtviertel und kolumbianische Küche vom Feinsten.',
    },
  ],
  block3Heading: 'Für wen ist die Reise gedacht?',
  block3Paragraph1: 'Die Reise ist sowohl für engagierte Hobbypiloten wie auch für den versierten Flieger geeignet. Für alle, die fliegerisch dazulernen und für diejenigen, die ihre ersten kleinen Streckenflüge machen möchten – aber auch Streckencracks kommen voll auf ihre Kosten!',
  block3Paragraph2: 'Mindestvoraussetzung ist der A-Schein.',
  block4Heading: 'Anreise, Unterkunft und Verpflegung',
  block4Paragraph1: 'Die Anreise / Hin- und Rückflug erfolgt nach Cali bzw. Medellin. Zwecks gemeinsamer Anreise in der gleichen Maschine geben wir euch gerne die Flugnummer.',
  block4Paragraph2: 'Während unseres Aufenthalts sind wir in landestypischen Gästehäusern oder Hotels in der Nähe der Startplätze untergebracht. Nach dem Fliegen lassen wir den Tag in geselliger Runde bei gemeinsamem Abendessen ausklingen und lassen uns von der kolumbianischen Küche verwöhnen.',
  leistungenHeading: 'Unsere Leistungen',
  leistungen: [
    'professionelle Betreuung durch unsere Fluglehrer plus mitfliegendem Guide aus Kolumbien',
    'Gelände- und spezielle Theorieeinweisung fürs Soaring, Thermikfliegen, Streckenfliegen',
    'Flugwetterbriefing',
    'Funkbetreuung',
    'Flug-/Videoanalyse',
    'alle Transfers während der Reisedauer sowie Auffahrten zu Startplätzen',
    'Rückholen nach den Streckenflügen :-)!',
    'Übernachtungen in Gästehäusern, im Doppel-/Dreibettzimmer inkl. Frühstück',
    'Organisation eines Alternativprogramms bei schlechtem Wetter',
    'exkl. Hin- und Rückflug nach Kolumbien',
    'exkl. Sim-Karte für Kolumbien, Datenpakete müssen separat gekauft werden',
    'exkl. Geländegebühren vor Ort',
    'exkl. Eintrittspreise für das Alternativprogramm',
    'exkl. Auslandskrankenversicherung inkl. Rücktransport (Bitte unbedingt abschließen - gibt es für kleines Geld beim ADAC)',
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
  price: '2.690,- €',
  priceNote: 'Voraussetzung: mindestens A-Schein / Sopi',
  scheduleButtonText: 'Termin: siehe Kalender',
  scheduleButtonLink: '/events?search=Kolumbien',
  gutscheinHeading: 'Tour Verschenken',
  gutscheinDescription: 'Die Tour ist auch als Geschenk-Gutschein möglich',
};

export const KolumbienTour = ({ contentId }: { contentId?: string } = {}) => {
  const { openGallery } = useLightbox();
  // Admin-managed gallery (falls back to FALLBACK_GALLERY above) - see
  // frontend/src/hooks/usePageGallery.ts
  const galleryImages = usePageGallery('kolumbien-tour', FALLBACK_GALLERY);
  const [content, setContent] = useState<KolumbienTourData>(DEFAULT_CONTENT);

  useEffect(() => {
    fetch(`/api/sitepagecontent/public/${contentId || 'kolumbien-tour'}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setContent(data); })
      .catch((err) => console.error('Error fetching Kolumbien-Tour content:', err));
  }, [contentId]);

  return (
    <div className="w-full bg-white font-luxurysans">
      {/* Banner Component */}
      <Banner />

      {/* Main Content Section */}
      <section className="py-16 md:py-24 px-4">
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
                alt={content.heroAlt}
                className="w-full h-full object-cover transition-transform duration-1000 hover:scale-105"
              />
            </div>

            {/* Content Blocks */}
            <div className="space-y-10 text-gray-600 font-light leading-relaxed text-justify">

              <div>
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic">{content.block1Heading}</h3>
                <p className="mb-4">
                  {content.block1Paragraph1}
                </p>
                <p>
                  {content.block1Paragraph2}
                </p>
              </div>

              <div>
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic">{content.block2Heading}</h3>
                <p className="mb-4 font-semibold uppercase text-sm tracking-widest text-[#53a8c7]">{content.block2Intro}</p>
                <p className="mb-6">
                  {content.block2Paragraph}
                </p>

                <div className="space-y-6">
                  {content.block2Stations.map((station, idx) => (
                    <div key={idx}>
                      <h4 className="text-luxury-dark font-medium mb-2 flex items-center gap-2">
                        <span className="text-xl">{station.icon}</span> {station.heading}
                      </h4>
                      <p>{station.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic">{content.block3Heading}</h3>
                <p className="mb-4">
                  {content.block3Paragraph1}
                </p>
                <p>
                  {content.block3Paragraph2}
                </p>
              </div>

              <div>
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic">{content.block4Heading}</h3>
                <p className="mb-4">
                  {content.block4Paragraph1}
                </p>
                <p>
                  {content.block4Paragraph2}
                </p>
              </div>

            </div>

            {/* Leistungen inside Left Column (matches original design) */}
            <div className="mt-12 pt-12 border-t border-gray-100">
              <h3 className="font-luxury text-3xl text-luxury-dark mb-8 uppercase tracking-wider border-b border-gray-200 pb-4 text-[#53a8c7]">{content.leistungenHeading}</h3>
              <ul className="space-y-4">
                {content.leistungen.map((item, idx) => (
                  <li key={idx} className="flex gap-4 items-start text-gray-600 font-light text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#53a8c7] mt-2 shrink-0"></span>
                    <span className="leading-relaxed">{item}</span>
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
                  <p className="text-gray-600 font-light">{content.priceNote}</p>
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
            <div data-live-block="gallery" data-live-slug="kolumbien-tour" data-live-fallback={JSON.stringify(FALLBACK_GALLERY)}>
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
          <EventComments pageSlug="kolumbien-tour" />
        </div>
      </section>

    </div>
  );
};
