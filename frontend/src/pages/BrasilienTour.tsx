import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banner } from '../components/common/Banner';
import { Search } from 'lucide-react';
import { EventComments } from '../components/common/EventComments';
import { useLightbox } from '../components/common/Lightbox';
import { GutscheinBox } from '../components/common/GutscheinBox';
import { usePageGallery } from '../hooks/usePageGallery';

// Old site's actual "Simple Image Gallery" filenames for this page
// (/images/bilder/2-tour-brasilien/*), in their real order.
// Used only as a fallback now - see usePageGallery below - so the page keeps
// looking exactly like this until an admin configures a gallery for the
// "brasilien-tour" slug in Admin > Seitenmedien.
const FALLBACK_GALLERY = [
  '02.jpg', '119027365.jpg', '1805480917_19bfc27fff_b.jpg', '66c446_fec66a0550624432bd47a23ba920334a_mv2.jpg', 'DSCN5647.jpg',
  'Divulgao-Sol-Store.jpg', 'IMG_2593.jpg', 'IMG_2596.jpg', 'IMG_2599.jpg', 'IMG_2601.jpg',
  'IMG_2602.jpg', 'IMG_2606.jpg', 'IMG_2608.jpg', 'IMG_2676.jpg', 'IMG_2766.jpg',
  'MG_-_Pico_da_Ibituruna_-_Governador_Valadares.jpg', 'Parapente-bh-parapente-belohorizonte-escola-de-parapente-bh-116.jpg', 'Rampa_voo_livre__Cachoeira_Alta_Alfredo_Chaves_foto_Weverson_Roccio.jpg', 'castelo_2.jpg', 'cropped-monstrinho-1.jpg',
  'espao-bomvoo_sampaio-correa-saquarema_2.jpg', 'foto1.jpg', 'g_foto1_371.jpg', 'maxresdefault.jpg', 'maxresdefault_1.jpg',
  'p4-23.jpg', 'pancas.jpg', 'rampa_uba-3741934.jpg', 'sampaio.jpg', 'slide_principal.jpg',
].map((f) => `/images/tour-brasilien/${f}`);

interface Badge { label: string; color: string }

interface BrasilienTourData {
  eyebrow: string;
  title: string;
  heroImage: string;
  heroImageAlt: string;
  block1Heading: string;
  block1Paragraph1: string;
  block1Paragraph2: string;
  block2Heading: string;
  block2Paragraph: string;
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
  priceDescription: string;
  priceAmount: string;
  priceCurrency: string;
  voraussetzungText: string;
  scheduleButtonText: string;
  scheduleButtonLink: string;
  gutscheinHeading: string;
  gutscheinDescription: string;
}

