import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banner } from '../components/common/Banner';
import { Search } from 'lucide-react';
import { useLightbox } from '../components/common/Lightbox';
import { GutscheinBox } from '../components/common/GutscheinBox';
import { usePageGallery } from '../hooks/usePageGallery';

// Old site's actual "Simple Image Gallery" filenames for this page
// (/images/bilder/1-groundhandling/*), in their real order.
// Used only as a fallback now - see usePageGallery below - so the page keeps
// looking exactly like this until an admin configures a gallery for the
// "groundhandling" slug in Admin > Seitenmedien.
const FALLBACK_GALLERY = [
  '1Groundhandling_Platzhalter.jpg', 'DSC00352.jpg', 'DSC00438.jpg', 'DSC00439.jpg', 'DSC00440.jpg',
  'DSC00451.jpg', 'DSC00455.jpg', 'DSC00456.jpg', 'DSC00473.jpg', 'DSC00510.jpg',
  'DSC00511.jpg', 'DSC00525.jpg', 'DSC00531.jpg', 'groundhandling2.png', 'groundhandling4.png',
  'IMG_6154.jpg',
].map((f) => `/images/groundhandling/${f}`);

interface GroundhandlingData {
  eyebrow: string;
  heading: string;
  videoUrl: string;
  videoTitle: string;
  paragraph1: string;
  paragraph2: string;
  leistungen: string[];
  checkliste: string[];
  bookingBadge: string;
  priceLabel: string;
  priceNote: string;
  price: string;
  priceDuration: string;
  bookingButtonText: string;
  bookingButtonLink: string;
  gutscheinHeading: string;
  gutscheinDescription: string;
}

const DEFAULT_CONTENT: GroundhandlingData = {
  eyebrow: 'PERFORMANCE',
  heading: 'Groundhandling Kurs',
  videoUrl: 'https://www.youtube-nocookie.com/embed/qh9ORewDogc?rel=0',
  videoTitle: "Groundhandling & Rückwärts aufziehen - So geht's! | Flugschule Hirondelle",
  paragraph1: 'Unter Groundhandling verstehen wir, mit dem Schirm am Boden zu spielen, fühlen was sich 7 m über unseren Köpfen abspielt. Agieren und reagieren. Den Schirm sicher in allen Situationen zu beherrschen. Mit Blickrichtung zum Schirm rückwärts aufziehen, den Schirm kontrollieren, umdrehen und starten... Bei unserem Seminar werden verschiedene Techniken der Steuerung und Handhabung erklärt und gleich in der Praxis umgesetzt. All das hilft, den eigenen Gleitschirm spielerisch beherrschen zu lernen und macht außerdem auch richtig Spaß!',
  paragraph2: 'Wir brauchen ca. 3 Stunden, in denen wir euch 1:1 beim Groundhandling betreuen, um die Basics zu legen. Danach müsst ihr selbst noch mindestens 5 h auf die Wiese gehen, bis die Abläufe verinnerlicht sind. Groundhandling ist das A & O für jeden Piloten, um den eigenen Schirm kennen und steuern zu lernen. Selbst geübte Piloten gehen regelmäßig auf die Wiese, um ihr Gefühl für ihren Schirm zu verbessern. Als Anfänger ist dies ein absolutes Muss. Wer seinen Schirm am Boden perfekt beherrscht, gewinnt auch in der Luft Sicherheit. Die Groundhandling-Kurse finden – je nach Wetterlage – auf einem unserer Schulungsgelände statt. Weiche, hindernisfreie Wiesen sorgen für ungetrübten Spaß beim Trainieren. Wir bieten jährlich mehrere Groundhandling-Kurse an.',
  leistungen: [
    'Fachkundige Betreuung durch unsere Fluglehrer',
    'Auf Wunsch Leihausrüstung, Kosten hierfür bitte anfragen',
    'Haftpflichtversicherung',
  ],
  checkliste: [
    'Lust mit dem Schirm am Boden zu spielen',
    'Überknöchelhohe Schuhe, wir empfehlen spezielle Flugschuhe oder zumindest Wanderschuhe',
    'Outdoor-Bekleidung, je nach Wetter Wechselkleidung',
    'Ausreichend Getränke und Verpflegung (Groundhandling macht sehr hungrig ;-)))',
    'Sonnencreme',
  ],
  bookingBadge: 'Groundhandlingtraining Einzelschulung',
  priceLabel: 'Kurspreis in Privatschulung',
  priceNote: '[eigene Ausrüstung erforderlich, Leihausrüstung auf Anfrage]',
  price: '450,- € / Einheit',
  priceDuration: '(3 - 6 h)',
  bookingButtonText: 'Termine werden über den Newsletter bekannt gegeben –\nmeldet euch am Newsletter an',
  bookingButtonLink: '/events?category=Groundhandlingkurs',
  gutscheinHeading: 'Kurs Verschenken',
  gutscheinDescription: 'Du suchst ein außergewöhnliches Geschenk? Warum nicht einmal einen Gutschein für einen Groundhandling-Kurs verschenken!',
};

