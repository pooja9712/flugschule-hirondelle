import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Banner } from '../components/common/Banner';
import { useLightbox } from '../components/common/Lightbox';
import { SafeHtml } from '../components/common/SafeHtml';

// Fallbacks match the page's current live copy exactly, so nothing changes
// visually until an admin edits something in Admin > Seiten > Ausbildung
// (see backend SitePageContent model / sitePageContent.routes.ts). Text,
// images, and the "WEITERLESEN" links are all admin-editable; only the
// layout/CSS stays fixed. The price table's rows are the one repeater field
// here (admin can add/remove rows). Each row's own `bgColor` field is used
// when set (admin-editable, like Ausbildungskonzept's table); this array is
// only the fallback cycle for a row that doesn't have one yet (e.g. a
// freshly-added row), so any number of rows still matches the page's
// existing design, and the bottom border always lands on whichever row is
// actually last.
const PRICE_ROW_COLORS = ['#80c533', '#34963b', '#fff600', '#ffd700', '#e58e26', '#c4c5ca'];

const DEFAULT_CONTENT = {
  heroQuote: 'Die Flugschule Hirondelle bietet euch eine qualifizierte, sichere und vielseitige Ausbildung.',
  introQuote: 'Wir begleiten euch von den ersten Hüpfern bis zu euren ersten Strecken- und Thermikflügen hier im Odenwald, in der Pfalz, im Kraichtal, im Nahetal und überall sonst auf der Welt.',
  introHtml: 'Im Nachfolgenden sind die Ausbildungswege in der Flugschule Hirondelle vom <a href="/ausbildung/schnupperkurs">Schnupper-/Einsteigerkurs</a> über den <a href="/ausbildung/l-schein">L-Schein</a> und die <a href="/ausbildung/a-schein">Höhenflugschulung (A-Schein)</a> bis zum <a href="/ausbildung/b-schein">unbeschränkten Luftfahrerschein (B-Schein)</a> aufgelistet, hier gelangt ihr zur <a href="/ausbildung/ausbildungskonzept">Gesamtübersicht</a>.',
  // `link` matches old's real per-row course-name link on this exact page
  // (fs-hirondelle.de/ausbildung's price table - each course name links to
  // its own course page, e.g. "L-Schein" -> .../ausbildung/grundkurs there,
  // .../ausbildung/l-schein here, since our own route for it is named
  // differently but points at the same real page).
  priceRows: [
    { name: 'Schnupper-/Einsteigerkurs', duration: '1 – 2 Tage', content: 'Ausrüstung kennen lernen, die ersten Flüge', price: 'ab 149,- €', link: '/ausbildung/schnupperkurs', bgColor: '#80c533' },
    { name: 'L-Schein', duration: '3 – 4 Tage', content: '15 Flüge am Grundkurs-Übungshang', price: '620,- €', link: '/ausbildung/l-schein', bgColor: '#34963b' },
    { name: 'Windenschein', duration: '3 Tage', content: '20 Flüge an der Winde', price: '450,- €', link: '/ausbildung/windenschein', bgColor: '#fff600' },
    { name: 'A-Schein', duration: 'mind. 1 Woche', content: '40 Höhenflüge', price: 'ab 990,- €', link: '/ausbildung/a-schein', bgColor: '#ffd700' },
    { name: 'B-Schein', duration: 'mind. 1 Woche', content: '20 Höhenflüge', price: 'ab 990,- €', link: '/ausbildung/b-schein', bgColor: '#e58e26' },
    { name: 'Tandemschein', duration: 'mind. 1 Woche', content: '40 Höhenflüge mit einem Passagier', price: 'ab 790,- €', link: '/ausbildung/tandemschein', bgColor: '#c4c5ca' },
  ],
  graphicImage: '/images/inhalte/ausbildungswege.png',
  graphicCaption: 'hm = ca. Höhenmeter-Differenz zwischen Start- und Landeplatz',
  // Old's real target for this exact button (fs-hirondelle.de/ausbildung ->
  // Weiterlesen under the graphic -> fs-hirondelle.de/ausbildung/ausbildungskonzept).
  graphicButtonLink: '/ausbildung/ausbildungskonzept',
  categories: [
    { heading: 'Schnupper-/Einsteigerkurs', subheading: 'Der Anfang einer neuen Leidenschaft....', description: "Am Schnuppertag / Einsteigerkurs lernst du die Grundzüge des Gleitschirmfliegens kennen. Anfängliche Aufzieh- und Laufübungen bereiten dich auf deine ersten Flüge vor: Kappe auslegen, Leinen sortieren, Eintrittsöffnungen kontrollieren, damit der Gleitschirm anschließend richtig über euch steigt. Gurtzeug anlegen, Startcheck und los geht's zum ersten Versuch.", image: '/images/1-schnuppern/itemimg-schnuppern.jpg', link: '/ausbildung/schnupperkurs' },
    { heading: 'L-Schein', subheading: 'Du legst den Grundstein...', description: 'Aufbauend auf den Schnupperkurs werden im Grundkurs die fehlenden Flüge zur Erlangung des L-Scheins absolviert. Ziel des Kurses ist es, mindestens 15 Flüge am Hang oder an der Winde zu absolvieren, bei denen die Höhendifferenz schon bis zu 200 Meter betragen kann. Kurvenflug und Schirmkontrolle sind einige der Lerninhalte, die in diesem Kurs auf dem Lehrplan stehen.', image: '/images/1-grundkurs/itemimg-grundkurs.jpg', link: '/ausbildung/l-schein' },
    { heading: 'A-Schein', subheading: 'Was dich erwartet beim Höhenflugkurs...', description: 'Aufbauend auf dem Grundkurs, werden beim Höhenflugkurs die ersten 15 Flüge für den beschränkten Luftfahrerschein (A-Schein) durchgeführt. Das Ziel des Höhenflugkurses ist der Höhenflugausweis.', image: '/images/1-a-schein/hero.jpg', link: '/ausbildung/a-schein' },
    { heading: 'B-Schein', subheading: 'Auf Strecke mit dem unbeschränkten Luftfahrerschein...', description: 'Das Gleitpotential des Gleitschirms ausreizen, die Thermik ausfliegen und dann auf Strecke gehen. Von Aufwind zu Aufwind gleiten und die Landschaft aus der Vogelperspektive genießen, das ist der Traum vieler Flieger.', image: '/images/b-schein/hero.jpg', link: '/ausbildung/b-schein' },
    { heading: 'Windenschein', subheading: 'Windenschlepp mit dem Gleitschirm...', description: 'Das Schleppen an der Winde ist eine ideale Möglichkeit, auch im Flachland mit dem Gleitschirm in die Luft zu kommen. Der Windenschein ist die ideale Ergänzung zum A-Scheinkurs da ihr hier schnell einen Großteil der nötigen Flüge für die A-Scheinprüfung sammeln könnt.', image: '/images/1-winde/hero.jpg', link: '/ausbildung/windenschein' },
    { heading: 'Tandemschein', subheading: 'Zusammen mit Freunden zum Fliegen gehen.', description: 'Zum Fliegen gehen und die Leidenschaft mit Freunden teilen? Mit dem Tandemschein kein Problem! Die Freiheit und die Eindrücke in der Luft mit jemanden teilen zu können ist ein fantastisches Erlebnis sowohl für den Piloten auch für den Passagier. Einfach ein Traum.', image: '/images/tandemschein/hero.jpg', link: '/ausbildung/tandemschein' },
  ],
};

