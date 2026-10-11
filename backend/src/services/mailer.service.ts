import nodemailer from 'nodemailer';
import { prisma } from '../utils/prisma';
import { generateInvoicePDF, generateTicketPDF } from './pdf.service';
import { getNewsletterTransporter } from '../utils/newsletterTransporter';
import { resolveBookingCustomer } from '../utils/bookingCustomer';
import { getSettingsConfig } from '../routes/settingsConfig.routes';
import { buildBookingPlaceholders, renderMatTokens, matukioBookingNumber } from '../utils/matukioTemplates';
import { getOrCreateInvoiceNumber, formatInvoiceNumber } from '../utils/invoiceNumber';

// Matches old Matukio's real, live mail_booking template content
// (hiron_matukio_templates id=1) as closely as this app's data model allows -
// verified word-for-word against the restored production DB. Old's own
// subject is "##COM_MATUKIO_EVENT## MAT_EVENT_SEMNUM: MAT_EVENT_TITLE"
// ("Veranstaltung" is a real translated string; MAT_EVENT_SEMNUM is the
// event's own number). Old's real body text never mentions an attached
// invoice or ticket at all (the invoice is its own separate email - see
// sendInvoiceEmail below), lists booking details BEFORE event details, and
// uses "Sehr geehrte/geehrter" as its greeting (old's real
// COM_MATUKIO_EMAIL_GREETING language key is itself missing/untranslated
// even in old's own real installed language files - this uses the same
// greeting the rest of this app's own templates already settled on, rather
// than reproducing that literal untranslated placeholder to real customers).
// Old's own template also has a "view your booking online" link
// (MAT_BOOKING_DETAILPAGE) - omitted here since it points at a page a GUEST
// booking (no login) could open via a UUID, and this app's only equivalent
// (Profil "Meine Buchungen") requires a login old's version didn't.
export const DEFAULT_BOOKING_CONFIRMATION_TEMPLATE = {
  subject: 'Veranstaltung {EVENT_NUMBER}: {EVENT_TITLE}',
  bodyHtml: `<p>Sehr geehrte/geehrter {BOOKING_NAME},<br/><br/>vielen Dank für Ihre Buchung.<br/><br/>Ihre Buchungsdetails:<br/>{BOOKING_DETAILS}<br/><br/>Veranstaltungsdetails:<br/>{EVENT_DETAILS}</p>
<hr/>
<p>Die Kursgebühr wird 4 Wochen vor Kursbeginn fällig. Bei Kurzfristbuchungen (ab vier Wochen vor Kursbeginn) wird der gesamte Kurspreis sofort fällig.</p>
<p>Wir führen eine echte Warteliste (der Kurs ist dann tatsächlich ausgebucht). Buchungen auf Warteliste sind daher erst zu bezahlen, wenn die Teilnahme auch sicher - und der Platz verbindlich bestätigt ist.</p>
<p><strong>Bankverbindung</strong><br/>Kontoinhaber: Alexander Schlink<br/>Sparkasse Südpfalz<br/>IBAN: DE32 5485 0010 1700 1976 41<br/>BIC: SOLADES1SUW</p>
<hr/>
<p style="color: #ff0000;">Wir empfehlen zur Absicherung für Stornos / Absagen den Abschluss einer Seminarversicherung bzw. für unsere mehrtätigen Kurse / Reisen zusätzlich eine Reiseversicherung. Infos dazu findet ihr auf unserer Seite <a href="https://www.fs-hirondelle.de/infos/versicherungen" style="color: #ff0000;">https://www.fs-hirondelle.de/infos/versicherungen</a>.</p>
<hr/>
<p>Mit freundlichen Grüßen,<br/>Ihr Team der Flugschule Hirondelle</p>`,
  bodyText: `Sehr geehrte/geehrter {BOOKING_NAME},

vielen Dank für Ihre Buchung.

Ihre Buchungsdetails:
{BOOKING_DETAILS}

Veranstaltungsdetails:
{EVENT_DETAILS}

Die Kursgebühr wird 4 Wochen vor Kursbeginn fällig. Bei Kurzfristbuchungen (ab vier Wochen vor Kursbeginn) wird der gesamte Kurspreis sofort fällig.

Wir führen eine echte Warteliste (der Kurs ist dann tatsächlich ausgebucht). Buchungen auf Warteliste sind daher erst zu bezahlen, wenn die Teilnahme auch sicher - und der Platz verbindlich bestätigt ist.

Bankverbindung
Kontoinhaber: Alexander Schlink
Sparkasse Südpfalz
IBAN: DE32 5485 0010 1700 1976 41
BIC: SOLADES1SUW

Wir empfehlen zur Absicherung für Stornos / Absagen den Abschluss einer Seminarversicherung bzw. für unsere mehrtätigen Kurse / Reisen zusätzlich eine Reiseversicherung. Infos dazu findet ihr auf unserer Seite https://www.fs-hirondelle.de/infos/versicherungen.

Mit freundlichen Grüßen,
Ihr Team der Flugschule Hirondelle`,
};

