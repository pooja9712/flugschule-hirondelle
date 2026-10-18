import {
    List,
    Datagrid,
    TextField,
    DateField,
    Edit,
    TextInput,
    NumberInput,
    Create,
    SelectInput,
    DateTimeInput,
    ReferenceField,
    Filter,
    ReferenceInput,
    TabbedForm,
    FormTab,
    BooleanInput,
    FormDataConsumer,
    TopToolbar,
    Button as RaButton,
    useRecordContext,
    useNotify,
    useRedirect,
    useRefresh,
    useListContext,
    useUnselectAll,
    useGetList,
    BulkDeleteButton,
    SaveButton,
    TabbedFormTabs,
    Toolbar as RaToolbar
} from 'react-admin';
import { useState, useEffect } from 'react';
import { RichTextInput } from 'ra-input-rich-text';
import { Grid, Box, Typography, Chip, IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Tooltip } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CloseIcon from '@mui/icons-material/Close';
import { EventDatesManager } from './EventDatesManager';
import { EventRowExpand } from './EventRowExpand';
import { MCard, MTipsCard, MButtonGroupInput } from './matukioStyle';
import { TieredFeesList, TicketsList, AdditionalOptionsList } from './FeesLists';
import { EventFilesList } from './EventFilesList';
import { EventCustomFieldsSection } from './EventCustomFieldsSection';
import { ImageUploadInput } from './ImageUploadInput';
import { RichTextUploadToolbar } from './RichTextUploadToolbar';

const API = '/api';

const DuplicateEventButton = () => {
    const record = useRecordContext();
    const notify = useNotify();
    const redirect = useRedirect();
    const refresh = useRefresh();
    if (!record) return null;

    const handleDuplicate = async () => {
        const token = localStorage.getItem('auth');
        const res = await fetch(`${API}/events/${record.id}/duplicate`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const created = await res.json();
            notify('Veranstaltung dupliziert', { type: 'success' });
            refresh();
            redirect('edit', 'events', created.id);
        } else {
            notify('Fehler beim Duplizieren', { type: 'error' });
        }
    };

    return (
        <RaButton label="Duplizieren" onClick={handleDuplicate}>
            <ContentCopyIcon />
        </RaButton>
    );
};

// Opens the event's public detail page (Buchungskalender's /:eventId view)
// in a new tab. That page only lists published events, so the button is
// disabled for unpublished ones rather than opening an empty calendar. It
// shows the last saved state - unsaved form changes aren't in it yet.
const PreviewEventButton = () => {
    const record = useRecordContext();
    if (!record) return null;
    const button = (
        <RaButton
            label="Vorschau"
            disabled={!record.published}
            onClick={() => window.open(`/buchungskalender/${record.id}`, '_blank', 'noopener')}
        >
            <OpenInNewIcon />
        </RaButton>
    );
    return record.published ? button : (
        <Tooltip title="Nur veröffentlichte Veranstaltungen sind auf der Website sichtbar">
            {/* span: a disabled button fires no events for the tooltip */}
            <span>{button}</span>
        </Tooltip>
    );
};

const EventEditActions = () => (
    <TopToolbar>
        <PreviewEventButton />
        <DuplicateEventButton />
    </TopToolbar>
);

const CancelledField = (_props: { label?: string }) => {
    const record = useRecordContext();
    if (!record) return null;
    return record.cancelled ? <Chip label="Storniert" color="error" size="small" /> : null;
};

const PublishToggleField = (_props: { label?: string }) => {
    const record = useRecordContext();
    const refresh = useRefresh();
    const notify = useNotify();
    if (!record) return null;

    const handleClick = async (e: any) => {
        e.stopPropagation();
        const token = localStorage.getItem('auth');
        const res = await fetch(`${API}/events/${record.id}/toggle-publish`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            refresh();
        } else {
            notify('Fehler beim Aktualisieren', { type: 'error' });
        }
    };

    return (
        <IconButton size="small" onClick={handleClick} title={record.published ? 'Verstecken' : 'Veröffentlichen'}>
            {record.published ? <VisibilityIcon fontSize="small" color="success" /> : <VisibilityOffIcon fontSize="small" color="disabled" />}
        </IconButton>
    );
};

