import { describe, expect, it } from "vitest";
import { RingBuffer } from "./ring-buffer.js";
import { detectAgents, resolveAgent } from "./agents.js";

describe("RingBuffer", () => {
  it("stores and returns written bytes", () => {
    const rb = new RingBuffer(64);
    rb.write("hello");
    expect(rb.toString()).toBe("hello");
    expect(rb.byteLength).toBe(5);
  });

  it("drops oldest bytes when over capacity", () => {
    const rb = new RingBuffer(8);
    rb.write("abcdefghij"); // 10 bytes into 8
    expect(rb.byteLength).toBe(8);
    expect(rb.toString()).toBe("cdefghij");
  });
});

describe("agents", () => {
  it("detects shell as available", () => {
    const agents = detectAgents();
    const shell = agents.find((a) => a.id === "shell");
    expect(shell?.available).toBe(true);
  });

  it("resolves shell", () => {
    expect(resolveAgent("shell")).not.toBeNull();
  });
});
