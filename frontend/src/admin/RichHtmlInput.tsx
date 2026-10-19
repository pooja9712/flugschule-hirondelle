import { useMemo, useState } from 'react';
import { Editor } from '@tinymce/tinymce-react';
import type { Editor as TinyEditor } from 'tinymce';
import { Box, FormControlLabel, Switch, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import CodeIcon from '@mui/icons-material/Code';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { ELEMENT_CLIPBOARD_CSS, registerElementClipboard } from './editorElementClipboard';
import { openMediaBrowser, uploadEditorFile as uploadFile } from './editorMediaBrowser';
import { COLOR_MAP, TABLE_COLOR_MAP, loadPageLinkList, registerJoomlaButtons } from './editorJoomlaButtons';
import { LIVE_BLOCK_EDITOR_CSS } from '../utils/liveBlocks';

// The editor canvas is an iframe, so it doesn't see the site's stylesheet on
// its own. Hand it whatever the admin document has loaded: Vite injects the
// compiled CSS as <style data-vite-dev-id> tags in dev and as <link> tags in
// a production build. Content then looks the same as on the public page.
const collectSiteStyles = () => {
  const inline = Array.from(document.querySelectorAll<HTMLStyleElement>('style[data-vite-dev-id]'))
    .map((s) => s.textContent || '')
    .join('\n');
  const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
    .map((l) => l.href)
    .filter((href) => href.startsWith(window.location.origin) || href.includes('fonts.googleapis.com'));
  return { inline, links };
};

const FONT_FAMILIES = [
  'PT Sans=PT Sans,sans-serif',
  'PT Sans Narrow=PT Sans Narrow,sans-serif',
  'Jost=Jost,sans-serif',
  'Cormorant Garamond=Cormorant Garamond,serif',
  'Arial=arial,helvetica,sans-serif',
  'Georgia=georgia,palatino,serif',
  'Helvetica=helvetica,arial,sans-serif',
  'Tahoma=tahoma,arial,helvetica,sans-serif',
  'Times New Roman=times new roman,times,serif',
  'Verdana=verdana,geneva,sans-serif',
  'Courier New=courier new,courier,monospace',
].join('; ');

// Full Joomla-style TinyMCE editor (menu bar + toolbar whose overflow opens
// behind the "..." button) with a separate raw HTML source view.
interface RichHtmlInputProps {
  label: string;
  value: string;
  onChange: (html: string) => void;
  helperText?: string;
  minRows?: number;
  defaultHtmlMode?: boolean;
  // Class(es) the public page puts around this HTML, so headings/paragraphs
  // pick up the same rules inside the editor (e.g. "home-body-content").
  bodyClass?: string;
  // Width of the public page's content column, mirrored in the editor.
  contentMaxWidth?: number;
  // Joomla-style "content only" canvas: the editor shows the plain content
  // (headings, texts, links, images, tables) with block outlines instead of
  // the public page's design - the frontend CSS styles it on the site.
  // A "Design-Vorschau" switch still shows the designed view on demand.
  contentOnly?: boolean;
  // Joomla-style show/hide + publish dates per element (blockVisibility.ts).
  blockVisibility?: boolean;
}

// The site's web fonts (index.html / index.css), loaded into the content-only
// canvas too so every entry of the font dropdown actually shows.
const SITE_FONT_URLS = [
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600&family=Jost:wght@300;400;500;600&display=swap',
  'https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&family=PT+Sans+Narrow:wght@400;700&display=swap',
];

// Canvas styles for contentOnly mode - plain content like Joomla's editor
// (headings, texts, buttons/links, images, tables), no site CSS, no layout
// boxes or labels. Links/buttons show their target in the element toolbar
// when clicked (editorElementClipboard.ts).
const CONTENT_ONLY_CSS = `
body{font-family:"Segoe UI",Arial,sans-serif;font-size:15px;line-height:1.6;color:#222;background:#fff;margin:0;padding:16px 20px;}
h1,h2,h3,h4,h5,h6{font-weight:700;line-height:1.3;margin:.6em 0 .3em;color:#2a5db0}
h1{font-size:28px}h2{font-size:24px}h3{font-size:20px}h4{font-size:17px}h5,h6{font-size:15px}
p{margin:0 0 .6em}
a{color:#1a73e8;text-decoration:underline}
/* A link wrapping a whole card (heading + image + text): plain content. */
a:has(div,img,h1,h2,h3,h4,p){display:block;color:inherit;text-decoration:none}
ul,ol{padding-left:1.6em;margin:0 0 .6em}
img{max-width:100%;max-height:320px;height:auto;display:block;margin:6px 0}
table{border-collapse:collapse;width:100%;margin:0 0 1em}td,th{padding:8px 10px;vertical-align:middle}
/* Real cell borders (over TinyMCE's dashed guides) unless a cell has its own. */
td:not([style*="border"]),th:not([style*="border"]){border:1px solid #cbd5e1!important}
th{font-weight:700;text-align:left}
td a,th a{color:inherit;font-weight:700}
/* The few text utilities the content relies on (site CSS isn't loaded here). */
.text-right{text-align:right}.text-center{text-align:center}.text-left{text-align:left}
.font-bold,.font-semibold{font-weight:700}.italic{font-style:italic}.uppercase{text-transform:uppercase}
/* Videos / maps: 16:9, full width up to 720px (the responsive YouTube box sizes itself). */
.mce-preview-object{display:block!important;max-width:720px;margin:8px 0}
iframe{max-width:100%}
:not([data-hb-video])>iframe,:not([data-hb-video])>.mce-preview-object>iframe{width:100%!important;height:auto!important;aspect-ratio:16/9;border:0}
/* Elements that only hold a background image: show the image itself. */
[style*="background-image"]{display:block!important;min-height:180px;max-width:480px;background-size:cover!important;background-position:center!important;margin:6px 0}
/* Empty decoration boxes (overlays, frames) have nothing to edit - hidden
   (marked by registerEmptyDecorationMarker below). */
[data-hb-empty]{display:none!important}
`;

const EMPTY_ATTR = 'data-hb-empty';

// Marks boxes with nothing to edit (no text, image, table... - the cards'
// gradient overlays and frames) so the content-only canvas can hide them.
// Runs only when content is loaded, never while typing, so a block the user
// is emptying doesn't vanish under the cursor. The marker never reaches the
// saved HTML (PreProcess).
const registerEmptyDecorationMarker = (editor: TinyEditor) => {
  const mark = () => {
    editor.getBody().querySelectorAll<HTMLElement>('div').forEach((d) => {
      const empty = !(d.textContent || '').trim()
        && !d.querySelector('img,iframe,video,audio,table,hr,input,svg,[style*="background-image"]')
        && !d.style.backgroundImage
        && !d.hasAttribute('data-live-block');
      if (empty) d.setAttribute(EMPTY_ATTR, '1');
      else d.removeAttribute(EMPTY_ATTR);
    });
  };
  editor.on('SetContent', mark);
  editor.on('PreProcess', (e: { node: Element }) => {
    e.node.querySelectorAll(`[${EMPTY_ATTR}]`).forEach((n) => n.removeAttribute(EMPTY_ATTR));
  });
};

export const RichHtmlInput = ({
  label,
  value,
  onChange,
  helperText,
  minRows = 6,
  defaultHtmlMode = false,
  bodyClass = '',
  contentMaxWidth,
  contentOnly = false,
  blockVisibility = false,
}: RichHtmlInputProps) => {
  const [htmlMode, setHtmlMode] = useState(defaultHtmlMode);
  const [designPreview, setDesignPreview] = useState(false);
  const siteStyles = useMemo(collectSiteStyles, []);
  const plain = contentOnly && !designPreview;

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, gap: 2 }}>
        <Typography variant="subtitle2" sx={{ color: '#666' }}>{label}</Typography>
        <Box sx={{ flexGrow: 1 }} />
        {contentOnly && !htmlMode && (
          <FormControlLabel
            control={<Switch size="small" checked={designPreview} onChange={(e) => setDesignPreview(e.target.checked)} />}
            label={<Typography variant="body2">Design-Vorschau</Typography>}
          />
        )}
        <ToggleButtonGroup size="small" exclusive value={htmlMode ? 'html' : 'visual'} onChange={(_, v) => v && setHtmlMode(v === 'html')}>
          <ToggleButton value="visual" sx={{ gap: 0.5, textTransform: 'none' }}><VisibilityIcon fontSize="small" />Editor</ToggleButton>
          <ToggleButton value="html" sx={{ gap: 0.5, textTransform: 'none' }}><CodeIcon fontSize="small" />HTML</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {htmlMode ? (
        <TextField
          fullWidth
          multiline
          minRows={minRows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          sx={{ '& textarea': { fontFamily: 'monospace', fontSize: 13 } }}
          helperText={helperText || 'Rohes HTML/CSS - z.B. <p style="color:#c00; font-size:18px" class="meine-klasse">Text</p>'}
        />
      ) : (
        <Box sx={{ border: '1px solid #c4c4c4', borderRadius: 1, overflow: 'hidden', '& .tox-tinymce': { border: 'none', borderRadius: 0 } }}>
          <Editor
            // Content-only <-> design view needs a fresh editor (canvas CSS is set at init).
            key={plain ? 'plain' : 'design'}
            licenseKey="gpl"
            tinymceScriptSrc="/tinymce/tinymce.min.js"
            value={value}
            onEditorChange={(html) => onChange(html)}
            init={{
              height: Math.max(minRows * 40, 420),
              resize: true,
              branding: false,
              promotion: false,
              menubar: 'edit insert view format table tools help',
              // Edit menu / right-click menu use the element clipboard instead
              // of TinyMCE's own paste, which can only tell the user to press Ctrl+V.
              menu: {
                edit: { title: 'Edit', items: 'undo redo | clipboardCut clipboardCopy clipboardPaste pastetext | selectParent duplicateBlock moveElementUp moveElementDown deleteElement | elementProps toggleElementHidden | selectall | searchreplace' },
                insert: { title: 'Insert', items: 'image link media hbYouTube hbMediaImage hbMediaFile codesample inserttable | hbTemplatesMenu | charmap emoticons hr | pagebreak hbReadmore nonbreaking anchor | insertdatetime accordion' },
              },
              contextmenu: 'clipboardCut clipboardCopy clipboardPaste | selectParent duplicateBlock moveElementUp moveElementDown deleteElement | elementProps toggleElementHidden | link image table',
              // All tools visible: the "..." drawer is opened on load (below)
              // and pushes the content down instead of covering it.
              toolbar_mode: 'sliding',
              toolbar_sticky: true,
              plugins: [
                'accordion', 'advlist', 'anchor', 'autolink', 'charmap', 'code', 'codesample',
                'directionality', 'emoticons', 'fullscreen', 'help', 'image', 'insertdatetime',
                'link', 'lists', 'media', 'nonbreaking', 'pagebreak', 'preview', 'quickbars',
                'searchreplace', 'table', 'visualblocks', 'visualchars', 'wordcount',
              ],
              toolbar:
                'bold italic underline strikethrough | alignleft aligncenter alignright alignjustify | lineheight | styles | ' +
                'clipboardCopy clipboardCut clipboardPaste selectParent duplicateBlock | elementProps toggleElementHidden moveElementUp moveElementDown deleteElement | ' +
                'blocks fontfamily fontsize | searchreplace | bullist numlist | outdent indent | undo redo | ' +
                'link unlink anchor image media hbYouTube | code | forecolor backcolor | fullscreen | table accordion | ' +
                'subscript superscript | charmap emoticons hr | ltr rtl | pastetext | ' +
                'visualchars visualblocks nonbreaking blockquote hbTemplates pagebreak | customPrint preview codesample insertdatetime removeformat | hbCmsContent',
              quickbars_selection_toolbar: 'bold italic underline | forecolor | quicklink h2 h3 blockquote',
              quickbars_insert_toolbar: false,
              font_family_formats: FONT_FAMILIES,
              font_size_formats: '10px 12px 14px 15px 16px 18px 20px 24px 28px 32px 36px 48px 60px',
              line_height_formats: '1 1.15 1.3 1.5 1.75 2 2.5 3',
              color_map: COLOR_MAP,
              color_cols: 8,
              custom_colors: true,
              // Joomla's link dialog offers the site's own pages as targets.
              link_list: loadPageLinkList,
              image_advtab: true,
              image_caption: true,
              image_title: true,
              automatic_uploads: true,
              file_picker_types: 'image media file',
              // Like Joomla's image button: pick from the media folders
              // (Admin > Medien) or upload a new file there.
              file_picker_callback: (callback, _value, meta) => {
                const imagesOnly = meta.filetype === 'image';
                const accept = imagesOnly ? 'image/*' : meta.filetype === 'media' ? 'video/*,audio/*' : '*/*';
                openMediaBrowser({ imagesOnly, accept }).then((url) => {
                  if (!url) return;
                  const name = decodeURIComponent(url.split('/').pop() || url);
                  callback(url, { title: name, text: name });
                });
              },
              images_upload_handler: (blobInfo) =>
                uploadFile(blobInfo.blob(), blobInfo.filename()),
              table_default_attributes: { border: '1' },
              table_default_styles: { 'border-collapse': 'collapse', width: '100%' },
              // Clicking into a table: Joomla's table toolbar incl. cell colours
              // from the site palette.
              table_toolbar: 'tableprops tabledelete | tableinsertrowbefore tableinsertrowafter tabledeleterow | tableinsertcolbefore tableinsertcolafter tabledeletecol | tablecellbackgroundcolor tablecellbordercolor | tablecellprops tablerowprops tablemergecells tablesplitcells',
              table_background_color_map: TABLE_COLOR_MAP,
              table_border_color_map: TABLE_COLOR_MAP,
              table_advtab: true,
              table_cell_advtab: true,
              table_row_advtab: true,
              // Keep every tag/attribute exactly as written, so custom layouts
              // (Tailwind classes, inline styles, embeds) survive a round trip.
              // TinyMCE would add sandbox="" to every iframe outside its short
              // allow-list (youtube-nocookie, Google Maps...), which blacks out
              // the player here and breaks the embed on the site once saved.
              // Content is admin-authored and sanitized again on output.
              sandbox_iframes: false,
              valid_elements: '*[*]',
              extended_valid_elements: '*[*]',
              valid_children: '+body[style|link],+a[div|h1|h2|h3|h4|h5|h6|p|span|img|ul|ol|li|section]',
              convert_urls: false,
              relative_urls: false,
              remove_script_host: false,
              content_css: plain ? ['default', ...SITE_FONT_URLS] : siteStyles.links,
              body_class: plain ? '' : bodyClass,
              content_style: plain
                ? CONTENT_ONLY_CSS + ELEMENT_CLIPBOARD_CSS + LIVE_BLOCK_EDITOR_CSS
                : siteStyles.inline +
                  `\nbody{margin:0 auto;padding:24px;background:#fff;${contentMaxWidth ? `max-width:${contentMaxWidth}px;` : ''}}\n` +
                  ELEMENT_CLIPBOARD_CSS + LIVE_BLOCK_EDITOR_CSS,
              setup: (editor) => {
                // Copy/cut/paste whole elements (boxes, images, text), plus
                // "select parent" and "duplicate" - see editorElementClipboard.ts.
                registerElementClipboard(editor, { blockVisibility });
                // Joomla's "CMS-Inhalt" and "Vorlagen" buttons.
                registerJoomlaButtons(editor);
                editor.on('init', () => {
                  if (!editor.queryCommandState('ToggleToolbarDrawer')) editor.execCommand('ToggleToolbarDrawer');
                });
                if (plain) registerEmptyDecorationMarker(editor);

                // The open-source TinyMCE build has no print button.
                editor.ui.registry.addButton('customPrint', {
                  icon: 'print',
                  tooltip: 'Drucken',
                  onAction: () => {
                    const printWindow = window.open('', '_blank', 'width=900,height=700');
                    if (!printWindow) return;
                    printWindow.document.write(`<!DOCTYPE html><html><head><title>${label || 'Inhalt'}</title>
                      <style>body{font-family:sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem;line-height:1.6;}
                      img{max-width:100%;} table{border-collapse:collapse;width:100%;} td,th{border:1px solid #ccc;padding:6px;}</style>
                      </head><body>${editor.getContent()}</body></html>`);
                    printWindow.document.close();
                    printWindow.focus();
                    printWindow.print();
                  },
                });
              },
            }}
          />
        </Box>
      )}
      {!htmlMode && helperText && (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
          {helperText}
        </Typography>
      )}
    </Box>
  );
};
