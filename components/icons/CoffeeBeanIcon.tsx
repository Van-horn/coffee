interface CoffeeBeanIconProps {
  size?: number;
  // Bean body color.
  body: string;
  // Groove / highlight line color.
  groove: string;
}

// Two-tone coffee bean, tilted, with an S-shaped groove.
export default function CoffeeBeanIcon({ size = 52, body, groove }: CoffeeBeanIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 64" fill="none" aria-hidden="true" focusable="false">
      <ellipse cx="26" cy="32" rx="21" ry="29" transform="rotate(18 26 32)" fill={body} />
      <path
        d="M34 8C22 20 36 30 24 40C20 44 18 50 18 56"
        stroke={groove}
        strokeWidth="4.5"
        strokeLinecap="round"
        transform="rotate(18 26 32) translate(1 0)"
      />
    </svg>
  );
}
