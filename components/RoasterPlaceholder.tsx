import { colors } from '@/theme/tokens';

// Stand-in for the about photo until a licensed public/images/roastery.jpg is supplied.
export default function RoasterPlaceholder() {
  return (
    <svg
      viewBox="0 0 520 460"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label="Обжарочная машина в мастерской Кварты"
      style={{ display: 'block' }}
    >
      <defs>
        <radialGradient id="roaster-glow" cx="29%" cy="20%" r="55%">
          <stop offset="0" stopColor={colors.yolk} stopOpacity="0.5" />
          <stop offset="1" stopColor={colors.yolk} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="520" height="460" fill={colors.ink2} />
      <rect width="520" height="460" fill="url(#roaster-glow)" />
      <line x1="150" y1="0" x2="150" y2="62" stroke={colors.paperDim} strokeWidth="2" />
      <path d="M95 108 A55 46 0 0 1 205 108 Z" fill={colors.ink} stroke={colors.kraftDeep} strokeWidth="2" />
      <ellipse cx="150" cy="110" rx="32" ry="6" fill={colors.yolk} />
      <rect y="360" width="520" height="100" fill={colors.ink} />
      <rect x="250" y="130" width="170" height="200" rx="14" fill={colors.toneCocoa} />
      <rect x="270" y="150" width="130" height="70" rx="8" fill={colors.ink} />
      <circle cx="300" cy="260" r="9" fill={colors.roast} />
      <circle cx="335" cy="260" r="9" fill={colors.yolk} />
      <circle cx="370" cy="260" r="9" fill={colors.leaf} />
      <path d="M270 130 V80 Q270 60 300 60 H380" fill="none" stroke={colors.paperDim} strokeWidth="14" strokeLinecap="round" />
      <path d="M225 170 H260 L250 235 H235 Z" fill={colors.kraft} />
      <rect x="235" y="330" width="210" height="32" rx="6" fill={colors.kraftDeep} />
    </svg>
  );
}
