import { useState } from "react";
import { AppSettings } from "../App";
import { apiUrl } from "../lib/api";
import { checkAndInstallUpdate, UpdateStatus } from "../lib/updater";
import Icon, { IconName } from "./Icon";

const nav: Array<{ id: string; label: string; icon: IconName }> = [
  { id: "General", label: "General", icon: "gear" },
  { id: "Apparence", label: "Apparence", icon: "spark" },
  { id: "Configuration", label: "Configuration", icon: "shield" },
  { id: "Modeles", label: "Modeles", icon: "bot" },
  { id: "Sous-agents", label: "Sous-agents", icon: "plug" },
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
  const updateBusy = updateStatus.state === "checking" || updateStatus.state === "available" || updateStatus.state === "installing";

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
                  <Icon name="bot" /> Pour le travail quotidien<span>Moins d'outils actifs par defaut, meme modele</span>
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
            </div>
          </section>
        ) : null}

        {active === "Modeles" ? (
          <section className="settings-section">
            <h2>Modele, vitesse et thinking</h2>
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
              <span>Vitesse ChatGPT</span>
              <select value={settings.speedMode} onChange={(e) => onChange({ speedMode: e.target.value as AppSettings["speedMode"] })}>
                <option value="fast">Fast</option>
                <option value="balanced">Balanced</option>
                <option value="deep">Deep</option>
              </select>
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
            <h2>Sous-agents et outils actifs</h2>
            <div className="settings-card compact">
              <span>Advisor</span>
              <select value={settings.advisorEnabled ? "on" : "off"} onChange={(e) => onChange({ advisorEnabled: e.target.value === "on" })}>
                <option value="on">Active</option>
                <option value="off">Desactive</option>
              </select>
              <span>Web</span>
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
              <span>Commandes</span><span>/help, /attach, /compact, /permissions, /sessions, /settings</span>
              <span>Piece jointe</span><button onClick={() => setActionStatus("Utilise le bouton trombone dans le composeur, ou tape /attach.")}><Icon name="paperclip" /> Montrer comment joindre</button>
            </div>
          </section>
        ) : null}

        {active === "Extensions" ? (
          <section className="settings-section">
            <h2>Extensions et contexte</h2>
            <div className="settings-card compact">
              <span>Advisor</span><span>Active depuis le composeur pour demander une passe de revision.</span>
              <span>Web</span><select value={settings.webEnabled ? "on" : "off"} onChange={(e) => onChange({ webEnabled: e.target.value === "on" })}>
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
