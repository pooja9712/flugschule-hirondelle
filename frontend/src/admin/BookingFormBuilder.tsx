import { useParams } from 'react-router-dom';
import {
    Edit,
    SimpleForm,
    TextInput,
    BooleanInput,
    ArrayInput,
    SimpleFormIterator,
    useGetOne,
    useNotify,
    Toolbar as RaToolbar,
    SaveButton,
} from 'react-admin';

// No DeleteButton on this toolbar: deleting a custom form's row directly
// here would leave the event that references it (Event.customBookingFormId)
// pointing at nothing - deleting one is done through the "Löschen" button
// on the event's own Buchung tab (Events.tsx's CustomBookingFormCard),
// which unlinks the event first.
const BookingFormToolbar = () => (
    <RaToolbar>
        <SaveButton />
    </RaToolbar>
);
import { Typography, Card, CardContent, Alert, Box } from '@mui/material';

// Switched from a bare <Form record={data}> (TemplatesBuilder.tsx's pattern,
// which only ever edits plain scalar TextInputs) to a real <Edit>/<SimpleForm>
// (the pattern already proven working for ArrayInput/SimpleFormIterator
// elsewhere - Gallery.tsx's earlier version). <Form> alone never rendered
// the ArrayInput's rows at all - no error, no console warning, it just
// silently produced nothing below the title, which <Edit>/<SimpleForm>'s
// full react-hook-form + FormGroupsProvider setup doesn't have a problem
// with. <Edit> drives its own getOne/update against resource="bookingFormConfig"
// id={id} - the same generic GET/PUT /:id this page always called - so no
// backend change was needed, only this component's own wiring.
export const BookingFormBuilder = () => {
    // Old's real "Individuelles Buchungsformular" (layouts/event/edit/
    // booking.php) reuses this exact same builder for a per-event custom
    // form, just pointed at that form's own id instead of "default" - same
    // thing here via an optional :id route param (see Events.tsx's
    // Buchungs-Formular card and AdminApp.tsx's two routes to this page).
    const { id: routeId } = useParams<{ id?: string }>();
    const id = routeId || 'default';
    const isCustom = id !== 'default';
    const notify = useNotify();
    // Only used for the title text above - the actual field-editing/saving
    // below is driven by <Edit>'s own independent fetch, not this one.
    const { data: titleData } = useGetOne('bookingFormConfig', { id });

    return (
        <Card sx={{ mt: 2, mb: 4, maxWidth: '1000px', mx: 'auto' }}>
            <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Typography variant="h5" gutterBottom>
                        {isCustom ? (titleData?.name || 'Individuelles Buchungs-Formular') : 'Buchungs-Formular (Standard Booking Form)'}
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

                <Edit
                    resource="bookingFormConfig"
                    id={id}
                    redirect={false}
                    mutationMode="pessimistic"
                    actions={false}
                    sx={{ '& .RaEdit-card': { boxShadow: 'none', mt: 0 } }}
                    mutationOptions={{
                        onSuccess: () => notify('Buchungs-Formular gespeichert', { type: 'success' }),
                        onError: (error: any) => notify(`Fehler beim Speichern: ${error.message}`, { type: 'error' }),
                    }}
                >
                    <SimpleForm toolbar={<BookingFormToolbar />}>
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
                    </SimpleForm>
                </Edit>
            </CardContent>
        </Card>
    );
};