export const Groundhandling = ({ contentId }: { contentId?: string } = {}) => {
  const { openGallery } = useLightbox();
  // Admin-managed gallery (falls back to FALLBACK_GALLERY above) - see
  // frontend/src/hooks/usePageGallery.ts
  const galleryImages = usePageGallery('groundhandling', FALLBACK_GALLERY);
  const [content, setContent] = useState<GroundhandlingData>(DEFAULT_CONTENT);

  useEffect(() => {
    fetch(`/api/sitepagecontent/public/${contentId || 'groundhandling'}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setContent(data); })
      .catch((err) => console.error('Error fetching Groundhandling content:', err));
  }, [contentId]);

  const [bookingButtonLine1, bookingButtonLine2] = content.bookingButtonText.split('\n');

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

            {/* Video - old site just embeds the iframe directly, no click-to-play
                preview thumbnail, so this doesn't either. */}
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
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic">Auf Tuchfühlung mit dem Gleitschirm...</h3>
                <p className="mb-4">
                  {content.paragraph1}
                </p>
                <p>
                  {content.paragraph2}
                </p>
              </div>
            </div>

            {/* Leistungen & Checkliste inside Left Column */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-12 pt-12 border-t border-gray-100">
              <div>
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 uppercase tracking-wider border-b border-gray-200 pb-4">Unsere Leistungen</h3>
                <ul className="space-y-4 mt-6">
                  {content.leistungen.map((item, idx) => (
                    <li key={idx} className="flex gap-3 text-gray-600 font-light text-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-luxury-gold mt-2 shrink-0"></span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-luxury text-2xl text-luxury-dark mb-4 uppercase tracking-wider border-b border-gray-200 pb-4">Deine Checkliste</h3>
                <ul className="space-y-4 mt-6">
                  {content.checkliste.map((item, idx) => (
                    <li key={idx} className="flex gap-3 text-gray-600 font-light text-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-luxury-gold mt-2 shrink-0"></span>
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
            <div className="bg-[#FAF9F7] p-8 border border-gray-100 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-luxury-gold transform origin-left transition-transform duration-500 scale-x-0 group-hover:scale-x-100"></div>

              <div className="bg-[#53a8c7] text-white text-center py-2 mb-6 font-semibold text-sm">
                {content.bookingBadge}
              </div>

              <div className="space-y-6 mb-8 text-sm">
                <div className="border-b border-gray-200 pb-4">
                  <div className="flex justify-between items-start gap-4">
                    <p className="text-gray-600 font-light">{content.priceLabel}<br/><span className="italic">{content.priceNote}</span></p>
                    <div className="text-right">
                      <p className="font-medium text-luxury-dark whitespace-nowrap">{content.price}</p>
                      <p className="text-gray-500 font-light text-xs">{content.priceDuration}</p>
                    </div>
                  </div>
                </div>
              </div>

              <Link
                to={content.bookingButtonLink}
                className="w-full block bg-[#526a75] hover:bg-luxury-gold text-white text-center py-4 px-2 text-xs font-semibold transition-colors shadow-md leading-relaxed"
              >
                {bookingButtonLine1}
                {bookingButtonLine2 && <><br/>{bookingButtonLine2}</>}
              </Link>
            </div>

            <GutscheinBox
              heading={content.gutscheinHeading}
              description={content.gutscheinDescription}
            />

            {/* Impressions Gallery */}
            {/* data-live-*: the Joomla-style page editor keeps this gallery live (utils/liveBlocks.tsx) */}
            <div data-live-block="gallery" data-live-slug="groundhandling" data-live-fallback={JSON.stringify(FALLBACK_GALLERY)}>
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
