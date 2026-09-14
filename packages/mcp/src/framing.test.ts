import { describe, expect, it } from "vitest";
import { RpcFramer } from "./framing.js";

describe("RpcFramer", () => {
  it("parses newline-delimited JSON", () => {
    const f = new RpcFramer();
    const msgs = f.push('{"jsonrpc":"2.0","id":1,"method":"ping"}\n');
    expect(f.mode).toBe("ndjson");
    expect(msgs).toEqual([{ jsonrpc: "2.0", id: 1, method: "ping" }]);
  });

  it("parses Content-Length frames and encodes the same way", () => {
    const f = new RpcFramer();
    const payload = '{"jsonrpc":"2.0","id":1,"method":"initialize"}';
    const frame = `Content-Length: ${Buffer.byteLength(payload)}\r\n\r\n${payload}`;
    const msgs = f.push(frame);
    expect(f.mode).toBe("content-length");
    expect(msgs[0]?.method).toBe("initialize");
    const encoded = f.encode({ jsonrpc: "2.0", id: 1, result: {} }).toString("utf8");
    expect(encoded.startsWith("Content-Length:")).toBe(true);
    expect(encoded).toContain("\r\n\r\n");
  });

  it("handles a split Content-Length body", () => {
    const f = new RpcFramer();
    const payload = '{"jsonrpc":"2.0","id":7,"method":"ping"}';
    const header = `Content-Length: ${Buffer.byteLength(payload)}\r\n\r\n`;
    expect(f.push(header)).toEqual([]);
    const msgs = f.push(payload);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]?.id).toBe(7);
  });
});
