interface IconProps {
  size?: number;
}

export default function TruckIcon({ size = 20 }: IconProps) {
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
      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H13a1 1 0 0 1 1 1v10H3V6.5Z" />
      <path d="M14 9h3.4a1 1 0 0 1 .8.4l2.4 3.2a1 1 0 0 1 .2.6V16H14V9Z" />
      <circle cx="7.5" cy="17" r="2" fill="currentColor" stroke="none" />
      <circle cx="17" cy="17" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}
