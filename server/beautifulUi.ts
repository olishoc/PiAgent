import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import { APP_CONFIG_DIR } from "./tokenStore.js";

const PACKAGE_ROOT = path.join(APP_CONFIG_DIR, "packages", "beautiful-ui");
const SKILL_DIR = path.join(PACKAGE_ROOT, "skills", "beautiful-ui");
const SKILL_PATH = path.join(SKILL_DIR, "SKILL.md");

const packageJson = `{
  "name": "piagent-beautiful-ui",
  "version": "1.0.0",
  "private": true,
  "description": "PiAgent local skill package for practical frontend UI design and visual QA.",
  "pi": {
    "skills": ["skills"],
    "prompts": ["prompts"]
  }
}
`;

const skillMarkdown = `---
name: beautiful-ui
description: Use when building, redesigning, polishing, or reviewing frontend UI. Runs a real workflow: project scan, design brief, token system, implementation rules, browser screenshots, screenshot critique, patch loop, and verification.
---

# Beautiful UI Mode

Beautiful UI Mode is a practical frontend workflow, not a style prompt. Use it when the user asks for a better UI, a dashboard, app shell, game HUD, landing page, design system, responsive polish, visual QA, or anything where browser screenshots and UI quality matter.

## Operating Rules

- Preserve existing product behavior and framework conventions.
- Use existing components, routing, assets, icons, tests, and design tokens first.
- Do not add Tailwind, shadcn, Radix, a component library, Storybook, Playwright, or axe unless the project already uses it or the user approves the dependency.
- Prefer semantic CSS variables/tokens over one-off colors and arbitrary spacing.
- Do not fake functionality. If a control is only prompt text or a placeholder, wire it, rename it honestly, or remove it.
- Design desktop and mobile intentionally.
- Verify with a browser whenever the target can run locally.

## Required Workflow

### 1. UI Context Scan

Run the scanner first when possible:

\`\`\`bash
node "$PIAGENT_BEAUTIFUL_UI/scripts/ui-scan.mjs" .
\`\`\`

If the environment variable is unavailable, the skill directory is the directory containing this SKILL.md; use \`scripts/ui-scan.mjs\` relative to it.

Inspect and summarize:

- framework and app entry points
- routing/pages/layout surfaces
- styling system and token/theme files
- existing components and icon libraries
- tests, Storybook, screenshots, visual tooling
- assets/media availability
- accessibility and responsiveness risks
- build/dev/test commands

Produce a concise structured UI context object before editing.

### 2. Design Brief

Before editing, write a short brief with:

- target user and product type
- density and information hierarchy
- visual tone
- layout strategy
- component inventory
- required states: hover, focus, active, loading, empty, error, disabled, selected
- responsive behavior
- accessibility requirements
- what is already wired vs cosmetic

### 3. Design System Pack

If the project has tokens, extend them. If not, create a lightweight semantic pack:

- colors: app, sidebar, main, surface, elevated, input, code, overlay, borders, text, accent, states
- typography: family, scale, line-height, weights
- spacing: page, section, component, inline gaps
- radius: controls, cards, panels, modals
- shadows: only where elevation is meaningful
- states: hover, focus ring, active, disabled, selected, danger, success, warning

Keep palettes domain-appropriate. Avoid generic purple gradients, bokeh blobs, nested card soup, and placeholder gray boxes.

### 4. Generation Rules

- Build the actual usable first screen, not a marketing landing page, unless the user explicitly requested a landing page.
- Use icons for recognizable commands.
- Make buttons, menus, tabs, badges, tooltips, dialogs, sidebars, inspectors, and empty states feel complete.
- Keep dense operational tools quiet and scan-friendly.
- Use stable dimensions for fixed-format controls so hover/loading text cannot shift layout.
- Use semantic HTML and accessible names.
- Make focus visible.
- Never let text overlap, clip awkwardly, or exceed its container on 390px mobile.

### 5. Browser Visual QA

If the app can run locally:

1. Start the dev server.
2. Capture or inspect at 1440x900, 1024x768, and 390x844.
3. Check console errors.
4. Interact with core controls.
5. Check overflow, scrollbars, text overlap, contrast, default-looking controls, layout jumps, and mobile behavior.
6. Patch at least once after critique, then rerun the relevant screenshot/DOM checks.

If browser QA is impossible, state the blocker and use an alternate verification path: static render, component tests, CSS audit, or build/typecheck.

### 6. Screenshot Critic

Use the critic rubric after screenshots or DOM inspection:

\`\`\`bash
node "$PIAGENT_BEAUTIFUL_UI/scripts/screenshot-critic.mjs" --context ui-context.json --screenshots screenshots/
\`\`\`

The critic must return concrete fixes, not taste comments. Cover:

- hierarchy
- alignment
- spacing
- density
- contrast
- typography
- color system
- component quality
- state coverage
- responsiveness
- generic-AI sameness

### 7. Verification

Use the existing validation path first:

- typecheck/build/lint/test
- existing Playwright or browser tests
- lightweight screenshot smoke checks when feasible
- accessibility checks if already available
- Storybook stories only if Storybook already exists

Finish with exact commands run, evidence, screenshots if applicable, and any controls intentionally renamed or removed because they were cosmetic.
`;

