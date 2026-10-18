import { useParams } from 'react-router-dom';
import {
    Form,
    TextInput,
    BooleanInput,
    ArrayInput,
    SimpleFormIterator,
    ResourceContextProvider,
    useGetOne,
    useUpdate,
    useNotify,
    useRefresh,
} from 'react-admin';
import { Typography, Card, CardContent, CircularProgress, Alert, Box, Button } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';

// Uses the same plain <Form record={...} onSubmit={...}> pattern already
// proven working in TemplatesBuilder.tsx, not <Edit><SimpleForm>: nesting
// SimpleForm's onSubmit override inside <Edit record={...}> (the original
// version of this component) never actually fired a save request at all -
// <Edit> normally drives its own record-fetching/submission via an
// EditController and doesn't cleanly support a raw record prop override,
// so the "Speichern" button silently did nothing. That bug, not just a
// missing downstream integration, is why this admin page's changes never
// affected anything: it was never possible to actually save a change here.
export const BookingFormBuilder = () => {
    // Old's real "Individuelles Buchungsformular" (layouts/event/edit/
    // booking.php) reuses this exact same builder for a per-event custom
    // form, just pointed at that form's own id instead of "default" - same
    // thing here via an optional :id route param (see Events.tsx's
    // Buchungs-Formular card and AdminApp.tsx's two routes to this page).
    const { id: routeId } = useParams<{ id?: string }>();
    const id = routeId || 'default';
    const isCustom = id !== 'default';
    const { data, isLoading, error } = useGetOne('bookingFormConfig', { id });
    const notify = useNotify();
    const refresh = useRefresh();
    const [update, { isLoading: isSaving }] = useUpdate();

    if (isLoading) return <CircularProgress sx={{ m: 4 }} />;
    if (error) return <div>Error loading configuration</div>;

    const save = (formData: any) => {
        update(
            'bookingFormConfig',
            { id, data: formData, previousData: data },
            {
                onSuccess: () => {
                    notify('Buchungs-Formular gespeichert', { type: 'success' });
                    refresh();
                },
                onError: (error: any) => {
                    notify(`Fehler beim Speichern: ${error.message}`, { type: 'error' });
                }
            }
        );
    };

    return (
        <Card sx={{ mt: 2, mb: 4, maxWidth: '1000px', mx: 'auto' }}>
            <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Typography variant="h5" gutterBottom>
                        {isCustom ? (data?.name || 'Individuelles Buchungs-Formular') : 'Buchungs-Formular (Standard Booking Form)'}
                    </Typography>
                </Box>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    Hier können Sie Beschriftung, Pflichtfeld-Status und Reihenfolge der Standard-Anmeldefelder
                    ändern - diese Änderungen wirken sich direkt auf das echte Buchungsformular aus, das Kunden sehen.
                </Typography>
                <Alert severity="warning" sx={{ mb: 3 }}>
                    Ein Feld hier zu <strong>entfernen</strong> bedeutet, dass diese Angabe von Kunden nicht mehr
                    abgefragt wird. Ein neues, unbekanntes Feld hinzuzufügen hat <strong>keine Wirkung</strong> - für
                    zusätzliche, komplett neue Felder nutzen Sie bitte "Benutzerdefinierte Felder". Die Feld-ID
                    (z.B. "phone", "email") sollte nicht verändert werden, da sie festlegt, welche echte Angabe
                    gemeint ist. Ticket-Auswahl und Zahlungsmethode werden bereits an anderer Stelle verwaltet
                    (Gestaffelte Gebühren / Zusätzliche buchbare Optionen) und sind hier nicht enthalten.
                </Alert>

                <ResourceContextProvider value="bookingFormConfig">
                    <Form record={data} onSubmit={save}>
                        <ArrayInput source="steps" label="Formular-Schritte (Steps)">
                            <SimpleFormIterator getItemLabel={(index) => `Schritt ${index + 1}`}>
                                <TextInput source="id" label="Schritt ID (z.B. step-1)" required />
                                <TextInput source="title" label="Schritt Titel" required fullWidth />

                                <ArrayInput source="fields" label="Felder in diesem Schritt (Reihenfolge = Anzeigereihenfolge)">
                                    <SimpleFormIterator getItemLabel={(index) => `Feld ${index + 1}`}>
                                        <TextInput source="id" label="Feld ID" helperText="z.B. salutation, fullName, birthDate, sizeWeight, phone, email, street, zip, city" required />
                                        <TextInput source="label" label="Feld Label (Anzeigename)" required />
                                        <BooleanInput source="required" label="Pflichtfeld?" defaultValue={true} />
                                    </SimpleFormIterator>
                                </ArrayInput>
                            </SimpleFormIterator>
                        </ArrayInput>

                        <Box sx={{ mt: 3 }}>
                            <Button type="submit" variant="contained" color="success" startIcon={<SaveIcon />} disabled={isSaving}>
                                Speichern
                            </Button>
                        </Box>
                    </Form>
                </ResourceContextProvider>
            </CardContent>
        </Card>
    );
};
