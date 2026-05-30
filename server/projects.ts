import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { Router } from "express";
import { APP_CONFIG_DIR } from "./tokenStore.js";
import { writeSettings } from "./settings.js";

export interface ProjectWorkflow {
  id: string;
  name: string;
  description: string;
  status: "idle" | "running" | "blocked" | "done";
  steps: string[];
  updatedAt: number;
}

export interface ProjectInfo {
  id: string;
  name: string;
  rootPath: string;
  repoUrl?: string;
  defaultBranch: string;
  createdAt: number;
  lastOpenedAt: number;
  sessionIds: string[];
  workflowConfig: ProjectWorkflow[];
  pinned?: boolean;
  archived?: boolean;
}

export interface ProjectTreeEntry {
  name: string;
  path: string;
  relativePath: string;
  type: "file" | "directory";
  depth: number;
  size?: number;
  modified?: number;
}

export const PROJECTS_DIR = path.join(APP_CONFIG_DIR, "projects");
const PROJECTS_PATH = path.join(APP_CONFIG_DIR, "projects.json");
const SKIP_DIRS = new Set([".git", "node_modules", "dist", "target", ".next", ".vite", "coverage", ".turbo"]);

function readJson<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return fallback;
  }
}

function writeJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  fs.chmodSync(filePath, 0o600);
}

function slugName(name: string) {
  return (name || "project")
    .toLowerCase()
    .replace(/[^a-z0-9._ -]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "project";
}

function idForProject(name: string) {
  return `${Date.now().toString(36)}-${slugName(name)}`;
}

function normalizeRoot(rootPath: string) {
  return path.resolve(rootPath);
}

function assertInsideRoot(root: string, target: string) {
  const normalizedRoot = normalizeRoot(root);
  const normalizedTarget = normalizeRoot(target);
  if (normalizedTarget !== normalizedRoot && !normalizedTarget.startsWith(normalizedRoot + path.sep)) {
    throw new Error("Requested path is outside the project root.");
  }
  return normalizedTarget;
}

function defaultWorkflows(): ProjectWorkflow[] {
  const now = Date.now();
  return [
    {
      id: "plan",
      name: "Plan",
      description: "Clarify goal, constraints, files, and verification before work starts.",
      status: "idle",
      steps: ["Read project state", "Define next milestone", "Identify risks"],
      updatedAt: now
    },
    {
      id: "build",
      name: "Build",
      description: "Implement scoped changes with resumable checkpoints.",
      status: "idle",
      steps: ["Edit files", "Run focused checks", "Capture changed behavior"],
      updatedAt: now
    },
    {
      id: "review",
      name: "Advisor review",
      description: "Run a structured advisor pass before long-running work is finalized.",
      status: "idle",
      steps: ["Review risks", "Fix P0/P1", "Record residual risk"],
      updatedAt: now
    },
    {
      id: "memory",
      name: "Memory capture",
      description: "Save reusable project facts, tool recipes, decisions, and handoff notes without filling the active context.",
      status: "idle",
      steps: ["Extract durable facts", "Tag project memories", "Keep prompt context under budget"],
      updatedAt: now
    },
    {
      id: "handoff",
      name: "Long-run handoff",
      description: "Keep the next milestone, verification state, risks, and subagent opportunities resumable.",
      status: "idle",
      steps: ["Update task state", "Queue advisor checkpoint", "Identify subagent slices", "Resume next action"],
      updatedAt: now
    }
  ];
}

function mergeWorkflows(existing: unknown): ProjectWorkflow[] {
  const current = Array.isArray(existing) ? existing as ProjectWorkflow[] : [];
  const defaults = defaultWorkflows();
  if (!current.length) return defaults;
  const ids = new Set(current.map((workflow) => workflow.id));
  return [...current, ...defaults.filter((workflow) => !ids.has(workflow.id))];
}

export function readProjects(): ProjectInfo[] {
  fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  return readJson<Partial<ProjectInfo>[]>(PROJECTS_PATH, []).map((project) => ({
    id: String(project.id ?? idForProject(project.name ?? "Project")),
    name: String(project.name ?? "Project"),
    rootPath: normalizeRoot(String(project.rootPath ?? PROJECTS_DIR)),
    repoUrl: project.repoUrl,
    defaultBranch: String(project.defaultBranch ?? "main"),
    createdAt: Number(project.createdAt ?? Date.now()),
    lastOpenedAt: Number(project.lastOpenedAt ?? project.createdAt ?? Date.now()),
    sessionIds: Array.isArray(project.sessionIds) ? project.sessionIds.map(String) : [],
    workflowConfig: mergeWorkflows(project.workflowConfig),
    pinned: Boolean(project.pinned),
    archived: Boolean(project.archived)
  }));
}

export function writeProjects(projects: ProjectInfo[]) {
  writeJson(PROJECTS_PATH, projects);
}

export function listProjects() {
  return readProjects()
    .filter((project) => !project.archived)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.lastOpenedAt - a.lastOpenedAt);
}

