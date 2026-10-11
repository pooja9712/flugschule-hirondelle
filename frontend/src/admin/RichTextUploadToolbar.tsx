import { useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import { useNotify } from 'react-admin';
import {
    RichTextInputToolbar,
    LevelSelect,
    FormatButtons,
    ColorButtons,
    AlignmentButtons,
    ListButtons,
    LinkButtons,
    QuoteButtons,
    ClearButtons,
    useTiptapEditor,
} from 'ra-input-rich-text';
import { ToggleButton, CircularProgress } from '@mui/material';
import ImageIcon from '@mui/icons-material/Image';
// type-only: brings in the editor's setImage() command typing
import type {} from '@tiptap/extension-image';

// ra-input-rich-text's own image button only asks for an image URL
// (window.prompt). This one opens a file picker instead and uploads the
// picked image through the app's existing /api/upload endpoint (same as
// ImageUploadInput.tsx), then inserts the returned URL into the editor.
const ImageUploadButton = ({ size }: { size?: 'small' | 'medium' | 'large' }) => {
    const editor = useTiptapEditor();
    const notify = useNotify();
    const fileInput = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        // reset so picking the same file again still fires onChange
        event.target.value = '';
        if (!file || !editor) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                headers: { Authorization: `Bearer ${localStorage.getItem('auth')}` },
                body: formData,
            });
            const data = await res.json();
            if (res.ok && data.url) {
                editor.chain().focus().setImage({ src: data.url, alt: file.name }).run();
            } else {
                notify(data.message || 'Fehler beim Upload', { type: 'warning' });
            }
        } catch {
            notify('Netzwerkfehler beim Upload', { type: 'warning' });
        } finally {
            setUploading(false);
        }
    };

    return (
        <>
            <ToggleButton
                size={size}
                value="image"
                aria-label="Bild hochladen"
                title="Bild hochladen"
                disabled={!editor || !editor.isEditable || uploading}
                onClick={() => fileInput.current?.click()}
            >
                {uploading ? <CircularProgress size={16} /> : <ImageIcon fontSize="inherit" />}
            </ToggleButton>
            <input ref={fileInput} type="file" accept="image/*" hidden onChange={handleFile} />
        </>
    );
};

// Same buttons as ra-input-rich-text's default toolbar, with the URL-prompt
// image button swapped for the upload one. Pass as `toolbar` to RichTextInput.
export const RichTextUploadToolbar = (props: ComponentProps<typeof RichTextInputToolbar>) => {
    const { size = 'medium', ...rest } = props;
    return (
        <RichTextInputToolbar size={size} {...rest}>
            <LevelSelect size={size} />
            <FormatButtons size={size} />
            <ColorButtons size={size} />
            <AlignmentButtons size={size} />
            <ListButtons size={size} />
            <LinkButtons size={size} />
            <ImageUploadButton size={size} />
            <QuoteButtons size={size} />
            <ClearButtons size={size} />
        </RichTextInputToolbar>
    );
};
