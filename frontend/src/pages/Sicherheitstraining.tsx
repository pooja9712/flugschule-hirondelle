import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banner } from '../components/common/Banner';
import { Check, Search } from 'lucide-react';
import { useValidatedImageUrl } from '../hooks/useValidatedImage';
import { usePageGallery } from '../hooks/usePageGallery';
import { useLightbox } from '../components/common/Lightbox';
import { GutscheinBox } from '../components/common/GutscheinBox';

interface PageMedia {
  headerImageUrl: string | null;
  contentMediaType: 'IMAGE' | 'VIDEO';
  contentImageUrl: string | null;
  contentYoutubeUrl: string | null;
}

interface SicherheitstrainingData {
  heading: string;
  introHeading: string;
  introParagraphs: string[];
  offerHeading: string;
  offerBullets: string[];
  aufbauHeading: string;
  aufbauItems: string[];
  kurspreisNote: string;
  kurspreisAmount: string;
  zusatzkostenText: string;
  gutscheinHeading: string;
  gutscheinDescription: string;
  ablaufHeading: string;
  ablaufParagraphs: string[];
  uebungenHeading: string;
  uebungenList1: string[];
  uebungenList2: string[];
  teamHeading: string;
  teamParagraph: string;
  teamMemberImage: string;
  teamMemberText: string;
  unterkunftHeading: string;
  unterkunftParagraphs: string[];
  unterkunftNote: string;
  leistungenHeading: string;
  leistungen: string[];
}

// Real photos ported from the old site (images/1-sicherheit_gardasee/) -
// used as a fallback until an admin configures a gallery for the
// "sicherheitstraining" slug in Admin > Galerie, so the page never falls
// back to an unrelated stock photo.
const FALLBACK_HERO_IMAGE = '/images/performance/sicherheitstraining.jpg';
const FALLBACK_GALLERY = [
  '/images/sicherheitstraining/gallery/gallery-1.jpg',
  '/images/sicherheitstraining/gallery/gallery-2.jpg',
  '/images/sicherheitstraining/gallery/gallery-3.jpg',
  '/images/sicherheitstraining/gallery/gallery-4.jpg',
  '/images/sicherheitstraining/gallery/gallery-5.jpg',
  '/images/sicherheitstraining/gallery/gallery-6.jpg',
  '/images/sicherheitstraining/gallery/gallery-7.jpg',
  '/images/sicherheitstraining/gallery/gallery-8.jpg',
];

