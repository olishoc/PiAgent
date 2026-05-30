import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { AppSettings, ProviderOption } from "../App";
import { Attachment, PromptOptions } from "../hooks/useAgent";
import { apiUrl } from "../lib/api";
import Icon from "./Icon";

interface ComposerProps {
  onSend: (text: string, attachments?: Attachment[], options?: PromptOptions) => void;
  onCommand: (command: string) => void;
  onAbort: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  settings?: AppSettings;
  models?: ProviderOption[];
  extensionCommands?: Array<{ name: string; description?: string; source?: string }>;
  onSettingsChange: (patch: Partial<AppSettings>) => void;
  onAgentCommand: (cmd: Record<string, unknown>) => Promise<any>;
  onOpenContextPanel: () => void;
}

const slashCommands = [
  { command: "/help", label: "Show available commands" },
  { command: "/new", label: "Start a new thread" },
  { command: "/compact", label: "Ask Pi to compact the active context" },
  { command: "/permissions", label: "Open permissions and access mode" },
  { command: "/attach", label: "Attach files to the next message" },
  { command: "/advisor ask", label: "Consult the real pi-advisor extension now" },
  { command: "/advisor on", label: "Enable the real pi-advisor extension" },
  { command: "/advisor off", label: "Disable the real pi-advisor extension" },
  { command: "/subagents", label: "Open automatic subagent delegation settings" },
  { command: "/subagents-doctor", label: "Ask pi-subagents to diagnose the runtime" },
  { command: "/parallel-review", label: "Run fresh-context parallel reviewers" },
  { command: "/review-loop", label: "Run worker/reviewer/fix loop until capped or clean" },
  { command: "/beautiful-ui", label: "Run the Beautiful UI Mode scan, brief, browser QA, and patch loop" },
  { command: "/projects", label: "Open project workspaces and Git state" },
  { command: "/sessions", label: "Open session search" },
  { command: "/settings", label: "Open settings" }
];

