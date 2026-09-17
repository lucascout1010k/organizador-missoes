export type AppIconName =
  | "academy"
  | "agenda"
  | "bell"
  | "check"
  | "chevron"
  | "clock"
  | "college"
  | "home"
  | "logout"
  | "missions"
  | "projects"
  | "reports"
  | "search"
  | "settings"
  | "sparkles"
  | "trophy";

const paths: Record<AppIconName, React.ReactNode> = {
  academy: <><path d="M4 14h16M6 10v8M18 10v8M8 8h8M10 5h4" /><path d="M3 12h3M18 12h3" /></>,
  agenda: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16M8 14h3" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  college: <><path d="m3 10 9-5 9 5-9 5-9-5Z" /><path d="M7 13v4c3 2 7 2 10 0v-4M21 10v6" /></>,
  home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>,
  logout: <><path d="M10 5H5v14h5M14 8l4 4-4 4M9 12h9" /></>,
  missions: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l4 2" /></>,
  projects: <><path d="M8 4h8l2 3h3v13H3V7h3l2-3Z" /><path d="M8 11h8M8 15h5" /></>,
  reports: <><path d="M5 20V10M12 20V4M19 20v-7" /><path d="M3 20h18" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m16 16 5 5" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
  sparkles: <><path d="m12 3 1.2 3.3L16.5 7.5l-3.3 1.2L12 12l-1.2-3.3-3.3-1.2 3.3-1.2L12 3Z" /><path d="m18 13 .8 2.2L21 16l-2.2.8L18 19l-.8-2.2L15 16l2.2-.8L18 13ZM5.5 13l.6 1.4 1.4.6-1.4.6L5.5 17l-.6-1.4-1.4-.6 1.4-.6.6-1.4Z" /></>,
  trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" /><path d="M8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4M12 13v4M8 20h8M10 17h4" /></>,
};

export function AppIcon({
  label,
  name,
  size = 20,
}: {
  label?: string;
  name: AppIconName;
  size?: number;
}) {
  return (
    <svg
      aria-hidden={label ? undefined : true}
      aria-label={label}
      fill="none"
      height={size}
      role={label ? "img" : undefined}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
      width={size}
    >
      {paths[name]}
    </svg>
  );
}
