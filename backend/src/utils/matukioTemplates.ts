import crypto from 'crypto';
import { resolveBookingCustomer } from './bookingCustomer';

// Old's real MatukioHelperBooking::getBookingId() - strtoupper(substr(sha1($id), 0, 10)) -
// a SHA1 hash of the booking's own id, not a slice of the id itself (there's
// no relation between the two beyond both being 10 uppercase hex chars).
export function matukioBookingNumber(id: string): string {
  return crypto.createHash('sha1').update(String(id)).digest('hex').slice(0, 10).toUpperCase();
}

// Old's real #__matukio_currencies row for this site (queried directly from
// the restored production DB, d03dbe51.hiron_matukio_currencies): sign "€",
// position=1 (left of the amount), decimalsign "." - MatukioHelperEvents::
// getFormatedCurrency() then does `$sign . " " . number_format(...)`.
function matukioCurrency(value: number): string {
  return `€ ${value.toFixed(2)}`;
}

// Old's real site config (hiron_extensions.params for COM_MATUKIO):
// date_format_without_time = "Y-m-d" - used for both MAT_DATE (today, at
// print time) and MAT_INVOICE_DATE (the booking's own fixed bookingdate).
function matukioDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Old Matukio's own real booking-status labels (administrator/components/
// com_matukio/helpers/booking.php's getBookingStatusName(), cross-checked
// against actual language strings) - COMPLETED here stands in for old's
// DELETED status, per the same mapping migrate_old_data.ts already uses.
// Single source of truth shared with bookings.routes.ts's CSV export.
export const OLD_STYLE_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Schwebend',
  CONFIRMED: 'Teilnahme gesichert',
  WAITLIST: 'Buchung auf Warteliste',
  COMPLETED: 'Gelöscht',
};

// Old's real export_signaturelist/export_participantslist templates
// (hiron_matukio_templates id=5/6, verified against the restored
// production DB) are each TWO separate pieces - a header printed once
// (value_text, the event's own info) and a row template repeated once per
// booking (value) - not one flat block. This app's admin-editable
// listViews.* config mirrors that split (...Header/...Row), rendered
// through the real MAT_* token engine instead of being dumped as literal
// unsubstituted text alongside a separate hardcoded table. Shared source
// of truth for both the seeded admin-editable default
// (templatesConfig.routes.ts) and bookings.routes.ts's own fallback.
export const DEFAULT_SIGNATURE_LIST_HEADER = `<table class="mat-header-table"><tbody>
<tr><td style="width:160px"><strong>Nr.:</strong></td><td>MAT_EVENT_NUMBER</td></tr>
<tr><td><strong>Veranstaltung:</strong></td><td>MAT_EVENT_TITLE</td></tr>
<tr><td><strong>Beginn:</strong></td><td>MAT_EVENT_BEGIN</td></tr>
<tr><td><strong>Ende:</strong></td><td>MAT_EVENT_END</td></tr>
<tr><td><strong>Gebühren:</strong></td><td>MAT_EVENT_FEES</td></tr>
</tbody></table>`;

export const DEFAULT_SIGNATURE_LIST_ROW = `<p>MAT_NR. MAT_BOOKING_NUMBER &nbsp; MAT_BOOKING_FIRSTNAME MAT_BOOKING_LASTNAME &nbsp; MAT_SIGN</p>`;

// Participant list's real header uses "Anrede" ("salutation") as the label
// for the event title row - a genuine mismatched/reused translation key in
// old's own real template, not a mistake to silently "fix" here.
export const DEFAULT_PARTICIPANT_LIST_HEADER = `<table class="mat-header-table"><tbody>
<tr><td style="width:160px"><strong>Nr.:</strong></td><td>MAT_EVENT_NUMBER</td></tr>
<tr><td><strong>Anrede:</strong></td><td>MAT_EVENT_TITLE</td></tr>
<tr><td><strong>Beginn:</strong></td><td>MAT_EVENT_BEGIN</td></tr>
<tr><td><strong>Ende:</strong></td><td>MAT_EVENT_END</td></tr>
<tr><td><strong>Gebühren:</strong></td><td>MAT_EVENT_FEES</td></tr>
</tbody></table>`;

