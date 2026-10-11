import { useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Box, Collapse, Typography } from '@mui/material';
import ExpandMore from '@mui/icons-material/ExpandMore';
import EventIcon from '@mui/icons-material/Event';
import DashboardIcon from '@mui/icons-material/Dashboard';
import BarChartIcon from '@mui/icons-material/BarChart';
import PeopleIcon from '@mui/icons-material/People';
import ListAltIcon from '@mui/icons-material/ListAlt';
import DescriptionIcon from '@mui/icons-material/Description';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import StorefrontIcon from '@mui/icons-material/Storefront';
import EmailIcon from '@mui/icons-material/Email';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import EventNoteIcon from '@mui/icons-material/EventNote';
import CategoryIcon from '@mui/icons-material/Category';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import PercentIcon from '@mui/icons-material/Percent';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchange';
import BadgeIcon from '@mui/icons-material/Badge';
import BookOnlineIcon from '@mui/icons-material/BookOnline';
import CommentIcon from '@mui/icons-material/Comment';
import ArticleIcon from '@mui/icons-material/Article';
import CookieIcon from '@mui/icons-material/Cookie';
import FolderIcon from '@mui/icons-material/Folder';
import DownloadIcon from '@mui/icons-material/Download';
import ViewCarouselIcon from '@mui/icons-material/ViewCarousel';
import AssignmentIcon from '@mui/icons-material/Assignment';
import DynamicFormIcon from '@mui/icons-material/DynamicForm';
import EditNoteIcon from '@mui/icons-material/EditNote';
import ViewListIcon from '@mui/icons-material/ViewList';
import TableChartIcon from '@mui/icons-material/TableChart';
import SettingsIcon from '@mui/icons-material/Settings';
import ExtensionIcon from '@mui/icons-material/Extension'; // NEW - "Komponenten" section icon
import WebIcon from '@mui/icons-material/Web'; // NEW - "Seiten" link icon
import MenuIcon from '@mui/icons-material/Menu'; // NEW - "Menü" link icon

// A fully custom sidebar (plain MUI + react-router NavLink, no react-admin
// <Menu>/<MenuItemLink>) - same approach already used successfully in the
// AcyMailing section. Light background with dark text - a dark sidebar kept
// having contrast problems that were hard to pin down, and dark-on-light
// can't have that problem by construction.
const SIDEBAR_ACCENT = '#0ea5e9';
const SIDEBAR_BG = '#ffffff';
const SIDEBAR_BORDER = '#e2e8f0';
const TEXT_COLOR = '#1e293b';
const ICON_COLOR = '#64748b';

interface Item {
    label: string;
    to: string;
    icon: ReactNode;
}

const TOP_ITEMS: Item[] = [
    { label: 'Benutzer', to: '/admin/users', icon: <PeopleIcon fontSize="small" /> },
];

const EVENT_ITEMS: Item[] = [
    { label: 'Dashboard', to: '/admin/events-dashboard', icon: <DashboardIcon fontSize="small" /> },
    { label: 'Statistiken', to: '/admin/event-statistics', icon: <BarChartIcon fontSize="small" /> },
    { label: 'Buchungs-Formular', to: '/admin/booking-form-config', icon: <ListAltIcon fontSize="small" /> },
    { label: 'Vorlagen', to: '/admin/templates', icon: <DescriptionIcon fontSize="small" /> },
    { label: 'Import', to: '/admin/import', icon: <UploadFileIcon fontSize="small" /> },
    { label: 'Veranstaltungen', to: '/admin/events', icon: <EventNoteIcon fontSize="small" /> },
    { label: 'Benutzerdefinierte Felder', to: '/admin/customFields', icon: <AssignmentIcon fontSize="small" /> },
    { label: 'Veranstaltungsorte', to: '/admin/locations', icon: <LocationOnIcon fontSize="small" /> },
    { label: 'Gutscheine', to: '/admin/vouchers', icon: <LocalOfferIcon fontSize="small" /> },
    { label: 'Gestaffelte Gebühren', to: '/admin/tieredFees', icon: <PercentIcon fontSize="small" /> },
    { label: 'Steuersätze', to: '/admin/taxRates', icon: <ReceiptLongIcon fontSize="small" /> },
    { label: 'Währungen', to: '/admin/currencies', icon: <CurrencyExchangeIcon fontSize="small" /> },
    { label: 'Veranstalter', to: '/admin/organizers', icon: <BadgeIcon fontSize="small" /> },
    { label: 'Kategorien', to: '/admin/categories', icon: <CategoryIcon fontSize="small" /> },
    { label: 'Buchungen', to: '/admin/bookings', icon: <BookOnlineIcon fontSize="small" /> },
    { label: 'Einstellungen', to: '/admin/settings-config', icon: <SettingsIcon fontSize="small" /> },
];

