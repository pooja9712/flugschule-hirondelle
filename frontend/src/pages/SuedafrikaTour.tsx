import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Banner } from '../components/common/Banner';
import { Search } from 'lucide-react';
import { EventComments } from '../components/common/EventComments';
import { useLightbox } from '../components/common/Lightbox';
import { GutscheinBox } from '../components/common/GutscheinBox';
import { usePageGallery } from '../hooks/usePageGallery';
import { SafeHtml } from '../components/common/SafeHtml';

// Old site's actual "Simple Image Gallery" filenames for this page
// (/images/bilder/2-tour-suedafrika/*), in their real order.
// Used only as a fallback now - see usePageGallery below - so the page keeps
// looking exactly like this until an admin configures a gallery for the
// "suedafrika-tour" slug in Admin > Seitenmedien.
const FALLBACK_GALLERY = [
  'DSC00914.jpg', 'DSC00996.jpg', 'DSC01151.jpg', 'DSC01189.jpg', 'DSC01234.jpg',
  'DSC01389.jpg', 'DSC01644.jpg', 'DSC01730.jpg', 'DSC01757.jpg', 'DSC02025.jpg',
  'DSC02462.jpg', 'DSC02498.jpg', 'DSC02682.jpg', 'DSC02721.jpg', 'DSC02836.jpg',
  'IMG_0075.jpg', 'IMG_0193.jpg', 'IMG_0206.jpg', 'IMG_0977_1024.jpg', 'IMG_1123_1024.jpg',
  'IMG_1124_1024.jpg', 'IMG_5396.jpg', 'IMG_6154.jpg', 'IMG_6175.jpg', 'IMG_6280.jpg',
  'IMG_6281.jpg', 'IMG_6319.jpg', 'IMG_6402.jpg', 'IMG_6516.jpg', 'Suedafrika_2023_6048.jpg',
  'Suedafrika_2023_6246.jpg', 'Suedafrika_2023_6349.jpg', 'Suedafrika_2023_6368.jpg', 'Suedafrika_2023_6389.jpg', 'Suedafrika_2023_6695.jpg',
  'Suedafrika_2023_6816.jpg', 'Suedafrika_2023_6849.jpg', 'Suedafrika_2023_6857.jpg', 'Suedafrika_2023_6979.jpg', '_1230321.jpg',
  '_1230416.jpg', 'itemimg-afrika.jpg',
].map((f) => `/images/tour-suedafrika/${f}`);

interface Badge { label: string; color: string }

interface SuedafrikaTourData {
  eyebrow: string;
  title: string;
  heroImage: string;
  heroImageAlt: string;
  block1Heading: string;
  block1Paragraph: string;
  block2Heading: string;
  block2Paragraph1Html: string;
  block2Paragraph2Html: string;
  block2Paragraph3Html: string;
  block2Paragraph4: string;
  block3Heading: string;
  block3Paragraph1: string;
  block3Paragraph2: string;
  block4Heading: string;
  block4Paragraph1: string;
  block4Paragraph2: string;
  leistungenHeading: string;
  leistungen: string[];
  flyerImage: string;
  badges: Badge[];
  bookingButtonText: string;
  bookingButtonLink: string;
  tourpreisLabel: string;
  tourpreisAmount: string;
  voraussetzungText: string;
  additionalNoteText: string;
  scheduleButtonText: string;
  scheduleButtonLink: string;
  gutscheinHeading: string;
  gutscheinDescription: string;
}