export const Ausbildung = ({ contentId }: { contentId?: string } = {}) => {
  const { open } = useLightbox();
  const [content, setContent] = useState(DEFAULT_CONTENT);

  useEffect(() => {
    fetch(`/api/sitepagecontent/public/${contentId || 'ausbildung'}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setContent(data); })
      .catch((err) => console.error('Error fetching Ausbildung content:', err));
  }, [contentId]);

  const [c0, c1, c2, c3, c4, c5] = content.categories;
  return (
    <div className="w-full bg-white">
      <Banner />

      <div className="container mx-auto px-4 py-12 max-w-[1200px]">
        
        {/* Main Title Removed as per request */}
        <div className="text-center mb-16 mt-8">
          
          {/* Intro text */}
          <p className="text-xl md:text-2xl text-luxury-heading italic font-luxury mb-8 max-w-3xl mx-auto leading-relaxed">
            "{content.heroQuote}"
          </p>

          <div className="max-w-4xl mx-auto text-gray-500 space-y-6 text-sm md:text-base font-light leading-relaxed text-justify">
            <p>{content.introQuote}</p>
            <SafeHtml html={content.introHtml} className="[&_a]:text-[#428bca] [&_a:hover]:text-[#2a6496] [&_a:hover]:underline [&_a]:font-bold" />
          </div>
        </div>

        {/* Table and Graphic Section */}
        <div className="flex flex-col lg:flex-row gap-8 mb-16">
          
          {/* Table */}
          <div className="w-full lg:w-3/5 overflow-hidden">
            <table className="w-full text-left border-collapse table-fixed">
              <thead>
                <tr className="border-b border-gray-300 text-[11px] sm:text-sm">
                  <th className="py-2 text-[#429cbf] font-semibold w-[40%] pr-1">Kurse/Zeiten</th>
                  <th className="py-2 text-[#429cbf] font-semibold w-[40%] pr-1">Kursinhalt</th>
                  <th className="py-2 text-[#429cbf] font-semibold w-[20%] text-right">Kurspreis*</th>
                </tr>
              </thead>
              <tbody className="text-[11px] sm:text-sm">
                {content.priceRows.map((row, i) => {
                  const isLast = i === content.priceRows.length - 1;
                  return (
                    <tr
                      key={i}
                      style={{ backgroundColor: row.bgColor || PRICE_ROW_COLORS[i % PRICE_ROW_COLORS.length] }}
                      className={`text-black ${isLast ? 'border-b border-gray-300' : ''}`}
                    >
                      <td className="py-2 px-1 sm:px-2 font-bold break-words pr-2">
                        {row.link ? <Link to={row.link} className="hover:underline">{row.name}</Link> : row.name} <br className="sm:hidden" /><span className="font-normal text-[10px] sm:text-sm">({row.duration})</span>
                      </td>
                      <td className="py-2 px-1 sm:px-2 pr-2">{row.content}</td>
                      <td className="py-2 px-1 sm:px-2 text-right font-semibold">{row.price}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-xs text-gray-500 mt-2">*exkl. Zusatzkosten vor Ort (z. B. Geländegebühren, Auffahrtskosten etc.)</p>
          </div>

          {/* Graphic - old site's mediabox plugin puts a magnifier badge in
              the bottom-right corner of every zoomable content image; this
              one opens the same way as the course photos below. */}
          <div className="w-full lg:w-2/5 flex flex-col justify-end">
            <div
              className="relative group/zoom cursor-zoom-in mb-2"
              onClick={() => open(content.graphicImage, 'Ausbildungswege Grafik')}
            >
              <img
                src={content.graphicImage}
                alt="Ausbildungswege Grafik"
                className="w-full object-contain"
              />
              <div className="absolute bottom-2 right-2 flex items-center justify-center">
                <Search className="w-6 h-6 text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]" />
              </div>
            </div>
            <p className="text-[13px] text-gray-600 text-center mb-6">
              {content.graphicCaption}
            </p>
            <div className="flex justify-start">
              {content.graphicButtonLink ? (
                <Link to={content.graphicButtonLink} className="px-8 py-3 bg-transparent border border-luxury-gold text-luxury-gold hover:bg-luxury-gold hover:text-white transition-colors duration-300 uppercase tracking-widest text-[10px] font-semibold rounded-sm">
                  WEITERLESEN
                </Link>
              ) : (
                <button className="px-8 py-3 bg-transparent border border-luxury-gold text-luxury-gold hover:bg-luxury-gold hover:text-white transition-colors duration-300 uppercase tracking-widest text-[10px] font-semibold rounded-sm">
                  WEITERLESEN
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Categories List */}
        <div className="flex flex-col gap-24 mt-24">
          
          {/* Schnupperkurs (Image Right) */}
          <div id="schnupper" className="flex flex-col md:flex-row gap-12 items-center scroll-mt-[100px]">
            <div className="w-full md:w-1/2 flex flex-col items-start">
              <h2 className="font-luxury text-3xl md:text-4xl text-luxury-dark mb-4">
                <Link to={c0.link} className="hover:text-[#53a8c7] transition-colors">{c0.heading}</Link>
              </h2>
              <div className="w-12 h-px bg-luxury-gold mb-6"></div>
              <h3 className="text-xl italic text-luxury-heading font-luxury mb-6">{c0.subheading}</h3>
              <p className="text-gray-500 mb-8 leading-relaxed font-light text-justify">
                {c0.description}
              </p>
              <Link to={c0.link} className="inline-block px-8 py-3 bg-transparent border border-luxury-gold text-luxury-gold hover:bg-luxury-gold hover:text-white transition-colors duration-300 uppercase tracking-widest text-[10px] font-semibold rounded-sm">
                WEITERLESEN
              </Link>
            </div>
            <div className="w-full md:w-1/2">
              <div className="relative group overflow-hidden rounded-sm shadow-xl">
                <div className="absolute inset-4 border border-white/40 pointer-events-none z-10 transition-colors group-hover:border-luxury-gold/50"></div>
                <img src={c0.image} alt="Schnupperkurs" onClick={() => open(c0.image, 'Schnupperkurs')} className="w-full h-[400px] object-cover cursor-zoom-in transition-transform duration-1000 group-hover:scale-105" />
              </div>
            </div>
          </div>

          {/* L-Schein (Image Left) */}
          <div id="l-schein" className="flex flex-col md:flex-row-reverse gap-12 items-center scroll-mt-[100px]">
            <div className="w-full md:w-1/2 flex flex-col items-start">
              <h2 className="font-luxury text-3xl md:text-4xl text-luxury-dark mb-4">
                <Link to={c1.link} className="hover:text-[#53a8c7] transition-colors">{c1.heading}</Link>
              </h2>
              <div className="w-12 h-px bg-luxury-gold mb-6"></div>
              <h3 className="text-xl italic text-luxury-heading font-luxury mb-6">{c1.subheading}</h3>
              <p className="text-gray-500 mb-8 leading-relaxed font-light text-justify">
                {c1.description}
              </p>
              <Link to={c1.link} className="inline-block px-8 py-3 bg-transparent border border-luxury-gold text-luxury-gold hover:bg-luxury-gold hover:text-white transition-colors duration-300 uppercase tracking-widest text-[10px] font-semibold rounded-sm">
                WEITERLESEN
              </Link>
            </div>
            <div className="w-full md:w-1/2">
              <div className="relative group overflow-hidden rounded-sm shadow-xl">
                <div className="absolute inset-4 border border-white/40 pointer-events-none z-10 transition-colors group-hover:border-luxury-gold/50"></div>
                <img src={c1.image} alt="L-Schein" onClick={() => open(c1.image, 'L-Schein')} className="w-full h-[400px] object-cover cursor-zoom-in transition-transform duration-1000 group-hover:scale-105" />
              </div>
            </div>
          </div>

          {/* A-Schein (Image Right) */}
          <div id="a-schein" className="flex flex-col md:flex-row gap-12 items-center scroll-mt-[100px]">
            <div className="w-full md:w-1/2 flex flex-col items-start">
              <h2 className="font-luxury text-3xl md:text-4xl text-luxury-dark mb-4">
                <Link to={c2.link} className="hover:text-[#53a8c7] transition-colors">{c2.heading}</Link>
              </h2>
              <div className="w-12 h-px bg-luxury-gold mb-6"></div>
              <h3 className="text-xl italic text-luxury-heading font-luxury mb-6">{c2.subheading}</h3>
              <p className="text-gray-500 mb-8 leading-relaxed font-light text-justify">
                {c2.description}
              </p>
              <Link to={c2.link} className="inline-block px-8 py-3 bg-transparent border border-luxury-gold text-luxury-gold hover:bg-luxury-gold hover:text-white transition-colors duration-300 uppercase tracking-widest text-[10px] font-semibold rounded-sm">
                WEITERLESEN
              </Link>
            </div>
            <div className="w-full md:w-1/2">
              <div className="relative group overflow-hidden rounded-sm shadow-xl">
                <div className="absolute inset-4 border border-white/40 pointer-events-none z-10 transition-colors group-hover:border-luxury-gold/50"></div>
                <img src={c2.image} alt="A-Schein" onClick={() => open(c2.image, 'A-Schein')} className="w-full h-[400px] object-cover cursor-zoom-in transition-transform duration-1000 group-hover:scale-105" />
              </div>
            </div>
          </div>

          {/* B-Schein (Image Left) */}
          <div id="b-schein" className="flex flex-col md:flex-row-reverse gap-12 items-center scroll-mt-[100px]">
            <div className="w-full md:w-1/2 flex flex-col items-start">
              <h2 className="font-luxury text-3xl md:text-4xl text-luxury-dark mb-4">
                <Link to={c3.link} className="hover:text-[#53a8c7] transition-colors">{c3.heading}</Link>
              </h2>
              <div className="w-12 h-px bg-luxury-gold mb-6"></div>
              <h3 className="text-xl italic text-luxury-heading font-luxury mb-6">{c3.subheading}</h3>
              <p className="text-gray-500 mb-8 leading-relaxed font-light text-justify">
                {c3.description}
              </p>
              <Link to={c3.link} className="inline-block px-8 py-3 bg-transparent border border-luxury-gold text-luxury-gold hover:bg-luxury-gold hover:text-white transition-colors duration-300 uppercase tracking-widest text-[10px] font-semibold rounded-sm">
                WEITERLESEN
              </Link>
            </div>
            <div className="w-full md:w-1/2">
              <div className="relative group overflow-hidden rounded-sm shadow-xl">
                <div className="absolute inset-4 border border-white/40 pointer-events-none z-10 transition-colors group-hover:border-luxury-gold/50"></div>
                <img src={c3.image} alt="B-Schein" onClick={() => open(c3.image, 'B-Schein')} className="w-full h-[400px] object-cover cursor-zoom-in transition-transform duration-1000 group-hover:scale-105" />
              </div>
            </div>
          </div>

          {/* Windenschein (Image Right) */}
          <div id="winde" className="flex flex-col md:flex-row gap-12 items-center scroll-mt-[100px]">
            <div className="w-full md:w-1/2 flex flex-col items-start">
              <h2 className="font-luxury text-3xl md:text-4xl text-luxury-dark mb-4">
                <Link to={c4.link} className="hover:text-[#53a8c7] transition-colors">{c4.heading}</Link>
              </h2>
              <div className="w-12 h-px bg-luxury-gold mb-6"></div>
              <h3 className="text-xl italic text-luxury-heading font-luxury mb-6">{c4.subheading}</h3>
              <p className="text-gray-500 mb-8 leading-relaxed font-light text-justify">
                {c4.description}
              </p>
              <Link to={c4.link} className="inline-block px-8 py-3 bg-transparent border border-luxury-gold text-luxury-gold hover:bg-luxury-gold hover:text-white transition-colors duration-300 uppercase tracking-widest text-[10px] font-semibold rounded-sm">
                WEITERLESEN
              </Link>
            </div>
            <div className="w-full md:w-1/2">
              <div className="relative group overflow-hidden rounded-sm shadow-xl">
                <div className="absolute inset-4 border border-white/40 pointer-events-none z-10 transition-colors group-hover:border-luxury-gold/50"></div>
                <img src={c4.image} alt="Windenschein" onClick={() => open(c4.image, 'Windenschein')} className="w-full h-[400px] object-cover cursor-zoom-in transition-transform duration-1000 group-hover:scale-105" />
              </div>
            </div>
          </div>

          {/* Tandemschein (Image Left) */}
          <div id="tandem" className="flex flex-col md:flex-row-reverse gap-12 items-center scroll-mt-[100px]">
            <div className="w-full md:w-1/2 flex flex-col items-start">
              <h2 className="font-luxury text-3xl md:text-4xl text-luxury-dark mb-4">
                <Link to={c5.link} className="hover:text-[#53a8c7] transition-colors">{c5.heading}</Link>
              </h2>
              <div className="w-12 h-px bg-luxury-gold mb-6"></div>
              <h3 className="text-xl italic text-luxury-heading font-luxury mb-6">{c5.subheading}</h3>
              <p className="text-gray-500 mb-8 leading-relaxed font-light text-justify">
                {c5.description}
              </p>
              <Link to={c5.link} className="inline-block px-8 py-3 bg-transparent border border-luxury-gold text-luxury-gold hover:bg-luxury-gold hover:text-white transition-colors duration-300 uppercase tracking-widest text-[10px] font-semibold rounded-sm">
                WEITERLESEN
              </Link>
            </div>
            <div className="w-full md:w-1/2">
              <div className="relative group overflow-hidden rounded-sm shadow-xl">
                <div className="absolute inset-4 border border-white/40 pointer-events-none z-10 transition-colors group-hover:border-luxury-gold/50"></div>
                <img src={c5.image} alt="Tandemschein" onClick={() => open(c5.image, 'Tandemschein')} className="w-full h-[400px] object-cover cursor-zoom-in transition-transform duration-1000 group-hover:scale-105" />
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
