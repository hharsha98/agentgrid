/** DEMO_PUBLIC=1 (also accepts true/yes). Local simulator switch — not a public URL. */
export function demoPublicEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = (env.DEMO_PUBLIC ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}
