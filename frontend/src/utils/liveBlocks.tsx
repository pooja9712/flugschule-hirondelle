import { useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { sanitizeHtml } from '../components/common/SafeHtml';
import { Search } from 'lucide-react';
import { EventComments } from '../components/common/EventComments';
import { useLightbox } from '../components/common/Lightbox';
import { usePageGallery } from '../hooks/usePageGallery';

// Parts of a page that are live (loaded/submitted by the app) or driven by a
// script can't be copied into the Joomla-style page editor as plain HTML.
// Like a module placeholder in Joomla they are kept as:
// - Live-Elemente: an empty placeholder <div data-live-block="..."> that the
//   editor shows as a grey box (move/copy/delete like any element) and the
//   public page renders as the real component (LiveHtml).
//   Currently: "comments" = EventComments (tour pages), "gallery" = the
//   sidebar "Impressionen" gallery managed in Admin > Galerie (heading +
//   grid, kept out of the editor entirely).
// - FAQ accordion items: turned into editable <details>/<summary> items,
//   which open and close on the site without any script.

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// Applied to a copy of a rendered page before it goes into the editor.
export const prepareImportedPage = (root: HTMLElement) => {
  const doc = root.ownerDocument;
  root.querySelectorAll<HTMLElement>('[data-live-block]').forEach((el) => {
    const ph = doc.createElement('div');
    ph.setAttribute('data-live-block', el.getAttribute('data-live-block') || '');
    // A gallery keeps its heading text/style from the page it came from.
    const heading = el.getAttribute('data-live-block') === 'gallery' ? el.querySelector('h1,h2,h3,h4') : null;
    if (heading) {
      ph.setAttribute('data-live-heading', heading.textContent?.trim() || '');
      ph.setAttribute('data-live-heading-class', heading.getAttribute('class') || '');
    }
    ['data-live-slug', 'data-live-event', 'data-live-fallback'].forEach((a) => {
      const v = el.getAttribute(a);
      if (v) ph.setAttribute(a, v);
    });
    ph.setAttribute('contenteditable', 'false');
    el.replaceWith(ph);
  });
  root.querySelectorAll<HTMLElement>('[data-faq-item]').forEach((item) => {
    const question = item.querySelector('[data-faq-question]')?.textContent?.trim() || '';
    const answer = item.querySelector('[data-faq-answer]')?.innerHTML || '';
    const details = doc.createElement('details');
    details.className = 'faq-item border-b border-gray-200';
    details.innerHTML = `<summary class="font-luxury text-lg md:text-xl text-luxury-dark">${esc(question)}</summary>`
      + `<div class="text-gray-600 font-light leading-relaxed pb-6 pr-8">${answer}</div>`;
    item.replaceWith(details);
  });
};

// The sidebar gallery, same markup as on the pages themselves (e.g.
// BassanoTour.tsx): images from Admin > Galerie, the page's own photos as
// fallback, lightbox on click.
const LiveGallery = ({ slug, fallback, heading, headingClass }: { slug: string; fallback: string[]; heading: string; headingClass: string }) => {
  const { openGallery } = useLightbox();
  const images = usePageGallery(slug, fallback);
  if (!images.length) return null;
  return (
    <>
      {heading && <h3 className={headingClass}>{heading}</h3>}
      <div className="grid grid-cols-3 gap-2">
        {images.map((img, index) => (
          <div
            key={img}
            className="relative aspect-square overflow-hidden group cursor-zoom-in bg-gray-100"
            onClick={() => openGallery(images.map((g) => ({ src: g, alt: 'Impression' })), index)}
          >
            <img src={img} alt={`Impression ${index + 1}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Search className="w-5 h-5 text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

const parseList = (v: string | null): string[] => {
  try {
    const list = JSON.parse(v || '[]');
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

const renderLive = (el: HTMLElement): ReactNode => {
  if (el.getAttribute('data-live-block') === 'gallery') {
    return (
      <LiveGallery
        slug={el.getAttribute('data-live-slug') || ''}
        fallback={parseList(el.getAttribute('data-live-fallback'))}
        heading={el.getAttribute('data-live-heading') || ''}
        headingClass={el.getAttribute('data-live-heading-class') || ''}
      />
    );
  }
  if (el.getAttribute('data-live-block') === 'comments') {
    return <EventComments pageSlug={el.getAttribute('data-live-slug') || undefined} eventId={el.getAttribute('data-live-event') || undefined} />;
  }
  return null;
};

// Public rendering of an editor body. The HTML (sanitized exactly like
// SafeHtml) is written into the container once per html change, outside
// React's control, so re-renders (e.g. the lightbox opening) can never
// replace the placeholder nodes; each live-block placeholder is then filled
// with its real component through a portal.
export const LiveHtml = ({ html, className }: { html: string; className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [slots, setSlots] = useState<HTMLElement[]>([]);
  const { open } = useLightbox();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = sanitizeHtml(html);
    setSlots(Array.from(el.querySelectorAll<HTMLElement>('[data-live-block]')));
  }, [html]);
  // Same as SafeHtml: a content image (not inside a link, not part of a
  // live block like the gallery) opens full-size.
  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG' && !target.closest('a') && !target.closest('[data-live-block]')) {
      const img = target as HTMLImageElement;
      open(img.currentSrc || img.src, img.alt);
    }
  };
  return (
    <>
      <div ref={ref} className={`${className ?? ''} [&_img]:cursor-zoom-in`} onClick={handleClick} />
      {slots.map((slot, i) => createPortal(renderLive(slot), slot, `live-${i}`))}
    </>
  );
};

// Editor canvas styles for the placeholders and FAQ items.
export const LIVE_BLOCK_EDITOR_CSS =
  '[data-live-block]{display:block;min-height:56px;margin:16px 0;padding:16px;background:#f1f5f9;border:2px dashed #94a3b8;border-radius:4px;color:#475569;font:600 14px "Segoe UI",Arial,sans-serif;}'
  + '[data-live-block="gallery"]::before{content:"Live-Element: Galerie \\201E" attr(data-live-heading) "\\201C  \\2013  wird unter Admin > Galerie verwaltet";}'
  + '[data-live-block="comments"]::before{content:"Live-Element: Kommentare & Bewertungen \\2013  erscheint hier automatisch auf der Webseite";}'
  + 'details.faq-item{border-bottom:1px solid #e5e7eb;padding:4px 0;}details.faq-item>summary{font-weight:600;cursor:pointer;padding:8px 0;}';
