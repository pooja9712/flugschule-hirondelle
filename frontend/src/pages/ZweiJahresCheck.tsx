import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Banner } from '../components/common/Banner';
import { useLightbox } from '../components/common/Lightbox';
import { usePageGallery } from '../hooks/usePageGallery';

// Old site's actual "Simple Image Gallery" filenames for this page
// (/images/bilder/3-zweijahres-check/*), in their real order.
// Used only as a fallback now - see usePageGallery below - so the page keeps
// looking exactly like this until an admin configures a gallery for the
// "2-jahres-check" slug in Admin > Galerie.
const FALLBACK_GALLERY = [
  'Lufttchtigkeit.jpg', 'Spanien_6555_2000.jpg', 'Spanien_6558_2000.jpg',
  'Spanien_6560_2000.jpg', '_wsb_258x193_Fasching09u.franzi096.jpg', '_wsb_301x226_Leinen.jpg',
].map((f) => `/images/service-check/${f}`);

interface AddressBlock { location: string; instructions: string }

interface ZweiJahresCheckData {
  eyebrow: string;
  heading: string;
  videoUrl: string;
  videoTitle: string;
  introHeading: string;
  introParagraph1: string;
  introParagraph2: string;
  introParagraph3: string;
  pruefschritteHeading: string;
  pruefschritte: string[];
  devise: string;
  formularButtonText: string;
  referenceText: string;
  priceButtonText: string;
  priceLabel: string;
  priceNote: string;
  price: string;
  surchargeLabel: string;
  surchargePrice: string;
  extraCostsNote: string;
  priceBottomButtonText: string;
  auftragHeading: string;
  auftragIntro: string;
  addresses: AddressBlock[];
}

const DEFAULT_CONTENT: ZweiJahresCheckData = {
  eyebrow: 'SERVICE',
  heading: '2-Jahres-Check',
  videoUrl: 'https://www.youtube-nocookie.com/embed/wZH9ouLjNG8?rel=0',
  videoTitle: 'Gleitschirm Check - So läuft ein Schirmcheck ab! | PART 1 - Flugschule Hirondelle',
  introHeading: 'Eure Sicherheit liegt uns am Herzen',
  introParagraph1: 'Wir führen die Wartungsarbeiten bzw. notwendige Reparatur-Arbeiten in unserer Service-Werkstätte mit größter Sorgfalt und modernster Technik durch – damit ihr schnell wieder sicher abheben könnt!',
  introParagraph2: 'Wir checken alle gängigen Modelle innerhalb von 10 bis 14 Tagen. Zu Saisonbeginn kann es schnell mal zu längeren Checkzeiten kommen, wir empfehlen daher den Check während der Wintermonate einzuplanen. Kleinere Reparaturen sind im Check ohne Aufpreis enthalten – größere Arbeiten werden vor der Durchführung mit euch individuell abgestimmt.',
  introParagraph3: 'Gemäß der Luftgeräteprüfverordnung (§ 14) dürfen nur Gleitschirme in die Luft, die einen gültigen Check (im durch den Hersteller vorgegebenen Intervall) besitzen. Hiervon ist auch euer Versicherungsschutz abhängig, daher ist es absolut wichtig, den Schirm ordnungsgemäß überprüfen zu lassen.',
  pruefschritteHeading: 'UNSERE PRÜFSCHRITTE',
  pruefschritte: [
    'Identifizierung des Gerätes',
    'Sichtkontrolle der Kappe',
    'Sichtkontrolle der Leinen',
    'Sichtkontrolle der Verbindungsteile',
    'Kontrolle der Leinenfestigkeit',
    'Kontrolle der Kappenfestigkeit',
    'Kontrolle der Luftdurchlässigkeit des Tuches',
    'Vermessung der Leinenlängen mit Laser-Technik',
    'Kontrolle, Berechnung und Korrektur von Trimmung sowie Einstellung falls nötig (ohne Aufpreis)',
    'Kleinere Reparaturen bei Bedarf',
    'Hin- und Rückversand deines Schirms zum Checkbetrieb (ab Flugschule)',
  ],
  devise: 'Unsere Devise: Wer für weniger Leistung mehr Geld ausgibt, ist selbst schuld!',
  formularButtonText: 'Um deinen Gleitschirm Check durchzuführen, benötigen wir das ausgefüllte Formular',
  referenceText: 'LuftGerPV § 14 Nachprüfungen (5) Die Lufttüchtigkeit des Luftfahrtgeräts nach § 10a ist nach den vom Hersteller vorgegebenen Anweisungen durch den Halter oder in dessen Auftrag nachzuprüfen oder nachprüfen zu lassen. Der Halter ist für die rechtzeitige und vollständige Durchführung der Prüfungen verantwortlich. Er hat Mängel an dem Luftfahrtgerät oder an den Prüfanweisungen unverzüglich dem Hersteller zu melden. §§ 15 und 18 bis 20 finden keine Anwendung.',
  priceButtonText: 'Bitte das Formular unten ausfüllen',
  priceLabel: 'Checkpreis*',
  priceNote: '[inkl. Versandkosten zum Checkbetrieb ab Flugschule ]',
  price: '195,- €',
  surchargeLabel: '*Aufpreis für Abgabe im Schnellpacksack',
  surchargePrice: '10,- €',
  extraCostsNote: 'Zusatzkosten für Reparaturen nach Aufwand und Absprache',
  priceBottomButtonText: 'Zum Check-Formular',
  auftragHeading: 'CHECK-AUFTRAG',
  auftragIntro: 'Du erhältst eine Kopie des Formulars per E-Mail, dieses bitte ausdrucken und zusammen mit dem Gleitschirm in unserer Flugschule oder alternativ in Landau vorbeibringen.',
  addresses: [
    { location: '69469 Weinheim, Untergasse 27:', instructions: 'bitte wegen Öffnungszeiten Newsletter beachten' },
    { location: '76829 Landau Am Birnbach 6:', instructions: 'Termin bitte telefonisch oder per E-Mail vereinbaren' },
  ],
};

