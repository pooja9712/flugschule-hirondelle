import { useEffect } from 'react';
import { Admin, Resource, fetchUtils, CustomRoutes, defaultTheme, Authenticated } from 'react-admin';
import { Route, Navigate } from 'react-router-dom';
import simpleRestProvider from 'ra-data-simple-rest';
import polyglotI18nProvider from 'ra-i18n-polyglot';
// @ts-ignore
import germanMessages from 'ra-language-german';
import { authProvider } from './authProvider';
import { AdminLoginPage } from './LoginPage';
import { EventList, EventEdit, EventCreate } from './Events';
import { AcyDashboard } from './AcyMailing/Stubs';
import { AcyConfiguration } from './AcyMailing/Configuration';
import { AcyTemplates } from './AcyMailing/Templates';
import { AcyQueue } from './AcyMailing/Queue';
import { AcySubscribers } from './AcyMailing/Subscribers';
import { AcyEditSubscriber } from './AcyMailing/EditSubscriber';
import { AcyLists } from './AcyMailing/Lists';
import { AcyFields } from './AcyMailing/Fields';
import { AcyStatistics } from './AcyMailing/Statistics';
import { AcyEmails } from './AcyMailing/Emails';
import { AcyChooseCampaignType } from './AcyMailing/ChooseCampaignType';
import { AcyChooseTemplate } from './AcyMailing/ChooseTemplate';
import { AcyEditEmail } from './AcyMailing/EditEmail';
import { AcySegments } from './AcyMailing/Segments';
import { AcyAutomations } from './AcyMailing/Automations';
import { AcyBounces } from './AcyMailing/Bounces';
import { AcyForms } from './AcyMailing/Forms';
import { CommentList, CommentEdit } from './Comments';
import { CommentEmailQueueList } from './CommentEmailQueue';
import { CommentSettingsPage } from './CommentSettingsPage';
import { BookingList, BookingShow } from './Bookings';
import { CategoryList, CategoryEdit, CategoryCreate } from './Categories';
import { OrganizerList, OrganizerEdit, OrganizerCreate } from './Organizers';
import { CustomFieldList, CustomFieldEdit, CustomFieldCreate } from './CustomFields';
import { LocationList, LocationEdit, LocationCreate } from './Locations';
import { VoucherList, VoucherEdit, VoucherCreate } from './Vouchers';
import { TieredFeeList, TieredFeeEdit, TieredFeeCreate } from './TieredFees';
import { TaxRateList, TaxRateEdit, TaxRateCreate } from './TaxRates';
import { CurrencyList, CurrencyEdit, CurrencyCreate } from './Currencies';
import { BookingFormBuilder } from './BookingFormBuilder';
import { ServiceAuftragFormBuilder } from './FormBuilder';
import { FormFieldsEditor } from './FormFieldsEditor';
import { NewsList, NewsEdit, NewsCreate } from './News';
import { DownloadCategoryList, DownloadCategoryEdit, DownloadCategoryCreate, DownloadFileList, DownloadFileEdit, DownloadFileCreate } from './Downloads';
import { WebLinkCategoryList, WebLinkCategoryEdit, WebLinkCategoryCreate, WebLinkList, WebLinkEdit, WebLinkCreate } from './WebLinks';
import { BannerGroupsOverview, BannerGroupManager } from './Banners';
import { PageMediaConfigPage } from './PageMedia';
import { GalleryList, GalleryEdit, GalleryCreate } from './Gallery'; // NEW - standalone Galerie feature, separate from PageMedia
import { PagesManager } from './Pages'; // NEW - "Seiten" CMS: admin-created pages with their own URL, Unlayer-based editor
import { MenuManager } from './MenuManager'; // NEW - "Menü": header nav items and their sub-items
import { HomeContentEditor } from './HomeContentEditor'; // NEW - editable data (text/images) for the hardcoded Home.tsx design
import { PageArticleEditor } from './PageArticleEditor'; // PAGE ARTICLE MODE - Joomla-style body editor (revert: remove this + its Route)
import { AusbildungContentEditor } from './AusbildungContentEditor';
import { PerformanceContentEditor } from './PerformanceContentEditor';
import { ReisenContentEditor } from './ReisenContentEditor';
import { ServiceContentEditor } from './ServiceContentEditor';
import { TandemContentEditor } from './TandemContentEditor'; // NEW - /tandem
import { InfosContentEditor } from './InfosContentEditor';
import { TeamContentEditor } from './TeamContentEditor'; // NEW - /infos/team
import { GelaendeContentEditor } from './GelaendeContentEditor'; // NEW - /infos/gelaende + its 10 detail pages
import { WetterContentEditor } from './WetterContentEditor'; // NEW - /infos/wetter
import { MedienContentEditor } from './MedienContentEditor'; // NEW - /infos/medien
import { GruppeneventsContentEditor } from './GruppeneventsContentEditor'; // NEW - /infos/gruppenevents
import { GutscheineContentEditor } from './GutscheineContentEditor'; // NEW - /infos/gutscheine
import { VersicherungenContentEditor } from './VersicherungenContentEditor'; // NEW - /infos/versicherungen
import { FAQContentEditor } from './FAQContentEditor'; // NEW - /faq
import { SchnupperkursContentEditor } from './SchnupperkursContentEditor'; // NEW - /ausbildung/schnupperkurs
import { LScheinContentEditor } from './LScheinContentEditor'; // NEW - /ausbildung/l-schein
import { AScheinContentEditor } from './AScheinContentEditor'; // NEW - /ausbildung/a-schein
import { BScheinContentEditor } from './BScheinContentEditor'; // NEW - /ausbildung/b-schein
import { WindenscheinContentEditor } from './WindenscheinContentEditor'; // NEW - /ausbildung/windenschein
import { TandemscheinContentEditor } from './TandemscheinContentEditor'; // NEW - /ausbildung/tandemschein
import { AusbildungskonzeptContentEditor } from './AusbildungskonzeptContentEditor'; // NEW - /ausbildung/ausbildungskonzept
import { SicherheitstrainingContentEditor } from './SicherheitstrainingContentEditor'; // NEW - /performance/sicherheitstraining
import { RettungsgeraetetrainingContentEditor } from './RettungsgeraetetrainingContentEditor'; // NEW - /performance/rettungsgeraetetraining
import { GroundhandlingContentEditor } from './GroundhandlingContentEditor'; // NEW - /performance/groundhandling
import { BrasilienTourContentEditor } from './BrasilienTourContentEditor'; // NEW - /reisen/brasilien-tour
import { KolumbienTourContentEditor } from './KolumbienTourContentEditor'; // NEW - /reisen/kolumbien-tour
import { SuedafrikaTourContentEditor } from './SuedafrikaTourContentEditor'; // NEW - /reisen/suedafrika-tour
import { BassanoTourContentEditor } from './BassanoTourContentEditor'; // NEW - /reisen/bassano-tour
import { GriechenlandTourContentEditor } from './GriechenlandTourContentEditor'; // NEW - /reisen/griechenland-tour
import { SlowenienTourContentEditor } from './SlowenienTourContentEditor'; // NEW - /reisen/slowenien-tour
import { BergamoTourContentEditor } from './BergamoTourContentEditor'; // NEW - /reisen/bergamo-tour
import { SavoyeTourContentEditor } from './SavoyeTourContentEditor'; // NEW - /reisen/savoye-tour
import { VogesenTourContentEditor } from './VogesenTourContentEditor'; // NEW - /reisen/vogesen-tour
import { PfalzTourContentEditor } from './PfalzTourContentEditor'; // NEW - /reisen/pfalz-tour
import { ZweiJahresCheckContentEditor } from './ZweiJahresCheckContentEditor'; // NEW - /service/2-jahres-check
import { RettungspackenContentEditor } from './RettungspackenContentEditor'; // NEW - /service/rettungspacken
import { TrimmtuningContentEditor } from './TrimmtuningContentEditor'; // NEW - /service/trimmtuning
import { ReparaturServiceContentEditor } from './ReparaturServiceContentEditor'; // NEW - /service/reparatur
import { BillingsContentEditor } from './BillingsContentEditor'; // NEW - /infos/gelaende/billings
import { ErlauContentEditor } from './ErlauContentEditor'; // NEW - /infos/gelaende/erlau
import { GadernContentEditor } from './GadernContentEditor'; // NEW - /infos/gelaende/gadern
import { LindenfelsGelaendeContentEditor } from './LindenfelsContentEditor'; // NEW - /infos/gelaende/lindenfels
import { NonrodNordostContentEditor } from './NonrodNordostContentEditor'; // NEW - /infos/gelaende/nonrod-nordost
import { NonrodContentEditor } from './NonrodContentEditor'; // NEW - /infos/gelaende/nonrod
import { StaufContentEditor } from './StaufContentEditor'; // NEW - /infos/gelaende/stauf
import { WinterkastenContentEditor } from './WinterkastenContentEditor'; // NEW - /infos/gelaende/winterkasten
import { BadKreuznachContentEditor } from './BadKreuznachContentEditor'; // NEW - /infos/gelaende/bad-kreuznach
import { HerrenteichContentEditor } from './HerrenteichContentEditor'; // NEW - /infos/gelaende/herrenteich
import { Trash } from './Trash'; // NEW - WordPress-style Papierkorb for Pages.tsx deletes
import { ServiceOrderList, ServiceOrderEdit } from './ServiceOrders';
import { FormulareList } from './Formulare';
import { TemplatesBuilder } from './TemplatesBuilder';
import { CustomLayout } from './CustomLayout';
import { EventsDashboard } from './EventsDashboard';
import { EventStatistics } from './EventStatistics';
import { Import } from './Import';
import { EcwidConfigPage } from './EcwidConfigPage';
import { CookieConsentConfigPage } from './CookieConsentConfigPage';
import { SettingsConfigPage } from './SettingsConfigPage';
import { LegalPageList, LegalPageEdit } from './LegalPages';
import { UserList, UserEdit, UserCreate } from './Users';

