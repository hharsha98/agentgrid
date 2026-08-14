/**
 * Parse Final Term / OSC 133 shell-integration markers from a PTY byte stream.
 * Markers: ESC ] 133 ; A|B|C|D[;code] BEL
 */

export type Osc133Event =
  | { type: "prompt" }
  | { type: "output_start" }
  | { type: "command_end"; exitCode: number | null };

export class Osc133Parser {
  private buf = "";

  push(chunk: string): { clean: string; events: Osc133Event[] } {
    this.buf += chunk;
    const events: Osc133Event[] = [];
    let clean = "";

    while (this.buf.length > 0) {
      const start = this.buf.indexOf("\x1b]133;");
      if (start === -1) {
        const esc = this.buf.lastIndexOf("\x1b");
        if (esc !== -1 && esc > this.buf.length - 16) {
          clean += this.buf.slice(0, esc);
          this.buf = this.buf.slice(esc);
        } else {
          clean += this.buf;
          this.buf = "";
        }
        break;
      }

      clean += this.buf.slice(0, start);
      const rest = this.buf.slice(start);
      const bel = rest.indexOf("\x07");
      if (bel === -1) {
        this.buf = rest;
        break;
      }

      const body = rest.slice("\x1b]133;".length, bel);
      const parts = body.split(";");
      const kind = parts[0];
      if (kind === "A" || kind === "B") events.push({ type: "prompt" });
      else if (kind === "C") events.push({ type: "output_start" });
      else if (kind === "D") {
        const codeRaw = parts[1];
        const exitCode =
          codeRaw !== undefined && codeRaw !== "" && !Number.isNaN(Number(codeRaw))
            ? Number(codeRaw)
            : null;
        events.push({ type: "command_end", exitCode });
      }

      this.buf = rest.slice(bel + 1);
    }

    return { clean, events };
  }
}

export interface CommandBlock {
  id: string;
  command: string;
  output: string;
  exitCode: number | null;
  status: "running" | "done";
  startedAt: number;
  collapsed: boolean;
}

export class CommandBlockTracker {
  private parser = new Osc133Parser();
  private blocks: CommandBlock[] = [];
  private currentId: string | null = null;
  private typed = "";
  private lastSubmitted = "";
  private seq = 0;
  private listeners = new Set<() => void>();

  get list(): CommandBlock[] {
    return this.blocks;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  noteInput(data: string): void {
    for (const ch of data) {
      if (ch === "\r" || ch === "\n") {
        this.lastSubmitted = this.typed;
        this.typed = "";
      } else if (ch === "\x7f" || ch === "\b") {
        this.typed = this.typed.slice(0, -1);
      } else if (ch >= " " || ch === "\t") {
        this.typed += ch;
      }
    }
  }

  toggle(id: string): void {
    this.blocks = this.blocks.map((b) =>
      b.id === id ? { ...b, collapsed: !b.collapsed } : b,
    );
    this.emit();
  }

  feed(chunk: string): string {
    const { clean, events } = this.parser.push(chunk);
    let appendId = this.currentId;
    let ended = false;

    for (const ev of events) {
      if (ev.type === "output_start") {
        this.seq += 1;
        const block: CommandBlock = {
          id: `blk-${this.seq}`,
          command: this.lastSubmitted || "(command)",
          output: "",
          exitCode: null,
          status: "running",
          startedAt: Date.now(),
          collapsed: false,
        };
        this.lastSubmitted = "";
        this.currentId = block.id;
        appendId = block.id;
        this.blocks = [...this.blocks, block];
      } else if (ev.type === "command_end") {
        if (this.currentId) {
          this.blocks = this.blocks.map((b) =>
            b.id === this.currentId
              ? { ...b, exitCode: ev.exitCode, status: "done" as const, collapsed: true }
              : b,
          );
          appendId = this.currentId;
        }
        ended = true;
      }
    }

    if (appendId && clean) {
      this.blocks = this.blocks.map((b) =>
        b.id === appendId ? { ...b, output: b.output + clean } : b,
      );
    }
    if (ended) this.currentId = null;

    if (events.length || (appendId && clean)) this.emit();
    return clean;
  }
}
