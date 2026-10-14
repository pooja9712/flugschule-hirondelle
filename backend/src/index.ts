// Must be set before anything else in the process touches Date/Intl -
// this app is entirely for a German business (Flugschule Hirondelle) and
// every "today"/date-bucket calculation in this codebase uses the
// server's local time as the German business's local time. Without this,
// that assumption only happens to hold if the server's own OS timezone is
// already Europe/Berlin; on any other host (this dev machine is IST, and
// plenty of real hosting defaults to UTC) "today" silently means the
// server's today, not Germany's - which is exactly the class of bug found
// and fixed in stats.routes.ts. Setting TZ here makes Date's own local
// getters (getFullYear/getMonth/getDate/getHours/toLocaleString(...))
// always mean Germany's calendar day, regardless of the underlying OS/
// container timezone, without having to thread a timezone through every
// date calculation individually.
process.env.TZ = 'Europe/Berlin';

import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import usersRoutes from './routes/users.routes';
import eventsRoutes from './routes/events.routes';
import newslettersRoutes from './routes/newsletters.routes';
import newsletterCampaignsRoutes from './routes/newsletterCampaigns.routes';
import newsletterTemplatesRoutes from './routes/newsletterTemplates.routes';
import newsletterQueueRoutes from './routes/newsletterQueue.routes';
import newsletterConfigRoutes from './routes/newsletterConfig.routes';
import newsletterSegmentsRoutes from './routes/newsletterSegments.routes';
import newsletterAutomationsRoutes from './routes/newsletterAutomations.routes';
import newsletterBouncesRoutes from './routes/newsletterBounces.routes';
import newsletterFormsRoutes from './routes/newsletterForms.routes';
import commentsRoutes from './routes/comments.routes';
import commentSettingsRoutes from './routes/commentSettings.routes';
import commentEmailQueueRoutes from './routes/commentEmailQueue.routes';
import bookingsRoutes from './routes/bookings.routes';
import categoryRoutes from './routes/categories.routes';
import organizersRoutes from './routes/organizers.routes';
import customFieldsRoutes from './routes/customFields.routes';
import newsletterFieldsRoutes from './routes/newsletterFields.routes';
import locationsRoutes from './routes/locations.routes';
import vouchersRoutes from './routes/vouchers.routes';
import tieredFeesRoutes from './routes/tieredFees.routes';
import taxRatesRoutes from './routes/taxRates.routes';
import currenciesRoutes from './routes/currencies.routes';
import bookingFormConfigRoutes from './routes/bookingFormConfig.routes';
import templatesConfigRoutes from './routes/templatesConfig.routes';
import formConfigsRoutes from './routes/formconfigs.routes';
import statsRoutes from './routes/stats.routes';
import importRoutes from './routes/import.routes';
import ecwidConfigRoutes from './routes/ecwidConfig.routes';
import cookieConsentRoutes from './routes/cookieConsent.routes';
import headerContactRoutes from './routes/headerContact.routes';
import settingsConfigRoutes from './routes/settingsConfig.routes';
import formsRoutes from './routes/forms.routes';
import newsRoutes from './routes/news.routes';
import downloadsRoutes from './routes/downloads.routes';
import weblinksRoutes from './routes/weblinks.routes';
import bannersRoutes from './routes/banners.routes';
import newsletterListsRoutes from './routes/newsletterlists.routes';
import searchRoutes from './routes/search.routes';
import uploadRoutes from './routes/upload.routes';
import pagemediaRoutes from './routes/pagemedia.routes';
import pagegalleryRoutes from './routes/pagegallery.routes'; // NEW - standalone Galerie feature, separate from pagemedia
import pagesRoutes from './routes/pages.routes'; // NEW - "Seiten" CMS: admin-created pages with their own URL
import homeContentRoutes from './routes/homecontent.routes'; // NEW - editable data (text/images) for the hardcoded Home.tsx design
import sitePageContentRoutes from './routes/sitePageContent.routes'; // NEW - same idea as homeContentRoutes, for Ausbildung/Performance/Reisen/Service/Infos
import pageArticleRoutes from './routes/pageArticle.routes'; // PAGE ARTICLE MODE - Joomla-style body content (revert: remove this + the app.use line)
import trashRoutes from './routes/trash.routes'; // NEW - WordPress-style Papierkorb (restore/permanently-delete) for pages.routes.ts, homecontent.routes.ts and sitePageContent.routes.ts deletes
import fixedPageDuplicatesRoutes from './routes/fixedPageDuplicates.routes'; // NEW - true same-design duplicates of the 6 fixed pages (see FixedPageRouter.tsx on the frontend)
import fixedPageSettingsRoutes from './routes/fixedPageSettings.routes'; // NEW - editable title/URL/publish-status for the 6 fixed pages themselves (see FixedPageGate.tsx on the frontend)
import menuRoutes from './routes/menu.routes'; // NEW - admin-managed header navigation (Admin > Menü)
import legalPagesRoutes from './routes/legalPages.routes';
import serviceOrdersRoutes from './routes/serviceorders.routes';
import trackRoutes from './routes/track.routes';
import path from 'path';
import 'dotenv/config'; // loads .env variables
import { raQueryParser } from './middlewares/raCompat.middleware';
import { maintenanceGate, handleUnlockSubmit } from './middlewares/maintenanceGate.middleware';

