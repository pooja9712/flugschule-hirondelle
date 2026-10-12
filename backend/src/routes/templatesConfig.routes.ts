import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticateJWT, authorizeAdmin } from '../middlewares/auth.middleware';
import { DEFAULT_BOOKING_CONFIRMATION_TEMPLATE } from '../services/mailer.service';
import {
  DEFAULT_SIGNATURE_LIST_HEADER, DEFAULT_SIGNATURE_LIST_ROW, DEFAULT_PARTICIPANT_LIST_HEADER, DEFAULT_PARTICIPANT_LIST_ROW,
} from '../utils/matukioTemplates';

const router = Router();

// Get the templates config by id (React Admin useGetOne)
router.get('/:id', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const id = String(req.params.id);
    let config = await prisma.templatesConfig.findUnique({
      where: { id }
    });

    if (!config) {
      // Create default config if it doesn't exist
      //
      // Word-for-word old Matukio content (hiron_matukio_templates ids
      // 1/2/3/11/12), with old's own ##LANG_KEY## placeholders resolved from
      // the real com_matukio.ini language files (COM_MATUKIO_EMAIL_GREETING
      // etc.) and MAT_BOOKING_ALL_DETAILS_*/MAT_EVENT_ALL_DETAILS_* mapped
      // onto this app's own {BOOKING_DETAILS}/{EVENT_DETAILS} tokens (the
      // simpler {TOKEN} substitution mailer.service.ts actually uses for
      // emails.*, distinct from the MAT_* engine used by the other tabs).
      // id=12/11's subjects ("New event ...", "Reminder free places ...")
      // are genuinely English in old's own live data even on the German
      // site - not paraphrased into German.
      const defaultEmails = {
        // Single source of truth shared with mailer.service.ts's own
        // fallback, so the seeded admin-editable copy and the "template
        // missing" fallback can never drift apart again.
        bookingConfirmation: { ...DEFAULT_BOOKING_CONFIRMATION_TEMPLATE },
        adminCancellation: {
          subject: 'Stornierung Ihrer Buchung: {EVENT_TITLE}',
          bodyHtml: '<p>Sehr geehrte/geehrter {BOOKING_NAME},</p><p>Folgende Buchung wurde storniert:</p><p>{EVENT_DETAILS}</p><p>Mit freundlichen Grüßen,<br/>Ihr Team der Flugschule Hirondelle</p>',
          bodyText: 'Sehr geehrte/geehrter {BOOKING_NAME},\n\nFolgende Buchung wurde storniert:\n{EVENT_DETAILS}\n\nMit freundlichen Grüßen,\nIhr Team der Flugschule Hirondelle'
        },
        userCancellation: {
          subject: 'Stornierungsbestätigung: {EVENT_TITLE}',
          bodyHtml: '<p>Sehr geehrte/geehrter {BOOKING_NAME},</p><p>Sie haben Ihre Buchung storniert - Ihr Platz wurde freigegeben.</p><p><strong>Buchungsdetails:</strong></p><p>{EVENT_DETAILS}</p><p>Mit freundlichen Grüßen,<br/>Ihr Team der Flugschule Hirondelle</p>',
          bodyText: 'Sehr geehrte/geehrter {BOOKING_NAME},\n\nSie haben Ihre Buchung storniert - Ihr Platz wurde freigegeben.\n\nBuchungsdetails:\n{EVENT_DETAILS}\n\nMit freundlichen Grüßen,\nIhr Team der Flugschule Hirondelle'
        },
        newEvent: {
          subject: 'New event: {EVENT_TITLE}',
          bodyHtml: '<p>Sehr geehrte/geehrter {USER_NAME},</p><p>Eine neue Veranstaltung wurde erstellt!</p><p><strong>Mehr Informationen:</strong></p><p>{EVENT_DETAILS}</p><p>Mit freundlichen Grüßen,<br/>Ihr Team der Flugschule Hirondelle</p>'
        },
        freePlacesReminder: {
          subject: 'Reminder free places: {EVENT_TITLE}',
          bodyHtml: '<p>Sehr geehrte/geehrter {USER_NAME},</p><p>Für die folgende Veranstaltung sind noch Plätze verfügbar!</p><p><strong>Mehr Informationen:</strong></p><p>{EVENT_DETAILS}</p><p>Mit freundlichen Grüßen,<br/>Ihr Team der Flugschule Hirondelle</p>'
        }
      };

      // Word-for-word old Matukio content (hiron_matukio_templates ids
      // 4-10/13/15), with old's own ##LANG_KEY## placeholders resolved to
      // their real German text (com_matukio.ini) exactly as old's own
      // JText::_() would render them - not paraphrased/simplified. id=14's
      // subject key (COM_MATUKIO_EMAIL_SUBJECT_CERTIFICATE) only exists in
      // the EN-GB language file even on the real German site - "Your
      // certificate for" is old's genuine, verified live text, not a
      // mistake to silently "fix" into German.
      config = await prisma.templatesConfig.create({
        data: {
          id,
          emails: defaultEmails,
          listViews: {
            signatureListHeader: DEFAULT_SIGNATURE_LIST_HEADER,
            signatureListRow: DEFAULT_SIGNATURE_LIST_ROW,
            participantListHeader: DEFAULT_PARTICIPANT_LIST_HEADER,
            participantListRow: DEFAULT_PARTICIPANT_LIST_ROW,
          },
          invoices: {
            pdfTemplate: '<table width="100%"><tr><td>Your Company<br>Your Company Address<br>Your Tax Number</td><td align="right">Your Logo</td></tr></table><br><br><table width="100%"><tr><td><b>Customer Information</b><br>MAT_BOOKING_NAME<br>MAT_BOOKING_STREET<br>MAT_BOOKING_ZIP MAT_BOOKING_CITY<br>MAT_BOOKING_COUNTRY</td><td><b>Invoice Information</b><br>Invoice Number: MAT_INVOICE_NUMBER<br>Invoice Date: MAT_INVOICE_DATE<br>Booking Number: MAT_BOOKING_NUMBER<br>Payment method: MAT_BOOKING_PAYMENT_METHOD</td></tr></table><br><br><table width="100%" border="1"><tr><th>#</th><th>Event</th><th>Net total</th></tr><tr><td>MAT_BOOKING_NRBOOKED</td><td>MAT_EVENT_TITLE</td><td>MAT_BOOKING_PAYMENT_NETTO</td></tr></table><br><div align="right">Net total: MAT_BOOKING_PAYMENT_NETTO<br>Tax total: MAT_BOOKING_PAYMENT_TAX<br><b>Total: MAT_BOOKING_PAYMENT_BRUTTO</b></div><br><br><b>Invoice Note</b><br>Your notes',
            emailSubject: 'Ihre Rechnung MAT_BOOKING_NUMBER',
            emailBody: '<div id="mat-invoice-mail"><p><span style="line-height: 1.3em;">Sehr geehrte / geehrter MAT_BOOKING_NAME,<br /><br /></span>im Anhang finden Sie die Rechnung zu Ihrer Buchung.</p><p>MAT_SIGNATURE</p></div>'
          },
          certificates: {
            pdfTemplate: '<h2>Zertifikat erteilen for</h2><h3>MAT_BOOKING_NAME</h3><h4>hat erfolgreich an der Veranstaltung teilgenommen</h4><h4>MAT_EVENT_TITLE</h4><h4>Datum: MAT_DATE</h4>',
            // Old's own value for id=7 (subject column) - never configured
            // on the real site (stored as the literal 'E' unset-marker).
            backgroundImage: '',
            emailSubject: 'Your certificate for MAT_EVENT_TITLE MAT_EVENT_SEMNUM',
            emailBody: 'Sehr geehrte / geehrter MAT_BOOKING_NAME,<br /><br />Sie wurden für die unten stehende Veranstaltung zertifiziert. <br /><br />Sie wurden für die unten stehende Veranstaltung zertifiziert. MAT_EVENT_ALL_DETAILS_HTML MAT_SIGNATURE'
          },
          tickets: {
            ticketTemplate: 'MAT_EVENT_TITLE - MAT_EVENT_BEGIN\nMAT_BOOKING_NRBOOKED\nMAT_BOOKING_NUMBER\nMAT_BOOKING_CHECKIN_QRCODE\nMAT_BOOKING_PAYMENT_BRUTTO',
            // Old's own value for id=10 (subject column) - never configured
            // on the real site either (also the literal 'E' unset-marker).
            backgroundImage: '',
            nametagTemplate: 'MAT_BOOKING_FIRSTNAME MAT_BOOKING_LASTNAME\nMAT_BOOKING_COUNTRY\n\nMAT_EVENT_TITLE &nbsp; MAT_BOOKING_ID',
            // Old keeps a SEPARATE background image per PDF type - id=10
            // (ticket) was never configured, id=15 (badge/Namensschild) was
            // genuinely set to Matukio's own shipped default branding image.
            nametagBackgroundImage: 'images/powered_by.png'
          },
          csvXml: {
            csvTemplate: "'MAT_BOOKING_NUMBER';'MAT_EVENT_TITLE';'MAT_CSV_BOOKING_DETAILS';'MAT_BOOKING_PAYMENT_BRUTTO';'MAT_BOOKING_NAME';'MAT_BOOKING_PAYMENT_METHOD';'MAT_BOOKING_STATUS';'MAT_BOOKING_EXTRA_PAYMENT_OPTIONS';'MAT_BOOKING_PAYMENT_STATUS';'",
            xmlTemplate: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<!-- Generated by Matukio -->\n<BOOKING>\n<BOOKING_NUMBER>MAT_BOOKING_NUMBER</BOOKING_NUMBER>\n<EVENT>MAT_EVENT_TITLE</EVENT>\n<EVENT_NUMBER>MAT_EVENT_NUMBER</EVENT_NUMBER>\n<TITLE>MAT_BOOKING_TITLE</TITLE>\n<FIRSTNAME>MAT_BOOKING_FIRSTNAME</FIRSTNAME>\n<LASTNAME>MAT_BOOKING_LASTNAME</LASTNAME>\n<COMPANY>MAT_BOOKING_COMPANY</COMPANY>\n<STREET>MAT_BOOKING_STREET</STREET>\n<ZIPCODE>MAT_BOOKING_ZIP</ZIPCODE>\n<CITY>MAT_BOOKING_CITY</CITY>\n<COUNTRY>MAT_BOOKING_COUNTRY</COUNTRY>\n<PHONE>MAT_BOOKING_PHONE</PHONE>\n<MOBILE>MAT_BOOKING_MOBILE</MOBILE>\n<EMAIL>MAT_BOOKING_EMAIL</EMAIL>\n<COMMENT>MAT_BOOKING_COMMENT</COMMENT>\n<PLACES>MAT_BOOKING_BOOKEDNR</PLACES>\n<AMOUNT>MAT_BOOKING_GROSS</AMOUNT>\n<PERSONS>\nMAT_XML_BOOKING_OTHER_PERSON_DATA\n</PERSONS>\n</BOOKING>'
          }
        }
      });
    }

    res.json(config);
  } catch (error) {
    console.error('Error fetching templates config:', error);
    res.status(500).json({ error: 'Failed to fetch templates config' });
  }
});

// Update the templates config
router.put('/:id', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const id = String(req.params.id);
    
    // Extract only valid fields
    const { emails, listViews, invoices, certificates, tickets, csvXml } = req.body;
    
    // Only update if at least one valid field is provided
    const updateData: any = {};
    if (emails !== undefined) updateData.emails = emails;
    if (listViews !== undefined) updateData.listViews = listViews;
    if (invoices !== undefined) updateData.invoices = invoices;
    if (certificates !== undefined) updateData.certificates = certificates;
    if (tickets !== undefined) updateData.tickets = tickets;
    if (csvXml !== undefined) updateData.csvXml = csvXml;

    const config = await prisma.templatesConfig.upsert({
      where: { id },
      update: updateData,
      create: {
        id,
        emails: emails || {},
        listViews: listViews || {},
        invoices: invoices || {},
        certificates: certificates || {},
        tickets: tickets || {},
        csvXml: csvXml || {}
      }
    });

    res.json(config);
  } catch (error) {
    console.error('Error updating templates config:', error);
    res.status(500).json({ error: 'Failed to update templates config' });
  }
});

export default router;
