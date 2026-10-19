import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banner } from '../components/common/Banner';
import { Check, Search } from 'lucide-react';
import { useLightbox } from '../components/common/Lightbox';
import { GutscheinBox } from '../components/common/GutscheinBox';
import { usePageGallery } from '../hooks/usePageGallery';
import { SafeHtml } from '../components/common/SafeHtml';

// Old site's actual "Simple Image Gallery" filenames for this page
// (/images/bilder/1-tandem/*.jpg|png), in their real order.
// Used only as a fallback now - see usePageGallery below - so the page keeps
// looking exactly like this until an admin configures a gallery for the
// "tandemschein" slug in Admin > Seitenmedien.
const FALLBACK_GALLERY = [
  '1PLatzhalterbildTandem.png', 'tandem1.jpg', 'tandem2.jpg', 'tandem3.jpg', 'tandem4.jpg',
].map((f) => `/images/tandemschein/${f}`);

interface TandemscheinData {
  heroImage: string;
  block1Heading: string;
  block1Paragraph: string;
  block2Heading: string;
  block2Paragraph: string;
  leistungen: string[];
  zusatzkostenAusruestungLabel: string;
  zusatzkostenAusruestungSubItems: string[];
  zusatzkostenLinksHtml: string[];
  checkliste: string[];
  priceMainLabel: string;
  priceMainPrice: string;
  priceMainNote: string;
  priceWindenschleppLabel: string;
  priceWindenschleppNote: string;
  priceWindenschleppPrice: string;
  priceVerleihText: string;
  gutscheinHeading: string;
  gutscheinDescription: string;
}

const DEFAULT_CONTENT: TandemscheinData = {
  heroImage: '/images/tandemschein/hero.jpg',
  block1Heading: 'Zusammen mit Freunden zum Fliegen gehen.',
  block1Paragraph: 'Zum Fliegen gehen und die Leidenschaft mit Freunden teilen? Mit dem Tandemschein kein Problem! Die Freiheit und die Eindrücke in der Luft mit jemanden teilen zu können ist ein fantastisches Erlebnis sowohl für den Piloten als auch für den Passagier. Kommt einfach zusammen auf das Fluggelände, hier erhält der Passagier sein Gurtzeug. Nach einem Probelauf und Erklärung der Kommandos macht man sich selbst und seinen Passagier startklar und los geht\'s!',
  block2Heading: 'Ausbildung Passagierflugberechtigung',
  block2Paragraph: 'Die Ausbildung ist auch hier geteilt in eine Theorie- und eine Praxisausbildung mit abschließender Prüfung vor einem DHV-Prüfer. Insgesamt müssen 40 Flüge mit einem Passagier absolviert werden. Davon mind. 1 Flug mit einem Fluglehrer, 25 Flüge mit Fluglehreraufsicht, 15 Flüge im Flugauftrag. Der Passagier im Rahmen der Ausbildung muss mind. im Besitz des A-Scheins sein.',
  leistungen: [
    'Theorie- und Praxisausbildung durch zertifizierte Fluglehrer',
    'Organisation der Praxis-/Theorieausbildung',
    'Funkausrüstung und -betreuung',
    'Haftpflichtversicherung',
    'Neue und sichere Leihausrüstung',
  ],
  zusatzkostenAusruestungLabel: 'Ausrüstung',
  zusatzkostenAusruestungSubItems: [
    'neue / gebrauchte Ausrüstung, Preise auf Anfrage',
    'Leihausrüstung über die Flugschule (25,- € / Flug)',
  ],
  zusatzkostenLinksHtml: [
    'Optional <a href="/ausbildung/windenschein" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Windenkurs</a> zur Vervollständigung der 40 benötigten Flüge',
    'E-Learning Prüffragen <a href="https://shop.dhv.de/collections/prufungsfragen" target="_blank" rel="noopener noreferrer" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Gleitschirm-Tandemschein</a> vom DHV',
    '<a href="#" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Prüfungsgebühren ab 03.04.2023</a> DHV',
  ],
  checkliste: [
    'Tandemeingangstest vor einem Prüfer des DHV',
    'Lust aufs Fliegen',
  ],
  priceMainLabel: 'Kurspreis',
  priceMainPrice: '690,- €',
  priceMainNote: '[Leihausrüstung 25,- € / Flug]',
  priceWindenschleppLabel: 'Einweisung Windenschlepp Passagierflug Tandem',
  priceWindenschleppNote: '[ Ergänzung zum Tandemschein, 10 Einweisungsflüge ]',
  priceWindenschleppPrice: '320,- €',
  priceVerleihText: 'Verleih Tandemausrüstung: Preis auf Anfrage',
  gutscheinHeading: 'Kurs Verschenken',
  gutscheinDescription: 'Der Tandemschein ist auch als Geschenk-Gutschein möglich',
};

