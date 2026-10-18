import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../utils/prisma';
import { authenticateJWT, authorizeAdmin } from '../middlewares/auth.middleware';
import { generateRecurringDates, RecurrenceSpec } from '../utils/recurrence';
import { buildIcsCalendar } from '../utils/ics';
import { sendNewEventNotificationEmail, sendCancellationEmail } from '../services/mailer.service';
import { getSettingsConfig } from './settingsConfig.routes';

const router = Router();

function buildTicketsCreate(tickets: any[] | undefined) {
  if (!tickets) return undefined;
  return {
    create: tickets.map((t: any, index: number) => ({
      name: t.name,
      price: Number(t.price),
      description: t.description,
      capacity: Number(t.capacity) || 0,
      order: index
    }))
  };
}

// Allow public access to GET events for the frontend calendar
router.get('/', async (req, res) => {
  try {
    const { _sort, _order, _start, _end, q, categoryId, locationId, organizerId, published, cancelled, ids, status } = req.query;

    let whereClause: any = {};
    if (ids) {
      whereClause.id = { in: String(ids).split(',') };
    } else if (q) {
      const qStr = String(q);
      const idMatch = qStr.match(/^id:(.+)$/i);
      if (idMatch) {
        whereClause.id = idMatch[1].trim();
      } else {
        whereClause.OR = [
          { title: { contains: qStr } },
          { shortDescription: { contains: qStr } },
          { description: { contains: qStr } },
          { location: { contains: qStr } },
          { leadSpeaker: { contains: qStr } },
          { targetGroup: { contains: qStr } },
          { eventNumber: { contains: qStr } }
        ];
      }
    }
    if (categoryId) whereClause.categoryId = categoryId;
    if (locationId) whereClause.locationId = locationId;
    if (organizerId) whereClause.organizerId = organizerId;
    if (published !== undefined) whereClause.published = published === 'true';
    if (cancelled !== undefined) whereClause.cancelled = cancelled === 'true';
    // Old Matukio's real "modal_event" popup (booking edit's "Veranstaltung
    // auswählen" button) defaults to status=current when no filter is
    // explicitly chosen - matukio_recurring model's getListQuery():
    // `r.end > curdate()`, i.e. only events that haven't finished yet, not
    // the full historical list. Matches that here for status=current.
    if (status === 'current') {
      const now = new Date();
      const currentFilter = {
        OR: [
          { endDate: { gt: now } },
          { endDate: null, startDate: { gt: now } }
        ]
      };
      whereClause = whereClause.OR
        ? { AND: [{ OR: whereClause.OR }, currentFilter] }
        : { ...whereClause, ...currentFilter };
    }

    const skip = _start ? Number(_start) : 0;
    const take = _end ? Number(_end) - skip : 100;
    const orderBy: any = _sort ? { [String(_sort)]: _order === 'DESC' ? 'desc' : 'asc' } : { startDate: 'asc' };

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where: whereClause,
        include: {
          categoryRef: true,
          Location: { select: { id: true, title: true } },
          tickets: {
            orderBy: { order: 'asc' },
            include: {
              items: {
                include: { booking: { select: { status: true } } }
              }
            }
          }
        },
        skip,
        take,
        orderBy
      }),
      prisma.event.count({ where: whereClause })
    ]);

    const parsedEvents = events.map(e => ({
      ...e,
      tickets: ((e as any).tickets as any[]).map((t: any) => {
        // Old site (Matukio) only counts a booking against capacity/"Freie
        // Plätze" when its status is ACTIVE - PENDING, WAITLIST, and (its
        // DELETED, which migrated into our schema as COMPLETED - see the
        // migration notes) never reduce availability. This previously
        // excluded only 'CANCELLED', a status this schema never actually
        // uses, so every booking regardless of status was being counted -
        // inflating "X/Y gebucht" and showing events as overbooked/
        // waitlist-only when they still had real capacity.
        const bookedCount = t.items
          .filter((i: any) => i.booking.status === 'CONFIRMED')
          .reduce((acc: number, i: any) => acc + i.quantity, 0);
        const { items, ...ticketProps } = t;
        return { ...ticketProps, bookedCount };
      })
    }));

    res.set('Content-Range', `events ${skip}-${skip + parsedEvents.length}/${total}`);
    res.set('Access-Control-Expose-Headers', 'Content-Range');
    res.json(parsedEvents);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Download ALL upcoming published events as one .ics file - matches
