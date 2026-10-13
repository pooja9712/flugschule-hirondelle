import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { prisma } from '../utils/prisma';
import fs from 'fs';
import path from 'path';
import { resolveBookingCustomer } from '../utils/bookingCustomer';
import { buildBookingPlaceholders, renderMatTokens, htmlTemplateToLines, matukioBookingNumber, parseHtmlBlocks, HtmlBlock } from '../utils/matukioTemplates';
import { getOrCreateInvoiceNumber, formatInvoiceNumber } from '../utils/invoiceNumber';
import { getOrCreateConfig as getOrCreateHeaderContactInfo } from '../routes/headerContact.routes';

const uploadsDir = path.join(__dirname, '../../uploads');

// PDFKit's bundled standard-14 Helvetica font uses Adobe's original 1985 AFM
// metrics, which predate the Euro sign (added to Windows-1252 in 1998) - the
// glyph has no width entry, so doc.text() silently drops "€" from the output
// entirely (confirmed: "950.00 €" renders as "950.00 " with a trailing
// space, invisible in the PDF) rather than erroring. "EUR" avoids the
// missing-glyph bug without embedding a custom Unicode font.
function formatEurPdf(value: number): string {
  return `${value.toFixed(2)} EUR`;
}

// Same fix, applied to the already-formatted "€ 123.45"-style strings that
// buildBookingPlaceholders() produces for MAT_BOOKING_PAYMENT_*/MAT_EVENT_FEES
// (correct as real "€" for the CSV/XML export and participant/signature-list
// plain-text downloads, which render it fine - only PDFKit's glyph-less
// Helvetica needs the swap, so this is applied to a copy of the placeholders
// map rather than to buildBookingPlaceholders() itself).
function makePdfSafePlaceholders(placeholders: Record<string, string>): Record<string, string> {
  const safe = { ...placeholders };
  for (const key of ['MAT_BOOKING_PAYMENT_NETTO', 'MAT_BOOKING_PAYMENT_TAX', 'MAT_BOOKING_PAYMENT_BRUTTO', 'MAT_BOOKING_GROSS', 'MAT_EVENT_FEES']) {
    if (safe[key]) safe[key] = safe[key].replace(/€\s*/g, '').trim() + ' EUR';
  }
  return safe;
}

// Draws old's real HTML table structure (parseHtmlBlocks()) as an actual
// bordered grid - PDFKit has no table primitive of its own, so each row's
// height is measured from its tallest cell's wrapped text first, then every
// cell in that row is drawn to that same height, keeping the grid lines
// aligned exactly like a real <table> instead of flattening everything into
// plain stacked text lines (htmlTemplateToLines(), still used for the
// simpler single-column ticket/certificate/name-tag templates).
function drawHtmlBlocks(doc: PDFKit.PDFDocument, blocks: HtmlBlock[]) {
  const left = doc.page.margins.left;
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const lineGap = 3;
  const cellPaddingX = 6;
  const cellPaddingY = 5;
  const fontSize = 10;

  const lineHeight = (text: string, width: number, bold: boolean) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize);
    return doc.heightOfString(text, { width });
  };

  for (const block of blocks) {
    if (block.type === 'text') {
      for (const line of block.lines) {
        if (doc.y + lineHeight(line.text, contentWidth, line.bold) > doc.page.height - doc.page.margins.bottom) {
          doc.addPage();
        }
        doc.font(line.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize);
        doc.text(line.text, left, doc.y, { width: contentWidth, align: block.align, lineGap });
        doc.y += lineGap;
      }
      doc.moveDown(0.75);
      continue;
    }

    const cols = Math.max(...block.rows.map((r) => r.length));
    const colWidth = contentWidth / cols;
    const innerWidth = colWidth - cellPaddingX * 2;

    for (const row of block.rows) {
      const rowHeight = Math.max(
        20,
        ...row.map((cell) => {
          let h = cellPaddingY * 2;
          for (const line of cell.lines) h += lineHeight(line.text, innerWidth, line.bold || cell.header) + lineGap;
          return h;
        })
      );

      if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
      }
      const rowY = doc.y;

      row.forEach((cell, i) => {
        const cellX = left + i * colWidth;
        if (block.bordered) {
          doc.rect(cellX, rowY, colWidth, rowHeight).strokeColor('#999999').lineWidth(0.5).stroke();
        }
        let textY = rowY + cellPaddingY;
        for (const line of cell.lines) {
          doc.font(line.bold || cell.header ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize);
          doc.fillColor('black').text(line.text, cellX + cellPaddingX, textY, { width: innerWidth, align: cell.align });
          textY += lineHeight(line.text, innerWidth, line.bold || cell.header) + lineGap;
        }
      });

      doc.y = rowY + rowHeight;
    }
    doc.moveDown(0.75);
  }
}

