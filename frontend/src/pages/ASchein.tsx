import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banner } from '../components/common/Banner';
import { Check, Info, Search } from 'lucide-react';
import { useLightbox } from '../components/common/Lightbox';
import { GutscheinBox } from '../components/common/GutscheinBox';
import { usePageGallery } from '../hooks/usePageGallery';
import { SafeHtml } from '../components/common/SafeHtml';

// Old site's actual "Simple Image Gallery" filenames for this page
// (/images/bilder/1-a-schein/*.jpg), in their real order.
// Used only as a fallback now - see usePageGallery below - so the page keeps
// looking exactly like this until an admin configures a gallery for the
// "a-schein" slug in Admin > Seitenmedien.
const FALLBACK_GALLERY = [
  '1.Platzhalterbild', 'a_schein1', 'a_schein10', 'a_schein11', 'a_schein12',
  'a_schein13', 'a_schein14', 'a_schein15', 'a_schein16', 'a_schein17',
  'a_schein18', 'a_schein19', 'a_schein2', 'a_schein20', 'a_schein21',
  'a_schein22', 'a_schein23', 'a_schein24', 'a_schein25', 'a_schein26',
  'a_schein27', 'a_schein3', 'a_schein4', 'a_schein5', 'a_schein6',
  'a_schein7', 'a_schein8', 'a_schein9',
].map((f) => `/images/1-a-schein/${f}.jpg`);

interface PriceRow { title: string; description: string; price: string }
interface ExtraCostRow { label: string; price: string }

interface AScheinData {
  eyebrow: string;
  heading: string;
  heroImage: string;
  heroAlt: string;
  pilotHeading: string;
  pilotHtml: string;
  expectHeading: string;
  expectParagraph1Html: string;
  expectParagraph2: string;
  expectParagraph3: string;
  expectParagraph4: string;
  courseHeading: string;
  courseHtml: string;
  orgHeading: string;
  orgHtml: string;
  equipmentHeading: string;
  equipmentParagraph1: string;
  equipmentParagraph2: string;
  equipmentParagraph3: string;
  priceRows: PriceRow[];
  priceNote: string;
  extraCostRows: ExtraCostRow[];
  gutscheinHeading: string;
  gutscheinDescription: string;
  leistungen: string[];
  extraCostsHeading: string;
  ausruestungLabel: string;
  ausruestungSubItems: string[];
  extraCostsItemsHtml: string[];
  checklist: string[];
}