// Matukio's "Kalenderdatei herunterladen" list-page button. Registered
// before GET /:id since both are single-segment paths and Express would
// otherwise try to look up an event with id "ics".
router.get('/ics', async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      where: { published: true, cancelled: false, startDate: { gte: new Date() } },
      orderBy: { startDate: 'asc' }
    });
    const ics = buildIcsCalendar(events, process.env.FRONTEND_URL || 'https://www.fs-hirondelle.de');
    res.set('Content-Type', 'text/calendar; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="veranstaltungen.ics"');
    res.send(ics);
  } catch (error) {
    console.error('GET /ics error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Public RSS 2.0 feed of upcoming published events - matches Matukio's
// frontend RSS feed view. Same route-ordering rationale as /ics above.
router.get('/rss', async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      where: { published: true, cancelled: false, startDate: { gte: new Date() } },
      orderBy: { startDate: 'asc' },
      take: 50
    });

    const siteUrl = process.env.FRONTEND_URL || 'https://www.fs-hirondelle.de';
    const escapeXml = (s: string) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const items = events.map(e => `
    <item>
      <title>${escapeXml(e.title)}</title>
      <link>${siteUrl}/buchungskalender/${e.id}</link>
      <guid isPermaLink="false">${e.id}</guid>
      <pubDate>${new Date(e.startDate).toUTCString()}</pubDate>
      <description>${escapeXml(e.shortDescription || e.description || '')}</description>
    </item>`).join('');

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Flugschule Hirondelle - Veranstaltungen</title>
    <link>${siteUrl}/buchungskalender</link>
    <description>Kommende Veranstaltungen der Flugschule Hirondelle</description>
    <language>de-de</language>${items}
  </channel>
</rss>`;

    res.set('Content-Type', 'application/rss+xml; charset=utf-8');
    res.send(rss);
  } catch (error) {
    console.error('GET /rss error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id as string },
      include: {
        tickets: {
          orderBy: { order: 'asc' },
          include: {
            items: {
              include: { booking: { select: { status: true } } }
            }
          }
        }
      }
    });
    if (!event) return res.status(404).json({ message: 'Not found' });
    
    const parsedEvent = {
      ...event,
      tickets: event.tickets.map((t: any) => {
        // See the matching comment in GET / above - only CONFIRMED counts.
        const bookedCount = t.items
          .filter((i: any) => i.booking.status === 'CONFIRMED')
          .reduce((acc: number, i: any) => acc + i.quantity, 0);
        const { items, ...ticketProps } = t;
        return { ...ticketProps, bookedCount };
      })
    };
    
    res.json(parsedEvent);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const { tickets, ...eventData } = req.body;
    
    const data = { 
      ...eventData, 
      startDate: new Date(req.body.startDate),
      endDate: req.body.endDate ? new Date(req.body.endDate) : null,
      registrationDeadline: req.body.registrationDeadline ? new Date(req.body.registrationDeadline) : null,
      capacity: Number(req.body.capacity || 20),
      maxParticipants: req.body.maxParticipants ? Number(req.body.maxParticipants) : null,
      minParticipants: req.body.minParticipants ? Number(req.body.minParticipants) : null,
      maxBookablePerPerson: req.body.maxBookablePerPerson ? Number(req.body.maxBookablePerPerson) : null,
      feePerPerson: req.body.feePerPerson ? parseFloat(req.body.feePerPerson) : null,
    };
    
    const event = await prisma.event.create({
      data: {
        ...data,
        tickets: tickets ? {
          create: tickets.map((t: any, index: number) => ({
            name: t.name,
            price: Number(t.price),
            description: t.description,
            capacity: Number(t.capacity) || 0,
            order: index
          }))
        } : undefined
      },
      include: { tickets: { orderBy: { order: 'asc' } } }
    });
    // old: sendmail_newevent_group - notifies registered customers about a
    // genuinely new event (not every recurring-date generated from an
    // existing series, nor every later edit/republish of one). Real,
    // active setting on the live site (=1), unlike the disabled
    // cron_freeplaces_reminder.
    if (event.published) sendNewEventNotificationEmail(event.id).catch(console.error);
    res.status(201).json(event);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Explicit bulk publish/unpublish for the admin list's toolbar selection -
// PUT /:id requires a full event payload, so a partial-data bulk update
// through it would null out startDate/capacity/etc. This sets just the flag.
router.patch('/bulk-publish', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const { ids, published } = req.body as { ids: string[]; published: boolean };
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'ids ist erforderlich' });
    }
    await prisma.event.updateMany({
      where: { id: { in: ids } },
      data: { published: !!published }
    });
    res.json({ count: ids.length });
  } catch (error) {
    console.error('PATCH /bulk-publish error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const { tickets, id, categoryRef, createdAt, updatedAt, ...eventData } = req.body;

    const data = {
      ...eventData,
      startDate: new Date(req.body.startDate),
      endDate: req.body.endDate ? new Date(req.body.endDate) : null,
      registrationDeadline: req.body.registrationDeadline ? new Date(req.body.registrationDeadline) : null,
      capacity: Number(req.body.capacity || 20),
      maxParticipants: req.body.maxParticipants !== undefined ? Number(req.body.maxParticipants) : null,
      minParticipants: req.body.minParticipants !== undefined ? Number(req.body.minParticipants) : null,
      maxBookablePerPerson: req.body.maxBookablePerPerson !== undefined ? Number(req.body.maxBookablePerPerson) : null,
      feePerPerson: req.body.feePerPerson !== undefined ? parseFloat(req.body.feePerPerson) : null,
    };

    const eventId = req.params.id as string;

    const event = await prisma.$transaction(async (tx) => {
      // Reconcile tickets by id instead of delete-all-then-recreate: a
      // blind deleteMany() 500s (FK violation) the instant any ticket has
      // real BookingItem rows against it, which crashed every save for an
      // event with bookings. Update existing rows in place (keeps ticketId
      // stable for existing bookings), create new ones, and only delete
      // removed rows that have zero bookings against them.
      if (tickets) {
        const existingTickets = await tx.eventTicket.findMany({ where: { eventId } });
        const incomingIds = new Set(tickets.filter((t: any) => t.id).map((t: any) => t.id));

        for (const [index, t] of tickets.entries()) {
          const ticketData = {
            name: t.name,
            price: Number(t.price),
            description: t.description,
            capacity: Number(t.capacity) || 0,
            // Position in the submitted array (matches display order in the
            // admin edit form) becomes the new display order everywhere else.
            order: index
          };
          if (t.id && existingTickets.some(e => e.id === t.id)) {
            await tx.eventTicket.update({ where: { id: t.id }, data: ticketData });
          } else {
            await tx.eventTicket.create({ data: { ...ticketData, eventId } });
          }
        }

        for (const removed of existingTickets.filter(e => !incomingIds.has(e.id))) {
          const bookedCount = await tx.bookingItem.count({ where: { ticketId: removed.id } });
          if (bookedCount === 0) {
            await tx.eventTicket.delete({ where: { id: removed.id } });
          }
          // else: keep it - it still has real bookings against it, so it
          // can't be safely removed even though the admin unselected it.
        }
      }

      return tx.event.update({
        where: { id: eventId },
        data,
        include: { tickets: { orderBy: { order: 'asc' } } }
      });
    });
    res.json(event);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/:id', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    // Booking.eventId is a RESTRICT foreign key (unlike old's DB, which had
    // no such constraint and let a delete silently orphan real booking
    // rows) - deleting an event that still has any booking always fails
    // here. That's the actually-safer design (real booking history is
    // never silently orphaned), but it also means the notification email
    // MUST fire only after a successful delete, never before it - sending
    // "your booking is cancelled" and then having the delete itself fail
    // would be a false notification about something that never happened.
    const affectedBookings = await prisma.booking.findMany({
      where: { eventId: req.params.id as string, status: { in: ['PENDING', 'CONFIRMED', 'WAITLIST'] } },
      select: { id: true }
    });

    await prisma.event.delete({ where: { id: req.params.id as string } });

    // old: notify_participants_delete (real, active on the live site) -
    // reachable in practice only when the event had no blocking bookings
    // (see above), but kept faithful to old's real config flag for the
    // rare edge case (e.g. only CANCELLED-status bookings remained, which
    // don't block the FK).
    const settings = await getSettingsConfig();
    if (settings.notifyParticipantsDelete) {
      for (const b of affectedBookings) {
        sendCancellationEmail(b.id, 'adminCancellation', true).catch(console.error);
      }
    }

    res.json({ id: req.params.id });
  } catch (error: any) {
    if (error?.code === 'P2003') {
      return res.status(400).json({ message: 'Diese Veranstaltung hat noch Buchungen und kann nicht gelöscht werden - bitte stattdessen stornieren oder unveröffentlichen.' });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

// List every date-occurrence belonging to the same series (i.e. "Termine" tab),
// with the same date-range filters Matukio's own date manager offered.
router.get('/series/:seriesId', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const { seriesId } = req.params;
    const filter = String(req.query.filter || 'all');

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 86400000);
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const endOfWeek = new Date(startOfWeek.getTime() + 7 * 86400000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const endOfYear = new Date(now.getFullYear() + 1, 0, 1);

    const where: any = { seriesId };
    if (filter === 'current') where.startDate = { gte: now };
    else if (filter === 'past') where.startDate = { lt: now };
    else if (filter === 'today') where.startDate = { gte: startOfToday, lt: endOfToday };
    else if (filter === 'week') where.startDate = { gte: startOfWeek, lt: endOfWeek };
    else if (filter === 'month') where.startDate = { gte: startOfMonth, lt: endOfMonth };
    else if (filter === 'year') where.startDate = { gte: startOfYear, lt: endOfYear };
    else if (filter === 'cancelled') where.cancelled = true;

    const events = await prisma.event.findMany({
      where,
      orderBy: { startDate: 'asc' },
      include: { bookings: { select: { id: true, status: true } } }
    });

    res.json(events.map(e => ({
      ...e,
      // Same stale-status bug as events.routes.ts's bookedCount /
      // bookings.routes.ts's waitlist check: this schema never uses
      // 'CANCELLED', so filtering it out excluded nothing and counted every
      // booking including 'COMPLETED' (which migrated from old Matukio's
      // DELETED bookings - see the migration notes). Excluding COMPLETED
      // gives a real "still-relevant bookings" count instead.
      bookingsCount: e.bookings.filter(b => b.status !== 'COMPLETED').length,
      bookings: undefined
    })));
  } catch (error) {
    console.error('GET /series/:seriesId error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Batch-create a whole series of recurring dates from one shared template
// (Matukio's "Serientermine generieren" / batch date creation).
router.post('/recurring', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const { template, tickets, recurrence, beginTime, endTime, bookingDeadlineTime, existingSeriesId } = req.body as {
      template: any; tickets: any[]; recurrence: RecurrenceSpec; beginTime: string; endTime: string; bookingDeadlineTime?: string; existingSeriesId?: string;
    };

    const dateStrings = generateRecurringDates(recurrence);
    if (dateStrings.length === 0) {
      return res.status(400).json({ message: 'Keine Termine mit diesen Angaben erzeugbar' });
    }

    const seriesId = existingSeriesId || crypto.randomUUID();
    const baseAlias = template.alias || template.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'termin';

    const created = [];
    for (const dateStr of dateStrings) {
      const startDate = new Date(`${dateStr}T${beginTime || '09:00'}:00`);
      const endDate = new Date(`${dateStr}T${endTime || '17:00'}:00`);
      const registrationDeadline = bookingDeadlineTime
        ? new Date(`${dateStr}T${bookingDeadlineTime}:00`)
        : null;

      const alias = `${baseAlias}-${dateStr}`;
      const existing = await prisma.event.findUnique({ where: { alias } });

      const event = await prisma.event.create({
        data: {
          ...template,
          alias: existing ? `${baseAlias}-${dateStr}-${crypto.randomBytes(2).toString('hex')}` : alias,
          startDate,
          endDate,
          registrationDeadline,
          capacity: Number(template.capacity) || 20,
          maxParticipants: template.maxParticipants ? Number(template.maxParticipants) : null,
          minParticipants: template.minParticipants ? Number(template.minParticipants) : null,
          feePerPerson: template.feePerPerson ? parseFloat(template.feePerPerson) : 0,
          seriesId,
          tickets: buildTicketsCreate(tickets)
        }
      });
      created.push(event);
    }

    res.status(201).json({ seriesId, count: created.length, events: created });
  } catch (error) {
    console.error('POST /recurring error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Add a single additional date to an existing series, copying every shared
// field from the reference event (Matukio's "+ Add Date" on an existing event).
router.post('/:id/add-date', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const reference = await prisma.event.findUnique({ where: { id: req.params.id as string } });
    if (!reference) return res.status(404).json({ message: 'Not found' });
    const referenceTickets = await prisma.eventTicket.findMany({ where: { eventId: reference.id }, orderBy: { order: 'asc' } });

    const { startDate, endDate, registrationDeadline, titleOverride, capacityOverride, locationOverride, bookingNumber } = req.body;
    if (!startDate) return res.status(400).json({ message: 'startDate ist erforderlich' });

    const seriesId = reference.seriesId || crypto.randomUUID();
    if (!reference.seriesId) {
      await prisma.event.update({ where: { id: reference.id }, data: { seriesId } });
    }

    const dateStr = new Date(startDate).toISOString().slice(0, 10);
    const baseAlias = reference.alias?.replace(/-\d{4}-\d{2}-\d{2}.*$/, '') || reference.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    let alias = `${baseAlias}-${dateStr}`;
    if (await prisma.event.findUnique({ where: { alias } })) {
      alias = `${baseAlias}-${dateStr}-${crypto.randomBytes(2).toString('hex')}`;
    }

    const {
      id, createdAt, updatedAt, alias: _oldAlias, startDate: _s, endDate: _e, registrationDeadline: _r,
      // Old Matukio's "Nummer" (semnum) is a per-date identifier, not
      // shared across occurrences - exclude it from the reference copy so
      // a new date doesn't silently duplicate an existing one's Nummer.
      bookingNumber: _b,
      ...shared
    } = reference as any;

    const event = await prisma.event.create({
      data: {
        ...shared,
        alias,
        title: titleOverride || reference.title,
        capacity: capacityOverride ? Number(capacityOverride) : reference.capacity,
        location: locationOverride || reference.location,
        bookingNumber: bookingNumber || null,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : null,
        seriesId,
        cancelled: false,
        tickets: {
          create: referenceTickets.map(t => ({ name: t.name, price: t.price, description: t.description, capacity: t.capacity, order: t.order }))
        }
      }
    });

    res.status(201).json(event);
  } catch (error) {
    console.error('POST /:id/add-date error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Batch-add recurring dates to an EXISTING event's series in one call, reusing
// the same reference-copy logic as /add-date for every generated date
// (Matukio's "Serientermine generieren" invoked from an already-saved event).
router.post('/:id/add-recurring-dates', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const reference = await prisma.event.findUnique({ where: { id: req.params.id as string } });
    if (!reference) return res.status(404).json({ message: 'Not found' });

    const { recurrence, beginTime, endTime, bookingDeadlineTime } = req.body as {
      recurrence: RecurrenceSpec; beginTime: string; endTime: string; bookingDeadlineTime?: string;
    };

    const dateStrings = generateRecurringDates(recurrence);
    if (dateStrings.length === 0) {
      return res.status(400).json({ message: 'Keine Termine mit diesen Angaben erzeugbar' });
    }

    // Old Matukio's batch-generation step shows the resulting date list
    // before actually committing anything - ?preview=true here just
    // returns what WOULD be created, no DB writes at all.
    if (req.query.preview === 'true') {
      return res.json({ dates: dateStrings });
    }

    const referenceTickets = await prisma.eventTicket.findMany({ where: { eventId: reference.id }, orderBy: { order: 'asc' } });

    const seriesId = reference.seriesId || crypto.randomUUID();
    if (!reference.seriesId) {
      await prisma.event.update({ where: { id: reference.id }, data: { seriesId } });
    }

    const baseAlias = reference.alias?.replace(/-\d{4}-\d{2}-\d{2}.*$/, '') || reference.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const {
      id, createdAt, updatedAt, alias: _oldAlias, startDate: _s, endDate: _e, registrationDeadline: _r,
      // Batch-generated dates shouldn't all inherit the reference's own
      // Nummer (bookingNumber) - each occurrence gets its own separately.
      bookingNumber: _b,
      ...shared
    } = reference as any;

    const created = [];
    for (const dateStr of dateStrings) {
      const startDate = new Date(`${dateStr}T${beginTime || '09:00'}:00`);
      const endDate = new Date(`${dateStr}T${endTime || '17:00'}:00`);
      const registrationDeadline = bookingDeadlineTime ? new Date(`${dateStr}T${bookingDeadlineTime}:00`) : null;

      let alias = `${baseAlias}-${dateStr}`;
      if (await prisma.event.findUnique({ where: { alias } })) {
        alias = `${baseAlias}-${dateStr}-${crypto.randomBytes(2).toString('hex')}`;
      }

      const event = await prisma.event.create({
        data: {
          ...shared,
          alias,
          startDate,
          endDate,
          registrationDeadline,
          seriesId,
          cancelled: false,
          tickets: {
            create: referenceTickets.map(t => ({ name: t.name, price: t.price, description: t.description, capacity: t.capacity, order: t.order }))
          }
        }
      });
      created.push(event);
    }

    res.status(201).json({ seriesId, count: created.length, events: created });
  } catch (error) {
    console.error('POST /:id/add-recurring-dates error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Old's real per-event "Individuelles Buchungsformular" (layouts/event/
// edit/booking.php's card-booking-override, bookingform.create/.delete
// tasks) - creates a new BookingFormConfig cloned from the site default and
// links it to this event, so the admin starts editing something that
// already looks like a real form instead of a blank one.
router.post('/:id/custom-booking-form', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id as string } });
    if (!event) return res.status(404).json({ message: 'Not found' });

    const defaultConfig = await prisma.bookingFormConfig.findUnique({ where: { id: 'default' } });
    const newConfig = await prisma.bookingFormConfig.create({
      data: {
        name: `Formular: ${event.title}`,
        steps: defaultConfig?.steps ?? [{ id: 'step-1', title: 'Anmeldung', fields: [] }],
      },
    });
    await prisma.event.update({ where: { id: event.id }, data: { customBookingFormId: newConfig.id } });
    res.status(201).json({ id: newConfig.id });
  } catch (error) {
    console.error('POST /:id/custom-booking-form error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/:id/custom-booking-form', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id as string } });
    if (!event) return res.status(404).json({ message: 'Not found' });
    if (event.customBookingFormId) {
      await prisma.event.update({ where: { id: event.id }, data: { customBookingFormId: null } });
      await prisma.bookingFormConfig.delete({ where: { id: event.customBookingFormId } }).catch(() => {});
    }
    res.json({ message: 'Individuelles Buchungsformular entfernt' });
  } catch (error) {
    console.error('DELETE /:id/custom-booking-form error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Quick standalone duplicate (Matukio has no direct equivalent, but this is the
// obvious complement so an admin never has to re-type an entire event by hand).
router.post('/:id/duplicate', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const reference = await prisma.event.findUnique({ where: { id: req.params.id as string } });
    if (!reference) return res.status(404).json({ message: 'Not found' });
    const referenceTickets = await prisma.eventTicket.findMany({ where: { eventId: reference.id }, orderBy: { order: 'asc' } });

    const {
      id, createdAt, updatedAt, alias, startDate, endDate, registrationDeadline,
      seriesId, bookingNumber,
      ...shared
    } = reference as any;

    const newAlias = `${alias || reference.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-kopie-${crypto.randomBytes(3).toString('hex')}`;

    const event = await prisma.event.create({
      data: {
        ...shared,
        title: `${reference.title} (Kopie)`,
        alias: newAlias,
        startDate: reference.startDate,
        endDate: reference.endDate,
        registrationDeadline: reference.registrationDeadline,
        seriesId: null,
        bookingNumber: null,
        published: false,
        tickets: {
          create: referenceTickets.map(t => ({ name: t.name, price: t.price, description: t.description, capacity: t.capacity, order: t.order }))
        }
      }
    });

    res.status(201).json(event);
  } catch (error) {
    console.error('POST /:id/duplicate error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Toggle a date's cancelled state (distinct from published - a cancelled date
// stays visible with a "Storniert" badge instead of disappearing entirely).
router.patch('/:id/toggle-cancel', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id as string } });
    if (!event) return res.status(404).json({ message: 'Not found' });

    const willBeCancelled = !event.cancelled;
    const updated = await prisma.event.update({
      where: { id: req.params.id as string },
      data: { cancelled: willBeCancelled }
    });

    // Only notify when actually CANCELLING (not when un-cancelling back to
    // published) - this is the real, reachable equivalent of old's
    // notify_participants_delete/cancel flow for an event with existing
    // customers, since deleting one outright is blocked while it has any
    // booking (see DELETE /:id above).
    if (willBeCancelled) {
      const affectedBookings = await prisma.booking.findMany({
        where: { eventId: req.params.id as string, status: { in: ['PENDING', 'CONFIRMED', 'WAITLIST'] } },
        select: { id: true }
      });
      for (const b of affectedBookings) {
        sendCancellationEmail(b.id, 'adminCancellation').catch(console.error);
      }
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Lightweight publish/unpublish toggle for a single date row in the "Termine"
// list - PUT /:id requires a full event payload, so this avoids clobbering
// every other field with a partial body just to flip one flag.
router.patch('/:id/toggle-publish', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id as string } });
    if (!event) return res.status(404).json({ message: 'Not found' });

    const updated = await prisma.event.update({
      where: { id: req.params.id as string },
      data: { published: !event.published }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Single-event "Zum Kalender hinzufügen" download - the same standard .ics
// format works for Google Calendar, Outlook and Apple Calendar via import.
router.get('/:id/ics', async (req, res) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id as string } });
    if (!event) return res.status(404).json({ message: 'Not found' });

    const ics = buildIcsCalendar([event], process.env.FRONTEND_URL || 'https://www.fs-hirondelle.de');
    const filename = (event.alias || event.title).replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
    res.set('Content-Type', 'text/calendar; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="${filename}.ics"`);
    res.send(ics);
  } catch (error) {
    console.error('GET /:id/ics error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Old Matukio's hiron_matukio_recurring.hits counter - incremented once per
// real public page view. A separate endpoint (rather than incrementing
// inside GET /:id) so the admin edit form loading the same event data
// doesn't inflate it - only the public EventDetailsView calls this.
router.post('/:id/view', async (req, res) => {
  try {
    await prisma.event.update({
      where: { id: req.params.id as string },
      data: { views: { increment: 1 } }
    });
    res.status(204).end();
  } catch {
    // Non-critical - a missing/invalid id here should never break the
    // visitor's page load.
    res.status(204).end();
  }
});

// Old Matukio's per-event file attachments (edit/files.php). Real
// historical usage was minimal (a single PDF across the whole old site),
// so this is a plain upload/list/delete list, not old's fuller per-file
// ACL/download-count system.
router.get('/:id/files', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const files = await prisma.eventFile.findMany({
      where: { eventId: req.params.id as string },
      orderBy: { createdAt: 'desc' }
    });
    res.json(files);
  } catch (error) {
    console.error('GET /:id/files error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/:id/files', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const { title, url } = req.body as { title: string; url: string };
    if (!title || !url) return res.status(400).json({ message: 'title und url sind erforderlich' });
    const file = await prisma.eventFile.create({
      data: { eventId: req.params.id as string, title, url }
    });
    res.status(201).json(file);
  } catch (error) {
    console.error('POST /:id/files error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/files/:fileId', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    await prisma.eventFile.delete({ where: { id: req.params.fileId as string } });
    res.json({ id: req.params.fileId });
  } catch (error) {
    console.error('DELETE /files/:fileId error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
