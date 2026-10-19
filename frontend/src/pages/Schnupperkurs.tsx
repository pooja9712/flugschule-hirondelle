import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banner } from '../components/common/Banner';
import { SafeHtml } from '../components/common/SafeHtml';
import { Check, Search } from 'lucide-react';
import { useLightbox } from '../components/common/Lightbox';
import { GutscheinBox } from '../components/common/GutscheinBox';
import { usePageGallery } from '../hooks/usePageGallery';

// Old site's actual "Simple Image Gallery" filenames for this page
// (/images/bilder/1-schnuppern/*.jpg), in their real order - not the 9
// generic placeholder photos this used to ship with.
// Used only as a fallback now - see usePageGallery below - so the page keeps
// looking exactly like this until an admin configures a gallery for the
// "schnupperkurs" slug in Admin > Seitenmedien.
const FALLBACK_GALLERY = [
  '2-Platzhalterbild', 'DSC00007', 'DSC00011', 'DSC00068', 'DSC00070',
  'DSC00076', 'DSC00081', 'DSC00082', 'DSC00098', 'DSC00106',
  'DSC00111', 'DSC00150', 'DSC00154', 'DSC00193', 'DSC00228',
  'itemimg-schnuppern',
].map((f) => `/images/schnupperkurs/${f}.jpg`);

interface PriceRow { label: string; price: string }
interface SchnupperkursData {
  eyebrow: string;
  title: string;
  heroImage: string;
  heroImageAlt: string;
  block1Heading: string;
  block1Text: string;
  block2Heading: string;
  block2Text: string;
  block3Heading: string;
  block3Html: string;
  block4Heading: string;
  block4Html: string;
  bookingButtonText: string;
  bookingButtonLink: string;
  priceHeading: string;
  priceRows: PriceRow[];
  scheduleButtonText: string;
  scheduleButtonLink: string;
  gutscheinHeading: string;
  gutscheinDescription: string;
  leistungenHeading: string;
  leistungen: string[];
  checklisteHeading: string;
  checkliste: string[];
}

// Fallbacks match the page's current live copy exactly, so nothing changes
// visually until an admin edits something in Admin > Seiten > Schnupperkurs
// (see backend SitePageContent model / sitePageContent.routes.ts).
const DEFAULT_CONTENT: SchnupperkursData = {
  eyebrow: 'AUSBILDUNG',
  title: 'Schnupper- / Einsteigerkurs',
  heroImage: '/images/schnupperkurs/hero.jpg',
  heroImageAlt: 'Schnupperkurs',
  block1Heading: 'Der Anfang einer neuen Leidenschaft...',
  block1Text: "Am Schnuppertag / Einsteigerkurs lernst du die Grundzüge des Gleitschirmfliegens kennen. Anfängliche Aufzieh- und Laufübungen bereiten dich auf deine ersten Flüge vor: Kappe auslegen, Leinen sortieren, Eintrittsöffnungen kontrollieren, damit der Gleitschirm anschließend richtig über euch steigt. Gurtzeug anlegen, Startcheck und los geht's zum ersten Versuch. Wenn alles klappt und der Wind passt, spürt ihr den Auftrieb, der euch immer leichter werden lässt.",
  block2Heading: 'Ab in die Luft...',
  block2Text: 'Die Grundlagen für die ersten kleinen Flüge sind geschafft. Der Wind passt, die Startvorbereitungen sind ausgeführt und der Fluglehrer gibt dir Kommandos über Funk. Der Schirm steigt über dich, und du beschleunigst. Schritt für Schritt wirst du schneller und schließlich hebst du ab. Ein Moment des Gleitens, der Boden kommt wieder näher, Landung. Dein erster Flug ist geschafft – was für ein Gefühl! Step by Step erklimmen wir den Übungshang und arbeiten uns immer weiter hinauf in die Luft! Ziel für den Schnupperkurs sind Flüge mit 40 bis 60 Metern Höhendifferenz. Zwischendurch erfahrt ihr Wissenswertes über Gerätekunde und Flugpraxis.',
  block3Heading: 'Organisatorisches...',
  block3Html: 'Ort und Uhrzeit des Schnupperkurses erfahrt ihr am Vortag bis ca. 15 Uhr per Newsletter. Der eintägige Schnuppertag findet regulär samstags statt, je nach Wetter kann der Termin allerdings auch auf den Sonntag verschoben werden. Je nach Windrichtung schulen wir an einem unserer Übungshänge im Odenwald, Kraichtal, Nahetal und der Pfalz. Die Wegbeschreibungen zu den jeweiligen <a href="/infos/gelaende" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Fluggeländen findet ihr hier</a>. Eine aktuelle und sichere Leihausrüstung sind im Preis inbegriffen. Wenn aufgrund der Wetterlage der Kurs ausfällt oder nicht vollständig absolviert werden kann, ist es möglich, diesen zu einem späteren Termin kostenlos nachzuholen, tragt euch dazu bitte an einem neuen Termin über unseren Buchungskalender ein.',
  block4Heading: 'Wie geht es weiter...',
  block4Html: "Weiter geht's mit dem <a href=\"/ausbildung/l-schein\" class=\"text-[#428bca] hover:text-[#2a6496] hover:underline font-medium\">Grundkurs</a>! Die absolvierten Tage im Schnupperkurs sowie der anteilige Kurspreis werden euch hierfür angerechnet und abgezogen (gültig innerhalb der gleichen Saison!).",
  bookingButtonText: 'Kurs buchen',
  bookingButtonLink: '/events?category=Schnupperkurs',
  priceHeading: 'Kurspreis',
  priceRows: [
    { label: 'Schnuppertag 1-tägig Samstag,\nwetterbedingt kann auf Sonntag verschoben werden', price: '149,- €' },
    { label: 'Einsteigerkurs 2-tägig Samstag & Sonntag', price: '250,- €' },
  ],
  scheduleButtonText: 'Termine > Siehe Liste',
  scheduleButtonLink: '/events?category=Schnupperkurs',
  gutscheinHeading: 'Schnupperkurs Verschenken',
  gutscheinDescription: 'Der Schnupperkurs ist auch als Geschenk-Gutschein möglich',
  leistungenHeading: 'Unsere Leistungen',
  leistungen: [
    'Theorie- und Praxisausbildung durch zertifizierte Fluglehrer',
    'Neue und sichere Leihausrüstung',
    'Funkausrüstung und -betreuung',
    'Haftpflichtversicherung',
  ],
  checklisteHeading: 'Deine Checkliste',
  checkliste: [
    'Lust aufs Fliegen',
    'Mindestalter: 14 Jahre (mit Einverständniserklärung der Erziehungsberechtigten!)',
    'Überknöchelhohe Schuhe, wir empfehlen spezielle Flugschuhe oder zumindest Wanderschuhe',
    'Outdoor-Bekleidung, je nach Wetter Wechselkleidung',
    'Ausreichend Getränke und Verpflegung (Fliegen macht hungrig!)',
    'Sonnencreme',
  ],
};

