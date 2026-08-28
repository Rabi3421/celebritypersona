type P = { className?: string };
const base = {
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const GridIcon = (p: P) => (
  <svg {...base} {...p}>
    <rect x="2" y="2" width="5" height="5" rx="1" />
    <rect x="9" y="2" width="5" height="5" rx="1" />
    <rect x="2" y="9" width="5" height="5" rx="1" />
    <rect x="9" y="9" width="5" height="5" rx="1" />
  </svg>
);

export const HangerIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M8 6.5V5.6A1.6 1.6 0 1 1 9.6 4" />
    <path d="M8 6.5 2.2 10.6a.8.8 0 0 0 .5 1.4h10.6a.8.8 0 0 0 .5-1.4L8 6.5Z" />
  </svg>
);

export const PersonIcon = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="8" cy="5" r="2.6" />
    <path d="M2.8 13.4a5.2 5.2 0 0 1 10.4 0" />
  </svg>
);

export const CalendarIcon = (p: P) => (
  <svg {...base} {...p}>
    <rect x="2" y="3.4" width="12" height="10.6" rx="1.6" />
    <path d="M2 6.6h12M5.4 2v2.6M10.6 2v2.6" />
  </svg>
);

export const InboxIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M2 9.6 3.9 3.2A1 1 0 0 1 4.86 2.5h6.28a1 1 0 0 1 .96.7L14 9.6" />
    <path d="M2 9.6h3.2l.8 1.7h4l.8-1.7H14v2.9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9.6Z" />
  </svg>
);

export const SlidersIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M2 4.6h8M12.4 4.6H14M2 11.4h1.6M6 11.4h8" />
    <circle cx="11.2" cy="4.6" r="1.6" />
    <circle cx="4.8" cy="11.4" r="1.6" />
  </svg>
);

export const TrendIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M2 11.2 6 7l2.6 2.6L14 4.2" />
    <path d="M10.4 4.2H14v3.6" />
  </svg>
);
