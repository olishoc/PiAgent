import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Router, type Response } from "express";
import { listProjects, PROJECTS_DIR, type ProjectInfo } from "./projects.js";
import { listRuns, type RunRecord } from "./runLedger.js";
import { readSettings } from "./settings.js";
import { readProjectSubagentState, type SubagentTaskRecord } from "./subagents.js";

export type ProjectTaskStatus = "planned" | "queued" | "running" | "paused" | "blocked" | "verified" | "release-ready" | "cancelled" | "done";
export type ProjectTaskSource = "workflow" | "subagent" | "manual" | "run";
export type ProjectRunStatus = "planned" | "running" | "paused" | "blocked" | "verified" | "release-ready" | "cancelled" | "done";

export interface ProjectTask {
  id: string;
  source: ProjectTaskSource;
  title: string;
  description?: string;
  status: ProjectTaskStatus;
  projectId: string;
  runId?: string;
  sessionId?: string | null;
  workflowId?: string;
  subagentTaskId?: string;
  owner?: "main" | "advisor" | "subagent" | "manual";
  acceptance?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ProjectRun {
  id: string;
  projectId: string;
  title: string;
  status: ProjectRunStatus;
  taskIds: string[];
  linkedRunId?: string;
  sessionId?: string | null;
  checkpoints: Array<{ id: string; title: string; status: string; createdAt: number }>;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectGraph {
  projectId: string;
  readOnly: boolean;
  nodes: Array<{ id: string; type: "project" | "workflow" | "task" | "run" | "session" | "subagent"; label: string; status?: string; updatedAt?: number | string }>;
  edges: Array<{ id: string; source: string; target: string; kind: "contains" | "spawned" | "tracks" | "belongs-to" | "reviews" }>;
  counts: Record<string, number>;
}

interface ProjectOsState {
  version: 1;
  projectId: string;
  tasks: ProjectTask[];
  runs: ProjectRun[];
  updatedAt: number;
}

const PROJECT_OS_DIR = path.join(PROJECTS_DIR, "os");

function now() {
  return Date.now();
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "item";
}

function statePath(projectId: string) {
  return path.join(PROJECT_OS_DIR, `${slug(projectId)}.json`);
}

function readJson<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(value, null, 2));
  fs.renameSync(tmpPath, filePath);
  fs.chmodSync(filePath, 0o600);
}

function findProject(projectId: string): ProjectInfo {
  const project = listProjects({ includeArchived: true }).find((item) => item.id === projectId);
  if (!project) throw new Error("Project not found.");
  return project;
}

function normalizeTask(raw: Partial<ProjectTask>, projectId: string): ProjectTask {
  const timestamp = now();
  const source = ["workflow", "subagent", "manual", "run"].includes(String(raw.source)) ? raw.source as ProjectTaskSource : "manual";
  const status = ["planned", "queued", "running", "paused", "blocked", "verified", "release-ready", "cancelled", "done"].includes(String(raw.status))
    ? raw.status as ProjectTaskStatus
    : "planned";
  return {
    id: raw.id || crypto.randomUUID(),
    source,
    title: String(raw.title ?? "Project task").trim().slice(0, 180) || "Project task",
    description: typeof raw.description === "string" ? raw.description.slice(0, 2_000) : undefined,
    status,
    projectId,
    runId: raw.runId,
    sessionId: raw.sessionId ?? null,
    workflowId: raw.workflowId,
    subagentTaskId: raw.subagentTaskId,
    owner: raw.owner ?? (source === "subagent" ? "subagent" : "main"),
    acceptance: Array.isArray(raw.acceptance) ? raw.acceptance.map(String).slice(0, 12) : [],
    createdAt: Number(raw.createdAt ?? timestamp),
    updatedAt: Number(raw.updatedAt ?? timestamp)
  };
}

function normalizeRun(raw: Partial<ProjectRun>, projectId: string): ProjectRun {
  const timestamp = now();
  const status = ["planned", "running", "paused", "blocked", "verified", "release-ready", "cancelled", "done"].includes(String(raw.status))
    ? raw.status as ProjectRunStatus
    : "planned";
  return {
    id: raw.id || crypto.randomUUID(),
    projectId,
    title: String(raw.title ?? "Project run").trim().slice(0, 180) || "Project run",
    status,
    taskIds: Array.isArray(raw.taskIds) ? raw.taskIds.map(String).slice(0, 80) : [],
    linkedRunId: raw.linkedRunId,
    sessionId: raw.sessionId ?? null,
    checkpoints: Array.isArray(raw.checkpoints) ? raw.checkpoints.map((checkpoint) => ({
      id: String(checkpoint?.id ?? crypto.randomUUID()),
      title: String(checkpoint?.title ?? "Checkpoint").slice(0, 180),
      status: String(checkpoint?.status ?? "planned").slice(0, 40),
      createdAt: Number(checkpoint?.createdAt ?? timestamp)
    })).slice(0, 200) : [],
    createdAt: Number(raw.createdAt ?? timestamp),
    updatedAt: Number(raw.updatedAt ?? timestamp)
  };
}

