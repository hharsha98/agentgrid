import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { listDir, PathEscapeError, readFile, resolveUnderRoot, statFile, writeFile } from "./safe-fs.js";

describe("safe-fs", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  function root() {
    const dir = join(tmpdir(), `agentgrid-fs-${Date.now()}-${Math.random()}`);
    mkdirSync(dir, { recursive: true });
    dirs.push(dir);
    return dir;
  }

  it("lists and reads files under root", () => {
    const r = root();
    writeFileSync(join(r, "a.txt"), "hello");
    mkdirSync(join(r, "sub"));
    writeFileSync(join(r, "sub", "b.txt"), "world");
    const entries = listDir(r, ".");
    expect(entries.some((e) => e.name === "sub" && e.type === "dir")).toBe(true);
    expect(readFile(r, "a.txt").content).toBe("hello");
  });

  it("blocks path escape", () => {
    const r = root();
    expect(() => resolveUnderRoot(r, "../outside")).toThrow(PathEscapeError);
  });

  it("writes files", () => {
    const r = root();
    writeFile(r, "new/file.txt", "data");
    expect(readFile(r, "new/file.txt").content).toBe("data");
  });

  it("stats files under root", () => {
    const r = root();
    writeFileSync(join(r, "a.txt"), "hello");
    const st = statFile(r, "a.txt");
    expect(st.size).toBe(5);
    expect(st.mtimeMs).toBeGreaterThan(0);
  });
});
