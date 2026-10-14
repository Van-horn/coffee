'use client';

import { createTheme } from '@mui/material/styles';

// Contrast (WCAG 2.x), computed:
// ink #2B1B12 on cream #F5EEDF 14.33; primary #B8452E on cream 4.63;
// white on primary 5.35; ink on yolk #F2B632 9.08; muted #6B5A4E on cream 5.68.
const heading = 'var(--font-literata), Georgia, serif';
const body = 'var(--font-onest), system-ui, sans-serif';
const mono = 'var(--font-jetbrains), ui-monospace, monospace';

const theme = createTheme({
  palette: {
    mode: 'light',
    background: { default: '#F5EEDF', paper: '#FBF7EC' },
    text: { primary: '#2B1B12', secondary: '#6B5A4E' },
    primary: { main: '#B8452E', contrastText: '#FFFFFF' },
    secondary: { main: '#F2B632', contrastText: '#2B1B12' },
    divider: 'rgba(43, 27, 18, 0.2)',
  },
  shape: { borderRadius: 4 },
  typography: {
    fontFamily: body,
    h1: { fontFamily: heading, fontWeight: 700 },
    h2: { fontFamily: heading, fontWeight: 700 },
    h3: { fontFamily: heading, fontWeight: 600 },
    h4: { fontFamily: heading, fontWeight: 600 },
    h5: { fontFamily: heading, fontWeight: 600 },
    h6: { fontFamily: heading, fontWeight: 600 },
    button: { fontFamily: body, fontWeight: 600, textTransform: 'none' },
    overline: { fontFamily: mono, letterSpacing: '0.08em' },
    caption: { fontFamily: mono },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { minHeight: 44 } },
    },
    MuiLink: { defaultProps: { color: 'primary' } },
  },
});

export default theme;
