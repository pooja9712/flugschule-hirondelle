import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banner } from '../components/common/Banner';
import { Check, Search } from 'lucide-react';
import { useLightbox } from '../components/common/Lightbox';
import { GutscheinBox } from '../components/common/GutscheinBox';
import { usePageGallery } from '../hooks/usePageGallery';
import { SafeHtml } from '../components/common/SafeHtml';

// Old site's actual "Simple Image Gallery" filenames for this page
// (/images/bilder/1-winde/*.jpg), in their real order.
// Used only as a fallback now - see usePageGallery below - so the page keeps
// looking exactly like this until an admin configures a gallery for the
// "windenschein" slug in Admin > Seitenmedien.
const FALLBACK_GALLERY = [
  '1PlatzhalterbildWinde', 'Sarah_Winde_', 'winde', 'winde1', 'winde10',
  'winde12', 'winde13', 'winde14', 'winde15', 'winde16',
  'winde17', 'winde18', 'winde2', 'winde20', 'winde4',
  'winde5', 'winde6.1', 'winde6', 'winde7', 'winde8',
].map((f) => `/images/1-winde/${f}.jpg`);

interface PriceRow { label: string; price: string }

interface WindenscheinData {
  eyebrow: string;
  heading: string;
  videoUrl: string;
  videoTitle: string;
  introHeading: string;
  introParagraph: string;
  ausbildungHeading: string;
  ausbildungPara1Html: string;
  ausbildungPara2: string;
  ausbildungPara3: string;
  ausbildungPara4: string;
  ausbildungPara5: string;
  fluggelaendeHeading: string;
  fluggelaendeIntro: string;
  fluggelaendePara1Html: string;
  fluggelaendePara2Html: string;
  bookingButtonLabel: string;
  bookingButtonLink: string;
  priceRows: PriceRow[];
  footerButtonLabel: string;
  footerButtonLink: string;
  gutscheinHeading: string;
  gutscheinDescription: string;
  leistungenItems: string[];
  zusatzkostenHeading: string;
  zusatzkostenItems: string[];
  checklisteItems: string[];
}