function readState(projectId: string): ProjectOsState {
  const loaded = readJson<Partial<ProjectOsState>>(statePath(projectId), {});
  return {
    version: 1,
    projectId,
    tasks: Array.isArray(loaded.tasks) ? loaded.tasks.map((task) => normalizeTask(task, projectId)) : [],
    runs: Array.isArray(loaded.runs) ? loaded.runs.map((run) => normalizeRun(run, projectId)) : [],
    updatedAt: Number(loaded.updatedAt ?? now())
  };
}

function writeState(state: ProjectOsState) {
  writeJson(statePath(state.projectId), { ...state, updatedAt: now() });
}

function taskFromWorkflow(project: ProjectInfo, workflow: ProjectInfo["workflowConfig"][number]): ProjectTask {
  const map: Record<string, ProjectTaskStatus> = {
    idle: "planned",
    running: "running",
    blocked: "blocked",
    done: "verified"
  };
  return normalizeTask({
    id: `workflow-${workflow.id}`,
    source: "workflow",
    title: workflow.name,
    description: workflow.description,
    status: map[workflow.status] ?? "planned",
    workflowId: workflow.id,
    acceptance: workflow.steps,
    updatedAt: workflow.updatedAt,
    createdAt: project.createdAt
  }, project.id);
}

function taskFromSubagent(projectId: string, task: SubagentTaskRecord): ProjectTask {
  const map: Record<string, ProjectTaskStatus> = {
    queued: "queued",
    running: "running",
    done: "verified",
    error: "blocked",
    cancelled: "cancelled"
  };
  return normalizeTask({
    id: `subagent-${task.id}`,
    source: "subagent",
    title: task.title,
    description: task.prompt,
    status: map[task.status] ?? "planned",
    runId: task.runId,
    sessionId: task.sessionId,
    subagentTaskId: task.id,
    owner: "subagent",
    acceptance: [task.mode, task.profileId, task.outputPath ?? ""].filter(Boolean),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  }, projectId);
}

function taskFromRun(projectId: string, run: RunRecord): ProjectTask {
  const map: Record<string, ProjectTaskStatus> = {
    starting: "queued",
    running: "running",
    completed: "verified",
    failed: "blocked",
    stopped: "blocked",
    aborted: "cancelled",
    rejected: "blocked"
  };
  return normalizeTask({
    id: `run-${run.id}`,
    source: "run",
    title: run.promptPreview || `Run ${run.id.slice(0, 8)}`,
    status: map[run.status] ?? "planned",
    runId: run.id,
    sessionId: run.sessionId,
    owner: "main",
    createdAt: Date.parse(run.startedAt) || now(),
    updatedAt: Date.parse(run.updatedAt) || now()
  }, projectId);
}