export const Schnupperkurs = ({ contentId }: { contentId?: string } = {}) => {
  const { openGallery } = useLightbox();
  const [content, setContent] = useState<SchnupperkursData>(DEFAULT_CONTENT);
  // Admin-managed gallery (falls back to FALLBACK_GALLERY above) - see
  // frontend/src/hooks/usePageGallery.ts
  const galleryImages = usePageGallery('schnupperkurs', FALLBACK_GALLERY);

  useEffect(() => {
    fetch(`/api/sitepagecontent/public/${contentId || 'schnupperkurs'}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setContent(data); })
      .catch((err) => console.error('Error fetching Schnupperkurs content:', err));
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

            {/* Featured Image */}
            <div className="w-full h-[400px] overflow-hidden rounded-sm shadow-sm group">
              <img
                src={content.heroImage}
                alt={content.heroImageAlt}
                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
              />
            </div>

            {/* Content Blocks */}
            <div className="space-y-10 text-gray-600 font-light leading-relaxed text-justify">
              <div>
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic">{content.block1Heading}</h3>
                <p>{content.block1Text}</p>
              </div>

              <div>
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic">{content.block2Heading}</h3>
                <p>{content.block2Text}</p>
              </div>

              <div>
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic">{content.block3Heading}</h3>
                <SafeHtml html={content.block3Html} className="[&_p]:m-0" />
              </div>

              <div>
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic">{content.block4Heading}</h3>
                <SafeHtml html={content.block4Html} className="[&_p]:m-0" />
              </div>
            </div>

          </div>

          {/* Right Column (Sidebar) */}
          <div className="lg:col-span-5 space-y-12">

            {/* Booking Card */}
            <div className="bg-[#FAF9F7] p-8 border border-gray-100 shadow-sm relative overflow-hidden group">
              {/* Subtle decorative accent */}
              <div className="absolute top-0 left-0 w-full h-1 bg-luxury-gold transform origin-left transition-transform duration-500 scale-x-0 group-hover:scale-x-100"></div>

              <Link
                to={content.bookingButtonLink}
                className="block w-full bg-[#53a8c7] hover:bg-[#4396b5] text-white text-center py-3 text-lg font-semibold transition-colors mb-8 shadow-md"
              >
                {content.bookingButtonText}
              </Link>

              <div className="space-y-6 mb-8">
                {content.priceRows.map((row, i) => (
                  <div key={i} className="border-b border-gray-200 pb-4">
                    {i === 0 && <p className="text-luxury-gold text-xs uppercase tracking-widest font-semibold mb-2">{content.priceHeading}</p>}
                    <div className="flex justify-between items-start gap-4">
                      <p className="text-gray-600 font-light text-sm leading-relaxed">
                        {row.label.split('\n').map((line, li) => (
                          <span key={li}>
                            {li > 0 && <br />}
                            {line}
                          </span>
                        ))}
                      </p>
                      <p className="font-medium text-luxury-dark whitespace-nowrap">{row.price}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Link
                to={content.scheduleButtonLink}
                className="w-full block bg-[#526a75] hover:bg-luxury-gold text-white text-center py-4 text-sm font-semibold uppercase tracking-widest transition-colors"
              >
                {content.scheduleButtonText}
              </Link>
            </div>

            <GutscheinBox
              heading={content.gutscheinHeading}
              description={content.gutscheinDescription}
            />

            {/* Impressions Gallery */}
            {/* data-live-*: the Joomla-style page editor keeps this gallery live (utils/liveBlocks.tsx) */}
            <div data-live-block="gallery" data-live-slug="schnupperkurs" data-live-fallback={JSON.stringify(FALLBACK_GALLERY)}>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 lg:gap-24">
            <div>
              <h2 className="font-luxury text-3xl text-luxury-dark mb-8 uppercase">{content.leistungenHeading}</h2>
              <ul className="space-y-4">
                {content.leistungen.map((item, idx) => (
                  <li key={idx} className="flex gap-3 text-gray-600 font-light">
                    <Check className="w-5 h-5 text-luxury-gold shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="font-luxury text-3xl text-luxury-dark mb-8 uppercase">{content.checklisteHeading}</h2>
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
      </section>

    </div>
  );
};