const BOTTOM_ITEMS: Item[] = [
    // "Neuigkeiten / Blog" (-> /admin/news) hidden from the sidebar on
    // request - route/data untouched, just not linked to from here anymore.
    { label: 'Download Kategorien', to: '/admin/downloadcategories', icon: <FolderIcon fontSize="small" /> },
    // "Link Kategorien" (-> /admin/weblinkcategories) hidden from the
    // sidebar on request - route/data untouched, just not linked to from
    // here anymore.
    // "Links" (-> /admin/links) hidden from the sidebar on request - route/
    // data untouched, just not linked to from here anymore.
    { label: 'Werbebanner', to: '/admin/banners', icon: <ViewCarouselIcon fontSize="small" /> },
    // "Seitenmedien (Sicherheitstraining)" (-> /admin/pagemedia) hidden from
    // the sidebar on request - route/data untouched, just not linked to
    // from here anymore.
    { label: 'Cookie-Hinweis', to: '/admin/cookie-consent', icon: <CookieIcon fontSize="small" /> },
];

// Old's real Visforms sidebar (Dashboard/Forms/Form Factory/Inspector/Form
// fields/Form data - the very first screenshot of this section) is itself a
// submenu under one parent item, not flat links - matched here with the
// same CollapsibleGroup already used for "Flugschule Events"/"Komponenten".
// Dashboard/Form Factory/Inspector have no equivalent built here (Form
// Factory/Inspector are themselves AEF-subscription features on the real
// site), so only the pages that actually exist are listed. Formularfelder/
// Formulardaten need a specific form, so they shortcut to the one real form
// this site has (service-auftrag) - same fallback every one of these routes
// already has when reached without a :formId param.
const FORM_ITEMS: Item[] = [
    { label: 'Formulare (Übersicht)', to: '/admin/formconfigs', icon: <ViewListIcon fontSize="small" /> },
    { label: 'Formular bearbeiten', to: '/admin/forms/service-auftrag/edit', icon: <EditNoteIcon fontSize="small" /> },
    { label: 'Formularfelder', to: '/admin/forms/service-auftrag/fields', icon: <DynamicFormIcon fontSize="small" /> },
    { label: 'Formulardaten', to: '/admin/forms/service-auftrag/data', icon: <TableChartIcon fontSize="small" /> },
];

// Old's real CComment sidebar (Comments/Email queues/Settings - view=
// comments/emailqueues/settings) is itself a submenu too, same pattern.
const COMMENT_ITEMS: Item[] = [
    { label: 'Kommentare', to: '/admin/comments', icon: <CommentIcon fontSize="small" /> },
    { label: 'E-Mail-Warteschlange', to: '/admin/commentemailqueue', icon: <EmailIcon fontSize="small" /> },
    { label: 'Einstellungen', to: '/admin/comment-settings', icon: <SettingsIcon fontSize="small" /> },
];

// A Joomla-"Components"-style group for site-wide content tools that aren't
// tied to Flugschule Events. "Menü" (Admin > Menü, MenuManager.tsx) manages
// the header's top-level nav items and their sub-items, right before
// Galerie. "Seiten" (the unified WordPress-Pages-style list at /admin/pages,
// Pages.tsx - every page, including the 6 fixed ones with their own
// data-only editors and any admin-created Unlayer pages) lives here too.
const COMPONENT_ITEMS: Item[] = [
    { label: 'Menü', to: '/admin/menu', icon: <MenuIcon fontSize="small" /> },
    { label: 'Galerie', to: '/admin/pagegallery', icon: <ViewCarouselIcon fontSize="small" /> },
    { label: 'Seiten', to: '/admin/pages', icon: <WebIcon fontSize="small" /> },
    { label: 'Flugschule Mailing', to: '/admin/acymailing/dashboard', icon: <EmailIcon fontSize="small" /> },
    { label: 'Downloads', to: '/admin/files', icon: <DownloadIcon fontSize="small" /> },
    { label: 'Rechtliche Seiten', to: '/admin/legalPages', icon: <ArticleIcon fontSize="small" /> },
    { label: 'Ecwid Settings', to: '/admin/ecwid-config', icon: <StorefrontIcon fontSize="small" /> },
];

// Inline `style` for color (not just `sx`) so nothing in the app's global
// CSS can ever compete with it, regardless of specificity or layer order.
const SidebarLink = ({ item, isActive, indent }: { item: Item; isActive: boolean; indent?: boolean }) => (
    <Box
        component={NavLink}
        to={item.to}
        style={{ color: isActive ? '#ffffff' : TEXT_COLOR }}
        sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1.5,
            textDecoration: 'none',
            px: 2,
            py: 1,
            ml: indent ? 1 : 0.5,
            mr: 0.5,
            mb: 0.25,
            borderRadius: '6px',
            bgcolor: isActive ? SIDEBAR_ACCENT : SIDEBAR_BG,
            '&:hover': {
                bgcolor: isActive ? SIDEBAR_ACCENT : '#f1f5f9'
            }
        }}
    >
        <Box sx={{ display: 'flex', mt: '2px' }} style={{ color: isActive ? '#ffffff' : ICON_COLOR }}>{item.icon}</Box>
        <Typography
            variant="body2"
            style={{ color: isActive ? '#ffffff' : TEXT_COLOR, fontWeight: isActive ? 700 : 500 }}
            sx={{ fontSize: '0.92rem', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.3 }}
        >
            {item.label}
        </Typography>
    </Box>
);