function mergedTasks(project: ProjectInfo) {
  const state = readState(project.id);
  const subagentState = readProjectSubagentState(project.id);
  const ledgerRuns = listRuns({ projectId: project.id, limit: 100 });
  const byId = new Map<string, ProjectTask>();
  for (const task of project.workflowConfig.map((workflow) => taskFromWorkflow(project, workflow))) byId.set(task.id, task);
  for (const task of subagentState.tasks.map((item) => taskFromSubagent(project.id, item))) byId.set(task.id, task);
  for (const task of ledgerRuns.map((run) => taskFromRun(project.id, run))) byId.set(task.id, task);
  for (const task of state.tasks) byId.set(task.id, task);
  return [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

function mergedRuns(project: ProjectInfo) {
  const state = readState(project.id);
  const ledgerRuns = listRuns({ projectId: project.id, limit: 100 });
  const byId = new Map<string, ProjectRun>();
  for (const run of ledgerRuns) {
    byId.set(`ledger-${run.id}`, normalizeRun({
      id: `ledger-${run.id}`,
      title: run.promptPreview || `Run ${run.id.slice(0, 8)}`,
      status: run.status === "completed" ? "verified" : run.status === "running" || run.status === "starting" ? "running" : run.status === "aborted" ? "cancelled" : ["failed", "stopped", "rejected"].includes(run.status) ? "blocked" : "planned",
      linkedRunId: run.id,
      sessionId: run.sessionId,
      taskIds: [`run-${run.id}`],
      checkpoints: [{
        id: `${run.id}-last-event`,
        title: run.lastEventType ?? run.status,
        status: run.status,
        createdAt: Date.parse(run.updatedAt) || now()
      }],
      createdAt: Date.parse(run.startedAt) || now(),
      updatedAt: Date.parse(run.updatedAt) || now()
    }, project.id));
  }
  for (const run of state.runs) byId.set(run.id, run);
  return [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

function buildGraph(project: ProjectInfo): ProjectGraph {
  const tasks = mergedTasks(project);
  const runs = mergedRuns(project);
  const subagentState = readProjectSubagentState(project.id);
  const nodes: ProjectGraph["nodes"] = [{ id: `project-${project.id}`, type: "project", label: project.name, status: project.archived ? "archived" : "active", updatedAt: project.lastOpenedAt }];
  const edges: ProjectGraph["edges"] = [];
  const runNodeById = new Map(runs.map((run) => [run.id, `project-run-${run.id}`]));
  const runNodeByLinkedId = new Map(runs.flatMap((run) => run.linkedRunId ? [[run.linkedRunId, `project-run-${run.id}`] as const] : []));
  const addEdge = (source: string, target: string, kind: ProjectGraph["edges"][number]["kind"]) => edges.push({ id: `${source}->${target}:${kind}`, source, target, kind });
  for (const workflow of project.workflowConfig) {
    const id = `workflow-${workflow.id}`;
    nodes.push({ id, type: "workflow", label: workflow.name, status: workflow.status, updatedAt: workflow.updatedAt });
    addEdge(`project-${project.id}`, id, "contains");
  }
  for (const task of tasks) {
    nodes.push({ id: `task-${task.id}`, type: "task", label: task.title, status: task.status, updatedAt: task.updatedAt });
    addEdge(`project-${project.id}`, `task-${task.id}`, "contains");
    if (task.workflowId) addEdge(`workflow-${task.workflowId}`, `task-${task.id}`, "tracks");
    if (task.runId) {
      const runNodeId = runNodeById.get(task.runId) ?? runNodeByLinkedId.get(task.runId);
      if (runNodeId) addEdge(`task-${task.id}`, runNodeId, "tracks");
    }
    if (task.sessionId) {
      nodes.push({ id: `session-${task.sessionId}`, type: "session", label: task.sessionId, updatedAt: task.updatedAt });
      addEdge(`task-${task.id}`, `session-${task.sessionId}`, "belongs-to");
    }
  }
  for (const run of runs) {
    nodes.push({ id: `project-run-${run.id}`, type: "run", label: run.title, status: run.status, updatedAt: run.updatedAt });
    addEdge(`project-${project.id}`, `project-run-${run.id}`, "contains");
    for (const taskId of run.taskIds) addEdge(`project-run-${run.id}`, `task-${taskId}`, "tracks");
  }
  for (const task of subagentState.tasks.slice(0, 40)) {
    const id = `subagent-${task.id}`;
    nodes.push({ id, type: "subagent", label: task.title, status: task.status, updatedAt: task.updatedAt });
    addEdge(`project-${project.id}`, id, "spawned");
  }
  const counts = nodes.reduce<Record<string, number>>((acc, node) => {
    acc[node.type] = (acc[node.type] ?? 0) + 1;
    return acc;
  }, {});
  const nodeIds = new Set(nodes.map((node) => node.id));
  return { projectId: project.id, readOnly: false, nodes, edges: edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)), counts };
}

function ensureSupervisorEnabled(res: Response) {
  if (readSettings().projectSupervisorEnabled) return true;
  res.status(409).json({ ok: false, error: "Project supervisor is disabled in settings." });
  return false;
}

function updateProjectRun(projectId: string, runId: string, patch: Partial<ProjectRun>) {
  if (runId.startsWith("ledger-")) {
    throw new Error("Project OS can inspect real run-ledger runs, but pause/resume/cancel currently applies only to supervisor runs created in Project OS.");
  }
  const state = readState(projectId);
  const index = state.runs.findIndex((run) => run.id === runId);
  if (index === -1) throw new Error("Project OS run not found.");
  const next = normalizeRun({ ...state.runs[index], ...patch, id: runId, updatedAt: now() }, projectId);
  state.runs[index] = next;
  writeState(state);
  return next;
}

export const projectOsRouter = Router();

projectOsRouter.get("/:id/os", (req, res, next) => {
  try {
    const project = findProject(req.params.id);
    const graph = buildGraph(project);
    res.json({
      ok: true,
      readOnly: false,
      projectId: project.id,
      statePath: statePath(project.id),
      graph,
      tasks: mergedTasks(project).slice(0, Math.min(200, Math.max(1, Number(req.query.limit ?? 80)))),
      runs: mergedRuns(project).slice(0, Math.min(200, Math.max(1, Number(req.query.limit ?? 80))))
    });
  } catch (err) {
    next(err);
  }
});

projectOsRouter.get("/:id/graph", (req, res, next) => {
  try {
    const project = findProject(req.params.id);
    const graph = buildGraph(project);
    const limit = Math.min(500, Math.max(20, Number(req.query.limit ?? 120)));
    const nodes = graph.nodes.slice(0, limit);
    const nodeIds = new Set(nodes.map((node) => node.id));
    const edges = graph.edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)).slice(0, limit * 2);
    res.json({ ok: true, ...graph, nodes, edges });
  } catch (err) {
    next(err);
  }
});

