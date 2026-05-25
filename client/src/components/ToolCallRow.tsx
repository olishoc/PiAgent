import { useState } from "react";
import { ToolMessage } from "../hooks/useAgent";
import Icon from "./Icon";

const icon = {
  running: "clock",
  done: "check",
  error: "x"
} as const;

export default function ToolCallRow({ message }: { message: ToolMessage }) {
  const [expanded, setExpanded] = useState(false);
  const args = message.args ? JSON.stringify(message.args, null, 2) : "";
  const elapsed = message.startedAt && message.endedAt ? `${Math.max(0.1, (message.endedAt - message.startedAt) / 1000).toFixed(1)}s` : "";
  return (
    <div className={`tool-row ${message.status}`}>
      <button className="tool-summary" onClick={() => setExpanded((current) => !current)}>
        <span className="tool-icon"><Icon name={icon[message.status]} size={14} /></span>
        <span className="tool-text">{message.toolName}{message.status === "error" ? " (error)" : ""}</span>
        {elapsed ? <span className="tool-elapsed">{elapsed}</span> : null}
        {args ? <Icon name="chevronDown" size={13} /> : null}
      </button>
      {expanded && args ? <pre className="tool-args">{args}</pre> : null}
    </div>
  );
}
