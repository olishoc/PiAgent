import { CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AppSettings, ProviderOption } from "../App";
import { apiUrl } from "../lib/api";
import { checkAndInstallUpdate, UpdateStatus } from "../lib/updater";
import Icon, { IconName } from "./Icon";

const nav: Array<{ id: string; label: string; icon: IconName }> = [
  { id: "General", label: "General", icon: "gear" },
  { id: "Apparence", label: "Apparence", icon: "spark" },
  { id: "Connexions", label: "Connexions", icon: "link" },
  { id: "Remote", label: "Remote", icon: "link" },
  { id: "Configuration", label: "Configuration", icon: "shield" },
  { id: "Modeles", label: "Modeles", icon: "terminal" },
  { id: "Sous-agents", label: "Sous-agents", icon: "plug" },
  { id: "Projets", label: "Projets", icon: "folder" },
  { id: "Memoire", label: "Memoire", icon: "spark" },
  { id: "Raccourcis", label: "Raccourcis", icon: "terminal" },
  { id: "Extensions", label: "Extensions", icon: "plug" },
  { id: "Git", label: "Git", icon: "link" }
];

interface SettingsViewProps {
  settings: AppSettings;
  models: ProviderOption[];
  initialActive?: string;
  onBack: () => void;
  onChange: (patch: Partial<AppSettings>) => void;
}

interface ProviderAuthState {
  provider: string;
  configured: boolean;
  type?: string | null;
  source?: string | null;
  envVar?: string;
  writable?: boolean;
}

type CapabilityStatus = "ready" | "configured" | "partial" | "missing" | "external" | "unsafe-by-default" | "backlog";

interface CapabilityCheck {
  label: string;
  ok: boolean;
  detail?: string;
}

interface CapabilityItem {
  id: string;
  label: string;
  category: string;
  status: CapabilityStatus;
  configured: boolean;
  available: boolean;
  ready: boolean;
  risk: "low" | "medium" | "high";
  summary: string;
  dependencies: string[];
  evidence: string[];
  nextAction: string;
  checks: CapabilityCheck[];
}

interface CapabilityReport {
  ok: boolean;
  generatedAt: string;
  readOnly: boolean;
  note: string;
  summary: {
    total: number;
    counts: Record<CapabilityStatus, number>;
    ready: number;
    risky: string[];
    missing: string[];
  };
  settings: {
    provider: string;
    model: string;
    accessMode: string;
    approvalPolicy: string;
    workspaceConfigured: boolean;
    memoryMode: string;
    subagentRoutingMode: string;
  };
  capabilities: CapabilityItem[];
}

type RunStatus = "starting" | "running" | "completed" | "failed" | "stopped" | "aborted" | "rejected";

interface RunSummary {
  id: string;
  sessionId: string | null;
  projectId: string | null;
  requestId?: string;
  status: RunStatus;
  promptPreview?: string;
  startedAt: string;
  updatedAt: string;
  finishedAt?: string;
  eventCount: number;
  lastEventType?: string;
  lastError?: string;
}

interface RunsReport {
  ok: boolean;
  readOnly: boolean;
  counts: {
    total: number;
    active: number;
    failed: number;
  };
  runs: RunSummary[];
}

interface RemoteAccessStatus {
  ok: boolean;
  enabled: boolean;
  connected: boolean;
  relayUrl: string;
  desktopId: string;
  desktopName: string;
  mode: "off" | "safe-chat" | "full-agent";
  safeMode: boolean;
  protocolVersion: string;
  lastError?: string;
  lastEventAt?: string;
  pendingApprovals: Array<{ approvalId: string; deviceName: string; createdAt: string; expiresAt: string }>;
  devices: Array<{ id: string; name: string; createdAt: string; lastActiveAt: string; expiresAt: string; connected?: boolean }>;
  auditEvents: Array<{ id: string; type: string; at: string; deviceId?: string; deviceName?: string; reason?: string }>;
  currentPairing?: { pairId: string; pairUrl: string; qrSvg: string; expiresAt: string } | null;
}

async function openTarget(target: string) {
  const response = await fetch(apiUrl("/api/open-path"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target })
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error ?? `Unable to open ${target}`);
  return data.path as string;
}

interface SettingSelectOption<T extends string> {
  value: T;
  label: string;
  note?: string;
}

function SettingSelect<T extends string>({ value, options, onChange, disabled, title }: {
  value: T;
  options: Array<SettingSelectOption<T>>;
  onChange: (value: T) => void;
  disabled?: boolean;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];
  const syncMenuPosition = useCallback(() => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const gap = 8;
    const edge = 12;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuWidth = Math.min(Math.max(rect.width, 220), Math.max(220, viewportWidth - edge * 2));
    const left = Math.min(Math.max(edge, rect.left), Math.max(edge, viewportWidth - menuWidth - edge));
    const spaceBelow = viewportHeight - rect.bottom - gap - edge;
    const spaceAbove = rect.top - gap - edge;
    const openUp = spaceAbove > spaceBelow;
    const availableHeight = Math.max(120, openUp ? spaceAbove : spaceBelow);
    const maxHeight = Math.min(360, availableHeight);
    const measuredHeight = menuRef.current ? Math.ceil(Math.min(menuRef.current.scrollHeight || maxHeight, maxHeight)) : Math.min(maxHeight, 220);
    const desiredTop = openUp ? rect.top - gap - measuredHeight : rect.bottom + gap;
    const top = Math.min(Math.max(edge, desiredTop), Math.max(edge, viewportHeight - measuredHeight - edge));
    const anchorX = Math.min(Math.max(rect.left + (rect.width / 2) - left, 16), menuWidth - 16);
    setMenuStyle({
      position: "fixed",
      left,
      top,
      right: "auto",
      bottom: "auto",
      width: menuWidth,
      maxHeight,
      overflowY: "auto",
      transformOrigin: `${anchorX}px ${openUp ? "bottom" : "top"}`,
      "--menu-anchor-x": `${anchorX}px`,
      "--menu-arrow-top": openUp ? "auto" : "-5px",
      "--menu-arrow-bottom": openUp ? "-5px" : "auto",
      "--menu-arrow-rotate": openUp ? "45deg" : "225deg"
    } as CSSProperties);
  }, []);
  useEffect(() => {
    if (!open) return;
    syncMenuPosition();
    const closeOnPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("resize", syncMenuPosition);
    window.addEventListener("scroll", syncMenuPosition, true);
    document.addEventListener("pointerdown", closeOnPointerDown, true);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("resize", syncMenuPosition);
      window.removeEventListener("scroll", syncMenuPosition, true);
      document.removeEventListener("pointerdown", closeOnPointerDown, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, syncMenuPosition]);
  const menu = open && !disabled ? (
    <div ref={menuRef} className="setting-select-menu" role="listbox" style={menuStyle}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={option.value === value ? "active" : ""}
          role="option"
          aria-selected={option.value === value}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            onChange(option.value);
            setOpen(false);
          }}
        >
          <Icon name={option.value === value ? "check" : "circle"} size={13} />
          <span>{option.label}</span>
          {option.note ? <em>{option.note}</em> : null}
        </button>
      ))}
    </div>
  ) : null;
  const portalTarget = typeof document === "undefined" ? null : document.querySelector(".app-shell") ?? document.body;
  return (
    <div ref={rootRef} className={`setting-select ${open ? "open" : ""} ${disabled ? "disabled" : ""}`}>
      <button type="button" disabled={disabled} title={title} onClick={() => {
        setOpen((current) => !current);
        window.requestAnimationFrame(syncMenuPosition);
      }}>
        <span>{selected?.label ?? value}</span>
        {selected?.note ? <em>{selected.note}</em> : null}
        <Icon name="chevronDown" size={13} />
      </button>
      {menu && portalTarget ? createPortal(menu, portalTarget) : null}
    </div>
  );
}

const onOffOptions: Array<SettingSelectOption<"on" | "off">> = [
  { value: "on", label: "Active" },
  { value: "off", label: "Desactive" }
];

const thinkingOptions: Array<SettingSelectOption<AppSettings["thinkingLevel"]>> = [
  { value: "high", label: "High", note: "deep" },
  { value: "xhigh", label: "High+", note: "max" },
  { value: "medium", label: "Medium", note: "balanced" },
  { value: "low", label: "Low" },
  { value: "minimal", label: "Minimal" },
  { value: "off", label: "Direct mode" }
];

const reasoningOptions: Array<SettingSelectOption<AppSettings["advisorReasoning"]>> = [
  { value: "high", label: "High", note: "deep" },
  { value: "xhigh", label: "High+", note: "max" },
  { value: "medium", label: "Medium", note: "balanced" },
  { value: "low", label: "Low" },
  { value: "minimal", label: "Minimal" }
];