const DEFAULT_CONTENT: SuedafrikaTourData = {
  eyebrow: 'REISEN',
  title: 'Südafrika-Tour',
  heroImage: '/images/reisen/suedafrika.jpg',
  heroImageAlt: 'Südafrika-Tour',
  block1Heading: 'Gleitschirm-Safari-Rundreise',
  block1Paragraph: 'Südafrika ist ein Land der Vielfalt und der Gegensätze und hat in jeder Hinsicht viel zu bieten. Auf der Südhalbkugel, im Land der unerschöpflichen fliegerischen Möglichkeiten, können wir beste thermische Flugbedingungen unbegrenzt gemeinsam genießen und uns zudem an hochsommerlichen Temperaturen erfreuen. Einerseits erwarten uns phantastische Flüge in den attraktivsten Soaring-, Thermik- und Streckenfluggebieten in Wilderness, Hermanus, Porterville und Kapstadt. Andererseits bieten sich zahllose Möglichkeiten für kulturelle und kulinarische Ausflüge an.',
  block2Heading: 'Fluggebiete',
  block2Paragraph1Html: 'Die schönsten Küsten-Fluggebiete Südafrikas stehen uns in <strong>Wilderness</strong> zur Verfügung. Wir geniessen die „Seabreeze" mit Soaring entlang der weltbekannten „Paradise-Ridge" und der „Map of Africa". Wilderness bedeutet noch viel mehr: Fliegen direkt aus dem Hotelzimmer, welches in unmittelbarer Nähe vom Startplatz liegt, kilometerweites Fliegen entlang der Küste, Groundhandling am Strand und, und, und…',
  block2Paragraph2Html: '<strong>Porterville</strong>, das Paragleiter-Mekka von Südafrika schlechthin, das Äquivalent zu Owen’s Valley in den USA, oder den Dolomiten in den Alpen. Erlebt, was man in Afrika unter Thermik und Cross Country versteht! Wir nutzen die erstklassige Thermik im weltbekannten Streckenflug-Eldorado und fliegen entlang der 150 km langen exotischen Bergkette im Worldcup-Fluggebiet Porterville. Mit dem Takeoff am Dasklip-Pass genießen wir Streckenflüge über faszinierende, unberührte Landschaften.',
  block2Paragraph3Html: 'Das Küstenstädtchen <strong>Hermanus</strong> liegt vor einer langgestreckten Bergkette, die herrliche Flüge im laminaren Küstenwind zulässt. 180m oberhalb des Ortes verläuft die fast 10 km lange Hangkante. Sie lädt sowohl zum Soaren als auch zu kleinen Streckenflügen ein.',
  block2Paragraph4: 'Die letzte Station unserer Reise führt uns die Gardenroute entlang nach Mossel Bay, über den Sir Lowrys Pass nach Kapstadt in unser Quartier. Hier genießen wir das außergewöhnliche Flair einer der schönsten Städte der Welt, mit seinen exklusiven Vororten und der weltbekannten Waterfront. In Kapstadt lassen wir unsere Reise mit Flügen am Lions Head, Signal Hill oder in Franschhoek genussvoll ausklingen. Kapstadt aus der Vogelperspektive, einfach bezaubernd.',
  block3Heading: 'Für wen ist die Reise gedacht?',
  block3Paragraph1: 'Die Reise ist sowohl für engagierte Hobbypiloten wie auch für Gelegenheitsflieger geeignet. Für alle, die fliegerisch dazulernen und für diejenigen, die ihre ersten kleinen Streckenflüge machen möchten – aber auch Streckencracks kommen voll auf ihre Kosten!',
  block3Paragraph2: 'Nicht fliegende Begleitpersonen sind ebenfalls herzlich willkommen.',
  block4Heading: 'Anreise, Unterkunft und Verpflegung',
  block4Paragraph1: 'Die Anreise / Hin- und Rückflug erfolgt nach Kapstadt. Idealerweise bucht ihr eure Flüge ab Frankfurt über Condor bzw. Lufthansa zwecks gemeinsamer Anreise im gleichen Zeitfenster. Hinflug Samstag, 20.2.27 (über Nacht), Beginn der Reise am Sonntag, 21.02.27. Rückflug Sonntag, 7.3.27 (über Nacht), Ankunft in Frankfurt Montag, 8.3.27.',
  block4Paragraph2: 'Während unseres Aufenthalts sind wir in komfortablen Gästehäusern in unmittelbarer Nähe der Startplätze und dem Strand untergebracht. Nach dem Fliegen lassen wir den Tag in geselliger Runde bei gemeinsamem Abendessen ausklingen und lassen uns von der afrikanischen Küche verwöhnen.',
  leistungenHeading: 'Unsere Leistungen',
  leistungen: [
    'professionelle Betreuung durch unsere Fluglehrer',
    'Gelände- und spezielle Theorieeinweisung fürs Soaring, Thermikfliegen, Streckenfliegen',
    'Flugwetterbriefing',
    'Funkbetreuung',
    'Videoanalyse',
    'alle Transfers während der Reisedauer in Mietfahrzeugen sowie Auffahrten zu Startplätzen',
    'Übernachtungen in komfortablen Gästehäusern, im Doppelzimmer inkl. Frühstück',
    'Organisation eines Alternativprogramms bei schlechtem Wetter',
    'exkl. Hin- und Rückflug nach Kapstadt',
    'exkl. Geländegebühren vor Ort',
    'exkl. Eintrittspreise für das Alternativprogramm',
  ],
  flyerImage: '/images/flyers/suedafrika.png',
  badges: [
    { label: 'Streckenflugtraining', color: '#E58E26' },
    { label: 'Thermik- und Flugtechniktraining', color: '#34963B' },
    { label: 'Soaringtraining', color: '#80C533' },
    { label: 'Groundhandlingtraining', color: '#3274B7' },
  ],
  bookingButtonText: 'Reise buchen',
  bookingButtonLink: '/events?category=Reisen',
  tourpreisLabel: 'Tourpreis',
  tourpreisAmount: '3.350,- €',
  voraussetzungText: 'Voraussetzung: mindestens A-Schein / Sopi',
  additionalNoteText: 'Die Tour findet ab 8 Teilnehmern statt, bitte vor verbindlicher Flugbuchung nachfragen, dass die Reise auch durchgeführt wird.',
  scheduleButtonText: 'Termin: siehe Kalender',
  scheduleButtonLink: '/events?search=Südafrika',
  gutscheinHeading: 'Tour Verschenken',
  gutscheinDescription: 'Die Tour ist auch als Geschenk-Gutschein möglich',
};

