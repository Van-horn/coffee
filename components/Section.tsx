import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { colors } from '@/theme/tokens';

// Sticky header height in px: 64 below 1024, 72 from 1024.
export const HEADER_HEIGHT = { mobile: 64, desktop: 72 } as const;

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
}

// Full-bleed section with the inner content container (1200 @ desktop, 688 tablet, 350 mobile).
export default function Section({ id, tone = 'paper', labelledBy, children, sx }: SectionProps) {
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
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Box sx={{ maxWidth: 1440, mx: 'auto', px: { xs: '20px', sm: '40px', md: '120px' } }}>
        {children}
      </Box>
    </Box>
  );
}