const app = express();
const PORT = process.env.PORT || 5555;

app.set('query parser', raQueryParser);

// The site's own frontend is same-origin in production (this same process
// serves the built frontend - see the NODE_ENV==='production' block below),
// so it never actually needs CORS. This allowlist exists only for local dev
// (frontend on a different Vite port) and any explicitly configured
// FRONTEND_URL - previously cors() had no origin restriction at all, letting
// any third-party site call every endpoint cross-origin.
const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'https://flugschule-hirondelle.com',
  'https://www.flugschule-hirondelle.com',
  'https://fs-hirondelle.de',
  'https://www.fs-hirondelle.de',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
]);

app.use(cors({
  origin: (origin, callback) => {
    // No Origin header = same-origin request, a server-to-server call, or a
    // tool like curl - always allow those. An unrecognized Origin just gets
    // no Access-Control-Allow-Origin header (callback(null, false)) rather
    // than an error - the request still executes, but a compliant browser
    // won't let that site's JS read the response.
    callback(null, !origin || allowedOrigins.has(origin));
  },
  exposedHeaders: ['Content-Range']
}));
app.use(express.json());

// "Coming soon" gate (Settings > maintenanceModeEnabled) - must run before
// static/API serving but after its own unlock-form endpoint is reachable.
// The form posts application/x-www-form-urlencoded, not JSON, hence its own
// urlencoded parser here rather than relying on the global express.json().
app.post('/__unlock', express.urlencoded({ extended: false }), handleUnlockSubmit);
app.use(maintenanceGate);

// Serve static uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));

// Basic health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Flugschule Hirondelle API is running' });
});

// Auth routes
app.use('/api/auth', authRoutes);

