import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { SafeHtml } from '../components/common/SafeHtml';
import { EventComments } from '../components/common/EventComments';

// Parts of a page that are live (loaded/submitted by the app) or driven by a
// script can't be copied into the Joomla-style page editor as plain HTML.
// Like a module placeholder in Joomla they are kept as:
// - Live-Elemente: an empty placeholder <div data-live-block="..."> that the
//   editor shows as a grey box (move/copy/delete like any element) and the
//   public page renders as the real component (LiveHtml).
//   Currently: "comments" = EventComments (tour pages).
// - FAQ accordion items: turned into editable <details>/<summary> items,
//   which open and close on the site without any script.

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// Applied to a copy of a rendered page before it goes into the editor.
export const prepareImportedPage = (root: HTMLElement) => {
  const doc = root.ownerDocument;
  root.querySelectorAll<HTMLElement>('[data-live-block]').forEach((el) => {
    const ph = doc.createElement('div');
    ph.setAttribute('data-live-block', el.getAttribute('data-live-block') || '');
    ['data-live-slug', 'data-live-event'].forEach((a) => {
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

const renderLive = (el: HTMLElement): ReactNode => {
  if (el.getAttribute('data-live-block') === 'comments') {
    return <EventComments pageSlug={el.getAttribute('data-live-slug') || undefined} eventId={el.getAttribute('data-live-event') || undefined} />;
  }
  return null;
};

// Public rendering of an editor body: the whole HTML via SafeHtml (so the
// page structure stays intact), with each live-block placeholder filled by
// its real component through a portal.
export const LiveHtml = ({ html, className }: { html: string; className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [slots, setSlots] = useState<HTMLElement[]>([]);
  // Same element instance across renders, so filling the slots never makes
  // React touch the HTML again (that would replace the placeholder nodes).
  const content = useMemo(() => <SafeHtml html={html} className={className} />, [html, className]);
  useLayoutEffect(() => {
    setSlots(Array.from(ref.current?.querySelectorAll<HTMLElement>('[data-live-block]') || [])
      // not the real component's own root, rendered inside its placeholder
      .filter((el) => !el.parentElement?.closest('[data-live-block]')));
  }, [html]);
  return (
    <div ref={ref}>
      {content}
      {slots.map((el, i) => createPortal(renderLive(el), el, `live-${i}`))}
    </div>
  );
};

// Editor canvas styles for the placeholders and FAQ items.
export const LIVE_BLOCK_EDITOR_CSS =
  '[data-live-block]{display:block;min-height:56px;margin:16px 0;padding:16px;background:#f1f5f9;border:2px dashed #94a3b8;border-radius:4px;color:#475569;font:600 14px "Segoe UI",Arial,sans-serif;}'
  + '[data-live-block="comments"]::before{content:"Live-Element: Kommentare & Bewertungen \\2013  erscheint hier automatisch auf der Webseite";}'
  + 'details.faq-item{border-bottom:1px solid #e5e7eb;padding:4px 0;}details.faq-item>summary{font-weight:600;cursor:pointer;padding:8px 0;}';