export async function generateInvoicePDF(bookingId: string): Promise<Buffer> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      event: true,
      items: { include: { ticket: true } },
      user: true,
    }
  });

  if (!booking) throw new Error('Booking not found');

  // Real, legally-sequential invoice number (old Matukio's own numbering,
  // migrated + continued - see utils/invoiceNumber.ts) instead of a slice
  // of the booking's own UUID, which was never a real invoice number at
  // all. The "Datum" field below is deliberately NOT this invoice's own
  // issue date - old's real template's MAT_DATE token
  // (MatukioHelperTemplates::getReplaces(), templates.php:105) is
  // literally "today" at print time (`JHTML::_('date', '', ...)` with an
  // empty date argument), so re-printing an old invoice years later always
  // showed that day's date, not a frozen one - matched here faithfully
  // rather than "corrected" to a fixed date.
  const invoiceNumber = await getOrCreateInvoiceNumber(booking.id);
  const templatesConfig = await prisma.templatesConfig.findUnique({ where: { id: 'default' } });
  const template = (templatesConfig?.invoices as any)?.pdfTemplate as string | undefined;

  if (template && template.trim()) {
    // Admin-configurable invoice template (Vorlagen > Rechnung), seeded
    // word-for-word from old Matukio's own real invoice template
    // (hiron_matukio_templates, tmpl_name='invoice') - same MAT_* token
    // engine already used for tickets/certificates/name tags. Unlike those
    // (plain text lines, via htmlTemplateToLines()), this template's real
    // tables (company header, customer/invoice info boxes, bordered items
    // table) are drawn as an actual grid via drawHtmlBlocks()/
    // parseHtmlBlocks() - the admin's exact wording AND its real table
    // layout, not just the wording. MAT_INVOICE_NUMBER is overridden with
    // the real, legally-sequential number (old's #__matukio_invoice_number
    // logic, migrated - see utils/invoiceNumber.ts) instead of
    // buildBookingPlaceholders()'s generic booking-id fallback.
    const placeholders = makePdfSafePlaceholders(buildBookingPlaceholders(booking));
    // Old's real print-time check (MatukioHelperTemplates::getReplaces(),
    // templates.php:337) only fills MAT_INVOICE_NUMBER in if the booking's
    // own final amount (payment_brutto, i.e. our totalPrice) is > 0 - a
    // booking fully covered by a voucher still has a real, already-assigned
    // number (see utils/invoiceNumber.ts), but old's own invoice document
    // would print that line blank for it, so this matches that exactly
    // rather than always showing the number whenever one exists.
    placeholders.MAT_INVOICE_NUMBER = booking.totalPrice > 0 ? (formatInvoiceNumber(invoiceNumber) || '') : '';
    const rendered = renderMatTokens(template, placeholders);
    const blocks = parseHtmlBlocks(rendered);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      doc.fontSize(20).text('Rechnung', { align: 'right' });
      doc.moveDown();
      drawHtmlBlocks(doc, blocks);

      doc.end();
    });
  }

  const contactInfo = await getOrCreateHeaderContactInfo();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Fallback layout, used only if no admin invoice template is configured.
    doc.fontSize(20).text('Rechnung', { align: 'right' });
    doc.moveDown();

    // Company Details
    doc.fontSize(10)
      .text(contactInfo.siteName, 50, 50)
      .text(contactInfo.addressLine1, 50, 65)
      .text(contactInfo.addressLine2, 50, 80);

    doc.moveDown(3);

    // Customer Details
    const customer = booking.customerDetails as any;
    if (customer) {
      doc.text(`${customer.salutation} ${customer.firstName || ''} ${customer.lastName || customer.fullName || ''}`);
      doc.text(customer.street || '');
      doc.text(`${customer.zip || ''} ${customer.city || ''}`);
      if (customer.country) doc.text(customer.country);
    }

    doc.moveDown(2);

    if (invoiceNumber) {
      doc.fontSize(12).text(`Rechnungsnummer: ${formatInvoiceNumber(invoiceNumber)}`, { align: 'right' });
    }
    doc.text(`Buchungsnummer: ${matukioBookingNumber(booking.id)}`, { align: 'right' });
    doc.text(`Datum: ${new Date().toLocaleDateString('de-DE')}`, { align: 'right' });
    if (booking.paymentMethod) doc.text(`Zahlungsmethode: ${booking.paymentMethod}`, { align: 'right' });

    doc.moveDown(2);

    // Invoice Table Header
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Beschreibung', 50, doc.y);
    doc.text('Menge', 300, doc.y);
    doc.text('Einzelpreis', 400, doc.y);
    doc.text('Gesamt', 500, doc.y);
    doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).stroke();
    doc.moveDown();

    // Invoice Items
    doc.font('Helvetica');
    let y = doc.y + 10;
    let itemsTotal = 0;

    booking.items.forEach(item => {
      itemsTotal += item.ticket.price * item.quantity;
      doc.text(item.ticket.name, 50, y);
      doc.text(item.quantity.toString(), 300, y);
      doc.text(formatEurPdf(item.ticket.price), 400, y);
      doc.text(formatEurPdf(item.ticket.price * item.quantity), 500, y);
      y += 20;
    });

    doc.moveTo(50, y + 10).lineTo(550, y + 10).stroke();
    y += 20;

    // Items above are listed at full price; if a voucher/tiered-fee discount
    // applied, totalPrice is lower than their sum - show it explicitly so
    // the invoice's own numbers add up instead of jumping straight to a
    // lower total with no line explaining why.
    const discount = itemsTotal - booking.totalPrice;
    if (discount > 0.01) {
      doc.font('Helvetica');
      doc.text('Rabatt:', 350, y);
      doc.text(`-${formatEurPdf(discount)}`, 500, y);
      y += 20;
    }

    // old's real invoice template shows a full net/tax/gross breakdown
    // (MAT_BOOKING_PAYMENT_NETTO / _TAX / _BRUTTO). Uses the split FROZEN
    // on the booking at the time it was created (bookingPrice.ts) rather
    // than recomputing live from booking.event.taxRate - a tax rate edited
    // after the fact must never rewrite what a past invoice already showed.
    // Falls back to a live computation only for bookings created before
    // these columns existed (priceNet/priceTax null).
    const taxRatePercent = booking.priceTaxRatePercent ?? parseFloat(booking.event.taxRate || '');
    if (taxRatePercent > 0) {
      const netAmount = booking.priceNet ?? booking.totalPrice / (1 + taxRatePercent / 100);
      const taxAmount = booking.priceTax ?? booking.totalPrice - netAmount;
      doc.font('Helvetica');
      doc.text('Nettobetrag:', 350, y);
      doc.text(formatEurPdf(netAmount), 500, y);
      y += 20;
      doc.text(`zzgl. ${taxRatePercent}% MwSt.:`, 350, y);
      doc.text(formatEurPdf(taxAmount), 500, y);
      y += 20;
    }

    doc.font('Helvetica-Bold');
    doc.text('Gesamtbetrag:', 350, y);
    doc.text(formatEurPdf(booking.totalPrice), 500, y);

    // Save to filesystem for later download
    const invoicesDir = path.join(uploadsDir, 'invoices');
    if (!fs.existsSync(invoicesDir)) fs.mkdirSync(invoicesDir, { recursive: true });
    
    // We can also pipe to file while collecting buffers
    // doc.pipe(fs.createWriteStream(path.join(invoicesDir, `RE-${booking.id}.pdf`)));
    // But since we want to return the buffer for the email attachment, we just end it.

    doc.end();
  });
}

