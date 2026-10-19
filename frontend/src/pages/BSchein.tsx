import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banner } from '../components/common/Banner';
import { Check, Info, Search } from 'lucide-react';
import { useLightbox } from '../components/common/Lightbox';
import { GutscheinBox } from '../components/common/GutscheinBox';
import { usePageGallery } from '../hooks/usePageGallery';
import { SafeHtml } from '../components/common/SafeHtml';

// Old site's actual "Simple Image Gallery" filenames for this page
// (/images/bilder/1-b-schein/*.jpg), in their real order.
// Used only as a fallback now - see usePageGallery below - so the page keeps
// looking exactly like this until an admin configures a gallery for the
// "b-schein" slug in Admin > Seitenmedien.
const FALLBACK_GALLERY = [
  '1Platzhalterbild', 'b_schein1', 'b_schein10', 'b_schein11', 'b_schein2',
  'b_schein3', 'b_schein4', 'b_schein5', 'b_schein6', 'b_schein7',
  'b_schein8', 'b_schein9',
].map((f) => `/images/b-schein/${f}.jpg`);

interface PriceRow { label: string; price: string }
interface ZusatzRow { title: string; note: string; sub: string; price: string }

interface BScheinData {
  title: string;
  heroImage: string;
  heroAlt: string;
  block1Heading: string;
  block1Paragraph1: string;
  block1Paragraph2Html: string;
  block2Heading: string;
  block2ParagraphHtml: string;
  block3Heading: string;
  block3Paragraph1: string;
  block3Paragraph2Html: string;
  bookingButtonText: string;
  bookingButtonLink: string;
  theoriePreis: PriceRow;
  praxisNote1: string;
  praxisNote2: string;
  praxisPreis: string;
  zusatzkostenHeading: string;
  zusatzkostenRows: ZusatzRow[];
  theorieTerminButtonText: string;
  theorieTerminButtonLink: string;
  gutscheinHeading: string;
  gutscheinDescription: string;
  leistungen: string[];
  zusatzkostenListHeading: string;
  zusatzkostenListItemsHtml: string[];
  checkliste: string[];
  bannerTextHtml: string;
  bannerLink: string;
}