const promptMarkdown = `# Beautiful UI Mode

Use the \`beautiful-ui\` skill for this UI task. First scan the target project, write a design brief, improve the interface with real code, run browser visual QA at desktop/tablet/mobile widths, critique the screenshots, patch at least once, and report verification evidence.
`;

const designBriefTemplate = `# Design Brief

## Product
- Target user:
- Product type:
- Primary workflow:

## UI Direction
- Density:
- Visual tone:
- Layout strategy:
- Navigation model:
- Inspector/status surfaces:

## Components
- Existing components to reuse:
- New/refined components:
- Required states:

## Responsive Plan
- Desktop:
- Tablet:
- Mobile:

## Accessibility
- Focus:
- Keyboard:
- Contrast:
- Semantic HTML:

## Verification
- Dev command:
- Build/test command:
- Browser checks:
`;

const contextSchema = `# UI Context Object

\`\`\`json
{
  "framework": "react|vue|svelte|next|vite|unknown",
  "language": "typescript|javascript|mixed",
  "routing": [],
  "styling": {
    "system": "css|scss|tailwind|css-modules|styled-components|unknown",
    "tokenFiles": [],
    "themeFiles": []
  },
  "components": [],
  "icons": [],
  "assets": [],
  "tests": [],
  "storybook": false,
  "commands": {
    "dev": "",
    "build": "",
    "test": "",
    "lint": ""
  },
  "risks": []
}
\`\`\`
`;

const uiScanScript = `#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || process.cwd());
const ignore = new Set(["node_modules", ".git", "dist", "build", "target", ".next", ".vite", "coverage"]);
const files = [];

function walk(dir, depth = 0) {
  if (depth > 6 || files.length > 1200) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignore.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, depth + 1);
      continue;
    }
    files.push(path.relative(root, full).replace(/\\\\/g, "/"));
  }
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
  } catch {
    return null;
  }
}

function existsAny(patterns) {
  return files.filter((file) => patterns.some((pattern) => pattern.test(file)));
}

walk(root);
const packageFiles = ["package.json", ...files.filter((file) => /(^|\\/)package\\.json$/.test(file))];
const packages = packageFiles
  .map((file) => ({ file, json: readJson(file) }))
  .filter((item) => item.json);
const rootPkg = packages.find((item) => item.file === "package.json")?.json || {};
const deps = Object.assign({}, ...packages.map((item) => ({
  ...(item.json.dependencies || {}),
  ...(item.json.devDependencies || {})
})));
const scripts = Object.assign({}, ...packages.map((item) => item.json.scripts || {}), rootPkg.scripts || {});
const framework = deps.next ? "next"
  : deps["@vitejs/plugin-react"] || deps.react ? "react"
  : deps.vue ? "vue"
  : deps.svelte ? "svelte"
  : "unknown";
const styling = deps.tailwindcss ? "tailwind"
  : existsAny([/\\.module\\.css$/]).length ? "css-modules"
  : deps["styled-components"] ? "styled-components"
  : existsAny([/\\.s?css$/]).length ? "css"
  : "unknown";
const context = {
  root,
  framework,
  language: existsAny([/\\.tsx?$/]).length ? "typescript" : existsAny([/\\.jsx?$/]).length ? "javascript" : "unknown",
  routing: existsAny([/(routes?|pages?|app)\\//, /router/i]),
  styling: {
    system: styling,
    tokenFiles: existsAny([/(^|\\/)(tokens?|theme|variables|global|design-system)[^/]*\\.(css|scss|ts|tsx|js|json)$/i]).filter((file) => !/tokenStore/i.test(file)),
    themeFiles: existsAny([/(theme|appearance|palette).*\\.(css|scss|ts|tsx|js|json)$/i])
  },
  components: existsAny([/(components|ui)\\/.*\\.(tsx|jsx|vue|svelte)$/]),
  icons: Object.keys(deps).filter((name) => /icon|lucide|heroicons|phosphor/i.test(name)),
  assets: existsAny([/\\.(png|jpe?g|webp|svg|gif|mp4|glb)$/i]).slice(0, 80),
  tests: existsAny([/(test|spec|playwright|cypress|vitest|jest)/i]),
  storybook: Boolean(deps.storybook || deps["@storybook/react"] || files.some((file) => file.includes(".storybook/"))),
  commands: {
    dev: scripts.dev || scripts.start || "",
    build: scripts.build || "",
    test: scripts.test || "",
    lint: scripts.lint || ""
  },
  risks: []
};

if (!context.styling.tokenFiles.length) context.risks.push("No obvious token/theme file found; create semantic tokens before broad styling.");
if (!context.tests.length) context.risks.push("No existing tests detected; use build plus browser smoke checks.");
if (!context.icons.length) context.risks.push("No icon dependency detected; use existing SVG/assets or small inline icons.");

console.log(JSON.stringify(context, null, 2));
`;