const DEFAULT_CONTENT: AScheinData = {
  eyebrow: 'AUSBILDUNG',
  heading: 'A-Schein',
  heroImage: '/images/1-a-schein/hero.jpg',
  heroAlt: 'A-Schein Höhenflugkurs',
  pilotHeading: 'Du wirst endlich lizenzierter Pilot',
  pilotHtml:
    'Auf den <a href="/ausbildung/l-schein" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Grundkurs</a> aufbauend, werden für den A-Schein die Kenntnisse vertieft. Kurvenflug, Schirmkontrolle und vielleicht schon das erste Rückwärtsaufziehen an dem Übungshang sind einige der Lerninhalte, die in diesem Kurs neben den Höhenflügen auf dem Lehrplan stehen. Mit der vorgeschriebenen Ausbildung in Theorie und Praxis machen wir aus dir einen sicheren und umsichtigen Piloten. Nach erfolgreich bestandener Theorieprüfung und Erreichen von mind. 40 Höhenflügen sowie 18.000 Höhenmetern kannst du dann auch die praktische Prüfung ablegen. Mit dem A-Schein in deinen Händen, warten die zugelassenen Gelände in ganz Deutschland und darüber hinaus von dir erflogen zu werden!',
  expectHeading: 'Was dich erwartet beim Höhenflugkurs (A-Schein)...',
  expectParagraph1Html:
    'Für den beschränkten Luftfahrerschein (A-Schein) benötigt man mind. 40 Flüge, in denen mind. 18.000 Höhenmeter erflogen werden. Die alpinen Höhenflüge finden im Rahmen unserer Höhenflugschulungen (i. d. R. in den Alpen) statt. Weitere Flüge können auch an der <a href="/ausbildung/windenschein" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Winde</a> absolviert werden (Achtung Winde: dies ist ein separater Kurs, der sich aber super mit der A-Scheinausbildung kombinieren lässt! Der <a href="/ausbildung/windenschein" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Windenkurs</a> spart unterm Strich Zeit und Geld!).',
  expectParagraph2:
    'Für die Höhenflugschulung fahren wir regelmäßig nach Bassano / Italien, sowie nach Frankreich und Österreich – weitere Fluggebiete nutzen wir nach Bedarf!',
  expectParagraph3:
    "Auf dieser 1-wöchigen Höhenflugschulung (Samstag bis Samstag → es werden nur 5 Tage Urlaub benötigt) werden die notwendigen Höhenflüge gesammelt und Flugmanöver trainiert und du wirst auf die praktische Prüfung vorbereitet. Diese findet auch vor Ort statt und wird von einem Prüfer des DHV (Deutscher Hängegleiter Verband) abgenommen.",
  expectParagraph4:
    'Der A-Schein berechtigt dich dann zum alleinigen Fliegen in zugelassenen Geländen in ganz Deutschland und darüber hinaus.',
  courseHeading: 'Der Kurs...',
  courseHtml:
    'Neue Lerninhalte wie Landeeinteilung, Vollkreis, Kurven mit unterschiedlicher Schräglage sowie Abstiegshilfen werden dem Flugschüler in diesem Ausbildungsabschnitt vermittelt. Auch die erste Thermikerfahrung sammelt ihr im Rahmen der Ausbildung zum A-Schein. Ständige Funkbegleitung versteht sich von selbst! Untermauert wird die Ausbildung mit insgesamt 20 Unterrichtsstunden Theorie (à 45 min.) in den Fächern: Meteorologie, Luftrecht, Gerätekunde, Flugtechnik und Verhalten in besonderen Fällen. Nach dem Kurs muss der Flugschüler eine offizielle Theorieprüfung in den vorher vermittelten Theoriefächern vor einem Prüfer des <a href="https://www.dhv.de/" target="_blank" rel="noopener noreferrer" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">DHV</a> abzulegen - dies kann jederzeit in der Flugschule bei Alex erfolgen.',
  orgHeading: 'Organisatorisches...',
  orgHtml:
    'Die Termine zur Höhenflugschulung findet ihr in unserem <a href="/buchungskalender" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Kalender</a>. Bitte meldet euch hierüber an. Ort und genaue Uhrzeit der Kurstermine erfahrt ihr dann wie gewohnt vorab per Schulungs-Newsletter. Die Ausbildung zum Höhenflugausweis erfolgt wie gewohnt für jeden Piloten zeitoffen.',
  equipmentHeading: 'Die erste eigene Ausrüstung',
  equipmentParagraph1:
    'Mit der Ausbildung zum selbständigen Piloten kommt auch eine eigene Ausrüstung ins Spiel. Wie bei vielen anderen Sportarten ist auch beim Gleitschirmfliegen die Ausrüstung entscheidend. Doch wer die Wahl hat, hat die Qual! Man muss sich in erster Linie damit auseinandersetzen, welche Ausrüstung für einen selbst geeignet ist. Wir von der Flugschule Hirondelle setzen genau an dieser Stelle an und beraten euch auf der Suche nach dem passenden Equipment. Die von uns getroffene Auswahl spiegelt einen Querschnitt des Marktes wieder und bedient nach unserer Erfahrung nahezu alle Ansprüche und Wünsche – die Produkte der beiden Phi, Niviuk, Independence und Advance bieten für alle Zielgruppen entsprechende Ausrüstungen. Mit unserer langjährigen Auseinandersetzung mit Flugeigenschaften, Sicherheit, Qualität, Service, Handling und technischem Fortschritt unterstützen wir euch so optimal bei der Entscheidung zu eurer Neuinvestition.',
  equipmentParagraph2:
    'Wollt/könnt ihr euch noch nicht gleich festlegen, besteht die Möglichkeit, die Ausbildung zum A-Schein mit einer Leihausrüstung der Flugschule zu absolvieren.',
  equipmentParagraph3:
    'Oder ihr bringt eine eigene (fremdgekaufte) Ausrüstung mit, hier greift ein Aufschlag auf den Kurspreis der Höhenflugschulung in Höhe von 350,00 € pro Kurs / Woche.',
  priceRows: [
    { title: 'A-Scheinkurs', description: 'Praxisausbildung im Rahmen der Schulungswoche Höhenflugschulung 1 (790,- €) sowie A-Schein-Theorie (200,- €)', price: '990,- €' },
    { title: 'Kombikurs:', description: 'Grundkurs & A-Scheinkurs Woche 1', price: '1.590,- €' },
    { title: '', description: 'Ratenzahlung Kombikurs [ 4 Raten à 430,- € ]', price: '1.720,- €' },
    { title: 'Kombikurs Kompakt:', description: 'Grundkurs & Winde & A-Scheinkurs Woche 1', price: '1.990,- €' },
    { title: '', description: 'Ratenzahlung Kombikurs Kompakt [ 4 Raten à 530,- € ]', price: '2.120,- €' },
  ],
  priceNote: 'alle Kursgebühren mit bei uns gekaufter Ausrüstung / Leihausrüstung siehe Zusatzkosten',
  extraCostRows: [
    { label: 'eigene Ausrüstung', price: 'Preise auf Anfrage' },
    { label: 'optional Leihausrüstung [pauschal pro Kurswoche]', price: '350,- €' },
    { label: 'Aufschlag bei fremdgekaufter Ausrüstung', price: '350,- €' },
    { label: 'zusätzliche Teilnahme an weiteren Höhenflugschulungswochen', price: '790,- €' },
    { label: 'ggf. Auffahrten zum Startplatz [ pro Fahrt ] Bus | Seilbahn (Kosten des Betreibers vor Ort)', price: '10,- € | - €' },
  ],
  gutscheinHeading: 'A-Schein Verschenken',
  gutscheinDescription: 'Der A-Schein ist auch als Geschenk-Gutschein möglich',
  leistungen: [
    'Theorie- und Praxisausbildung durch zertifizierte Fluglehrer',
    'Organisation der Reise für die Schulungswoche Höhenflugschulung',
    'Funkausrüstung und -betreuung',
    'Haftpflichtversicherung bei Leihausrüstung',
  ],
  extraCostsHeading: 'Zusatzkosten können entstehen für:',
  ausruestungLabel: 'Ausrüstung',
  ausruestungSubItems: [
    'neue / gebrauchte Ausrüstung, Preise auf Anfrage',
    'Leihausrüstung über die Flugschule (350,- € / Kurswoche)',
    'Aufschlag auf den Kurspreis bei fremdgekaufter Ausrüstung (350,- €)',
  ],
  extraCostsItemsHtml: [
    'Optional Windenkurs zur Vervollständigung der 40 benötigten Flüge',
    'Optional zusätzliche Teilnahme an weiteren Höhenflugschulungswochen (790,- € / Woche)',
    'E-Learning Prüffragen <a href="https://shop.dhv.de/collections/prufungsfragen" target="_blank" rel="noopener noreferrer" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Gleitschirm-A-Schein</a> vom DHV',
    '<a href="#" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Prüfungsgebühren ab 03.04.2023</a> DHV',
  ],
  checklist: [
    'Lust aufs Fliegen',
    'Mindestalter: 14 Jahre (mit Einverständniserklärung der Erziehungsberechtigten!)',
    'Überknöchelhohe Schuhe, wir empfehlen spezielle Flugschuhe oder zumindest Wanderschuhe',
    'Outdoor-Bekleidung, je nach Wetter Wechselkleidung',
    'Ausreichend Getränke und Verpflegung (Fliegen macht hungrig!!!)',
    'Sonnencreme',
    'Ausführliche Checkliste für die Höhenflugschulung erhaltet ihr je Reisetermin',
  ],
};

