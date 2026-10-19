import { useEffect, useState } from 'react';
import { Banner } from '../components/common/Banner';
import { SafeHtml } from '../components/common/SafeHtml';
import { ChevronDown } from 'lucide-react';

interface FaqItem {
  question: string;
  answerHtml: string;
}

interface FaqData {
  heading: string;
  items: FaqItem[];
  contactHeading: string;
  contactImage: string;
  contactText: string;
  openingHoursLabel: string;
  openingHoursText: string;
  addressLines: string;
  contactEmail: string;
}

// Fallbacks match the page's current live copy exactly, so nothing changes
// visually until an admin edits something in Admin > Seiten > FAQ (see
// backend SitePageContent model / sitePageContent.routes.ts). The question/
// answer list is the one repeater field here (admin can add/remove items).
const DEFAULT_CONTENT: FaqData = {
  heading: 'Häufig gestellte Fragen',
  items: [
    {
      question: 'Wann bzw. wie fange ich Gleitschirmfliegen an?',
      answerHtml: 'Die Ausbildung beginnt mit dem <a href="/ausbildung/l-schein" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Grundkurs</a> oder optional davor mit einem <a href="/ausbildung/schnupperkurs" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Schnupperkurs</a>. Danach folgt die Höhenflugschulung mit abschließender Prüfung zum <a href="/ausbildung/a-schein" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">A-Schein</a>, mit dem du dann selbständig fliegen darfst. Gerne beraten wir dich zum Ausbildungsverlauf in unserer <a href="/infos#kontakt" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Flugschule</a> oder auch per Telefon, den Kurs buchen kannst du dann direkt online.',
    },
    {
      question: 'Wie alt muss man mindestens sein, um an einem Kurs teilnehmen zu können?',
      answerHtml: 'Das Mindestalter für die Teilnahme an Kursen liegt bei 14 Jahren, wobei bei Teilnahme Minderjähriger eine schriftliche Einverständniserklärung beider Erziehungsberechtigten erforderlich ist. Nach oben hin gibt es keine Altersgrenze! Noch unsicher? Unser <a href="/ausbildung/schnupperkurs" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Schnupperkurs</a> bietet dir die Möglichkeit, Gleitschirmfliegen unverbindlich zu testen.',
    },
    {
      question: 'Wo finden die Kurse statt?',
      answerHtml: 'Alle unsere Fluggelände findet ihr <a href="/infos/gelaende" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">hier</a>.',
    },
    {
      question: 'Wie lange dauert ein Schnupperkurs?',
      answerHtml: 'Der <a href="/ausbildung/schnupperkurs" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Schnupperkurs</a> findet in der Regel am Wochenende (Samstag & Sonntag) statt. Wir beginnen meist früh um 8.00 Uhr und schulen bis Nachmittags (15.00 bis 17.00 Uhr) – solange es das Wetter zulässt.',
    },
    {
      question: 'Was muss ich zum Schnupperkurs mitbringen?',
      answerHtml: 'Wichtigste Voraussetzung für den <a href="/ausbildung/schnupperkurs" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Schnupperkurs</a> sind <strong>feste, überknöchelhohe (Wander-)Schuhe</strong>, lange Hosen, Sonnencreme, Getränke/Verpflegung und jede Menge gute Laune.',
    },
    {
      question: 'Welche Ausrüstung benötige ich für die Kurse?',
      answerHtml: 'Zum Gleitschirmfliegen benötigst du zunächst nur feste, überknöchelhohe (Wander-)Schuhe sowie normale (Outdoor-)Kleidung. Alles weitere wie Gleitschirm, Gurtzeug etc. wird beim <a href="/ausbildung/schnupperkurs" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Schnupperkurs</a> und <a href="/ausbildung/l-schein" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Grundkurs</a> von uns gestellt. Danach fliegt ihr mit eigener Ausrüstung oder alternativ mit Leihausrüstung, hier beraten wir euch gerne bei uns in der <a href="/infos#kontakt" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Flugschule</a>.',
    },
    {
      question: 'Was kann ich nach Abschluss des Grundkurses im Gleitschirmfliegen?',
      answerHtml: 'Der <a href="/ausbildung/l-schein" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Grundkurs</a> bildet die Basis für die Teilnahme an der Höhenflugschulung (<a href="/ausbildung/a-schein" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">A-Schein</a>). Hauptlernziele sind Starten, Steuern, Landen.',
    },
    {
      question: 'Wie lange dauert der A-Schein (Höhenflugschulung)?',
      answerHtml: 'Da wir abhängig vom Wetter sind, kann man schwer sagen, wie lange es genau dauert. Geht man davon aus, jeden Tag passendes Wetter und Zeit zu haben, kann man für die <a href="/ausbildung/a-schein" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">A-Schein-Ausbildung</a> ca. 1 bis 3 Wochen einplanen. Kann aber auch länger dauern.',
    },
    {
      question: 'Ich bin Pilot/in, aber schon längere Zeit nicht mehr geflogen und möchte wieder anfangen.',
      answerHtml: 'Für alle, die längere Zeit nicht geflogen sind, bieten wir <a href="/performance/refresher" class="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">Refresher-Kurse</a> an. So gelingt ein sicherer und erfolgreicher Wiedereinstieg mit Fluglehrerbetreuung.',
    },
  ],
  contactHeading: 'Noch Fragen?!',
  contactImage: '/images/inhalte/fragen_4.jpg',
  contactText: 'Wir vom Team Hirondelle stehen euch für alle eure Anliegen gerne zur Verfügung! Sprecht uns an oder besucht uns in der Flugschule!',
  openingHoursLabel: 'Öffnungszeiten',
  openingHoursText: 'nach Vereinbarung\n(Wird per Newsletter bekannt gegeben)',
  addressLines: 'Flugschule Hirondelle\nUntergasse 27\n69469 Weinheim / Germany',
  contactEmail: 'info@fs-hirondelle.de',
};