const EventBulkActionButtons = () => {
    const { selectedIds, resource } = useListContext();
    const notify = useNotify();
    const refresh = useRefresh();
    const unselectAll = useUnselectAll(resource);
    const [busy, setBusy] = useState(false);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };
    const handleClose = () => {
        setAnchorEl(null);
    };

    const setPublished = async (published: boolean) => {
        handleClose();
        setBusy(true);
        try {
            const token = localStorage.getItem('auth');
            const res = await fetch(`${API}/events/bulk-publish`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selectedIds, published })
            });
            if (res.ok) {
                notify(published ? 'Veröffentlicht' : 'Versteckt', { type: 'info' });
                unselectAll();
                refresh();
            } else {
                notify('Fehler beim Aktualisieren', { type: 'error' });
            }
        } finally {
            setBusy(false);
        }
    };

    const handleDuplicate = async () => {
        handleClose();
        setBusy(true);
        try {
            const token = localStorage.getItem('auth');
            await Promise.all(selectedIds.map(id =>
                fetch(`${API}/events/${id}/duplicate`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } })
            ));
            notify('Dupliziert', { type: 'success' });
            unselectAll();
            refresh();
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            {/* MUI Button always paints its own color prop (primary.main,
                a medium blue) regardless of the parent bar's
                color: 'primary.contrastText' - unlike the plain Typography/
                IconButton siblings here, it doesn't inherit that, so it was
                rendering as barely-visible blue-on-light-blue text. Forcing
                the same contrastText color makes it readable like the rest
                of the bar. */}
            <RaButton label="Aktionen" onClick={handleClick} disabled={busy} sx={{ color: 'primary.contrastText' }}>
                <ExpandMoreIcon />
            </RaButton>
            <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
                <MenuItem onClick={() => setPublished(true)} disabled={busy}>
                    <ListItemIcon><VisibilityIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Veröffentlichen</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => setPublished(false)} disabled={busy}>
                    <ListItemIcon><VisibilityOffIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Verstecken</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleDuplicate} disabled={busy}>
                    <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Duplizieren</ListItemText>
                </MenuItem>
            </Menu>
            <BulkDeleteButton label="Löschen" />
        </>
    );
};

// Event.taxRate/currency store the actual value (e.g. "19", "EUR") rather
// than a TaxRate/Currency row id, so a plain ReferenceInput (which always
// matches by id) can't be used directly - these build the same "pick from
// the manageable list" UX old Matukio has by fetching the published rows
// and mapping them onto SelectInput choices keyed by the value that's
// actually stored on the event.
const TaxRateSelect = () => {
    const { data } = useGetList('taxRates', { pagination: { page: 1, perPage: 100 }, filter: { published: true } });
    const choices = (data || []).map((r: any) => ({ id: String(r.value), name: `${r.title} (${r.value}%)` }));
    return <SelectInput source="taxRate" label="Steuersatz" choices={choices} fullWidth emptyText="Keiner" />;
};

const CurrencySelect = () => {
    const { data } = useGetList('currencies', { pagination: { page: 1, perPage: 100 }, filter: { published: true } });
    const choices = (data || []).map((r: any) => ({ id: r.paymentCode, name: `${r.description} (${r.symbol})` }));
    return <SelectInput source="currency" label="Währung" choices={choices} defaultValue="EUR" fullWidth />;
};