projectOsRouter.get("/:id/tasks", (req, res, next) => {
  try {
    const project = findProject(req.params.id);
    const source = typeof req.query.source === "string" ? req.query.source : "all";
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const tasks = mergedTasks(project)
      .filter((task) => source === "all" || task.source === source)
      .filter((task) => !status || task.status === status)
      .slice(0, Math.min(300, Math.max(1, Number(req.query.limit ?? 120))));
    res.json({ ok: true, projectId: project.id, tasks });
  } catch (err) {
    next(err);
  }
});

projectOsRouter.post("/:id/tasks", (req, res, next) => {
  try {
    if (!ensureSupervisorEnabled(res)) return;
    const project = findProject(req.params.id);
    const state = readState(project.id);
    const task = normalizeTask({
      source: "manual",
      title: req.body?.title,
      description: req.body?.description,
      status: req.body?.status,
      sessionId: req.body?.sessionId,
      runId: req.body?.runId,
      owner: req.body?.owner,
      acceptance: req.body?.acceptance
    }, project.id);
    state.tasks.unshift(task);
    writeState(state);
    res.json({ ok: true, projectId: project.id, task });
  } catch (err) {
    next(err);
  }
});

projectOsRouter.get("/:id/runs", (req, res, next) => {
  try {
    const project = findProject(req.params.id);
    const activeOnly = req.query.activeOnly === "1" || req.query.activeOnly === "true";
    const runs = mergedRuns(project)
      .filter((run) => !activeOnly || ["running", "paused", "blocked"].includes(run.status))
      .slice(0, Math.min(300, Math.max(1, Number(req.query.limit ?? 120))));
    res.json({ ok: true, projectId: project.id, runs, ledgerRuns: listRuns({ projectId: project.id, activeOnly, limit: Number(req.query.limit ?? 120) }) });
  } catch (err) {
    next(err);
  }
});

projectOsRouter.post("/:id/runs", (req, res, next) => {
  try {
    if (!ensureSupervisorEnabled(res)) return;
    const project = findProject(req.params.id);
    const state = readState(project.id);
    const run = normalizeRun({
      title: req.body?.title,
      status: req.body?.status ?? "planned",
      taskIds: req.body?.taskIds,
      linkedRunId: req.body?.linkedRunId,
      sessionId: req.body?.sessionId,
      checkpoints: req.body?.checkpoints
    }, project.id);
    state.runs.unshift(run);
    writeState(state);
    res.json({ ok: true, projectId: project.id, run });
  } catch (err) {
    next(err);
  }
});

projectOsRouter.post("/:id/runs/:runId/pause", (req, res, next) => {
  try {
    if (!ensureSupervisorEnabled(res)) return;
    const project = findProject(req.params.id);
    const current = readState(project.id).runs.find((run) => run.id === req.params.runId);
    const run = updateProjectRun(project.id, req.params.runId, {
      status: "paused",
      checkpoints: [...(current?.checkpoints ?? []), { id: crypto.randomUUID(), title: String(req.body?.reason ?? "Paused"), status: "paused", createdAt: now() }]
    });
    res.json({ ok: true, projectId: project.id, run });
  } catch (err) {
    next(err);
  }
});

projectOsRouter.post("/:id/runs/:runId/resume", (req, res, next) => {
  try {
    if (!ensureSupervisorEnabled(res)) return;
    const project = findProject(req.params.id);
    const current = readState(project.id).runs.find((run) => run.id === req.params.runId);
    const run = updateProjectRun(project.id, req.params.runId, {
      status: "running",
      checkpoints: [...(current?.checkpoints ?? []), { id: crypto.randomUUID(), title: String(req.body?.reason ?? "Resumed"), status: "running", createdAt: now() }]
    });
    res.json({ ok: true, projectId: project.id, run });
  } catch (err) {
    next(err);
  }
});

projectOsRouter.post("/:id/runs/:runId/cancel", (req, res, next) => {
  try {
    if (!ensureSupervisorEnabled(res)) return;
    const project = findProject(req.params.id);
    const current = readState(project.id).runs.find((run) => run.id === req.params.runId);
    const run = updateProjectRun(project.id, req.params.runId, {
      status: "cancelled",
      checkpoints: [...(current?.checkpoints ?? []), { id: crypto.randomUUID(), title: String(req.body?.reason ?? "Cancelled"), status: "cancelled", createdAt: now() }]
    });
    res.json({ ok: true, projectId: project.id, run });
  } catch (err) {
    next(err);
  }
});