export async function sendBookingConfirmationEmail(bookingId: string) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        event: true,
        user: true,
        items: { include: { ticket: true } }
      }
    });

    if (!booking) {
      console.error('Booking not found for mailer');
      return;
    }

    // old: sendmail_teilnehmer - matches this session's Settings audit finding
    // that the new app had no way to turn the customer's own confirmation
    // email off, unlike old's real admin capability. Old gates both the
    // booking-confirmation email AND the separate invoice email on this same
    // setting (events.php:472/573), so both calls live inside this branch.
    const settings = await getSettingsConfig();
    if (!settings.sendmailTeilnehmer) {
      console.log('Booking confirmation email skipped: sendmailTeilnehmer is disabled in Settings.');
    } else {
      await sendCustomerConfirmationEmail(booking, settings);
      await sendInvoiceEmail(booking, settings).catch(console.error);
    }

    // old: sendmail_owner - a copy of every new booking sent to the school
    // itself, off by default on the real site (and here) since it has no
    // meaningful default recipient until an admin sets one.
    if (settings.sendmailOwner && settings.ownerNotificationEmail) {
      await sendOwnerNotificationEmail(booking, settings.ownerNotificationEmail, settings.emailBcc).catch(console.error);
    }
  } catch (error) {
    console.error('Error in sendBookingConfirmationEmail:', error);
  }
}

// Old's real status-dependent opening line (events.php:439-450,
// COM_MATUKIO_YOU_ARE_BOOKED_ON_THE_WAITING_LIST /
// _YOUR_BOOKING_IS_ACTIVE_AND_RESERVED / _YOUR_BOOKING_IS_PENDING_AND_NOT_RESERVED)
// - server-injected ahead of the admin's own editable template text, not
// itself part of that editable template, exactly like old's own
// $start .= JText::_(...) before $template->value.
function statusIntroLine(status: string): string {
  if (status === 'WAITLIST') {
    return 'Da die maximale Teilnehmerzahl bereits erreicht war, wurden Sie auf die Warteliste gesetzt.';
  }
  if (status === 'CONFIRMED') {
    return 'Ihre Buchung ist aktiv und Ihre Plätze sind reserviert!';
  }
  if (status === 'PENDING') {
    return 'Ihre Buchung ist schwebend und Ihre Plätze wurden noch nicht reserviert! (Zum Beispiel wegen noch ausstehender Zahlung)';
  }
  return '';
}

