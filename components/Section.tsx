import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { colors } from '@/theme/tokens';

// Sticky header height in px: 64 below 1024, 72 from 1024.
export const HEADER_HEIGHT = { mobile: 64, desktop: 72 } as const;

// Side padding of the content container: 20 mobile, 40 tablet, then 40 at 1024 growing linearly to 120 at 1440
// and on from there by 3% of the extra width up to 200.
export const CONTAINER_PX = {
  xs: '20px',
  sm: '40px',
  md: 'calc(clamp(40px, calc(40px + (100vw - 1024px) * 0.1923), 120px) + clamp(0px, calc((100vw - 1440px) * 0.03), 80px))',
} as const;

// Fluid size that equals `base` px up to a 1440 px screen and grows by `perPx` px per extra px of width, up to `cap` px.
export const wide = (base: number, perPx: number, cap: number) =>
  `clamp(${base}px, calc(${base}px + (100vw - 1440px) * ${perPx}), ${cap}px)`;

export type SectionTone = 'paper' | 'paper2' | 'ink';

const background: Record<SectionTone, string> = {
  paper: colors.paper,
  paper2: colors.paper2,
  ink: colors.ink,
};

interface SectionProps {
  id?: string;
  tone?: SectionTone;
  labelledBy?: string;
  children: ReactNode;
  sx?: SxProps<Theme>;
  // Stretch the section to its parent's height and let the content container be a flex column.
  fill?: boolean;
  // Skip rendering work until the section nears the viewport (for sections below the fold).
  defer?: boolean;
}

// Full-bleed section; the content spans the screen between fluid gutters (1200 wide at 1440, 688 tablet, 350 mobile).
export default function Section({ id, tone = 'paper', labelledBy, children, sx, fill, defer }: SectionProps) {
  return (
    <Box
      component="section"
      id={id}
      aria-labelledby={labelledBy}
      sx={[
        {
          bgcolor: background[tone],
          color: tone === 'ink' ? colors.paper : colors.ink,
          py: { xs: 7, sm: 9, md: 13 }, // 56 / 72 / 104
          scrollMarginTop: { xs: `${HEADER_HEIGHT.mobile}px`, md: `${HEADER_HEIGHT.desktop}px` },
          ...(defer && { contentVisibility: 'auto', containIntrinsicSize: 'auto 900px' }),
          ...(fill && { flex: 1, display: 'flex', flexDirection: 'column' }),
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Box sx={[{ px: CONTAINER_PX }, fill ? { flex: 1, display: 'flex', flexDirection: 'column' } : {}]}>
        {children}
      </Box>
    </Box>
  );
}