// Matukio's real live ticket template (hiron_matukio_templates.tmpl_name=
// 'ticket') includes MAT_BOOKING_NUMBER, MAT_BOOKING_PAYMENT_BRUTTO and a
// MAT_BOOKING_CHECKIN_QRCODE token - a real, scannable check-in code, not
// text. PDFKit can't embed an image via a text placeholder, so any literal
// MAT_BOOKING_CHECKIN_QRCODE line in the admin's template text is dropped
// (it would otherwise print as unresolved literal text) and a real QR
// code encoding the booking id is always drawn in its own fixed spot -
// this is genuinely scannable (any QR reader decodes the booking id),
// unlike the previous static "Scan Me" box placeholder.
export async function generateTicketPDF(bookingId: string): Promise<Buffer> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      event: true,
      items: { include: { ticket: true } },
    }
  });

  if (!booking) throw new Error('Booking not found');

  let locationName = booking.event.location || 'TBA';
  if (!booking.event.location && booking.event.locationId) {
    const loc = await prisma.location.findUnique({ where: { id: booking.event.locationId } });
    if (loc) locationName = loc.title;
  }

  const templatesConfig = await prisma.templatesConfig.findUnique({ where: { id: 'default' } });
  const template = (templatesConfig?.tickets as any)?.ticketTemplate as string | undefined;
  const qrDataUrl = await QRCode.toDataURL(booking.id, { margin: 1, width: 200 });
  const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, layout: 'landscape', size: 'A5' });
    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Branding
    doc.rect(0, 0, doc.page.width, 40).fill('#ab8942');
    doc.fillColor('white').fontSize(16).text('Flugschule Hirondelle - Ticket', 20, 12);
    doc.fillColor('black');
    doc.moveDown(3);

    if (template && template.trim()) {
      const rendered = renderMatTokens(template, makePdfSafePlaceholders(buildBookingPlaceholders(booking)));
      const lines = htmlTemplateToLines(rendered).filter(l => !l.includes('MAT_BOOKING_CHECKIN_QRCODE'));
      doc.fontSize(12).font('Helvetica');
      for (const line of lines) {
        doc.text(line);
      }
    } else {
      // Event Info
      doc.fontSize(18).font('Helvetica-Bold').text(booking.event.title);
      doc.fontSize(12).font('Helvetica')
         .text(`Datum: ${new Date(booking.event.startDate).toLocaleDateString('de-DE')}${booking.event.endDate ? ` - ${new Date(booking.event.endDate).toLocaleDateString('de-DE')}` : ''}`)
         .text(`Ort: ${locationName}`);

      doc.moveDown();

      // Customer
      const customer = booking.customerDetails as any;
      if (customer) {
        doc.text(`Teilnehmer: ${customer.salutation} ${customer.firstName || ''} ${customer.lastName || customer.fullName || ''}`);
      }

      doc.moveDown();

      // Items
      booking.items.forEach(item => {
         doc.text(`- ${item.quantity}x ${item.ticket.name}`);
      });

      doc.moveDown();
      doc.text(`Buchungsnummer: ${matukioBookingNumber(booking.id)}`);
      doc.text(`Gesamtpreis: ${formatEurPdf(booking.totalPrice)}`);
    }

    // Real check-in QR code, always drawn regardless of template
    doc.image(qrBuffer, doc.page.width - 150, 100, { width: 100, height: 100 });
    doc.fontSize(7).text('Zum Check-in scannen', doc.page.width - 150, 202, { width: 100, align: 'center' });

    doc.end();
  });
}

