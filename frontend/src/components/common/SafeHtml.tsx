import DOMPurify from 'dompurify';
import type { MouseEvent } from 'react';
import { useLightbox } from './Lightbox';
import { removeUnpublishedBlocks } from '../../utils/blockVisibility';

// Renders CMS-authored rich text (event/location/organizer descriptions,
// legal pages) safely. These fields are stored as raw HTML and were
// previously rendered via dangerouslySetInnerHTML with no sanitization -
// stored XSS if that content, or the admin session that authored it, is
// ever compromised. Use this instead of dangerouslySetInnerHTML directly.
// Some CMS content (e.g. Gelände location articles) embeds Google Maps via
// <iframe>, which DOMPurify strips by default - allow it plus the specific
// attributes those embeds use, scoped narrowly so this stays safe for the
// other content types rendered through this same component.
export const SafeHtml = ({ html, className }: { html: string; className?: string }) => {
  const { open } = useLightbox();
  const clean = DOMPurify.sanitize(html || '', {
    ADD_TAGS: ['iframe'],
    ADD_ATTR: [
      'target', 'rel',
      'src', 'width', 'height', 'frameborder', 'allowfullscreen',
      'style', 'loading', 'referrerpolicy', 'tabindex', 'allow',
    ],
  });

  // Old Joomla's own internal article links (e.g. "index.php?option=
  // com_content&view=article&id=9&Itemid=702", the "Zur Kursbeschreibung"/
  // "Reisebeschreibung" links inside migrated event descriptions) used to
  // get rewritten to the OLD site's domain (still live at fs-hirondelle.de)
  // since this app has no /index.php route - but every one of these real
  // article ids (deep-scanned across every migrated event's description)
  // actually already has a real, equivalent page on THIS app. Route them
  // there instead of sending visitors away to the old site. Only a
  // genuinely never-migrated one (id=103, a one-off "Spanien-Tour bei
  // Niviuk" with no dedicated new page) still falls back to old's domain.
  const OLD_ARTICLE_ID_TO_PATH: Record<string, string> = {
    '8': '/ausbildung/schnupperkurs',
    '9': '/ausbildung/l-schein',
    '67': '/ausbildung/a-schein',
    '68': '/ausbildung/b-schein',
    '69': '/ausbildung/windenschein',
    '107': '/performance/sicherheitstraining',
    '114': '/performance/sicherheitstraining',
    '46': '/performance/refresher',
    '27': '/reisen/bassano-tour',
    '111': '/reisen/bergamo-tour',
    '109': '/reisen/brasilien-tour',
    '104': '/reisen/griechenland-tour',
    '96': '/reisen/griechenland-tour',
    '108': '/reisen/kolumbien-tour',
    '30': '/reisen/pfalz-tour',
    '25': '/reisen/savoye-tour',
    '110': '/reisen/slowenien-tour',
    '28': '/reisen/suedafrika-tour',
    '95': '/reisen/vogesen-tour',
    '21': '/reisen', // old's own "view=category" link (HF Vogesen 1/2), not an article id
  };

  // Some migrated CMS content also has anchor hrefs saved without a
  // protocol at all, e.g. "service.dhv.de" instead of "https://service.dhv.de".
  // Left as-is, the browser treats it as a path relative to the current SPA
  // route, and react-router's catch-all ":slug" route (App.tsx) swallows the
  // click into one of the app's own fixed pages instead of the real target.
  const withFixedLinks = (() => {
    const container = document.createElement('div');
    container.innerHTML = clean;
    // Blocks switched off or scheduled in the page editor (see blockVisibility.ts).
    removeUnpublishedBlocks(container);
    container.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href') || '';
      const articleMatch = /^index\.php\?.*\bid=(\d+)/i.exec(href);
      if (articleMatch && OLD_ARTICLE_ID_TO_PATH[articleMatch[1]]) {
        a.setAttribute('href', OLD_ARTICLE_ID_TO_PATH[articleMatch[1]]);
      } else if (/^index\.php\b/i.test(href)) {
        a.setAttribute('href', `https://fs-hirondelle.de/${href}`);
      } else if (href && !/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(href)) {
        a.setAttribute('href', `https://${href}`);
      }
      if (/^https?:\/\//i.test(a.getAttribute('href') || '')) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      }
    });
    return container.innerHTML;
  })();

  // Old site's mediabox plugin opened any content image full-size on
  // click - mirrored here via event delegation (one listener for however
  // many images this content happens to contain) instead of per-image.
  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // An image inside a link (a linked card or button) follows the link.
    if (target.tagName === 'IMG' && !target.closest('a')) {
      const img = target as HTMLImageElement;
      open(img.currentSrc || img.src, img.alt);
    }
  };

  return (
    <div
      className={`${className ?? ''} [&_img]:cursor-zoom-in`}
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: withFixedLinks }}
    />
  );
};