async function sendCustomerConfirmationEmail(booking: any, settings: { sendmailTicket: boolean; emailBcc?: string | null }) {
  try {
    const bookingId = booking.id;
    // Old only attaches the ticket once the booking is actually ACTIVE
    // (events.php:461-463) - a pending/waitlisted booking has no confirmed
    // seat yet, so there's nothing to check in with.
    const ticketBuffer = (settings.sendmailTicket && booking.status === 'CONFIRMED')
      ? await generateTicketPDF(bookingId)
      : null;

    let config = await prisma.templatesConfig.findUnique({ where: { id: 'default' } });

    let template = config?.emails ? (config.emails as any).bookingConfirmation : null;

    if (!template) {
      console.warn('Booking confirmation template missing in DB. Using fallback template.');
      template = DEFAULT_BOOKING_CONFIRMATION_TEMPLATE;
    }

    // Prepare placeholders
    const { name: customerName, email: customerEmail } = resolveBookingCustomer(booking);

    if (!customerEmail) {
      console.error('Customer email missing');
      return;
    }

    let locationName = booking.event.location || 'Siehe Website';
    if (!booking.event.location && booking.event.locationId) {
      const loc = await prisma.location.findUnique({ where: { id: booking.event.locationId } });
      if (loc) locationName = loc.title;
    }

    // Matches old's real getEmailEventInfoHTML() table structure exactly
    // (bold title row, then Beginn/Ende/Ort rows) - templates.php:1357-1420.
    const eventDetails = `
      <table cellpadding="2" border="0" width="100%">
        <tr><td colspan="2"><strong>${booking.event.title}</strong></td></tr>
        <tr><td style="width:180px">Beginn: </td><td>${new Date(booking.event.startDate).toLocaleString('de-DE')}</td></tr>
        ${booking.event.endDate ? `<tr><td>Ende: </td><td>${new Date(booking.event.endDate).toLocaleString('de-DE')}</td></tr>` : ''}
        <tr><td>Ort: </td><td>${locationName}</td></tr>
      </table>
    `;

    let ticketRows = '';
    let itemsTotal = 0;
    booking.items.forEach((item: any) => {
      itemsTotal += item.quantity * item.ticket.price;
      ticketRows += `<li>${item.quantity}x ${item.ticket.name} (${item.ticket.price} €)</li>`;
    });
    // Tickets are listed at full price above; if a voucher/tiered-fee
    // discount was applied, totalPrice is lower than that sum - show the
    // discount explicitly so the numbers in the email actually add up.
    const discount = itemsTotal - booking.totalPrice;
    const discountRow = discount > 0.01
      ? `<strong>Rabatt:</strong> -${discount.toFixed(2)} €<br/>`
      : '';

    const bookingDetails = `
      <strong>Buchungs-ID:</strong> ${booking.id}<br/>
      <strong>Tickets:</strong><ul>${ticketRows}</ul>
      ${discountRow}<strong>Gesamtpreis:</strong> ${booking.totalPrice} €
    `;

    // Replace placeholders in subject and body - {EVENT_NUMBER} matches old's
    // real MAT_EVENT_SEMNUM token in the subject (empty string if the event
    // has none set, exactly like old's plain str_replace would leave it).
    let subject = template.subject
      .replace(/{EVENT_TITLE}/g, booking.event.title)
      .replace(/{EVENT_NUMBER}/g, booking.event.eventNumber || '');
    let bodyHtml = template.bodyHtml
      .replace(/{BOOKING_NAME}/g, customerName)
      .replace(/{EVENT_TITLE}/g, booking.event.title)
      .replace(/{EVENT_NUMBER}/g, booking.event.eventNumber || '')
      .replace(/{EVENT_DETAILS}/g, eventDetails)
      .replace(/{BOOKING_DETAILS}/g, bookingDetails);

    const intro = statusIntroLine(booking.status);
    if (intro) bodyHtml = `<p>${intro}</p>` + bodyHtml;

    const attachments: { filename: string; content: Buffer; contentType: string }[] = [];
    if (ticketBuffer) attachments.push({ filename: `Ticket_${matukioBookingNumber(booking.id)}.pdf`, content: ticketBuffer, contentType: 'application/pdf' });

    const { transporter, isTestMode, testAccountUser, config: mailConfig } = await getNewsletterTransporter();
    const info = await transporter.sendMail({
      from: mailConfig?.fromEmail ? `"${mailConfig.fromName || 'Flugschule Hirondelle'}" <${mailConfig.fromEmail}>` : '"Flugschule Hirondelle" <info@fs-hirondelle.de>',
      to: customerEmail,
      bcc: settings.emailBcc || undefined,
      subject: subject,
      html: bodyHtml,
      attachments
    });

    console.log('Booking confirmation email sent: %s', info.messageId);
    if (isTestMode) {
      console.log('No real SMTP configured yet (AcyMailing > Konfiguration) - test preview URL:', nodemailer.getTestMessageUrl(info), testAccountUser);
    }

  } catch (error) {
    console.error('Error sending booking confirmation email:', error);
  }
}

