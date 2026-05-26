import { Router } from "express";
import { readSettings } from "./settings.js";

export type ExtensionCategory = "Featured" | "Coding" | "Productivity" | "Research" | "Design" | "Finance" | "Operations";
export type ExtensionStatus = "enabled" | "available" | "setup-required" | "guidance-only";
export type ExtensionRisk = "low" | "medium" | "high";

export interface ExtensionCatalogEntry {
  id: string;
  title: string;
  category: ExtensionCategory;
  description: string;
  status: ExtensionStatus;
  authType: "none" | "local" | "oauth" | "api-key" | "mcp" | "skill";
  source: "built-in" | "pi-extension" | "mcp" | "connector" | "guide";
  sourceUrl?: string;
  settingKey?: string;
  connectAction?: "toggle-setting" | "github-login" | "openai-oauth" | "install-command" | "open-url";
  setupCommand?: string;
  permissions: string[];
  risk: ExtensionRisk;
  recommended: boolean;
}

const entries: Omit<ExtensionCatalogEntry, "status">[] = [
  {
    id: "web",
    title: "Web research",
    category: "Featured",
    description: "Search the web for current sources and cite them in long-running work.",
    authType: "mcp",
    source: "built-in",
    settingKey: "webEnabled",
    connectAction: "toggle-setting",
    permissions: ["network", "citations"],
    risk: "medium",
    recommended: true,
    sourceUrl: "https://github.com/modelcontextprotocol/servers"
  },
  {
    id: "advisor",
    title: "Advisor",
    category: "Featured",
    description: "Structured plan, risk, and completion review checkpoints for serious work.",
    authType: "skill",
    source: "built-in",
    settingKey: "advisorEnabled",
    connectAction: "toggle-setting",
    permissions: ["read project context"],
    risk: "low",
    recommended: true
  },
  {
    id: "chrome",
    title: "Chrome",
    category: "Featured",
    description: "Use signed-in browser sessions for sites that need your normal Chrome cookies.",
    authType: "local",
    source: "built-in",
    settingKey: "chromeEnabled",
    connectAction: "toggle-setting",
    permissions: ["browser control"],
    risk: "high",
    recommended: true
  },
  {
    id: "github",
    title: "GitHub",
    category: "Featured",
    description: "Triage repositories, branches, issues, pull requests, checks, and releases.",
    authType: "oauth",
    source: "built-in",
    settingKey: "githubEnabled",
    connectAction: "github-login",
    permissions: ["repo metadata", "git remotes", "optional push/pull"],
    risk: "medium",
    recommended: true,
    sourceUrl: "https://github.com/modelcontextprotocol/servers"
  },
  {
    id: "memory",
    title: "PiAgent Global Memory",
    category: "Featured",
    description: "Hermes/Honcho-inspired local-first memory: user representation, skills, tools, scoped recall, and consolidation.",
    authType: "none",
    source: "built-in",
    settingKey: "memoryEnabled",
    connectAction: "toggle-setting",
    permissions: ["local memory store"],
    risk: "low",
    recommended: true,
    sourceUrl: "https://honcho.dev/docs/v2/documentation/introduction/overview"
  },
  {
    id: "computer-use",
    title: "Computer use",
    category: "Featured",
    description: "Coordinate full local workflows when your chat permission mode allows it.",
    authType: "local",
    source: "built-in",
    settingKey: "computerUseEnabled",
    connectAction: "toggle-setting",
    permissions: ["local apps", "filesystem", "commands"],
    risk: "high",
    recommended: true
  },
  {
    id: "openai-developers",
    title: "OpenAI Developers",
    category: "Coding",
    description: "Build OpenAI API, Agents SDK, and ChatGPT Apps projects with official guidance.",
    authType: "skill",
    source: "guide",
    permissions: ["docs", "optional API key setup"],
    risk: "medium",
    recommended: true,
    sourceUrl: "https://developers.openai.com/"
  },
  {
    id: "filesystem",
    title: "Filesystem",
    category: "Coding",
    description: "Read and edit allowed project files through an explicit MCP filesystem root.",
    authType: "mcp",
    source: "mcp",
    permissions: ["filesystem"],
    risk: "high",
    recommended: true,
    setupCommand: "npx -y @modelcontextprotocol/server-filesystem <allowed-folder>",
    sourceUrl: "https://github.com/modelcontextprotocol/servers"
  },
  {
    id: "playwright",
    title: "Browser / Playwright",
    category: "Coding",
    description: "Automate local web apps, inspect UI, take screenshots, and verify flows.",
    authType: "mcp",
    source: "mcp",
    permissions: ["browser automation", "screenshots"],
    risk: "medium",
    recommended: true,
    sourceUrl: "https://github.com/modelcontextprotocol/servers"
  },
  {
    id: "git",
    title: "Git",
    category: "Coding",
    description: "Inspect history, branches, diffs, remotes, and working tree state.",
    authType: "local",
    source: "built-in",
    permissions: ["local git"],
    risk: "medium",
    recommended: true
  },
  {
    id: "cloudflare",
    title: "Cloudflare",
    category: "Coding",
    description: "Workers, Pages, Durable Objects, R2, D1, and deployment workflows.",
    authType: "api-key",
    source: "connector",
    permissions: ["cloud deploy", "account resources"],
    risk: "high",
    recommended: true,
    sourceUrl: "https://developers.cloudflare.com/"
  },
  {
    id: "netlify",
    title: "Netlify",
    category: "Coding",
    description: "Deploy Vite, Next, Astro, functions, and preview releases.",
    authType: "oauth",
    source: "connector",
    permissions: ["deployments", "site metadata"],
    risk: "high",
    recommended: true,
    sourceUrl: "https://docs.netlify.com/"
  },
  {
    id: "supabase",
    title: "Supabase",
    category: "Coding",
    description: "Manage Postgres, auth, storage, edge functions, realtime, and vectors.",
    authType: "api-key",
    source: "connector",
    permissions: ["database", "project settings"],
    risk: "high",
    recommended: true,
    sourceUrl: "https://supabase.com/docs"
  },
  {
    id: "hugging-face",
    title: "Hugging Face",
    category: "Coding",
    description: "Inspect models, datasets, Spaces, papers, and run remote jobs.",
    authType: "api-key",
    source: "connector",
    permissions: ["hub metadata", "optional jobs"],
    risk: "medium",
    recommended: true,
    sourceUrl: "https://huggingface.co/docs"
  },
  {
    id: "sentry",
    title: "Sentry",
    category: "Coding",
    description: "Inspect errors, releases, and regressions during debugging work.",
    authType: "api-key",
    source: "connector",
    permissions: ["error telemetry"],
    risk: "medium",
    recommended: false,
    sourceUrl: "https://docs.sentry.io/"
  },
  {
    id: "google-drive",
    title: "Google Drive",
    category: "Productivity",
    description: "Search and work across Drive, Docs, Sheets, and Slides context.",
    authType: "oauth",
    source: "connector",
    permissions: ["drive files"],
    risk: "high",
    recommended: true
  },
  {
    id: "gmail",
    title: "Gmail",
    category: "Productivity",
    description: "Find email context, draft replies, and summarize threads.",
    authType: "oauth",
    source: "connector",
    permissions: ["email read/write"],
    risk: "high",
    recommended: true
  },
  {
    id: "google-calendar",
    title: "Google Calendar",
    category: "Productivity",
    description: "Schedule meetings, inspect availability, and build daily briefs.",
    authType: "oauth",
    source: "connector",
    permissions: ["calendar read/write"],
    risk: "high",
    recommended: true
  },
  {
    id: "slack",
    title: "Slack",
    category: "Productivity",
    description: "Use team conversations as project context and draft follow-ups.",
    authType: "oauth",
    source: "connector",
    permissions: ["workspace messages"],
    risk: "high",
    recommended: true
  },
  {
    id: "notion",
    title: "Notion",
    category: "Productivity",
    description: "Work with specs, docs, research notes, and team knowledge bases.",
    authType: "oauth",
    source: "connector",
    permissions: ["workspace pages"],
    risk: "high",
    recommended: true
  },
  {
    id: "linear",
    title: "Linear",
    category: "Productivity",
    description: "Find issues, link project plans, and update implementation status.",
    authType: "oauth",
    source: "connector",
    permissions: ["issues", "projects"],
    risk: "medium",
    recommended: true
  },
  {
    id: "asana",
    title: "Asana",
    category: "Productivity",
    description: "Read and update tasks for long-running work plans.",
    authType: "oauth",
    source: "connector",
    permissions: ["tasks", "projects"],
    risk: "medium",
    recommended: false
  },
  {
    id: "figma",
    title: "Figma",
    category: "Design",
    description: "Reference designs and design-to-code workflows.",
    authType: "oauth",
    source: "connector",
    permissions: ["design files"],
    risk: "medium",
    recommended: true
  },
  {
    id: "documents",
    title: "Documents",
    category: "Productivity",
    description: "Create, edit, inspect, and export DOCX/Word-style artifacts.",
    authType: "skill",
    source: "built-in",
    permissions: ["local document files"],
    risk: "medium",
    recommended: true
  },
  {
    id: "spreadsheets",
    title: "Spreadsheets",
    category: "Productivity",
    description: "Create, analyze, and edit XLSX/CSV/Google-Sheets-ready workbooks.",
    authType: "skill",
    source: "built-in",
    permissions: ["local spreadsheet files"],
    risk: "medium",
    recommended: true
  },
  {
    id: "presentations",
    title: "Presentations",
    category: "Productivity",
    description: "Build and revise PPTX presentations with render-aware checks.",
    authType: "skill",
    source: "built-in",
    permissions: ["local slide files"],
    risk: "medium",
    recommended: true
  },
  {
    id: "latex",
    title: "LaTeX",
    category: "Research",
    description: "Compile TeX projects and diagnose PDF build problems.",
    authType: "skill",
    source: "built-in",
    permissions: ["local TeX files"],
    risk: "medium",
    recommended: true
  },
  {
    id: "zotero",
    title: "Zotero",
    category: "Research",
    description: "Find papers and add citations from a Zotero research library.",
    authType: "api-key",
    source: "connector",
    permissions: ["citation library"],
    risk: "medium",
    recommended: true,
    sourceUrl: "https://www.zotero.org/support/dev/web_api/v3/start"
  },
  {
    id: "semantic-scholar",
    title: "Semantic Scholar",
    category: "Research",
    description: "Research papers, citations, authors, and related literature.",
    authType: "api-key",
    source: "mcp",
    permissions: ["network"],
    risk: "low",
    recommended: true,
    sourceUrl: "https://api.semanticscholar.org/"
  },
  {
    id: "readwise",
    title: "Readwise",
    category: "Research",
    description: "Use saved highlights and reading notes as project context.",
    authType: "api-key",
    source: "connector",
    permissions: ["reading highlights"],
    risk: "medium",
    recommended: false,
    sourceUrl: "https://readwise.io/api_deets"
  },
  {
    id: "remotion",
    title: "Remotion",
    category: "Design",
    description: "Create motion graphics and videos from React compositions.",
    authType: "skill",
    source: "built-in",
    permissions: ["local project files", "rendering"],
    risk: "medium",
    recommended: true,
    sourceUrl: "https://www.remotion.dev/docs/"
  },
  {
    id: "hyperframes",
    title: "HyperFrames by HeyGen",
    category: "Design",
    description: "Write HTML video compositions with animation, captions, and voiceovers.",
    authType: "skill",
    source: "built-in",
    permissions: ["local video artifacts"],
    risk: "medium",
    recommended: true
  },
  {
    id: "canva",
    title: "Canva",
    category: "Design",
    description: "Search, create, and edit design assets through a connector when configured.",
    authType: "oauth",
    source: "connector",
    permissions: ["design assets"],
    risk: "medium",
    recommended: false,
    sourceUrl: "https://www.canva.dev/docs/connect/"
  },
  {
    id: "binance",
    title: "Binance",
    category: "Finance",
    description: "Market/account automation when explicitly configured with API credentials.",
    authType: "api-key",
    source: "connector",
    permissions: ["financial data"],
    risk: "high",
    recommended: false,
    sourceUrl: "https://developers.binance.com/"
  },
  {
    id: "morningstar",
    title: "Morningstar",
    category: "Finance",
    description: "Investment and fund research through licensed data access.",
    authType: "api-key",
    source: "connector",
    permissions: ["financial research"],
    risk: "high",
    recommended: false
  },
  {
    id: "zoom",
    title: "Zoom",
    category: "Operations",
    description: "Meeting context, transcripts, and follow-up summaries.",
    authType: "oauth",
    source: "connector",
    permissions: ["meetings", "transcripts"],
    risk: "high",
    recommended: false,
    sourceUrl: "https://developers.zoom.us/docs/"
  }
];

function entryStatus(entry: Omit<ExtensionCatalogEntry, "status">): ExtensionStatus {
  const settings = readSettings() as unknown as Record<string, unknown>;
  if (entry.settingKey && settings[entry.settingKey]) return "enabled";
  if (entry.connectAction === "toggle-setting" || entry.connectAction === "github-login") return "available";
  if (entry.source === "built-in") return "available";
  if (entry.source === "guide") return "guidance-only";
  return "setup-required";
}

export function listExtensionCatalog(): ExtensionCatalogEntry[] {
  return entries.map((entry) => ({ ...entry, status: entryStatus(entry) }));
}

export const extensionsRouter = Router();

extensionsRouter.get("/catalog", (req, res) => {
  const query = String(req.query.q ?? "").trim().toLowerCase();
  const category = String(req.query.category ?? "").trim();
  const catalog = listExtensionCatalog().filter((entry) => {
    const matchesCategory = !category || entry.category === category;
    const haystack = `${entry.title} ${entry.description} ${entry.category} ${entry.source}`.toLowerCase();
    return matchesCategory && (!query || haystack.includes(query));
  });
  res.json({ ok: true, catalog });
});
