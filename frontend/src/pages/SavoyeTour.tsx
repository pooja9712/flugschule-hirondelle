import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banner } from '../components/common/Banner';
import { Search } from 'lucide-react';
import { EventComments } from '../components/common/EventComments';
import { useLightbox } from '../components/common/Lightbox';
import { GutscheinBox } from '../components/common/GutscheinBox';
import { usePageGallery } from '../hooks/usePageGallery';

// Old site's actual "Simple Image Gallery" filenames for this page
// (/images/bilder/2-tour-savoyer/*), in their real order.
// Used only as a fallback now - see usePageGallery below - so the page keeps
// looking exactly like this until an admin configures a gallery for the
// "savoye-tour" slug in Admin > Seitenmedien.
const FALLBACK_GALLERY = [
  'Allevard 2015-10.jpg', 'Allevard 2015-14.jpg', 'Allevard 2015-26.jpg', 'Allevard 2015-27.jpg', 'Allevard 2015-43.jpg',
  'Allevard 2015-45.jpg', 'IMG_20140505_190420.jpg', 'IMG_2869.jpg', 'IMG_2890.jpg', 'itemimg-alpen.jpg',
].map((f) => `/images/tour-savoye/${f}`);

interface ContentBlock { heading: string; text: string }
interface Badge { label: string; color: string }

interface SavoyeTourData {
  eyebrow: string;
  title: string;
  heroImage: string;
  heroAlt: string;
  contentBlocks: ContentBlock[];
  leistungenHeading: string;
  leistungen: string[];
  badges: Badge[];
  bookingButtonText: string;
  bookingButtonLink: string;
  priceLabel: string;
  price: string;
  voraussetzungText: string;
  scheduleButtonText: string;
  scheduleButtonLink: string;
  gutscheinHeading: string;
  gutscheinDescription: string;
}

const DEFAULT_CONTENT: SavoyeTourData = {
  eyebrow: 'REISEN',
  title: 'Savoyer Alpentour',
  heroImage: '/images/reisen/savoye.jpg',
  heroAlt: 'Savoyer Alpentour',
  contentBlocks: [
    {
      heading: '',
      text: "Die Savoyer Alpen befinden sich grob zwischen Genf, Chamonix und Grenoble. In dieser Region dürfte es wohl die weltweit größte Fluggebietsdichte geben. Unser Standort ist der Campingplatz La ferme de la Serraz neben dem Lac d' Annecy in Doussard. Um den See liegen alleine schon 3 Fluggelände, die von der Hauptwindrichtung recht unabhängig sind und fast täglich Flugbedingungen bieten. Von dort aus unternehmen wir dann Tagestouren in die umliegenden Fluggebiete, bspw. Allevard / St. Hilaire oder Samoëns.",
    },
    {
      heading: 'Die Tour...',
      text: 'Die Start- und Landeplätze der Savoyer Alpen sind von ihrem Grundcharakter einfach. Landschaftlich ist die Region mit ihren weißen Kalkfelsen, Wald und den 3 tiefblauen Seen der Renner. Der Blick zum Mt. Blanc, die Cafés, Boulangerien und Patisserien sprechen für sich. Durch die Geländevielfalt muss sich der Pilot auf neue Start- und Landeplatzsituationen einstellen, was einen sehr guten Weiterbildungseffekt hat. Thermisch sind die Savoyer Alpen sehr gut. Genauso gibt es viele Kanten, an denen mit dem Gleitschirm stundenlang gesoart werden kann. Ist genügend Arbeitshöhe vorhanden, können kleinere Strecken geflogen werden. Passt das Wetter am Col de la Forclaz, können die Piloten den Streckenflugklassiker "die kleine Seerunde" nach vorheriger Besprechung in Angriff nehmen. Und schon habt ihr den Streckenflug für den B-Schein in der Tasche.',
    },
    {
      heading: 'Für wen ist die Reise gedacht?',
      text: 'Für den Gelegenheits-Genussflieger der fliegerisch dazulernen und für denjenigen, der seine ersten kleinen Streckenflüge machen möchte. Mit einer Starthöhe von über 1.000 Metern bieten die Savoyer Alpen durchaus alpine Thermik- und Streckenflugqualitäten.',
    },
    {
      heading: 'Anreise, Unterkunft und Verpflegung',
      text: 'Wir übernachten in Frankreich auf dem Campingplatz – für alle ohne eigenes Dach / Haus gibt es dort voll ausgestattete Mobilehomes zum Mieten.',
    },
  ],
  leistungenHeading: 'Unsere Leistungen',
  leistungen: [
    'professionelle Betreuung durch unsere Fluglehrer',
    'Gelände- und spezielle Theorieeinweisung fürs Soaring, Thermikfliegen, Streckenfliegen',
    'tägliches Flugwetterbriefing',
    'Funkbetreuung',
    'exkl. Übernachtungskosten, Verpflegung, Auffahrten',
  ],
  badges: [
    { label: 'Streckenflugtraining', color: '#E58E26' },
    { label: 'Thermik- und Flugtechniktraining', color: '#34963B' },
    { label: 'Soaringtraining', color: '#80C533' },
  ],
  bookingButtonText: 'Reise buchen',
  bookingButtonLink: '/events?category=Reisen',
  priceLabel: 'Tourpreis',
  price: '850,- €',
  voraussetzungText: 'Voraussetzung: mindestens 5 Teilnehmer, A-Schein / Sopi',
  scheduleButtonText: 'Termin > siehe Kalender',
  scheduleButtonLink: '/events?search=Savoye',
  gutscheinHeading: 'Tour Verschenken',
  gutscheinDescription: 'Die Tour ist auch als Geschenk-Gutschein möglich',
};