// Old sends the invoice as its OWN separate email (events.php:557-587,
// template id=9 "invoice_email"), not bundled into the booking confirmation
// (which only ever carries the ticket - see sendCustomerConfirmationEmail).
// Real gate, verified directly against events.php:558-562: only once the
// booking is ACTIVE (our CONFIRMED) and its own final charged amount
// (payment_brutto, i.e. totalPrice) is > 0 - a free/fully-discounted booking
// gets no invoice email at all, matching generateInvoicePDF's own
// MAT_INVOICE_NUMBER blanking rule (pdf.service.ts).
async function sendInvoiceEmail(booking: any, settings: { sendmailInvoice: boolean; emailBcc?: string | null }) {
  if (!settings.sendmailInvoice) return;
  if (booking.status !== 'CONFIRMED') return;
  if (!(booking.totalPrice > 0)) return;

  try {
    const { email: customerEmail } = resolveBookingCustomer(booking);
    if (!customerEmail) {
      console.error('Customer email missing for invoice email');
      return;
    }

    const config = await prisma.templatesConfig.findUnique({ where: { id: 'default' } });
    const invoiceTemplate = (config?.invoices as any) || {};

    const invoiceNumber = await getOrCreateInvoiceNumber(booking.id);
    const placeholders = buildBookingPlaceholders(booking);
    placeholders.MAT_INVOICE_NUMBER = formatInvoiceNumber(invoiceNumber) || '';

    // Matches old's real seeded template (hiron_matukio_templates id=9)
    // word-for-word, used if the admin hasn't customized Vorlagen > Rechnung.
    const subjectTemplate = invoiceTemplate.emailSubject || 'Ihre Rechnung MAT_BOOKING_NUMBER';
    const bodyTemplate = invoiceTemplate.emailBody
      || '<div id="mat-invoice-mail"><p><span style="line-height: 1.3em;">Sehr geehrte / geehrter MAT_BOOKING_NAME,<br /><br /></span>im Anhang finden Sie die Rechnung zu Ihrer Buchung.</p><p>MAT_SIGNATURE</p></div>';

    const subject = renderMatTokens(subjectTemplate, placeholders);
    const bodyHtml = renderMatTokens(bodyTemplate, placeholders);

    const invoiceBuffer = await generateInvoicePDF(booking.id);

    const { transporter, isTestMode, testAccountUser, config: mailConfig } = await getNewsletterTransporter();
    const info = await transporter.sendMail({
      from: mailConfig?.fromEmail ? `"${mailConfig.fromName || 'Flugschule Hirondelle'}" <${mailConfig.fromEmail}>` : '"Flugschule Hirondelle" <info@fs-hirondelle.de>',
      to: customerEmail,
      bcc: settings.emailBcc || undefined,
      subject,
      html: bodyHtml,
      attachments: [{ filename: `Rechnung_${matukioBookingNumber(booking.id)}.pdf`, content: invoiceBuffer, contentType: 'application/pdf' }],
    });

    console.log('Invoice email sent: %s', info.messageId);
    if (isTestMode) {
      console.log('No real SMTP configured yet - test preview URL:', nodemailer.getTestMessageUrl(info), testAccountUser);
    }
  } catch (error) {
    console.error('Error sending invoice email:', error);
  }
}

