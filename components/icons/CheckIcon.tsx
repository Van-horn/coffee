interface CheckIconProps {
  size?: number;
  color?: string;
}

// Check mark; stroke follows currentColor unless color is given.
export default function CheckIcon({ size = 24, color = 'currentColor' }: CheckIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M6 12.5l4 4 8-9" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
