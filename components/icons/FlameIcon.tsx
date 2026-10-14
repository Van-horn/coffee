interface IconProps {
  size?: number;
}

export default function FlameIcon({ size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 3c.5 3.2-2.8 4.9-4.2 7.4C6.6 12.6 7 16 9.4 18a5.6 5.6 0 0 0 8-1.2c1.6-2.4 1-5.6-1.2-7.6-.1 1.6-.9 2.6-2 3 .6-2.8-.2-6.2-2.2-9.2Z" />
      <path d="M12.2 20.5c-1.6-.2-2.5-1.5-2.3-2.8.2-1.1 1.2-1.8 2.2-3 .9 1 2.4 2.1 2.4 3.4 0 1.4-1.1 2.5-2.3 2.4Z" />
    </svg>
  );
}