const customGermanMessages = {
    ...germanMessages,
    ra: {
        ...germanMessages.ra,
        page: {
            ...germanMessages.ra?.page,
            empty: 'Noch keine Einträge.',
        },
    },
    RA: {
        SORT: {
            SORT_BY: 'Sortieren nach',
        },
    },
    resources: {
        events: { empty: 'Noch keine Veranstaltungen vorhanden.' },
        customFields: { empty: 'Noch keine benutzerdefinierten Felder vorhanden.' },
        locations: { empty: 'Noch keine Veranstaltungsorte vorhanden.' },
        vouchers: { empty: 'Noch keine Gutscheine vorhanden.' },
        tieredFees: { empty: 'Noch keine gestaffelten Gebühren vorhanden.' },
        taxRates: { empty: 'Noch keine Steuersätze vorhanden.' },
        currencies: { empty: 'Noch keine Währungen vorhanden.' },
        organizers: { empty: 'Noch keine Veranstalter vorhanden.' },
        categories: { empty: 'Noch keine Kategorien vorhanden.' },
        news: { empty: 'Noch keine Neuigkeiten vorhanden.' },
        downloadcategories: { empty: 'Noch keine Download-Kategorien vorhanden.' },
        files: { empty: 'Noch keine Downloads vorhanden.' },
        weblinkcategories: { empty: 'Noch keine Link-Kategorien vorhanden.' },
        links: { empty: 'Noch keine Links vorhanden.' },
        legalPages: { empty: 'Noch keine rechtlichen Seiten vorhanden.' },
    }
};