// Admin / User management routes
app.use('/api/users', usersRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/newsletters', newslettersRoutes);
app.use('/api/newslettercampaigns', newsletterCampaignsRoutes);
app.use('/api/newslettertemplates', newsletterTemplatesRoutes);
app.use('/api/newsletterqueue', newsletterQueueRoutes);
app.use('/api/newsletterconfig', newsletterConfigRoutes);
app.use('/api/newslettersegments', newsletterSegmentsRoutes);
app.use('/api/newsletterautomations', newsletterAutomationsRoutes);
app.use('/api/newsletterbounces', newsletterBouncesRoutes);
app.use('/api/newsletterforms', newsletterFormsRoutes);
app.use('/api/track', trackRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/commentsettings', commentSettingsRoutes);
app.use('/api/commentemailqueue', commentEmailQueueRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/organizers', organizersRoutes);
app.use('/api/customFields', customFieldsRoutes);
app.use('/api/newsletterFields', newsletterFieldsRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api/vouchers', vouchersRoutes);
app.use('/api/tieredFees', tieredFeesRoutes);
app.use('/api/taxRates', taxRatesRoutes);
app.use('/api/currencies', currenciesRoutes);
app.use('/api/bookingFormConfig', bookingFormConfigRoutes);
app.use('/api/templatesConfig', templatesConfigRoutes);
app.use('/api/formconfigs', formConfigsRoutes);
app.use('/api/ecwid-config', ecwidConfigRoutes);
app.use('/api/cookie-consent-config', cookieConsentRoutes);
app.use('/api/header-contact', headerContactRoutes);
app.use('/api/settingsConfig', settingsConfigRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/import', importRoutes);
app.use('/api/forms', formsRoutes);
app.use('/api/news', newsRoutes);
app.use('/api', downloadsRoutes);
app.use('/api', weblinksRoutes);
app.use('/api/banners', bannersRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/pagemedia', pagemediaRoutes);
app.use('/api/pagegallery', pagegalleryRoutes); // NEW - standalone Galerie feature
app.use('/api/pages', pagesRoutes); // NEW - "Seiten" CMS
app.use('/api/homecontent', homeContentRoutes); // NEW - Home.tsx data
app.use('/api/sitepagecontent', sitePageContentRoutes); // NEW - Ausbildung/Performance/Reisen/Service/Infos data
app.use('/api/page-articles', pageArticleRoutes); // PAGE ARTICLE MODE - see routes/pageArticle.routes.ts
app.use('/api/trash', trashRoutes); // NEW - Papierkorb (restore/permanently-delete)
app.use('/api/fixed-page-duplicates', fixedPageDuplicatesRoutes); // NEW - true same-design duplicates
app.use('/api/fixed-page-settings', fixedPageSettingsRoutes); // NEW - editable title/URL/publish-status for the 6 fixed pages themselves
app.use('/api', menuRoutes); // NEW - admin-managed header navigation (/menu/public, /menuitems, /menusubitems)
app.use('/api/legalPages', legalPagesRoutes);
app.use('/api/serviceorders', serviceOrdersRoutes);
app.use('/api/newsletterlists', newsletterListsRoutes);

// In production, this same process also serves the built frontend (single
// port, matching a reverse proxy that forwards everything to one origin).
// Dev keeps using two separate servers with Vite's own proxy for /api and /uploads.
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(process.cwd(), '..', 'frontend', 'dist');
  app.use(express.static(frontendDist));
  // Express 5's router (path-to-regexp v6+) no longer accepts a bare '*'
  // wildcard route pattern - a path-less middleware matches every remaining
  // request just as well, without touching that parser at all.
  app.use((req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

import { startCronJobs } from './jobs/reminders.job';
import { startNewsletterCron } from './jobs/newsletter.job';
import { startNewsletterAutomationCron } from './jobs/newsletterAutomation.job';
import { startBounceCheckCron } from './jobs/bounceCheck.job';

// Start server - cron jobs are only registered once this process has
// actually won the port (see the listen callback below). Starting them
// unconditionally here used to mean that a process which lost the port
// (e.g. a `tsx watch` restart whose predecessor didn't fully exit, common
// on Windows) still ran its own copy of the daily reminder/rating-request
// cron forever, invisibly, alongside the real server - the process never
// serves HTTP but keeps sending duplicate emails at 8am every day.
const httpServer = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  startCronJobs();
  startNewsletterCron();
  startNewsletterAutomationCron();
  startBounceCheckCron();
});
httpServer.on('error', (err) => {
  console.error('LISTEN ERROR:', err);
  // A process that failed to bind the port must not linger - it has
  // nothing left to do, and staying alive is exactly how the zombie-cron
  // duplicate-email bug happened.
  process.exit(1);
});
