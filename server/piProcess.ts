import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
import fs from "node:fs";
import path from "node:path";

function piCommand(): { command: string; argsPrefix: string[] } {
  if (process.env.PI_BIN) return { command: process.env.PI_BIN, argsPrefix: [] };
  const candidates = [
    path.resolve(process.cwd(), "node_modules", "@earendil-works", "pi-coding-agent", "dist", "cli.js"),
    path.resolve(process.cwd(), "..", "node_modules", "@earendil-works", "pi-coding-agent", "dist", "cli.js")
  ];
  for (const cli of candidates) {
    if (fs.existsSync(cli)) return { command: process.execPath, argsPrefix: [cli] };
  }
  return { command: "pi", argsPrefix: [] };
}

interface PiSessionOptions {
  extraArgs?: string[];
}

export class PiSession {
  private proc: ChildProcessWithoutNullStreams;
  private buffer = "";
  private decoder = new StringDecoder("utf8");
  private pendingRequests: Map<string, (r: any) => void> = new Map();
  public onEvent: (event: any) => void = () => {};

  constructor(sessionDir: string, accessToken: string, options: PiSessionOptions = {}) {
    const pi = piCommand();
    this.proc = spawn(pi.command, [...pi.argsPrefix, "--mode", "rpc", "--provider", "openai", "--session-dir", sessionDir, ...(options.extraArgs ?? [])], {
      env: { ...process.env, OPENAI_ACCESS_TOKEN: accessToken },
      stdio: ["pipe", "pipe", "pipe"]
    });

    this.proc.stdout.on("data", (chunk) => this._onData(chunk));
    this.proc.stderr.on("data", (d) => console.error("[pi stderr]", d.toString()));
    this.proc.on("error", (err) => {
      this.rejectPending({ type: "response", success: false, error: err.message });
      this.onEvent({ type: "process_error", message: err.message });
    });
    this.proc.on("exit", (code, signal) => {
      this.rejectPending({ type: "response", success: false, error: "Pi process exited", code, signal });
      this.onEvent({ type: "process_exit", code, signal });
    });
  }

  private _onData(chunk: Buffer) {
    this.buffer += this.decoder.write(chunk);
    let nl: number;
    while ((nl = this.buffer.indexOf("\n")) !== -1) {
      let line = this.buffer.slice(0, nl);
      this.buffer = this.buffer.slice(nl + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.type === "response" && msg.id && this.pendingRequests.has(msg.id)) {
          this.pendingRequests.get(msg.id)!(msg);
          this.pendingRequests.delete(msg.id);
        } else {
          this.onEvent(msg);
        }
      } catch {
        this.onEvent({ type: "parse_error", line });
      }
    }
  }

  private rejectPending(response: any) {
    for (const resolve of this.pendingRequests.values()) resolve(response);
    this.pendingRequests.clear();
  }

  send(cmd: Record<string, unknown> & { id?: string }): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.proc.stdin.writable) {
        reject(new Error("Pi process stdin is closed"));
        return;
      }
      const id = cmd.id ?? Math.random().toString(36).slice(2);
      const withId = { ...cmd, id };
      this.pendingRequests.set(id, resolve);
      const timeout = setTimeout(() => {
        if (!this.pendingRequests.has(id)) return;
        this.pendingRequests.delete(id);
        resolve({ type: "response", id, success: false, error: "Pi RPC request timed out" });
      }, 120_000);
      this.pendingRequests.set(id, (result) => {
        clearTimeout(timeout);
        resolve(result);
      });
      this.proc.stdin.write(JSON.stringify(withId) + "\n", (err) => {
        if (!err) return;
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(err);
      });
    });
  }

  prompt(message: string) {
    return this.send({ type: "prompt", message });
  }

  abort() {
    return this.send({ type: "abort" });
  }

  newSession() {
    return this.send({ type: "new_session" });
  }

  getState() {
    return this.send({ type: "get_state" });
  }

  getMessages() {
    return this.send({ type: "get_messages" });
  }

  kill() {
    this.proc.kill();
  }
}
