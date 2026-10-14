import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { colors } from '@/theme/tokens';

type AccentTone = 'onLight' | 'onPaper2' | 'onInk';

const textColor: Record<AccentTone, string> = {
  onLight: colors.ink,
  onPaper2: colors.ink,
  onInk: colors.paper,
};

const accentColor: Record<AccentTone, string> = {
  onLight: colors.roast, // large text on paper: allowed
  onPaper2: colors.roastDeep,
  onInk: colors.yolk,
};

interface AccentHeadingProps {
  id?: string;
  tone?: AccentTone;
  children: ReactNode;
}

// Accent word inside a heading: real italic, colored by the heading's tone.
export function Accent({ children }: { children: ReactNode }) {
  return <em>{children}</em>;
}

export default function AccentHeading({ id, tone = 'onLight', children }: AccentHeadingProps) {
  return (
    <Typography
      variant="h2"
      component="h2"
      id={id}
      sx={{
        color: textColor[tone],
        m: 0,
        '& em': { fontStyle: 'italic', fontWeight: 400, color: accentColor[tone] },
      }}
    >
      {children}
    </Typography>
  );
}