export const DEFAULT_PARTICIPANT_LIST_ROW = `<table class="mat-row-table"><tbody>
<tr><td style="width:160px"><strong>Name:</strong></td><td>MAT_BOOKING_NAME</td></tr>
<tr><td><strong>E-Mail:</strong></td><td>MAT_BOOKING_EMAIL</td></tr>
<tr><td><strong>Buchungsnummer:</strong></td><td>MAT_BOOKING_NUMBER</td></tr>
<tr><td><strong>Status:</strong></td><td>MAT_BOOKING_STATUS</td></tr>
<tr><td><strong>Gebuchte Plätze:</strong></td><td>MAT_BOOKING_BOOKEDNR</td></tr>
<tr><td><strong>Gebühren:</strong></td><td>MAT_BOOKING_FEES_STATUS</td></tr>
<tr><td colspan="2" style="text-align:center">MAT_BOOKING_QRCODE_ID</td></tr>
</tbody></table>`;

// Bare MAT_* token substitution, matching the exact convention documented in
// the admin's TemplatesBuilder (listViews/certificates/tickets/csvXml tabs) -
// no curly braces, unlike the {TOKEN} style used by the simpler emails.* templates.
export function buildBookingPlaceholders(booking: any, nr?: number): Record<string, string> {
  const { name, email } = resolveBookingCustomer(booking);
  const details = (booking.customerDetails as any) || {};
  const seats = (booking.items || []).reduce((s: number, i: any) => s + i.quantity, 0);
  const [firstName, ...rest] = name.split(' ');

  const netto = booking.priceNet != null ? Number(booking.priceNet) : Number(booking.totalPrice ?? 0);
  const tax = booking.priceTax != null ? Number(booking.priceTax) : 0;
  const brutto = Number(booking.totalPrice ?? 0);
  const eventAllDetailsText = booking.event
    ? `${booking.event.title}\n${new Date(booking.event.startDate).toLocaleString('de-DE')}${booking.event.endDate ? ' - ' + new Date(booking.event.endDate).toLocaleString('de-DE') : ''}`
    : '';

  const selectedExtras = Array.isArray(details.selectedExtras) ? details.selectedExtras : [];
  const extraOptionsText = selectedExtras.length === 0
    ? 'Keine Optionen gebucht'
    : selectedExtras.map((e: any) => `${e.title} (${Number(e.value || 0).toFixed(2)} €${e.perPlace ? ' pro Platz' : ''})`).join('; ');

  const csvBookingDetails = (booking.items || [])
    .map((i: any) => `${i.quantity}x ${i.ticket?.name || ''}`)
    .join(', ');

  return {
    MAT_BOOKING_NAME: name,
    MAT_BOOKING_EMAIL: email || '',
    MAT_BOOKING_STATUS: OLD_STYLE_STATUS_LABEL[booking.status] || booking.status,
    // Old's real payment_status column (always 'P' - see the CSV export
    // fix's own comment on this exact same historical constant).
    MAT_BOOKING_PAYMENT_STATUS: 'P',
    MAT_BOOKING_FIRSTNAME: details.firstName || firstName || '',
    MAT_BOOKING_LASTNAME: details.lastName || rest.join(' ') || '',
    MAT_BOOKING_TITLE: details.salutation && details.salutation !== 'Bitte wählen' ? details.salutation : '',
    MAT_BOOKING_COUNTRY: details.country || '',
    MAT_BOOKING_STREET: details.street || '',
    MAT_BOOKING_ZIP: details.zip || '',
    MAT_BOOKING_CITY: details.city || '',
    MAT_BOOKING_PHONE: details.phone || '',
    MAT_BOOKING_MOBILE: details.phone || '',
    MAT_BOOKING_COMPANY: details.company || '',
    MAT_BOOKING_COMMENT: booking.remarks || '',
    MAT_BOOKING_ID: booking.id,
    MAT_BOOKING_NUMBER: matukioBookingNumber(booking.id),
    MAT_BOOKING_NRBOOKED: String(seats),
    MAT_BOOKING_BOOKEDNR: String(seats),
    MAT_BOOKING_PAYMENT_METHOD: booking.paymentMethod || '',
    MAT_BOOKING_PAYMENT_NETTO: matukioCurrency(netto),
    MAT_BOOKING_PAYMENT_TAX: matukioCurrency(tax),
    MAT_BOOKING_PAYMENT_BRUTTO: matukioCurrency(brutto),
    MAT_BOOKING_GROSS: matukioCurrency(brutto),
    MAT_BOOKING_EXTRA_PAYMENT_OPTIONS: extraOptionsText,
    MAT_CSV_BOOKING_DETAILS: csvBookingDetails,
    // MAT_INVOICE_NUMBER is a placeholder default here (not old's real
    // invoice number, which lives in #__matukio_invoice_number keyed by
    // booking_id/year - see utils/invoiceNumber.ts) - generateInvoicePDF()
    // overrides this with the real "{number}/{year}" value before
    // rendering. Left as a fallback for any other caller.
    MAT_INVOICE_NUMBER: matukioBookingNumber(booking.id),
    MAT_INVOICE_DATE: matukioDate(new Date(booking.createdAt || Date.now())),
    MAT_USER_NAME: booking.user?.name || name,
    MAT_EVENT_NUMBER: booking.event?.eventNumber || '',
    MAT_EVENT_TITLE: booking.event?.title || '',
    MAT_EVENT_BEGIN: booking.event ? new Date(booking.event.startDate).toLocaleString('de-DE') : '',
    MAT_EVENT_END: booking.event?.endDate ? new Date(booking.event.endDate).toLocaleString('de-DE') : '',
    MAT_EVENT_FEES: booking.event?.feePerPerson != null ? matukioCurrency(Number(booking.event.feePerPerson)) : '',
    MAT_EVENT_ALL_DETAILS_HTML: booking.event
      ? `<strong>${booking.event.title}</strong><br/>${new Date(booking.event.startDate).toLocaleString('de-DE')}${booking.event.endDate ? ' - ' + new Date(booking.event.endDate).toLocaleString('de-DE') : ''}`
      : '',
    MAT_EVENT_ALL_DETAILS_TEXT: eventAllDetailsText,
    MAT_DATE: matukioDate(new Date()),
    MAT_SIGNATURE: 'Flugschule Hirondelle',
    // A blank line for physical/pen signing on a printed signature list -
    // never real data, matching old's own use (a signature can't be
    // pre-filled).
    MAT_SIGN: '',
    // Old's real events.php:403-410 - gated on the EVENT's own base fee
    // (not the booking's totalPrice, and not the payment_brutto>0 gate
    // used elsewhere) - a free event always shows "Kostenlos" regardless
    // of what any individual booking ended up costing after a voucher.
    MAT_BOOKING_FEES_STATUS: (booking.event?.feePerPerson ?? 0) > 0
      ? `${matukioCurrency(Number(booking.totalPrice ?? 0))} (${booking.paid ? 'Bezahlt' : 'Nicht bezahlt'})`
      : 'Kostenlos',
    // Old's real per-row running number (MatukioHelperTemplates::
    // getReplaces($event, $booking, $nr, ...) - the caller's own loop
    // index), used by the signature list's "Nr." column.
    MAT_NR: nr != null ? String(nr) : '',
    // MAT_BOOKING_QRCODE_ID/MAT_BOOKING_CHECKIN_QRCODE (real QR code
    // images) need actual QR generation (async, via the `qrcode` package)
    // - left unresolved here; callers that need it override this key with
    // a real <img> tag after calling this function (see bookings.routes.ts
    // export/participant-list, pdf.service.ts's ticket QR).
  };
}

