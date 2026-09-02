import type { FieldType } from "../../main/ipcChannels";

const typeConfig: Record<FieldType, { bg: string; fg: string; icon: React.ReactNode; title: string }> = {
  // ── Text ──────────────────────────────────────────────────────────────────
  text: {
    bg: "#1A1D24", fg: "#C0C4CD", title: "Single-line text",
    icon: (
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M2 3h8M6 3v6" />
      </svg>
    ),
  },
  multiline: {
    bg: "#1A1D24", fg: "#C0C4CD", title: "Multi-line text",
    icon: (
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M2 3h8M2 6h6M2 9h7" />
      </svg>
    ),
  },
  url: {
    bg: "#0D1F1A", fg: "#5FD1A8", title: "URL",
    icon: (
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 6.5a3 3 0 004.5.4l1-1a3 3 0 00-4.2-4.2L5.2 2.8" />
        <path d="M7 5.5a3 3 0 00-4.5-.4l-1 1a3 3 0 004.2 4.2l1.1-1.1" />
      </svg>
    ),
  },
  email: {
    bg: "#0D1F1A", fg: "#5FD1A8", title: "Email",
    icon: (
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="2.5" width="10" height="7" rx="1" />
        <path d="M1 4l5 3.5L11 4" />
      </svg>
    ),
  },
  phone: {
    bg: "#0D1F1A", fg: "#5FD1A8", title: "Phone",
    icon: (
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 1.5h2l1 2.5-1.5 1a6 6 0 002.5 2.5l1-1.5L10.5 7v2a1 1 0 01-1 1A8.5 8.5 0 012 1.5" />
      </svg>
    ),
  },
  // ── Numbers ───────────────────────────────────────────────────────────────
  integer: {
    bg: "#05202D", fg: "#83CFF7", title: "Integer",
    icon: (
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M3.5 1.5v9M7.5 1.5v9" />
        <path d="M1.5 4.5h9M1.5 8h9" />
      </svg>
    ),
  },
  decimal: {
    bg: "#05202D", fg: "#83CFF7", title: "Decimal",
    icon: (
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M2 3.5h3M7 3.5h3" />
        <path d="M2 7h3M7 7h3" />
        <circle cx="5.5" cy="9" r="0.9" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  currency: {
    bg: "#05202D", fg: "#83CFF7", title: "Currency",
    icon: (
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 1.5v9" />
        <path d="M8.5 3.5a2.5 2.5 0 00-5 0c0 1.38 2.5 2.5 2.5 2.5s2.5 1.12 2.5 2.5a2.5 2.5 0 01-5 0" />
      </svg>
    ),
  },
  rating: {
    bg: "#05202D", fg: "#83CFF7", title: "Rating",
    icon: (
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3">
        <path d="M6 1.5l1.1 2.2 2.4.35-1.75 1.7.41 2.4L6 7.1 3.84 8.15l.41-2.4L2.5 4.05l2.4-.35L6 1.5z" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  percentage: {
    bg: "#05202D", fg: "#83CFF7", title: "Percentage",
    icon: (
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="3.5" cy="3.5" r="1.2" />
        <circle cx="8.5" cy="8.5" r="1.2" />
        <path d="M2 10L10 2" />
      </svg>
    ),
  },
  // ── Date & Time ───────────────────────────────────────────────────────────
  date: {
    bg: "#1B0950", fg: "#BDBEF7", title: "Date",
    icon: (
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="2.5" width="10" height="8.5" rx="1" />
        <path d="M1 5.5h10" />
        <path d="M3.5 1.5v2M8.5 1.5v2" />
        <circle cx="4" cy="8" r="0.7" fill="currentColor" stroke="none" />
        <circle cx="7" cy="8" r="0.7" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  time: {
    bg: "#1B0950", fg: "#BDBEF7", title: "Time",
    icon: (
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="6" r="4.5" />
        <path d="M6 3.5V6l1.5 1.5" />
      </svg>
    ),
  },
  duration: {
    bg: "#1B0950", fg: "#BDBEF7", title: "Duration",
    icon: (
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 1.5v1M6 9.5v1M1.5 6h1M9.5 6h1" />
        <circle cx="6" cy="6" r="3.5" />
        <path d="M6 4v2.5h2" />
      </svg>
    ),
  },
  datetime: {
    bg: "#1B0950", fg: "#BDBEF7", title: "Date / Time",
    icon: (
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="2.5" width="6.5" height="6" rx="1" />
        <path d="M1 5h6.5" />
        <path d="M3 1.5v2M6 1.5v2" />
        <circle cx="9.5" cy="9" r="2.5" />
        <path d="M9.5 7.5v1.5l1 1" />
      </svg>
    ),
  },
  // ── Boolean ───────────────────────────────────────────────────────────────
  yesno: {
    bg: "#052312", fg: "#4DE491", title: "Yes / No",
    icon: (
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3.5" width="10" height="5" rx="2.5" />
        <circle cx="8.5" cy="6" r="1.8" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  // ── Selection ─────────────────────────────────────────────────────────────
  choice: {
    bg: "#281A04", fg: "#F7B750", title: "Single choice",
    icon: (
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="6" cy="6" r="4.5" />
        <circle cx="6" cy="6" r="2" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  tags: {
    bg: "#281A04", fg: "#F7B750", title: "Tags",
    icon: (
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1.5 4.5h4L9 8a1 1 0 010 1.5L7.5 11A1 1 0 016 11L2.5 7.5a1 1 0 010-1.5z" />
        <circle cx="4" cy="5.5" r="0.8" fill="currentColor" stroke="none" />
        <path d="M7 2l3 3" />
        <path d="M8.5 1.5l3 3" />
      </svg>
    ),
  },
  multichoice: {
    bg: "#281A04", fg: "#F7B750", title: "Multiple choice",
    icon: (
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1.5" y="1.5" width="4" height="4" rx="0.8" />
        <rect x="6.5" y="1.5" width="4" height="4" rx="0.8" />
        <rect x="1.5" y="6.5" width="4" height="4" rx="0.8" />
        <path d="M7.5 9l1 1 2-2" />
      </svg>
    ),
  },
  // ── Files ─────────────────────────────────────────────────────────────────
  "linked-file": {
    bg: "#350F04", fg: "#F7B09A", title: "Linked file",
    icon: (
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M4.5 7.5L7.5 4.5" />
        <path d="M5.5 8.5L4 10a2.12 2.12 0 01-3-3l1.5-1.5A2.12 2.12 0 015 5.3" />
        <path d="M6.5 3.5L8 2a2.12 2.12 0 013 3L9.5 6.5A2.12 2.12 0 017 6.7" />
      </svg>
    ),
  },
  "embedded-file": {
    bg: "#350F04", fg: "#F7B09A", title: "Embedded file",
    icon: (
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 1h5.5L10 3.5V11H2z" />
        <path d="M7.5 1v2.5H10" />
        <path d="M4 7.5l2 2 2-2" />
        <path d="M6 5.5v4" />
      </svg>
    ),
  },
  // ── Advanced ──────────────────────────────────────────────────────────────
  lookup: {
    bg: "#1A0D28", fg: "#C89DF7", title: "Lookup",
    icon: (
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="1.5" width="4.5" height="3.5" rx="0.8" />
        <rect x="1" y="7" width="4.5" height="3.5" rx="0.8" />
        <rect x="6.5" y="4.25" width="4.5" height="3.5" rx="0.8" />
        <path d="M5.5 3.25h1.5a1 1 0 011 1v1.5M5.5 8.75h1.5a1 1 0 001-1V6.25" />
      </svg>
    ),
  },
  formula: {
    bg: "#1A0D28", fg: "#C89DF7", title: "Formula",
    icon: (
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10.5c-.5 0-1-.4-1-1V2.5c0-.6.5-1 1-1h1.5L7 4v6.5H3z" />
        <path d="M4.5 1.5V4H7" />
        <path d="M3.5 7l2 0M3.5 8.5l2 0" />
        <path d="M9.5 5.5l-2 3" />
        <path d="M7.5 5.5l2 0M7.5 8.5l2 0" />
      </svg>
    ),
  },
};

export default function TypeBadge({ type, size = "sm" }: { type: FieldType; size?: "xs" | "sm" }) {
  const c = typeConfig[type];
  return (
    <span
      title={c.title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size === "xs" ? 18 : 22,
        height: size === "xs" ? 18 : 22,
        borderRadius: 3,
        backgroundColor: c.bg,
        color: c.fg,
        flexShrink: 0,
      }}
    >
      <span style={{ width: size === "xs" ? 10 : 12, height: size === "xs" ? 10 : 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {c.icon}
      </span>
    </span>
  );
}