function saveProject(nextProject: ProjectInfo) {
  const projects = readProjects();
  const index = projects.findIndex((project) => project.id === nextProject.id);
  if (index === -1) projects.push(nextProject);
  else projects[index] = nextProject;
  writeProjects(projects);
  return nextProject;
}

function getProject(id: string) {
  const project = readProjects().find((item) => item.id === id);
  if (!project) throw new Error("Project not found.");
  return project;
}

function execGit(cwd: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    execFile("git", args, { cwd, windowsHide: true }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr.trim() || error.message));
      else resolve(stdout.trim());
    });
  });
}

async function gitStatus(rootPath: string) {
  try {
    const inside = await execGit(rootPath, ["rev-parse", "--is-inside-work-tree"]);
    if (inside !== "true") return { ok: false, state: "not-repo", message: "No Git repository detected." };
    const [status, remotes, branch, upstream] = await Promise.all([
      execGit(rootPath, ["status", "--short", "--branch"]),
      execGit(rootPath, ["remote", "-v"]).catch(() => ""),
      execGit(rootPath, ["branch", "--show-current"]).catch(() => ""),
      execGit(rootPath, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]).catch(() => "")
    ]);
    const state = status.includes("...") ? "connected" : "local";
    return { ok: true, state, status, remotes, branch, upstream };
  } catch (error) {
    return { ok: false, state: "not-repo", message: error instanceof Error ? error.message : String(error) };
  }
}

function scanTree(rootPath: string, requestedPath = "", maxDepth = 4, maxEntries = 350): ProjectTreeEntry[] {
  const root = normalizeRoot(rootPath);
  const start = assertInsideRoot(root, path.resolve(root, requestedPath || "."));
  const entries: ProjectTreeEntry[] = [];
  const visit = (current: string, depth: number) => {
    if (depth > maxDepth || entries.length >= maxEntries) return;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entries.length >= maxEntries) break;
      if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
      const full = assertInsideRoot(root, path.join(current, entry.name));
      const stat = fs.statSync(full);
      const relativePath = path.relative(root, full);
      entries.push({
        name: entry.name,
        path: full,
        relativePath,
        type: entry.isDirectory() ? "directory" : "file",
        depth,
        size: entry.isDirectory() ? undefined : stat.size,
        modified: stat.mtimeMs
      });
      if (entry.isDirectory()) visit(full, depth + 1);
    }
  };
  if (fs.existsSync(start)) visit(start, 0);
  return entries;
}

export const projectsRouter = Router();

projectsRouter.get("/", (_req, res) => {
  res.json({ projects: listProjects() });
});

projectsRouter.post("/", async (req, res, next) => {
  try {
    const name = String(req.body?.name ?? "New project").trim() || "New project";
    const generatedRoot = !req.body?.rootPath;
    const rootPath = !generatedRoot
      ? normalizeRoot(String(req.body.rootPath))
      : path.join(PROJECTS_DIR, slugName(name));
    const existing = readProjects().find((project) => normalizeRoot(project.rootPath) === normalizeRoot(rootPath) && !project.archived);
    if (existing) {
      const nextProject = saveProject({
        ...existing,
        name: existing.name || name,
        lastOpenedAt: Date.now(),
        repoUrl: existing.repoUrl || String(req.body?.repoUrl ?? "").trim() || undefined,
        defaultBranch: existing.defaultBranch || String(req.body?.defaultBranch ?? "main")
      });
      writeSettings({ workspacePath: nextProject.rootPath });
      res.json({ ok: true, project: nextProject, git: await gitStatus(nextProject.rootPath), existing: true });
      return;
    }
    if (!generatedRoot && !fs.existsSync(rootPath)) throw new Error("Project folder does not exist.");
    fs.mkdirSync(rootPath, { recursive: true });
    const project: ProjectInfo = {
      id: idForProject(name),
      name,
      rootPath,
      repoUrl: String(req.body?.repoUrl ?? "").trim() || undefined,
      defaultBranch: String(req.body?.defaultBranch ?? "main"),
      createdAt: Date.now(),
      lastOpenedAt: Date.now(),
      sessionIds: [],
      workflowConfig: defaultWorkflows(),
      pinned: false,
      archived: false
    };
    if (req.body?.initGit) {
      await execGit(rootPath, ["init", "-b", project.defaultBranch]).catch(async () => {
        await execGit(rootPath, ["init"]);
      });
    }
    if (project.repoUrl) await execGit(rootPath, ["remote", "add", "origin", project.repoUrl]);
    if (generatedRoot && !fs.existsSync(path.join(rootPath, "README.md"))) {
      fs.writeFileSync(path.join(rootPath, "README.md"), `# ${name}\n\nLocal project workspace.\n`);
    }
    saveProject(project);
    writeSettings({ workspacePath: rootPath });
    res.json({ ok: true, project, git: await gitStatus(rootPath) });
  } catch (err) {
    next(err);
  }
});

