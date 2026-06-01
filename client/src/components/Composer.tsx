import { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AppSettings, ProviderOption } from "../App";
import { Attachment, PromptOptions } from "../hooks/useAgent";
import { apiUrl } from "../lib/api";
import Icon from "./Icon";

interface ComposerProps {
  onSend: (text: string, attachments?: Attachment[], options?: PromptOptions) => boolean | void | Promise<boolean | void>;
  onCommand: (command: string) => void;
  onAbort: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  isAgentBusy?: boolean;
  queuedCount?: number;
  settings?: AppSettings;
  models?: ProviderOption[];
  extensionCommands?: Array<{ name: string; description?: string; source?: string }>;
  onSettingsChange: (patch: Partial<AppSettings>) => void;
  onOpenContextPanel: () => void;
}

const slashCommands = [
  { command: "/help", label: "Show available commands" },
  { command: "/new", label: "Start a new thread" },
  { command: "/compact", label: "Ask Pi to compact the active context" },
  { command: "/permissions", label: "Open permissions and access mode" },
  { command: "/capabilities", label: "Open the Capability Doctor" },
  { command: "/attach", label: "Attach files to the next message" },
  { command: "/advisor ask", label: "Consult the real pi-advisor extension now" },
  { command: "/advisor on", label: "Enable the real pi-advisor extension" },
  { command: "/advisor off", label: "Disable the real pi-advisor extension" },
  { command: "/subagents", label: "Open automatic subagent delegation settings" },
  { command: "/subagents-doctor", label: "Ask pi-subagents to diagnose the runtime" },
  { command: "/parallel-review", label: "Run fresh-context parallel reviewers" },
  { command: "/review-loop", label: "Run worker/reviewer/fix loop until capped or clean" },
  { command: "/beautiful-ui", label: "Run the Beautiful UI Mode scan, brief, browser QA, and patch loop" },
  { command: "/open ", label: "Open a safe http/https URL" },
  { command: "/screenshot ", label: "Capture a localhost screenshot artifact" },
  { command: "/image ", label: "Generate an image in this chat" },
  { command: "/projects", label: "Open project workspaces and Git state" },
  { command: "/sessions", label: "Open session search" },
  { command: "/settings", label: "Open settings" }
];

type ComposerMenuKey = "add" | "permissions" | "model";

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

function thinkingModeLabel(level?: AppSettings["thinkingLevel"]) {
  if (!level || level === "high" || level === "xhigh") return "High";
  if (level === "off") return "Direct mode";
  if (level === "minimal") return "Minimal";
  return `${level[0].toUpperCase()}${level.slice(1)}`;
}

