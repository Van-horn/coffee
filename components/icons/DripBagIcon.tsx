import { colors } from '@/theme/tokens';

interface DripBagIconProps {
  size?: number;
}

// Drip-bag: kraft hanger flap on top, white pouch with red lines.
export default function DripBagIcon({ size = 56 }: DripBagIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none" aria-hidden="true" focusable="false">
      <path d="M5 8h46v8H5z" fill={colors.kraft} stroke={colors.ink} strokeWidth="2.5" strokeLinejoin="round" />
      <path
        d="M8 16h40l-4.5 34a3 3 0 0 1-3 2.6H15.5a3 3 0 0 1-3-2.6z"
        fill={colors.card}
        stroke={colors.ink}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M19 27h18M21 34h14" stroke={colors.roast} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
