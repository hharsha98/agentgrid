export type RpcMode = "content-length" | "ndjson";

export interface JsonRpcRequest {
  jsonrpc?: string;
  id?: unknown;
  method?: string;
  params?: unknown;
}

/**
 * MCP stdio is JSON-RPC 2.0. Cursor / Claude Desktop use LSP-style
 * Content-Length framing. Some simpler clients send one JSON object per line.
 * Detect the first complete message and stick to that mode.
 */
export class RpcFramer {
  private buf = Buffer.alloc(0);
  mode: RpcMode | "unknown" = "unknown";

  push(chunk: Buffer | string): JsonRpcRequest[] {
    this.buf = Buffer.concat([this.buf, typeof chunk === "string" ? Buffer.from(chunk) : chunk]);
    const out: JsonRpcRequest[] = [];
    while (true) {
      const next = this.pullOne();
      if (!next) break;
      out.push(next);
    }
    return out;
  }

  encode(message: unknown): Buffer {
    const json = JSON.stringify(message);
    const mode: RpcMode = this.mode === "ndjson" ? "ndjson" : "content-length";
    if (mode === "ndjson") return Buffer.from(`${json}\n`, "utf8");
    const len = Buffer.byteLength(json, "utf8");
    return Buffer.from(`Content-Length: ${len}\r\n\r\n${json}`, "utf8");
  }

  private pullOne(): JsonRpcRequest | null {
    if (this.buf.length === 0) return null;
    this.detectMode();
    if (this.mode === "unknown") return null;
    return this.mode === "ndjson" ? this.pullNdjson() : this.pullLsp();
  }

  private detectMode(): void {
    if (this.mode !== "unknown") return;
    const peek = this.buf.toString("utf8");
    const trimmedStart = peek.match(/^\s*/)?.[0].length ?? 0;
    const body = peek.slice(trimmedStart);
    if (body.length === 0) return;
    if (/^content-length:/i.test(body)) {
      this.mode = "content-length";
      return;
    }
    if (body.startsWith("{") || body.startsWith("[")) {
      this.mode = "ndjson";
    }
  }

  private pullNdjson(): JsonRpcRequest | null {
    const text = this.buf.toString("utf8");
    const nl = text.indexOf("\n");
    if (nl === -1) return null;
    const line = text.slice(0, nl).replace(/\r$/, "").trim();
    this.buf = Buffer.from(text.slice(nl + 1), "utf8");
    if (!line) return this.pullNdjson();
    return JSON.parse(line) as JsonRpcRequest;
  }

  private pullLsp(): JsonRpcRequest | null {
    const text = this.buf.toString("utf8");
    const headerEnd = text.indexOf("\r\n\r\n");
    if (headerEnd === -1) return null;
    const header = text.slice(0, headerEnd);
    const match = header.match(/content-length:\s*(\d+)/i);
    if (!match) {
      throw new Error("Content-Length header missing");
    }
    const len = Number(match[1]);
    const bodyStart = headerEnd + 4;
    const bodyBuf = this.buf.subarray(bodyStart);
    if (bodyBuf.length < len) return null;
    const json = bodyBuf.subarray(0, len).toString("utf8");
    this.buf = Buffer.from(bodyBuf.subarray(len));
    return JSON.parse(json) as JsonRpcRequest;
  }
}