// Old's XML export nests one <PERSON> block per additional participant
// (MAT_XML_BOOKING_OTHER_PERSON_DATA) - separate from the main placeholder
// map since it isn't a flat string substitution.
export function buildXmlOtherPersonData(booking: any): string {
  const details = (booking.customerDetails as any) || {};
  const participants = Array.isArray(details.additionalParticipants) ? details.additionalParticipants : [];
  if (participants.length === 0) return '';
  return participants
    .map((p: any) => {
      const [firstName, ...rest] = String(p.fullName || '').split(' ');
      return `<PERSON><FIRSTNAME>${firstName || ''}</FIRSTNAME><LASTNAME>${rest.join(' ')}</LASTNAME></PERSON>`;
    })
    .join('\n');
}

export function renderMatTokens(template: string, placeholders: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(placeholders)) {
    result = result.split(key).join(value);
  }
  return result;
}

// Friendly column titles for CSV placeholder tokens - used to derive a
// header row automatically from whichever tokens the admin's template uses.
const FRIENDLY_NAMES: Record<string, string> = {
  MAT_BOOKING_NAME: 'Name',
  MAT_BOOKING_EMAIL: 'E-Mail',
  MAT_BOOKING_STATUS: 'Status',
  MAT_BOOKING_FIRSTNAME: 'Vorname',
  MAT_BOOKING_LASTNAME: 'Nachname',
  MAT_BOOKING_COUNTRY: 'Land',
  MAT_BOOKING_STREET: 'Straße',
  MAT_BOOKING_ZIP: 'PLZ',
  MAT_BOOKING_CITY: 'Stadt',
  MAT_BOOKING_ID: 'ID',
  MAT_BOOKING_NUMBER: 'Buchungsnummer',
  MAT_BOOKING_NRBOOKED: 'Plätze',
  MAT_BOOKING_PAYMENT_METHOD: 'Zahlungsart',
  MAT_BOOKING_PAYMENT_BRUTTO: 'Gesamtpreis',
  MAT_EVENT_NUMBER: 'Event-Nr.',
  MAT_EVENT_TITLE: 'Event',
  MAT_EVENT_BEGIN: 'Beginn',
  MAT_EVENT_END: 'Ende',
  MAT_DATE: 'Datum',
};

