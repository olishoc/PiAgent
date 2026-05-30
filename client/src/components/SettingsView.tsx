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
                <p>Controle quand PiAgent demande une approbation avant d'agir.</p>
              </div>
              <select value={settings.approvalPolicy} onChange={(e) => onChange({ approvalPolicy: e.target.value as AppSettings["approvalPolicy"] })}>
                <option value="on-request">On request</option>
                <option value="on-failure">On failure</option>
                <option value="never">Never</option>
              </select>
              <div>
                <strong>Acces de l'agent</strong>
                <p>Applique les drapeaux Pi au prochain lancement de session.</p>
              </div>
              <select value={settings.accessMode} onChange={(e) => onChange({ accessMode: e.target.value as AppSettings["accessMode"] })}>
                <option value="read-only">Lecture seule</option>
                <option value="limited">Limite</option>
                <option value="full">Acces complet</option>
              </select>
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
              <select value={settings.theme} onChange={(e) => onChange({ theme: e.target.value as AppSettings["theme"] })}>
                <option value="dark">Fonce</option>
                <option value="light">Clair</option>
                <option value="system">Systeme</option>
              </select>
              <span>Palette</span>
              <select value={settings.themePreset} onChange={(e) => onChange({ themePreset: e.target.value as AppSettings["themePreset"] })}>
                <option value="codex">Codex</option>
                <option value="graphite">Graphite</option>
                <option value="midnight">Midnight</option>
                <option value="ember">Ember</option>
                <option value="absolute">Absolutely</option>
                <option value="paper">Paper light</option>
                <option value="dawn">Dawn light</option>
                <option value="contrast">High contrast</option>
              </select>
              <span>Accent</span>
              <input type="color" value={settings.accentColor} onChange={(e) => onChange({ accentColor: e.target.value })} />
              <span>Densite</span>
              <select value={settings.density} onChange={(e) => onChange({ density: e.target.value as AppSettings["density"] })}>
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </select>
              <span>Texte du chat</span>
              <select value={settings.textDensity} onChange={(e) => onChange({ textDensity: e.target.value as AppSettings["textDensity"] })}>
                <option value="compact">Compact</option>
                <option value="codex">Codex</option>
                <option value="comfortable">Comfortable</option>
                <option value="custom">Personnalise</option>
              </select>
              <span>Police</span>
              <select
                value={codexFontLocked ? "\"OpenAI Sans\", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif" : settings.fontFamily}
                disabled={codexFontLocked}
                title={codexFontLocked ? "La palette Codex utilise sa police systeme pour garder le style exact." : undefined}
                onChange={(e) => onChange({ fontFamily: e.target.value })}
              >
                <option value={"\"OpenAI Sans\", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"}>OpenAI Sans style</option>
                <option value={"\"SF Mono\", \"Fira Code\", \"Cascadia Code\", \"Consolas\", monospace"}>SF Mono stack</option>
                <option value={"\"Cascadia Code\", \"Consolas\", monospace"}>Cascadia Code</option>
                <option value={"\"Fira Code\", \"Cascadia Code\", monospace"}>Fira Code</option>
                <option value={"\"Consolas\", monospace"}>Consolas</option>
                <option value={"Inter, Arial, sans-serif"}>Inter style</option>
              </select>
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
              <select value={settings.provider} onChange={(e) => onChange({ provider: e.target.value as AppSettings["provider"] })}>
                <option value="openai-codex">OpenAI Codex OAuth</option>
                <option value="openai">OpenAI API</option>
                <option value="anthropic">Claude</option>
                <option value="openrouter">OpenRouter</option>
              </select>
              <span>Modele</span>
              <input value={settings.modelLabel} onChange={(e) => onChange({ modelLabel: e.target.value })} />
              <span>Thinking</span>
              <select value={settings.thinkingLevel} onChange={(e) => onChange({ thinkingLevel: e.target.value as AppSettings["thinkingLevel"] })}>
                <option value="off">Off</option>
                <option value="minimal">Minimal</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="xhigh">XHigh</option>
              </select>
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
              <select value={settings.subagentsEnabled ? "on" : "off"} onChange={(e) => onChange({ subagentsEnabled: e.target.value === "on", autoLaunchSubagents: e.target.value === "on" })}>
                <option value="on">Actifs</option>
                <option value="off">Desactives</option>
              </select>
              <span>Delegation automatique</span>
              <select value={settings.subagentRoutingMode} onChange={(e) => onChange({ subagentRoutingMode: e.target.value as AppSettings["subagentRoutingMode"], autoLaunchSubagents: e.target.value !== "manual", subagentsEnabled: true })}>
                <option value="manual">Manuel</option>
                <option value="assistive">Assistif</option>
                <option value="automatic">Automatique</option>
              </select>
              <span>Max parallele</span>
              <input type="number" min="1" max="8" value={settings.subagentMaxParallel} onChange={(e) => onChange({ subagentMaxParallel: Number(e.target.value) })} />
              <span>Async par defaut</span>
              <select value={settings.subagentAsyncByDefault ? "on" : "off"} onChange={(e) => onChange({ subagentAsyncByDefault: e.target.value === "on" })}>
                <option value="on">Runs longs en arriere-plan</option>
                <option value="off">Foreground</option>
              </select>
              <span>Profondeur max</span>
              <input type="number" min="0" max="3" value={settings.subagentMaxDepth} onChange={(e) => onChange({ subagentMaxDepth: Number(e.target.value) })} />
              <span>Modele des enfants</span>
              <input value={settings.subagentModel} onChange={(e) => onChange({ subagentModel: e.target.value || "inherit" })} />
              <span>Thinking enfants</span>
              <select value={settings.subagentThinking} onChange={(e) => onChange({ subagentThinking: e.target.value as AppSettings["subagentThinking"] })}>
                <option value="minimal">Minimal</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="xhigh">XHigh</option>
              </select>
              <span>Review loop</span>
              <select value={settings.subagentReviewLoop ? "on" : "off"} onChange={(e) => onChange({ subagentReviewLoop: e.target.value === "on" })}>
                <option value="on">Worker puis reviewers</option>
                <option value="off">Ne pas forcer</option>
              </select>
              <span>Worktrees</span>
              <select value={settings.subagentUseWorktrees ? "on" : "off"} onChange={(e) => onChange({ subagentUseWorktrees: e.target.value === "on" })}>
                <option value="off">Single writer par defaut</option>
                <option value="on">Isoler les runs paralleles si Git est clean</option>
              </select>
              <span>Intercom</span>
              <select value={settings.subagentIntercomMode} onChange={(e) => onChange({ subagentIntercomMode: e.target.value as AppSettings["subagentIntercomMode"] })}>
                <option value="off">Off</option>
                <option value="fork-only">Fork only</option>
                <option value="always">Always</option>
              </select>
              <span>Status sous-agents</span>
              <button onClick={() => void refreshSubagentStatus()}><Icon name="plug" /> Verifier pi-subagents</button>
              <span>Advisor</span>
              <select value={settings.advisorEnabled ? "on" : "off"} onChange={(e) => onChange({ advisorEnabled: e.target.value === "on" })}>
                <option value="on">Active</option>
                <option value="off">Desactive</option>
              </select>
              <span>Advisor modele</span>
              <input value={`${settings.advisorProvider}/${settings.advisorModel}`} onChange={(e) => {
                const [provider, ...modelParts] = e.target.value.split("/");
                if (provider && modelParts.length) onChange({ advisorProvider: provider, advisorModel: modelParts.join("/") });
              }} />
              <span>Advisor reasoning</span>
              <select value={settings.advisorReasoning} onChange={(e) => onChange({ advisorReasoning: e.target.value as AppSettings["advisorReasoning"] })}>
                <option value="minimal">Minimal</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="xhigh">XHigh</option>
              </select>
              <span>Advisor max/run</span>
              <input type="number" min="1" max="12" value={settings.advisorMaxUsesPerRun} onChange={(e) => onChange({ advisorMaxUsesPerRun: Number(e.target.value) })} />
              <span>Advisor status</span>
              <button onClick={() => void refreshAdvisorStatus()}><Icon name="shield" /> Verifier pi-advisor</button>
              <span>Web guidance</span>
              <select value={settings.webEnabled ? "on" : "off"} onChange={(e) => onChange({ webEnabled: e.target.value === "on" })}>
                <option value="on">Active</option>
                <option value="off">Desactive</option>
              </select>
              <span>Chrome</span>
              <select value={settings.chromeEnabled ? "on" : "off"} onChange={(e) => onChange({ chromeEnabled: e.target.value === "on" })}>
                <option value="on">Active</option>
                <option value="off">Desactive</option>
              </select>
              <span>Contexte</span>
              <select value={settings.contextEnabled ? "on" : "off"} onChange={(e) => onChange({ contextEnabled: e.target.value === "on" })}>
                <option value="on">Active</option>
                <option value="off">Desactive</option>
              </select>
              <span>Acces ordinateur</span>
              <select value={settings.computerUseEnabled ? "on" : "off"} onChange={(e) => onChange({ computerUseEnabled: e.target.value === "on" })}>
                <option value="on">Active</option>
                <option value="off">Desactive</option>
              </select>
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
              <select value={settings.longRunningMode ? "on" : "off"} onChange={(e) => onChange({ longRunningMode: e.target.value === "on" })}>
                <option value="on">Active</option>
                <option value="off">Desactive</option>
              </select>
              <span>Advisor automatique</span>
              <select value={settings.autoLaunchAdvisor ? "on" : "off"} onChange={(e) => onChange({ autoLaunchAdvisor: e.target.value === "on", autoReview: e.target.value === "on" })}>
                <option value="on">Active</option>
                <option value="off">Desactive</option>
              </select>
              <span>Sous-agents automatiques</span>
              <select value={settings.autoLaunchSubagents ? "on" : "off"} onChange={(e) => onChange({ autoLaunchSubagents: e.target.value === "on", subagentsEnabled: e.target.value === "on", subagentRoutingMode: e.target.value === "on" ? "automatic" : "manual" })}>
                <option value="on">Deleguer automatiquement</option>
                <option value="off">Manuel</option>
              </select>
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
              <select value={settings.memoryMode} onChange={(e) => onChange({ memoryMode: e.target.value as AppSettings["memoryMode"], memoryEnabled: e.target.value !== "off" })}>
                <option value="off">Off</option>
                <option value="manual">Manual only</option>
                <option value="assistive">Assistive</option>
                <option value="deep">Deep Hermes-style</option>
              </select>
              <span>Memoire PiAgent</span>
              <select value={settings.memoryEnabled ? "on" : "off"} onChange={(e) => onChange({ memoryEnabled: e.target.value === "on", memoryMode: e.target.value === "on" ? "deep" : "off" })}>
                <option value="on">Active</option>
                <option value="off">Desactivee</option>
              </select>
              <span>Injection automatique</span>
              <select value={settings.memoryAutoInject ? "on" : "off"} onChange={(e) => onChange({ memoryAutoInject: e.target.value === "on" })}>
                <option value="on">Recuperer un petit contexte pertinent</option>
                <option value="off">Recherche manuelle seulement</option>
              </select>
              <span>Apprendre des chats</span>
              <select value={settings.memoryLearnFromChats ? "on" : "off"} onChange={(e) => onChange({ memoryLearnFromChats: e.target.value === "on" })}>
                <option value="on">Extraire preferences, workflows, decisions</option>
                <option value="off">Ne pas apprendre automatiquement</option>
              </select>
              <span>Apprendre les outils</span>
              <select value={settings.memoryLearnTools ? "on" : "off"} onChange={(e) => onChange({ memoryLearnTools: e.target.value === "on" })}>
                <option value="on">Construire une memoire de skills/outils</option>
                <option value="off">Ne pas suivre les outils</option>
              </select>
              <span>Profil global</span>
              <select value={settings.memoryProfileEnabled ? "on" : "off"} onChange={(e) => onChange({ memoryProfileEnabled: e.target.value === "on" })}>
                <option value="on">Peer card globale</option>
                <option value="off">Souvenirs sans profil</option>
              </select>
              <span>Journal d'observations</span>
              <select value={settings.memoryEventLogEnabled ? "on" : "off"} onChange={(e) => onChange({ memoryEventLogEnabled: e.target.value === "on" })}>
                <option value="on">Conserver un journal inspectable</option>
                <option value="off">Souvenirs seulement</option>
              </select>
              <span>Memoire episodique</span>
              <select value={settings.memoryEpisodicEnabled ? "on" : "off"} onChange={(e) => onChange({ memoryEpisodicEnabled: e.target.value === "on" })}>
                <option value="on">Messages, outils et checkpoints consultables</option>
                <option value="off">Seulement faits durables</option>
              </select>
              <span>Rappel hybride</span>
              <select value={settings.memoryHybridRecallEnabled ? "on" : "off"} onChange={(e) => onChange({ memoryHybridRecallEnabled: e.target.value === "on" })}>
                <option value="on">Faits + episodes + entites + recence</option>
                <option value="off">Contexte durable seulement</option>
              </select>
              <span>Corrections</span>
              <select value={settings.memoryCorrectionsEnabled ? "on" : "off"} onChange={(e) => onChange({ memoryCorrectionsEnabled: e.target.value === "on" })}>
                <option value="on">Superseder les souvenirs faux</option>
                <option value="off">Archivage manuel seulement</option>
              </select>
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
              <select value={settings.provider} onChange={(e) => onChange({ provider: e.target.value as AppSettings["provider"] })}>
                <option value="openai-codex">OpenAI Codex OAuth</option>
                <option value="openai">OpenAI API</option>
                <option value="anthropic">Claude</option>
                <option value="openrouter">OpenRouter</option>
              </select>
              <span>Espace de travail</span>
              <input value={settings.workspacePath} onChange={(e) => onChange({ workspacePath: e.target.value })} />
              <span>Nom affiche</span>
              <input value={settings.displayName} onChange={(e) => onChange({ displayName: e.target.value })} />
              <span>Revision automatique</span>
              <select value={settings.autoReview ? "on" : "off"} onChange={(e) => onChange({ autoReview: e.target.value === "on" })}>
                <option value="on">Activee</option>
                <option value="off">Desactivee</option>
              </select>
            </section>

            <section className="settings-section">
              <h2>Dependances de l'espace de travail</h2>
              <div className="settings-card">
                <span>Mises a jour PiAgent</span><button disabled={updateBusy} onClick={() => void checkAndInstallUpdate(setUpdateStatus)}><Icon name="play" /> {updateBusy ? "Verification..." : "Verifier"}</button>
                <span>Etat des mises a jour</span><span>{updateStatus.message || "Aucune verification lancee"}</span>
                <span>Backend PiAgent</span><button onClick={() => void diagnose()}><Icon name="search" /> Diagnostiquer</button>
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
              <span>Web guidance</span><select value={settings.webEnabled ? "on" : "off"} onChange={(e) => onChange({ webEnabled: e.target.value === "on" })}>
                <option value="on">Active</option>
                <option value="off">Desactive</option>
              </select>
              <span>Chrome</span><select value={settings.chromeEnabled ? "on" : "off"} onChange={(e) => onChange({ chromeEnabled: e.target.value === "on" })}>
                <option value="on">Active</option>
                <option value="off">Desactive</option>
              </select>
              <span>Computer use</span><select value={settings.computerUseEnabled ? "on" : "off"} onChange={(e) => onChange({ computerUseEnabled: e.target.value === "on" })}>
                <option value="on">Active</option>
                <option value="off">Desactive</option>
              </select>
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
              <span>Mode</span><select value={settings.approvalPolicy} onChange={(e) => onChange({ approvalPolicy: e.target.value as AppSettings["approvalPolicy"] })}>
                <option value="on-request">Demander avant action risquee</option>
                <option value="on-failure">Demander en cas d'echec</option>
                <option value="never">Ne jamais demander</option>
              </select>
              <span>GitHub</span><select value={settings.githubEnabled ? "on" : "off"} onChange={(e) => onChange({ githubEnabled: e.target.value === "on" })}>
                <option value="on">Active</option>
                <option value="off">Desactive</option>
              </select>
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