const DEFAULT_CONTENT: SicherheitstrainingData = {
  heading: 'SICHERHEITSTRAINING - GARDASEE',
  introHeading: 'Sicherheitstraining am Gardasee...',
  introParagraphs: [
    'Mit unserem eigenen Sicherheitstraining am Gardasee bieten wir euch ein Gelände, in dem ihr von noch mehr Höhe für eure Trainingseinheiten profotiert.',
    'Sicherheit beim Gleitschirmfliegen ist ein sehr wichtiges Thema. Wer sicher fliegt, fliegt auch mit Freude. Ein Sicherheitstraining ist die beste Gelegenheit, sich selbst und den Gleitschirm in besonderen Flugzuständen kennen zu lernen und die Flugtechnik zu verbessern. Fünf Tage für deine Sicherheit, für die Verbesserung von richtigen Reaktionen und deinem fliegerischem Können.',
    'Am Südrand der italienischen Alpen liegt der wunderschöne Gardasee, den wir als Ausgangspunkt unseres Sicherheitstrainings genießen dürfen. Der Gardasee selbst bietet durch seine Lage außerdem Erholung mit Urlaubscharakter.',
    'Durch kleine Gruppengrößen entsteht kein Streß. Es bleibt viel Zeit für eine ausgiebige Videoanalyse, gründliche Vorbereitung und Zeit für alle offenen Fragen. Bei uns ist das „Premium“ oder „VIP“ Training anderer Flugschulen der Standard, weil wir glauben, dass nur so genug Raum für alle Teilnehmer bleibt.',
  ],
  offerHeading: 'Unser exclusives Sicherheitstraining bietet euch...',
  offerBullets: [
    '5 Trainingstage – genügend Zeit um, das Trainingsziel entspannt und sicher zu erreichen',
    'kleine Gruppen von 10 bis maximal 12 Teilnehmern, persönlich und effizient',
    'garantiert sind 5 Trainingsflüge, bei wetterbedingtem Ausfall können die entsprechenden Flüge zu einem anderen Termin kostenlos nachgeholt werden. Durch die enorme Arbeitshöhe können doppelt so viele Übungen in einem Flug absolviert werden als in anderen Gebieten.',
    'das Fluggebiet am Monte Baldo ist ein ideales Trainingsgelände aufgrund seiner 1.700 m Höhendifferenz mit riesigem, sicherem Startplatz in mehrere Richtungen, sowie dem großen Landeplatz, der einfach anzufliegen ist. Trotzdem weisen wir unsere Teilnehmer am Landeplatz per Funk ein.',
    'für die Sicherheit sorgen ein professionelles Lehrteam und eine professionelle Wasserrettung. Wir verwenden Automatik-Schwimmwesten.',
  ],
  aufbauHeading: 'Trainingsaufbau',
  aufbauItems: [
    'Einfliegen + Aufwärmtraining',
    'Orientierung im 3-dimensionalen Raum',
    'Abstiegsmethoden',
    'Fliehkrafttraining',
    'Klappertraining',
    'Strömungsabriß (für Fortgeschrittene)',
  ],
  kurspreisNote: 'Eigene Ausrüstung erforderlich',
  kurspreisAmount: '950,- €',
  zusatzkostenText: 'Unterkunft / Verpflegung, Seilbahn für die Auffahrt',
  gutscheinHeading: 'Training Verschenken',
  gutscheinDescription: 'Das Sicherheitstraining ist auch als Geschenk-Gutschein möglich.',
  ablaufHeading: 'Trainingsablauf',
  ablaufParagraphs: [
    'Anreisetag ist der Samstag, das Training selbst beginnt am Sonntag. Der erste Kurstag (Sonntag) ist vorgesehen, um das Fluggelände kennen zu lernen und die Flugmanöver theoretisch durchzusprechen. Das Training beginnt mit einer umfassenden Ausrüstungskontrolle und Gurtzeugeinstellung, Retter-Probeauslösung und Funk-/Schwimmwestenausgabe, Landeplatzbesprechung und Gefahreneinweisung im Falle einer Wasserlandung. Bei einem Eingewöhnungsflug werden die ersten Übungen geflogen.',
    'Ab dem 2. - 5. Tag werden täglich zuerst die jeweiligen Übungen besprochen, dann erflogen und anschließend durch Videoanalyse ausgewertet.',
    'Pro Trainingstag sind 2-3 Flüge vorgesehen, am ersten und letzten Tag jeweils einer.',
  ],
  uebungenHeading: 'Flugübungen',
  uebungenList1: [
    'Nicken und abfangen',
    'Rollen und abfangen',
    'Frontklapper unbeschleunigt und beschleunigt',
    'Seitenklapper unbeschleunigt und beschleunigt',
    'Einleitphase Steilspirale',
    'Ohren anlegen und beschleunigen',
  ],
  uebungenList2: [
    'B-Leinen Stall',
    'Steilspirale (optional)',
    'Trudeln (optional)',
    'Fullstall (optional)',
    'Retter werfen (optional)',
    'weitere Manöver auf Anfrage',
  ],
  teamHeading: 'Das Sicherheitstraining-Team besteht aus...',
  teamParagraph:
    'Das Team bei den exclusiven Sicherheitstrainings besteht aus dem Trainingsleiter, einem erfahrenen Startleiter und einem Kameramann für die Videoaufzeichnungen. Wir arbeiten mit mind. zwei Fluglehrern, einem am Startplatz und dem Trainingsleiter direkt am See, so dass dieser im Falle einer Wasserlandung schnell mit dem einsatzbereiten Rettungsboot in kürzester Zeit bei dir ist. Der Fluglehrer am Startplatz steht für alle noch offenen Fragen zur Verfügung, gibt dir wertvolle Tipps beim Start und sorgt für einen reibungslosen und stressfreien Ablauf am Startplatz. Nach dem Start begleitet er dich über Funk, bis der Fluglehrer am See übernimmt und du die im Vorfeld vereinbarten Flugfiguren beginnen kannst. Die Übungen werden von unserem Kameramann auf Video aufgenommen. Während deiner Flüge bekommst du in der Luft über Funk Hilfen und Anweisungen zu deinen Übungen und sofortige Korrekturen bei eventuellen Fehlern. Da immer nur ein Teilnehmer Übungen durchführt, kann auf das Flugkönnen jedes Einzelnen genauestens eingegangen werden.',
  teamMemberImage: '/images/team/schlink.jpg',
  teamMemberText: 'Startleiter: Alex, Performance-Trainer\nund Ausbildungsleiter der Flugschule Hirondelle',
  unterkunftHeading: 'Unterkunft / Region',
  unterkunftParagraphs: [
    'Das besonders günstige Mikroklima des Gardasees ermöglicht fast täglich Flüge vom Monte Baldo, Sommer wie Winter.',
    'Die moderne Panorama – Seilbahn befördert die Piloten sicher und schnell zum Startplatz – im Falle langer Wartezeiten fahren wir mit unseren Teilnehmern direkt zur Mittelstation.',
    'Das mediterrane Klima in Malcesine lädt nach dem Fliegen zum entspannten Spaziergang im malerischen Ort Malcesine ein und die wunderschöne Umgebung bietet auch nicht fliegender Begleitung vielseitige Möglichkeiten zur Urlaubsgestaltung.',
    'Zur Übernachtung stehen mehrere Hotels zur Verfügung, aber auch Ferienappartments und Campingplätze sind in nächster Umgebung zahlreich vorhanden. So kann das exclusive Sicherheitstraining am Gardasee/Monte Baldo auch zum Urlaubsziel für die ganze Familie werden. Die Reservierung des Hotels erfolgt über uns.',
  ],
  unterkunftNote: 'Im Rahmen des Sicherheitstrainings ist eine eigene Ausrüstung erforderlich!',
  leistungenHeading: 'Unsere Leistungen',
  leistungen: [
    'Kompetente Fachbetreuung durch einen zertifizierten Sicherheitstrainer',
    'Umfassende Betreuung am Starplatz durch Alex Schlink (Performancetrainer)',
    'Aufzeichnung der Flugmanöver mit anschließender Videoanalyse',
    'Ohnmachtssichere Automatikschwimmwesten (ohne Einschränkung der Bewegungsfreiheit)',
    'Funkverbindung',
    'Ausführlicher Theorieunterricht inkl. täglichem Briefing der bevorstehenden Flugmanöver',
    'Leistungsstarkes Rettungsboot',
    'Mentale Vorbereitung auf die einzelnen Flugfiguren',
    'exkl. Anreise, Unterkunft, Verpflegung, Seilbahn',
  ],
};