export const ZweiJahresCheck = ({ contentId }: { contentId?: string } = {}) => {
  const { openGallery } = useLightbox();
  // Admin-managed gallery (falls back to FALLBACK_GALLERY above) - see
  // frontend/src/hooks/usePageGallery.ts
  const galleryImages = usePageGallery('2-jahres-check', FALLBACK_GALLERY);
  const [content, setContent] = useState<ZweiJahresCheckData>(DEFAULT_CONTENT);

  useEffect(() => {
    fetch(`/api/sitepagecontent/public/${contentId || '2-jahres-check'}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setContent(data); })
      .catch((err) => console.error('Error fetching 2-Jahres-Check content:', err));
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

            {/* Video - old site just embeds the iframe directly, no
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
            <div className="space-y-8 text-gray-600 font-light leading-relaxed text-justify">
              <div>
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic">{content.introHeading}</h3>
                <p className="mb-4">
                  {content.introParagraph1}
                </p>
                <p className="mb-4">
                  {content.introParagraph2}
                </p>
                <p>
                  {content.introParagraph3}
                </p>
              </div>
            </div>

            {/* Prüfschritte */}
            <div className="pt-8">
              <h3 className="font-luxury text-3xl text-[#53a8c7] mb-8 uppercase tracking-wider border-b border-gray-200 pb-4">
                {content.pruefschritteHeading}
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-gray-600 font-light mb-6">
                {content.pruefschritte.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
              <p className="font-semibold text-gray-700">
                {content.devise}
              </p>
            </div>

            {/* Formular Button */}
            <div className="pt-4">
              <button className="w-full bg-[#53a8c7] hover:bg-[#4396b5] text-white text-center py-4 text-lg font-semibold transition-colors shadow-md">
                {content.formularButtonText}
              </button>
            </div>

            {/* Reference Content */}
            <div className="pt-4">
              <p className="text-sm text-gray-500 text-justify leading-relaxed">
                {content.referenceText}
              </p>
            </div>

          </div>

          {/* Right Column (Sidebar) */}
          <div className="lg:col-span-5 space-y-12">

            {/* Pricing Card */}
            <div className="bg-[#FAF9F7] p-8 border border-gray-100 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-[#53a8c7] transform origin-left transition-transform duration-500 scale-x-0 group-hover:scale-x-100"></div>

              <button className="w-full bg-[#53a8c7] hover:bg-[#4396b5] text-white text-center py-3 text-lg font-semibold transition-colors mb-10 shadow-md">
                {content.priceButtonText}
              </button>

              <div className="space-y-6 mb-10 text-sm">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <p className="text-luxury-dark font-semibold">{content.priceLabel}</p>
                    <p className="text-xs text-gray-500 italic mt-1">{content.priceNote}</p>
                  </div>
                  <p className="font-bold text-luxury-dark whitespace-nowrap text-lg">{content.price}</p>
                </div>

                <div className="flex justify-between items-start gap-4 pt-4 border-t border-gray-200">
                  <p className="text-gray-600 italic">{content.surchargeLabel}</p>
                  <p className="font-bold text-luxury-dark whitespace-nowrap">{content.surchargePrice}</p>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <p className="text-gray-600 italic">{content.extraCostsNote}</p>
                </div>
              </div>

              <button className="w-full bg-[#4a5f68] hover:bg-[#394a51] text-white text-center py-3 font-semibold shadow-md rounded-sm transition-colors">
                {content.priceBottomButtonText}
              </button>
            </div>

            {/* Check-Auftrag Info */}
            <div>
               <h3 className="font-luxury text-2xl text-[#53a8c7] mb-4 uppercase tracking-wider border-b border-gray-200 pb-4">
                 {content.auftragHeading}
               </h3>
               <p className="text-gray-600 text-sm mb-6 leading-relaxed">
                 {content.auftragIntro}
               </p>
               <div className="text-gray-600 text-sm space-y-4">
                 {content.addresses.map((addr, idx) => (
                   <p key={idx} className="leading-relaxed">
                     <strong className="block text-gray-800 font-semibold mb-1">{addr.location}</strong>
                     {addr.instructions}
                   </p>
                 ))}
               </div>
            </div>

            {/* Impressions Gallery */}
            {/* data-live-*: the Joomla-style page editor keeps this gallery live (utils/liveBlocks.tsx) */}
            <div data-live-block="gallery" data-live-slug="2-jahres-check" data-live-fallback={JSON.stringify(FALLBACK_GALLERY)}>
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
