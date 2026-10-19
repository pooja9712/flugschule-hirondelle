import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { authenticateJWT, authorizeAdmin, AuthRequest } from '../middlewares/auth.middleware';
import { sendBookingConfirmationEmail, sendCancellationEmail } from '../services/mailer.service';
import { getSettingsConfig } from './settingsConfig.routes';
import { calculateBookingPrice } from '../utils/bookingPrice';
import { JWT_SECRET } from '../utils/config';
import jwt from 'jsonwebtoken';
import { resolveBookingCustomer } from '../utils/bookingCustomer';
import { getNewsletterTransporter } from '../utils/newsletterTransporter';
import {
  buildBookingPlaceholders, renderMatTokens, parseCsvTemplateTokens, friendlyColumnName, htmlTemplateToLines,
  matukioBookingNumber, OLD_STYLE_STATUS_LABEL,
  DEFAULT_SIGNATURE_LIST_HEADER, DEFAULT_SIGNATURE_LIST_ROW, DEFAULT_PARTICIPANT_LIST_HEADER, DEFAULT_PARTICIPANT_LIST_ROW,
} from '../utils/matukioTemplates';
import QRCode from 'qrcode';
import { escapeHtml } from '../utils/htmlEscape';
import { csvEscape } from '../utils/csvEscape';
import { publicLookupRateLimit } from '../middlewares/rateLimit.middleware';
import { subscribeToNewsletter } from './newsletters.routes';

const router = Router();

import { generateInvoicePDF, generateTicketPDF, generateNameTagPDF, generateCertificatePDF } from '../services/pdf.service';
import { getOrCreateInvoiceNumber, formatInvoiceNumber } from '../utils/invoiceNumber';