const DEFAULT_CONTENT: BScheinData = {
  title: 'B-Schein',
  heroImage: '/images/b-schein/hero.jpg',
  heroAlt: 'B-Schein Streckenflug',
  block1Heading: 'Auf Strecke mit dem unbeschränkten Luftfahrerschein...',
  block1Paragraph1: 'Wer weiter fliegen will als vom Start- zum Landeplatz braucht den unbeschränkten Luftfahrerschein (B-Schein). Dieser ist auch Voraussetzung zum Befliegen einiger Fluggelände in unserer Region und weltweit.',
  block1Paragraph2Html: 'Im Rahmen der Praxisausbildung zum B-Schein sind vom Piloten (Voraussetzung: <a href="/ausbildung/a-schein" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">A-Schein</a>) 20 Flüge zu absolvieren. Davon müssen 10 Flüge eine Mindestdauer von über 30 Minuten vorweisen sowie ein Flug über eine Strecke von 15 km (inkl. 500 m Höhenzugewinn) geflogen werden. Die Praxisausbildung zum B-Schein findet im Rahmen unserer (einwöchigen) Reisen bzw. der Höhenflugschulungen im Rahmen der A-Scheinausbildung statt. Die Preise orientieren sich an den jeweiligen Touren.',
  block2Heading: 'Streckenplanung in der Theorie...',
  block2ParagraphHtml: 'In einer zweitägigen Theorieausbildung werden die für den B-Schein relevanten Inhalte und Kenntnisse vermittelt. In insgesamt 15 Unterrichtsstunden Theorie (à 45 Min.) werden die Inhalte aus der A-Scheinausbildung vertieft und erweitert. Maßgeblich bereiten euch die Themen Meteorologie und Navigation auf eure selbständigen Streckenflüge vor. Nach dem Kurs muss der Flugschüler eine offizielle Theorieprüfung in den vorher vermittelten Theoriefächern vor einem Prüfer des <a href="https://www.dhv.de/" target="_blank" rel="noopener noreferrer" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">DHV</a> abzulegen.',
  block3Heading: '... und Praxis',
  block3Paragraph1: 'Der vorgeschriebene 15-Kilometer-Streckenflug für den unbeschränkten Luftfahrerschein wird für das Fluggelände besprochen und soll bei passender Wetterlage vom zukünftigen B-Scheinpiloten abgeflogen werden. Die Streckendokumentation erfolgt mit einem GPS und kann am Laptop vor Ort ausgelesen werden.',
  block3Paragraph2Html: 'Bevor es schlussendlich auf Strecke geht, muss auch noch ein <a href="/performance/rettungsgeraetetraining" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Rettungsgerätetraining</a> absolviert werden. Diese Trainings bieten wir mehrmals im Jahr für euch an.',
  bookingButtonText: 'Kurs buchen',
  bookingButtonLink: '/events?category=Unbeschr.%20LF-Schein%20(B-Schein)',
  theoriePreis: { label: 'Kurspreis Theorie', price: '290,- €' },
  praxisNote1: 'entspricht Kurspreis des gebuchten Trainings',
  praxisNote2: '(im Rahmen der Höhenflugschulung, Sicherheitstraining, Thermik-Technik oder Streckenseminar)',
  praxisPreis: 'ab 790,- €',
  zusatzkostenHeading: 'Zusatzkosten',
  zusatzkostenRows: [
    { title: 'ggf. Auffahrten zum Startplatz', note: '[ pro Fahrt, geländeabhängig ]', sub: 'Bus | Seilbahn (Kosten des Betreibers vor Ort)', price: '10,- € | - €' },
  ],
  theorieTerminButtonText: 'Theorie-Termine > Siehe Liste',
  theorieTerminButtonLink: '/events?category=Unbeschr.%20LF-Schein%20(B-Schein)',
  gutscheinHeading: 'B-Schein Verschenken',
  gutscheinDescription: 'Der B-Schein ist auch als Geschenk-Gutschein möglich',
  leistungen: [
    'Theorie- und Praxisausbildung durch zertifizierte Fluglehrer',
    'Organisation der Reise für die Praxisausbildung',
    'Funkausrüstung und -betreuung',
    'Haftpflichtversicherung',
  ],
  zusatzkostenListHeading: 'Zusatzkosten können entstehen für:',
  zusatzkostenListItemsHtml: [
    '<a href="/performance/rettungsgeraetetraining" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Rettungsgerätetraining</a> (separat zu buchender Kurs)',
    'E-Learning Prüffragen <a href="https://shop.dhv.de/collections/prufungsfragen" target="_blank" rel="noopener noreferrer" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Gleitschirm-B-Schein</a> vom DHV',
    '<a href="#" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Prüfungsgebühren ab 03.04.2023</a> DHV',
  ],
  checkliste: [
    'Lust aufs Fliegen',
    'Überknöchelhohe Schuhe, wir empfehlen spezielle Flugschuhe oder zumindest Wanderschuhe',
    'Outdoor-Bekleidung, je nach Wetter Wechselkleidung',
    'Ausreichend Getränke und Verpflegung (Fliegen macht hungrig!!!)',
    'Sonnencreme',
    'Ausführliche Checkliste für die Praxisausbildung erhaltet ihr je Reisetermin',
  ],
  bannerTextHtml: 'Die Praxisausbildung zum B-Schein findet im Rahmen unserer Reisen bzw. Höhenflugschulungen statt. Der Kurspreis für die Praxis orientiert sich am gewählten Training bzw. der gewählten Reise.',
  bannerLink: '/reisen',
};