const fallbackProviderOptions: Array<SettingSelectOption<string>> = [
  { value: "openai-codex", label: "OpenAI Codex OAuth", note: "recommended" },
  { value: "openai", label: "OpenAI API" },
  { value: "anthropic", label: "Claude" },
  { value: "openrouter", label: "OpenRouter" }
];

const providerConnectionPages = [
  {
    id: "openai",
    label: "OpenAI API",
    eyebrow: "OPENAI_API_KEY",
    placeholder: "sk-...",
    description: "Use OpenAI API billing directly through Pi's auth file."
  },
  {
    id: "anthropic",
    label: "Claude / Anthropic",
    eyebrow: "ANTHROPIC_API_KEY",
    placeholder: "sk-ant-...",
    description: "Connect Claude API models with an Anthropic API key."
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    eyebrow: "OPENROUTER_API_KEY",
    placeholder: "sk-or-v1-...",
    description: "Route OpenRouter models through Pi's OpenRouter provider."
  }
];

const approvalOptions: Array<SettingSelectOption<AppSettings["approvalPolicy"]>> = [
  { value: "on-request", label: "On request", note: "safer" },
  { value: "on-failure", label: "On failure", note: "faster" },
  { value: "never", label: "Never", note: "autonomous" }
];

const animatedBackgroundOptions: Array<SettingSelectOption<AppSettings["animatedBackground"]>> = [
  { value: "aurora-glass", label: "Aurora glass", note: "default" },
  { value: "lunar-waves", label: "Lunar waves", note: "night sea" },
  { value: "sci-fi-grid", label: "Sci-fi grid", note: "reactive" },
  { value: "cartoon-beach", label: "Cartoon beach", note: "lights" },
  { value: "nebula-rain", label: "Nebula rain", note: "cinematic" },
  { value: "midnight-ocean", label: "Midnight ocean", note: "deep" },
  { value: "liquid-prism", label: "Liquid prism", note: "bright" },
  { value: "solar-frost", label: "Solar frost", note: "light" }
];

const lightDeflectionOptions: Array<SettingSelectOption<AppSettings["lightDeflection"]>> = [
  { value: "strong", label: "Strong glass", note: "default" },
  { value: "extreme", label: "Extreme refraction", note: "visible" },
  { value: "balanced", label: "Balanced", note: "calm" }
];

const cursorLightOptions: Array<SettingSelectOption<AppSettings["cursorLight"]>> = [
  { value: "off", label: "Off", note: "faster" }
];

const answerSurfaceOptions: Array<SettingSelectOption<AppSettings["answerSurface"]>> = [
  { value: "glass", label: "Glass answer box", note: "readable" },
  { value: "open", label: "Open text", note: "minimal" }
];

function shortId(value: string | null | undefined) {
  return value ? value.slice(0, 8) : "none";
}