export default function Composer({ onSend, onCommand, onAbort, disabled, isStreaming, isAgentBusy, queuedCount = 0, settings, models = [], extensionCommands = [], onSettingsChange, onOpenContextPanel }: ComposerProps) {
  const [text, setText] = useState("");
  const [tools, setTools] = useState({ web: false, advisor: false, context: true });
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showCommands, setShowCommands] = useState(false);
  const [steeringMode, setSteeringMode] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const addMenuRef = useRef<HTMLDivElement | null>(null);
  const permissionsRef = useRef<HTMLDivElement | null>(null);
  const modelRef = useRef<HTMLDivElement | null>(null);
  const addPortalRef = useRef<HTMLDivElement | null>(null);
  const permissionsPortalRef = useRef<HTMLDivElement | null>(null);
  const modelPortalRef = useRef<HTMLDivElement | null>(null);
  const attachmentsRef = useRef<Attachment[]>([]);
  const pendingDraftRef = useRef<{ clientPromptId: string; text: string; attachmentSignature: string } | null>(null);
  const [menuStyles, setMenuStyles] = useState<Record<ComposerMenuKey, CSSProperties>>({
    add: {},
    permissions: {},
    model: {}
  });

  const attachmentSignature = (items: Attachment[]) => items.map((item) => `${item.id}:${item.name}:${item.size ?? 0}`).join("|");

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
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    if (!isStreaming) setSteeringMode(false);
  }, [isStreaming]);

  const canSteer = Boolean(isStreaming && steeringMode);
  const queueMode = Boolean(isAgentBusy && !canSteer);

  useEffect(() => {
    const onLateAccepted = (event: Event) => {
      const detail = (event as CustomEvent<{ clientPromptId?: string; text?: string }>).detail;
      const acceptedText = detail?.text?.trim();
      const pendingDraft = pendingDraftRef.current;
      if (!acceptedText || !pendingDraft || detail?.clientPromptId !== pendingDraft.clientPromptId) return;
      if (ref.current?.value.trim() === pendingDraft.text && attachmentSignature(attachmentsRef.current) === pendingDraft.attachmentSignature) {
        setText("");
        setAttachments([]);
        pendingDraftRef.current = null;
      }
    };
    window.addEventListener("piagent:prompt-accepted", onLateAccepted);
    return () => window.removeEventListener("piagent:prompt-accepted", onLateAccepted);
  }, []);

  const syncMenuPosition = useCallback((menu: ComposerMenuKey) => {
    const anchor = menu === "add" ? addMenuRef.current : menu === "permissions" ? permissionsRef.current : modelRef.current;
    const rect = anchor?.getBoundingClientRect();
    if (!rect) return;
    const edge = 12;
    const gap = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const preferredWidth = menu === "add" ? 316 : menu === "model" ? 300 : 238;
    const menuWidth = Math.min(preferredWidth, Math.max(220, viewportWidth - edge * 2));
    const preferredLeft = menu === "model" ? rect.right - menuWidth : rect.left + (rect.width / 2) - (menuWidth / 2);
    const left = Math.min(Math.max(edge, preferredLeft), Math.max(edge, viewportWidth - menuWidth - edge));
    const spaceAbove = rect.top - gap - edge;
    const spaceBelow = viewportHeight - rect.bottom - gap - edge;
    const openUp = spaceAbove > spaceBelow;
    const availableHeight = Math.max(120, openUp ? spaceAbove : spaceBelow);
    const limitHeight = Math.min(menu === "add" ? 560 : menu === "model" ? 420 : 300, availableHeight);
    const menuNode = menu === "add" ? addPortalRef.current : menu === "permissions" ? permissionsPortalRef.current : modelPortalRef.current;
    const measuredHeight = menuNode ? Math.ceil(Math.min(menuNode.scrollHeight || limitHeight, limitHeight)) : Math.min(limitHeight, menu === "permissions" ? 164 : 300);
    const desiredTop = openUp ? rect.top - gap - measuredHeight : rect.bottom + gap;
    const top = Math.min(Math.max(edge, desiredTop), Math.max(edge, viewportHeight - measuredHeight - edge));
    const anchorX = Math.min(Math.max(rect.left + (rect.width / 2) - left, 16), menuWidth - 16);
    setMenuStyles((current) => ({
      ...current,
      [menu]: {
        position: "fixed",
        left,
        top,
        right: "auto",
        bottom: "auto",
        width: menuWidth,
        maxHeight: limitHeight,
        overflowY: "auto",
        transformOrigin: `${anchorX}px ${openUp ? "bottom" : "top"}`,
        "--menu-anchor-x": `${anchorX}px`,
        "--menu-arrow-top": openUp ? "auto" : "-5px",
        "--menu-arrow-bottom": openUp ? "-5px" : "auto",
        "--menu-arrow-rotate": openUp ? "45deg" : "225deg"
      } as CSSProperties
    }));
  }, []);

  const syncOpenMenus = useCallback(() => {
    if (addOpen) syncMenuPosition("add");
    if (permissionsOpen) syncMenuPosition("permissions");
    if (modelOpen) syncMenuPosition("model");
  }, [addOpen, modelOpen, permissionsOpen, syncMenuPosition]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (addOpen && addMenuRef.current && addPortalRef.current && !addMenuRef.current.contains(target) && !addPortalRef.current.contains(target)) setAddOpen(false);
      if (permissionsOpen && permissionsRef.current && permissionsPortalRef.current && !permissionsRef.current.contains(target) && !permissionsPortalRef.current.contains(target)) setPermissionsOpen(false);
      if (modelOpen && modelRef.current && modelPortalRef.current && !modelRef.current.contains(target) && !modelPortalRef.current.contains(target)) setModelOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setAddOpen(false);
      setPermissionsOpen(false);
      setModelOpen(false);
    };
    syncOpenMenus();
    window.addEventListener("resize", syncOpenMenus);
    window.addEventListener("scroll", syncOpenMenus, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("resize", syncOpenMenus);
      window.removeEventListener("scroll", syncOpenMenus, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [addOpen, modelOpen, permissionsOpen, syncOpenMenus]);

  const portalTarget = typeof document === "undefined" ? null : document.querySelector(".app-shell") ?? document.body;

  const renderMenu = (menu: ComposerMenuKey, className: string, ref: RefObject<HTMLDivElement | null>, children: ReactNode) => (
    portalTarget ? createPortal(
      <div ref={ref} className={className} style={menuStyles[menu]}>
        {children}
      </div>,
      portalTarget
    ) : null
  );

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

  const runCommand = async (command: string) => {
    setShowCommands(false);
    if (command === "/attach") {
      void pickFiles();
      setText("");
      return;
    }
    if (!slashCommands.some((item) => item.command === command || command.startsWith(`${item.command} `))) {
      setSubmitting(true);
      try {
        const clientPromptId = crypto.randomUUID();
        pendingDraftRef.current = { clientPromptId, text: command.trim(), attachmentSignature: attachmentSignature(attachments) };
        const accepted = await onSend(command, attachments, { ...promptOptions(), clientPromptId, steering: canSteer });
        if (accepted !== false) {
          setAttachments([]);
          setText("");
          pendingDraftRef.current = null;
        }
      } finally {
        setSubmitting(false);
      }
      return;
    }
    onCommand(command);
    setText("");
  };

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || disabled || submitting) return;
    const exactCommand = slashCommands.find((item) => item.command === trimmed || trimmed.startsWith(`${item.command} `));
    if (exactCommand) {
      await runCommand(trimmed);
      return;
    }
    setSubmitting(true);
    try {
      const clientPromptId = crypto.randomUUID();
      pendingDraftRef.current = { clientPromptId, text: trimmed, attachmentSignature: attachmentSignature(attachments) };
      const accepted = await onSend(trimmed, attachments, { ...promptOptions(), clientPromptId, steering: canSteer });
      if (accepted !== false) {
        setText("");
        setAttachments([]);
        setShowCommands(false);
        pendingDraftRef.current = null;
      }
    } finally {
      setSubmitting(false);
    }
  };

  const keyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
    if (event.key === "Escape") setShowCommands(false);
  };

  return (
    <section className={`composer ${isStreaming ? "streaming" : ""} ${queueMode ? "queue-mode" : ""} ${canSteer ? "steer-mode" : ""}`}>
      {showCommands ? (
        <div className="command-palette">
          {filteredCommands.map((item) => (
            <button key={item.command} onClick={() => void runCommand(item.command)}>
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
        placeholder={canSteer ? "Steer the current run..." : queueMode ? "Queue the next prompt..." : "Ask anything..."}
        disabled={disabled || submitting}
        onChange={(event) => {
          setText(event.target.value);
          setShowCommands(event.target.value.startsWith("/"));
        }}
        onKeyDown={keyDown}
        rows={1}
      />
      <div className="composer-actions">
        <div className="pill-menu-wrap add-menu-wrap" ref={addMenuRef}>
          <button className="round-button" onClick={() => {
            setAddOpen((current) => {
              const next = !current;
              if (next) {
                setPermissionsOpen(false);
                setModelOpen(false);
              }
              return next;
            });
            window.requestAnimationFrame(() => syncMenuPosition("add"));
          }} aria-label="add tools and files" title="Add tools and files">
            <Icon name="plus" />
          </button>
          {addOpen ? renderMenu("add", "pill-menu add-menu", addPortalRef, (
            <>
              <strong className="menu-heading">Files</strong>
              <button onClick={() => { void pickFiles(); setAddOpen(false); }}><Icon name="paperclip" size={13} /> Add files</button>
              <button onClick={() => { void pickFolders(); setAddOpen(false); }}><Icon name="folder" size={13} /> Add folders</button>
              <button onClick={() => { void pasteClipboard(); setAddOpen(false); }}><Icon name="clipboard" size={13} /> Paste clipboard</button>
              <strong className="menu-heading">Agent context</strong>
              <button className={tools.web ? "active" : ""} onClick={() => toggleTool("web")}><Icon name={tools.web ? "check" : "search"} size={13} /> Web guidance</button>
              <button className={tools.context ? "active" : ""} onClick={() => toggleTool("context")}><Icon name={tools.context ? "check" : "circle"} size={13} /> {tools.context ? "Workspace context on" : "Workspace context off"}</button>
              <button onClick={() => { onOpenContextPanel(); setAddOpen(false); }}><Icon name="folder" size={13} /> Open context drawer</button>
              <strong className="menu-heading">Review and agents</strong>
              <button className={tools.advisor ? "active" : ""} onClick={() => toggleTool("advisor")}><Icon name={tools.advisor ? "check" : "spark"} size={13} /> Pi Advisor</button>
              <button className={settings?.subagentsEnabled ? "active" : ""} onClick={() => { onSettingsChange({ subagentsEnabled: !settings?.subagentsEnabled, autoLaunchSubagents: !settings?.subagentsEnabled }); }}>
                <Icon name={settings?.subagentsEnabled ? "check" : "plug"} size={13} /> Pi subagents
              </button>
              <button className={settings?.autoLaunchSubagents ? "active" : ""} onClick={() => { onSettingsChange({ autoLaunchSubagents: !settings?.autoLaunchSubagents, subagentRoutingMode: settings?.autoLaunchSubagents ? "manual" : "automatic", subagentsEnabled: true }); }}>
                <Icon name={settings?.autoLaunchSubagents ? "check" : "spark"} size={13} /> Auto delegation
              </button>
              <strong className="menu-heading">Workflows</strong>
              <button onClick={() => { insertCommandDraft("/image "); setAddOpen(false); }}><Icon name="spark" size={13} /> Generate image</button>
              <button onClick={() => { insertCommandDraft("/beautiful-ui"); setAddOpen(false); }}><Icon name="layout" size={13} /> Beautiful UI mode</button>
            </>
          )) : null}
        </div>
        <div className="tool-pills">
          <div className="pill-menu-wrap" ref={permissionsRef}>
            <button className="access-pill enabled" onClick={() => {
              setPermissionsOpen((current) => {
                const next = !current;
                if (next) {
                  setAddOpen(false);
                  setModelOpen(false);
                }
                return next;
              });
              window.requestAnimationFrame(() => syncMenuPosition("permissions"));
            }}>
              <Icon name="shield" size={13} />
              {settings?.accessMode === "full" ? "Full access" : settings?.accessMode === "read-only" ? "Read only" : "Limited"}
              <Icon name="chevronDown" size={12} />
            </button>
            {permissionsOpen ? renderMenu("permissions", "pill-menu permissions-menu", permissionsPortalRef, (
              <>
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
              </>
            )) : null}
          </div>
        </div>
        <div className="composer-meta">
          {isAgentBusy ? (
            <button
              className={`steer-toggle ${canSteer ? "active" : ""}`}
              onClick={() => setSteeringMode((current) => !current)}
              disabled={!isStreaming}
              type="button"
              title={isStreaming ? "Send immediately as steering" : "Steering is only available in the running chat"}
            >
              <Icon name={canSteer ? "check" : "spark"} size={12} />
              {canSteer ? "Steer" : queuedCount ? `Queue ${queuedCount}` : "Queue"}
            </button>
          ) : queuedCount ? <span className="queue-count">Queue {queuedCount}</span> : null}
          <div className="pill-menu-wrap" ref={modelRef}>
            <button className="model-pill" onClick={() => {
              setModelOpen((current) => {
                const next = !current;
                if (next) {
                  setAddOpen(false);
                  setPermissionsOpen(false);
                }
                return next;
              });
              window.requestAnimationFrame(() => syncMenuPosition("model"));
            }}>
              {shortModelLabel(settings?.modelLabel)} {thinkingModeLabel(settings?.thinkingLevel)} <Icon name="chevronDown" size={12} />
            </button>
            {modelOpen ? renderMenu("model", "pill-menu model-menu", modelPortalRef, (
              <>
                {models.map((provider) => (
                  <div key={provider.id} className="model-group">
                    <strong>{provider.name}</strong>
                    {provider.models.map((model) => (
                      <button key={`${provider.id}/${model.id}`} onClick={() => {
                        onSettingsChange({ provider: provider.id as AppSettings["provider"], modelLabel: model.id });
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
                    }}>
                      <Icon name={settings?.thinkingLevel === level ? "check" : "circle"} size={13} />
                      {level}
                    </button>
                  ))}
                </div>
              </>
            )) : null}
          </div>
          {isStreaming ? (
            <button className="round-button stop" onClick={onAbort} aria-label="stop generation" title="Stop">
              <Icon name="stop" />
            </button>
          ) : null}
          <button className="send-button" onClick={() => void submit()} disabled={!text.trim() || disabled || submitting} aria-label="send" title={canSteer ? "Steer" : queueMode ? "Queue" : "Send"}>
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
