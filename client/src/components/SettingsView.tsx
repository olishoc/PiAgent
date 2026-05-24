import { useState } from "react";
import { AppSettings } from "../App";
import { apiUrl } from "../lib/api";
import { checkAndInstallUpdate, UpdateStatus } from "../lib/updater";

const nav = [
  "General",
  "Apparence",
  "Configuration",
  "Personnalisation",
  "Raccourcis clavier",
  "Serveurs MCP",
  "Hooks",
  "Connexions",
  "Git",
  "Environnements",
  "Arborescences de travail",
  "Navigateur",
  "Utilisation de l'ordinateur",
  "Clavardages archives",
  "Utilisation et facturation"
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
        <button onClick={onBack}>{"<"} Retour a l'appli</button>
        {nav.map((item) => (
          <button key={item} className={item === active ? "active" : ""} onClick={() => setActive(item)}>
            {item}
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
                <button className="selected" onClick={() => onChange({ accessMode: "full" })}>
                  [code] Pour le codage<span>Reponses techniques, outils actifs, workflow Pi complet</span>
                </button>
                <button onClick={() => onChange({ accessMode: "limited" })}>
                  [chat] Pour le travail quotidien<span>Moins d'outils actifs par defaut, meme modele</span>
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
                <option value="system">Systeme</option>
              </select>
              <span>Police de code</span>
              <input value={"SF Mono / Cascadia Code"} readOnly />
              <span>Contraste</span>
              <input value={"Codex dark"} readOnly />
            </div>
          </section>
        ) : null}

        {active === "Configuration" ? (
          <>
            <section className="settings-card compact">
              <span>Modele</span>
              <input value={settings.modelLabel} onChange={(e) => onChange({ modelLabel: e.target.value })} />
              <span>Espace de travail</span>
              <input value={settings.workspacePath} onChange={(e) => onChange({ workspacePath: e.target.value })} />
              <span>Nom affiche</span>
              <input value={settings.displayName} onChange={(e) => onChange({ displayName: e.target.value })} />
            </section>

            <section className="settings-section">
              <h2>Dependances de l'espace de travail</h2>
              <div className="settings-card">
                <span>Mises a jour PiAgent</span><button disabled={updateBusy} onClick={() => void checkAndInstallUpdate(setUpdateStatus)}>{updateBusy ? "Verification..." : "Verifier"}</button>
                <span>Etat des mises a jour</span><span>{updateStatus.message || "Aucune verification lancee"}</span>
                <span>Backend PiAgent</span><button onClick={() => void diagnose()}>Diagnostiquer</button>
                <span>Sessions Pi</span><button onClick={() => void runOpen("sessions")}>Ouvrir le dossier</button>
                <span>Configuration</span><button onClick={() => void runOpen("settings")}>Ouvrir settings.json</button>
              </div>
            </section>
          </>
        ) : null}

        {active !== "General" && active !== "Apparence" && active !== "Configuration" ? (
          <section className="settings-section">
            <div className="settings-card compact">
              <span>Etat</span><span>Ce panneau est pret. Les options avancees seront ajoutees ici sans casser le workflow principal.</span>
              <span>Action</span><button onClick={() => setActionStatus(`${active}: aucune action requise maintenant.`)}>Verifier</button>
            </div>
          </section>
        ) : null}

        {actionStatus ? <p className="settings-status">{actionStatus}</p> : null}
        {diagnostics ? <pre className="diagnostics-output">{JSON.stringify(diagnostics, null, 2)}</pre> : null}
      </div>
    </section>
  );
}
