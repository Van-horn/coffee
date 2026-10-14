'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useSyncExternalStore } from 'react';
import { hoursLabel, isOpenNow, minskDayGroup } from '@/lib/schedule';
import { colors } from '@/theme/tokens';

interface Status {
  open: boolean;
  label: string;
  group: 'weekdays' | 'weekend';
}

const compute = (minute: number): Status => {
  const now = new Date(minute * 60_000);
  return { open: isOpenNow(now), label: hoursLabel(now), group: minskDayGroup(now) };
};

// The prerendered page cannot know "now": the server snapshot is null (stable fallback), the client
// snapshot is the current minute, and the subscription ticks every 60 s.
const subscribe = (onChange: () => void) => {
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
};
const getClient = (): number => Math.floor(Date.now() / 60_000);
const getServer = (): null => null;

function useNow(): Status | null {
  const minute = useSyncExternalStore<number | null>(subscribe, getClient, getServer);
  return minute === null ? null : compute(minute);
}

export default function OpenNow() {
  const status = useNow();
  const text = status ? `${status.open ? 'Сейчас открыто' : 'Сейчас закрыто'} · ${status.label}` : 'Часы работы';
  const tone = status && status.open ? colors.leaf : colors.inkSoft;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', minHeight: 24 }}>
      {status && (
        <Box aria-hidden="true" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: tone, flexShrink: 0 }} />
      )}
      <Typography variant="body2" sx={{ m: 0, fontWeight: 500, color: tone }}>
        {text}
      </Typography>
    </Box>
  );
}

// "сегодня" chip for the hours row matching today's Minsk day group; renders nothing before mount.
export function TodayChip({ group }: { group: 'weekdays' | 'weekend' }) {
  const status = useNow();
  if (!status || status.group !== group) return null;
  return (
    <Box
      component="span"
      sx={{
        ml: '8px',
        px: '8px',
        py: '2px',
        borderRadius: '999px',
        bgcolor: colors.paper2,
        color: colors.ink,
        fontSize: 12,
        lineHeight: '16px',
        fontWeight: 500,
      }}
    >
      сегодня
    </Box>
  );
}