export const SuedafrikaTour = ({ contentId }: { contentId?: string } = {}) => {
  const { openGallery } = useLightbox();
  // Admin-managed gallery (falls back to FALLBACK_GALLERY above) - see
  // frontend/src/hooks/usePageGallery.ts
  const galleryImages = usePageGallery('suedafrika-tour', FALLBACK_GALLERY);
  const [content, setContent] = useState<SuedafrikaTourData>(DEFAULT_CONTENT);

  useEffect(() => {
    fetch(`/api/sitepagecontent/public/${contentId || 'suedafrika-tour'}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setContent(data); })
      .catch((err) => console.error('Error fetching Südafrika-Tour content:', err));
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
                alt={content.heroImageAlt}
                className="w-full h-full object-cover transition-transform duration-1000 hover:scale-105"
              />
            </div>

            {/* Content Blocks */}
            <div className="space-y-10 text-gray-600 font-light leading-relaxed text-justify">

              <div>
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic">{content.block1Heading}</h3>
                <p>
                  {content.block1Paragraph}
                </p>
              </div>

              <div>
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic">{content.block2Heading}</h3>
                <SafeHtml className="mb-4" html={content.block2Paragraph1Html} />
                <SafeHtml className="mb-4" html={content.block2Paragraph2Html} />
                <SafeHtml className="mb-4" html={content.block2Paragraph3Html} />
                <p>
                  {content.block2Paragraph4}
                </p>
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
              <div className="w-full max-w-md mx-auto">
                <img src={content.flyerImage} alt="Flugschule Hirondelle Flyer" className="w-full h-auto rounded-md shadow-2xl rotate-[-2deg] hover:rotate-0 transition-transform duration-500" />
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
                    <p className="text-luxury-dark font-medium">{content.tourpreisLabel}</p>
                    <div className="text-right">
                      <p className="font-medium text-luxury-dark whitespace-nowrap text-lg">{content.tourpreisAmount}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <p className="text-gray-600 font-light mb-4">{content.voraussetzungText}</p>
                  <p className="text-gray-500 text-xs leading-relaxed">
                    {content.additionalNoteText}
                  </p>
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
            <div data-live-block="gallery" data-live-slug="suedafrika-tour" data-live-fallback={JSON.stringify(FALLBACK_GALLERY)}>
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
          <EventComments pageSlug="suedafrika-tour" />
        </div>
      </section>

    </div>
  );
};