// Matukio's "Name tag (PDF)" - one small badge per booking, printed/cut out
// for the participant to wear at the event. Uses the admin's template
// (Vorlagen > Ticket und Namensschild) if configured - PDFKit draws text
// imperatively rather than rendering HTML/CSS, so an HTML template is
// reduced to its text lines with placeholders substituted; the admin's
// wording is fully respected even though exact HTML styling isn't.
export async function generateNameTagPDF(bookingId: string): Promise<Buffer> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { event: true, user: true },
  });

  if (!booking) throw new Error('Booking not found');
  const { name } = resolveBookingCustomer(booking);

  const templatesConfig = await prisma.templatesConfig.findUnique({ where: { id: 'default' } });
  const template = (templatesConfig?.tickets as any)?.nametagTemplate as string | undefined;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: [283, 170] }); // ~ 100mm x 60mm badge
    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    doc.rect(0, 0, doc.page.width, 40).fill('#ab8942');
    doc.fillColor('white').fontSize(11).font('Helvetica-Bold').text('Flugschule Hirondelle', 15, 14);
    doc.fillColor('black');

    if (template && template.trim()) {
      const rendered = renderMatTokens(template, makePdfSafePlaceholders(buildBookingPlaceholders(booking)));
      const lines = htmlTemplateToLines(rendered);
      doc.fontSize(13).font('Helvetica');
      let y = 55;
      for (const line of lines) {
        doc.text(line, 15, y, { width: 253, align: 'center' });
        y += 18;
      }
    } else {
      doc.fontSize(20).font('Helvetica-Bold').text(name, 15, 60, { width: 253, align: 'center' });
      doc.fontSize(11).font('Helvetica').text(booking.event.title, 15, 100, { width: 253, align: 'center' });
      doc.fontSize(9).fillColor('#666').text(
        new Date(booking.event.startDate).toLocaleDateString('de-DE'),
        15, 125, { width: 253, align: 'center' }
      );
    }

    doc.end();
  });
}

// Matukio's certificate PDF (Vorlagen > Zertifikat erteilen). No hardcoded
// fallback design - a certificate's exact wording/legal text matters, so if
// the admin hasn't configured a template yet, callers should treat this as
// "not available" rather than receive a generic placeholder document.
export async function generateCertificatePDF(bookingId: string): Promise<Buffer | null> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { event: true, user: true },
  });
  if (!booking) throw new Error('Booking not found');

  const templatesConfig = await prisma.templatesConfig.findUnique({ where: { id: 'default' } });
  const template = (templatesConfig?.certificates as any)?.pdfTemplate as string | undefined;
  if (!template || !template.trim()) return null;

  const rendered = renderMatTokens(template, makePdfSafePlaceholders(buildBookingPlaceholders(booking)));
  const lines = htmlTemplateToLines(rendered);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 60, size: 'A4', layout: 'landscape' });
    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    doc.fontSize(14).font('Helvetica');
    let y = 80;
    for (const line of lines) {
      doc.text(line, 60, y, { width: doc.page.width - 120, align: 'center' });
      y += 24;
    }

    doc.end();
  });
}
