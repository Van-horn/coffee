// Pixso design tokens (file 72Ho3-MUBWvDWupQCZ90-A). Single source for named colors, radius, spacing.
export const colors = {
  paper: '#F3EBDD',
  paper2: '#EADFCB',
  card: '#FBF6EC',
  ink: '#231A14',
  ink2: '#3A2D24',
  inkSoft: '#5E4E42',
  roast: '#C93B18',
  roastDeep: '#9C2B10',
  yolk: '#F0B429',
  leaf: '#2F6B4F',
  error: '#B3261E',
  line: '#CDBFA6',
  fieldBorder: '#85715F',
  kraft: '#DDB67A',
  kraftDeep: '#B98B51',
  toneBergamot: '#E3D98B',
  toneApple: '#E8A58E',
  toneCocoa: '#8A5A3B',
  paperDim: '#CDBBA3',
  white: '#FFFFFF',
} as const;

export const radius = { sm: 6, md: 10, lg: 16, xl: 24, pill: 999 } as const;

export const spacing = [4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80, 96, 120] as const;

// Content widths and side padding per breakpoint (mobile <640, tablet 640-1023, desktop >=1024).
export const layout = {
  desktop: { content: 1200, padding: 120 },
  tablet: { content: 688, padding: 40 },
  mobile: { content: 350, padding: 20 },
} as const;

export const tokens = { colors, radius, spacing, layout } as const;
export type Tokens = typeof tokens;