// old: sendmail_owner - a plain internal-facing copy of a new booking, no
// PDF attachments or old's own MAT_* template needed for this since it's
// just an operational alert, not customer-facing correspondence.
async function sendOwnerNotificationEmail(booking: any, ownerEmail: string, emailBcc?: string | null) {
  const { name: customerName, email: customerEmail } = resolveBookingCustomer(booking);
  const { transporter, config: mailConfig } = await getNewsletterTransporter();
  await transporter.sendMail({
    from: mailConfig?.fromEmail ? `"${mailConfig.fromName || 'Flugschule Hirondelle'}" <${mailConfig.fromEmail}>` : '"Flugschule Hirondelle" <info@fs-hirondelle.de>',
    to: ownerEmail,
    bcc: emailBcc || undefined,
    subject: `Neue Buchung: ${booking.event.title}`,
    html: `
      <p>Neue Buchung eingegangen:</p>
      <p><strong>Veranstaltung:</strong> ${booking.event.title}<br/>
      <strong>Kunde:</strong> ${customerName} (${customerEmail || 'keine E-Mail'})<br/>
      <strong>Gesamtpreis:</strong> ${booking.totalPrice} €<br/>
      <strong>Buchungs-ID:</strong> ${booking.id}</p>
    `,
  });
  console.log('Owner notification email sent to', ownerEmail);
}

// old: sendmail_newevent_group - notifies every registered customer when a
// genuinely new event is created and published. Old's real trigger targets
// a specific Joomla user GROUP (=1 on the live site); this app has no
// group/ACL system to match that against (an earlier session finding - all
// real events use a single uniform access level), so this instead notifies
// every real CUSTOMER-role user, matching the spirit of "registered
// members" the setting targets.
export async function sendNewEventNotificationEmail(eventId: string) {
  try {
    const settings = await getSettingsConfig();
    if (!settings.sendmailNewEventGroup) return;

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return;

    const config = await prisma.templatesConfig.findUnique({ where: { id: 'default' } });
    let template = config?.emails ? (config.emails as any).newEvent : null;
    if (!template) {
      // Matches old Matukio's real mail_newevent template (id=12) - its own
      // stored subject is genuinely English even on the live German site.
      template = {
        subject: 'New event: {EVENT_TITLE}',
        bodyHtml: `
          <p>Sehr geehrte/geehrter {USER_NAME},</p>
          <p>Eine neue Veranstaltung wurde erstellt!</p>
          <p><strong>Mehr Informationen:</strong></p>
          <p>{EVENT_DETAILS}</p>
          <p>Mit freundlichen Grüßen,<br/>Ihr Team der Flugschule Hirondelle</p>
        `
      };
    }

    let locationName = event.location || 'Siehe Website';
    if (!event.location && event.locationId) {
      const loc = await prisma.location.findUnique({ where: { id: event.locationId } });
      if (loc) locationName = loc.title;
    }
    const eventDetails = `
      <strong>Veranstaltung:</strong> ${event.title}<br/>
      <strong>Datum:</strong> ${new Date(event.startDate).toLocaleDateString('de-DE')}${event.endDate ? ` bis ${new Date(event.endDate).toLocaleDateString('de-DE')}` : ''}<br/>
      <strong>Ort:</strong> ${locationName}
    `;

    const recipients = await prisma.user.findMany({
      where: { role: 'CUSTOMER', email: { not: '' } },
      select: { name: true, email: true },
    });
    if (recipients.length === 0) return;

    const { transporter, config: mailConfig } = await getNewsletterTransporter();
    const subject = template.subject.replace(/{EVENT_TITLE}/g, event.title);
    for (const recipient of recipients) {
      const bodyHtml = template.bodyHtml
        .replace(/{USER_NAME}/g, recipient.name || 'Kunde')
        .replace(/{EVENT_TITLE}/g, event.title)
        .replace(/{EVENT_DETAILS}/g, eventDetails);
      await transporter.sendMail({
        from: mailConfig?.fromEmail ? `"${mailConfig.fromName || 'Flugschule Hirondelle'}" <${mailConfig.fromEmail}>` : '"Flugschule Hirondelle" <info@fs-hirondelle.de>',
        to: recipient.email,
        bcc: settings.emailBcc || undefined,
        subject,
        html: bodyHtml,
      }).catch(console.error);
    }
    console.log(`New-event notification sent to ${recipients.length} customers for event ${event.title}`);
  } catch (error) {
    console.error('Error sending new-event notification email:', error);
  }
}

