import { useMemo, useState } from 'react';
import { Editor } from '@tinymce/tinymce-react';
import { Box, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import CodeIcon from '@mui/icons-material/Code';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { ELEMENT_CLIPBOARD_CSS, registerElementClipboard } from './editorElementClipboard';
import { openMediaBrowser, uploadEditorFile as uploadFile } from './editorMediaBrowser';
import { COLOR_MAP, loadPageLinkList, registerJoomlaButtons } from './editorJoomlaButtons';

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
}

export const RichHtmlInput = ({
  label,
  value,
  onChange,
  helperText,
  minRows = 6,
  defaultHtmlMode = false,
  bodyClass = '',
  contentMaxWidth,
}: RichHtmlInputProps) => {
  const [htmlMode, setHtmlMode] = useState(defaultHtmlMode);
  const siteStyles = useMemo(collectSiteStyles, []);

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, gap: 2 }}>
        <Typography variant="subtitle2" sx={{ color: '#666' }}>{label}</Typography>
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
                edit: { title: 'Edit', items: 'undo redo | clipboardCut clipboardCopy clipboardPaste pastetext | selectParent duplicateBlock moveElementUp moveElementDown deleteElement | elementProps | selectall | searchreplace' },
                insert: { title: 'Insert', items: 'image link media hbMediaImage hbMediaFile codesample inserttable | hbTemplatesMenu | charmap emoticons hr | pagebreak hbReadmore nonbreaking anchor | insertdatetime accordion' },
              },
              contextmenu: 'clipboardCut clipboardCopy clipboardPaste | selectParent duplicateBlock moveElementUp moveElementDown deleteElement | elementProps | link image table',
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
                'clipboardCopy clipboardCut clipboardPaste selectParent duplicateBlock | elementProps moveElementUp moveElementDown deleteElement | ' +
                'blocks fontfamily fontsize | searchreplace | bullist numlist | outdent indent | undo redo | ' +
                'link unlink anchor image media | code | forecolor backcolor | fullscreen | table accordion | ' +
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
              // Keep every tag/attribute exactly as written, so custom layouts
              // (Tailwind classes, inline styles, embeds) survive a round trip.
              valid_elements: '*[*]',
              extended_valid_elements: '*[*]',
              valid_children: '+body[style|link],+a[div|h1|h2|h3|h4|h5|h6|p|span|img|ul|ol|li|section]',
              convert_urls: false,
              relative_urls: false,
              remove_script_host: false,
              content_css: siteStyles.links,
              body_class: bodyClass,
              content_style:
                siteStyles.inline +
                `\nbody{margin:0 auto;padding:24px;background:#fff;${contentMaxWidth ? `max-width:${contentMaxWidth}px;` : ''}}\n` +
                ELEMENT_CLIPBOARD_CSS,
              setup: (editor) => {
                // Copy/cut/paste whole elements (boxes, images, text), plus
                // "select parent" and "duplicate" - see editorElementClipboard.ts.
                registerElementClipboard(editor);
                // Joomla's "CMS-Inhalt" and "Vorlagen" buttons.
                registerJoomlaButtons(editor);

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
