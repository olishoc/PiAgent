import { useState } from "react";
import { ToolGroupMessage, ToolMessage } from "../hooks/useAgent";
import Icon from "./Icon";

const icon = {
  running: "clock",
  done: "check",
  error: "x"
} as const;

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function readArg(args: unknown, keys: string[]) {
  if (!args || typeof args !== "object") return "";
  const record = args as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function toolKind(toolName: string) {
  const name = toolName.toLowerCase();
  if (/(web|internet|browser_search|search_query|crawl|fetch_url)/.test(name)) return "web";
  if (/(edit|write|patch|apply_patch|create|delete|move|rename)/.test(name)) return "mutation";
  if (/(bash|shell|command|terminal|exec|run_|npm|pnpm|yarn|cargo|git|test)/.test(name)) return "shell";
  return "tool";
}

function formatGroupTitle(tools: ToolMessage[], status: ToolMessage["status"]) {
  const count = tools.length;
  const web = tools.filter((tool) => toolKind(tool.toolName) === "web").length;
  const errors = tools.filter((tool) => tool.status === "error").length;
  const verb = status === "running" ? "running" : "executed";
  const parts = [`${plural(count, "command")} ${verb}`];
  if (web) parts.push(`web search ${status === "running" ? "running" : "performed"} ${plural(web, "time")}`);
  if (errors) parts.push(`${plural(errors, "error")}`);
  if (parts.length <= 2) return parts.join(" and ");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function formatToolLine(tool: ToolMessage) {
  const name = tool.toolName;
  const command = readArg(tool.args, ["command", "cmd", "script"]);
  if (command) return `${name}  ${command}`;
  const path = readArg(tool.args, ["path", "file", "filePath", "target", "cwd"]);
  if (path) return `${name}  ${path}`;
  const query = readArg(tool.args, ["query", "q", "search"]);
  if (query) return `${name}  ${query}`;
  return name;
}

export default function ToolCallRow({ message }: { message: ToolMessage | ToolGroupMessage }) {
  const [expanded, setExpanded] = useState(false);
  const isGroup = message.kind === "tool_group";
  const tools = isGroup ? message.tools : [message];
  const args = !isGroup && message.args ? JSON.stringify(message.args, null, 2) : "";
  const elapsed = message.startedAt && message.endedAt ? `${Math.max(0.1, (message.endedAt - message.startedAt) / 1000).toFixed(1)}s` : "";
  const groupTitle = isGroup
    ? formatGroupTitle(message.tools, message.status)
    : `${message.toolName}${message.status === "error" ? " (error)" : ""}`;
  return (
    <div className={`tool-row ${message.status} ${isGroup ? "group" : ""}`}>
      <button className="tool-summary" onClick={() => setExpanded((current) => !current)}>
        <span className="tool-icon"><Icon name={isGroup ? "folder" : icon[message.status]} size={14} /></span>
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
                <span>{formatToolLine(tool)}</span>
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