const DEFAULT_CONTENT: BrasilienTourData = {
  eyebrow: 'REISEN',
  title: 'Brasilien-Tour',
  heroImage: '/images/reisen/brasilien.jpg',
  heroImageAlt: 'Brasilien-Tour',
  block1Heading: 'Thermik und Streckenfliegen in Brasilien',
  block1Paragraph1: 'Fliegen in Rio de Janeiro – Uma cidade maravilhosa (eine wunderbare Stadt). Aber nicht nur in und um Rio wird geflogen. Bei unserer Rundreise in Brasilien wollen wir neben den Startplätzen in und um Rio auch die Startplätze im Landesinneren kennen lernen. Die Landschaften sind atemberaubend. Die oft zu findenden rundgeschliffenen Felsformationen machen das Fliegen in Brasilien zu etwas ganz Besonderem. In der Thermik drehen wir oft mit den Urubus, den einheimischen Schwarz-Geiern. Diese treten meistens in kleinen bis großen Gruppen auf. Einfach herrlich.',
  block1Paragraph2: 'Auf unserer kleinen Rundreise durch die Fluggebiete machen wir auch an den bekannten PWC-Geländen Halt. Hier laden uns herrlich angelegte Startplätze zum Fliegen ein. Highlight der Tour wird mit Sicherheit auch das Fluggebiet in Rio mit dem Petra Bonita, dem schwarzen Fels direkt am Meer mit der Möglichkeit, bei etwas Glück und Können, an der Christus-Statue vorbei zu fliegen. Und natürlich gehört ein Abstecher auf den Zuckerhut und den weltbekannten Strand Copacabana mit zum Pflichtprogramm.',
  block2Heading: 'Fluggebiete',
  block2Paragraph: 'Wir sehen bei dieser Tour bis zu 10 verschiedene Fluggebiete. Einige sind mit Sternfahrten von unserer Unterkunft erreichbar, andere fahren wir direkt an. Unter anderem dabei das bekannte PWC-Gelände in Valadares und Baixo Guandu und Castelo. Wir sind gespannt, was ihr von den Fluggebieten haltet.',
  block3Heading: 'Für wen ist die Reise gedacht?',
  block3Paragraph1: 'Die Reise ist sowohl für engagierte Hobbypiloten wie auch für den versierten Flieger geeignet. Für alle, die fliegerisch dazulernen und neue Eindrücke gewinnen wollen, für diejenigen, die ihre ersten kleinen Streckenflüge machen möchten, Streckencracks, Genussflieger einfach alle :-)! Mindestvoraussetzung ist der A-Schein oder Sopi.',
  block3Paragraph2: 'Nicht fliegende Begleitpersonen sind ebenfalls herzlich willkommen und kommen bei dieser Reise auch auf ihre Kosten.',
  block4Heading: 'Anreise, Unterkunft und Verpflegung',
  block4Paragraph1: 'Die Anreise / Hin- und Rückflug erfolgt nach Rio de Janeiro. Idealerweise bucht ihr eure Flüge ab z.B. Frankfurt mit Lufthansa (Direktflug). Zwecks gemeinsamer Anreise in der gleichen Maschine geben wir euch gerne die Flugnummer. Hinflug Freitag, 31.1.2020 (abends um 22 Uhr über Nacht), Beginn der Reise am Samstag, 1.2.2020. Rückflug Samstag 15.2.2020 19:40 Uhr, Ankunft in Frankfurt Sonntag, 16.2.2020.',
  block4Paragraph2: 'Während unseres Aufenthalts sind wir in gemütlichen Gästehäusern (Pousadas) und Hotels untergebracht. Nach dem Fliegen lassen wir den Tag in geselliger Runde bei gemeinsamem Abendessen ausklingen und lassen uns von der brasilianischen Küche verwöhnen z. B. in einer der landestypischen Churrascarias (Fleischtempel ;-)) und genießen den ein oder anderen Caipi oder eine frische Kokosnuss am Strand.',
  leistungenHeading: 'Unsere Leistungen',
  leistungen: [
    'professionelle Betreuung durch unsere Fluglehrer und Betreuer sowie einheimische Guides',
    'Gelände- und spezielle Theorieeinweisung fürs Soaring, Thermikfliegen, Streckenfliegen',
    'Flugwetterbriefing',
    'Funkbetreuung',
    'Videoanalyse',
    'alle Transfers während der Reisedauer sowie Auffahrten zu Startplätzen',
    'Rückholen nach den Streckenflügen egal wo :-)!',
    'Übernachtungen in Gästehäusern, im Doppelzimmer inkl. Frühstück',
    'Organisation eines Alternativprogramms bei schlechtem Wetter',
    'exkl. Hin- und Rückflug nach Rio',
    'exkl. Eintrittspreise für das Alternativprogramm',
    'exkl. Geländegebühren vor Ort (die sind eher gering)',
    'exkl. Auslandskrankenversicherung inkl. Rücktransport (bitte unbedingt abschließen - gibt es für 13,90 € / Jahr beim ADAC)',
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
  priceDescription: 'Die Reisepreiskalkulation basiert auf dem Wechselkurs 1,- € / 4,20 Brasilianischer Real. Nachkalkulation bei Abweichungen vorbehalten.',
  priceAmount: '2.150,-',
  priceCurrency: '€',
  voraussetzungText: 'Voraussetzung: mindestens A-Schein / Sopi',
  scheduleButtonText: 'Termin: siehe Kalender',
  scheduleButtonLink: '/events?search=Brasilien',
  gutscheinHeading: 'Tour Verschenken',
  gutscheinDescription: 'Die Tour ist auch als Geschenk-Gutschein möglich',
};

export const BrasilienTour = ({ contentId }: { contentId?: string } = {}) => {
  const { openGallery } = useLightbox();
  // Admin-managed gallery (falls back to FALLBACK_GALLERY above) - see
  // frontend/src/hooks/usePageGallery.ts
  const galleryImages = usePageGallery('brasilien-tour', FALLBACK_GALLERY);
  const [content, setContent] = useState<BrasilienTourData>(DEFAULT_CONTENT);

  useEffect(() => {
    fetch(`/api/sitepagecontent/public/${contentId || 'brasilien-tour'}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setContent(data); })
      .catch((err) => console.error('Error fetching Brasilien-Tour content:', err));
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
                <p className="mb-4">{content.block1Paragraph1}</p>
                <p className="mb-4">{content.block1Paragraph2}</p>
              </div>

              <div>
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic">{content.block2Heading}</h3>
                <p>{content.block2Paragraph}</p>
              </div>

              <div>
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic">{content.block3Heading}</h3>
                <p className="mb-4">{content.block3Paragraph1}</p>
                <p>{content.block3Paragraph2}</p>
              </div>

              <div>
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic">{content.block4Heading}</h3>
                <p className="mb-4">{content.block4Paragraph1}</p>
                <p>{content.block4Paragraph2}</p>
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
                  <p className="text-luxury-dark font-medium mb-2">{content.priceLabel}</p>
                  <div className="flex justify-between items-start gap-4">
                    <p className="text-gray-600 font-light">{content.priceDescription}</p>
                    <div className="text-right">
                      <p className="font-medium text-luxury-dark whitespace-nowrap text-lg">{content.priceAmount}</p>
                      <p className="font-medium text-luxury-dark whitespace-nowrap text-lg">{content.priceCurrency}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <p className="text-gray-600 font-light">{content.voraussetzungText}</p>
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
            <div data-live-block="gallery" data-live-slug="brasilien-tour" data-live-fallback={JSON.stringify(FALLBACK_GALLERY)}>
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
          <EventComments pageSlug="brasilien-tour" />
        </div>
      </section>

    </div>
  );
};
