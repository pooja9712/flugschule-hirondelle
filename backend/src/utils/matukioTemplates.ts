import { resolveBookingCustomer } from './bookingCustomer';

// Bare MAT_* token substitution, matching the exact convention documented in
// the admin's TemplatesBuilder (listViews/certificates/tickets/csvXml tabs) -
// no curly braces, unlike the {TOKEN} style used by the simpler emails.* templates.
export function buildBookingPlaceholders(booking: any): Record<string, string> {
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
    MAT_BOOKING_STATUS: booking.status,
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
    MAT_BOOKING_NUMBER: booking.id.replace(/-/g, '').slice(0, 10).toUpperCase(),
    MAT_BOOKING_NRBOOKED: String(seats),
    MAT_BOOKING_BOOKEDNR: String(seats),
    MAT_BOOKING_PAYMENT_METHOD: booking.paymentMethod || '',
    MAT_BOOKING_PAYMENT_NETTO: netto.toFixed(2),
    MAT_BOOKING_PAYMENT_TAX: tax.toFixed(2),
    MAT_BOOKING_PAYMENT_BRUTTO: brutto.toFixed(2),
    MAT_BOOKING_GROSS: brutto.toFixed(2),
    MAT_BOOKING_EXTRA_PAYMENT_OPTIONS: extraOptionsText,
    MAT_CSV_BOOKING_DETAILS: csvBookingDetails,
    // MAT_INVOICE_NUMBER is a placeholder default here (not old's real
    // invoice number, which lives in #__matukio_invoice_number keyed by
    // booking_id/year - see utils/invoiceNumber.ts) - generateInvoicePDF()
    // overrides this with the real "{number}/{year}" value before
    // rendering. Left as a fallback for any other caller.
    MAT_INVOICE_NUMBER: booking.id.replace(/-/g, '').slice(0, 10).toUpperCase(),
    MAT_INVOICE_DATE: new Date(booking.createdAt || Date.now()).toLocaleDateString('de-DE'),
    MAT_USER_NAME: booking.user?.name || name,
    MAT_EVENT_NUMBER: booking.event?.eventNumber || '',
    MAT_EVENT_TITLE: booking.event?.title || '',
    MAT_EVENT_BEGIN: booking.event ? new Date(booking.event.startDate).toLocaleString('de-DE') : '',
    MAT_EVENT_END: booking.event?.endDate ? new Date(booking.event.endDate).toLocaleString('de-DE') : '',
    MAT_EVENT_FEES: booking.event?.feePerPerson != null ? Number(booking.event.feePerPerson).toFixed(2) : '',
    MAT_EVENT_ALL_DETAILS_HTML: booking.event
      ? `<strong>${booking.event.title}</strong><br/>${new Date(booking.event.startDate).toLocaleString('de-DE')}${booking.event.endDate ? ' - ' + new Date(booking.event.endDate).toLocaleString('de-DE') : ''}`
      : '',
    MAT_EVENT_ALL_DETAILS_TEXT: eventAllDetailsText,
    MAT_DATE: new Date().toLocaleDateString('de-DE'),
    MAT_SIGNATURE: 'Flugschule Hirondelle',
    // A blank line for physical/pen signing on a printed signature list -
    // never real data, matching old's own use (a signature can't be
    // pre-filled).
    MAT_SIGN: '',
    // MAT_NR (a per-row running number) and MAT_BOOKING_QRCODE_ID/
    // MAT_BOOKING_CHECKIN_QRCODE (real QR code images) aren't resolvable
    // from a single booking's own data in isolation - the former needs the
    // caller's own loop index, the latter needs real QR generation. Left
    // unresolved here on purpose; not silently guessed at.
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