export const Sicherheitstraining = ({ contentId }: { contentId?: string } = {}) => {
  const [media, setMedia] = useState<PageMedia | null>(null);
  const [content, setContent] = useState<SicherheitstrainingData>(DEFAULT_CONTENT);
  const { openGallery } = useLightbox();

  // Header/content image still come from Page Media (Seitenmedien) -
  // unrelated to and untouched by the Galerie feature below, and out of
  // scope for this content pass (already its own admin-managed system).
  useEffect(() => {
    fetch('/api/pagemedia/public/sicherheitstraining')
      .then(res => res.json())
      .then(data => {
        if (!data.error) setMedia(data);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetch(`/api/sitepagecontent/public/${contentId || 'sicherheitstraining'}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setContent(data); })
      .catch((err) => console.error('Error fetching Sicherheitstraining content:', err));
  }, [contentId]);

  const heroImage = useValidatedImageUrl(media?.contentImageUrl, FALLBACK_HERO_IMAGE);
  // Gallery now comes from the standalone Galerie feature (Admin > Galerie)
  // instead of Page Media's galleryImages field - see usePageGallery.ts.
  const galleryImages = usePageGallery('sicherheitstraining', FALLBACK_GALLERY);

  return (
    <div className="w-full bg-white font-luxurysans">
      {/* Banner Component */}
      <Banner />

      {/* Main Content Section */}
      <section className="py-16 md:py-24 px-4">
        <div className="max-w-[1200px] mx-auto">

          {/* Page Title (full width, above the two-column grid) */}
          <div className="mb-12">
            <h1 className="font-luxury text-4xl md:text-5xl text-[#53a8c7] uppercase tracking-wider mb-2">
              {content.heading}
            </h1>
            <div className="w-full h-px bg-[#53a8c7]/30"></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

          {/* Left Column (Content) */}
          <div className="lg:col-span-7 space-y-12">

            {/* Featured Image or Video Slot */}
            <div className="w-full min-h-[400px] overflow-hidden rounded-sm shadow-sm group">
              {media?.contentMediaType === 'VIDEO' && media?.contentYoutubeUrl ? (
                <iframe
                  className="w-full h-[400px]"
                  src={media.contentYoutubeUrl}
                  title="Sicherheitstraining Video"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              ) : (
                <img
                  src={heroImage}
                  alt="Sicherheitstraining Gardasee"
                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                />
              )}
            </div>

            {/* Content Blocks (Top Part) */}
            <div className="space-y-10 text-gray-600 font-light leading-relaxed text-justify">

              <div>
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic text-left">{content.introHeading}</h3>
                <div className="space-y-4">
                  {content.introParagraphs.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic text-left">{content.offerHeading}</h3>
                <ul className="list-disc pl-5 space-y-2 text-left">
                  {content.offerBullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic text-left">{content.aufbauHeading}</h3>
                <ul className="list-disc pl-5 space-y-1 text-left">
                  {content.aufbauItems.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Right Column (Sidebar) */}
          <div className="lg:col-span-5 space-y-12 mt-12 lg:mt-0">

            {/* Quick Links Blocks */}
            <div className="flex flex-col">
              <Link to="/performance" className="bg-[#E58E26] hover:opacity-90 text-white text-center py-3 font-semibold text-[15px] transition-opacity border-b border-white/20">
                Streckenflugtraining
              </Link>
              <Link to="/performance/sicherheitstraining" className="bg-[#D24F25] hover:opacity-90 text-white text-center py-3 font-semibold text-[15px] transition-opacity border-b border-white/20">
                Sicherheitstraining
              </Link>
              <Link to="/performance" className="bg-[#34963B] hover:opacity-90 text-white text-center py-3 font-semibold text-[15px] transition-opacity border-b border-white/20">
                Thermik- und Flugtechniktraining
              </Link>
              <Link to="/performance/rettungsgeraetetraining" className="bg-[#59ABDE] hover:opacity-90 text-white text-center py-3 font-semibold text-[15px] transition-opacity">
                Rettungsgerätetraining
              </Link>
            </div>

            {/* Booking Card */}
            <div className="bg-[#FAF9F7] border border-gray-100 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-[#53a8c7] transform origin-left transition-transform duration-500 scale-x-0 group-hover:scale-x-100"></div>

              <div className="p-8">
                <Link
                  to="/events?category=Performance%20Training"
                  className="block w-full bg-[#53a8c7] hover:bg-[#4396b5] text-white text-center py-3 text-lg font-semibold transition-colors mb-10 shadow-md flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                  Kurs buchen
                </Link>

                <div className="space-y-6 mb-8">
                  <div className="border-b border-gray-200 pb-6">
                    <div className="flex justify-between items-start gap-4 mb-2">
                      <div className="text-gray-600 font-light text-[13px]">
                        <p className="font-bold text-luxury-dark mb-1">Kurspreis</p>
                        <p>{content.kurspreisNote}</p>
                      </div>
                      <p className="font-bold text-luxury-dark text-lg whitespace-nowrap mt-0.5">{content.kurspreisAmount}</p>
                    </div>
                  </div>

                  <div className="pt-2">
                    <div className="text-gray-600 font-light text-[13px] leading-relaxed">
                      <p className="font-bold text-luxury-dark mb-1">Zusatzkosten</p>
                      <p>{content.zusatzkostenText}</p>
                    </div>
                  </div>
                </div>
              </div>

              <Link
                to="/events?category=Performance%20Training"
                className="w-full block bg-[#526a75] hover:bg-luxury-gold text-white text-center py-4 px-2 text-sm font-semibold transition-colors leading-relaxed"
              >
                Termin siehe Kalender
              </Link>
            </div>

            <GutscheinBox
              heading={content.gutscheinHeading}
              description={content.gutscheinDescription}
              headingClassName="text-[#53a8c7]"
            />

            {/* Impressions Gallery */}
            {/* data-live-*: the Joomla-style page editor keeps this gallery live (utils/liveBlocks.tsx) */}
            <div data-live-block="gallery" data-live-slug="sicherheitstraining" data-live-fallback={JSON.stringify(FALLBACK_GALLERY)}>
               <h3 className="font-luxury text-2xl text-[#53a8c7] mb-6 uppercase tracking-wider border-b border-gray-200 pb-4">
                 Impressionen
               </h3>
               <div className="grid grid-cols-3 gap-2">
                 {galleryImages.map((img: string, index: number) => (
                   <div
                     key={index}
                     className="relative aspect-square overflow-hidden group cursor-zoom-in bg-gray-100"
                     onClick={() => openGallery(
                       galleryImages.map((g: string) => ({ src: g, alt: 'Impression' })),
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

        {/* Bottom Full-Width Content (To avoid empty right space) */}
        <div className="max-w-[1200px] mx-auto mt-8">
          <hr className="border-gray-100 mb-10" />

          <div className="space-y-16 text-gray-600 font-light leading-relaxed text-justify">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div>
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic text-left">{content.ablaufHeading}</h3>
                <div className="space-y-4">
                  {content.ablaufParagraphs.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic text-left">{content.uebungenHeading}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ul className="list-disc pl-5 space-y-2 text-left">
                    {content.uebungenList1.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                  <ul className="list-disc pl-5 space-y-2 text-left">
                    {content.uebungenList2.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="max-w-4xl">
              <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic text-left">{content.teamHeading}</h3>
              <p className="mb-8">
                {content.teamParagraph}
              </p>
              <div className="flex items-center gap-6 bg-gray-50 p-6 rounded-sm border border-gray-100 shadow-sm inline-flex">
                <img src={content.teamMemberImage} alt="Alex Schlink" className="w-20 h-20 rounded-full object-cover border-2 border-luxury-gold/30" />
                <p className="font-medium text-[15px] text-luxury-dark text-left" style={{ whiteSpace: 'pre-line' }}>{content.teamMemberText}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div>
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic text-left">{content.unterkunftHeading}</h3>
                <div className="space-y-4">
                  {content.unterkunftParagraphs.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                  <p className="font-medium text-luxury-dark pt-2 text-left">{content.unterkunftNote}</p>
                </div>
              </div>

              <div>
                <h2 className="font-luxury text-3xl text-[#53a8c7] mb-8 uppercase text-left">{content.leistungenHeading}</h2>
                <ul className="space-y-4 text-left">
                  {content.leistungen.map((item, idx) => (
                    <li key={idx} className="flex gap-3 text-gray-600 font-light">
                      <Check className="w-5 h-5 text-luxury-gold shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

          </div>
        </div>
      </section>

    </div>
  );
};