const i18nProvider = polyglotI18nProvider(() => customGermanMessages, 'de');

const httpClient = (url: string, options: fetchUtils.Options = {}) => {
    if (!options.headers) {
        options.headers = new Headers({ Accept: 'application/json' });
    }
    const token = localStorage.getItem('auth');
    if (token) {
        (options.headers as Headers).set('Authorization', `Bearer ${token}`);
    }
    return fetchUtils.fetchJson(url, options);
};

const dataProvider = simpleRestProvider('/api', httpClient);

const lightTheme = {
    ...defaultTheme,
    palette: {
        mode: 'light' as const,
        primary: {
            main: '#0ea5e9', // matches the AcyMailing section's accent color
        },
        secondary: {
            main: '#1e293b',
        },
        background: {
            default: '#f4f6f8',
        }
    },
    components: {
        ...defaultTheme.components,
        MuiAppBar: {
            styleOverrides: {
                colorSecondary: {
                    backgroundColor: '#fff',
                    color: '#1e293b',
                },
            },
        },
        // The sidebar is an MUI Drawer under the hood - styling its Paper
        // directly guarantees the background always fills the full
        // scrollable height, no matter how many menu items there are.
        MuiDrawer: {
            styleOverrides: {
                paper: {
                    backgroundColor: '#ffffff',
                },
            },
        },
    },
};