// templateKey 'userCancellation' - the customer cancelled their own booking;
// 'adminCancellation' - the school/admin cancelled the booking on their behalf.
export async function sendCancellationEmail(
  bookingId: string,
  templateKey: 'userCancellation' | 'adminCancellation',
  // Event-level delete (events.routes.ts) gates on old's separate
  // notify_participants_delete flag instead - it checks that flag itself
  // before calling this, so it passes true here to skip this function's
  // own notify_participants_cancel gate (which would otherwise silently
  // suppress delete notifications whenever the CANCEL flag happens to be off).
  skipCancelConfigCheck = false
) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { event: true, user: true }
    });

    if (!booking) {
      console.error('Booking not found for cancellation mailer');
      return;
    }

    // old: notify_participants_cancel
    const settings = await getSettingsConfig();
    if (!skipCancelConfigCheck && !settings.notifyParticipantsCancel) {
      console.log('Cancellation email skipped: notifyParticipantsCancel is disabled in Settings.');
      return;
    }

    const config = await prisma.templatesConfig.findUnique({ where: { id: 'default' } });
    let template = config?.emails ? (config.emails as any)[templateKey] : null;

    if (!template) {
      // Matches old Matukio's real mail_booking_canceled (id=3) /
      // mail_booking_canceled_admin (id=2) templates, language-key resolved.
      template = templateKey === 'userCancellation'
        ? {
            subject: 'Stornierungsbestätigung: {EVENT_TITLE}',
            bodyHtml: '<p>Sehr geehrte/geehrter {BOOKING_NAME},</p><p>Sie haben Ihre Buchung storniert - Ihr Platz wurde freigegeben.</p><p><strong>Buchungsdetails:</strong></p><p>{EVENT_DETAILS}</p><p>Mit freundlichen Grüßen,<br/>Ihr Team der Flugschule Hirondelle</p>'
          }
        : {
            subject: 'Stornierung Ihrer Buchung: {EVENT_TITLE}',
            bodyHtml: '<p>Sehr geehrte/geehrter {BOOKING_NAME},</p><p>Folgende Buchung wurde storniert:</p><p>{EVENT_DETAILS}</p><p>Mit freundlichen Grüßen,<br/>Ihr Team der Flugschule Hirondelle</p>'
          };
    }

    const { name: customerName, email: customerEmail } = resolveBookingCustomer(booking);

    if (!customerEmail) {
      console.error('Customer email missing for cancellation mailer');
      return;
    }

    let locationName = booking.event.location || 'Siehe Website';
    if (!booking.event.location && booking.event.locationId) {
      const loc = await prisma.location.findUnique({ where: { id: booking.event.locationId } });
      if (loc) locationName = loc.title;
    }

    const eventDetails = `
      <strong>Veranstaltung:</strong> ${booking.event.title}<br/>
      <strong>Datum:</strong> ${new Date(booking.event.startDate).toLocaleDateString('de-DE')}${booking.event.endDate ? ` bis ${new Date(booking.event.endDate).toLocaleDateString('de-DE')}` : ''}<br/>
      <strong>Ort:</strong> ${locationName}<br/>
      <strong>Buchungs-ID:</strong> ${booking.id}
    `;

    const subject = template.subject.replace(/{EVENT_TITLE}/g, booking.event.title);
    const bodyHtml = template.bodyHtml
      .replace(/{BOOKING_NAME}/g, customerName)
      .replace(/{EVENT_TITLE}/g, booking.event.title)
      .replace(/{EVENT_DETAILS}/g, eventDetails);

    const { transporter, isTestMode, testAccountUser, config: mailConfig } = await getNewsletterTransporter();
    const info = await transporter.sendMail({
      from: mailConfig?.fromEmail ? `"${mailConfig.fromName || 'Flugschule Hirondelle'}" <${mailConfig.fromEmail}>` : '"Flugschule Hirondelle" <info@fs-hirondelle.de>',
      to: customerEmail,
      bcc: settings.emailBcc || undefined,
      subject,
      html: bodyHtml
    });

    console.log('Cancellation email sent (%s): %s', templateKey, info.messageId);
    if (isTestMode) {
      console.log('No real SMTP configured yet (AcyMailing > Konfiguration) - test preview URL:', nodemailer.getTestMessageUrl(info), testAccountUser);
    }
  } catch (error) {
    console.error('Error sending cancellation email:', error);
  }
}
