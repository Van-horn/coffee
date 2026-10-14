'use client';

import { createTheme } from '@mui/material/styles';
import type { CSSProperties } from 'react';
import { colors, radius, tokens } from './tokens';

export { tokens };

// Contrast (WCAG 2.x), computed from the Pixso hexes:
// ink/paper 14.43, ink-soft/paper 6.71, roast/paper 4.30 (FAILS small text, use roast-deep),
// roast/paper-2 3.86 (FAILS), roast/card 4.73, roast-deep/paper 6.41, roast-deep/paper-2 5.75,
// roast-deep/card 7.05, white/roast 5.09, ink/yolk 9.16, yolk/ink 9.16, paper/ink 14.43,
// leaf/card 5.84, error/card 6.07.

declare module '@mui/material/styles' {
  interface TypographyVariants {
    hero: CSSProperties;
    bodyL: CSSProperties;
    bodyM: CSSProperties;
    bodyS: CSSProperties;
    eyebrow: CSSProperties;
    price: CSSProperties;
    priceXL: CSSProperties;
  }
  interface TypographyVariantsOptions {
    hero?: CSSProperties;
    bodyL?: CSSProperties;
    bodyM?: CSSProperties;
    bodyS?: CSSProperties;
    eyebrow?: CSSProperties;
    price?: CSSProperties;
    priceXL?: CSSProperties;
  }
  interface Theme {
    tokens: typeof tokens;
  }
  interface ThemeOptions {
    tokens?: typeof tokens;
  }
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    hero: true;
    bodyL: true;
    bodyM: true;
    bodyS: true;
    eyebrow: true;
    price: true;
    priceXL: true;
  }
}

const font = 'var(--font-roboto), system-ui, -apple-system, "Segoe UI", sans-serif';

// Mobile <640, tablet 640-1023, desktop >=1024.
const base = createTheme({
  breakpoints: { values: { xs: 0, sm: 640, md: 1024, lg: 1200, xl: 1536 } },
});

const responsive = (
  mobile: [number, number],
  tablet: [number, number],
  desktop: [number, number],
  // Optional larger size reached at a 2560 px screen: the desktop size holds up to 1440 and grows linearly from there.
  cap?: [number, number],
) => {
  const fluid = (from: number, to: number) =>
    `clamp(${from}px, calc(${from}px + (100vw - 1440px) * ${((to - from) / 1120).toFixed(5)}), ${to}px)`;
  return {
    fontSize: mobile[0],
    lineHeight: `${mobile[1]}px`,
    [base.breakpoints.up('sm')]: { fontSize: tablet[0], lineHeight: `${tablet[1]}px` },
    [base.breakpoints.up('md')]: cap
      ? { fontSize: fluid(desktop[0], cap[0]), lineHeight: fluid(desktop[1], cap[1]) }
      : { fontSize: desktop[0], lineHeight: `${desktop[1]}px` },
  };
};

const theme = createTheme({
  breakpoints: base.breakpoints,
  tokens,
  palette: {
    mode: 'light',
    background: { default: colors.paper, paper: colors.card },
    text: { primary: colors.ink, secondary: colors.inkSoft },
    primary: { main: colors.roastDeep, dark: colors.roastDeep, contrastText: colors.white },
    secondary: { main: colors.yolk, contrastText: colors.ink },
    error: { main: colors.error },
    success: { main: colors.leaf },
    divider: colors.line,
  },
  shape: { borderRadius: radius.md },
  typography: {
    fontFamily: font,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    hero: {
      fontWeight: 400,
      letterSpacing: '-0.005em',
      ...responsive([36, 44], [48, 56], [56, 64], [80, 90]),
    },
    h1: { fontWeight: 400, letterSpacing: '-0.005em', ...responsive([36, 44], [48, 56], [56, 64], [80, 90]) },
    h2: { fontWeight: 500, ...responsive([28, 36], [34, 42], [40, 48], [56, 66]) },
    h3: { fontWeight: 500, fontSize: 22, lineHeight: '28px', [base.breakpoints.up('sm')]: { fontSize: 24, lineHeight: '32px' } },
    bodyL: { fontWeight: 400, fontSize: 18, lineHeight: '29px' },
    bodyM: { fontWeight: 400, fontSize: 16, lineHeight: '26px' },
    bodyS: { fontWeight: 400, fontSize: 14, lineHeight: '22px' },
    body1: { fontSize: 16, lineHeight: '26px' },
    body2: { fontSize: 14, lineHeight: '22px' },
    eyebrow: { fontWeight: 500, fontSize: 12, lineHeight: '16px', textTransform: 'lowercase' },
    price: { fontWeight: 400, fontSize: 28, lineHeight: '36px' },
    priceXL: { fontWeight: 400, fontSize: 52, lineHeight: '60px' },
    button: { fontWeight: 500, fontSize: 16, lineHeight: '24px', textTransform: 'none' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: { body: { backgroundColor: colors.paper, color: colors.ink } },
    },
    MuiTypography: {
      defaultProps: {
        variantMapping: {
          hero: 'h1',
          bodyL: 'p',
          bodyM: 'p',
          bodyS: 'p',
          eyebrow: 'span',
          price: 'span',
          priceXL: 'span',
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { minHeight: 44, borderRadius: radius.md, padding: '10px 24px' },
        sizeSmall: { fontSize: 14, lineHeight: '20px', padding: '10px 16px' },
        outlined: {
          color: colors.ink,
          borderColor: colors.ink,
          '&:hover': { borderColor: colors.ink, backgroundColor: 'rgba(35, 26, 20, 0.06)' },
        },
      },
      variants: [
        {
          props: { variant: 'contained', color: 'primary' },
          style: {
            backgroundColor: colors.yolk,
            color: colors.ink,
            '&:hover': { backgroundColor: '#E2A71E' },
          },
        },
      ],
    },
    MuiLink: { defaultProps: { color: colors.roastDeep } },
  },
});

export default theme;
