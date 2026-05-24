import { ToolMessage } from "../hooks/useAgent";

const icon = {
  running: "⟳",
  done: "✓",
  error: "✗"
};

export default function ToolCallRow({ message }: { message: ToolMessage }) {
  const args = message.args ? ` ${JSON.stringify(message.args)}` : "";
  return (
    <div className={`tool-row ${message.status}`}>
      <span className="tool-icon">{icon[message.status]}</span>
      <span className="tool-text">{message.toolName}{message.status === "error" ? " (error)" : args}</span>
    </div>
  );
}
