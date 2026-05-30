import { useEffect, useState } from "react";
import { AppSettings } from "../App";
import { apiUrl } from "../lib/api";
import { checkAndInstallUpdate, UpdateStatus } from "../lib/updater";
import Icon, { IconName } from "./Icon";

const nav: Array<{ id: string; label: string; icon: IconName }> = [
  { id: "General", label: "General", icon: "gear" },
  { id: "Apparence", label: "Apparence", icon: "spark" },
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
  onBack: () => void;
  onChange: (patch: Partial<AppSettings>) => void;
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
  const selected = options.find((option) => option.value === value) ?? options[0];
  return (
    <div className={`setting-select ${open ? "open" : ""} ${disabled ? "disabled" : ""}`} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}>
      <button type="button" disabled={disabled} title={title} onClick={() => setOpen((current) => !current)}>
        <span>{selected?.label ?? value}</span>
        {selected?.note ? <em>{selected.note}</em> : null}
        <Icon name="chevronDown" size={13} />
      </button>
      {open && !disabled ? (
        <div className="setting-select-menu" role="listbox">
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
      ) : null}
    </div>
  );
}

const onOffOptions: Array<SettingSelectOption<"on" | "off">> = [
  { value: "on", label: "Active" },
  { value: "off", label: "Desactive" }
];

const thinkingOptions: Array<SettingSelectOption<AppSettings["thinkingLevel"]>> = [
  { value: "high", label: "High", note: "thinking mode" },
  { value: "xhigh", label: "High+", note: "max" },
  { value: "medium", label: "Medium", note: "balanced" },
  { value: "low", label: "Low" },
  { value: "minimal", label: "Minimal" },
  { value: "off", label: "Direct mode" }
];

const reasoningOptions: Array<SettingSelectOption<AppSettings["advisorReasoning"]>> = [
  { value: "high", label: "High", note: "thinking mode" },
  { value: "xhigh", label: "High+", note: "max" },
  { value: "medium", label: "Medium", note: "balanced" },
  { value: "low", label: "Low" },
  { value: "minimal", label: "Minimal" }
];

const providerOptions: Array<SettingSelectOption<AppSettings["provider"]>> = [
  { value: "openai-codex", label: "OpenAI Codex OAuth", note: "recommended" },
  { value: "openai", label: "OpenAI API" },
  { value: "anthropic", label: "Claude" },
  { value: "openrouter", label: "OpenRouter" }
];

const approvalOptions: Array<SettingSelectOption<AppSettings["approvalPolicy"]>> = [
  { value: "on-request", label: "On request", note: "safer" },
  { value: "on-failure", label: "On failure", note: "faster" },
  { value: "never", label: "Never", note: "autonomous" }
];

export default function SettingsView({ settings, onBack, onChange }: SettingsViewProps) {
  const [active, setActive] = useState("General");
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ state: "idle", message: "" });
  const [actionStatus, setActionStatus] = useState("");
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [gitName, setGitName] = useState("");
  const [gitEmail, setGitEmail] = useState("");
  const [githubStatus, setGithubStatus] = useState<any>(null);
  const [memoryStatus, setMemoryStatus] = useState<any>(null);
  const [advisorStatus, setAdvisorStatus] = useState<any>(null);
  const [subagentStatus, setSubagentStatus] = useState<any>(null);
  const [beautifulUiStatus, setBeautifulUiStatus] = useState<any>(null);
  const updateBusy = updateStatus.state === "checking" || updateStatus.state === "available" || updateStatus.state === "installing";
  const codexFontLocked = settings.themePreset === "codex";

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

  useEffect(() => {
    void refreshGithubStatus();
    void refreshAdvisorStatus();
    void refreshSubagentStatus();
    void refreshBeautifulUiStatus();
  }, []);

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
                onChange={(value) => onChange({ provider: value })}
                options={[
                  { value: "openai-codex", label: "OpenAI Codex OAuth", note: "recommended" },
                  { value: "openai", label: "OpenAI API" },
                  { value: "anthropic", label: "Claude" },
                  { value: "openrouter", label: "OpenRouter" }
                ]}
              />
              <span>Modele</span>
              <input value={settings.modelLabel} onChange={(e) => onChange({ modelLabel: e.target.value })} />
              <span>Thinking</span>
              <SettingSelect
                value={settings.thinkingLevel}
                onChange={(value) => onChange({ thinkingLevel: value })}
                options={[
                  { value: "medium", label: "Thinking mode", note: "balanced" },
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
              <input value={settings.subagentModel} onChange={(e) => onChange({ subagentModel: e.target.value || "inherit" })} />
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
              <span>Advisor</span>
              <SettingSelect
                value={settings.advisorEnabled ? "on" : "off"}
                onChange={(value) => onChange({ advisorEnabled: value === "on" })}
                options={onOffOptions}
              />
              <span>Advisor modele</span>
              <input value={`${settings.advisorProvider}/${settings.advisorModel}`} onChange={(e) => {
                const [provider, ...modelParts] = e.target.value.split("/");
                if (provider && modelParts.length) onChange({ advisorProvider: provider, advisorModel: modelParts.join("/") });
              }} />
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
              <span>Consolidation</span>
              <button onClick={() => void consolidateMemory()}><Icon name="spark" /> Apprendre depuis les anciennes sessions</button>
              <span>Dossier memoire</span>
              <button onClick={() => void runOpen("config")}><Icon name="folder" /> Ouvrir la configuration</button>
            </div>
            {memoryStatus ? (
              <pre className="diagnostics-output">{JSON.stringify({
                backend: memoryStatus.backend,
                version: memoryStatus.version,
                count: memoryStatus.count,
                activeCount: memoryStatus.activeCount,
                episodeCount: memoryStatus.episodeCount,
                eventCount: memoryStatus.eventCount,
                correctionCount: memoryStatus.correctionCount,
                byScope: memoryStatus.byScope,
                byKind: memoryStatus.byKind,
                byTier: memoryStatus.byTier,
                byStatus: memoryStatus.byStatus,
                architecture: memoryStatus.architecture,
                profile: memoryStatus.profile
              }, null, 2)}</pre>
            ) : null}
          </section>
        ) : null}

        {active === "Configuration" ? (
          <>
            <section className="settings-card compact">
              <span>Modele</span>
              <input value={settings.modelLabel} onChange={(e) => onChange({ modelLabel: e.target.value })} />
              <span>Fournisseur</span>
              <SettingSelect value={settings.provider} onChange={(value) => onChange({ provider: value })} options={providerOptions} />
              <span>Espace de travail</span>
              <input value={settings.workspacePath} onChange={(e) => onChange({ workspacePath: e.target.value })} />
              <span>Nom affiche</span>
              <input value={settings.displayName} onChange={(e) => onChange({ displayName: e.target.value })} />
              <span>Revision automatique</span>
              <SettingSelect value={settings.autoReview ? "on" : "off"} onChange={(value) => onChange({ autoReview: value === "on" })} options={onOffOptions} />
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
