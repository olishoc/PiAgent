import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { AppSettings } from "../App";
import { Attachment } from "../hooks/useAgent";

interface ComposerProps {
  onSend: (text: string, attachments?: Attachment[]) => void;
  disabled?: boolean;
  settings?: AppSettings;
}

const slashCommands = [
  { command: "/help", label: "Afficher les commandes PiAgent" },
  { command: "/new", label: "Nouveau clavardage" },
  { command: "/compact", label: "Compacter le contexte" },
  { command: "/model", label: "Changer de modele" },
  { command: "/permissions", label: "Ouvrir les permissions" },
  { command: "/attach", label: "Ajouter un fichier" },
  { command: "/sessions", label: "Lister les sessions" },
  { command: "/settings", label: "Ouvrir les parametres" }
];

export default function Composer({ onSend, disabled, settings }: ComposerProps) {
  const [text, setText] = useState("");
  const [tools, setTools] = useState({ web: false, advisor: false, context: true });
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showCommands, setShowCommands] = useState(false);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.style.height = "0px";
    ref.current.style.height = `${Math.min(ref.current.scrollHeight, 110)}px`;
  }, [text]);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed, attachments);
    setText("");
    setAttachments([]);
  };

  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const pickFiles = async () => {
    const tauri = (window as any).__TAURI_INTERNALS__;
    if (tauri) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({ multiple: true });
        const paths = Array.isArray(selected) ? selected : selected ? [selected] : [];
        setAttachments((current) => [
          ...current,
          ...paths.slice(0, 8).map((filePath) => ({
            id: crypto.randomUUID(),
            name: String(filePath).split(/[\\/]/).pop() ?? "file",
            path: String(filePath),
            kind: "file" as const
          }))
        ]);
        return;
      } catch {}
    }
    fileRef.current?.click();
  };

  return (
    <section className="composer">
      {showCommands ? (
        <div className="command-palette">
          {slashCommands.map((item) => (
            <button key={item.command} onClick={() => {
              setText(item.command + " ");
              setShowCommands(false);
              ref.current?.focus();
            }}>
              <strong>{item.command}</strong><span>{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
      {attachments.length ? (
        <div className="attachment-row">
          {attachments.map((file) => (
            <button key={file.id} onClick={() => setAttachments((items) => items.filter((item) => item.id !== file.id))}>
              [file] {file.name} x
            </button>
          ))}
        </div>
      ) : null}
      <textarea
        ref={ref}
        value={text}
        placeholder="ask pi to change code..."
        onChange={(event) => {
          setText(event.target.value);
          setShowCommands(event.target.value.startsWith("/"));
        }}
        onKeyDown={keyDown}
        rows={1}
      />
      <div className="composer-actions">
        <button className="attach-button" onClick={pickFiles} aria-label="attach file">+</button>
        <div className="tool-pills">
          <button className="access-pill enabled">{settings?.accessMode === "full" ? "Acces complet" : settings?.accessMode === "read-only" ? "Lecture seule" : "Acces limite"}</button>
          {(["web", "advisor", "context"] as const).map((tool) => (
            <button
              key={tool}
              className={tools[tool] ? "enabled" : ""}
              onClick={() => setTools((current) => ({ ...current, [tool]: !current[tool] }))}
            >
              {tool}
            </button>
          ))}
        </div>
        <div className="composer-meta">
          <span>{settings?.modelLabel ?? "openai/default"}</span>
        <button className="send-button" onClick={submit} disabled={!text.trim() || disabled} aria-label="send">Send</button>
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
            text: file.size <= 256_000 && !file.type.startsWith("image/") ? await file.text().catch(() => "") : undefined
          })));
          setAttachments((current) => [...current, ...next]);
          event.target.value = "";
        }}
      />
    </section>
  );
}
