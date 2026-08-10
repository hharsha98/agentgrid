import { describe, expect, it } from "vitest";
import { CommandBlockTracker, Osc133Parser } from "./commandBlocks";

describe("Osc133Parser", () => {
  it("strips markers and emits events", () => {
    const p = new Osc133Parser();
    const { clean, events } = p.push(
      "hello\x1b]133;C\x07world\x1b]133;D;0\x07!",
    );
    expect(clean).toBe("helloworld!");
    expect(events).toEqual([
      { type: "output_start" },
      { type: "command_end", exitCode: 0 },
    ]);
  });

  it("handles split chunks", () => {
    const p = new Osc133Parser();
    const a = p.push("pre\x1b]133;");
    const b = p.push("D;1\x07post");
    expect(a.clean).toBe("pre");
    expect(a.events).toEqual([]);
    expect(b.clean).toBe("post");
    expect(b.events).toEqual([{ type: "command_end", exitCode: 1 }]);
  });
});

describe("CommandBlockTracker", () => {
  it("builds a block from typed input + OSC markers", () => {
    const t = new CommandBlockTracker();
    t.noteInput("ls");
    t.noteInput("\r");
    t.feed("\x1b]133;C\x07file.txt\n\x1b]133;D;0\x07");
    expect(t.list).toHaveLength(1);
    expect(t.list[0]?.command).toBe("ls");
    expect(t.list[0]?.output).toContain("file.txt");
    expect(t.list[0]?.exitCode).toBe(0);
    expect(t.list[0]?.status).toBe("done");
  });
});