// Extracted from the inline "Flugschule Events" toggle block so the NEW
// "Komponenten" group below can reuse the same collapsible-header behavior
// instead of duplicating this JSX a second time.
const CollapsibleGroup = ({ label, icon, items, open, onToggle, isActivePath }: {
    label: string;
    icon: ReactNode;
    items: Item[];
    open: boolean;
    onToggle: () => void;
    isActivePath: (to: string) => boolean;
}) => (
    <>
        <Box
            onClick={onToggle}
            style={{ color: TEXT_COLOR }}
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 2,
                py: 1,
                mx: 0.5,
                mb: 0.25,
                borderRadius: '6px',
                cursor: 'pointer',
                '&:hover': { bgcolor: '#f1f5f9' }
            }}
        >
            <Box sx={{ display: 'flex' }} style={{ color: ICON_COLOR }}>{icon}</Box>
            <Typography
                variant="body2"
                style={{ color: TEXT_COLOR, fontWeight: 600 }}
                sx={{ flex: 1, fontSize: '0.92rem' }}
            >
                {label}
            </Typography>
            <ExpandMore sx={{ fontSize: 20, transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: '0.2s' }} style={{ color: ICON_COLOR }} />
        </Box>

        <Collapse in={open} timeout="auto" unmountOnExit sx={{ bgcolor: SIDEBAR_BG }}>
            <Box sx={{ bgcolor: SIDEBAR_BG }}>
                {items.map(item => (
                    <SidebarLink key={item.to} item={item} isActive={isActivePath(item.to)} indent />
                ))}
            </Box>
        </Collapse>
    </>
);

export const CustomMenu = () => {
    const location = useLocation();
    const [openEvents, setOpenEvents] = useState(true);
    const [openComponents, setOpenComponents] = useState(true); // NEW - "Komponenten" group, defaults open like Events
    const [openForms, setOpenForms] = useState(true); // "Formulare" group - see FORM_ITEMS
    const [openComments, setOpenComments] = useState(true); // "Kommentare" group - see COMMENT_ITEMS

    const isActivePath = (to: string) => {
        if (to === '/admin') return location.pathname === '/admin' || location.pathname === '/admin/';
        return location.pathname.startsWith(to);
    };

    return (
        <Box sx={{ py: 1, bgcolor: SIDEBAR_BG, height: '100%' }}>
            <Box sx={{ px: 3, py: 2.5, display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: `1px solid ${SIDEBAR_BORDER}`, mb: 1 }}>
                <FlightTakeoffIcon sx={{ color: SIDEBAR_ACCENT }} />
                <Typography style={{ color: TEXT_COLOR }} sx={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: 0.3 }}>
                    Hirondelle
                </Typography>
            </Box>

            {TOP_ITEMS.map(item => (
                <SidebarLink key={item.to} item={item} isActive={isActivePath(item.to)} />
            ))}

            <CollapsibleGroup
                label="Flugschule Events"
                icon={<EventIcon fontSize="small" />}
                items={EVENT_ITEMS}
                open={openEvents}
                onToggle={() => setOpenEvents(!openEvents)}
                isActivePath={isActivePath}
            />

            <Box sx={{ borderTop: `1px solid ${SIDEBAR_BORDER}`, my: 1, mx: 2 }} />

            {/* NEW - Joomla-"Components"-style group; see COMPONENT_ITEMS above */}
            <CollapsibleGroup
                label="Komponenten"
                icon={<ExtensionIcon fontSize="small" />}
                items={COMPONENT_ITEMS}
                open={openComponents}
                onToggle={() => setOpenComponents(!openComponents)}
                isActivePath={isActivePath}
            />

            <Box sx={{ borderTop: `1px solid ${SIDEBAR_BORDER}`, my: 1, mx: 2 }} />

            <CollapsibleGroup
                label="Formulare"
                icon={<DynamicFormIcon fontSize="small" />}
                items={FORM_ITEMS}
                open={openForms}
                onToggle={() => setOpenForms(!openForms)}
                isActivePath={isActivePath}
            />

            <Box sx={{ borderTop: `1px solid ${SIDEBAR_BORDER}`, my: 1, mx: 2 }} />

            <CollapsibleGroup
                label="Kommentare"
                icon={<CommentIcon fontSize="small" />}
                items={COMMENT_ITEMS}
                open={openComments}
                onToggle={() => setOpenComments(!openComments)}
                isActivePath={isActivePath}
            />

            <Box sx={{ borderTop: `1px solid ${SIDEBAR_BORDER}`, my: 1, mx: 2 }} />

            <Box sx={{ bgcolor: SIDEBAR_BG }}>
                {BOTTOM_ITEMS.map(item => (
                    <SidebarLink key={item.to} item={item} isActive={isActivePath(item.to)} />
                ))}
            </Box>
        </Box>
    );
};