const DEFAULT_CONTENT: WindenscheinData = {
  eyebrow: 'AUSBILDUNG',
  heading: 'Windenschein',
  videoUrl: 'https://www.youtube-nocookie.com/embed/KSdpddm3Rnw?rel=0',
  videoTitle: 'A-Schein Windenstarts - Paragliding lernen | Flugschule Hirondelle',
  introHeading: 'Windenschlepp mit dem Gleitschirm...',
  introParagraph: 'Das Schleppen an der Winde ist eine ideale Möglichkeit, auch im Flachland mit dem Gleitschirm in die Luft zu kommen. Nicht selten können unsere Schüler an der Winde schon etwas Thermik schnuppern und bis zu 20 Minuten durch die Luft gleiten. Viele erfolgreiche Streckenflüge sind bereits aus der Winde heraus geflogen worden. Der Windenschein ist die ideale Ergänzung zum A-Scheinkurs da ihr hier schnell einen Großteil der nötigen Flüge für die A-Scheinprüfung sammeln könnt.',
  ausbildungHeading: 'Ausbildung',
  ausbildungPara1Html: '20 Flüge unter Fluglehreraufsicht benötigt ihr zur Erlangung der Windenschleppstartberechtigung. Nach erfolgreich abgelegter flugschulinterner Theorie- und Praxisprüfung für den Windenschlepp darfst du dann selbständig an der Winde fliegen (Voraussetzung <a href="/ausbildung/a-schein" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">A-Schein</a>!). Die Ausbildungsdauer beträgt je nach Wetterlage und persönlicher Kondition ca. 2 bis 3 Tage.',
  ausbildungPara2: 'Für den beschränkten Luftfahrerschein können anstelle einer Höhenflugschulung auch alle 40 Flüge an der Winde absolviert werden. Der Pilot erhält dann nach der Prüfung den beschränkten Luftfahrerschein mit der Startart Windenschlepp. Später kann er 15 Flüge in entsprechenden Höhenfluggeländen machen und die Startart Hang in seinen Luftfahrerschein eintragen lassen.',
  ausbildungPara3: 'Im Rahmen der Windenschleppausbildung findet eine Theorieschulung mit den Themengebieten Flugtechnik, Gefahreneinweisung und Luftrecht statt.',
  ausbildungPara4: 'Die Praxistermine werden flexibel je nach Wetterlage gewählt und finden i. d. R. unter der Woche statt. Die Pilotenanzahl begrenzen wir bei der Schulung auf 6 bis 10 Schüler, da bei zu großen Gruppengrößen zu lange Wartezeiten zwischen den einzelnen Schulungsflügen entstehen. Die Termine findet ihr in unserem Kalender.',
  ausbildungPara5: 'Bei unseren Windenschlepps setzen wir auf die modernen und sicheren Kunststoffseile. Diese sind nicht so starr wie die alten Stahlseile und daher für den Piloten beim Schlepp angenehmer und in der Windenausbildung einfacher im Handling. Seit 2022 schulen wir außerdem auf einer neuen Elektrowinde, diese erleichtert den Schulungsschlepp, da sie Unregelmäßigkeiten im Schleppvorgang, ausgelöst durch Thermik etc., selbst regelt und automatisch ausgleicht.',
  fluggelaendeHeading: 'Fluggelände',
  fluggelaendeIntro: 'Der Flugschule stehen mehrere Windenschleppgelände mit unterschiedlicher Wind-Ausrichtung zur Verfügung.',
  fluggelaendePara1Html: 'Mitten in der Rheinebene befindet sich der Flugplatz <a href="/infos/gelaende/herrenteich" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Herrenteich</a>, der gut und schnell erreichbar ist.',
  fluggelaendePara2Html: 'Bei Bad Kreuznach liegt das Schleppgelände <a href="/infos/gelaende/bad-kreuznach" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Auf dem unteren Mergesfeld</a> des Drachen- und Gleitsegelclub Nahetal e.V „DGCN“.',
  bookingButtonLabel: 'Kurs buchen',
  bookingButtonLink: '/events?category=Windenschulung',
  priceRows: [
    { label: 'Kurspreis', price: '450,- €' },
    { label: 'darin enthalten:\nflugschulinterne Theorie- und Praxisprüfung', price: '50,- €' },
    { label: '[eigene Ausrüstung erforderlich -\nLeihausrüstung auf Anfrage möglich]', price: '' },
    { label: 'Kombikurs Kompakt:\nGrundkurs & Winde & A-Scheinkurs Woche 1', price: '1.990,- €' },
    { label: 'Einweisung Windenschlepp Passagierflug Tandem\n[ Ergänzung zum Tandemschein, 10 Einweisungsflüge ]', price: '320,- €' },
    { label: 'Tagespauschale für Fluggelände\n[ pro Flugtag ]', price: '10,- €' },
    { label: 'Leihgebühr für Schleppklinke\n[ pro Flugtag ]', price: '10,- €' },
    { label: 'Weitere betreute Praxisflüge an der Winde [ pro Schlepp ]\nfür (mind.) A-Schein-Inhaber', price: '10,- €' },
    { label: 'im Rahmen der A-Schein-Ausbildung', price: '20,- €' },
  ],
  footerButtonLabel: 'Termine > Zum Kalender',
  footerButtonLink: '/events?category=Windenschulung',
  gutscheinHeading: 'Windenschein Verschenken',
  gutscheinDescription: 'Der Windenschein ist auch als Geschenk-Gutschein möglich',
  leistungenItems: [
    'Theorie- und Praxisausbildung durch zertifizierte Windenfachlehrer und Windenfahrer',
    'Funkausrüstung und -betreuung',
    'Theorieskript',
    'Haftpflichtversicherung',
  ],
  zusatzkostenHeading: 'Zusatzkosten können entstehen für:',
  zusatzkostenItems: [
    'Leihausrüstung über die Flugschule (350,- € / Kurs)',
    'E-Learning Prüffragen <a href="https://shop.dhv.de/collections/prufungsfragen" target="_blank" rel="noopener noreferrer" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Gleitschirm-Windenschein</a> vom DHV',
    '<a href="#" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Prüfungsgebühren ab 03.04.2023</a> DHV',
  ],
  checklisteItems: [
    'Lust aufs Fliegen',
    'Mindestalter: 14 Jahre (mit Einverständniserklärung der Erziehungsberechtigten!)',
    'Überknöchelhohe Schuhe, wir empfehlen spezielle Flugschuhe oder zumindest Wanderschuhe',
    'Outdoor-Bekleidung, je nach Wetter Wechselkleidung',
    'Ausreichend Getränke und Verpflegung (Fliegen macht hungrig!!!)',
    'Sonnencreme',
  ],
};

