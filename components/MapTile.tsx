import Box from '@mui/material/Box';
import { colors } from '@/theme/tokens';

// Muted teal-grey river; not a design token (illustration only).
const RIVER = '#BCD3CB';

// Illustrated (not real) map: streets, a river band and a roast pin with a halo. Decorative.
export default function MapTile() {
  return (
    <Box sx={{ width: '100%', aspectRatio: { xs: '350 / 150', sm: '688 / 170', md: '588 / 150' }, lineHeight: 0, bgcolor: colors.paper2 }}>
      <svg
        viewBox="0 0 588 150"
        preserveAspectRatio="xMidYMid slice"
        width="100%"
        height="100%"
        aria-hidden="true"
        focusable="false"
        style={{ display: 'block' }}
      >
        <rect width="588" height="150" fill={colors.paper2} />
        <path d="M0 98 C90 78 150 118 240 96 S400 60 588 88 V150 H0 Z" fill={RIVER} />
        <g stroke={colors.card} strokeLinecap="round" fill="none">
          <path d="M0 30 L588 16" strokeWidth="6" />
          <path d="M0 78 L588 62" strokeWidth="6" />
          <path d="M118 -4 L160 154" strokeWidth="7" />
          <path d="M330 -4 L316 154" strokeWidth="7" />
          <path d="M478 -4 L506 154" strokeWidth="7" />
        </g>
        <circle cx="315" cy="56" r="28" fill={colors.toneApple} opacity="0.55" />
        <circle cx="315" cy="56" r="11" fill={colors.roast} stroke={colors.card} strokeWidth="2.5" />
      </svg>
    </Box>
  );
}
