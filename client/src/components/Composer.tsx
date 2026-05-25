import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { AppSettings } from "../App";
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
  models?: Array<{ id: string; name: string; models: string[] }>;
  extensionCommands?: Array<{ name: string; description?: string; source?: string }>;
  onSettingsChange: (patch: Partial<AppSettings>) => void;
  onAgentCommand: (cmd: Record<string, unknown>) => Promise<any>;
}

const slashCommands = [
  { command: "/help", label: "Show available PiAgent commands" },
  { command: "/new", label: "Start a new thread" },
  { command: "/compact", label: "Ask Pi to compact the active context" },
  { command: "/permissions", label: "Open permissions and access mode" },
  { command: "/attach", label: "Attach files to the next message" },
  { command: "/sessions", label: "Open session search" },
  { command: "/settings", label: "Open settings" }
];

function formatBytes(size?: number) {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export default function Composer({ onSend, onCommand, onAbort, disabled, isStreaming, settings, models = [], extensionCommands = [], onSettingsChange, onAgentCommand }: ComposerProps) {
  const [text, setText] = useState("");
  const [tools, setTools] = useState({ web: false, advisor: false, context: true });
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showCommands, setShowCommands] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

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

  const runCommand = (command: string) => {
    setShowCommands(false);
    if (command === "/attach") {
      void pickFiles();
      setText("");
      return;
    }
    if (!slashCommands.some((item) => item.command === command)) {
      onSend(command, attachments, tools);
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
    const exactCommand = slashCommands.find((item) => item.command === trimmed);
    if (exactCommand) {
      runCommand(exactCommand.command);
      return;
    }
    onSend(trimmed, attachments, tools);
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
        placeholder={isStreaming ? "Steer Pi while it is working..." : "Ask PiAgent to inspect, edit, run, or explain..."}
        onChange={(event) => {
          setText(event.target.value);
          setShowCommands(event.target.value.startsWith("/"));
        }}
        onKeyDown={keyDown}
        rows={1}
      />
      <div className="composer-actions">
        <button className="round-button" onClick={pickFiles} aria-label="attach file" title="Attach file">
          <Icon name="paperclip" />
        </button>
        <div className="tool-pills">
          <div className="pill-menu-wrap">
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
          {(["web", "advisor", "context"] as const).map((tool) => (
            <button
              key={tool}
              className={tools[tool] ? "enabled" : ""}
              onClick={() => setTools((current) => ({ ...current, [tool]: !current[tool] }))}
              title={`Toggle ${tool}`}
            >
              <Icon name={tool === "web" ? "search" : tool === "advisor" ? "spark" : "folder"} size={13} />
              {tool}
            </button>
          ))}
        </div>
        <div className="composer-meta">
          <div className="pill-menu-wrap">
            <button className="model-pill" onClick={() => setModelOpen((current) => !current)}>
              {settings?.modelLabel ?? "gpt-5.5"} <Icon name="chevronDown" size={12} />
            </button>
            {modelOpen ? (
              <div className="pill-menu model-menu">
                {models.map((provider) => (
                  <div key={provider.id} className="model-group">
                    <strong>{provider.name}</strong>
                    {provider.models.map((model) => (
                      <button key={`${provider.id}/${model}`} onClick={() => {
                        onSettingsChange({ provider: provider.id as AppSettings["provider"], modelLabel: model });
                        void onAgentCommand({ type: "set_model", provider: provider.id, modelId: model });
                        setModelOpen(false);
                      }}>
                        <Icon name={settings?.provider === provider.id && settings?.modelLabel === model ? "check" : "circle"} size={13} />
                        {model}
                      </button>
                    ))}
                  </div>
                ))}
                <div className="model-group">
                  <strong>Thinking</strong>
                  {(["low", "medium", "high"] as const).map((level) => (
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