// We will add custom resources here as we build them on the backend
export const AdminApp = () => {
    useEffect(() => {
        document.body.classList.add('admin-root');
        return () => document.body.classList.remove('admin-root');
    }, []);

    return (
    <Admin basename="/admin" theme={lightTheme} layout={CustomLayout} loginPage={AdminLoginPage} authProvider={authProvider} dataProvider={dataProvider} i18nProvider={i18nProvider} dashboard={EventsDashboard}>
        <Resource name="users" options={{ label: 'Benutzer' }} list={UserList} edit={UserEdit} create={UserCreate} />
        <Resource name="events" options={{ label: 'Veranstaltungen' }} list={EventList} edit={EventEdit} create={EventCreate} />
        <Resource name="customFields" options={{ label: 'Benutzerdefinierte Felder' }} list={CustomFieldList} edit={CustomFieldEdit} create={CustomFieldCreate} />
        <Resource name="locations" options={{ label: 'Veranstaltungsorte' }} list={LocationList} edit={LocationEdit} create={LocationCreate} />
        <Resource name="vouchers" options={{ label: 'Gutscheine' }} list={VoucherList} edit={VoucherEdit} create={VoucherCreate} />
        <Resource name="tieredFees" options={{ label: 'Gestaffelte Gebühren' }} list={TieredFeeList} edit={TieredFeeEdit} create={TieredFeeCreate} />
        <Resource name="taxRates" options={{ label: 'Steuersätze' }} list={TaxRateList} edit={TaxRateEdit} create={TaxRateCreate} />
        <Resource name="currencies" options={{ label: 'Währungen' }} list={CurrencyList} edit={CurrencyEdit} create={CurrencyCreate} />
        <Resource name="organizers" options={{ label: 'Veranstalter' }} list={OrganizerList} edit={OrganizerEdit} create={OrganizerCreate} />
        <Resource name="categories" options={{ label: 'Kategorien' }} list={CategoryList} edit={CategoryEdit} create={CategoryCreate} />
        <Resource name="bookings" options={{ label: 'Buchungen' }} list={BookingList} show={BookingShow} />
        <Resource name="bookingFormConfig" intent="registration" />
        <Resource name="formconfigs" options={{ label: 'Formulare' }} list={FormulareList} />
        <CustomRoutes>
            <Route path="/events-dashboard" element={<Authenticated><EventsDashboard /></Authenticated>} />
            <Route path="/event-statistics" element={<Authenticated><EventStatistics /></Authenticated>} />
            <Route path="/menu" element={<Authenticated><MenuManager /></Authenticated>} />
            <Route path="/banners/manage/:position" element={<Authenticated><BannerGroupManager /></Authenticated>} />
            <Route path="/pages" element={<Authenticated><PagesManager /></Authenticated>} />
            {/* :contentId? is only present when editing a fixed-page
                duplicate (Pages.tsx > "Duplizieren") - see
                FixedPageDuplicate model / fixedPageDuplicates.routes.ts. */}
            <Route path="/home-content/:contentId?" element={<Authenticated><HomeContentEditor /></Authenticated>} />
            {/* PAGE ARTICLE MODE */}
            <Route path="/page-article/:key" element={<Authenticated><PageArticleEditor /></Authenticated>} />
            <Route path="/ausbildung-content/:contentId?" element={<Authenticated><AusbildungContentEditor /></Authenticated>} />
            <Route path="/performance-content/:contentId?" element={<Authenticated><PerformanceContentEditor /></Authenticated>} />
            <Route path="/reisen-content/:contentId?" element={<Authenticated><ReisenContentEditor /></Authenticated>} />
            <Route path="/service-content/:contentId?" element={<Authenticated><ServiceContentEditor /></Authenticated>} />
            <Route path="/tandem-content/:contentId?" element={<Authenticated><TandemContentEditor /></Authenticated>} />
            <Route path="/infos-content/:contentId?" element={<Authenticated><InfosContentEditor /></Authenticated>} />
            <Route path="/team-content/:contentId?" element={<Authenticated><TeamContentEditor /></Authenticated>} />
            <Route path="/gelaende-content/:contentId?" element={<Authenticated><GelaendeContentEditor /></Authenticated>} />
            <Route path="/wetter-content/:contentId?" element={<Authenticated><WetterContentEditor /></Authenticated>} />
            <Route path="/medien-content/:contentId?" element={<Authenticated><MedienContentEditor /></Authenticated>} />
            <Route path="/gruppenevents-content/:contentId?" element={<Authenticated><GruppeneventsContentEditor /></Authenticated>} />
            <Route path="/gutscheine-content/:contentId?" element={<Authenticated><GutscheineContentEditor /></Authenticated>} />
            <Route path="/versicherungen-content/:contentId?" element={<Authenticated><VersicherungenContentEditor /></Authenticated>} />
            <Route path="/faq-content/:contentId?" element={<Authenticated><FAQContentEditor /></Authenticated>} />
            <Route path="/schnupperkurs-content/:contentId?" element={<Authenticated><SchnupperkursContentEditor /></Authenticated>} />
            <Route path="/l-schein-content/:contentId?" element={<Authenticated><LScheinContentEditor /></Authenticated>} />
            <Route path="/a-schein-content/:contentId?" element={<Authenticated><AScheinContentEditor /></Authenticated>} />
            <Route path="/b-schein-content/:contentId?" element={<Authenticated><BScheinContentEditor /></Authenticated>} />
            <Route path="/windenschein-content/:contentId?" element={<Authenticated><WindenscheinContentEditor /></Authenticated>} />
            <Route path="/tandemschein-content/:contentId?" element={<Authenticated><TandemscheinContentEditor /></Authenticated>} />
            <Route path="/ausbildungskonzept-content/:contentId?" element={<Authenticated><AusbildungskonzeptContentEditor /></Authenticated>} />
            <Route path="/sicherheitstraining-content/:contentId?" element={<Authenticated><SicherheitstrainingContentEditor /></Authenticated>} />
            <Route path="/rettungsgeraetetraining-content/:contentId?" element={<Authenticated><RettungsgeraetetrainingContentEditor /></Authenticated>} />
            <Route path="/groundhandling-content/:contentId?" element={<Authenticated><GroundhandlingContentEditor /></Authenticated>} />
            <Route path="/brasilien-tour-content/:contentId?" element={<Authenticated><BrasilienTourContentEditor /></Authenticated>} />
            <Route path="/kolumbien-tour-content/:contentId?" element={<Authenticated><KolumbienTourContentEditor /></Authenticated>} />
            <Route path="/suedafrika-tour-content/:contentId?" element={<Authenticated><SuedafrikaTourContentEditor /></Authenticated>} />
            <Route path="/bassano-tour-content/:contentId?" element={<Authenticated><BassanoTourContentEditor /></Authenticated>} />
            <Route path="/griechenland-tour-content/:contentId?" element={<Authenticated><GriechenlandTourContentEditor /></Authenticated>} />
            <Route path="/slowenien-tour-content/:contentId?" element={<Authenticated><SlowenienTourContentEditor /></Authenticated>} />
            <Route path="/bergamo-tour-content/:contentId?" element={<Authenticated><BergamoTourContentEditor /></Authenticated>} />
            <Route path="/savoye-tour-content/:contentId?" element={<Authenticated><SavoyeTourContentEditor /></Authenticated>} />
            <Route path="/vogesen-tour-content/:contentId?" element={<Authenticated><VogesenTourContentEditor /></Authenticated>} />
            <Route path="/pfalz-tour-content/:contentId?" element={<Authenticated><PfalzTourContentEditor /></Authenticated>} />
            <Route path="/2-jahres-check-content/:contentId?" element={<Authenticated><ZweiJahresCheckContentEditor /></Authenticated>} />
            <Route path="/rettungspacken-content/:contentId?" element={<Authenticated><RettungspackenContentEditor /></Authenticated>} />
            <Route path="/trimmtuning-content/:contentId?" element={<Authenticated><TrimmtuningContentEditor /></Authenticated>} />
            <Route path="/reparatur-content/:contentId?" element={<Authenticated><ReparaturServiceContentEditor /></Authenticated>} />
            <Route path="/billings-content/:contentId?" element={<Authenticated><BillingsContentEditor /></Authenticated>} />
            <Route path="/erlau-content/:contentId?" element={<Authenticated><ErlauContentEditor /></Authenticated>} />
            <Route path="/gadern-content/:contentId?" element={<Authenticated><GadernContentEditor /></Authenticated>} />
            <Route path="/lindenfels-content/:contentId?" element={<Authenticated><LindenfelsGelaendeContentEditor /></Authenticated>} />
            <Route path="/nonrod-nordost-content/:contentId?" element={<Authenticated><NonrodNordostContentEditor /></Authenticated>} />
            <Route path="/nonrod-content/:contentId?" element={<Authenticated><NonrodContentEditor /></Authenticated>} />
            <Route path="/stauf-content/:contentId?" element={<Authenticated><StaufContentEditor /></Authenticated>} />
            <Route path="/winterkasten-content/:contentId?" element={<Authenticated><WinterkastenContentEditor /></Authenticated>} />
            <Route path="/bad-kreuznach-content/:contentId?" element={<Authenticated><BadKreuznachContentEditor /></Authenticated>} />
            <Route path="/herrenteich-content/:contentId?" element={<Authenticated><HerrenteichContentEditor /></Authenticated>} />
            <Route path="/trash" element={<Authenticated><Trash /></Authenticated>} />
            {/* NEW - Galerie's own trash, separate from the Pages one above
                (Trash's default `kinds` prop is page-only) - see Trash.tsx
                and Gallery.tsx's "Papierkorb" button. */}
            <Route
              path="/gallery-trash"
              element={
                <Authenticated>
                  <Trash
                    kinds={['pagegallery']}
                    title="Galerie-Papierkorb"
                    description={'Gelöschte Galerien landen hier und können wiederhergestellt werden. "Endgültig löschen" entfernt den Eintrag dauerhaft.'}
                    backTo="/admin/pagegallery"
                    backLabel="Zurück zur Galerie"
                  />
                </Authenticated>
              }
            />
            <Route path="/booking-form-config" element={<Authenticated><BookingFormBuilder /></Authenticated>} />
            <Route path="/service-auftrag-form" element={<Authenticated><ServiceAuftragFormBuilder /></Authenticated>} />
            <Route path="/forms/:formId/edit" element={<Authenticated><ServiceAuftragFormBuilder /></Authenticated>} />
            <Route path="/forms/:formId/fields" element={<Authenticated><FormFieldsEditor /></Authenticated>} />
            <Route path="/forms/:formId/data" element={<Authenticated><ServiceOrderList /></Authenticated>} />
            <Route path="/templates" element={<Authenticated><TemplatesBuilder /></Authenticated>} />
            <Route path="/import" element={<Authenticated><Import /></Authenticated>} />
            <Route path="/ecwid-config" element={<Authenticated><EcwidConfigPage /></Authenticated>} />
            <Route path="/pagemedia" element={<Authenticated><PageMediaConfigPage /></Authenticated>} />
            <Route path="/cookie-consent" element={<Authenticated><CookieConsentConfigPage /></Authenticated>} />
            <Route path="/settings-config" element={<Authenticated><SettingsConfigPage /></Authenticated>} />
            <Route path="/comment-settings" element={<Authenticated><CommentSettingsPage /></Authenticated>} />
            {/* Redirect old newsletter routes */}
            <Route path="/newsletters/*" element={<Navigate to="/acymailing/dashboard" replace />} />
            <Route path="/newslettercampaigns/*" element={<Navigate to="/acymailing/dashboard" replace />} />
        </CustomRoutes>
        <CustomRoutes noLayout>
            <Route path="/acymailing/dashboard" element={<Authenticated><AcyDashboard /></Authenticated>} />
            <Route path="/acymailing/subscribers" element={<Authenticated><AcySubscribers /></Authenticated>} />
            <Route path="/acymailing/subscribers/edit/:email" element={<Authenticated><AcyEditSubscriber /></Authenticated>} />
            <Route path="/acymailing/lists" element={<Authenticated><AcyLists /></Authenticated>} />
            <Route path="/acymailing/fields" element={<Authenticated><AcyFields /></Authenticated>} />
            <Route path="/acymailing/statistics" element={<Authenticated><AcyStatistics /></Authenticated>} />
            <Route path="/acymailing/templates" element={<Authenticated><AcyTemplates /></Authenticated>} />
            <Route path="/acymailing/emails" element={<Authenticated><AcyEmails /></Authenticated>} />
            <Route path="/acymailing/emails/create" element={<Authenticated><AcyChooseCampaignType /></Authenticated>} />
            <Route path="/acymailing/emails/create/template" element={<Authenticated><AcyChooseTemplate /></Authenticated>} />
            <Route path="/acymailing/emails/create/edit" element={<Authenticated><AcyEditEmail /></Authenticated>} />
            <Route path="/acymailing/emails/edit/:id" element={<Authenticated><AcyEditEmail /></Authenticated>} />
            <Route path="/acymailing/queue" element={<Authenticated><AcyQueue /></Authenticated>} />
            <Route path="/acymailing/configuration" element={<Authenticated><AcyConfiguration /></Authenticated>} />
            <Route path="/acymailing/segments" element={<Authenticated><AcySegments /></Authenticated>} />
            <Route path="/acymailing/automations" element={<Authenticated><AcyAutomations /></Authenticated>} />
            <Route path="/acymailing/bounces" element={<Authenticated><AcyBounces /></Authenticated>} />
            <Route path="/acymailing/forms" element={<Authenticated><AcyForms /></Authenticated>} />
        </CustomRoutes>
        <Resource name="comments" options={{ label: 'Kommentare' }} list={CommentList} edit={CommentEdit} />
        <Resource name="commentemailqueue" options={{ label: 'E-Mail-Warteschlange' }} list={CommentEmailQueueList} />
        <Resource name="news" options={{ label: 'Neuigkeiten / Blog' }} list={NewsList} edit={NewsEdit} create={NewsCreate} />
        <Resource name="downloadcategories" options={{ label: 'Download Kategorien' }} list={DownloadCategoryList} edit={DownloadCategoryEdit} create={DownloadCategoryCreate} />
        <Resource name="files" options={{ label: 'Downloads' }} list={DownloadFileList} edit={DownloadFileEdit} create={DownloadFileCreate} />
        <Resource name="weblinkcategories" options={{ label: 'Link Kategorien' }} list={WebLinkCategoryList} edit={WebLinkCategoryEdit} create={WebLinkCategoryCreate} />
        <Resource name="links" options={{ label: 'Links' }} list={WebLinkList} edit={WebLinkEdit} create={WebLinkCreate} />
        <Resource name="banners" options={{ label: 'Werbebanner' }} list={BannerGroupsOverview} />
        {/* NEW - standalone Galerie feature, separate resource/table from pagemedia above */}
        <Resource name="pagegallery" options={{ label: 'Galerie' }} list={GalleryList} edit={GalleryEdit} create={GalleryCreate} />
        <Resource name="serviceorders" options={{ label: 'Service Aufträge' }} list={ServiceOrderList} edit={ServiceOrderEdit} />
        <Resource name="legalPages" options={{ label: 'Rechtliche Seiten' }} list={LegalPageList} edit={LegalPageEdit} />
    </Admin>
    );
};