function formatRunTime(value: string | undefined) {
  if (!value) return "unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatRunDuration(run: RunSummary) {
  const start = Date.parse(run.startedAt);
  const end = Date.parse(run.finishedAt || run.updatedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return "unknown";
  const seconds = Math.max(0, Math.round((end - start) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem ? `${hours}h ${rem}m` : `${hours}h`;
}

export default function SettingsView({ settings, models, initialActive = "General", onBack, onChange }: SettingsViewProps) {
  const [active, setActive] = useState(initialActive);
  const [activeProviderPage, setActiveProviderPage] = useState(providerConnectionPages[0].id);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ state: "idle", message: "" });
  const [actionStatus, setActionStatus] = useState("");
  const [providerAuth, setProviderAuth] = useState<Record<string, ProviderAuthState>>({});
  const [providerKeys, setProviderKeys] = useState<Record<string, string>>({});
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [capabilities, setCapabilities] = useState<CapabilityReport | null>(null);
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(false);
  const [capabilitiesError, setCapabilitiesError] = useState("");
  const [runsReport, setRunsReport] = useState<RunsReport | null>(null);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsError, setRunsError] = useState("");
  const [remoteStatus, setRemoteStatus] = useState<RemoteAccessStatus | null>(null);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [gitName, setGitName] = useState("");
  const [gitEmail, setGitEmail] = useState("");
  const [githubStatus, setGithubStatus] = useState<any>(null);
  const [memoryStatus, setMemoryStatus] = useState<any>(null);
  const [memoryAudit, setMemoryAudit] = useState<any>(null);
  const [memoryQuery, setMemoryQuery] = useState("PiAgent preferences project release");
  const [advisorStatus, setAdvisorStatus] = useState<any>(null);
  const [subagentStatus, setSubagentStatus] = useState<any>(null);
  const [beautifulUiStatus, setBeautifulUiStatus] = useState<any>(null);
  const updateBusy = updateStatus.state === "checking" || updateStatus.state === "available" || updateStatus.state === "installing";
  const codexFontLocked = settings.themePreset === "codex";
  const providerOptions = models.length
    ? [
      ...fallbackProviderOptions.map((fallback) => {
        const provider = models.find((item) => item.id === fallback.value);
        return {
          value: fallback.value,
          label: provider?.name ?? fallback.label,
          note: provider?.auth ?? fallback.note
        };
      }),
      ...models
        .filter((provider) => !fallbackProviderOptions.some((fallback) => fallback.value === provider.id))
        .map((provider) => ({ value: provider.id, label: provider.name, note: provider.auth }))
    ]
    : fallbackProviderOptions;
  const modelsForProvider = (providerId: string, currentModel?: string) => {
    const provider = models.find((item) => item.id === providerId);
    const options = (provider?.models ?? []).map((model) => ({
      value: model.id,
      label: model.name ?? model.id,
      note: model.reasoning ? "reasoning" : model.contextWindow ? `${Math.round(model.contextWindow / 1000)}k` : undefined
    }));
    if (currentModel && !options.some((option) => option.value === currentModel)) {
      options.unshift({ value: currentModel, label: currentModel, note: "current" });
    }
    return options.length ? options : [{ value: currentModel || "gpt-5.5", label: currentModel || "gpt-5.5", note: "current" }];
  };
  const firstModelForProvider = (providerId: string, fallback: string) => models.find((item) => item.id === providerId)?.models[0]?.id ?? fallback;
  const changeMainProvider = (provider: string) => onChange({ provider, modelLabel: firstModelForProvider(provider, settings.modelLabel) });
  const changeAdvisorProvider = (provider: string) => onChange({ advisorProvider: provider, advisorModel: firstModelForProvider(provider, settings.advisorModel) });
  const subagentModelOptions = [
    { value: "inherit", label: "Inherit main model", note: "default" },
    ...models.flatMap((provider) => provider.models.map((model) => ({
      value: model.id,
      label: `${provider.name} / ${model.name ?? model.id}`,
      note: model.reasoning ? "reasoning" : undefined
    })))
  ];

  useEffect(() => {
    if (initialActive) setActive(initialActive);
  }, [initialActive]);

  const refreshGithubStatus = async () => {
    const response = await fetch(apiUrl("/api/github/status")).catch(() => null);
    const data = response?.ok ? await response.json().catch(() => null) : null;
    setGithubStatus(data);
  };

  const refreshAdvisorStatus = async () => {
    const response = await fetch(apiUrl("/api/advisor/status")).catch(() => null);
    const data = response?.ok ? await response.json().catch(() => null) : null;
    setAdvisorStatus(data);
    if (data) setActionStatus(data.installed ? "Pi Advisor extension ready." : "Pi Advisor package is missing from this install.");
  };

  const refreshSubagentStatus = async () => {
    const response = await fetch(apiUrl("/api/subagents/status")).catch(() => null);
    const data = response?.ok ? await response.json().catch(() => null) : null;
    setSubagentStatus(data);
    if (data) setActionStatus(data.installed ? `Pi subagents ready: ${data.engine} ${data.version ?? ""}` : "pi-subagents package is missing from this install.");
  };

  const refreshBeautifulUiStatus = async () => {
    const response = await fetch(apiUrl("/api/beautiful-ui/status")).catch(() => null);
    const data = response?.ok ? await response.json().catch(() => null) : null;
    setBeautifulUiStatus(data);
  };

  const refreshProviderAuth = async () => {
    const response = await fetch(apiUrl("/api/provider-auth")).catch(() => null);
    const data = response?.ok ? await response.json().catch(() => null) : null;
    if (Array.isArray(data?.providers)) {
      setProviderAuth(Object.fromEntries(data.providers.map((provider: ProviderAuthState) => [provider.provider, provider])));
    }
  };

  const refreshCapabilities = async (announce = true) => {
    setCapabilitiesLoading(true);
    const response = await fetch(apiUrl("/api/capabilities")).catch(() => null);
    const data = response?.ok ? await response.json().catch(() => null) : null;
    if (data?.ok) {
      setCapabilities(data);
      setCapabilitiesError("");
      if (announce) setActionStatus("Capability Doctor refreshed.");
    } else {
      const message = data?.error ?? "Capability Doctor failed.";
      setCapabilitiesError(message);
      setActionStatus(message);
    }
    setCapabilitiesLoading(false);
  };

  const refreshRuns = async (announce = true) => {
    setRunsLoading(true);
    const response = await fetch(apiUrl("/api/runs?limit=18")).catch(() => null);
    const data = response?.ok ? await response.json().catch(() => null) : null;
    if (data?.ok && Array.isArray(data.runs)) {
      setRunsReport(data);
      setRunsError("");
      if (announce) setActionStatus("Run history refreshed.");
    } else {
      const message = data?.error ?? "Run history failed.";
      setRunsError(message);
      setActionStatus(message);
    }
    setRunsLoading(false);
  };

  const refreshRemoteStatus = async (announce = false) => {
    setRemoteLoading(true);
    const response = await fetch(apiUrl("/api/remote-access/status")).catch(() => null);
    const data = response?.ok ? await response.json().catch(() => null) : null;
    if (data?.ok) {
      setRemoteStatus(data);
      if (announce) setActionStatus(data.connected ? "Remote relay connected." : data.enabled ? "Remote enabled, waiting for relay connection." : "Remote access is off.");
    } else {
      setActionStatus(data?.error ?? "Remote status failed.");
    }
    setRemoteLoading(false);
  };

  useEffect(() => {
    void refreshGithubStatus();
    void refreshAdvisorStatus();
    void refreshSubagentStatus();
    void refreshBeautifulUiStatus();
    void refreshProviderAuth();
    void refreshCapabilities(false);
    void refreshRemoteStatus(false);
  }, []);

  useEffect(() => {
    if (active === "Configuration" && !capabilities && !capabilitiesLoading) {
      void refreshCapabilities(false);
    }
    if (active === "Configuration" && !runsReport && !runsLoading) {
      void refreshRuns(false);
    }
    if (active === "Remote") {
      void refreshRemoteStatus(false);
    }
  }, [active, capabilities, capabilitiesLoading, runsReport, runsLoading]);

  const createRemotePairing = async () => {
    setActionStatus("Creating one-use pairing QR...");
    const response = await fetch(apiUrl("/api/remote-access/pairing"), { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      setActionStatus(data.error ?? "Unable to create pairing QR.");
      return;
    }
    setRemoteStatus((current) => current ? { ...current, currentPairing: data } : current);
    await refreshRemoteStatus(false);
    setActionStatus("Pairing QR ready. The remote device still needs desktop approval.");
  };

  const approveRemoteDevice = async (approvalId: string) => {
    const response = await fetch(apiUrl("/api/remote-access/approve"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvalId })
    });
    const data = await response.json().catch(() => ({}));
    setActionStatus(response.ok && data.ok ? "Remote device approved." : data.error ?? "Approval failed.");
    await refreshRemoteStatus(false);
  };

  const denyRemoteDevice = async (approvalId: string) => {
    const response = await fetch(apiUrl("/api/remote-access/deny"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvalId })
    });
    const data = await response.json().catch(() => ({}));
    setActionStatus(response.ok && data.ok ? "Remote device denied." : data.error ?? "Deny failed.");
    await refreshRemoteStatus(false);
  };

  const revokeRemoteDevice = async (deviceId: string) => {
    const response = await fetch(apiUrl("/api/remote-access/revoke"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId })
    });
    const data = await response.json().catch(() => ({}));
    setActionStatus(response.ok && data.ok ? "Remote device revoked." : data.error ?? "Revoke failed.");
    await refreshRemoteStatus(false);
  };

  const disableRemoteAccess = async () => {
    const response = await fetch(apiUrl("/api/remote-access/disable"), { method: "POST" });
    const data = await response.json().catch(() => ({}));
    onChange({ remoteAccessEnabled: false });
    setActionStatus(response.ok && data.ok ? "Remote access disabled and live sockets closed." : data.error ?? "Disable failed.");
    await refreshRemoteStatus(false);
  };

  const saveProviderKey = async (provider: string) => {
    const apiKey = providerKeys[provider] ?? "";
    if (!apiKey.trim()) {
      setActionStatus("Paste an API key first.");
      return;
    }
    setActionStatus(`Saving ${provider} key...`);
    const response = await fetch(apiUrl(`/api/provider-auth/${encodeURIComponent(provider)}`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      setActionStatus(data.error ?? "API key save failed.");
      return;
    }
    setProviderKeys((current) => ({ ...current, [provider]: "" }));
    if (Array.isArray(data.providers)) setProviderAuth(Object.fromEntries(data.providers.map((item: ProviderAuthState) => [item.provider, item])));
    setActionStatus(`${provider} key saved. Selecting it now; runtime verification follows in the top status bar.`);
    onChange({ provider, modelLabel: firstModelForProvider(provider, settings.modelLabel) });
    window.setTimeout(() => void refreshProviderAuth(), 300);
  };

  const disconnectProvider = async (provider: string) => {
    setActionStatus(`Disconnecting ${provider}...`);
    const response = await fetch(apiUrl(`/api/provider-auth/${encodeURIComponent(provider)}`), { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      setActionStatus(data.error ?? "Provider disconnect failed.");
      return;
    }
    if (Array.isArray(data.providers)) setProviderAuth(Object.fromEntries(data.providers.map((item: ProviderAuthState) => [item.provider, item])));
    setActionStatus(`${provider} disconnected from local auth file.`);
  };

  const diagnose = async () => {
    setActionStatus("Running diagnostics...");
    const response = await fetch(apiUrl("/api/diagnostics"));
    const data = await response.json();
    setDiagnostics(data);
    setActionStatus("Diagnostics refreshed.");
  };

  const runOpen = async (target: string) => {
    setActionStatus(`Opening ${target}...`);
    try {
      const opened = await openTarget(target);
      setActionStatus(`Opened ${opened}`);
    } catch (error) {
      setActionStatus(error instanceof Error ? error.message : String(error));
    }
  };

  const connectGithub = async () => {
    setActionStatus("Starting GitHub sign-in...");
    const response = await fetch(apiUrl("/api/github/connect"), { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setActionStatus(data.message ?? data.error ?? "GitHub sign-in request sent.");
    window.setTimeout(() => void refreshGithubStatus(), 2000);
  };

  const refreshMemoryStatus = async () => {
    const response = await fetch(apiUrl("/api/memory/status"));
    const data = await response.json();
    setMemoryStatus(data);
    setActionStatus("Memory status refreshed.");
  };

  const refreshMemoryAudit = async () => {
    setActionStatus("Reading sovereign memory audit...");
    const [statusResponse, skillsResponse, explainResponse] = await Promise.all([
      fetch(apiUrl("/api/memory/status")).catch(() => null),
      fetch(apiUrl("/api/memory/skills?includeDisabled=1&limit=24")).catch(() => null),
      fetch(apiUrl(`/api/memory/explain?q=${encodeURIComponent(memoryQuery)}&budgetTokens=${settings.memoryBudgetTokens}`)).catch(() => null)
    ]);
    const status = statusResponse?.ok ? await statusResponse.json().catch(() => null) : null;
    const skills = skillsResponse?.ok ? await skillsResponse.json().catch(() => null) : null;
    const explain = explainResponse?.ok ? await explainResponse.json().catch(() => null) : null;
    setMemoryStatus(status);
    setMemoryAudit({ status, skills, explain });
    setActionStatus("Sovereign memory audit refreshed.");
  };

  const dryRunMemoryMigration = async () => {
    setActionStatus("Running memory migration dry-run...");
    const response = await fetch(apiUrl("/api/memory/migrate/dry-run"), { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setMemoryAudit((current: any) => ({ ...(current ?? {}), migration: data }));
    setActionStatus(data.ok ? `Dry-run: ${data.counts?.records ?? 0} records, ${data.duplicateGroups?.length ?? 0} duplicate groups.` : data.error ?? "Migration dry-run failed.");
  };

  const applyMemoryMigration = async () => {
    if (!window.confirm("Apply Sovereign Memory migration? A local backup is created first.")) return;
    setActionStatus("Applying memory migration...");
    const response = await fetch(apiUrl("/api/memory/migrate/apply"), { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setMemoryAudit((current: any) => ({ ...(current ?? {}), migration: data }));
    setActionStatus(data.ok ? `Migration applied. Backup: ${data.backupPath ?? "created"}` : data.error ?? "Migration failed.");
    await refreshMemoryAudit();
  };

  const changeSkillStatus = async (id: string, action: "promote" | "disable") => {
    const response = await fetch(apiUrl(`/api/memory/skills/${encodeURIComponent(id)}/${action}`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: action === "disable" ? "Disabled from PiAgent memory audit UI." : undefined })
    });
    const data = await response.json().catch(() => ({}));
    setActionStatus(data.ok ? `Skill ${action === "promote" ? "promoted" : "disabled"}: ${id}` : data.error ?? "Skill update failed.");
    await refreshMemoryAudit();
  };

  const consolidateMemory = async () => {
    setActionStatus("Consolidating global memory from saved sessions...");
    const response = await fetch(apiUrl("/api/memory/consolidate"), { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      setActionStatus(data.error ?? "Memory consolidation failed.");
      return;
    }
    setMemoryStatus(data);
    setActionStatus(`Consolidated ${data.memories ?? 0} memories from ${data.messages ?? 0} messages.`);
  };

  return (
    <section className="settings-layout">
      <nav className="settings-nav">
        <button onClick={onBack}><Icon name="arrowLeft" /> Retour a l'appli</button>
        {nav.map((item) => (
          <button key={item.id} className={item.id === active ? "active" : ""} onClick={() => setActive(item.id)}>
            <Icon name={item.icon} /> {item.label}
          </button>
        ))}
      </nav>
      <div className="settings-content">
        <h1>{active}</h1>
        {active === "General" ? (
          <>
            <section className="settings-section">
              <h2>Mode de travail</h2>
              <div className="mode-grid">
                <button className={settings.accessMode === "full" ? "selected" : ""} onClick={() => onChange({ accessMode: "full" })}>
                  <Icon name="terminal" /> Pour le codage<span>Reponses techniques, outils actifs, workflow Pi complet</span>
                </button>
                <button className={settings.accessMode === "limited" ? "selected" : ""} onClick={() => onChange({ accessMode: "limited" })}>
                  <Icon name="spark" /> Pour le travail quotidien<span>Moins d'outils actifs par defaut, meme modele</span>
                </button>
              </div>
            </section>

            <section className="settings-card">
              <div>
                <strong>Autorisations par defaut</strong>
                <p>Controle quand l'agent demande une approbation avant d'agir.</p>
              </div>
              <SettingSelect
                value={settings.approvalPolicy}
                onChange={(value) => onChange({ approvalPolicy: value })}
                options={[
                  { value: "on-request", label: "On request", note: "safer" },
                  { value: "on-failure", label: "On failure", note: "faster" },
                  { value: "never", label: "Never", note: "autonomous" }
                ]}
              />
              <div>
                <strong>Acces de l'agent</strong>
                <p>Applique les drapeaux Pi au prochain lancement de session.</p>
              </div>
              <SettingSelect
                value={settings.accessMode}
                onChange={(value) => onChange({ accessMode: value })}
                options={[
                  { value: "full", label: "Full access", note: "coding" },
                  { value: "limited", label: "Limite", note: "review" },
                  { value: "read-only", label: "Lecture seule", note: "safe" }
                ]}
              />
            </section>
          </>
        ) : null}

        {active === "Apparence" ? (
          <section className="settings-section">
            <h2>Theme</h2>
            <div className="theme-preview">
              <div><span>1</span> const themePreview = {"{"}</div>
              <div><span>2</span>   surface: "sidebar",</div>
              <div><span>3</span>   accent: "#ff0000"</div>
              <div><span>4</span> {"}"}</div>
            </div>
            <div className="settings-card compact">
              <span>Theme</span>
              <SettingSelect
                value={settings.theme}
                onChange={(value) => onChange({ theme: value })}
                options={[
                  { value: "dark", label: "Fonce", note: "glass" },
                  { value: "light", label: "Clair", note: "clean" },
                  { value: "system", label: "Systeme", note: "auto" }
                ]}
              />
              <span>Palette</span>
              <SettingSelect
                value={settings.themePreset}
                onChange={(value) => onChange({ themePreset: value })}
                options={[
                  { value: "codex", label: "Codex", note: "exact" },
                  { value: "graphite", label: "Graphite" },
                  { value: "midnight", label: "Midnight" },
                  { value: "ember", label: "Ember" },
                  { value: "absolute", label: "Absolute" },
                  { value: "paper", label: "Paper light" },
                  { value: "dawn", label: "Dawn light" },
                  { value: "contrast", label: "High contrast" }
                ]}
              />
              <span>Background anime</span>
              <SettingSelect
                value={settings.animatedBackground}
                onChange={(value) => onChange({ animatedBackground: value })}
                options={animatedBackgroundOptions}
              />
              <span>Deflection lumiere</span>
              <SettingSelect
                value={settings.lightDeflection}
                onChange={(value) => onChange({ lightDeflection: value })}
                options={lightDeflectionOptions}
              />
              <span>Curseur lumineux</span>
              <SettingSelect
                value={settings.cursorLight}
                onChange={(value) => onChange({ cursorLight: value })}
                options={cursorLightOptions}
              />
              <span>Reponses IA</span>
              <SettingSelect
                value={settings.answerSurface}
                onChange={(value) => onChange({ answerSurface: value })}
                options={answerSurfaceOptions}
              />
              <span>Accent</span>
              <input type="color" value={settings.accentColor} onChange={(e) => onChange({ accentColor: e.target.value })} />
              <span>Densite</span>
              <SettingSelect
                value={settings.density}
                onChange={(value) => onChange({ density: value })}
                options={[
                  { value: "comfortable", label: "Comfortable" },
                  { value: "compact", label: "Compact" }
                ]}
              />
              <span>Texte du chat</span>
              <SettingSelect
                value={settings.textDensity}
                onChange={(value) => onChange({ textDensity: value })}
                options={[
                  { value: "codex", label: "Codex", note: "13.5" },
                  { value: "comfortable", label: "Comfortable", note: "14" },
                  { value: "compact", label: "Compact", note: "13" },
                  { value: "custom", label: "Personnalise" }
                ]}
              />
              <span>Police</span>
              <SettingSelect
                value={codexFontLocked ? "\"OpenAI Sans\", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif" : settings.fontFamily}
                disabled={codexFontLocked}
                title={codexFontLocked ? "La palette Codex utilise sa police systeme pour garder le style exact." : undefined}
                onChange={(value) => onChange({ fontFamily: value })}
                options={[
                  { value: "\"OpenAI Sans\", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif", label: "OpenAI Sans style" },
                  { value: "\"SF Mono\", \"Fira Code\", \"Cascadia Code\", \"Consolas\", monospace", label: "SF Mono stack" },
                  { value: "\"Cascadia Code\", \"Consolas\", monospace", label: "Cascadia Code" },
                  { value: "\"Fira Code\", \"Cascadia Code\", monospace", label: "Fira Code" },
                  { value: "\"Consolas\", monospace", label: "Consolas" },
                  { value: "Inter, Arial, sans-serif", label: "Inter style" }
                ]}
              />
              <span>Taille messages</span>
              <input type="number" min="11" max="18" step="0.5" value={settings.messageFontSize} onChange={(e) => onChange({ textDensity: "custom", messageFontSize: Number(e.target.value) })} />
              <span>Interligne</span>
              <input type="number" min="1.25" max="1.9" step="0.05" value={settings.messageLineHeight} onChange={(e) => onChange({ textDensity: "custom", messageLineHeight: Number(e.target.value) })} />
              <span>Espacement phrases</span>
              <input type="number" min="8" max="28" step="1" value={settings.messageSpacing} onChange={(e) => onChange({ textDensity: "custom", messageSpacing: Number(e.target.value) })} />
            </div>
          </section>
        ) : null}

        {active === "Modeles" ? (
          <section className="settings-section">
            <h2>Modele et thinking</h2>
            <div className="settings-card compact">
              <span>Fournisseur</span>
              <SettingSelect
                value={settings.provider}
                onChange={changeMainProvider}
                options={providerOptions}
              />
              <span>Modele</span>
              <SettingSelect
                value={settings.modelLabel}
                onChange={(value) => onChange({ modelLabel: value })}
                options={modelsForProvider(settings.provider, settings.modelLabel)}
              />
              <span>Thinking</span>
              <SettingSelect
                value={settings.thinkingLevel}
                onChange={(value) => onChange({ thinkingLevel: value })}
                options={[
                  { value: "medium", label: "Balanced", note: "default" },
                  { value: "high", label: "Deep thinking", note: "review" },
                  { value: "xhigh", label: "Max thinking", note: "slow" },
                  { value: "low", label: "Light thinking" },
                  { value: "minimal", label: "Minimal" },
                  { value: "off", label: "Direct mode" }
                ]}
              />
            </div>
          </section>
        ) : null}

        {active === "Connexions" ? (
          <section className="settings-section provider-pages">
            <h2>Connexions API</h2>
            <div className="provider-page-tabs">
              {providerConnectionPages.map((provider) => (
                <button
                  key={provider.id}
                  className={activeProviderPage === provider.id ? "active" : ""}
                  onClick={() => setActiveProviderPage(provider.id)}
                >
                  <Icon name="link" /> {provider.label}
                </button>
              ))}
            </div>
            {providerConnectionPages.filter((provider) => provider.id === activeProviderPage).map((provider) => {
              const status = providerAuth[provider.id];
              const configured = Boolean(status?.configured);
              const source = status?.source === "environment"
                ? `Environment: ${status.envVar}`
                : status?.source === "auth_file"
                  ? "Local auth file"
                  : "Not connected";
              return (
                <article key={provider.id} className="provider-card">
                  <header>
                    <div>
                      <span>{provider.eyebrow}</span>
                      <h2>{provider.label}</h2>
                    </div>
                    <strong className={configured ? "connected" : ""}>{configured ? "Connected" : "Not connected"}</strong>
                  </header>
                  <p>{provider.description}</p>
                  <div className="provider-status-grid">
                    <span>Status</span><em>{source}</em>
                    <span>Provider</span><em>{provider.id}</em>
                    <span>Selected model</span><em>{settings.provider === provider.id ? settings.modelLabel : firstModelForProvider(provider.id, "available after refresh")}</em>
                  </div>
                  <label className="secret-input">
                    API key
                    <input
                      type="password"
                      autoComplete="off"
                      placeholder={provider.placeholder}
                      value={providerKeys[provider.id] ?? ""}
                      onChange={(event) => setProviderKeys((current) => ({ ...current, [provider.id]: event.target.value }))}
                    />
                  </label>
                  <div className="provider-actions">
                    <button onClick={() => void saveProviderKey(provider.id)}><Icon name="check" /> Save key</button>
                    <button onClick={() => {
                      onChange({ provider: provider.id, modelLabel: firstModelForProvider(provider.id, settings.modelLabel) });
                      setActionStatus(`${provider.label} selected.`);
                    }}><Icon name="terminal" /> Use provider</button>
                    <button disabled={!configured || status?.source === "environment"} onClick={() => void disconnectProvider(provider.id)}><Icon name="archive" /> Disconnect</button>
                  </div>
                </article>
              );
            })}
          </section>
        ) : null}

        {active === "Remote" ? (
          <section className="settings-section">
            <h2>Remote Access</h2>
            <div className="settings-card compact">
              <span>Status</span>
              <strong className={remoteStatus?.connected ? "connected" : ""}>
                {remoteStatus?.connected ? "Relay connected" : settings.remoteAccessEnabled ? "Enabled, waiting for relay" : "Off"}
              </strong>
              <span>Public relay</span>
              <input value={settings.remoteAccessRelayUrl} onChange={(event) => onChange({ remoteAccessRelayUrl: event.target.value })} />
              <span>Desktop name</span>
              <input value={settings.remoteAccessDesktopName} onChange={(event) => onChange({ remoteAccessDesktopName: event.target.value })} />
              <span>Remote mode</span>
              <SettingSelect
                value={settings.remoteAccessMode}
                onChange={(value) => onChange({ remoteAccessMode: value })}
                options={[
                  { value: "safe-chat", label: "Safe chat", note: "no tools" },
                  { value: "full-agent", label: "Full agent", note: "desktop policy" },
                  { value: "off", label: "Off" }
                ]}
              />
              <span>Access</span>
              <SettingSelect
                value={settings.remoteAccessEnabled ? "on" : "off"}
                onChange={(value) => onChange({
                  remoteAccessEnabled: value === "on",
                  remoteAccessMode: value === "on" && settings.remoteAccessMode === "off" ? "safe-chat" : settings.remoteAccessMode
                })}
                options={[
                  { value: "off", label: "Disabled", note: "default" },
                  { value: "on", label: "Enabled", note: "outbound only" }
                ]}
              />
              <span>Prompt limit</span>
              <input type="number" min="500" max="12000" step="500" value={settings.remoteAccessMaxPromptChars} onChange={(event) => onChange({ remoteAccessMaxPromptChars: Number(event.target.value) })} />
              <span>Desktop ID</span>
              <em>{shortId(remoteStatus?.desktopId)}</em>
              <span>Protocol</span>
              <em>{remoteStatus?.protocolVersion ?? "remote-v1"}</em>
              <span>Last event</span>
              <em>{remoteStatus?.lastEventAt ? formatRunTime(remoteStatus.lastEventAt) : "none"}</em>
              <span>Security</span>
              <span>Safe chat blocks tools. Full agent lets paired devices send prompts to this desktop using the desktop access policy; the relay still cannot run tools directly. Pairing requires QR plus desktop approval, and devices can be revoked.</span>
              <span>Actions</span>
              <div className="split-setting">
                <button disabled={remoteLoading} onClick={() => void refreshRemoteStatus(true)}><Icon name="plug" /> Refresh</button>
                <button disabled={!settings.remoteAccessEnabled} onClick={() => void createRemotePairing()}><Icon name="link" /> New QR</button>
                <button onClick={() => void disableRemoteAccess()}><Icon name="archive" /> Disable all</button>
              </div>
              {remoteStatus?.lastError ? (
                <>
                  <span>Last error</span>
                  <strong>{remoteStatus.lastError}</strong>
                </>
              ) : null}
            </div>

            {remoteStatus?.currentPairing ? (
              <article className="provider-card remote-pairing-card">
                <header>
                  <div>
                    <span>One-use QR</span>
                    <h2>Pair a phone or laptop</h2>
                  </div>
                  <strong>Expires {formatRunTime(remoteStatus.currentPairing.expiresAt)}</strong>
                </header>
                <div className="remote-qr" dangerouslySetInnerHTML={{ __html: remoteStatus.currentPairing.qrSvg }} />
                <p>Scan this on the remote device. The browser will wait until you approve it here. The QR secret is in the URL fragment and is never sent in the initial page request.</p>
              </article>
            ) : null}

            <article className="provider-card">
              <header>
                <div>
                  <span>Pending approval</span>
                  <h2>Devices waiting</h2>
                </div>
                <strong>{remoteStatus?.pendingApprovals?.length ?? 0}</strong>
              </header>
              {(remoteStatus?.pendingApprovals ?? []).length ? remoteStatus!.pendingApprovals.map((item) => (
                <div className="remote-device-row" key={item.approvalId}>
                  <div>
                    <strong>{item.deviceName}</strong>
                    <span>{shortId(item.approvalId)} / expires {formatRunTime(item.expiresAt)}</span>
                  </div>
                  <div className="provider-actions">
                    <button onClick={() => void approveRemoteDevice(item.approvalId)}><Icon name="check" /> Approve</button>
                    <button onClick={() => void denyRemoteDevice(item.approvalId)}><Icon name="archive" /> Deny</button>
                  </div>
                </div>
              )) : <p>No devices are waiting for approval.</p>}
            </article>

            <article className="provider-card">
              <header>
                <div>
                  <span>Paired devices</span>
                  <h2>Revocable access</h2>
                </div>
                <strong>{remoteStatus?.devices?.length ?? 0}</strong>
              </header>
              {(remoteStatus?.devices ?? []).length ? remoteStatus!.devices.map((device) => (
                <div className="remote-device-row" key={device.id}>
                  <div>
                    <strong>{device.name}</strong>
                    <span>{shortId(device.id)} / {device.connected ? "connected" : "offline"} / last {formatRunTime(device.lastActiveAt)}</span>
                  </div>
                  <button onClick={() => void revokeRemoteDevice(device.id)}><Icon name="archive" /> Revoke</button>
                </div>
              )) : <p>No paired devices yet.</p>}
            </article>

            <article className="provider-card">
              <header>
                <div>
                  <span>Audit</span>
                  <h2>Security events</h2>
                </div>
                <strong>{remoteStatus?.auditEvents?.length ?? 0}</strong>
              </header>
              {(remoteStatus?.auditEvents ?? []).length ? remoteStatus!.auditEvents.slice(0, 8).map((event) => (
                <div className="remote-device-row" key={event.id}>
                  <div>
                    <strong>{event.type.replace(/_/g, " ")}</strong>
                    <span>{formatRunTime(event.at)}{event.deviceName ? ` / ${event.deviceName}` : ""}{event.reason ? ` / ${event.reason}` : ""}</span>
                  </div>
                  {event.deviceId ? <em>{shortId(event.deviceId)}</em> : null}
                </div>
              )) : <p>No remote security events yet.</p>}
            </article>
          </section>
        ) : null}

        {active === "Sous-agents" ? (
          <section className="settings-section">
            <h2>Sous-agents reels et outils actifs</h2>
            <div className="settings-card compact">
              <span>Moteur pi-subagents</span>
              <span>{subagentStatus?.installed ? `${subagentStatus.engine}@${subagentStatus.version ?? "?"} dans ${subagentStatus.extensionPath}` : "Package manquant. L'installateur doit inclure pi-subagents."}</span>
              <span>Sous-agents</span>
              <SettingSelect
                value={settings.subagentsEnabled ? "on" : "off"}
                onChange={(value) => onChange({ subagentsEnabled: value === "on", autoLaunchSubagents: value === "on" })}
                options={[
                  { value: "on", label: "Actifs", note: "ready" },
                  { value: "off", label: "Desactives" }
                ]}
              />
              <span>Delegation automatique</span>
              <SettingSelect
                value={settings.subagentRoutingMode}
                onChange={(value) => onChange({ subagentRoutingMode: value, autoLaunchSubagents: value !== "manual", subagentsEnabled: true })}
                options={[
                  { value: "manual", label: "Manuel" },
                  { value: "assistive", label: "Assistif" },
                  { value: "automatic", label: "Automatique", note: "parallel" }
                ]}
              />
              <span>Max parallele</span>
              <input type="number" min="1" max="8" value={settings.subagentMaxParallel} onChange={(e) => onChange({ subagentMaxParallel: Number(e.target.value) })} />
              <span>Async par defaut</span>
              <SettingSelect
                value={settings.subagentAsyncByDefault ? "on" : "off"}
                onChange={(value) => onChange({ subagentAsyncByDefault: value === "on" })}
                options={[
                  { value: "on", label: "Arriere-plan", note: "long runs" },
                  { value: "off", label: "Foreground" }
                ]}
              />
              <span>Profondeur max</span>
              <input type="number" min="0" max="3" value={settings.subagentMaxDepth} onChange={(e) => onChange({ subagentMaxDepth: Number(e.target.value) })} />
              <span>Modele des enfants</span>
              <SettingSelect
                value={settings.subagentModel}
                onChange={(value) => onChange({ subagentModel: value || "inherit" })}
                options={subagentModelOptions.some((option) => option.value === settings.subagentModel)
                  ? subagentModelOptions
                  : [{ value: settings.subagentModel, label: settings.subagentModel, note: "current" }, ...subagentModelOptions]}
              />
              <span>Thinking enfants</span>
              <SettingSelect
                value={settings.subagentThinking}
                onChange={(value) => onChange({ subagentThinking: value })}
                options={thinkingOptions}
              />
              <span>Review loop</span>
              <SettingSelect
                value={settings.subagentReviewLoop ? "on" : "off"}
                onChange={(value) => onChange({ subagentReviewLoop: value === "on" })}
                options={[
                  { value: "on", label: "Worker + reviewers" },
                  { value: "off", label: "Ne pas forcer" }
                ]}
              />
              <span>Worktrees</span>
              <SettingSelect
                value={settings.subagentUseWorktrees ? "on" : "off"}
                onChange={(value) => onChange({ subagentUseWorktrees: value === "on" })}
                options={[
                  { value: "off", label: "Single writer" },
                  { value: "on", label: "Worktrees", note: "clean Git" }
                ]}
              />
              <span>Intercom</span>
              <SettingSelect
                value={settings.subagentIntercomMode}
                onChange={(value) => onChange({ subagentIntercomMode: value })}
                options={[
                  { value: "off", label: "Off" },
                  { value: "fork-only", label: "Fork only" },
                  { value: "always", label: "Always" }
                ]}
              />
              <span>Status sous-agents</span>
              <button onClick={() => void refreshSubagentStatus()}><Icon name="plug" /> Verifier pi-subagents</button>
              <span>Project OS</span>
              <SettingSelect value={settings.projectSupervisorEnabled ? "on" : "off"} onChange={(value) => onChange({ projectSupervisorEnabled: value === "on" })} options={onOffOptions} />
              <span>Advisor</span>
              <SettingSelect
                value={settings.advisorEnabled ? "on" : "off"}
                onChange={(value) => onChange({ advisorEnabled: value === "on" })}
                options={onOffOptions}
              />
              <span>Advisor modele</span>
              <div className="split-setting">
                <SettingSelect value={settings.advisorProvider} onChange={changeAdvisorProvider} options={providerOptions} />
                <SettingSelect
                  value={settings.advisorModel}
                  onChange={(value) => onChange({ advisorModel: value })}
                  options={modelsForProvider(settings.advisorProvider, settings.advisorModel)}
                />
              </div>
              <span>Advisor reasoning</span>
              <SettingSelect
                value={settings.advisorReasoning}
                onChange={(value) => onChange({ advisorReasoning: value })}
                options={reasoningOptions}
              />
              <span>Advisor max/run</span>
              <input type="number" min="1" max="12" value={settings.advisorMaxUsesPerRun} onChange={(e) => onChange({ advisorMaxUsesPerRun: Number(e.target.value) })} />
              <span>Advisor status</span>
              <button onClick={() => void refreshAdvisorStatus()}><Icon name="shield" /> Verifier pi-advisor</button>
              <span>Web guidance</span>
              <SettingSelect value={settings.webEnabled ? "on" : "off"} onChange={(value) => onChange({ webEnabled: value === "on" })} options={onOffOptions} />
              <span>Chrome</span>
              <SettingSelect value={settings.chromeEnabled ? "on" : "off"} onChange={(value) => onChange({ chromeEnabled: value === "on" })} options={onOffOptions} />
              <span>Contexte</span>
              <SettingSelect value={settings.contextEnabled ? "on" : "off"} onChange={(value) => onChange({ contextEnabled: value === "on" })} options={onOffOptions} />
              <span>Acces ordinateur</span>
              <SettingSelect value={settings.computerUseEnabled ? "on" : "off"} onChange={(value) => onChange({ computerUseEnabled: value === "on" })} options={onOffOptions} />
            </div>
            {subagentStatus?.profiles ? (
              <div className="subagent-profile-grid">
                {subagentStatus.profiles.map((profile: any) => (
                  <article key={profile.id}>
                    <strong>{profile.name}</strong>
                    <span>{profile.role}</span>
                    <p>{profile.description}</p>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {active === "Projets" ? (
          <section className="settings-section">
            <h2>Travail long et projets</h2>
            <div className="settings-card compact">
              <span>Mode longue duree</span>
              <SettingSelect value={settings.longRunningMode ? "on" : "off"} onChange={(value) => onChange({ longRunningMode: value === "on" })} options={onOffOptions} />
              <span>Advisor automatique</span>
              <SettingSelect value={settings.autoLaunchAdvisor ? "on" : "off"} onChange={(value) => onChange({ autoLaunchAdvisor: value === "on", autoReview: value === "on" })} options={onOffOptions} />
              <span>Sous-agents automatiques</span>
              <SettingSelect
                value={settings.autoLaunchSubagents ? "on" : "off"}
                onChange={(value) => onChange({ autoLaunchSubagents: value === "on", subagentsEnabled: value === "on", subagentRoutingMode: value === "on" ? "automatic" : "manual" })}
                options={[
                  { value: "on", label: "Automatique", note: "delegate" },
                  { value: "off", label: "Manuel" }
                ]}
              />
              <span>Workspace courant</span>
              <input value={settings.workspacePath} onChange={(e) => onChange({ workspacePath: e.target.value })} />
              <span>Workflow</span>
              <span>Les projets enregistrent un arbre de fichiers, l'etat Git, les workflows Plan/Build/Review, et l'espace actif que Pi utilise.</span>
            </div>
          </section>
        ) : null}

        {active === "Memoire" ? (
          <section className="settings-section">
            <h2>Memoire globale longue duree</h2>
            <div className="settings-card compact">
              <span>Architecture</span>
              <span>Local-first global memory: representation utilisateur, souvenirs atomiques, skills/outils, journal d'observations, scopes projet/session.</span>
              <span>Mode</span>
              <SettingSelect
                value={settings.memoryMode}
                onChange={(value) => onChange({ memoryMode: value, memoryEnabled: value !== "off" })}
                options={[
                  { value: "deep", label: "Deep", note: "hybrid" },
                  { value: "assistive", label: "Assistive" },
                  { value: "manual", label: "Manual only" },
                  { value: "off", label: "Off" }
                ]}
              />
              <span>Memoire locale</span>
              <SettingSelect value={settings.memoryEnabled ? "on" : "off"} onChange={(value) => onChange({ memoryEnabled: value === "on", memoryMode: value === "on" ? "deep" : "off" })} options={onOffOptions} />
              <span>Sovereign Memory</span>
              <SettingSelect value={settings.sovereignMemoryEnabled ? "on" : "off"} onChange={(value) => onChange({ sovereignMemoryEnabled: value === "on" })} options={onOffOptions} />
              <span>Autopilote</span>
              <SettingSelect value={settings.memoryAutopilot ? "on" : "off"} onChange={(value) => onChange({ memoryAutopilot: value === "on" })} options={onOffOptions} />
              <span>Mode prive</span>
              <SettingSelect value={settings.memoryPrivateMode ? "on" : "off"} onChange={(value) => onChange({ memoryPrivateMode: value === "on" })} options={onOffOptions} />
              <span>Injection automatique</span>
              <SettingSelect
                value={settings.memoryAutoInject ? "on" : "off"}
                onChange={(value) => onChange({ memoryAutoInject: value === "on" })}
                options={[
                  { value: "on", label: "Auto recall" },
                  { value: "off", label: "Manual only" }
                ]}
              />
              <span>Apprendre des chats</span>
              <SettingSelect value={settings.memoryLearnFromChats ? "on" : "off"} onChange={(value) => onChange({ memoryLearnFromChats: value === "on" })} options={onOffOptions} />
              <span>Apprendre les outils</span>
              <SettingSelect value={settings.memoryLearnTools ? "on" : "off"} onChange={(value) => onChange({ memoryLearnTools: value === "on" })} options={onOffOptions} />
              <span>Profil global</span>
              <SettingSelect value={settings.memoryProfileEnabled ? "on" : "off"} onChange={(value) => onChange({ memoryProfileEnabled: value === "on" })} options={onOffOptions} />
              <span>Journal d'observations</span>
              <SettingSelect value={settings.memoryEventLogEnabled ? "on" : "off"} onChange={(value) => onChange({ memoryEventLogEnabled: value === "on" })} options={onOffOptions} />
              <span>Memoire episodique</span>
              <SettingSelect value={settings.memoryEpisodicEnabled ? "on" : "off"} onChange={(value) => onChange({ memoryEpisodicEnabled: value === "on" })} options={onOffOptions} />
              <span>Rappel hybride</span>
              <SettingSelect value={settings.memoryHybridRecallEnabled ? "on" : "off"} onChange={(value) => onChange({ memoryHybridRecallEnabled: value === "on" })} options={onOffOptions} />
              <span>Corrections</span>
              <SettingSelect value={settings.memoryCorrectionsEnabled ? "on" : "off"} onChange={(value) => onChange({ memoryCorrectionsEnabled: value === "on" })} options={onOffOptions} />
              <span>Explain recall</span>
              <SettingSelect value={settings.memoryExplainRecall ? "on" : "off"} onChange={(value) => onChange({ memoryExplainRecall: value === "on" })} options={onOffOptions} />
              <span>Skills apprises</span>
              <SettingSelect value={settings.memorySkillLearning ? "on" : "off"} onChange={(value) => onChange({ memorySkillLearning: value === "on" })} options={onOffOptions} />
              <span>Prompt compiler</span>
              <SettingSelect value={settings.promptCompilerEnabled ? "on" : "off"} onChange={(value) => onChange({ promptCompilerEnabled: value === "on" })} options={onOffOptions} />
              <span>Episodes injectes</span>
              <input type="number" min="0" max="30" step="1" value={settings.memoryMaxEpisodicHits} onChange={(e) => onChange({ memoryMaxEpisodicHits: Number(e.target.value) })} />
              <span>Confiance minimale</span>
              <input type="number" min="0" max="1" step="0.05" value={settings.memoryMinConfidence} onChange={(e) => onChange({ memoryMinConfidence: Number(e.target.value) })} />
              <span>Budget max</span>
              <input type="number" min="100" max="4000" step="50" value={settings.memoryBudgetTokens} onChange={(e) => onChange({ memoryBudgetTokens: Number(e.target.value) })} />
              <span>Isolation</span>
              <span>Les souvenirs projet/session restent isoles. La couche globale ne stocke pas les secrets detectes et injecte seulement un contexte source-labelle.</span>
              <span>Etat</span>
              <button onClick={() => void refreshMemoryStatus()}><Icon name="search" /> Lire status memoire</button>
              <span>Audit</span>
              <button onClick={() => void refreshMemoryAudit()}><Icon name="shield" /> Lire audit souverain</button>
              <span>Question audit</span>
              <input value={memoryQuery} onChange={(e) => setMemoryQuery(e.target.value)} />
              <span>Migration dry-run</span>
              <button onClick={() => void dryRunMemoryMigration()}><Icon name="search" /> Simuler migration</button>
              <span>Migration appliquee</span>
              <button onClick={() => void applyMemoryMigration()}><Icon name="check" /> Appliquer avec backup</button>
              <span>Consolidation</span>
              <button onClick={() => void consolidateMemory()}><Icon name="spark" /> Apprendre depuis les anciennes sessions</button>
              <span>Dossier memoire</span>
              <button onClick={() => void runOpen("config")}><Icon name="folder" /> Ouvrir la configuration</button>
            </div>
            {memoryStatus ? (
              <pre className="diagnostics-output">{JSON.stringify({
                backend: memoryStatus.backend,
                version: memoryStatus.version,
                externalMemoryServices: memoryStatus.externalMemoryServices,
                count: memoryStatus.count,
                activeCount: memoryStatus.activeCount,
                episodeCount: memoryStatus.episodeCount,
                eventCount: memoryStatus.eventCount,
                correctionCount: memoryStatus.correctionCount,
                skillCardCount: memoryStatus.skillCardCount,
                byScope: memoryStatus.byScope,
                byKind: memoryStatus.byKind,
                byTier: memoryStatus.byTier,
                byStatus: memoryStatus.byStatus,
                architecture: memoryStatus.architecture,
                profile: memoryStatus.profile,
                userModel: memoryStatus.userModel
              }, null, 2)}</pre>
            ) : null}
            {memoryAudit?.skills?.cards?.length ? (
              <div className="capability-grid">
                {memoryAudit.skills.cards.map((skill: any) => (
                  <article key={skill.id} className={`capability-card ${skill.status === "disabled" ? "missing" : skill.promoted ? "ready" : "partial"}`}>
                    <strong>{skill.title}</strong>
                    <p>{skill.description}</p>
                    <span>{skill.id} · {skill.status} · c{Number(skill.confidence ?? 0).toFixed(2)} · {skill.successCount ?? 0}/{skill.failureCount ?? 0}</span>
                    <div className="settings-actions">
                      <button onClick={() => void changeSkillStatus(skill.id, "promote")}><Icon name="check" /> Promouvoir</button>
                      <button onClick={() => void changeSkillStatus(skill.id, "disable")}><Icon name="stop" /> Desactiver</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
            {memoryAudit ? (
              <pre className="diagnostics-output">{JSON.stringify({
                explain: memoryAudit.explain ? {
                  selected: memoryAudit.explain.records?.filter((record: any) => record.selected).length,
                  records: memoryAudit.explain.records?.slice(0, 12),
                  skills: memoryAudit.explain.skills?.slice(0, 8),
                  safety: memoryAudit.explain.safety
                } : undefined,
                migration: memoryAudit.migration
              }, null, 2)}</pre>
            ) : null}
          </section>
        ) : null}

        {active === "Configuration" ? (
          <>
            <section className="settings-card compact">
              <span>Fournisseur</span>
              <SettingSelect value={settings.provider} onChange={changeMainProvider} options={providerOptions} />
              <span>Modele</span>
              <SettingSelect
                value={settings.modelLabel}
                onChange={(value) => onChange({ modelLabel: value })}
                options={modelsForProvider(settings.provider, settings.modelLabel)}
              />
              <span>Espace de travail</span>
              <input value={settings.workspacePath} onChange={(e) => onChange({ workspacePath: e.target.value })} />
              <span>Nom affiche</span>
              <input value={settings.displayName} onChange={(e) => onChange({ displayName: e.target.value })} />
              <span>Revision automatique</span>
              <SettingSelect value={settings.autoReview ? "on" : "off"} onChange={(value) => onChange({ autoReview: value === "on" })} options={onOffOptions} />
            </section>

            <section className="settings-section capability-doctor">
              <h2>Capability Doctor</h2>
              <div className="settings-card">
                <div>
                  <strong>Etat reel des fonctions</strong>
                  <p>Lecture seule. Ne lit pas le clipboard, n'ouvre pas de navigateur, ne modifie pas Git, ne lance pas Pi.</p>
                </div>
                <button disabled={capabilitiesLoading} onClick={() => void refreshCapabilities()}><Icon name="search" /> {capabilitiesLoading ? "Lecture..." : "Rafraichir"}</button>
              </div>
              {capabilities ? (
                <>
                  <div className="capability-summary">
                    <span><strong>{capabilities.summary.ready}</strong> usable</span>
                    <span><strong>{capabilities.summary.counts.partial}</strong> partial</span>
                    <span><strong>{capabilities.summary.counts.missing}</strong> missing</span>
                    <span><strong>{capabilities.summary.counts["unsafe-by-default"]}</strong> unsafe</span>
                  </div>
                  {capabilitiesError ? <p className="settings-status warning">Rapport ancien: {capabilitiesError}</p> : null}
                  <div className="capability-grid">
                    {capabilities.capabilities.map((item) => (
                      <article key={item.id} className={`capability-card ${item.status}`}>
                        <header>
                          <div>
                            <span>{item.category}</span>
                            <strong>{item.label}</strong>
                          </div>
                          <em>{item.status}</em>
                        </header>
                        <p>{item.summary}</p>
                        <div className="capability-meta">
                          <span>risk</span><strong>{item.risk}</strong>
                          <span>available</span><strong>{item.available ? "yes" : "no"}</strong>
                          <span>configured</span><strong>{item.configured ? "yes" : "no"}</strong>
                        </div>
                        {item.checks.length ? (
                          <div className="capability-checks">
                            {item.checks.slice(0, 4).map((check) => (
                              <span key={`${item.id}-${check.label}`} className={check.ok ? "ok" : "warn"} title={check.detail}>
                                <Icon name={check.ok ? "check" : "circle"} size={12} /> {check.label}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <details>
                          <summary>Evidence</summary>
                          <ul>
                            {item.evidence.map((entry) => <li key={entry}>{entry}</li>)}
                          </ul>
                          <p>{item.nextAction}</p>
                        </details>
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <p className={`settings-status${capabilitiesError ? " warning" : ""}`}>{capabilitiesError || "Aucun rapport charge."}</p>
              )}
            </section>

            <section className="settings-section run-history">
              <h2>Run History</h2>
              <div className="settings-card">
                <div>
                  <strong>Runs locaux</strong>
                  <p>Lecture seule depuis le run ledger. Les prompts sont reduits a un apercu nettoye.</p>
                </div>
                <button disabled={runsLoading} onClick={() => void refreshRuns()}>
                  <Icon name="clock" /> {runsLoading ? "Lecture..." : "Rafraichir"}
                </button>
              </div>
              {runsReport ? (
                <>
                  <div className="run-summary">
                    <span><strong>{runsReport.counts.total}</strong> total</span>
                    <span><strong>{runsReport.counts.active}</strong> active</span>
                    <span><strong>{runsReport.counts.failed}</strong> failed/stopped</span>
                    <span><strong>{runsReport.readOnly ? "on" : "off"}</strong> read-only</span>
                  </div>
                  {runsError ? <p className="settings-status warning">Rapport ancien: {runsError}</p> : null}
                  {runsReport.runs.length ? (
                    <div className="run-list">
                      {runsReport.runs.map((run) => (
                        <article key={run.id} className={`run-card ${run.status}`}>
                          <header>
                            <div>
                              <span>{formatRunTime(run.startedAt)} · {formatRunDuration(run)}</span>
                              <strong>{run.promptPreview || "No prompt preview"}</strong>
                            </div>
                            <em>{run.status}</em>
                          </header>
                          <div className="run-meta">
                            <span>run</span><strong title={run.id}>{shortId(run.id)}</strong>
                            <span>session</span><strong title={run.sessionId ?? ""}>{shortId(run.sessionId)}</strong>
                            <span>project</span><strong title={run.projectId ?? ""}>{shortId(run.projectId)}</strong>
                            <span>events</span><strong>{run.eventCount}</strong>
                          </div>
                          <footer>
                            <span>{run.lastEventType || "no event"}</span>
                            {run.lastError ? <strong title={run.lastError}>{run.lastError}</strong> : null}
                          </footer>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="settings-status">Aucun run enregistre pour l'instant.</p>
                  )}
                </>
              ) : (
                <p className={`settings-status${runsError ? " warning" : ""}`}>{runsError || "Aucun run charge."}</p>
              )}
            </section>

            <section className="settings-section">
              <h2>Dependances de l'espace de travail</h2>
              <div className="settings-card">
                <span>Mises a jour</span><button disabled={updateBusy} onClick={() => void checkAndInstallUpdate(setUpdateStatus)}><Icon name="play" /> {updateBusy ? "Verification..." : "Verifier"}</button>
                <span>Etat des mises a jour</span><span>{updateStatus.message || "Aucune verification lancee"}</span>
                <span>Backend local</span><button onClick={() => void diagnose()}><Icon name="search" /> Diagnostiquer</button>
                <span>Sessions Pi</span><button onClick={() => void runOpen("sessions")}><Icon name="folder" /> Ouvrir le dossier</button>
                <span>Configuration</span><button onClick={() => void runOpen("settings")}><Icon name="file" /> Ouvrir settings.json</button>
              </div>
            </section>
          </>
        ) : null}

        {active === "Raccourcis" ? (
          <section className="settings-section">
            <h2>Raccourcis actifs</h2>
            <div className="settings-card compact">
              <span>Envoyer</span><span>Enter</span>
              <span>Nouvelle ligne</span><span>Shift + Enter</span>
              <span>Commandes</span><span>/help, /attach, /compact, /beautiful-ui, /permissions, /sessions, /settings</span>
              <span>Piece jointe</span><button onClick={() => setActionStatus("Utilise le bouton trombone dans le composeur, ou tape /attach.")}><Icon name="paperclip" /> Montrer comment joindre</button>
            </div>
          </section>
        ) : null}

        {active === "Extensions" ? (
          <section className="settings-section">
            <h2>Extensions et contexte</h2>
            <div className="settings-card compact">
              <span>Advisor</span><span>Active depuis le composeur pour demander une passe de revision.</span>
              <span>Pi Advisor reel</span><span>{advisorStatus?.installed ? `${advisorStatus.config?.provider}/${advisorStatus.config?.model} dans ${advisorStatus.configPath}` : "Package pi-advisor manquant. Relance npm install ou l'updater."}</span>
              <span>Configurer Advisor</span><button onClick={() => void refreshAdvisorStatus()}><Icon name="shield" /> Lire pi-advisor</button>
              <span>Pi Subagents reel</span><span>{subagentStatus?.installed ? `${subagentStatus.engine}@${subagentStatus.version ?? "?"} dans ${subagentStatus.configPath}` : "Package pi-subagents manquant."}</span>
              <span>Configurer Subagents</span><button onClick={() => void refreshSubagentStatus()}><Icon name="plug" /> Lire pi-subagents</button>
              <span>Beautiful UI Mode</span><span>{beautifulUiStatus?.ok ? `Skill charge via ${beautifulUiStatus.loadedBy} dans ${beautifulUiStatus.skillDir}` : "Skill non prepare."}</span>
              <span>Verifier Beautiful UI</span><button onClick={() => void refreshBeautifulUiStatus()}><Icon name="layout" /> Lire beautiful-ui</button>
              <span>Web guidance</span><SettingSelect value={settings.webEnabled ? "on" : "off"} onChange={(value) => onChange({ webEnabled: value === "on" })} options={onOffOptions} />
              <span>Chrome</span><SettingSelect value={settings.chromeEnabled ? "on" : "off"} onChange={(value) => onChange({ chromeEnabled: value === "on" })} options={onOffOptions} />
              <span>Computer use</span><SettingSelect value={settings.computerUseEnabled ? "on" : "off"} onChange={(value) => onChange({ computerUseEnabled: value === "on" })} options={onOffOptions} />
              <span>Contexte</span><span>Active depuis le composeur pour inclure les chemins et sessions locales.</span>
              <span>Extensions Pi</span><button onClick={() => void runOpen("config")}><Icon name="folder" /> Ouvrir le dossier config</button>
              <span>Diagnostics</span><button onClick={() => void diagnose()}><Icon name="search" /> Verifier l'environnement</button>
            </div>
          </section>
        ) : null}

        {active === "Git" ? (
          <section className="settings-section">
            <h2>Git local</h2>
            <div className="settings-card compact">
              <span>Nom Git</span><input value={gitName} placeholder="Your name" onChange={(e) => setGitName(e.target.value)} />
              <span>Email Git</span><input value={gitEmail} placeholder="you@example.com" onChange={(e) => setGitEmail(e.target.value)} />
              <span>Configurer Git</span><button onClick={async () => {
                setActionStatus("Configuring Git...");
                const response = await fetch(apiUrl("/api/git/config"), {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: gitName, email: gitEmail, defaultBranch: "main" })
                });
                const data = await response.json();
                setActionStatus(data.ok ? "Git user configured." : data.error ?? "Git configuration failed.");
              }}><Icon name="check" /> Save Git identity</button>
              <span>Branche</span><span>Pi utilise le workspace courant et les permissions choisies.</span>
              <span>Mode</span><SettingSelect value={settings.approvalPolicy} onChange={(value) => onChange({ approvalPolicy: value })} options={approvalOptions} />
              <span>GitHub</span><SettingSelect value={settings.githubEnabled ? "on" : "off"} onChange={(value) => onChange({ githubEnabled: value === "on" })} options={onOffOptions} />
              <span>Authentification GitHub</span>
              <button onClick={() => void connectGithub()}><Icon name="link" /> {githubStatus?.connected ? "Reconnecter" : "Connecter GitHub"}</button>
              <span>Etat GitHub</span>
              <span>{githubStatus?.connected ? `Connecte ${githubStatus.gcmAccounts?.join(", ") || ""}` : githubStatus?.gcmAvailable ? "Git Credential Manager pret" : "GitHub CLI ou GCM requis"}</span>
              <span>Verifier</span><button onClick={() => void diagnose()}><Icon name="terminal" /> Lire diagnostics Git/agent</button>
            </div>
          </section>
        ) : null}

        {actionStatus ? <p className="settings-status">{actionStatus}</p> : null}
        {diagnostics ? <pre className="diagnostics-output">{JSON.stringify(diagnostics, null, 2)}</pre> : null}
      </div>
    </section>
  );
}
