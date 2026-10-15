import cron from 'node-cron';
import { prisma } from '../utils/prisma';
import { getNewsletterTransporter } from '../utils/newsletterTransporter';
import { resolveBookingCustomer } from '../utils/bookingCustomer';

async function resolveLocationName(event: { location: string | null; locationId: string | null }) {
  if (event.location) return event.location;
  if (event.locationId) {
    const loc = await prisma.location.findUnique({ where: { id: event.locationId } });
    if (loc) return loc.title;
  }
  return 'Siehe Website';
}

// Checked against old Matukio's real config.xml: its only 3 cron features
// are cron_freeplaces_reminder (nudge about open seats), cron_confirmationcheck
// (nudge an unconfirmed booking) and cron_invoice_afterevent (send an
// invoice after the event) - all default OFF, and nothing in the real site's
// own stored config ever turned them on. None of them is "remind an already-
// CONFIRMED attendee N days before their own event starts" - that's this
// app's own invented feature, with no old equivalent at all. Confused a real
// migrated customer (booked ~a year ago, reminder fired 3 days before the
// event) who had never gotten this kind of email from the business before -
// disabled per explicit request rather than deleted, so it's a one-line
// revert if ever wanted back.
const SEND_3_DAY_EVENT_REMINDERS = false;

// Run every day at 08:00 AM
export const startCronJobs = () => {
  // Explicit timezone (not relying solely on process.env.TZ propagating
  // through node-cron's own scheduling) - this is meant to fire at 8am for
  // a German business's customers, not 8am in whatever timezone the host
  // OS happens to be set to.
  cron.schedule('0 8 * * *', async () => {
    console.log('Running daily reminder cron job...');

    try {
      const { transporter, config: mailConfig, isTestMode } = await getNewsletterTransporter();
      const fromHeader = mailConfig?.fromEmail
        ? `"${mailConfig.fromName || 'Flugschule Hirondelle'}" <${mailConfig.fromEmail}>`
        : '"Flugschule Hirondelle" <info@fs-hirondelle.de>';

      // --- 1. Reminder emails: events starting in exactly 3 days ---
      if (SEND_3_DAY_EVENT_REMINDERS) {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + 3);
        targetDate.setHours(0, 0, 0, 0);
        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);

        const upcomingEvents = await prisma.event.findMany({
          where: { startDate: { gte: targetDate, lt: nextDay } },
          // reminderSentAt: null - this query re-runs fresh every day with no
          // other memory of what it already sent, so without this filter any
          // duplicate cron execution (e.g. a stray zombie process) resends
          // the same reminder to every booking, every time it fires.
          include: { bookings: { where: { status: 'CONFIRMED', reminderSentAt: null }, include: { user: true } } }
        });

        console.log(`Found ${upcomingEvents.length} events starting in 3 days.`);

        for (const event of upcomingEvents) {
          const locationName = await resolveLocationName(event);
          for (const booking of event.bookings) {
            // Each booking's email is isolated in its own try/catch - one
            // SMTP failure used to abort the whole cron run, silently skipping
            // every remaining booking that day with no way to retry until the
            // date window matched again (i.e. never, for a one-off event).
            try {
              const { name: customerName, email: customerEmail } = resolveBookingCustomer(booking);
              if (!customerEmail) continue;

              const info = await transporter.sendMail({
                from: fromHeader,
                to: customerEmail,
                subject: `Erinnerung: ${event.title} beginnt in 3 Tagen!`,
                html: `
                  <h3>Hallo ${customerName},</h3>
                  <p>wir freuen uns auf Ihre Teilnahme an <strong>${event.title}</strong>!</p>
                  <p>Die Veranstaltung beginnt am ${new Date(event.startDate).toLocaleDateString('de-DE')}.</p>
                  <p>Ort: ${locationName}</p>
                  <br/>
                  <p>Wir wünschen Ihnen viel Spaß und einen guten Flug!</p>
                  <br/>
                  <p>Ihr Team der Flugschule Hirondelle</p>
                `
              });
              await prisma.booking.update({ where: { id: booking.id }, data: { reminderSentAt: new Date() } });
              if (isTestMode) console.log(`Reminder sent to ${booking.id} (test mode, no real SMTP configured yet):`, info.messageId);
            } catch (err) {
              // Deliberately NOT marking reminderSentAt here - a failed send
              // (e.g. a transient SMTP error) should still be eligible to be
              // picked up and retried by this same day's cron run, not
              // silently given up on forever.
              console.error(`Failed to send 3-day reminder for booking ${booking.id}:`, err);
            }
          }
        }
      }

      // --- 2. Post-event rating request: events that ended yesterday ---
      const yesterdayStart = new Date();
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      yesterdayStart.setHours(0, 0, 0, 0);
      const yesterdayEnd = new Date(yesterdayStart);
      yesterdayEnd.setDate(yesterdayEnd.getDate() + 1);

      const endedEvents = await prisma.event.findMany({
        where: {
          OR: [
            { endDate: { gte: yesterdayStart, lt: yesterdayEnd } },
            { endDate: null, startDate: { gte: yesterdayStart, lt: yesterdayEnd } }
          ]
        },
        // Only actually-confirmed/attended bookings - `not: CANCELLED` also
        // matched PENDING (never paid) and WAITLIST (never admitted),
        // sending "thanks for attending" emails to people who didn't.
        // ratingRequestSentAt: null - same duplicate-prevention reasoning
        // as the 3-day reminder query above.
        include: { bookings: { where: { status: { in: ['CONFIRMED', 'COMPLETED'] }, ratingRequestSentAt: null }, include: { user: true } } }
      });

      console.log(`Found ${endedEvents.length} events that ended yesterday - sending rating requests.`);

      for (const event of endedEvents) {
        for (const booking of event.bookings) {
          if (booking.rating != null) continue; // already rated
          try {
            const { name: customerName, email: customerEmail } = resolveBookingCustomer(booking);
            if (!customerEmail) continue;

            const baseUrl = process.env.FRONTEND_URL || 'https://www.fs-hirondelle.de';
            const info = await transporter.sendMail({
              from: fromHeader,
              to: customerEmail,
              subject: `Wie war "${event.title}"? Ihre Meinung ist uns wichtig!`,
              html: `
                <h3>Hallo ${customerName},</h3>
                <p>vielen Dank für Ihre Teilnahme an <strong>${event.title}</strong>!</p>
                <p>Wir würden uns sehr über Ihre Bewertung freuen:</p>
                <p><a href="${baseUrl}/bewertung/${booking.id}" style="display:inline-block;padding:10px 20px;background:#5bc0de;color:#fff;text-decoration:none;border-radius:4px;">Jetzt bewerten</a></p>
                <br/>
                <p>Ihr Team der Flugschule Hirondelle</p>
              `
            });
            await prisma.booking.update({ where: { id: booking.id }, data: { ratingRequestSentAt: new Date() } });
            if (isTestMode) console.log(`Rating request sent for booking ${booking.id} (test mode, no real SMTP configured yet):`, info.messageId);
          } catch (err) {
            console.error(`Failed to send rating request for booking ${booking.id}:`, err);
          }
        }
      }

    } catch (error) {
      console.error('Error running reminder cron job:', error);
    }
  }, { timezone: 'Europe/Berlin' });
};