export const BSchein = ({ contentId }: { contentId?: string } = {}) => {
  const { openGallery } = useLightbox();
  const [content, setContent] = useState<BScheinData>(DEFAULT_CONTENT);
  // Admin-managed gallery (falls back to FALLBACK_GALLERY above) - see
  // frontend/src/hooks/usePageGallery.ts
  const galleryImages = usePageGallery('b-schein', FALLBACK_GALLERY);

  useEffect(() => {
    fetch(`/api/sitepagecontent/public/${contentId || 'b-schein'}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setContent(data); })
      .catch((err) => console.error('Error fetching B-Schein content:', err));
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
              AUSBILDUNG
            </p>
            <h1 className="font-luxury text-4xl md:text-5xl text-luxury-dark uppercase">
              {content.title}
            </h1>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

          {/* Left Column (Content) */}
          <div className="lg:col-span-7 space-y-12">

            {/* Featured Image */}
            <div className="w-full h-[400px] overflow-hidden rounded-sm shadow-sm group">
              <img
                src={content.heroImage}
                alt={content.heroAlt}
                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
              />
            </div>

            {/* Content Blocks */}
            <div className="space-y-10 text-gray-600 font-light leading-relaxed text-justify">
              <div>
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic">{content.block1Heading}</h3>
                <div className="space-y-4">
                  <p>{content.block1Paragraph1}</p>
                  <SafeHtml html={content.block1Paragraph2Html} />
                </div>
              </div>

              <div>
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic">{content.block2Heading}</h3>
                <SafeHtml html={content.block2ParagraphHtml} />
              </div>

              <div>
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic">{content.block3Heading}</h3>
                <div className="space-y-4">
                  <p>{content.block3Paragraph1}</p>
                  <SafeHtml html={content.block3Paragraph2Html} />
                </div>
              </div>
            </div>

          </div>

          {/* Right Column (Sidebar) */}
          <div className="lg:col-span-5 space-y-12">

            {/* Booking Card */}
            <div className="bg-[#FAF9F7] border border-gray-100 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-luxury-gold transform origin-left transition-transform duration-500 scale-x-0 group-hover:scale-x-100"></div>

              <div className="p-8">
                <Link
                  to={content.bookingButtonLink}
                  className="block w-full bg-[#53a8c7] hover:bg-[#4396b5] text-white text-center py-3 text-lg font-semibold transition-colors mb-10 shadow-md"
                >
                  {content.bookingButtonText}
                </Link>

                <div className="space-y-5 mb-8">
                  <div className="border-b border-gray-200 pb-4">
                    <div className="flex justify-between items-start gap-4">
                      <p className="font-bold text-luxury-dark text-sm">{content.theoriePreis.label}</p>
                      <p className="font-medium text-luxury-dark whitespace-nowrap mt-0.5">{content.theoriePreis.price}</p>
                    </div>
                  </div>

                  <div className="border-b border-gray-200 pb-4">
                    <div className="flex justify-between items-start gap-4 mb-2">
                      <p className="font-bold text-luxury-dark text-sm">Kurspreis Praxis</p>
                    </div>
                    <div className="flex justify-between items-start gap-4">
                      <div className="text-gray-600 font-light text-[13px] leading-relaxed">
                        <p>{content.praxisNote1}</p>
                        <p className="italic text-[11px] mt-1">{content.praxisNote2}</p>
                      </div>
                      <p className="font-medium text-luxury-dark whitespace-nowrap mt-0.5">{content.praxisPreis}</p>
                    </div>
                  </div>

                  {/* Zusatzkosten Table */}
                  <div className="pt-2">
                    <div className="flex items-center gap-2 mb-4">
                      <Info className="w-4 h-4 text-[#53a8c7]" />
                      <p className="font-bold text-luxury-dark text-sm uppercase">{content.zusatzkostenHeading}</p>
                    </div>

                    <div className="space-y-4">
                      {content.zusatzkostenRows.map((row, idx) => (
                        <div key={idx} className="flex justify-between items-start gap-4 pt-1">
                          <div className="text-gray-600 font-light text-[13px]">
                            <p>{row.title}</p>
                            <p className="italic text-[11px]">{row.note}</p>
                            <p className="text-[12px] mt-1">{row.sub}</p>
                          </div>
                          <p className="font-medium text-luxury-dark whitespace-nowrap mt-0.5 text-right">{row.price}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <Link
                to={content.theorieTerminButtonLink}
                className="w-full block bg-[#526a75] hover:bg-luxury-gold text-white text-center py-4 text-sm font-semibold uppercase tracking-widest transition-colors"
              >
                {content.theorieTerminButtonText}
              </Link>
            </div>

            <GutscheinBox
              heading={content.gutscheinHeading}
              description={content.gutscheinDescription}
            />

            {/* Impressions Gallery */}
            {/* data-live-*: the Joomla-style page editor keeps this gallery live (utils/liveBlocks.tsx) */}
            <div data-live-block="gallery" data-live-slug="b-schein" data-live-fallback={JSON.stringify(FALLBACK_GALLERY)}>
               <h3 className="font-luxury text-2xl text-luxury-dark mb-6 uppercase tracking-wider border-b border-gray-200 pb-4">
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

        {/* Leistungen & Checkliste Grid (Full Width) */}
        <div className="max-w-[1200px] mx-auto mt-8">
          <hr className="border-gray-100 mb-10" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 lg:gap-24 mb-16">
            <div>
              <h2 className="font-luxury text-3xl text-luxury-dark mb-8 uppercase">Unsere Leistungen</h2>
              <ul className="space-y-3 mb-6">
                {content.leistungen.map((item, idx) => (
                  <li key={idx} className="flex gap-3 text-gray-600 font-light">
                    <Check className="w-5 h-5 text-luxury-gold shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <h4 className="font-medium text-luxury-dark mb-4 text-sm">{content.zusatzkostenListHeading}</h4>
              <ul className="space-y-3 mb-6">
                {content.zusatzkostenListItemsHtml.map((item, idx) => (
                  <li key={idx} className="flex gap-3 text-gray-600 font-light">
                    <Check className="w-5 h-5 text-luxury-gold shrink-0 mt-0.5" />
                    <SafeHtml html={item} />
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="font-luxury text-3xl text-luxury-dark mb-8 uppercase">Deine Checkliste</h2>
              <ul className="space-y-4">
                {content.checkliste.map((item, idx) => (
                  <li key={idx} className="flex gap-3 text-gray-600 font-light">
                    <Check className="w-5 h-5 text-luxury-gold shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Large Blue Info Banner at bottom */}
          <Link to={content.bannerLink} className="block bg-[#53a8c7] hover:bg-[#4396b5] rounded-sm p-8 md:p-12 text-center shadow-md transition-colors">
             <SafeHtml
               html={content.bannerTextHtml}
               className="text-white text-lg md:text-xl font-medium leading-relaxed max-w-4xl mx-auto block"
             />
          </Link>
        </div>
      </section>

    </div>
  );
};
