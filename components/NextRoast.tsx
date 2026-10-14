'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useSyncExternalStore } from 'react';
import { formatRuDate, formatRuDayMonth } from '@/lib/format';
import { isOrderOpen, nextRoast } from '@/lib/schedule';
import { colors } from '@/theme/tokens';

const WEEK_MS = 7 * 24 * 3_600_000;

// Stable text for SSR and hydration (the page is prerendered, so "now" is read on the client only).
const FALLBACK = 'по четвергам, заявки до среды, 20:00';

export function nextRoastText(now: Date): string {
  const roast = nextRoast(now);
  if (isOrderOpen(now)) return `${formatRuDate(roast)} · заявки до среды, 20:00`;
  const following = new Date(roast.getTime() + WEEK_MS);
  return `${formatRuDate(roast)}, заявки закрыты · следующая ${formatRuDayMonth(following)}`;
}

const subscribe = () => () => {};
const getServer = () => FALLBACK;

// The text changes at most a couple of times a week, so a minute-resolution snapshot is plenty;
// useSyncExternalStore compares strings, so an unchanged text never re-renders.
const getClient = () => nextRoastText(new Date());

export default function NextRoast() {
  const text = useSyncExternalStore(subscribe, getClient, getServer);
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'flex-start', sm: 'baseline' },
        columnGap: '16px',
        rowGap: '8px',
      }}
    >
      <Typography variant="eyebrow" sx={{ color: colors.yolk }}>
        ближайшая обжарка
      </Typography>
      <Typography variant="bodyM" sx={{ color: colors.paper, fontWeight: 500, m: 0 }}>
        {text}
      </Typography>
    </Box>
  );
}