export const Windenschein = ({ contentId }: { contentId?: string } = {}) => {
  const { openGallery } = useLightbox();
  // Admin-managed gallery (falls back to FALLBACK_GALLERY above) - see
  // frontend/src/hooks/usePageGallery.ts
  const galleryImages = usePageGallery('windenschein', FALLBACK_GALLERY);
  const [content, setContent] = useState<WindenscheinData>(DEFAULT_CONTENT);

  useEffect(() => {
    fetch(`/api/sitepagecontent/public/${contentId || 'windenschein'}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setContent(data); })
      .catch((err) => console.error('Error fetching Windenschein content:', err));
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
              {content.heading}
            </h1>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

          {/* Left Column (Content) */}
          <div className="lg:col-span-7 space-y-12">

            {/* Featured Video - old site just embeds the iframe directly, no
                click-to-play preview thumbnail, so this doesn't either. */}
            <div className="w-full h-[400px] overflow-hidden rounded-sm shadow-sm">
              <iframe
                className="w-full h-full"
                src={content.videoUrl}
                title={content.videoTitle}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>

            {/* Content Blocks */}
            <div className="space-y-10 text-gray-600 font-light leading-relaxed text-justify">
              <div>
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic">{content.introHeading}</h3>
                <p>
                  {content.introParagraph}
                </p>
              </div>

              <div>
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic">{content.ausbildungHeading}</h3>
                <div className="space-y-4">
                  <SafeHtml html={content.ausbildungPara1Html} />
                  <p>{content.ausbildungPara2}</p>
                  <p>{content.ausbildungPara3}</p>
                  <p>{content.ausbildungPara4}</p>
                  <p>{content.ausbildungPara5}</p>
                </div>
              </div>

              <div>
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic">{content.fluggelaendeHeading}</h3>
                <div className="space-y-4">
                  <p>{content.fluggelaendeIntro}</p>
                  <SafeHtml html={content.fluggelaendePara1Html} />
                  <SafeHtml html={content.fluggelaendePara2Html} />
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
                  {content.bookingButtonLabel}
                </Link>

                <div className="space-y-5 mb-8">
                  {content.priceRows.map((row, idx) => (
                    <div key={idx} className="border-b border-gray-200 pb-4">
                      <div className="flex justify-between items-start gap-4">
                        <div className="text-gray-600 font-light text-[13px] leading-relaxed">
                          {row.label.split('\n').map((line, i) => (
                            <p key={i} className={i === 0 ? 'font-bold text-luxury-dark mb-1' : ''}>{line}</p>
                          ))}
                        </div>
                        {row.price && <p className="font-medium text-luxury-dark whitespace-nowrap mt-0.5">{row.price}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Link
                to={content.footerButtonLink}
                className="w-full block bg-[#526a75] hover:bg-luxury-gold text-white text-center py-4 text-sm font-semibold uppercase tracking-widest transition-colors"
              >
                {content.footerButtonLabel}
              </Link>
            </div>

            <GutscheinBox
              heading={content.gutscheinHeading}
              description={content.gutscheinDescription}
            />

            {/* Impressions Gallery */}
            {/* data-live-*: the Joomla-style page editor keeps this gallery live (utils/liveBlocks.tsx) */}
            <div data-live-block="gallery" data-live-slug="windenschein" data-live-fallback={JSON.stringify(FALLBACK_GALLERY)}>
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
                {content.leistungenItems.map((item, idx) => (
                  <li key={idx} className="flex gap-3 text-gray-600 font-light">
                    <Check className="w-5 h-5 text-luxury-gold shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <h4 className="font-medium text-luxury-dark mb-4 text-sm">{content.zusatzkostenHeading}</h4>
              <ul className="space-y-3 mb-6">
                {content.zusatzkostenItems.map((item, idx) => (
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
                {content.checklisteItems.map((item, idx) => (
                  <li key={idx} className="flex gap-3 text-gray-600 font-light">
                    <Check className="w-5 h-5 text-luxury-gold shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};
