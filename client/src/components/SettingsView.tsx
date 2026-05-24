import { AppSettings } from "../App";
import { useState } from "react";
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
  onChange: (patch: Partial<AppSettings>) => void;
}

export default function SettingsView({ settings, onChange }: SettingsViewProps) {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ state: "idle", message: "" });
  const updateBusy = updateStatus.state === "checking" || updateStatus.state === "available" || updateStatus.state === "installing";

  return (
    <section className="settings-layout">
      <nav className="settings-nav">
        <button onClick={() => onChange({ onboardingComplete: true })}>← Retour a l'appli</button>
        {nav.map((item) => <button key={item} className={item === "General" ? "active" : ""}>{item}</button>)}
      </nav>
      <div className="settings-content">
        <h1>General</h1>
        <section className="settings-section">
          <h2>Mode de travail</h2>
          <div className="mode-grid">
            <button className="selected">▻ Pour le codage<span>Reponses techniques et controle avance</span></button>
            <button>☁ Pour le travail quotidien<span>Meme puissance, moins de details techniques</span></button>
          </div>
        </section>

        <section className="settings-card">
          <div>
            <strong>Autorisations par defaut</strong>
            <p>PiAgent peut demander un acces supplementaire selon le mode choisi.</p>
          </div>
          <select value={settings.approvalPolicy} onChange={(e) => onChange({ approvalPolicy: e.target.value as AppSettings["approvalPolicy"] })}>
            <option value="on-request">On request</option>
            <option value="on-failure">On failure</option>
            <option value="never">Never</option>
          </select>
          <div>
            <strong>Acces de l'agent</strong>
            <p>Ces options appliquent des drapeaux Pi au lancement. Ce n'est pas un bac a sable OS complet.</p>
          </div>
          <select value={settings.accessMode} onChange={(e) => onChange({ accessMode: e.target.value as AppSettings["accessMode"] })}>
            <option value="read-only">Lecture seule</option>
            <option value="limited">Limite</option>
            <option value="full">Acces complet</option>
          </select>
        </section>

        <section className="settings-section">
          <h2>Apparence</h2>
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
            <span>Modele</span>
            <input value={settings.modelLabel} onChange={(e) => onChange({ modelLabel: e.target.value })} />
            <span>Espace de travail</span>
            <input value={settings.workspacePath} onChange={(e) => onChange({ workspacePath: e.target.value })} />
          </div>
        </section>

        <section className="settings-section">
          <h2>Dependances de l'espace de travail</h2>
          <div className="settings-card">
            <span>Mises a jour PiAgent</span><button disabled={updateBusy} onClick={() => void checkAndInstallUpdate(setUpdateStatus)}>{updateBusy ? "Verification..." : "Verifier"}</button>
            <span>Etat des mises a jour</span><span>{updateStatus.message || "Aucune verification lancee"}</span>
            <span>Backend PiAgent</span><button disabled title="Diagnostics natifs a cabler apres packaging Tauri">Diagnostiquer</button>
            <span>Extensions Pi</span><button disabled title="Ouverture de dossier a cabler apres packaging Tauri">Ouvrir le dossier</button>
            <span>Configuration</span><button disabled title="Edition de fichier a cabler apres packaging Tauri">Ouvrir settings.json</button>
          </div>
        </section>
      </div>
    </section>
  );
}
