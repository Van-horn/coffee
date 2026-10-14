'use client';

import { useSyncExternalStore } from 'react';
import { MINSK_UTC_OFFSET_HOURS, nextRoast } from '@/lib/schedule';

const pad = (n: number) => String(n).padStart(2, '0');

// "DD.MM" of the given instant on the Minsk calendar (fixed UTC+3, never local getters).
export function formatRoastDate(d: Date): string {
  const m = new Date(d.getTime() + MINSK_UTC_OFFSET_HOURS * 3_600_000);
  return `${pad(m.getUTCDate())}.${pad(m.getUTCMonth() + 1)}`;
}

const subscribe = () => () => {};
const getClient = () => formatRoastDate(nextRoast(new Date()));
const getServer = () => 'чт';

// Next roast date. The page is statically prerendered, so "now" is read on the client only:
// SSR and hydration render the stable fallback "чт", then React swaps in the real date
// right after hydration (no mismatch).
export default function RoastDate() {
  return <>{useSyncExternalStore(subscribe, getClient, getServer)}</>;
}
