import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

// PAGE ARTICLE MODE - every "Felder-Editor (alt)" link (PageArticleEditor.tsx,
// Pages.tsx) passes the page's Joomla-style editor URL as router state
// `backToArticle`, so the old field editor shows a way back to the new one.
export const BackToArticleEditor = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const backTo = (location.state as { backToArticle?: string } | null)?.backToArticle;
  if (!backTo) return null;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', px: 2, py: 1, mt: 1, bgcolor: '#eef4fb', border: '1px solid #cfe0f3', borderRadius: 1 }}>
      <Button variant="contained" size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate(backTo)}>
        Zurück zum neuen Editor
      </Button>
      <Typography variant="body2" sx={{ color: '#555' }}>
        Sie bearbeiten die Seite im alten Felder-Editor.
      </Typography>
    </Box>
  );
};