function formatBytes(size?: number) {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function shortModelLabel(model?: string) {
  const raw = model || "gpt-5.5";
  return raw
    .replace(/^gpt-/i, "")
    .replace(/^openai\//i, "")
    .replace(/-codex.*$/i, "")
    .replace(/-mini$/i, " mini");
}

export default function Composer({ onSend, onCommand, onAbort, disabled, isStreaming, settings, models = [], extensionCommands = [], onSettingsChange, onAgentCommand, onOpenContextPanel }: ComposerProps) {
  const [text, setText] = useState("");
  const [tools, setTools] = useState({ web: false, advisor: false, context: true });
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showCommands, setShowCommands] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const addMenuRef = useRef<HTMLDivElement | null>(null);
  const permissionsRef = useRef<HTMLDivElement | null>(null);
  const modelRef = useRef<HTMLDivElement | null>(null);

  const filteredCommands = useMemo(() => {
    const dynamicCommands = extensionCommands.slice(0, 40).map((item) => ({
      command: `/${item.name}`,
      label: item.description || item.source || "Pi extension command"
    }));
    const allCommands = [...slashCommands, ...dynamicCommands];
    if (!text.startsWith("/")) return slashCommands;
    return allCommands.filter((item) => item.command.toLowerCase().startsWith(text.trim().toLowerCase()));
  }, [extensionCommands, text]);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.style.height = "0px";
    ref.current.style.height = `${Math.min(ref.current.scrollHeight, 130)}px`;
  }, [text]);

  useEffect(() => {
    setTools({
      web: Boolean(settings?.webEnabled),
      advisor: Boolean(settings?.advisorEnabled),
      context: settings?.contextEnabled !== false
    });
  }, [settings?.advisorEnabled, settings?.contextEnabled, settings?.webEnabled]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (addOpen && addMenuRef.current && !addMenuRef.current.contains(target)) setAddOpen(false);
      if (permissionsOpen && permissionsRef.current && !permissionsRef.current.contains(target)) setPermissionsOpen(false);
      if (modelOpen && modelRef.current && !modelRef.current.contains(target)) setModelOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [addOpen, modelOpen, permissionsOpen]);

  const toggleTool = (tool: "web" | "advisor" | "context") => {
    const next = !tools[tool];
    setTools((current) => ({ ...current, [tool]: next }));
    if (tool === "web") onSettingsChange({ webEnabled: next });
    if (tool === "advisor") onSettingsChange({ advisorEnabled: next });
    if (tool === "context") onSettingsChange({ contextEnabled: next });
  };

  const promptOptions = (): PromptOptions => ({
    ...tools,
    advisor: tools.advisor,
    accessMode: settings?.accessMode ?? "full",
    approvalPolicy: settings?.approvalPolicy ?? "on-request",
    autoReview: Boolean(settings?.autoReview),
    longRunningMode: Boolean(settings?.longRunningMode),
    autoLaunchAdvisor: Boolean(settings?.autoLaunchAdvisor),
    autoLaunchSubagents: Boolean(settings?.autoLaunchSubagents),
    subagentsEnabled: Boolean(settings?.subagentsEnabled),
    subagentRoutingMode: settings?.subagentRoutingMode ?? "automatic",
    subagentMaxParallel: settings?.subagentMaxParallel ?? 3
  });

  const pickFiles = async () => {
    const tauri = (window as any).__TAURI_INTERNALS__;
    if (tauri) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({ multiple: true });
        const paths = Array.isArray(selected) ? selected : selected ? [selected] : [];
        const previews = await Promise.all(paths.slice(0, 8).map(async (filePath) => {
          const pathString = String(filePath);
          const response = await fetch(apiUrl("/api/file-preview"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: pathString })
          }).catch(() => null);
          const data = response?.ok ? await response.json().catch(() => null) : null;
          return {
            id: crypto.randomUUID(),
            name: data?.name ?? pathString.split(/[\\/]/).pop() ?? "file",
            path: pathString,
            size: data?.size,
            kind: "file" as const,
            text: data?.text
          };
        }));
        setAttachments((current) => [...current, ...previews]);
        return;
      } catch {}
    }
    fileRef.current?.click();
  };

  const pickFolders = async () => {
    const tauri = (window as any).__TAURI_INTERNALS__;
    if (tauri) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({ multiple: true, directory: true });
        const paths = Array.isArray(selected) ? selected : selected ? [selected] : [];
        setAttachments((current) => [
          ...current,
          ...paths.map((folderPath) => {
            const pathString = String(folderPath);
            return {
              id: crypto.randomUUID(),
              name: pathString.split(/[\\/]/).pop() ?? pathString,
              path: pathString,
              kind: "file" as const,
              text: "Attached folder. Ask the agent to inspect files in this folder by path."
            };
          })
        ]);
        return;
      } catch {}
    }
    fileRef.current?.click();
  };

  const pasteClipboard = async () => {
    const response = await fetch(apiUrl("/api/clipboard/read?maxChars=120000")).catch(() => null);
    const data = response?.ok ? await response.json().catch(() => null) : null;
    if (!data?.ok || !data.text) return;
    setText((current) => current ? `${current}\n${data.text}` : data.text);
    ref.current?.focus();
  };

  const insertCommandDraft = (command: string) => {
    setText((current) => current.trim() ? current : `${command} `);
    window.requestAnimationFrame(() => ref.current?.focus());
  };

  const runCommand = (command: string) => {
    setShowCommands(false);
    if (command === "/attach") {
      void pickFiles();
      setText("");
      return;
    }
    if (!slashCommands.some((item) => item.command === command || command.startsWith(`${item.command} `))) {
      onSend(command, attachments, promptOptions());
      setAttachments([]);
      setText("");
      return;
    }
    onCommand(command);
    setText("");
  };

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    const exactCommand = slashCommands.find((item) => item.command === trimmed || trimmed.startsWith(`${item.command} `));
    if (exactCommand) {
      runCommand(trimmed);
      return;
    }
    onSend(trimmed, attachments, promptOptions());
    setText("");
    setAttachments([]);
    setShowCommands(false);
  };

  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
    if (event.key === "Escape") setShowCommands(false);
  };

  return (
    <section className={`composer ${isStreaming ? "streaming" : ""}`}>
      {showCommands ? (
        <div className="command-palette">
          {filteredCommands.map((item) => (
            <button key={item.command} onClick={() => runCommand(item.command)}>
              <strong>{item.command}</strong><span>{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
      {attachments.length ? (
        <div className="attachment-row">
          {attachments.map((file) => (
            <button key={file.id} onClick={() => setAttachments((items) => items.filter((item) => item.id !== file.id))} title={file.path ?? file.name}>
              <Icon name="file" size={14} />
              <span>{file.name}</span>
              <em>{formatBytes(file.size)}</em>
              <Icon name="x" size={12} />
            </button>
          ))}
        </div>
      ) : null}
      <textarea
        ref={ref}
        value={text}
        placeholder={isStreaming ? "Steer while it is working..." : "Ask anything..."}
        onChange={(event) => {
          setText(event.target.value);
          setShowCommands(event.target.value.startsWith("/"));
        }}
        onKeyDown={keyDown}
        rows={1}
      />
      <div className="composer-actions">
        <div className="pill-menu-wrap add-menu-wrap" ref={addMenuRef}>
          <button className="round-button" onClick={() => setAddOpen((current) => !current)} aria-label="add tools and files" title="Add tools and files">
            <Icon name="plus" />
          </button>
          {addOpen ? (
            <div className="pill-menu add-menu">
              <button onClick={() => { void pickFiles(); setAddOpen(false); }}><Icon name="paperclip" size={13} /> Add files</button>
              <button onClick={() => { void pickFolders(); setAddOpen(false); }}><Icon name="folder" size={13} /> Add folders</button>
              <button onClick={() => { void pasteClipboard(); setAddOpen(false); }}><Icon name="clipboard" size={13} /> Paste clipboard</button>
              <button onClick={() => { insertCommandDraft("/beautiful-ui"); setAddOpen(false); }}><Icon name="layout" size={13} /> Beautiful UI mode</button>
              <button onClick={() => toggleTool("web")}><Icon name={tools.web ? "check" : "search"} size={13} /> Web guidance</button>
              <button onClick={() => toggleTool("advisor")}><Icon name={tools.advisor ? "check" : "spark"} size={13} /> Pi Advisor</button>
              <button onClick={() => { runCommand("/advisor ask"); setAddOpen(false); }}><Icon name="shield" size={13} /> Ask advisor now</button>
              <button onClick={() => { onSettingsChange({ subagentsEnabled: !settings?.subagentsEnabled, autoLaunchSubagents: !settings?.subagentsEnabled }); setAddOpen(false); }}><Icon name={settings?.subagentsEnabled ? "check" : "plug"} size={13} /> Pi subagents</button>
              <button onClick={() => { onSettingsChange({ autoLaunchSubagents: !settings?.autoLaunchSubagents, subagentRoutingMode: settings?.autoLaunchSubagents ? "manual" : "automatic", subagentsEnabled: true }); setAddOpen(false); }}><Icon name={settings?.autoLaunchSubagents ? "check" : "spark"} size={13} /> Auto delegation</button>
              <button onClick={() => { runCommand("/subagents-doctor"); setAddOpen(false); }}><Icon name="terminal" size={13} /> Subagents doctor</button>
              <button onClick={() => { onOpenContextPanel(); setAddOpen(false); }}><Icon name="folder" size={13} /> Workspace context</button>
              <button onClick={() => toggleTool("context")}><Icon name={tools.context ? "check" : "circle"} size={13} /> {tools.context ? "Context on" : "Context off"}</button>
              {extensionCommands.length ? <strong className="menu-heading">Extensions</strong> : null}
              {extensionCommands.slice(0, 8).map((command) => (
                <button key={command.name} onClick={() => { runCommand(`/${command.name}`); setAddOpen(false); }}>
                  <Icon name="plug" size={13} /> /{command.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="tool-pills">
          <div className="pill-menu-wrap" ref={permissionsRef}>
            <button className="access-pill enabled" onClick={() => setPermissionsOpen((current) => !current)}>
              <Icon name="shield" size={13} />
              {settings?.accessMode === "full" ? "Full access" : settings?.accessMode === "read-only" ? "Read only" : "Limited"}
              <Icon name="chevronDown" size={12} />
            </button>
            {permissionsOpen ? (
              <div className="pill-menu">
                {(["full", "limited", "read-only"] as const).map((mode) => (
                  <button key={mode} onClick={() => { onSettingsChange({ accessMode: mode }); setPermissionsOpen(false); }}>
                    <Icon name={settings?.accessMode === mode ? "check" : "circle"} size={13} />
                    {mode === "full" ? "Full access" : mode === "limited" ? "Limited tools" : "Read only"}
                  </button>
                ))}
                <button onClick={() => onSettingsChange({ autoReview: !settings?.autoReview })}>
                  <Icon name={settings?.autoReview ? "check" : "circle"} size={13} />
                  Automatic review
                </button>
                <button onClick={() => onSettingsChange({ approvalPolicy: settings?.approvalPolicy === "never" ? "on-request" : "never" })}>
                  <Icon name="shield" size={13} />
                  Approval: {settings?.approvalPolicy ?? "on-request"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <div className="composer-meta">
          <div className="pill-menu-wrap" ref={modelRef}>
            <button className="model-pill" onClick={() => setModelOpen((current) => !current)}>
              {shortModelLabel(settings?.modelLabel)} {settings?.thinkingLevel === "off" ? "Direct mode" : "Thinking mode"} <Icon name="chevronDown" size={12} />
            </button>
            {modelOpen ? (
              <div className="pill-menu model-menu">
                {models.map((provider) => (
                  <div key={provider.id} className="model-group">
                    <strong>{provider.name}</strong>
                    {provider.models.map((model) => (
                      <button key={`${provider.id}/${model.id}`} onClick={() => {
                        onSettingsChange({ provider: provider.id as AppSettings["provider"], modelLabel: model.id });
                        void onAgentCommand({ type: "set_model", provider: provider.id, modelId: model.id });
                        setModelOpen(false);
                      }}>
                        <Icon name={settings?.provider === provider.id && settings?.modelLabel === model.id ? "check" : "circle"} size={13} />
                        <span>{model.name ?? model.id}</span>
                        {model.reasoning ? <em>thinking</em> : null}
                      </button>
                    ))}
                  </div>
                ))}
                <div className="model-group">
                  <strong>Thinking</strong>
                  {(["off", "minimal", "low", "medium", "high", "xhigh"] as const).map((level) => (
                    <button key={level} onClick={() => {
                      onSettingsChange({ thinkingLevel: level });
                      void onAgentCommand({ type: "set_thinking_level", level });
                    }}>
                      <Icon name={settings?.thinkingLevel === level ? "check" : "circle"} size={13} />
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          {isStreaming ? (
            <button className="round-button stop" onClick={onAbort} aria-label="stop generation" title="Stop">
              <Icon name="stop" />
            </button>
          ) : null}
          <button className="send-button" onClick={submit} disabled={!text.trim() || disabled} aria-label="send" title={isStreaming ? "Steer" : "Send"}>
            <Icon name="arrowUp" size={15} />
          </button>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        multiple
        hidden
        onChange={async (event) => {
          const files = Array.from(event.target.files ?? []).slice(0, 8);
          const next = await Promise.all(files.map(async (file) => ({
            id: crypto.randomUUID(),
            name: file.name,
            size: file.size,
            kind: file.type.startsWith("image/") ? "image" as const : "file" as const,
            text: file.size <= 512_000 && !file.type.startsWith("image/") ? await file.text().catch(() => "") : undefined
          })));
          setAttachments((current) => [...current, ...next]);
          event.target.value = "";
        }}
      />
    </section>
  );
}
