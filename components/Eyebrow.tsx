import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { colors } from '@/theme/tokens';

interface EyebrowProps {
  tone?: 'onLight' | 'onInk';
  children: ReactNode;
}

// Lowercase stamp label such as "01 · свежесть".
export default function Eyebrow({ tone = 'onLight', children }: EyebrowProps) {
  return (
    <Typography
      variant="eyebrow"
      sx={{ display: 'block', color: tone === 'onInk' ? colors.yolk : colors.roastDeep }}
    >
      {children}
    </Typography>
  );
}
