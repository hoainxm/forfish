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