export const Tandemschein = ({ contentId }: { contentId?: string } = {}) => {
  const { openGallery } = useLightbox();
  // Admin-managed gallery (falls back to FALLBACK_GALLERY above) - see
  // frontend/src/hooks/usePageGallery.ts
  const galleryImages = usePageGallery('tandemschein', FALLBACK_GALLERY);
  const [content, setContent] = useState<TandemscheinData>(DEFAULT_CONTENT);

  useEffect(() => {
    fetch(`/api/sitepagecontent/public/${contentId || 'tandemschein'}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setContent({ ...DEFAULT_CONTENT, ...data }); })
      .catch((err) => console.error('Error fetching Tandemschein content:', err));
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
              Tandemschein
            </h1>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

          {/* Left Column (Content) */}
          <div className="lg:col-span-7 space-y-12">

            {/* Featured Image */}
            <div className="w-full h-[400px] overflow-hidden rounded-sm shadow-sm group">
              <img
                src={content.heroImage}
                alt="Tandemschein"
                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
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
                <p>
                  {content.block2Paragraph}
                </p>
              </div>
            </div>

            <hr className="border-gray-100 my-12" />

            {/* Leistungen & Checkliste Grid (Inside Left Column for Tandemschein) */}
            <div className="grid grid-cols-1 gap-12">
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

                <h4 className="font-medium text-luxury-dark mb-4 text-sm">Zusatzkosten können entstehen für:</h4>
                <ul className="space-y-3 mb-6">
                  <li className="flex gap-3 text-gray-600 font-light">
                    <Check className="w-5 h-5 text-luxury-gold shrink-0 mt-0.5" />
                    <div className="w-full">
                      <span>{content.zusatzkostenAusruestungLabel}</span>
                      <ul className="ml-6 mt-2 space-y-2 list-disc text-gray-500 text-sm">
                        {content.zusatzkostenAusruestungSubItems.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </li>
                  {content.zusatzkostenLinksHtml.map((item, idx) => (
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

          </div>

          {/* Right Column (Sidebar) */}
          <div className="lg:col-span-5 space-y-12">

            {/* Booking Card */}
            <div className="bg-[#FAF9F7] border border-gray-100 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-luxury-gold transform origin-left transition-transform duration-500 scale-x-0 group-hover:scale-x-100"></div>

              <div className="p-8">
                <Link
                  to="/events?category=Sonstiges"
                  className="block w-full bg-[#53a8c7] hover:bg-[#4396b5] text-white text-center py-3 text-lg font-semibold transition-colors mb-10 shadow-md"
                >
                  Kurs buchen
                </Link>

                <div className="space-y-5 mb-8">
                  <div className="border-b border-gray-200 pb-4">
                    <div className="flex justify-between items-start gap-4 mb-2">
                      <p className="font-bold text-luxury-dark text-sm">{content.priceMainLabel}</p>
                      <p className="font-medium text-luxury-dark whitespace-nowrap mt-0.5">{content.priceMainPrice}</p>
                    </div>
                    <p className="text-gray-500 font-light text-[12px] italic leading-relaxed">
                      {content.priceMainNote}
                    </p>
                  </div>

                  <div className="border-b border-gray-200 pb-4">
                    <div className="flex justify-between items-start gap-4">
                      <div className="text-gray-600 font-light text-[13px] leading-relaxed">
                        <p className="font-bold text-luxury-dark mb-1">{content.priceWindenschleppLabel}</p>
                        <p className="italic text-[11px]">{content.priceWindenschleppNote}</p>
                      </div>
                      <p className="font-medium text-luxury-dark whitespace-nowrap mt-0.5">{content.priceWindenschleppPrice}</p>
                    </div>
                  </div>

                  <div className="pt-2">
                    <div className="flex justify-between items-start gap-4">
                      <div className="text-gray-600 font-light text-[13px] leading-relaxed">
                        <p>{content.priceVerleihText}</p>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              <Link
                to="/events?category=Sonstiges"
                className="w-full block bg-[#526a75] hover:bg-luxury-gold text-white text-center py-4 px-2 text-sm font-semibold uppercase tracking-widest transition-colors leading-relaxed"
              >
                Termine (im Rahmen der Höhenflugschulung):<br/>siehe Kalender
              </Link>
            </div>

            <GutscheinBox
              heading={content.gutscheinHeading}
              description={content.gutscheinDescription}
            />

            {/* Impressions Gallery (Right Column for this page) */}
            {/* data-live-*: the Joomla-style page editor keeps this gallery live (utils/liveBlocks.tsx) */}
            <div data-live-block="gallery" data-live-slug="tandemschein" data-live-fallback={JSON.stringify(FALLBACK_GALLERY)}>
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
      </section>

    </div>
  );
};