router.get('/my-bookings', authenticateJWT, async (req: any, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { userId: req.user.id },
      include: {
        event: true,
        items: { include: { ticket: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Post-event rating - reachable via the unguessable booking id itself as the
// link token (matches Matukio's uuid-token rating link), no login required.
// Only allowed once the event has actually finished, and only once.
router.get('/:id/rating-info', publicLookupRateLimit, async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id as string },
      include: { event: { select: { title: true, startDate: true, endDate: true } } }
    });
    if (!booking) return res.status(404).json({ message: 'Not found' });

    const eventEnd = booking.event.endDate || booking.event.startDate;
    res.json({
      eventTitle: booking.event.title,
      eventEnded: new Date() >= new Date(eventEnd),
      alreadyRated: booking.rating != null,
      rating: booking.rating,
      ratingComment: booking.ratingComment
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/:id/rate', publicLookupRateLimit, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const ratingNum = Number(rating);
    if (!ratingNum || ratingNum < 1 || ratingNum > 6) {
      return res.status(400).json({ message: 'Bewertung muss zwischen 1 und 6 liegen' });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id as string },
      include: { event: { select: { startDate: true, endDate: true } } }
    });
    if (!booking) return res.status(404).json({ message: 'Not found' });

    const eventEnd = booking.event.endDate || booking.event.startDate;
    if (new Date() < new Date(eventEnd)) {
      return res.status(400).json({ message: 'Eine Bewertung ist erst nach der Veranstaltung möglich' });
    }
    if (booking.rating != null) {
      return res.status(400).json({ message: 'Diese Buchung wurde bereits bewertet' });
    }

    await prisma.booking.update({
      where: { id: req.params.id as string },
      data: { rating: ratingNum, ratingComment: comment || null }
    });

    res.json({ message: 'Vielen Dank für Ihre Bewertung' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Fellow-participants list for one event - only visible to a logged-in user
// who has a non-cancelled booking on that same event (matches Matukio's
// isViewTeilnehmer gating, and never exposes email/address, just names).
router.get('/event/:eventId/participants', authenticateJWT, async (req: any, res) => {
  try {
    const { eventId } = req.params;
    const ownBooking = await prisma.booking.findFirst({
      where: { eventId, userId: req.user.id, status: { not: 'CANCELLED' } }
    });
    if (!ownBooking) {
      return res.status(403).json({ message: 'Nur für gebuchte Teilnehmer sichtbar' });
    }

    const bookings = await prisma.booking.findMany({
      where: { eventId, status: { not: 'CANCELLED' } },
      select: { id: true, customerDetails: true }
    });

    const participants = bookings.map(b => {
      const c = (b.customerDetails as any) || {};
      const name = c.fullName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Teilnehmer';
      return { name };
    });

    res.json(participants);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/:id/invoice', authenticateJWT, async (req: any, res) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.userId !== req.user.id && req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Unauthorized' });

    const pdfBuffer = await generateInvoicePDF(booking.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Rechnung_${booking.id.split('-')[0].toUpperCase()}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error generating invoice' });
  }
});

router.get('/:id/ticket', authenticateJWT, async (req: any, res) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.userId !== req.user.id && req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Unauthorized' });

    const pdfBuffer = await generateTicketPDF(booking.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Ticket_${booking.id.split('-')[0].toUpperCase()}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error generating ticket' });
  }
});

// Matukio's "Active or Floating" status dropdown - `all`/`activeandpending` are
// pseudo-values that expand to several real statuses; `paid`/`unpaid` are
// alternate values of the SAME dropdown (not a separate filter), matching a
// boolean rather than the status column.
const STATUS_PSEUDO: Record<string, string[] | undefined> = {
  activeandpending: ['CONFIRMED', 'PENDING'],
  active: ['CONFIRMED'],
  pending: ['PENDING'],
  waitlist: ['WAITLIST'],
  archived: ['COMPLETED'],
  deleted: ['CANCELLED'],
};

// Spelling variants of a search term so umlauts can be typed either way:
// "mueller" also tries "müller". (The plain "muller" spelling needs no
// variant - utf8mb4_unicode_ci already treats ü = u, ß = ss and ignores
// case.)
function umlautVariants(term: string): string[] {
  const spelled = term
    .replace(/ae/g, 'ä').replace(/oe/g, 'ö').replace(/ue/g, 'ü')
    .replace(/Ae/g, 'Ä').replace(/Oe/g, 'Ö').replace(/Ue/g, 'Ü');
  return spelled === term ? [term] : [term, spelled];
}

// The admin search box: one free-text term matched against the customer's
// name, e-mail and the booking ID - case- and umlaut-insensitive. The ID can
// be the short ID shown in the list's "ID" column (e.g. "F8FE810BF4"), the
// full UUID, or old Matukio's numeric booking number. An optional "id:"
// prefix limits the search to IDs only.
async function findBookingIdsForSearch(raw: string): Promise<string[]> {
  let term = raw.trim();
  const idOnly = /^id:/i.test(term);
  if (idOnly) term = term.slice(3).trim();
  if (!term) return [];

  const conditions: Prisma.Sql[] = [];

  if (!idOnly) {
    for (const variant of umlautVariants(term)) {
      const like = `%${variant.replace(/[\\%_]/g, c => `\\${c}`)}%`;
      // customerDetails is stored with a binary (case-sensitive) collation,
      // so each extracted value is re-collated to unicode_ci for the match.
      // The explicit CONVERT(... USING utf8mb4) is required, not cosmetic:
      // JSON_EXTRACT's own result charset is version-dependent (confirmed
      // directly - this server's MariaDB 10.4 returns plain `utf8`, which a
      // bare `COLLATE utf8mb4_unicode_ci` then rejects outright with
      // "COLLATION 'utf8mb4_unicode_ci' is not valid for CHARACTER SET
      // 'utf8'", a hard 500 on every single search). Forcing the charset
      // first makes the COLLATE valid regardless of what JSON_EXTRACT
      // happened to return on a given server.
      for (const path of ['$.name', '$.firstName', '$.lastName', '$.email']) {
        conditions.push(Prisma.sql`CONVERT(JSON_UNQUOTE(JSON_EXTRACT(b.customerDetails, ${path})) USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE ${like}`);
      }
      conditions.push(Prisma.sql`u.name LIKE ${like}`, Prisma.sql`u.email LIKE ${like}`);
    }
  }

  if (/^\d+$/.test(term)) {
    conditions.push(Prisma.sql`JSON_EXTRACT(b.customerDetails, '$.oldBookingId') = ${Number(term)}`);
  }
  if (/^[0-9a-f-]{4,}$/i.test(term)) {
    // Short ID = the UUID without dashes, so re-insert them (8-4-4-4-12)
    // to turn it back into a prefix of the stored id.
    const hex = term.replace(/-/g, '').toLowerCase();
    const prefix = [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)]
      .filter(Boolean).join('-');
    conditions.push(Prisma.sql`b.id LIKE ${`${prefix}%`}`);
  }

  if (!conditions.length) return [];
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT b.id FROM Booking b LEFT JOIN User u ON u.id = b.userId
    WHERE ${Prisma.join(conditions, ' OR ')}`;
  return rows.map(r => r.id);
}

// Internal/test bookings (made by the team itself while testing the live
// booking flow, not real customers) - hidden from the normal admin Bookings
// view (list, CSV, participant/signature-list exports all share this same
// where-clause builder), never deleted. Exact-match only (not a loose
// "contains"), and the JSON extraction uses utf8mb4_unicode_ci - already
// case-insensitive, so "Test"/"TEST"/"test" all match "test" - so a real
// customer can never be caught by this.
const HIDDEN_TEST_EMAILS = ['test@gmail.com', 'sudhirgaikwad520@gmail.com', 'sudhirgaikwad517@gmail.com'];
const HIDDEN_TEST_NAMES = ['test', 'test kunde'];

async function findHiddenTestBookingIds(): Promise<string[]> {
  const emailConds = HIDDEN_TEST_EMAILS.map((e) =>
    Prisma.sql`CONVERT(JSON_UNQUOTE(JSON_EXTRACT(b.customerDetails, '$.email')) USING utf8mb4) COLLATE utf8mb4_unicode_ci = ${e}`
  );
  const nameConds = HIDDEN_TEST_NAMES.flatMap((n) => [
    Prisma.sql`CONVERT(JSON_UNQUOTE(JSON_EXTRACT(b.customerDetails, '$.fullName')) USING utf8mb4) COLLATE utf8mb4_unicode_ci = ${n}`,
    Prisma.sql`CONVERT(JSON_UNQUOTE(JSON_EXTRACT(b.customerDetails, '$.name')) USING utf8mb4) COLLATE utf8mb4_unicode_ci = ${n}`,
  ]);
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT b.id FROM Booking b WHERE ${Prisma.join([...emailConds, ...nameConds], ' OR ')}`;
  return rows.map((r) => r.id);
}

async function buildBookingWhereClause(query: any) {
  const { q, status, eventId, time, ids } = query;
  const whereClause: any = {};
  const andConditions: any[] = [];

  if (ids) {
    whereClause.id = { in: String(ids).split(',') };
    return whereClause;
  }

  const hiddenIds = await findHiddenTestBookingIds();
  if (hiddenIds.length) andConditions.push({ id: { notIn: hiddenIds } });

  if (q && String(q).trim()) {
    andConditions.push({ id: { in: await findBookingIdsForSearch(String(q)) } });
  }

  if (eventId) whereClause.eventId = eventId;

  if (status) {
    if (status === 'paid') whereClause.paid = true;
    else if (status === 'unpaid') whereClause.paid = false;
    else if (status !== 'all') {
      const mapped = STATUS_PSEUDO[String(status)];
      whereClause.status = mapped ? { in: mapped } : status;
    }
  } else {
    // Matukio's default view is "Active and Pending" until the admin picks
    // something else.
    whereClause.status = { in: ['CONFIRMED', 'PENDING'] };
  }

  if (time && time !== 'all') {
    const now = new Date();
    const daysByPeriod: Record<string, number> = { day: 1, week: 7, month: 30, year: 365 };
    const days = daysByPeriod[String(time)];
    if (days) whereClause.createdAt = { gte: new Date(now.getTime() - days * 24 * 60 * 60 * 1000) };
  }

  if (andConditions.length) whereClause.AND = andConditions;
  return whereClause;
}

function serializeBookingForList(b: any) {
  const { name: customerName, email: customerEmail } = resolveBookingCustomer(b);
  const bookedSeats = (b.items || []).reduce((sum: number, i: any) => sum + i.quantity, 0);
  return {
    ...b,
    customerName,
    customerEmail,
    bookedSeats,
    shortId: matukioBookingNumber(b.id),
  };
}

router.get('/', authenticateJWT, authorizeAdmin, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const { _sort, _order, _start, _end } = req.query;

    const whereClause = await buildBookingWhereClause(req.query);

    const skip = _start ? Number(_start) : 0;
    const take = _end ? Number(_end) - skip : 100;
    let sortField = String(_sort || 'createdAt');
    if (sortField === 'shortId') sortField = 'id';
    const validSortFields = ['id', 'status', 'totalPrice', 'createdAt', 'updatedAt', 'paid', 'certificated', 'checkedIn', 'eventId', 'userId'];
    if (!validSortFields.includes(sortField)) sortField = 'createdAt';

    const orderBy: any = { [sortField]: _order === 'DESC' ? 'desc' : 'asc' };

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where: whereClause,
        include: {
          user: true,
          event: true,
          items: { include: { ticket: true } },
          invoiceNumber: true,
        },
        skip,
        take,
        orderBy
      }),
      prisma.booking.count({ where: whereClause })
    ]);

    // Matches old's real behavior (MatukioHelperBasic::getInvoiceImage(),
    // called once per row the admin bookings template actually renders):
    // viewing this list lazily assigns a real sequential invoice number to
    // any visible booking on a paid event that doesn't have one yet. Run
    // sequentially (not Promise.all) so two still-unnumbered bookings on
    // the same page, same year, can never read the same "last number"
    // before either has committed its own.
    const bookingsWithInvoice: any[] = [];
    for (const b of bookings) {
      let inv: { number: number; year: number } | null = b.invoiceNumber;
      if (!inv && (b.event.feePerPerson ?? 0) > 0) {
        inv = await getOrCreateInvoiceNumber(b.id);
      }
      bookingsWithInvoice.push({ ...b, invoiceNumber: formatInvoiceNumber(inv) });
    }

    res.set('Content-Range', `bookings ${skip}-${skip + bookings.length}/${total}`);
    res.set('Access-Control-Expose-Headers', 'Content-Range');
    res.json(bookingsWithInvoice.map(serializeBookingForList));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// --- Bulk toolbar actions (mirrors the old Matukio admin toolbar) ---