const criticScript = `#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const contextFlag = args.indexOf("--context");
const screenshotsFlag = args.indexOf("--screenshots");
const contextPath = contextFlag >= 0 ? args[contextFlag + 1] : "";
const screenshotsPath = screenshotsFlag >= 0 ? args[screenshotsFlag + 1] : "";
let context = {};
try {
  if (contextPath) context = JSON.parse(fs.readFileSync(contextPath, "utf8").replace(/^\\uFEFF/, ""));
} catch {}
const screenshots = screenshotsPath && fs.existsSync(screenshotsPath)
  ? fs.readdirSync(screenshotsPath).filter((file) => /\\.(png|jpe?g|webp)$/i.test(file))
  : [];

const findings = [];
if (!context.styling?.tokenFiles?.length) findings.push("Create or extend semantic tokens before patching individual components.");
if (!screenshots.length) findings.push("No screenshots were found; run browser QA or state the blocker before finalizing.");
findings.push("Check that the primary action, secondary actions, and destructive actions are visually distinct.");
findings.push("Check 390px width for clipped labels, hidden controls, unusable menus, and horizontal overflow.");
findings.push("Check focus-visible rings on composer, menu buttons, tabs, dialogs, and file/action controls.");
findings.push("Check that empty, loading, error, disabled, selected, hover, and active states are represented.");
findings.push("Remove generic AI-app artifacts: oversized gradient hero, blob decorations, random purple, nested cards, fake toggles.");
findings.push("Patch concrete issues, rerun build, and repeat at least the viewport where the issue appeared.");

console.log(JSON.stringify({
  rubric: ["hierarchy", "alignment", "spacing", "density", "contrast", "typography", "color system", "component quality", "state coverage", "responsiveness", "generic-AI sameness"],
  screenshots,
  findings
}, null, 2));
`;

const readme = `# PiAgent Beautiful UI Mode

This local Pi package is generated by PiAgent and loaded into each Pi RPC session with \`--skill\`.

Use:

\`\`\`
/beautiful-ui redesign the dashboard
\`\`\`

or directly:

\`\`\`
/skill:beautiful-ui redesign the dashboard
\`\`\`

The workflow requires a context scan, design brief, token-aware implementation, browser visual QA, screenshot critique, a patch loop, and verification evidence.
`;

function writeFileIfChanged(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (fs.existsSync(filePath) && fs.readFileSync(filePath, "utf8") === content) return;
  fs.writeFileSync(filePath, content);
}

export function ensureBeautifulUiPackage() {
  writeFileIfChanged(path.join(PACKAGE_ROOT, "package.json"), packageJson);
  writeFileIfChanged(SKILL_PATH, skillMarkdown);
  writeFileIfChanged(path.join(PACKAGE_ROOT, "prompts", "beautiful-ui.md"), promptMarkdown);
  writeFileIfChanged(path.join(PACKAGE_ROOT, "templates", "design-brief.md"), designBriefTemplate);
  writeFileIfChanged(path.join(PACKAGE_ROOT, "references", "ui-context-schema.md"), contextSchema);
  writeFileIfChanged(path.join(PACKAGE_ROOT, "scripts", "ui-scan.mjs"), uiScanScript);
  writeFileIfChanged(path.join(PACKAGE_ROOT, "scripts", "screenshot-critic.mjs"), criticScript);
  writeFileIfChanged(path.join(PACKAGE_ROOT, "README.md"), readme);
  process.env.PIAGENT_BEAUTIFUL_UI = PACKAGE_ROOT;
  return {
    packageRoot: PACKAGE_ROOT,
    skillDir: SKILL_DIR,
    skillPath: SKILL_PATH,
    promptPath: path.join(PACKAGE_ROOT, "prompts", "beautiful-ui.md"),
    scripts: {
      scan: path.join(PACKAGE_ROOT, "scripts", "ui-scan.mjs"),
      critic: path.join(PACKAGE_ROOT, "scripts", "screenshot-critic.mjs")
    }
  };
}

export function beautifulUiArgs(): string[] {
  const info = ensureBeautifulUiPackage();
  return ["--skill", info.skillDir];
}

export function beautifulUiStatus() {
  const info = ensureBeautifulUiPackage();
  return {
    ok: true,
    name: "beautiful-ui",
    loadedBy: "--skill",
    ...info
  };
}

export const beautifulUiRouter = Router();

beautifulUiRouter.get("/status", (_req, res) => {
  res.json(beautifulUiStatus());
});
