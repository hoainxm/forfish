/**
 * ForFish icon set — single-weight stroke icons (2.2px), drawn for clarity
 * at small sizes in sun glare. Always paired with a text label in the UI;
 * never decorative emoji.
 */
type IconProps = { className?: string };

function base(props: IconProps) {
  return {
    className: props.className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;
}

export function HomeIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}

export function FishIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3 12c3.5-4.5 8-6 12-4.5 2 .8 3.5 2.3 4.5 4.5-1 2.2-2.5 3.7-4.5 4.5-4 1.5-8.5 0-12-4.5Z" />
      <path d="M19.5 12h.01M3 12l-1.5-3M3 12l-1.5 3" />
    </svg>
  );
}

export function PriceIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 4v16" />
      <path d="M16.5 7.5c0-1.7-2-2.8-4.5-2.8S7.5 5.8 7.5 7.5 9.5 10.3 12 10.8s4.5 1.5 4.5 3.4-2 3.1-4.5 3.1-4.5-1.2-4.5-2.9" />
    </svg>
  );
}

export function WrenchIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M14.5 6.5a4 4 0 0 0-5.6 4.9L3 17.3V21h3.7l5.9-5.9a4 4 0 0 0 4.9-5.6L14.6 12 12 9.4l2.5-2.9Z" />
    </svg>
  );
}

export function DocIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M6 2.5h8L19 7v14.5H6z" />
      <path d="M14 2.5V7h5M9 13h6M9 17h6" />
    </svg>
  );
}

export function PlusIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function EditIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M4 20h4L20 8l-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </svg>
  );
}

export function TrashIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M4 7h16M9 7V4h6v3M6.5 7l1 14h9l1-14" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export function AlertIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 3 2.5 20h19L12 3Z" />
      <path d="M12 9.5V14M12 17h.01" />
    </svg>
  );
}

export function ClockIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

export function CheckIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="m4.5 12.5 5 5L19.5 7" />
    </svg>
  );
}

export function ChevronRightIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

export function WavesIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M2 8c2.5-2.5 5-2.5 7.5 0S15 10.5 17.5 8 21 6 22 7" />
      <path d="M2 13c2.5-2.5 5-2.5 7.5 0s5 2.5 7.5 0 3.5-2 4.5-1" />
      <path d="M2 18c2.5-2.5 5-2.5 7.5 0s5 2.5 7.5 0 3.5-2 4.5-1" />
    </svg>
  );
}

export function WindIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3 8h11a3 3 0 1 0-3-3" />
      <path d="M3 13h15a3 3 0 1 1-3 3" />
      <path d="M3 18h7" />
    </svg>
  );
}

export function SearchIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  );
}

export function CalendarIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}

export function AnchorIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="5.5" r="2.5" />
      <path d="M12 8v13" />
      <path d="M4 14c0 4 3.5 7 8 7s8-3 8-7" />
      <path d="M8.5 14H4M20 14h-4.5" />
    </svg>
  );
}

export function TrendUpIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="m3 17 6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </svg>
  );
}

export function TrendDownIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="m3 7 6 6 4-4 8 8" />
      <path d="M15 17h6v-6" />
    </svg>
  );
}

export function MinusIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M5 12h14" />
    </svg>
  );
}

export function ThermoIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M10 4a2 2 0 0 1 4 0v9.3a4.5 4.5 0 1 1-4 0V4Z" />
      <path d="M12 10v7" />
    </svg>
  );
}

export function PlanktonIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="8" cy="9" r="3.2" />
      <circle cx="16.5" cy="14.5" r="2.4" />
      <circle cx="13.5" cy="5.5" r="1.4" />
      <circle cx="7.5" cy="17.5" r="1.4" />
    </svg>
  );
}

export function CloudSunIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M15.5 5.5a4 4 0 0 1 2.7 1.6M19 2.5V4M22 7h-1.5" />
      <path d="M6.5 19.5h9a3.5 3.5 0 0 0 .6-6.95 5 5 0 0 0-9.7 1.1A3 3 0 0 0 6.5 19.5Z" />
    </svg>
  );
}

export function CrosshairIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="6.5" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
    </svg>
  );
}

export function UsersIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <path d="M16 5.2a3.5 3.5 0 0 1 0 5.6M18.5 14.8c1.5.9 2.5 2.4 2.5 4.2" />
    </svg>
  );
}

export function MoneyHandIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="6" y="3.5" width="12" height="7.5" rx="1.5" />
      <circle cx="12" cy="7.2" r="1.6" />
      <path d="M3 15.5h3.5l3 2h5a1.5 1.5 0 0 1 0 3H9" />
      <path d="M3 21.5h3l2.5 -1" />
    </svg>
  );
}

export function FuelIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M4 21V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v15M3 21h12" />
      <path d="M6.5 7.5h5v4h-5z" />
      <path d="M14 12h2a2 2 0 0 1 2 2v3.5a1.5 1.5 0 0 0 3 0V10l-2.5-2.5" />
    </svg>
  );
}

export function RouteIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="5" cy="18.5" r="2.3" />
      <circle cx="19" cy="5.5" r="2.3" />
      <path d="M5 16.2c0-4.6 4-4.2 7-4.2s7 .4 7-4.2" />
    </svg>
  );
}

export function PinIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 21.5c4-4.4 6.5-8 6.5-11A6.5 6.5 0 0 0 5.5 10.5c0 3 2.5 6.6 6.5 11Z" />
      <circle cx="12" cy="10.5" r="2.3" />
    </svg>
  );
}

export function DepthIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M2.5 4.5c2.4-2 4.8-2 7.2 0s4.8 2 7.2 0 3.6-1.3 4.6-.5" />
      <path d="M12 8.5v8" />
      <path d="m8.5 13.5 3.5 3.5 3.5-3.5" />
      <path d="M3.5 20.5h17" />
    </svg>
  );
}

export function StarIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 3.5l2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.65l5.9-.85L12 3.5Z" />
    </svg>
  );
}

export function PlayIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M7 4.5v15l12-7.5L7 4.5Z" />
    </svg>
  );
}

export function PauseIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M7.5 4.5v15M16.5 4.5v15" />
    </svg>
  );
}

export function LayersIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m4.2 11.8 7.8 4.3 7.8-4.3" />
      <path d="m4.2 15.8 7.8 4.3 7.8-4.3" />
    </svg>
  );
}

export function ChevronUpIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="m5 15 7-7 7 7" />
    </svg>
  );
}

export function ChevronDownIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="m5 9 7 7 7-7" />
    </svg>
  );
}

export function CloseIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M5.5 5.5l13 13M18.5 5.5l-13 13" />
    </svg>
  );
}

export function PhoneIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M5 4h4l1.8 4.5-2.3 1.8a13 13 0 0 0 5.2 5.2l1.8-2.3L20 15v4a1.5 1.5 0 0 1-1.6 1.5C10.6 19.9 4.1 13.4 3.5 5.6A1.5 1.5 0 0 1 5 4Z" />
    </svg>
  );
}