projectsRouter.patch("/:id", (req, res, next) => {
  try {
    const current = getProject(req.params.id);
    const patch = req.body ?? {};
    const nextProject = saveProject({
      ...current,
      name: typeof patch.name === "string" ? patch.name.trim() || current.name : current.name,
      repoUrl: typeof patch.repoUrl === "string" ? patch.repoUrl.trim() || undefined : current.repoUrl,
      defaultBranch: typeof patch.defaultBranch === "string" ? patch.defaultBranch.trim() || current.defaultBranch : current.defaultBranch,
      pinned: typeof patch.pinned === "boolean" ? patch.pinned : current.pinned,
      archived: typeof patch.archived === "boolean" ? patch.archived : current.archived
    });
    res.json({ ok: true, project: nextProject });
  } catch (err) {
    next(err);
  }
});

projectsRouter.post("/:id/open", (req, res, next) => {
  try {
    const project = getProject(req.params.id);
    if (!fs.existsSync(project.rootPath)) throw new Error("Project folder does not exist.");
    const nextProject = saveProject({ ...project, lastOpenedAt: Date.now() });
    const settings = writeSettings({ workspacePath: nextProject.rootPath });
    res.json({ ok: true, project: nextProject, settings });
  } catch (err) {
    next(err);
  }
});

projectsRouter.get("/:id/tree", (req, res, next) => {
  try {
    const project = getProject(req.params.id);
    const depth = Math.min(8, Math.max(1, Number(req.query.depth ?? 4)));
    const limit = Math.min(1000, Math.max(50, Number(req.query.limit ?? 350)));
    const entries = scanTree(project.rootPath, String(req.query.path ?? ""), depth, limit);
    res.json({ ok: true, root: project.rootPath, entries });
  } catch (err) {
    next(err);
  }
});

projectsRouter.get("/:id/git/status", async (req, res, next) => {
  try {
    const project = getProject(req.params.id);
    res.json(await gitStatus(project.rootPath));
  } catch (err) {
    next(err);
  }
});

projectsRouter.post("/:id/git/init", async (req, res, next) => {
  try {
    const project = getProject(req.params.id);
    await execGit(project.rootPath, ["init", "-b", project.defaultBranch]).catch(async () => {
      await execGit(project.rootPath, ["init"]);
    });
    res.json({ ok: true, git: await gitStatus(project.rootPath) });
  } catch (err) {
    next(err);
  }
});

projectsRouter.post("/:id/git/remote", async (req, res, next) => {
  try {
    const project = getProject(req.params.id);
    const repoUrl = String(req.body?.repoUrl ?? "").trim();
    if (!repoUrl) throw new Error("Missing repository URL.");
    await execGit(project.rootPath, ["remote", "remove", "origin"]).catch(() => undefined);
    await execGit(project.rootPath, ["remote", "add", "origin", repoUrl]);
    const nextProject = saveProject({ ...project, repoUrl });
    res.json({ ok: true, project: nextProject, git: await gitStatus(project.rootPath) });
  } catch (err) {
    next(err);
  }
});

projectsRouter.post("/:id/workflows", (req, res, next) => {
  try {
    const project = getProject(req.params.id);
    const name = String(req.body?.name ?? "Workflow").trim() || "Workflow";
    const workflow: ProjectWorkflow = {
      id: `${Date.now().toString(36)}-${slugName(name)}`,
      name,
      description: String(req.body?.description ?? "Long-running project workflow").trim(),
      status: "idle",
      steps: Array.isArray(req.body?.steps) ? req.body.steps.map(String) : ["Plan", "Build", "Review"],
      updatedAt: Date.now()
    };
    const nextProject = saveProject({ ...project, workflowConfig: [...project.workflowConfig, workflow] });
    res.json({ ok: true, project: nextProject, workflow });
  } catch (err) {
    next(err);
  }
});
