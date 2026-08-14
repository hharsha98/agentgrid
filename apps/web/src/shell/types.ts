export type AppView =
  | "grid"
  | "board"
  | "files"
  | "memory"
  | "swarm"
  | "skills"
  | "prompts"
  | "browser";

export const APP_VIEWS: { id: AppView; label: string; short: string }[] = [
  { id: "grid", label: "Grid", short: "G" },
  { id: "board", label: "Board", short: "B" },
  { id: "swarm", label: "Swarm", short: "S" },
  { id: "files", label: "Files", short: "F" },
  { id: "memory", label: "Memory", short: "M" },
  { id: "skills", label: "Skills", short: "K" },
  { id: "prompts", label: "Prompts", short: "P" },
  { id: "browser", label: "Browser", short: "W" },
];