// Splits a semicolon-separated CSV row template into its individual MAT_*
// tokens (in order), for deriving both the header row and each data row.
//
// The seeded default template (templatesConfig.routes.ts) carries old
// Matukio's own literal single-quoted token syntax verbatim, e.g.
// "'MAT_BOOKING_NUMBER';'MAT_EVENT_TITLE'" - old's own renderer stripped
// those quotes before substitution, but this parser didn't, so every
// token was looked up as e.g. "'MAT_BOOKING_NUMBER'" (quotes included)
// against buildBookingPlaceholders()'s plain MAT_BOOKING_NUMBER keys,
// never matched, and silently fell back to printing the raw (quoted)
// token text in every row instead of the real value - exactly what it
// looks like when the export is opened and every cell just repeats its
// own column's placeholder name. Stripping a wrapping quote (and the
// dangling lone quote old's template also leaves as its final ";'") fixes
// the lookup and drops that empty trailing column.
export function parseCsvTemplateTokens(template: string): string[] {
  return template
    .split(';')
    .map((t) => t.trim().replace(/^['"]+|['"]+$/g, '').trim())
    .filter(Boolean);
}

export function friendlyColumnName(token: string): string {
  return FRIENDLY_NAMES[token] || token.replace(/^MAT_/, '').replace(/_/g, ' ');
}

// Best-effort HTML -> plain text for templates that are authored as HTML but
// rendered into a PDFKit document (which draws text imperatively, not HTML/CSS).
// This keeps the admin's wording/placeholders in full control while being
// upfront that visual HTML styling isn't reproduced pixel-for-pixel in the PDF.
export function htmlTemplateToLines(html: string): string[] {
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    // Table cells (the invoice template's two-column header/info boxes and
    // line-items table) have no inherent line break between them - without
    // this they'd run together as one unreadable word ("Your CompanyYour
    // Logo"). A real newline per </tr> keeps each table row on its own line.
    .replace(/<\/(td|th)>/gi, '  ')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return withBreaks
    .split(/\r?\n/)
    .map((l) => l.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').trim())
    .filter((l) => l.length > 0);
}

export interface HtmlTextLine {
  text: string;
  bold: boolean;
}

export interface HtmlTableCell {
  lines: HtmlTextLine[];
  align: 'left' | 'right' | 'center';
  header: boolean;
}

export type HtmlBlock =
  | { type: 'table'; bordered: boolean; rows: HtmlTableCell[][] }
  | { type: 'text'; lines: HtmlTextLine[]; align: 'left' | 'right' | 'center' };

function decodeEntities(s: string): string {
  return s.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>');
}

// Splits one cell/div/paragraph's inner HTML into lines on <br>, detecting
// per-line bold (<b>/<strong>) and stripping all other tags - old's real
// templates bold only specific lines within a cell (e.g. a "Customer
// Information" heading line followed by plain data lines), not the whole
// cell, so this must be tracked per line rather than per cell.
function parseInnerLines(innerHtml: string): HtmlTextLine[] {
  return innerHtml
    .split(/<br\s*\/?>/gi)
    .map((raw) => {
      const bold = /<(b|strong)[^>]*>/i.test(raw);
      const text = decodeEntities(raw.replace(/<[^>]+>/g, '')).trim();
      return { text, bold };
    })
    .filter((l) => l.text.length > 0);
}

function parseAlign(attrs: string): 'left' | 'right' | 'center' {
  const m = attrs.match(/align=["']?(left|right|center)["']?/i);
  return (m?.[1].toLowerCase() as 'left' | 'right' | 'center') || 'left';
}

// Parses the small, known subset of HTML old's real Matukio templates
// actually use (table/tr/td/th, div, br, b/strong, plain text) into a
// sequence of renderable blocks - tables keep their real row/column
// structure (drawn as an actual bordered grid in pdf.service.ts) instead of
// being flattened into plain text lines like htmlTemplateToLines() does.
export function parseHtmlBlocks(html: string): HtmlBlock[] {
  const blocks: HtmlBlock[] = [];
  const topLevelRe = /<table([^>]*)>([\s\S]*?)<\/table>|<div([^>]*)>([\s\S]*?)<\/div>/gi;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const flushText = (segment: string) => {
    const lines = parseInnerLines(segment);
    if (lines.length) blocks.push({ type: 'text', lines, align: 'left' });
  };

  while ((match = topLevelRe.exec(html))) {
    flushText(html.slice(lastIndex, match.index));
    lastIndex = topLevelRe.lastIndex;

    if (match[1] !== undefined) {
      // <table ...> ... </table>
      const tableAttrs = match[1];
      const tableInner = match[2];
      const bordered = /border=["']?[1-9]/i.test(tableAttrs);
      const rows: HtmlTableCell[][] = [];
      const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let rowMatch: RegExpExecArray | null;
      while ((rowMatch = rowRe.exec(tableInner))) {
        const cells: HtmlTableCell[] = [];
        const cellRe = /<(td|th)([^>]*)>([\s\S]*?)<\/\1>/gi;
        let cellMatch: RegExpExecArray | null;
        while ((cellMatch = cellRe.exec(rowMatch[1]))) {
          const [, tag, attrs, inner] = cellMatch;
          cells.push({
            lines: parseInnerLines(inner),
            align: parseAlign(attrs),
            header: tag.toLowerCase() === 'th',
          });
        }
        if (cells.length) rows.push(cells);
      }
      if (rows.length) blocks.push({ type: 'table', bordered, rows });
    } else {
      // <div ...> ... </div>
      const divAttrs = match[3] || '';
      const divInner = match[4] || '';
      const lines = parseInnerLines(divInner);
      if (lines.length) blocks.push({ type: 'text', lines, align: parseAlign(divAttrs) });
    }
  }
  flushText(html.slice(lastIndex));

  return blocks;
}