export const ASchein = ({ contentId }: { contentId?: string } = {}) => {
  const { openGallery } = useLightbox();
  // Admin-managed gallery (falls back to FALLBACK_GALLERY above) - see
  // frontend/src/hooks/usePageGallery.ts
  const galleryImages = usePageGallery('a-schein', FALLBACK_GALLERY);
  const [content, setContent] = useState<AScheinData>(DEFAULT_CONTENT);

  useEffect(() => {
    fetch(`/api/sitepagecontent/public/${contentId || 'a-schein'}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setContent(data); })
      .catch((err) => console.error('Error fetching A-Schein content:', err));
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
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic">{content.pilotHeading}</h3>
                <SafeHtml html={content.pilotHtml} className="[&_p]:mb-0" />
              </div>

              <div>
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic">{content.expectHeading}</h3>
                <div className="space-y-4">
                  <SafeHtml html={content.expectParagraph1Html} className="[&_p]:mb-0" />
                  <p>{content.expectParagraph2}</p>
                  <p>{content.expectParagraph3}</p>
                  <p>{content.expectParagraph4}</p>
                </div>
              </div>

              <div>
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic">{content.courseHeading}</h3>
                <SafeHtml html={content.courseHtml} className="[&_p]:mb-0" />
              </div>

              <div>
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic">{content.orgHeading}</h3>
                <SafeHtml html={content.orgHtml} className="[&_p]:mb-0" />
              </div>

              <div>
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic">{content.equipmentHeading}</h3>
                <div className="space-y-4">
                  <p>{content.equipmentParagraph1}</p>
                  <p>{content.equipmentParagraph2}</p>
                  <p>{content.equipmentParagraph3}</p>
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
                  to="/events?category=H%C3%B6henflugschulung%20(A-Schein)"
                  className="block w-full bg-[#53a8c7] hover:bg-[#4396b5] text-white text-center py-3 text-lg font-semibold transition-colors mb-10 shadow-md"
                >
                  Kurs buchen
                </Link>

                <div className="space-y-5 mb-8">
                  {content.priceRows.map((row, idx) => (
                    <div className="border-b border-gray-200 pb-4" key={idx}>
                      <div className="flex justify-between items-start gap-4">
                        <div className="text-gray-600 font-light text-[13px] leading-relaxed">
                          {row.title && <p className="font-bold text-luxury-dark mb-1 text-sm">{row.title}</p>}
                          <p className={row.title ? 'italic' : undefined}>{row.description}</p>
                        </div>
                        <p className="font-medium text-luxury-dark whitespace-nowrap mt-0.5">{row.price}</p>
                      </div>
                    </div>
                  ))}

                  <div className="border-b border-gray-200 pb-4">
                    <p className="text-gray-500 font-light text-xs italic leading-relaxed">
                      {content.priceNote}
                    </p>
                  </div>

                  {/* Zusatzkosten Table */}
                  <div id="zusatzkosten" className="pt-2 scroll-mt-[100px]">
                    <div className="flex items-center gap-2 mb-4">
                      <Info className="w-4 h-4 text-[#53a8c7]" />
                      <p className="font-bold text-luxury-dark text-sm uppercase">Zusatzkosten</p>
                    </div>

                    <div className="space-y-4">
                      {content.extraCostRows.map((row, idx) => (
                        <div className="flex justify-between items-start gap-4 border-b border-gray-100 pb-3" key={idx}>
                          <p className="text-gray-600 font-light text-[13px]">{row.label}</p>
                          <p className="font-medium text-luxury-dark whitespace-nowrap mt-0.5 text-right">{row.price}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <Link
                to="/events?category=H%C3%B6henflugschulung%20(A-Schein)"
                className="w-full block bg-[#526a75] hover:bg-luxury-gold text-white text-center py-4 text-sm font-semibold uppercase tracking-widest transition-colors"
              >
                Termine Höhenflugschulungen &gt; Siehe Liste
              </Link>
            </div>

            <GutscheinBox
              heading={content.gutscheinHeading}
              description={content.gutscheinDescription}
            />

            {/* Impressions Gallery */}
            {/* data-live-*: the Joomla-style page editor keeps this gallery live (utils/liveBlocks.tsx) */}
            <div data-live-block="gallery" data-live-slug="a-schein" data-live-fallback={JSON.stringify(FALLBACK_GALLERY)}>
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
              <h2 className="font-luxury text-3xl text-luxury-dark mb-8 uppercase">Unsere Leistungen</h2>
              <ul className="space-y-3 mb-6">
                {content.leistungen.map((item, idx) => (
                  <li key={idx} className="flex gap-3 text-gray-600 font-light">
                    <Check className="w-5 h-5 text-luxury-gold shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <h4 className="font-medium text-luxury-dark mb-4 text-sm">{content.extraCostsHeading}</h4>
              <ul className="space-y-3 mb-6">
                <li className="flex gap-3 text-gray-600 font-light">
                  <Check className="w-5 h-5 text-luxury-gold shrink-0 mt-0.5" />
                  <div className="w-full">
                    <span>{content.ausruestungLabel}</span>
                    <ul className="ml-6 mt-2 space-y-2 list-disc text-gray-500 text-sm">
                      {content.ausruestungSubItems.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </li>
                {content.extraCostsItemsHtml.map((item, idx) => (
                  <li key={idx} className="flex gap-3 text-gray-600 font-light">
                    <Check className="w-5 h-5 text-luxury-gold shrink-0 mt-0.5" />
                    <SafeHtml html={item} className="inline [&_p]:inline" />
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="font-luxury text-3xl text-luxury-dark mb-8 uppercase">Deine Checkliste</h2>
              <ul className="space-y-4">
                {content.checklist.map((item, idx) => (
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
