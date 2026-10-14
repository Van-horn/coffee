import Box from '@mui/material/Box';
import { useId, type ReactNode } from 'react';
import { wide } from './Section';
import { colors } from '@/theme/tokens';

interface BagIllustrationProps {
  // Roast date for the "250 г · <date>" line (client RoastDate fills it).
  dateSlot: ReactNode;
}

const text = { fontFamily: 'inherit' } as const;

// Kraft coffee bag with a white label on a roast-red quarter circle.
// viewBox is a 469 x 469 square: quarter circle with its right angle at bottom-right.
export default function BagIllustration({ dateSlot }: BagIllustrationProps) {
  const clipId = useId();
  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: { xs: 350, sm: 462, md: wide(469, 0.35, 760) },
        mx: { xs: 'auto', md: 0 },
        aspectRatio: '1 / 1',
        lineHeight: 0,
      }}
    >
      <svg
        viewBox="0 0 469 469"
        width="100%"
        height="100%"
        role="img"
        aria-label="Пачка кофе Кварта, Эфиопия Иргачеффе"
        style={{ display: 'block' }}
      >
        <path d="M469 469H0A469 469 0 0 1 469 0Z" fill={colors.roast} />
        <defs>
          <clipPath id={clipId}>
            <path d="M64 103H362L369 393Q369 407 355 407H71Q57 407 57 393Z" />
          </clipPath>
        </defs>
        {/* body + side shade + cap band */}
        <g clipPath={`url(#${clipId})`}>
          <rect x="57" y="103" width="320" height="304" fill={colors.kraft} />
          <polygon points="271,103 369,103 369,407 299,407" fill={colors.kraftDeep} opacity="0.55" />
          <rect x="57" y="103" width="320" height="45" fill={colors.kraftDeep} opacity="0.3" />
        </g>
        {/* top fold */}
        <polygon points="76,72 352,72 364,103 64,103" fill={colors.kraftDeep} />
        {/* strap */}
        <rect x="88" y="60" width="251" height="12" rx="6" fill={colors.ink} />
        {/* label */}
        <rect x="107" y="142" width="212" height="141" rx="4" fill={colors.card} />
        <path d="M124 181V167A14 14 0 0 1 138 181Z" fill={colors.roast} />
        <text x="146" y="182" fontSize="23" fontWeight="500" fill={colors.ink} style={text}>
          Кварта
        </text>
        <text x="124" y="206" fontSize="13" fill={colors.inkSoft} style={text}>
          Эфиопия
        </text>
        <text x="124" y="231" fontSize="16" fontWeight="500" fill={colors.ink} style={text}>
          Иргачеффе
        </text>
        <line x1="124" y1="243" x2="303" y2="243" stroke={colors.line} strokeWidth="1" />
        <text x="124" y="264" fontSize="14" fill={colors.ink} style={text}>
          250 г · {dateSlot}
        </text>
      </svg>
    </Box>
  );
}