router.post('/bulk/activate', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const { ids } = req.body as { ids: string[] };
    // Only email bookings that weren't already CONFIRMED - this used to
    // email every selected id unconditionally, so an admin bulk-selecting a
    // mix (or re-running the action, or just including an already-confirmed
    // row by mistake) silently resent a full "Buchungsbestätigung" (with
    // invoice/ticket PDF attachments) to customers who'd already gotten one,
    // weeks or months after their real booking - with no action on the
    // admin's side that looked like "sending an email" to explain why.
    const before = await prisma.booking.findMany({ where: { id: { in: ids } }, select: { id: true, status: true } });
    await prisma.booking.updateMany({ where: { id: { in: ids } }, data: { status: 'CONFIRMED' } });
    const newlyActivatedIds = before.filter((b) => b.status !== 'CONFIRMED').map((b) => b.id);
    for (const id of newlyActivatedIds) sendBookingConfirmationEmail(id).catch(console.error);
    res.json({ message: `${ids.length} Buchung(en) aktiviert.` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Restores a wastebasket (CANCELLED) booking back to CONFIRMED without ever
// emailing the customer - unlike /bulk/activate (which exists for genuinely
// confirming a live booking and deliberately does notify), undoing an
// accidental delete isn't an event the customer needs to hear about, and old
// Matukio's own "always notify on every status change" behavior was never
// something to replicate here (the admin explicitly asked not to).
router.post('/bulk/restore', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const { ids } = req.body as { ids: string[] };
    await prisma.booking.updateMany({ where: { id: { in: ids } }, data: { status: 'CONFIRMED' } });
    res.json({ message: `${ids.length} Buchung(en) wiederhergestellt.` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/bulk/pending', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const { ids } = req.body as { ids: string[] };
    // Previously also called sendBookingConfirmationEmail here, resending a
    // "your booking is confirmed" email while the action being performed was
    // the opposite - setting the booking BACK to pending/not-yet-confirmed.
    await prisma.booking.updateMany({ where: { id: { in: ids } }, data: { status: 'PENDING' } });
    res.json({ message: `${ids.length} Buchung(en) auf ausstehend gesetzt.` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/bulk/reject', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const { ids, subject, message } = req.body as { ids: string[]; subject: string; message: string };
    const bookings = await prisma.booking.findMany({
      where: { id: { in: ids } },
      include: { event: true, user: true },
    });

    const { transporter, config: mailConfig } = await getNewsletterTransporter();
    for (const booking of bookings) {
      const { name, email } = resolveBookingCustomer(booking);
      if (!email) continue;
      const personalizedSubject = subject.replace(/\{EVENT_TITLE\}/g, booking.event.title).replace(/\{BOOKING_NAME\}/g, name);
      const personalizedMessage = message
        .replace(/\{EVENT_TITLE\}/g, booking.event.title)
        .replace(/\{BOOKING_NAME\}/g, name);
      await transporter.sendMail({
        from: mailConfig?.fromEmail ? `"${mailConfig.fromName || 'Flugschule Hirondelle'}" <${mailConfig.fromEmail}>` : '"Flugschule Hirondelle" <info@fs-hirondelle.de>',
        to: email,
        subject: personalizedSubject,
        html: personalizedMessage.replace(/\n/g, '<br/>'),
      }).catch(console.error);
    }

    await prisma.booking.updateMany({ where: { id: { in: ids } }, data: { status: 'CANCELLED' } });
    res.json({ message: `${ids.length} Buchung(en) abgelehnt.` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/bulk/wastebasket', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const { ids } = req.body as { ids: string[] };
    await prisma.booking.updateMany({ where: { id: { in: ids } }, data: { status: 'CANCELLED' } });
    for (const id of ids) sendCancellationEmail(id, 'adminCancellation').catch(console.error);
    res.json({ message: `${ids.length} Buchung(en) in den Papierkorb verschoben.` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// "Empty trash" - real, irreversible deletion. Only meant to be used from the
// UI once the list is filtered to Storniert/deleted, but that's a UI-level
// guard, not something this endpoint itself restricts.
router.post('/bulk/empty-trash', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const { ids } = req.body as { ids: string[] };
    await prisma.booking.deleteMany({ where: { id: { in: ids } } });
    res.json({ message: `${ids.length} Buchung(en) endgültig gelöscht.` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/bulk/certificate', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const { ids, issue } = req.body as { ids: string[]; issue: boolean };
    await prisma.booking.updateMany({ where: { id: { in: ids } }, data: { certificated: !!issue } });

    if (issue) {
      const templatesConfig = await prisma.templatesConfig.findUnique({ where: { id: 'default' } });
      const cert = templatesConfig?.certificates as any;
      if (cert?.emailSubject && cert?.emailBody) {
        const bookings = await prisma.booking.findMany({ where: { id: { in: ids } }, include: { event: true, user: true } });
        const { transporter, config: mailConfig } = await getNewsletterTransporter();
        for (const booking of bookings) {
          const { email } = resolveBookingCustomer(booking);
          if (!email) continue;
          const placeholders = buildBookingPlaceholders(booking);
          const subject = renderMatTokens(cert.emailSubject, placeholders);
          const html = renderMatTokens(cert.emailBody, placeholders);
          const pdfBuffer = await generateCertificatePDF(booking.id).catch(() => null);
          await transporter.sendMail({
            from: mailConfig?.fromEmail ? `"${mailConfig.fromName || 'Flugschule Hirondelle'}" <${mailConfig.fromEmail}>` : '"Flugschule Hirondelle" <info@fs-hirondelle.de>',
            to: email,
            subject,
            html,
            attachments: pdfBuffer ? [{ filename: `Zertifikat_${placeholders.MAT_BOOKING_NUMBER}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }] : undefined,
          }).catch(console.error);
        }
      }
    }

    res.json({ message: issue ? `${ids.length} Zertifikat(e) ausgestellt.` : `${ids.length} Zertifikat(e) widerrufen.` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/bulk/checkin', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const { ids } = req.body as { ids: string[] };
    await prisma.booking.updateMany({ where: { id: { in: ids } }, data: { checkedIn: true } });
    res.json({ message: `${ids.length} Teilnehmer eingecheckt.` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/bulk/contact', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const { ids, subject, message } = req.body as { ids: string[]; subject: string; message: string };
    const bookings = await prisma.booking.findMany({
      where: { id: { in: ids } },
      include: { event: { include: { Organizer: true } }, user: true },
    });

    const { transporter, config: mailConfig } = await getNewsletterTransporter();
    let sent = 0;
    for (const booking of bookings) {
      const { email } = resolveBookingCustomer(booking);
      if (!email) continue;
      await transporter.sendMail({
        from: mailConfig?.fromEmail ? `"${mailConfig.fromName || 'Flugschule Hirondelle'}" <${mailConfig.fromEmail}>` : '"Flugschule Hirondelle" <info@fs-hirondelle.de>',
        replyTo: booking.event.Organizer?.email || undefined,
        to: email,
        subject,
        html: message.replace(/\n/g, '<br/>'),
      }).catch(console.error);
      sent++;
    }
    res.json({ message: `Nachricht an ${sent} Teilnehmer gesendet.` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Per-row "Paid" toggle. Matukio side effect: marking a booking paid while it
// isn't already confirmed auto-activates it.
router.put('/:id/paid', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const { paid } = req.body as { paid: boolean };
    const existing = await prisma.booking.findUnique({ where: { id: req.params.id as string } });
    if (!existing) return res.status(404).json({ message: 'Not found' });

    const shouldActivate = paid && existing.status === 'PENDING';
    const booking = await prisma.booking.update({
      where: { id: req.params.id as string },
      data: { paid: !!paid, ...(shouldActivate ? { status: 'CONFIRMED' } : {}) },
    });
    if (shouldActivate) sendBookingConfirmationEmail(booking.id).catch(console.error);
    res.json(booking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// --- Exports / print views ---

// Old Matukio's own CSV export literally emitted the "&euro;" HTML entity
// and a whole <table> of <tr><td> markup for the extras column (a bug in
// the old system, not a deliberate format) - byte-for-byte-replicating
// that here previously produced exactly what its name says: HTML entities
// and raw tags sitting in plain CSV cells, which Excel has no way to
// render, plus single-quoted fields instead of proper CSV quoting (which
// doesn't protect an embedded newline at all, so a multi-line remark blew
// a booking's row apart across several real spreadsheet rows). These now
// render as plain, clean text instead - real €, no markup, one row per
// booking - while keeping every one of old's columns and data.
function formatEuro(value: number): string {
  return `€ ${value.toFixed(2)}`;
}

function formatExtraOptionsList(selectedExtras: any[] | undefined): string {
  if (!selectedExtras || selectedExtras.length === 0) return 'Keine Optionen gebucht';
  return selectedExtras
    .map((e) => `${e.title} (${formatEuro(Number(e.value) || 0)}${e.perPlace ? ' pro Platz' : ''})`)
    .join('; ');
}

router.get('/export/csv', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const whereClause = await buildBookingWhereClause(req.query);
    const bookings = await prisma.booking.findMany({
      where: whereClause,
      include: { event: true, user: true, items: { include: { ticket: true } } },
      orderBy: { createdAt: 'desc' },
    });

    // Old Matukio always exported one event's bookings at a time, named
    // "{EventTitle}-{export date, Y-m-d}.csv" (components/com_matukio/
    // views/print/tmpl/csv.php). Matched here when the request is scoped to
    // a single event the same way; falls back to a generic name otherwise
    // since this route can also export an unfiltered/multi-event list,
    // which old's own export never supported.
    const todayYmd = new Date().toISOString().slice(0, 10);
    const exportFilename = req.query.eventId && bookings[0]?.event
      ? `${bookings[0].event.title}-${todayYmd}.csv`
      : `buchungen-${todayYmd}.csv`;

    const templatesConfig = await prisma.templatesConfig.findUnique({ where: { id: 'default' } });
    const csvTemplate = (templatesConfig?.csvXml as any)?.csvTemplate as string | undefined;

    let csv: string;

    if (csvTemplate && csvTemplate.trim()) {
      // Admin-configured template (Vorlagen > CSV und XML): a single row of
      // MAT_* tokens, e.g. "MAT_BOOKING_NAME;MAT_BOOKING_EMAIL;MAT_EVENT_TITLE".
      const tokens = parseCsvTemplateTokens(csvTemplate);
      const header = tokens.map(friendlyColumnName);
      const rows = bookings.map((b) => {
        const placeholders = buildBookingPlaceholders(b);
        return tokens.map((t) => placeholders[t] ?? t);
      });
      csv = [header, ...rows].map((r) => r.map(csvEscape).join(';')).join('\r\n');
    } else {
      // Matches old Matukio's real, live production CSV export template
      // (hiron_matukio_templates.tmpl_name = 'export_csv') field-for-field:
      // Buchungsnummer;Veranstaltungstitel;[Gebuchte Plätze;Anrede;
      // Vorname Nachname;Geburtsdatum;Gewicht in kg;Telefon/Mobil;E-Mail;
      // Straße;Postleitzahl;Ort;Bemerkung/Gutscheincode];
      // Gebühren (Brutto);Name;Zahlungsmethode;Status;
      // Zusätzliche auswählbare Gebühren/Optionen;Zahlungs-Status (Erweitert)
      const header = [
        'Buchungsnummer', 'Veranstaltungstitel', 'Gebuchte Plätze', 'Anrede',
        'Vorname Nachname', 'Geburtsdatum', 'Gewicht in kg', 'Telefon / Mobil',
        'E-Mail', 'Straße', 'Postleitzahl', 'Ort', 'Bemerkung / Gutscheincode',
        'Gebühren (Brutto)', 'Name', 'Zahlungsmethode', 'Status',
        'Zusätzliche auswählbare Gebühren / Optionen', 'Zahlungs-Status (Erweitert)',
      ];
      const rows = bookings.map((b) => {
        const { name, email } = resolveBookingCustomer(b);
        const details = (b.customerDetails as any) || {};
        const seats = b.items.reduce((s, i) => s + i.quantity, 0);
        return [
          matukioBookingNumber(b.id),
          b.event.title,
          String(seats),
          details.salutation || '',
          details.fullName || name,
          details.birthDate || '',
          details.sizeWeight || '',
          details.phone || '',
          email || '',
          details.street || '',
          details.zip || '',
          details.city || '',
          b.remarks || '',
          formatEuro(b.totalPrice),
          details.fullName || name,
          b.paymentMethod || '',
          OLD_STYLE_STATUS_LABEL[b.status] || b.status,
          formatExtraOptionsList(details.selectedExtras),
          'P', // old's own payment_status column - verified always 'P' across every historical booking, never varies
        ];
      });
      // Proper RFC4180 quoting (same csvEscape() used by the custom-template
      // branch above) - not old's single-quote scheme, which never protected
      // an embedded newline at all: a multi-line remark split its booking's
      // row across several real spreadsheet rows instead of staying in one
      // cell.
      csv = [header, ...rows]
        .map((r) => r.map(csvEscape).join(';'))
        .join('\r\n');
    }

    // filename= alone can't carry non-ASCII (ö/ü/ß etc.) per the HTTP spec;
    // filename*= (RFC 5987) is the correct UTF-8 form modern browsers use,
    // with the plain filename= as an ASCII-safe fallback for older ones.
    const asciiFilename = exportFilename.replace(/[^\x20-\x7E]/g, '_');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(exportFilename)}`);
    // sep=; as the literal first line is an Excel-specific hint: without it,
    // double-clicking the file makes Excel split columns using the
    // Windows-regional "list separator" (comma on an English-locale
    // machine) instead of the semicolon this file actually uses, dumping
    // every column into cell A. The BOM must still come first so Excel
    // also opens the UTF-8 umlauts/euro-sign correctly - built as an
    // explicit Buffer (not a literal source-file character before "sep=")
    // so it can't ever be silently lost/corrupted by a future save in a
    // different encoding.
    res.end(Buffer.from('﻿sep=;\r\n' + csv, 'utf8'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

const PRINT_LIST_PAGE_STYLE = `
  body { font-family: Arial, sans-serif; margin: 24px; }
  h1 { font-size: 18px; }
  table.mat-header-table { margin-bottom: 20px; }
  table.mat-header-table td, table.mat-row-table td { padding: 3px 8px; vertical-align: top; }
  table.mat-row-table { border: 1px solid #999; border-collapse: collapse; width: 100%; margin-bottom: 14px; }
  table.mat-row-table td { border: 1px solid #ccc; }
  @media print { body { margin: 0; } }
`;

// Old's real MatukioHelperBooking::getBookingIdQRCode() - a 150x150 PNG QR
// code encoding the booking's own number (not a URL), with that same
// number printed in bold underneath.
async function bookingQrCodeHtml(bookingId: string): Promise<string> {
  const number = matukioBookingNumber(bookingId);
  const dataUrl = await QRCode.toDataURL(number, { margin: 1, width: 150 });
  return `<img src="${dataUrl}" width="150" height="150" /><br/><code><b>${number}</b></code>`;
}

// Renders old's real two-part (header once + row repeated per booking)
// print-list structure through the MAT_* token engine. The header uses the
// FIRST booking's event - matches old's own real behavior closely (old's
// header is populated from a single explicit event_id when the admin
// prints one event's list at a time, which is this feature's actual use;
// an ad-hoc cross-event selection is a degenerate case old handled no
// better).
async function renderPrintListDocument(
  title: string,
  bookings: any[],
  headerTemplate: string,
  rowTemplate: string,
  withQrCode: boolean
): Promise<string> {
  const headerHtml = bookings.length
    ? renderMatTokens(headerTemplate, buildBookingPlaceholders(bookings[0]))
    : '';

  const rows: string[] = [];
  let nr = 1;
  for (const b of bookings) {
    const placeholders = buildBookingPlaceholders(b, nr);
    if (withQrCode) {
      placeholders.MAT_BOOKING_QRCODE_ID = await bookingQrCodeHtml(b.id);
    }
    rows.push(renderMatTokens(rowTemplate, placeholders));
    nr++;
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>${PRINT_LIST_PAGE_STYLE}</style>
</head><body>
  <h1>${escapeHtml(title)}</h1>
  ${headerHtml}
  ${rows.join('')}
  <script>window.onload = () => window.print();</script>
</body></html>`;
}

router.get('/export/participant-list', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const whereClause = await buildBookingWhereClause(req.query);
    const bookings = await prisma.booking.findMany({
      where: whereClause,
      include: { event: true, user: true, items: { include: { ticket: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const templatesConfig = await prisma.templatesConfig.findUnique({ where: { id: 'default' } });
    const listViews = (templatesConfig?.listViews as any) || {};
    const header = listViews.participantListHeader || DEFAULT_PARTICIPANT_LIST_HEADER;
    const row = listViews.participantListRow || DEFAULT_PARTICIPANT_LIST_ROW;
    res.send(await renderPrintListDocument('Teilnehmerliste', bookings, header, row, true));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/export/signature-list', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const whereClause = await buildBookingWhereClause(req.query);
    const bookings = await prisma.booking.findMany({
      where: whereClause,
      include: { event: true, user: true, items: { include: { ticket: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const templatesConfig = await prisma.templatesConfig.findUnique({ where: { id: 'default' } });
    const listViews = (templatesConfig?.listViews as any) || {};
    const header = listViews.signatureListHeader || DEFAULT_SIGNATURE_LIST_HEADER;
    const row = listViews.signatureListRow || DEFAULT_SIGNATURE_LIST_ROW;
    res.send(await renderPrintListDocument('Unterschriftenliste', bookings, header, row, false));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/:id/name-tag', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const pdfBuffer = await generateNameTagPDF(req.params.id as string);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Namensschild_${String(req.params.id).split('-')[0].toUpperCase()}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error generating name tag' });
  }
});

router.get('/:id', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id as string },
      include: {
        user: true,
        // Nested tickets: the admin edit panel needs the event's full
        // ticket-type list to offer changing which one this booking is
        // for (old Matukio's editable "type" dropdown), not just the one
        // already booked (that's items[].ticket, included separately below).
        event: { include: { tickets: { orderBy: { order: 'asc' } } } },
        items: { include: { ticket: true } }
      }
    });
    if (!booking) return res.status(404).json({ message: 'Not found' });
    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

class BookingRequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Shared, atomic booking-creation path used by both POST / and POST /public.
// Two concurrency bugs fixed here vs the old duplicated logic in each route:
//   1. Voucher redemption was check-then-increment as two separate statements,
//      so two concurrent requests on a near-limit voucher could both pass the
//      check and over-redeem it. The increment now happens first inside a real
//      DB transaction (which takes a row lock on the voucher via the UPDATE),
//      and only *then* do we check whether it went over the limit - if so we
//      throw and the whole transaction (including the increment) rolls back.
//   2. Ticket-capacity was checked, then the booking created, as separate
//      steps - two concurrent requests for the last slot could both pass and
//      both get created. `SELECT ... FOR UPDATE` now locks the ticket row for
//      the duration of the transaction so a second concurrent request blocks
//      until the first commits (or rolls back), then re-reads a correct count.
// Also: only an explicit allowlist of fields is ever written - no `...req.body`
// spread - so a caller can never set paid/certificated/checkedIn/adminComment/
// rating on their own booking.
// Old Matukio's matukioccnewsletter plugin: if the booking form's newsletter
// checkbox was ticked, subscribe the customer via the real (double-opt-in-
// respecting) subscribe flow - never silently, and never if they left the
// checkbox unchecked (see EventBookingModal.tsx's optional toggle).
async function subscribeFromBookingCheckbox(customerDetails: any) {
  if (!customerDetails?.newsletterOptIn || !customerDetails?.email) return;
  await subscribeToNewsletter(customerDetails.email, customerDetails.fullName, 'GENERAL', { source: 'booking' });
}

async function createBookingAtomic(params: {
  eventId: string;
  items: { ticketId: string; quantity: number }[] | undefined;
  customerDetails: any;
  paymentMethod: string | undefined;
  remarks: string | undefined;
  voucherCode: string | undefined;
  userId: string | undefined;
  isRegisteredUser: boolean;
  selectedExtraOptions: number[] | undefined;
}) {
  const { eventId, items, customerDetails, paymentMethod, remarks, voucherCode, userId, isRegisteredUser, selectedExtraOptions } = params;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new BookingRequestError(404, 'Event not found');
  if (event.registrationDeadline && new Date() > new Date(event.registrationDeadline)) {
    throw new BookingRequestError(400, 'Registration deadline has passed');
  }
  // Old's real event.nrbooked==0 ('none' Buchungs-Typ) - online booking is
  // entirely off for this event. The UI already hides the booking button
  // for this, but the route itself has to refuse it too (a client calling
  // this endpoint directly bypasses whatever the UI does or doesn't show).
  if (event.bookingType === 'none') {
    throw new BookingRequestError(400, 'Diese Veranstaltung kann nicht online gebucht werden.');
  }
  // Old's real nrbooked (admin label "Max. buchbare Plätze") caps how many
  // seats ONE booking can request at all (layouts/fees/feequantity.php:24's
  // dropdown-build loop) - only enforced when an admin actually set it, so
  // events that never had this touched aren't newly capped at some
  // arbitrary number.
  if (event.maxBookablePerPerson && items && items.length > 0) {
    const requestedTotal = items.reduce((sum, i) => sum + Number(i.quantity), 0);
    if (requestedTotal > event.maxBookablePerPerson) {
      throw new BookingRequestError(400, `Maximal ${event.maxBookablePerPerson} Plätze pro Buchung`);
    }
  }

  // Reject the whole request up front if any item has a non-positive/non-
  // integer quantity (a negative value would otherwise drive the price
  // negative - clamped to a free €0 booking - while still permanently
  // deflating this ticket's booked-count in future capacity checks below),
  // or if any ticketId doesn't actually belong to this event (which would
  // let a caller borrow another event's ticket price/capacity accounting
  // while the booking shows up on this event's participant list instead).
  if (items && items.length > 0) {
    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        throw new BookingRequestError(400, 'Ungültige Anzahl');
      }
    }
    const ticketIds = items.map((i) => i.ticketId);
    const validTickets = await prisma.eventTicket.findMany({ where: { id: { in: ticketIds }, eventId } });
    const validTicketIds = new Set(validTickets.map((t) => t.id));
    if (ticketIds.some((id) => !validTicketIds.has(id))) {
      throw new BookingRequestError(400, 'Ungültiges Ticket für dieses Event');
    }
  }

  // Authoritative price calculation (tiered-fee + voucher discounts + selectable extras applied server-side)
  const priceResult = await calculateBookingPrice(eventId, items, voucherCode, isRegisteredUser, selectedExtraOptions);
  if (voucherCode && !priceResult.appliedVoucherCode) {
    throw new BookingRequestError(400, 'Ungültiger Gutschein');
  }

  if (priceResult.appliedVoucherCode && customerDetails) {
    customerDetails.appliedVoucher = priceResult.appliedVoucherCode;
  }

  return prisma.$transaction(async (tx) => {
    // Determine Status (WAITLIST if the event's pooled capacity is
    // exceeded). Old Matukio has no per-ticket-type capacity at all -
    // getEventBookableArray() computes ONE freieplaetze = maxpupil - gebucht
    // for the whole event, summing nrbooked across every booking regardless
    // of which fee/ticket type it picked. migrate_old_data.ts carried
    // maxpupil into every one of an event's EventTicket rows as that ticket's
    // own `capacity` (same number, once per ticket) - so an event with 3
    // ticket types and maxpupil 26 ended up with three *independent* pools
    // of 26 instead of one shared pool of 26, letting up to 3x the real
    // capacity get CONFIRMED. Check the event-wide pool instead, matching
    // old's actual behavior; EventTicket.capacity is no longer used for
    // this decision.
    let finalStatus = 'PENDING';
    if (items && items.length > 0) {
      const poolCapacity = event.maxParticipants ?? event.capacity;
      // maxParticipants/capacity <= 0 means "unlimited" (matches Events.tsx's
      // own traffic-light logic) - never waitlist those.
      if (poolCapacity > 0) {
        // Lock every ticket belonging to this event (one statement, not one
        // per requested ticket) so a concurrent booking against a *different*
        // ticket type on the same event can't race past this pooled check.
        await tx.$queryRaw`SELECT et.id FROM EventTicket et WHERE et.eventId = ${eventId} FOR UPDATE`;
        const eventTickets = await tx.eventTicket.findMany({
          where: { eventId },
          include: { items: { include: { booking: { select: { status: true } } } } }
        });
        // Same fix as events.routes.ts's bookedCount: only CONFIRMED reduces
        // real capacity (matches old Matukio's ACTIVE-only rule) - this
        // filter previously excluded only 'CANCELLED', a status this schema
        // never uses, so WAITLIST/COMPLETED bookings were incorrectly
        // counted here too, pushing brand-new bookings onto the waitlist
        // even when real seats were still open.
        const totalBookedAcrossEvent = eventTickets.reduce((sum, t) =>
          sum + t.items
            .filter(i => i.booking.status === 'CONFIRMED')
            .reduce((s, i) => s + i.quantity, 0), 0);
        const requestedQuantity = items.reduce((sum, i) => sum + Number(i.quantity), 0);

        if (totalBookedAcrossEvent + requestedQuantity > poolCapacity) {
          finalStatus = 'WAITLIST';
        }
      }
    }

    // Only consume the voucher's redemption slot once the booking actually
    // has a real seat - a waitlisted booking has no guaranteed seat, so
    // burning a limited-use voucher on it would deny it to a customer who
    // actually gets in. The discount still applies to totalPrice either way
    // (calculated above) and customerDetails.appliedVoucher (set above)
    // still records which code was used, for if/when they're promoted.
    if (priceResult.appliedVoucherCode && finalStatus !== 'WAITLIST') {
      const voucher = await tx.voucher.update({
        where: { code: priceResult.appliedVoucherCode },
        data: { usedCount: { increment: 1 } }
      });
      if (voucher.limit !== 0 && voucher.usedCount > voucher.limit) {
        throw new BookingRequestError(400, 'Ungültiger Gutschein');
      }
    }

    const booking = await tx.booking.create({
      data: {
        eventId,
        userId,
        status: finalStatus as any,
        totalPrice: priceResult.finalPrice,
        priceNet: priceResult.priceNet ?? undefined,
        priceTax: priceResult.priceTax ?? undefined,
        priceTaxRatePercent: priceResult.taxRatePercent ?? undefined,
        voucherCode: priceResult.appliedVoucherCode ?? undefined,
        customerDetails: customerDetails ?? undefined,
        paymentMethod: paymentMethod ?? undefined,
        remarks: remarks ?? undefined,
        items: items ? {
          create: items.map((i) => ({
            ticketId: i.ticketId,
            quantity: Number(i.quantity)
          }))
        } : undefined
      },
      include: { items: { include: { ticket: true } } }
    });

    return booking;
  });
}

router.post('/', async (req: any, res) => {
  try {
    // Optional Authentication
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
      } catch (err) {
        // Ignore invalid token, treat as guest
      }
    }

    const { items, customerDetails, paymentMethod, remarks, eventId, voucherCode, selectedExtraOptions } = req.body;

    const booking = await createBookingAtomic({
      eventId,
      items,
      customerDetails,
      paymentMethod,
      remarks,
      voucherCode,
      userId: req.user?.id,
      isRegisteredUser: !!req.user,
      selectedExtraOptions
    });

    // Send confirmation email asynchronously
    sendBookingConfirmationEmail(booking.id).catch(console.error);
    subscribeFromBookingCheckbox(customerDetails).catch(console.error);

    res.status(201).json(booking);
  } catch (error) {
    if (error instanceof BookingRequestError) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Public booking route for guests
router.post('/public', async (req, res) => {
  try {
    const { items, eventId, customerDetails, paymentMethod, remarks, voucherCode, selectedExtraOptions } = req.body;

    if (!eventId) {
      return res.status(400).json({ message: 'Event ID is required' });
    }

    const booking = await createBookingAtomic({
      eventId,
      items,
      customerDetails,
      paymentMethod,
      remarks,
      voucherCode,
      userId: undefined,
      isRegisteredUser: false,
      selectedExtraOptions
    });

    // Send confirmation email asynchronously
    sendBookingConfirmationEmail(booking.id).catch(console.error);
    subscribeFromBookingCheckbox(customerDetails).catch(console.error);

    res.status(201).json(booking);
  } catch (error) {
    if (error instanceof BookingRequestError) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    // totalPrice is deliberately never settable through this generic admin
    // edit route - it must stay tied to the actual booked items/tickets
    // (recomputed via calculateBookingPrice, see updateAmount below).
    // notifyParticipant/notifyParticipantInvoice/updateAmount are old
    // Matukio's real "Benachrichtigungen und Aktualisierungen" checkboxes
    // (administrator/components/com_matukio/layouts/booking/edit.php) -
    // one-time actions to run as part of THIS save, not booking fields.
    const { items, id, user, event, totalPrice, eventId, userId, notifyParticipant, notifyParticipantInvoice, updateAmount, ...bookingData } = req.body;
    if (items && items.some((i: any) => !Number.isInteger(Number(i.quantity)) || Number(i.quantity) < 1)) {
      return res.status(400).json({ message: 'Ungültige Anzahl' });
    }
    const existing = await prisma.booking.findUnique({ where: { id: req.params.id as string } });
    if (!existing) return res.status(404).json({ message: 'Buchung nicht gefunden' });

    const updateData: any = { ...bookingData };

    // Old's real "Veranstaltung"/"Benutzer" selects (General Booking
    // Settings card) - reassigns which event/registered user this booking
    // belongs to. Changing the event requires the submitted items to
    // already reference that new event's own tickets (the frontend resets
    // them on event change) - otherwise a booking could end up pointing at
    // ticket rows from a completely different event.
    if (eventId !== undefined && eventId !== existing.eventId) {
      const newEvent = await prisma.event.findUnique({ where: { id: eventId } });
      if (!newEvent) return res.status(400).json({ message: 'Veranstaltung nicht gefunden' });
      const newItems = items || [];
      if (newItems.length === 0) {
        return res.status(400).json({ message: 'Beim Wechsel der Veranstaltung müssen die Tickets neu ausgewählt werden' });
      }
      const ticketIds: string[] = newItems.map((i: any) => i.ticketId);
      const validTickets = await prisma.eventTicket.findMany({ where: { id: { in: ticketIds }, eventId } });
      if (validTickets.length !== new Set(ticketIds).size) {
        return res.status(400).json({ message: 'Ein oder mehrere Tickets gehören nicht zur ausgewählten Veranstaltung' });
      }
      updateData.eventId = eventId;
    }
    if (userId !== undefined) {
      updateData.userId = userId || null;
    }

    let booking = await prisma.booking.update({
      where: { id: req.params.id as string },
      data: {
        ...updateData,
        items: items ? {
          deleteMany: {},
          create: items.map((i: any) => ({
            ticketId: i.ticketId,
            quantity: Number(i.quantity)
          }))
        } : undefined
      },
      include: { items: { include: { ticket: true } } }
    });
    if (bookingData.status === 'CANCELLED' && existing?.status !== 'CANCELLED') {
      sendCancellationEmail(booking.id, 'adminCancellation');
    }

    if (updateAmount && existing) {
      // Re-derive from the (possibly just-changed) items/tickets/voucher/
      // extras from THIS save (booking, not existing - so applying a new
      // coupon or toggling an extra and checking "update amount" in the
      // same save reflects the change immediately) - old's "Betrag
      // aktualisieren" for when an admin adjusts the booking and the total
      // needs recomputing to match.
      const priceResult = await calculateBookingPrice(
        booking.eventId,
        booking.items.map((i) => ({ ticketId: i.ticketId, quantity: i.quantity })),
        booking.voucherCode || undefined,
        !!booking.userId
      );
      const storedExtras = (booking.customerDetails as any)?.selectedExtras;
      const extrasTotal = Array.isArray(storedExtras)
        ? storedExtras.reduce((sum: number, ex: any) => {
            const value = Number(ex.value) || 0;
            const seats = booking.items.reduce((s, i) => s + i.quantity, 0);
            return sum + (ex.perPlace ? value * seats : value);
          }, 0)
        : 0;
      const finalPrice = Math.max(0, priceResult.finalPrice + extrasTotal);
      const taxRatePercent = priceResult.taxRatePercent;
      const priceNet = taxRatePercent ? finalPrice / (1 + taxRatePercent / 100) : null;
      const priceTax = priceNet !== null ? finalPrice - priceNet : null;
      booking = await prisma.booking.update({
        where: { id: booking.id },
        data: { totalPrice: finalPrice, priceNet: priceNet ?? undefined, priceTax: priceTax ?? undefined, priceTaxRatePercent: taxRatePercent ?? undefined },
        include: { items: { include: { ticket: true } } }
      });
    }

    if (notifyParticipant || notifyParticipantInvoice) {
      sendBookingConfirmationEmail(booking.id).catch(console.error);
    }

    res.json(booking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Customer self-service: cancel their own booking
router.post('/:id/cancel', authenticateJWT, async (req: any, res) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id as string }, include: { event: true } });
    if (!booking) return res.status(404).json({ message: 'Not found' });
    if (booking.userId !== req.user.id) return res.status(403).json({ message: 'Nicht erlaubt' });
    if (booking.status === 'CANCELLED') return res.status(400).json({ message: 'Diese Buchung ist bereits storniert' });
    if (!['PENDING', 'CONFIRMED', 'WAITLIST'].includes(booking.status)) {
      return res.status(400).json({ message: 'Diese Buchung kann nicht mehr storniert werden' });
    }

    // old: booking_stornotage (default 28, real live value) - self-service
    // cancellation only within this many days of the event's end (old
    // literally aliases this to $event->end, see submit.php), and only for
    // still-unpaid bookings; -1 disables self-cancellation entirely. This
    // matched the button's own visibility condition on old's real booking
    // page, not something this app enforced before.
    if (booking.paid) {
      return res.status(400).json({ message: 'Bereits bezahlte Buchungen können nicht selbst storniert werden - bitte kontaktieren Sie uns direkt.' });
    }
    const settings = await getSettingsConfig();
    const deadline = booking.event.endDate || booking.event.startDate;
    const daysRemaining = (deadline.getTime() - Date.now()) / 86400000;
    if (settings.bookingStornotage === -1 || daysRemaining < settings.bookingStornotage) {
      return res.status(400).json({ message: `Diese Buchung kann nicht mehr selbst storniert werden (nur bis ${settings.bookingStornotage} Tage vor der Veranstaltung möglich) - bitte kontaktieren Sie uns direkt.` });
    }

    const updated = await prisma.booking.update({
      where: { id: req.params.id as string },
      data: { status: 'CANCELLED' }
    });
    sendCancellationEmail(updated.id, 'userCancellation');
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Customer self-service: update their own customer/contact details on a booking
router.put('/:id/my-details', authenticateJWT, async (req: any, res) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id as string } });
    if (!booking) return res.status(404).json({ message: 'Not found' });
    if (booking.userId !== req.user.id) return res.status(403).json({ message: 'Nicht erlaubt' });
    if (booking.status === 'CANCELLED') return res.status(400).json({ message: 'Stornierte Buchungen können nicht bearbeitet werden' });

    // Matches the real shape the 3-step booking form (EventBookingModal)
    // actually saves - a single fullName, not firstName/lastName - plus the
    // co-participant list and any per-event custom form fields.
    const allowedFields = ['salutation', 'fullName', 'birthDate', 'sizeWeight', 'email', 'phone', 'street', 'zip', 'city', 'country'];
    const incoming = req.body || {};
    const currentDetails = (booking.customerDetails as any) || {};
    const newDetails = { ...currentDetails };
    for (const field of allowedFields) {
      if (incoming[field] !== undefined) newDetails[field] = incoming[field];
    }
    if (Array.isArray(incoming.additionalParticipants)) {
      newDetails.additionalParticipants = incoming.additionalParticipants;
    }
    if (incoming.customFields && typeof incoming.customFields === 'object') {
      newDetails.customFields = { ...(currentDetails.customFields || {}), ...incoming.customFields };
    }

    const updated = await prisma.booking.update({
      where: { id: req.params.id as string },
      data: { customerDetails: newDetails }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/:id', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    await prisma.booking.delete({ where: { id: req.params.id as string } });
    res.json({ id: req.params.id });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
