import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticateJWT, authorizeAdmin } from '../middlewares/auth.middleware';

const router = Router();

async function getOrCreateConfig() {
  let config = await prisma.settingsConfig.findUnique({ where: { id: 'default' } });
  if (!config) {
    config = await prisma.settingsConfig.create({ data: { id: 'default' } });
  }
  return config;
}

router.get('/', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    res.json(config);
  } catch (error) {
    console.error('Error fetching settings config:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const {
      sendmailTeilnehmer, notifyParticipantsPublish, notifyParticipantsCancel, notifyParticipantsDelete,
      sendmailOwner, ownerNotificationEmail, sendmailInvoice, sendmailTicket,
      sendmailCertificate, bookingStornotage, rejectionSubject, sendmailNewEventGroup,
      emailBcc, maintenanceModeEnabled, maintenancePassword,
    } = req.body;

    const data: Record<string, any> = {};
    if (sendmailTeilnehmer !== undefined) data.sendmailTeilnehmer = !!sendmailTeilnehmer;
    if (notifyParticipantsPublish !== undefined) data.notifyParticipantsPublish = !!notifyParticipantsPublish;
    if (notifyParticipantsCancel !== undefined) data.notifyParticipantsCancel = !!notifyParticipantsCancel;
    if (notifyParticipantsDelete !== undefined) data.notifyParticipantsDelete = !!notifyParticipantsDelete;
    if (sendmailOwner !== undefined) data.sendmailOwner = !!sendmailOwner;
    if (ownerNotificationEmail !== undefined) data.ownerNotificationEmail = ownerNotificationEmail || null;
    if (sendmailInvoice !== undefined) data.sendmailInvoice = !!sendmailInvoice;
    if (sendmailTicket !== undefined) data.sendmailTicket = !!sendmailTicket;
    if (sendmailCertificate !== undefined) data.sendmailCertificate = !!sendmailCertificate;
    if (bookingStornotage !== undefined) data.bookingStornotage = Number(bookingStornotage) || 0;
    if (rejectionSubject !== undefined) data.rejectionSubject = rejectionSubject;
    if (sendmailNewEventGroup !== undefined) data.sendmailNewEventGroup = !!sendmailNewEventGroup;
    if (emailBcc !== undefined) data.emailBcc = emailBcc || null;
    if (maintenanceModeEnabled !== undefined) data.maintenanceModeEnabled = !!maintenanceModeEnabled;
    if (maintenancePassword !== undefined) data.maintenancePassword = maintenancePassword || null;

    const config = await prisma.settingsConfig.upsert({
      where: { id: 'default' },
      update: data,
      create: { id: 'default', ...data },
    });
    res.json(config);
  } catch (error) {
    console.error('Error updating settings config:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Internal helper (not an HTTP route) for other backend code to read the
// live settings without duplicating the getOrCreate/default logic.
export async function getSettingsConfig() {
  return getOrCreateConfig();
}

// Public: the booking modal shows the cancellation/payment-deadline window
// to customers before they book, so this one field needs to be readable
// without an admin session.
router.get('/public/booking-stornotage', async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    res.json({ bookingStornotage: config.bookingStornotage });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
