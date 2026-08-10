/**
 * Fixed-size ring buffer for terminal scrollback.
 * Keeps the newest bytes; drops the oldest when full.
 */
export class RingBuffer {
  private buf: Buffer;
  private size: number;
  private start = 0;
  private length = 0;

  constructor(capacityBytes: number) {
    if (capacityBytes <= 0) throw new Error("capacity must be > 0");
    this.size = capacityBytes;
    this.buf = Buffer.alloc(capacityBytes);
  }

  get capacity(): number {
    return this.size;
  }

  get byteLength(): number {
    return this.length;
  }

  write(chunk: string | Buffer): void {
    const data = typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk;
    if (data.length === 0) return;

    if (data.length >= this.size) {
      data.copy(this.buf, 0, data.length - this.size);
      this.start = 0;
      this.length = this.size;
      return;
    }

    for (let i = 0; i < data.length; i++) {
      const idx = (this.start + this.length) % this.size;
      this.buf[idx] = data[i]!;
      if (this.length < this.size) {
        this.length += 1;
      } else {
        this.start = (this.start + 1) % this.size;
      }
    }
  }

  /** Return stored bytes as a UTF-8 string (may split a multi-byte char at edges). */
  toString(encoding: BufferEncoding = "utf8"): string {
    if (this.length === 0) return "";
    if (this.start + this.length <= this.size) {
      return this.buf.subarray(this.start, this.start + this.length).toString(encoding);
    }
    const first = this.buf.subarray(this.start);
    const second = this.buf.subarray(0, (this.start + this.length) % this.size);
    return Buffer.concat([first, second]).toString(encoding);
  }

  clear(): void {
    this.start = 0;
    this.length = 0;
  }
}