export const SavoyeTour = ({ contentId }: { contentId?: string } = {}) => {
  const { openGallery } = useLightbox();
  // Admin-managed gallery (falls back to FALLBACK_GALLERY above) - see
  // frontend/src/hooks/usePageGallery.ts
  const galleryImages = usePageGallery('savoye-tour', FALLBACK_GALLERY);
  const [content, setContent] = useState<SavoyeTourData>(DEFAULT_CONTENT);

  useEffect(() => {
    fetch(`/api/sitepagecontent/public/${contentId || 'savoye-tour'}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setContent(data); })
      .catch((err) => console.error('Error fetching Savoye tour content:', err));
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
              {content.title}
            </h1>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

          {/* Left Column (Content) */}
          <div className="lg:col-span-7 space-y-12">

            {/* Main Image */}
            <div className="w-full h-[400px] relative overflow-hidden rounded-sm shadow-sm">
              <img
                src={content.heroImage}
                alt={content.heroAlt}
                className="w-full h-full object-cover transition-transform duration-1000 hover:scale-105"
              />
            </div>

            {/* Content Blocks */}
            <div className="space-y-10 text-gray-600 font-light leading-relaxed text-justify">
              {content.contentBlocks.map((block, idx) => (
                <div key={idx}>
                  {block.heading && (
                    <h3 className="font-luxury text-2xl text-luxury-dark mb-4 italic">{block.heading}</h3>
                  )}
                  <p>{block.text}</p>
                </div>
              ))}
            </div>

            {/* Leistungen inside Left Column */}
            <div className="mt-12 pt-12 border-t border-gray-100">
              <h3 className="font-luxury text-3xl text-luxury-dark mb-8 uppercase tracking-wider border-b border-gray-200 pb-4 text-[#53a8c7]">{content.leistungenHeading}</h3>
              <ul className="space-y-4">
                {content.leistungen.map((item, idx) => (
                  <li key={idx} className="flex gap-4 items-start text-gray-600 font-light text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#53a8c7] mt-2 shrink-0"></span>
                    <span className="leading-relaxed whitespace-pre-line">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

          </div>

          {/* Right Column (Sidebar) */}
          <div className="lg:col-span-5 space-y-12">

            {/* Badges */}
            <div className="flex flex-col gap-1 w-full font-semibold text-white text-center text-sm">
              {content.badges.map((badge, idx) => (
                <div key={idx} style={{ backgroundColor: badge.color }} className="py-2">{badge.label}</div>
              ))}
            </div>

            {/* Booking Card */}
            <div className="bg-[#FAF9F7] p-8 border border-gray-100 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-[#53a8c7] transform origin-left transition-transform duration-500 scale-x-0 group-hover:scale-x-100"></div>

              <Link
                to={content.bookingButtonLink}
                className="block w-full bg-[#53a8c7] hover:bg-[#4396b5] text-white text-center py-3 text-lg font-semibold transition-colors mb-8 shadow-md flex items-center justify-center gap-2"
              >
                {content.bookingButtonText}
              </Link>

              <div className="space-y-6 mb-8 text-sm">
                <div>
                  <div className="flex justify-between items-start gap-4">
                    <p className="text-luxury-dark font-medium">{content.priceLabel}</p>
                    <div className="text-right">
                      <p className="font-medium text-luxury-dark whitespace-nowrap text-lg">{content.price}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <p className="text-gray-600 font-light mb-4">{content.voraussetzungText}</p>
                </div>
              </div>

              <Link to={content.scheduleButtonLink} className="block w-full bg-[#4a5f68] hover:bg-[#3d4f57] text-white text-center py-3 font-semibold shadow-md transition-colors">
                {content.scheduleButtonText}
              </Link>
            </div>

            <GutscheinBox
              heading={content.gutscheinHeading}
              description={content.gutscheinDescription}
              headingClassName="text-[#53a8c7]"
            />

            {/* Impressions Gallery */}
            {/* data-live-*: the Joomla-style page editor keeps this gallery live (utils/liveBlocks.tsx) */}
            <div data-live-block="gallery" data-live-slug="savoye-tour" data-live-fallback={JSON.stringify(FALLBACK_GALLERY)}>
               <h3 className="font-luxury text-2xl text-[#53a8c7] mb-6 uppercase tracking-wider border-b border-gray-200 pb-4">
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

        <div id="comments" className="max-w-[1200px] mx-auto mt-12">
          <EventComments pageSlug="savoye-tour" />
        </div>
      </section>

    </div>
  );
};
