import { useState } from "react";
import { ToolGroupMessage, ToolMessage } from "../hooks/useAgent";
import Icon from "./Icon";

const icon = {
  running: "clock",
  done: "check",
  error: "x"
} as const;

export default function ToolCallRow({ message }: { message: ToolMessage | ToolGroupMessage }) {
  const [expanded, setExpanded] = useState(false);
  const isGroup = message.kind === "tool_group";
  const tools = isGroup ? message.tools : [message];
  const args = !isGroup && message.args ? JSON.stringify(message.args, null, 2) : "";
  const elapsed = message.startedAt && message.endedAt ? `${Math.max(0.1, (message.endedAt - message.startedAt) / 1000).toFixed(1)}s` : "";
  const groupTitle = isGroup
    ? `${message.tools.length} ${message.label} ${message.status === "running" ? "running" : "executed"}`
    : `${message.toolName}${message.status === "error" ? " (error)" : ""}`;
  return (
    <div className={`tool-row ${message.status}`}>
      <button className="tool-summary" onClick={() => setExpanded((current) => !current)}>
        <span className="tool-icon"><Icon name={icon[message.status]} size={14} /></span>
        <span className="tool-text">{groupTitle}</span>
        {elapsed ? <span className="tool-elapsed">{elapsed}</span> : null}
        {(args || isGroup) ? <Icon name="chevronDown" size={13} /> : null}
      </button>
      {expanded && isGroup ? (
        <div className="tool-list">
          {tools.map((tool) => (
            <details key={tool.id} open={tool.status === "error"}>
              <summary>
                <span className={`tool-mini ${tool.status}`}><Icon name={icon[tool.status]} size={12} /></span>
                <span>{tool.toolName}</span>
                {tool.startedAt && tool.endedAt ? <em>{Math.max(0.1, (tool.endedAt - tool.startedAt) / 1000).toFixed(1)}s</em> : null}
              </summary>
              {tool.args ? <pre>{JSON.stringify(tool.args, null, 2)}</pre> : <p>No arguments captured.</p>}
            </details>
          ))}
        </div>
      ) : null}
      {expanded && args ? <pre className="tool-args">{args}</pre> : null}
    </div>
  );
}
