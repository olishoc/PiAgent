export type IconName =
  | "archive"
  | "arrowLeft"
  | "arrowRight"
  | "arrowUp"
  | "bot"
  | "box"
  | "check"
  | "chevronDown"
  | "circle"
  | "clock"
  | "file"
  | "folder"
  | "gear"
  | "layout"
  | "link"
  | "paperclip"
  | "pin"
  | "pinOff"
  | "play"
  | "plug"
  | "plus"
  | "search"
  | "shield"
  | "spark"
  | "stop"
  | "terminal"
  | "x";

interface IconProps {
  name: IconName;
  size?: number;
}

const paths: Record<IconName, string> = {
  archive: "M4 7h16M6 7v12h12V7M9 11h6",
  arrowLeft: "M15 6l-6 6 6 6",
  arrowRight: "M9 6l6 6-6 6",
  arrowUp: "M12 19V5M6 11l6-6 6 6",
  bot: "M12 8V5M7 11h10M8 8h8a3 3 0 013 3v5a3 3 0 01-3 3H8a3 3 0 01-3-3v-5a3 3 0 013-3M9 14h.01M15 14h.01",
  box: "M4 7l8-4 8 4-8 4-8-4M4 7v10l8 4 8-4V7M12 11v10",
  check: "M5 12l4 4L19 6",
  chevronDown: "M6 9l6 6 6-6",
  circle: "M12 21a9 9 0 100-18 9 9 0 000 18",
  clock: "M12 21a9 9 0 100-18 9 9 0 000 18M12 7v5l3 2",
  file: "M6 3h8l4 4v14H6V3M14 3v5h5M9 13h6M9 17h6",
  folder: "M3 7h7l2 2h9v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7",
  gear: "M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7M19 12a7 7 0 00-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 00-1.8-1L14.4 3h-4.8l-.3 3.1a7 7 0 00-1.8 1l-2.4-1-2 3.4 2 1.5a7 7 0 000 2l-2 1.5 2 3.4 2.4-1a7 7 0 001.8 1l.3 3.1h4.8l.3-3.1a7 7 0 001.8-1l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1z",
  layout: "M4 5h16v14H4V5M9 5v14M4 10h5",
  link: "M10 13a5 5 0 007 0l2-2a5 5 0 00-7-7l-1 1M14 11a5 5 0 00-7 0l-2 2a5 5 0 007 7l1-1",
  paperclip: "M21 12l-8.5 8.5a6 6 0 01-8.5-8.5L13 3a4 4 0 115.7 5.7l-9 9a2 2 0 11-2.8-2.8l8.5-8.5",
  pin: "M12 17v5M7 3h10l-2 7 3 3v2H6v-2l3-3-2-7z",
  pinOff: "M3 3l18 18M12 17v5M7 3h5M15.5 6.5L15 10l3 3v2h-5M6 15h5",
  play: "M8 5v14l11-7-11-7",
  plug: "M8 2v6M16 2v6M7 8h10v4a5 5 0 01-10 0V8M12 17v5",
  plus: "M12 5v14M5 12h14",
  search: "M11 19a8 8 0 100-16 8 8 0 000 16M21 21l-4.3-4.3",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10",
  spark: "M12 2l1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7L12 2M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16",
  stop: "M7 7h10v10H7z",
  terminal: "M4 17l6-5-6-5M12 19h8",
  x: "M6 6l12 12M18 6L6 18"
};

export default function Icon({ name, size = 16 }: IconProps) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}
