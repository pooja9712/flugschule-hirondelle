import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { prisma } from '../utils/prisma';
import fs from 'fs';
import path from 'path';
import { resolveBookingCustomer } from '../utils/bookingCustomer';
import { buildBookingPlaceholders, renderMatTokens, htmlTemplateToLines } from '../utils/matukioTemplates';
import { getOrCreateInvoiceNumber, formatInvoiceNumber } from '../utils/invoiceNumber';
import { getOrCreateConfig as getOrCreateHeaderContactInfo } from '../routes/headerContact.routes';

const uploadsDir = path.join(__dirname, '../../uploads');

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
    // engine already used for tickets/certificates/name tags, reduced from
    // HTML to text lines since PDFKit draws text imperatively rather than
    // rendering HTML/CSS (table borders/columns aren't reproduced, but the
    // admin's exact wording, fields and token choices are). MAT_INVOICE_NUMBER
    // is overridden with the real, legally-sequential number (old's
    // #__matukio_invoice_number logic, migrated - see utils/invoiceNumber.ts)
    // instead of buildBookingPlaceholders()'s generic booking-id fallback.
    const placeholders = buildBookingPlaceholders(booking);
    placeholders.MAT_INVOICE_NUMBER = formatInvoiceNumber(invoiceNumber) || '';
    const rendered = renderMatTokens(template, placeholders);
    const lines = htmlTemplateToLines(rendered);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      doc.fontSize(20).text('Rechnung', { align: 'right' });
      doc.moveDown();
      doc.fontSize(10).font('Helvetica');
      for (const line of lines) {
        doc.text(line);
      }

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
    doc.text(`Buchungsnummer: ${booking.id.replace(/-/g, '').slice(0, 10).toUpperCase()}`, { align: 'right' });
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
      doc.text(`${item.ticket.price.toFixed(2)} €`, 400, y);
      doc.text(`${(item.ticket.price * item.quantity).toFixed(2)} €`, 500, y);
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
      doc.text(`-${discount.toFixed(2)} €`, 500, y);
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
      doc.text(`${netAmount.toFixed(2)} €`, 500, y);
      y += 20;
      doc.text(`zzgl. ${taxRatePercent}% MwSt.:`, 350, y);
      doc.text(`${taxAmount.toFixed(2)} €`, 500, y);
      y += 20;
    }

    doc.font('Helvetica-Bold');
    doc.text('Gesamtbetrag:', 350, y);
    doc.text(`${booking.totalPrice.toFixed(2)} €`, 500, y);

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
      const rendered = renderMatTokens(template, buildBookingPlaceholders(booking));
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
      doc.text(`Buchungsnummer: ${booking.id.replace(/-/g, '').slice(0, 10).toUpperCase()}`);
      doc.text(`Gesamtpreis: ${booking.totalPrice.toFixed(2)} €`);
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
      const rendered = renderMatTokens(template, buildBookingPlaceholders(booking));
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

  const rendered = renderMatTokens(template, buildBookingPlaceholders(booking));
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