// data-faq-*: lets the Joomla-style page editor turn each item into an
// editable <details> accordion (utils/liveBlocks.tsx).
const AccordionItem = ({ item, isOpen, onToggle }: { item: FaqItem; isOpen: boolean; onToggle: () => void }) => (
  <div className="border-b border-gray-200" data-faq-item>
    <button
      data-faq-question
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between gap-4 py-5 text-left"
    >
      <span className="font-luxury text-lg md:text-xl text-luxury-dark">{item.question}</span>
      <ChevronDown className={`w-5 h-5 text-luxury-gold shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
    </button>
    <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
      <div className="overflow-hidden">
        <div className="text-gray-600 font-light leading-relaxed pb-6 pr-8 [&_a]:font-medium" data-faq-answer>
          <SafeHtml html={item.answerHtml} />
        </div>
      </div>
    </div>
  </div>
);

export const FAQ = ({ contentId }: { contentId?: string } = {}) => {
  const [content, setContent] = useState<FaqData>(DEFAULT_CONTENT);
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  useEffect(() => {
    fetch(`/api/sitepagecontent/public/${contentId || 'faq'}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setContent(data); })
      .catch((err) => console.error('Error fetching FAQ content:', err));
  }, [contentId]);

  return (
    <div className="w-full bg-white font-luxurysans pb-20">
      <Banner />

      <section className="pt-16 md:pt-24 pb-12">
        <div className="container mx-auto px-4 lg:px-8 max-w-[1200px]">

          {/* Main Title */}
          <div className="mb-16">
            <h1 className="font-luxury text-3xl md:text-4xl lg:text-5xl text-luxury-dark uppercase mb-6 tracking-wide">
              {content.heading}
            </h1>
            <div className="w-24 h-px bg-luxury-gold opacity-50"></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">

            {/* Left Column - Accordion */}
            <div className="lg:col-span-7">
              {content.items.map((item, index) => (
                <AccordionItem
                  key={index}
                  item={item}
                  isOpen={openIndex === index}
                  onToggle={() => setOpenIndex(openIndex === index ? null : index)}
                />
              ))}
            </div>

            {/* Right Column - Contact */}
            <div className="lg:col-span-5">
              <div className="bg-[#FAF9F7] border border-gray-100">
                <div className="px-8 pt-8">
                  <h2 className="font-luxury text-2xl text-luxury-dark uppercase tracking-wide mb-6">{content.contactHeading}</h2>
                </div>
                <img src={content.contactImage} alt={content.contactHeading} className="w-full h-auto" />
                <div className="p-8 space-y-4 text-[15px] text-gray-600 font-light leading-relaxed">
                  <p>{content.contactText}</p>
                  <p>
                    <span className="font-semibold text-luxury-dark">{content.openingHoursLabel}</span><br />
                    {content.openingHoursText.split('\n').map((line, idx) => (
                      <span key={idx}>{line}<br /></span>
                    ))}
                  </p>
                  <div className="w-full h-px bg-gray-200"></div>
                  <p>
                    {content.addressLines.split('\n').map((line, idx) => (
                      <span key={idx}>{line}<br /></span>
                    ))}
                  </p>
                  <p>
                    <a href={`mailto:${content.contactEmail}`} className="text-[#428bca] hover:text-[#2a6496] hover:underline font-medium">{content.contactEmail}</a>
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>
    </div>
  );
};