const EventFilter = (props: any) => (
    <Filter {...props}>
        <TextInput label="Suche" source="q" alwaysOn />
        <SelectInput
            label="Alle Veranstaltungen"
            source="published"
            choices={[
                { id: 'true', name: 'Veröffentlicht' },
                { id: 'false', name: 'Versteckt' }
            ]}
            alwaysOn
            emptyText="Alle"
        />
        <ReferenceInput label="Alle Veranstaltungsorte" source="locationId" reference="locations" alwaysOn>
            <SelectInput optionText="title" emptyText="Alle Veranstaltungsorte" />
        </ReferenceInput>
        <ReferenceInput label="Alle Veranstalter" source="organizerId" reference="organizers" alwaysOn>
            <SelectInput optionText="name" emptyText="Alle Veranstalter" />
        </ReferenceInput>
        <ReferenceInput label="Alle Kategorien" source="categoryId" reference="categories" alwaysOn>
            <SelectInput optionText="title" emptyText="Alle Kategorien" />
        </ReferenceInput>
        <SelectInput
            label="Storniert"
            source="cancelled"
            choices={[
                { id: 'true', name: 'Storniert' },
                { id: 'false', name: 'Nicht storniert' }
            ]}
            alwaysOn
            emptyText="Alle"
        />
    </Filter>
);

const EventListContent = () => {
    const { selectedIds, resource } = useListContext();
    const unselectAll = useUnselectAll(resource);

    return (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', width: '100%' }}>
            {selectedIds && selectedIds.length > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', p: 1, gap: 2, bgcolor: 'primary.light', color: 'primary.contrastText', borderRadius: 1, mb: 1 }}>
                    <IconButton size="small" onClick={() => unselectAll()} color="inherit">
                        <CloseIcon />
                    </IconButton>
                    <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>{selectedIds.length} Elemente ausgewählt</Typography>
                    <EventBulkActionButtons />
                </Box>
            )}
            <Datagrid
                rowClick="edit"
                // bulkActionButtons must stay truthy (any non-false value) -
                // that's what keeps hasBulkActions true so the selection
                // checkboxes render at all; without it, Datagrid falls back
                // to its own default (a plain BulkDeleteButton if the
                // resource is deletable, otherwise literally false), which
                // was silently hiding the checkboxes entirely just now.
                // bulkActionsToolbar={false} is the separate prop that
                // actually disables react-admin's own sliding toolbar -
                // both are needed together.
                bulkActionButtons={<></>}
                bulkActionsToolbar={false}
                expand={<EventRowExpand />}
            >
                <DateField source="startDate" label="Dates" showTime />
                <TextField source="title" label="Titel" />
                <ReferenceField source="categoryId" reference="categories" label="Kategorie">
                    <TextField source="title" />
                </ReferenceField>
                <ReferenceField source="locationId" reference="locations" label="Veranstaltungsort" emptyText="-">
                    <TextField source="title" />
                </ReferenceField>
                <PublishToggleField label="Veröffentlicht" />
                <CancelledField label="Status" />
                <TextField source="id" label="#" sx={{ display: 'inline-block', maxWidth: 80, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title="ID" />
            </Datagrid>
        </Box>
    );
};

export const EventList = () => (
    <List title="Veranstaltungen" filters={<EventFilter />}>
        <EventListContent />
    </List>
);

// ---------------------------------------------------------------------------
// Shared tab content - used identically by both EventEdit and EventCreate so
// the two forms can never drift out of sync with each other.
// ---------------------------------------------------------------------------

const ContentsTabContent = () => (
    <Grid container spacing={2} sx={{ width: '100%' }}>
        <Grid size={{ xs: 12, md: 8 }}>
            <MCard title="Allgemeine Informationen">
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <TextInput source="title" fullWidth label="Titel" required helperText="Titel für die Veranstaltung" />
                        <ReferenceInput source="categoryId" reference="categories">
                            <SelectInput optionText="title" label="Kategorie" fullWidth />
                        </ReferenceInput>
                        <TextInput source="tags" label="Schlagwörter" fullWidth helperText="Schlagwort eingeben oder auswählen" />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <TextInput source="alias" fullWidth label="Alias" helperText="Alias für SEO URLs. Leer lassen für eine automatische Generierung" />
                    </Grid>
                </Grid>
            </MCard>
            <MCard title="Beschreibungen & Bilder (Übersicht)">
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Wird auf Listen/Übersichtskarten gezeigt (z.B. im Kalender, in der Veranstaltungsliste).
                </Typography>
                <RichTextInput source="shortDescription" label="Kurzbeschreibung" toolbar={<RichTextUploadToolbar />} />
                <ImageUploadInput source="imageUrl" label="Bild für die Übersicht" />
            </MCard>
            <MCard title="Beschreibung & Bild (Detailseite)">
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Wird nur auf der vollständigen Detailseite der Veranstaltung gezeigt. Wenn leer, wird die Kurzbeschreibung oben verwendet.
                </Typography>
                <RichTextInput source="description" label="Ausführliche Beschreibung" toolbar={<RichTextUploadToolbar />} />
                <ImageUploadInput source="detailImageUrl" label="Bild für die Detailseite" />
            </MCard>
            <MCard title="Benutzerdefinierte Felder">
                <EventCustomFieldsSection />
            </MCard>
            <MCard title="Dateien">
                <EventFilesList />
            </MCard>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
            <MCard title="Veranstaltungs-Anzeige">
                {/* Old's real "Veranstaltungs-Anzeige" card (layouts/event/
                    edit/content.php:240-256, COM_MATUKIO_EVENT_DISPLAY) only
                    ever has top_event/hot_event here - allday/showbegin/
                    showend/showbooked are date-level fields in old
                    (layouts/event/edit/dates.php's date-edit form), not
                    event-level, so they belong in the Termine tab's inline
                    per-date edit panel (already there), not duplicated here. */}
                <BooleanInput source="isTopEvent" label="Top-Veranstaltung" />
                <BooleanInput source="isHotEvent" label="Hot-Event" />
            </MCard>
            <MCard title="Verschiedenes">
                <ReferenceInput source="organizerId" reference="organizers" label="Veranstalter">
                    <SelectInput optionText="name" fullWidth />
                </ReferenceInput>
                <TextInput source="leadSpeaker" label="Leitung" helperText="Optionaler Sprecher / Tutor" fullWidth />
                <TextInput source="targetGroup" label="Zielgruppe" helperText="Für welche Zielgruppe ist die Veranstaltung" fullWidth />
            </MCard>
            <MCard title="SEO">
                <TextInput source="metaDescription" label="Meta-Description" multiline fullWidth />
                <TextInput source="metaKeywords" label="Meta-Keywords" multiline fullWidth />
            </MCard>
        </Grid>
    </Grid>
);

const VenueTabContent = () => (
    <Grid container spacing={2} sx={{ width: '100%' }}>
        <Grid size={{ xs: 12, md: 8 }}>
            <MCard title="Location Typ">
                <MButtonGroupInput
                    source="locationType"
                    defaultValue="custom"
                    options={[
                        { value: 'predefined', label: 'Vordefinierte Location' },
                        { value: 'custom', label: 'Benutzerdefinierter Veranstaltungsort' },
                        { value: 'webinar', label: 'Webinar' }
                    ]}
                />
            </MCard>

            <FormDataConsumer>
                {({ formData }) => formData.locationType === 'predefined' && (
                    <MCard title="Vordefinierte Location">
                        <ReferenceInput source="locationId" reference="locations" label="Veranstaltungsort auswählen">
                            <SelectInput optionText="title" fullWidth />
                        </ReferenceInput>
                    </MCard>
                )}
            </FormDataConsumer>

            <FormDataConsumer>
                {({ formData }) => (!formData.locationType || formData.locationType === 'custom') && (
                    <MCard title="Benutzerdefinierter Veranstaltungsort">
                        <TextInput source="location" label="Benutzerdefinierter Veranstaltungsort" helperText="Titel der benutzerdefinierten Location" fullWidth />
                        <TextInput source="googleMapsAddress" label="Ortsangabe für Google Maps" helperText="Google Maps Adresse für die Location" fullWidth />
                    </MCard>
                )}
            </FormDataConsumer>

            <FormDataConsumer>
                {({ formData }) => formData.locationType === 'webinar' && (
                    <MCard title="Webinar">
                        <Typography variant="body2" color="text.secondary">
                            Diese Veranstaltung findet online als Webinar statt. Der Zugangslink kann in der Buchungsbestätigung mitgeteilt werden.
                        </Typography>
                    </MCard>
                )}
            </FormDataConsumer>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
            <MTipsCard
                title="Tipps für Locations"
                blocks={[
                    { heading: 'Vordefinierte Locations', body: 'Vordefinierte Locations geben den Besuchern die Möglichkeit, nach diesen im Frontend zu filtern, und bieten eine Detail-Seite mit Informationen.' }
                ]}
            />
        </Grid>
    </Grid>
);

// Old's real "Individuelles Buchungsformular" card (layouts/event/edit/
// booking.php's card-booking-override) - lets this one event override the
// site's default Buchungs-Formular with its own, or reuse an existing
// custom form already created for another event. Create/delete are instant
// API calls (not part of the event's own Speichern) - same as old's
// AJAX-driven bookingform.create/.delete tasks - followed by a full reload
// rather than react-admin's refresh(), since this field's own value needs
// to actually change in the still-open form, not just the cached record
// (the same reliability problem EventDatesManager's cross-record
// navigation hit earlier - a plain refresh() doesn't reliably restate
// already-mounted form fields).
const CustomBookingFormCard = () => {
    const notify = useNotify();
    const [forms, setForms] = useState<{ id: string; name: string | null }[]>([]);

    useEffect(() => {
        const token = localStorage.getItem('auth');
        fetch(`${API}/bookingFormConfig/list`, { headers: { Authorization: `Bearer ${token}` } })
            .then((res) => (res.ok ? res.json() : []))
            .then(setForms)
            .catch(() => {});
    }, []);

    return (
        <FormDataConsumer>
            {({ formData }) => {
                const eventId = formData?.id;
                const currentId: string = formData?.customBookingFormId || '';

                const handleCreate = async () => {
                    if (!eventId) { notify('Bitte die Veranstaltung zuerst speichern', { type: 'warning' }); return; }
                    const token = localStorage.getItem('auth');
                    const res = await fetch(`${API}/events/${eventId}/custom-booking-form`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    if (res.ok) {
                        window.location.reload();
                    } else {
                        notify('Fehler beim Erstellen', { type: 'error' });
                    }
                };

                const handleDelete = async () => {
                    if (!eventId) return;
                    if (!window.confirm('Individuelles Buchungsformular wirklich löschen? Das Standard-Buchungsformular wird dann wieder verwendet.')) return;
                    const token = localStorage.getItem('auth');
                    const res = await fetch(`${API}/events/${eventId}/custom-booking-form`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    if (res.ok) {
                        window.location.reload();
                    } else {
                        notify('Fehler beim Löschen', { type: 'error' });
                    }
                };

                return (
                    <MCard title="Individuelles Buchungs-Formular">
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                            Hier kann das Standard-Buchungsformular überschrieben oder ein bestehendes
                            benutzerdefiniertes Buchungsformular ausgewählt werden. Auf diese Weise können
                            zusätzliche Felder hinzugefügt werden oder sogar das gesamte Formular geändert werden.{' '}
                            <a href="/admin/booking-form-config" target="_blank" rel="noreferrer">
                                Standard-Buchungsformular bearbeiten
                            </a>
                        </Typography>

                        <SelectInput
                            source="customBookingFormId"
                            label="Formular"
                            fullWidth
                            choices={[
                                { id: '', name: 'Kein benutzerdefiniertes Buchungsformular' },
                                ...forms.map((f) => ({ id: f.id, name: f.name || f.id })),
                            ]}
                        />

                        {!currentId && (
                            <RaButton label="Individuelles Buchungs-Formular erstellen" onClick={handleCreate} variant="contained" fullWidth />
                        )}
                        {currentId && (
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <RaButton
                                    label="Verwalten"
                                    onClick={() => window.open(`/admin/booking-form-config/${currentId}`, '_blank')}
                                    variant="contained"
                                />
                                <RaButton label="Löschen" onClick={handleDelete} color="error" />
                            </Box>
                        )}
                    </MCard>
                );
            }}
        </FormDataConsumer>
    );
};

const BookingTabContent = () => (
    <Grid container spacing={2} sx={{ width: '100%' }}>
        <Grid size={{ xs: 12, md: 8 }}>
            <MCard title="Buchungs-Typ">
                <MButtonGroupInput
                    source="bookingType"
                    defaultValue="limited"
                    options={[
                        { value: 'limited', label: 'Limitierte Teilnehmeranzahl' },
                        { value: 'unlimited', label: 'Unlimitierte Teilnehmeranzahl' },
                        { value: 'none', label: 'Keine Online-Buchung' }
                    ]}
                />
            </MCard>

            {/* Old's real "Teilnehmer" card (Max. Teiln./Min. Teilnehmerzahl)
                stays visible no matter which Buchungs-Typ is selected - its
                own "Keine Online-Buchung" tooltip (below) says so explicitly:
                "...und trotzdem können die Mindest- und Maximal-
                Teilnehmerzahl angezeigt werden". Only "bei Überschreitung"
                (stop vs. waitlist) is specific to the "limited" online-
                booking-enforcement flow, so that one stays conditional. */}
            <FormDataConsumer>
                {({ formData }) => (
                    <MCard title="Teilnehmer">
                        <NumberInput source="maxParticipants" label="Max. Teiln." fullWidth />
                        {formData.bookingType === 'limited' && (
                            <SelectInput source="onExceed" label="bei Überschreitung" choices={[
                                { id: 'waitlist', name: 'Warteliste' },
                                { id: 'stop', name: 'Buchung stoppen' }
                            ]} defaultValue="waitlist" fullWidth />
                        )}
                        <NumberInput source="minParticipants" label="Min. Teilnehmerzahl" fullWidth defaultValue={0} />
                        {formData.bookingType !== 'none' && (
                            <NumberInput source="maxBookablePerPerson" label="Max. buchbare Plätze pro Person" fullWidth defaultValue={2} />
                        )}
                    </MCard>
                )}
            </FormDataConsumer>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
            <CustomBookingFormCard />
            <MTipsCard
                title="Tipps für die Buchung"
                blocks={[
                    { heading: 'Buchung auf der Warteliste', body: 'Wenn die Veranstaltung die Maximal-Teilnehmerzahl erreicht, kann die Buchung gestoppt werden oder die Buchungen landen auf der Warteliste.' },
                    { heading: 'Keine Online-Buchung', body: 'Die Online-Buchung kann auch komplett für das Frontend deaktiviert werden, und trotzdem können die Mindest- und Maximal-Teilnehmerzahl angezeigt werden.' }
                ]}
            />
        </Grid>
    </Grid>
);

const FeesTabContent = () => (
    <Grid container spacing={2} sx={{ width: '100%' }}>
        <Grid size={{ xs: 12, md: 8 }}>
            <MCard title="Veranstaltungs-Typ">
                <MButtonGroupInput
                    source="eventType"
                    defaultValue="paid"
                    options={[
                        { value: 'paid', label: 'Kostenpflichtige Veranstaltung' },
                        { value: 'free', label: 'Kostenlose Veranstaltung' }
                    ]}
                />
            </MCard>

            <FormDataConsumer>
                {({ formData }) => formData.eventType !== 'free' && (
                    <MCard title="Gebühren">
                        <NumberInput source="feePerPerson" label="Gebühren Pro Person (€)" fullWidth />
                        <SelectInput source="bookableFor" label="Buchbar für" choices={[
                            { id: 'public', name: 'Öffentlich' },
                            { id: 'registered', name: 'Registriert' }
                        ]} defaultValue="public" fullWidth />
                    </MCard>
                )}
            </FormDataConsumer>

            <FormDataConsumer>
                {({ formData }) => formData.tieredFees && (
                    <MCard title="Gestaffelte Gebühren">
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Hier können Sie die standardmäßigen gestaffelten Gebühren (falls vorhanden) für DIESE Veranstaltung überschreiben. Damit können Sie Frühbucherrabatte oder ähnliche Angebote erstellen.
                        </Typography>
                        <TieredFeesList />
                    </MCard>
                )}
            </FormDataConsumer>

            <MCard title="Ticket-Typen">
                <TicketsList />
            </MCard>

            <MCard title="Zusätzliche buchbare Optionen">
                <AdditionalOptionsList />
            </MCard>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
            <MCard title="Einstellungen der Gebühren">
                <TaxRateSelect />
                <CurrencySelect />
                <BooleanInput source="paymentProcessing" label="Zahlungsverarbeitung" defaultValue={true} />
                <BooleanInput source="tieredFees" label="Gestaffelte Gebühren" defaultValue={false} />
            </MCard>
            <MTipsCard
                title="Tipps für Gebühren"
                blocks={[
                    { heading: 'Inklusive MwSt.', body: 'Alle Gebühren enthalten standardmäßig die Mehrwertsteuer; die Anzeige kann in den Einstellungen so geändert werden, dass nur Nettopreise angezeigt werden.' },
                    { heading: 'Zahlungsverarbeitung', body: 'Wenn die Zahlungsverarbeitung deaktiviert ist, werden die Gebühren weiterhin angezeigt und die Veranstaltung kann weiterhin gebucht werden. Nur die Zahlungsabwicklung nach der Buchung entfällt (z. B. Weiterleitung zum Zahlungsanbieter).' },
                    { heading: 'Gestaffelte Gebühren', body: 'Gestaffelte Gebühren beziehen sich immer auf die Standardgebühr (entweder als Prozentsatz oder als absoluter Betrag). Wird der Standardpreis angepasst, ändern sich daher auch alle gestaffelten Gebühren.' }
                ]}
            />
        </Grid>
    </Grid>
);

const AdjustmentsTabContent = () => (
    <Grid container spacing={2} sx={{ width: '100%' }}>
        <Grid size={{ xs: 12, md: 8 }}>
            <MCard title="Benutzerdefinierte Buchungs-Email">
                <RichTextInput source="customBookingEmail" label="Benutzerdefinierte Buchungsbestätigung (E-Mail)" toolbar={<RichTextUploadToolbar />} />
            </MCard>
            <MCard title="Benutzerdefiniertes Zertifikat">
                <RichTextInput source="customCertificate" label="Zertifikat Inhalt" toolbar={<RichTextUploadToolbar />} />
            </MCard>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
            <MTipsCard
                title="Tipps"
                blocks={[
                    { heading: 'Benutzerdefinierte Buchungs-Email und Zertifikat', body: 'In dieser Sektion können die Standard-Buchungs-Email und das Zertifikat für diese Veranstaltung überschrieben werden. Wie immer können alle Platzhalter verwendet werden. Das Buchungsformular kann im Buchungs-Tab angepasst werden.' }
                ]}
            />
        </Grid>
    </Grid>
);

const TermineTabContent = ({ isCreate }: { isCreate?: boolean }) => (
    <Grid container spacing={2} sx={{ width: '100%' }}>
        <Grid size={{ xs: 12, md: 8 }}>
            <MCard title="Termin">
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <DateTimeInput source="startDate" label="Beginn" required fullWidth />
                    <DateTimeInput source="endDate" label="Ende" fullWidth />
                    <DateTimeInput source="registrationDeadline" label="Anmeldeschluss" fullWidth />
                </Box>
                <Grid container spacing={2} sx={{ mt: 1 }}>
                    <Grid size={{ xs: 6 }}>
                        <TextInput source="bookingNumber" label="Nummer" helperText="Veranstaltungs-Nummer, z.B. 5/26 (Optional)" fullWidth />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                        <TextInput source="titleOverride" label="Titel Überschreibung" helperText="Hier können Sie den Titel für diesen Termin überschreiben" fullWidth />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                        <TextInput source="eventNumber" label="Interne Referenz-ID" helperText="Nur intern für die Serien-Zuordnung genutzt, nicht auf der Webseite sichtbar" fullWidth disabled />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                        <NumberInput source="views" label="Seitenaufrufe" fullWidth disabled />
                    </Grid>
                </Grid>
            </MCard>

            {!isCreate && (
                <MCard title="Weitere Termine dieser Serie">
                    <EventDatesManager />
                </MCard>
            )}
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
            <MCard title="Kalender-Farben">
                <TextInput source="calendarBgColor" label="Kalender Hintergrund-Farbe (Hex)" type="color" defaultValue="#3a87ac" fullWidth />
                <TextInput source="calendarTextColor" label="Kalender Schrift-Farbe (Hex)" type="color" defaultValue="#ffffff" fullWidth />
            </MCard>
            {!isCreate && (
                <FormDataConsumer>
                    {({ formData }) => formData.cancelled && (
                        <Chip label="Diese Veranstaltung ist storniert" color="error" sx={{ mb: 2 }} />
                    )}
                </FormDataConsumer>
            )}
        </Grid>
    </Grid>
);

// Old Matukio's toolbar (views/event/view.html.php) has a distinct "Save &
// New" button that saves the current event and jumps straight into a
// fresh, blank create form - useful for entering several events back to
// back. react-admin's default Create toolbar only has one Save action
// (redirects to the edit view of what was just created).
const CreateToolbar = () => {
    const notify = useNotify();
    const redirect = useRedirect();
    return (
        <RaToolbar>
            <SaveButton label="Speichern" />
            <SaveButton
                label="Speichern & Neu"
                type="button"
                variant="outlined"
                mutationOptions={{
                    onSuccess: () => {
                        notify('Veranstaltung erstellt', { type: 'success' });
                        redirect('create', 'events');
                        window.location.reload();
                    }
                }}
            />
        </RaToolbar>
    );
};

// A second "Speichern" at the top, next to the tabs - the edit form is long
// enough that scrolling to the bottom toolbar for every save was tedious.
// It has to live inside the form (a SaveButton needs the form context), so
// it's rendered through TabbedForm's `tabs` slot rather than the page's
// TopToolbar actions; TabbedForm passes its tab props (value, onChange, url,
// the tabs themselves...) to this element, which hands them on unchanged.
const TabsWithSaveButton = (props: any) => (
    <Box sx={{ display: 'flex', alignItems: 'center', pr: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
            <TabbedFormTabs {...props} />
        </Box>
        <SaveButton label="Speichern" size="small" />
    </Box>
);

// pessimistic: actually send the save right away and wait for the server.
// react-admin's default ("undoable") jumps to the list instantly and only
// sends the update ~5s later - leaving/refreshing in that window, or the
// "Rückgängig" in the toast, silently dropped the change (e.g. a toggled
// "Startzeit anzeigen" that never got saved). redirect={false}: stay on the
// event after saving instead of being thrown back to the list.
export const EventEdit = () => (
    <Edit title="Veranstaltung bearbeiten" actions={<EventEditActions />} mutationMode="pessimistic" redirect={false}>
        <TabbedForm tabs={<TabsWithSaveButton />}>
            <FormTab label="Inhalte"><ContentsTabContent /></FormTab>
            <FormTab label="Veranstaltungsort"><VenueTabContent /></FormTab>
            <FormTab label="Buchung"><BookingTabContent /></FormTab>
            <FormTab label="Gebühren"><FeesTabContent /></FormTab>
            <FormTab label="Anpassungen"><AdjustmentsTabContent /></FormTab>
            <FormTab label="Termine"><TermineTabContent /></FormTab>
        </TabbedForm>
    </Edit>
);

export const EventCreate = () => (
    <Create title="Veranstaltung erstellen">
        <TabbedForm toolbar={<CreateToolbar />}>
            <FormTab label="Inhalte"><ContentsTabContent /></FormTab>
            <FormTab label="Veranstaltungsort"><VenueTabContent /></FormTab>
            <FormTab label="Buchung"><BookingTabContent /></FormTab>
            <FormTab label="Gebühren"><FeesTabContent /></FormTab>
            <FormTab label="Anpassungen"><AdjustmentsTabContent /></FormTab>
            <FormTab label="Termine"><TermineTabContent isCreate /></FormTab>
        </TabbedForm>
    </Create>
);
