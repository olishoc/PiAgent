import { desktopBackdropScript } from "./generatedDesktopBackdrop";
import { desktopUiCss } from "./generatedDesktopUi";

const iconPaths = {
  archive: "M4 7h16M6 7v12h12V7M9 11h6",
  arrowDown: "M12 5v14M6 13l6 6 6-6",
  arrowLeft: "M15 6l-6 6 6 6",
  arrowRight: "M9 6l6 6-6 6",
  arrowUp: "M12 19V5M6 11l6-6 6 6",
  check: "M5 12l4 4L19 6",
  chevronDown: "M6 9l6 6 6-6",
  circle: "M12 21a9 9 0 100-18 9 9 0 000 18",
  clock: "M12 21a9 9 0 100-18 9 9 0 000 18M12 7v5l3 2",
  copy: "M8 8h11v11H8V8M5 16H4a1 1 0 01-1-1V4a1 1 0 011-1h11a1 1 0 011 1v1",
  folder: "M3 7h7l2 2h9v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7",
  gear: "M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7M19 12a7 7 0 00-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 00-1.8-1L14.4 3h-4.8l-.3 3.1a7 7 0 00-1.8 1l-2.4-1-2 3.4 2 1.5a7 7 0 000 2l-2 1.5 2 3.4 2.4-1a7 7 0 001.8 1l.3 3.1h4.8l.3-3.1a7 7 0 001.8-1l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1z",
  layout: "M4 5h16v14H4V5M9 5v14M4 10h5",
  paperclip: "M21 12l-8.5 8.5a6 6 0 01-8.5-8.5L13 3a4 4 0 115.7 5.7l-9 9a2 2 0 11-2.8-2.8l8.5-8.5",
  play: "M8 5v14l11-7-11-7",
  plug: "M8 2v6M16 2v6M7 8h10v4a5 5 0 01-10 0V8M12 17v5",
  plus: "M12 5v14M5 12h14",
  search: "M11 19a8 8 0 100-16 8 8 0 000 16M21 21l-4.3-4.3",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10",
  spark: "M12 2l1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7L12 2M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16",
  stop: "M7 7h10v10H7z",
  thumbDown: "M10 14H5a2 2 0 01-2-2v-1a2 2 0 012-2h2l2-5h7a2 2 0 012 2v7l-4 7h-2l1-6h-3zM17 5h3v8h-3",
  thumbUp: "M10 10H5a2 2 0 00-2 2v1a2 2 0 002 2h2l2 5h7a2 2 0 002-2v-7l-4-7h-2l1 6h-3zM17 11h3v8h-3",
  x: "M6 6l12 12M18 6L6 18"
} as const;

function icon(name: keyof typeof iconPaths, size = 16) {
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="${iconPaths[name]}"></path></svg>`;
}

const remoteShellCss = `
.remote-shell {
  --keyboard-inset: 0px;
  --visual-viewport-height: 100vh;
}
.remote-shell.login-active .sidebar,
.remote-shell.login-active .main-panel {
  display: none;
  pointer-events: none;
}
.remote-login-screen {
  position: fixed;
  z-index: 60;
  inset: 0;
  display: grid;
  place-items: center;
  padding: max(22px, env(safe-area-inset-top)) 18px max(22px, env(safe-area-inset-bottom));
}
.remote-login-screen.hidden {
  display: none !important;
}
.remote-login-panel {
  width: min(384px, calc(100vw - 30px));
  min-width: 0;
  text-align: center;
}
.remote-login-panel .login-icon {
  display: block;
  margin-inline: auto;
  filter:
    drop-shadow(0 0 18px color-mix(in srgb, var(--accent-red) 22%, transparent))
    drop-shadow(0 10px 22px color-mix(in srgb, var(--shadow-color) 72%, transparent));
}
.remote-shell .piagent-icon-img {
  display: block;
  object-fit: contain;
  object-position: center center;
}
.remote-shell .app-icon-frame > .piagent-icon-img {
  width: 100%;
  height: 100%;
}
.remote-shell .app-icon-frame {
  display: inline-grid;
  place-items: center;
  padding: 2px;
  overflow: visible;
}
.remote-login-panel h1 {
  font-weight: 640;
}
.remote-mode-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
  width: 100%;
  padding: 4px;
  border: 0.5px solid var(--border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg-input) 48%, transparent);
  box-shadow: inset 0 1px 0 color-mix(in srgb, #ffffff 9%, transparent);
}
.remote-mode-switch button {
  min-height: 31px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 500;
}
.remote-mode-switch button.active {
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--text-primary) 94%, var(--neon-cyan)), color-mix(in srgb, var(--text-primary) 78%, var(--neon-violet)));
  color: var(--bg-app);
  box-shadow: 0 0 24px color-mix(in srgb, var(--neon-cyan) 14%, transparent);
}
.remote-mode-panel {
  display: grid;
  gap: 9px;
  width: 100%;
  margin-top: 8px;
}
.remote-mode-panel.hidden {
  display: none !important;
}
.mobile-oauth-panel {
  padding: 12px;
  border: 0.5px solid var(--border);
  border-radius: 16px;
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--surface) 58%, transparent), color-mix(in srgb, var(--bg-input) 42%, transparent)),
    radial-gradient(circle at 14% 0%, color-mix(in srgb, var(--neon-cyan) 8%, transparent), transparent 42%);
  text-align: left;
  backdrop-filter: var(--glass-refraction-filter);
}
.mobile-oauth-panel p {
  margin: 0 0 9px !important;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.45;
}
.mobile-oauth-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 8px;
}
.mobile-oauth-manual {
  display: grid;
  gap: 7px;
  margin-top: 9px;
}
.mobile-oauth-manual.hidden {
  display: none !important;
}
.mobile-device-code {
  display: grid;
  gap: 8px;
  margin-top: 10px;
  padding: 10px;
  border: 0.5px solid color-mix(in srgb, var(--neon-cyan) 28%, var(--border));
  border-radius: 14px;
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--surface-strong) 64%, transparent), color-mix(in srgb, var(--bg-input) 48%, transparent)),
    radial-gradient(circle at 15% 8%, color-mix(in srgb, var(--neon-cyan) 13%, transparent), transparent 52%);
  box-shadow: 0 0 28px color-mix(in srgb, var(--neon-cyan) 11%, transparent);
}
.mobile-device-code.hidden {
  display: none !important;
}
.mobile-device-code strong {
  justify-self: start;
  padding: 7px 10px;
  border: 0.5px solid color-mix(in srgb, var(--text-primary) 22%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--bg-input) 70%, transparent);
  color: var(--text-primary);
  font-size: 19px;
  font-weight: 600;
  letter-spacing: .08em;
  text-shadow: 0 0 16px color-mix(in srgb, var(--text-primary) 32%, transparent);
}
.mobile-device-code a {
  color: var(--text-primary);
  text-decoration: none;
  font-size: 11px;
}
.mobile-oauth-manual textarea {
  width: 100%;
  min-height: 58px;
  resize: vertical;
  border: 0.5px solid var(--border);
  border-radius: 12px;
  padding: 9px 10px;
  background: color-mix(in srgb, var(--bg-input) 72%, transparent);
  color: var(--text-primary);
  font-size: 11px;
  line-height: 1.35;
  outline: none;
}
.mobile-oauth-manual textarea:focus {
  border-color: color-mix(in srgb, var(--neon-cyan) 46%, var(--border));
  box-shadow: 0 0 22px color-mix(in srgb, var(--neon-cyan) 14%, transparent);
}
.mobile-oauth-manual small {
  color: var(--text-tertiary);
  font-size: 10px;
  line-height: 1.35;
}
.remote-login-steps {
  display: grid;
  gap: 7px;
  width: 100%;
  margin: 8px 0 10px;
  text-align: left;
}
.remote-login-steps span {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-height: 30px;
  padding: 0 10px;
  border: 0.5px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--subtle-bg) 72%, transparent);
  color: var(--text-secondary);
  font-size: 11px;
}
.remote-login-actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.remote-login-actions .login-button.secondary {
  background: transparent;
  color: var(--text-secondary);
}
.remote-login-state {
  min-height: 18px;
  margin: 4px 0 0 !important;
}
.remote-shell .remote-menu {
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: 48px;
  z-index: 40;
  display: grid;
  gap: 4px;
  padding: 8px;
  border: 0.5px solid var(--border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--bg-menu) 86%, transparent);
  box-shadow: 0 22px 64px color-mix(in srgb, var(--shadow-color) 92%, transparent), inset 0 1px 0 color-mix(in srgb, #ffffff 12%, transparent);
  backdrop-filter: var(--glass-refraction-filter);
}
.remote-shell .remote-menu.hidden,
.remote-shell .hidden {
  display: none !important;
}
.remote-shell .remote-menu button {
  min-height: 30px;
  border: 0.5px solid transparent;
  border-radius: 9px;
  background: transparent;
  color: var(--text-secondary);
  text-align: left;
  padding: 0 8px;
}
.remote-shell .remote-menu button:hover {
  border-color: var(--border);
  background: var(--hover-bg);
  color: var(--text-primary);
}
.remote-shell .thread-status.error {
  color: color-mix(in srgb, var(--accent-red) 72%, #ffffff);
}
.remote-shell .thread-feed {
  isolation: isolate;
}
.remote-shell[data-remote-mode="mobile"] .desktop-only {
  opacity: 0.62;
}
.remote-shell .thread-feed .empty-thread.remote-pairing {
  min-height: 100%;
}
.remote-shell .agent-message .agent-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.remote-shell .user-message .message-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.remote-shell .toolbar-actions button:disabled,
.remote-shell .sidebar-actions button:disabled {
  opacity: 0.48;
}
.remote-shell .composer-meta .remote-status-pill {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 0 8px;
  border: 0.5px solid color-mix(in srgb, var(--border) 84%, transparent);
  border-radius: 999px;
  color: var(--text-tertiary);
  font-size: 11px;
  white-space: nowrap;
}
.remote-shell .remote-only-button {
  border: 0;
  background: transparent;
  color: inherit;
}
@media (max-width: 860px) {
  .remote-shell .project-list {
    overflow: visible;
  }
  .remote-shell .composer {
    margin-bottom: max(12px, calc(12px + env(safe-area-inset-bottom) + var(--keyboard-inset)));
  }
  .remote-shell .thread-feed {
    padding-bottom: calc(22px + var(--keyboard-inset));
  }
  .remote-login-screen {
    align-items: center;
  }
}
`;

export const remoteAppHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
  <meta name="description" content="Secure remote access to your local PiAgent desktop."/>
  <meta name="theme-color" content="#050506"/>
  <link rel="icon" href="/piagent-icon.ico"/>
  <title>PiAgent Remote</title>
  <style nonce="__CSP_NONCE__">${desktopUiCss}\n${remoteShellCss}</style>
</head>
<body>
  <div
    class="app-shell density-comfortable remote-shell login-active"
    data-theme="dark"
    data-background="aurora-glass"
    data-palette="codex"
    data-refraction="balanced"
    data-cursor-light="off"
    data-remote-mode="mobile"
    data-answer-surface="glass"
  >
    <canvas id="animatedBackdrop" class="animated-backdrop-canvas" aria-hidden="true"></canvas>
    <div class="environment-backdrop" aria-hidden="true">
      <div class="sky-layer"></div>
      <div class="horizon-glow"></div>
      <div class="sea-layer sea-layer-a"></div>
      <div class="sea-layer sea-layer-b"></div>
      <div class="light-rain"></div>
    </div>
    <svg class="glass-distortion-map" aria-hidden="true" focusable="false">
      <filter id="piagent-glass-distortion" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.012 0.034" numOctaves="2" seed="7" result="noise">
          <animate attributeName="baseFrequency" dur="16s" values="0.010 0.026;0.018 0.042;0.010 0.026" repeatCount="indefinite"/>
        </feTurbulence>
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="9" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
      <filter id="piagent-glass-refraction" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.018 0.042" numOctaves="3" seed="13" result="refractNoise">
          <animate attributeName="baseFrequency" dur="11s" values="0.014 0.034;0.026 0.052;0.014 0.034" repeatCount="indefinite"/>
        </feTurbulence>
        <feDisplacementMap in="SourceGraphic" in2="refractNoise" scale="18" xChannelSelector="R" yChannelSelector="G" result="bentGlass"/>
        <feColorMatrix in="bentGlass" type="matrix" values="1.05 0 0 0 0  0 1.05 0 0 0  0 0 1.08 0 0  0 0 0 1 0"/>
      </filter>
      <filter id="piagent-glass-refraction-soft" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.012 0.028" numOctaves="2" seed="17" result="refractNoiseSoft">
          <animate attributeName="baseFrequency" dur="15s" values="0.010 0.024;0.016 0.034;0.010 0.024" repeatCount="indefinite"/>
        </feTurbulence>
        <feDisplacementMap in="SourceGraphic" in2="refractNoiseSoft" scale="8" xChannelSelector="R" yChannelSelector="G" result="bentGlassSoft"/>
        <feColorMatrix in="bentGlassSoft" type="matrix" values="1.02 0 0 0 0  0 1.02 0 0 0  0 0 1.04 0 0  0 0 0 1 0"/>
      </filter>
      <filter id="piagent-glass-refraction-strong" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.018 0.042" numOctaves="3" seed="19" result="refractNoiseStrong">
          <animate attributeName="baseFrequency" dur="11s" values="0.014 0.034;0.026 0.052;0.014 0.034" repeatCount="indefinite"/>
        </feTurbulence>
        <feDisplacementMap in="SourceGraphic" in2="refractNoiseStrong" scale="18" xChannelSelector="R" yChannelSelector="G" result="bentGlassStrong"/>
        <feColorMatrix in="bentGlassStrong" type="matrix" values="1.05 0 0 0 0  0 1.05 0 0 0  0 0 1.08 0 0  0 0 0 1 0"/>
      </filter>
      <filter id="piagent-glass-refraction-extreme" x="-40%" y="-40%" width="180%" height="180%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.026 0.062" numOctaves="4" seed="23" result="refractNoiseExtreme">
          <animate attributeName="baseFrequency" dur="7s" values="0.020 0.052;0.038 0.078;0.020 0.052" repeatCount="indefinite"/>
        </feTurbulence>
        <feDisplacementMap in="SourceGraphic" in2="refractNoiseExtreme" scale="32" xChannelSelector="R" yChannelSelector="G" result="bentGlassExtreme"/>
        <feColorMatrix in="bentGlassExtreme" type="matrix" values="1.1 0 0 0 0  0 1.1 0 0 0  0 0 1.16 0 0  0 0 0 1 0"/>
      </filter>
    </svg>

    <main class="remote-login-screen" id="remoteLogin">
      <section class="login-panel remote-login-panel">
        <img class="login-icon piagent-icon-img" src="/piagent-icon.png" alt="" aria-hidden="true"/>
        <h1>Pi Agent</h1>
        <p id="loginLead">Use Pi Agent on this device or connect to your desktop.</p>
        <div class="remote-mode-switch" role="tablist" aria-label="PiAgent web mode">
          <button id="loginMobileModeButton" class="active" type="button">Mobile chat</button>
          <button id="loginDesktopModeButton" type="button">Desktop coding</button>
        </div>
        <div class="remote-mode-panel" id="mobileLoginPanel">
          <div class="mobile-oauth-panel">
            <p>Mobile chat creates or opens your PiAgent account with OpenAI device OAuth. Desktop coding remains separate and requires QR approval.</p>
            <div class="mobile-oauth-actions">
              <button id="mobileConnectButton" class="login-button" type="button">sign in with OpenAI</button>
              <button id="mobileStartButton" class="login-button secondary" type="button">open mobile chat</button>
            </div>
            <div id="mobileDeviceCodePanel" class="mobile-device-code hidden">
              <small>Enter this code on the OpenAI page.</small>
              <strong id="mobileDeviceCodeValue"></strong>
              <a id="mobileDeviceCodeLink" href="https://auth.openai.com/codex/device" target="_blank" rel="noreferrer">open OpenAI device page</a>
            </div>
            <div id="mobileOauthManual" class="mobile-oauth-manual hidden">
              <textarea id="mobileOauthCode" autocomplete="off" spellcheck="false" placeholder="paste callback URL or authorization code"></textarea>
              <button id="mobileOauthCompleteButton" class="login-button secondary" type="button">complete sign-in</button>
              <small>Fallback only: paste the callback URL if OpenAI device code is unavailable.</small>
            </div>
          </div>
        </div>
        <div class="remote-mode-panel hidden" id="desktopLoginPanel">
          <div class="remote-login-steps" aria-label="Remote connection steps">
            <span><strong>1</strong> Open PiAgent on the computer</span>
            <span><strong>2</strong> Parameters -> Remote Access -> QR</span>
            <span><strong>3</strong> Scan or open the pairing link here</span>
            <span><strong>4</strong> Approve this device on desktop</span>
          </div>
          <div class="remote-login-actions">
            <button id="loginReconnectButton" class="login-button hidden" type="button">reconnect</button>
            <button id="loginForgetButton" class="login-button secondary hidden" type="button">forget device</button>
          </div>
        </div>
        <p class="remote-login-state" id="loginState" role="status">not paired</p>
      </section>
    </main>

    <aside class="sidebar" id="sidebar">
      <div class="sidebar-brand">
        <span class="brand-mark app-icon-frame" aria-hidden="true"><img class="piagent-icon-img" src="/piagent-icon.png" alt=""/></span>
        <strong>Pi Agent</strong>
      </div>
      <div class="sidebar-topnav">
        <button aria-label="toggle sidebar" id="toggleSidebarButton" title="Toggle sidebar">${icon("layout")}</button>
        <button aria-label="back" id="backButton" title="Back">${icon("arrowLeft")}</button>
        <button aria-label="forward" id="forwardButton" title="Forward">${icon("arrowRight")}</button>
      </div>
      <div class="sidebar-actions">
        <button class="active" id="mobileModeButton" type="button">${icon("shield")} <span>Mobile chat</span></button>
        <button id="desktopModeButton" type="button">${icon("plug")} <span>Desktop coding</span></button>
        <button class="active" id="newThreadButton" type="button">${icon("plus")} <span>New thread</span></button>
        <button class="desktop-only" id="searchButton" type="button">${icon("search")} <span>Search</span></button>
        <button class="desktop-only" id="extensionsButton" type="button">${icon("plug")} <span>Extensions</span></button>
        <button class="desktop-only" id="automationsButton" type="button">${icon("clock")} <span>Automations</span></button>
      </div>
      <div class="sidebar-label project-label">
        <span>Projects</span>
        <button id="projectsButton" type="button" title="Manage projects" aria-label="Manage projects">${icon("plus", 12)}</button>
      </div>
      <div class="project-list folder-list">
        <div class="project-folder active expanded">
          <div class="project-row-shell">
            <button class="project-row active" id="remoteProjectButton" type="button" aria-expanded="true" title="PiAgent Remote">
              ${icon("folder")} <span>PiAgent Web</span><em>2</em>
            </button>
            <button class="project-close" id="collapseProjectButton" type="button" title="Collapse project" aria-label="Collapse project">${icon("archive", 12)}</button>
          </div>
          <div class="folder-chats" id="remoteFolderChats">
            <button class="task-row folder-chat active" id="remoteTaskButton" type="button">
              <span class="status-dot" id="sidebarDot"></span>
              <span class="task-copy">
                <span class="task-name">Mobile chat</span>
                <span class="task-time" id="sidebarStatus">Ready on this device</span>
              </span>
            </button>
          </div>
        </div>
        <div class="sidebar-label inline">
          <span>Unassociated</span>
          <button id="unassociatedButton" type="button" title="Show unassociated chats" aria-label="Show unassociated chats">${icon("archive", 12)}</button>
        </div>
        <div class="loose-chats">
          <button class="task-row folder-chat" id="pairingTaskButton" type="button">
            <span class="status-dot queued"></span>
            <span class="task-copy">
              <span class="task-name">Desktop coding</span>
              <span class="task-time">QR required</span>
            </span>
          </button>
        </div>
      </div>
      <div class="task-list"></div>
      <footer class="sidebar-footer">
        <div class="remote-menu hidden" id="remoteMenu">
          <button id="reconnectButton" type="button">${icon("play", 13)} Reconnect desktop</button>
          <button id="forgetButton" type="button">${icon("x", 13)} Forget this device</button>
        </div>
        <button class="parameters-button" id="parametersButton" type="button" aria-label="Parameters" title="Parameters">
          <span class="parameters-icon">${icon("gear")}</span>
          <span>Parameters</span>
        </button>
      </footer>
    </aside>

    <main class="main-panel">
      <div class="app-toolbar">
        <div class="toolbar-title">
          <span class="brand-mark app-icon-frame" aria-hidden="true"><img class="piagent-icon-img" src="/piagent-icon.png" alt=""/></span>
          <strong>Pi Agent</strong>
          <em class="toolbar-ready ready" id="topStatus">Mobile chat</em>
          <span class="toolbar-thread" id="topDetail" title="OpenAI OAuth mobile session">OpenAI OAuth</span>
          <span class="toolbar-activity idle" id="toolbarActivity">remote</span>
          <span class="toolbar-detail" id="toolbarDetail" title="mobile chat mode">mobile chat</span>
        </div>
        <div class="toolbar-actions">
          <button id="toolbarSearchButton" class="desktop-only" type="button">${icon("search")} <span>Search</span></button>
          <button id="toolbarProjectsButton" type="button">${icon("folder")} <span>Projects</span></button>
          <button id="toolbarExtensionsButton" class="desktop-only" type="button">${icon("plug")} <span>Extensions</span></button>
          <button id="toolbarSettingsButton" type="button">${icon("gear")} <span>Settings</span></button>
        </div>
      </div>
      <div class="chat-workspace">
        <div class="chat-column empty-start" id="chatColumn">
          <section class="thread-shell compact-header">
            <div class="thread-feed" id="feed" aria-live="polite">
              <div class="empty-thread remote-pairing" id="intro">
                <div class="empty-icon-stage icon-clean" aria-hidden="true">
                  <img class="empty-icon piagent-icon-img" src="/piagent-icon.png" alt=""/>
                </div>
                <h1><span>Ready when you are</span></h1>
                <p id="introText">Mobile chat uses your PiAgent account. Standalone answers need the official relay backend; Desktop coding uses QR approval for files, shell, browser tools, and long coding runs.</p>
              </div>
            </div>
          </section>
          <form id="composer" class="composer hidden">
            <textarea id="prompt" maxlength="12000" rows="1" placeholder="Ask anything..."></textarea>
            <div class="composer-actions">
              <div class="pill-menu-wrap add-menu-wrap">
                <button class="round-button" id="addButton" type="button" aria-label="add tools and files" title="Add tools and files">${icon("plus")}</button>
              </div>
              <div class="tool-pills">
                <button class="access-pill enabled" id="remoteAccessButton" type="button">
                  ${icon("shield", 13)}
                  Mobile chat
                  ${icon("chevronDown", 12)}
                </button>
              </div>
              <div class="composer-meta">
                <span class="remote-status-pill" id="composerStatus">Mobile ready</span>
                <button class="model-pill" id="modelButton" type="button">5.5 High ${icon("chevronDown", 12)}</button>
                <button class="round-button stop hidden" id="abortButton" type="button" aria-label="stop generation" title="Stop">${icon("stop")}</button>
                <button class="send-button" id="sendButton" type="submit" aria-label="send" title="Send">${icon("arrowUp", 15)}</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </main>
  </div>
  <script nonce="__CSP_NONCE__">
    var feed = document.getElementById('feed');
    var intro = document.getElementById('intro');
    var introText = document.getElementById('introText');
    var composer = document.getElementById('composer');
    var promptEl = document.getElementById('prompt');
    var sendButton = document.getElementById('sendButton');
    var abortButton = document.getElementById('abortButton');
    var topStatus = document.getElementById('topStatus');
    var topDetail = document.getElementById('topDetail');
    var toolbarActivity = document.getElementById('toolbarActivity');
    var toolbarDetail = document.getElementById('toolbarDetail');
    var composerStatus = document.getElementById('composerStatus');
    var sidebarStatus = document.getElementById('sidebarStatus');
    var sidebarDot = document.getElementById('sidebarDot');
    var chatColumn = document.getElementById('chatColumn');
    var sidebar = document.getElementById('sidebar');
    var appShell = document.querySelector('.app-shell');
    var remoteLogin = document.getElementById('remoteLogin');
    var loginLead = document.getElementById('loginLead');
    var loginState = document.getElementById('loginState');
    var loginReconnectButton = document.getElementById('loginReconnectButton');
    var loginForgetButton = document.getElementById('loginForgetButton');
    var loginMobileModeButton = document.getElementById('loginMobileModeButton');
    var loginDesktopModeButton = document.getElementById('loginDesktopModeButton');
    var mobileModeButton = document.getElementById('mobileModeButton');
    var desktopModeButton = document.getElementById('desktopModeButton');
    var mobileLoginPanel = document.getElementById('mobileLoginPanel');
    var desktopLoginPanel = document.getElementById('desktopLoginPanel');
    var mobileConnectButton = document.getElementById('mobileConnectButton');
    var mobileStartButton = document.getElementById('mobileStartButton');
    var mobileOauthManual = document.getElementById('mobileOauthManual');
    var mobileOauthCode = document.getElementById('mobileOauthCode');
    var mobileOauthCompleteButton = document.getElementById('mobileOauthCompleteButton');
    var mobileDeviceCodePanel = document.getElementById('mobileDeviceCodePanel');
    var mobileDeviceCodeValue = document.getElementById('mobileDeviceCodeValue');
    var mobileDeviceCodeLink = document.getElementById('mobileDeviceCodeLink');
    var remoteMenu = document.getElementById('remoteMenu');
    var parametersButton = document.getElementById('parametersButton');
    var reconnectButton = document.getElementById('reconnectButton');
    var forgetButton = document.getElementById('forgetButton');
    var desktopId = localStorage.getItem('piagent.remote.desktopId') || '';
    var activeMode = localStorage.getItem('piagent.remote.webMode') || 'mobile';
    var mobileLoggedIn = false;
    var mobileOwnerReady = false;
    var mobileOauthConfigured = false;
    var mobileStandaloneChatConfigured = false;
    var mobileStandaloneChatAllowed = false;
    var mobileStandaloneChatProvider = 'desktop-required';
    var mobileAccountId = '';
    var piAccountId = '';
    var piAccountDesktopLinks = 0;
    var mobileThreadId = localStorage.getItem('piagent.mobile.threadId') || '';
    var mobileAuthDesktopId = localStorage.getItem('piagent.mobile.authDesktopId') || '';
    var mobileAuthGlobal = localStorage.getItem('piagent.mobile.authGlobal') === '1';
    var ws = null;
    var runActive = false;
    var assistantEl = null;
    var thinkingEl = null;
    var thinkingPreview = null;
    var thinkingDetail = null;
    var toolRows = {};
    var mobileAuthPollTimer = null;
    var mobileDevicePollTimer = null;
    localStorage.removeItem('piagent.mobile.openaiKey');
    localStorage.removeItem('piagent.mobile.model');

    function updateModeButtons() {
      var mobile = activeMode === 'mobile';
      [loginMobileModeButton, mobileModeButton].forEach(function (node) {
        if (node) node.classList.toggle('active', mobile);
      });
      [loginDesktopModeButton, desktopModeButton].forEach(function (node) {
        if (node) node.classList.toggle('active', !mobile);
      });
      if (appShell) appShell.setAttribute('data-remote-mode', activeMode);
      if (mobileLoginPanel) mobileLoginPanel.classList.toggle('hidden', !mobile);
      if (desktopLoginPanel) desktopLoginPanel.classList.toggle('hidden', mobile);
    }

    function setMode(mode, options) {
      activeMode = mode === 'desktop' ? 'desktop' : 'mobile';
      localStorage.setItem('piagent.remote.webMode', activeMode);
      updateModeButtons();
      if (activeMode === 'mobile') {
        setRunActive(false);
        checkMobileAuth().then(function (loggedIn) {
          if (loggedIn) showMobileChat(options && options.keepChat);
          else {
            setStatus('Sign in', 'OpenAI OAuth required', 'bad');
            showLogin('Use Pi Agent on this device.', mobileLoginDetail());
            restoreIntro(false);
          }
        }).catch(function (error) {
          setStatus('Sign in', 'OpenAI OAuth required', 'bad');
          showLogin('OpenAI sign-in required.', error.message || 'OAuth status unavailable');
          restoreIntro(false);
        });
      } else if (desktopId) {
        connect('desktop');
      } else {
        setStatus('Not paired', 'scan QR from desktop', 'bad');
        showLogin('Connect this device to your desktop.', 'scan a QR from PiAgent Desktop');
        restoreIntro(false);
      }
    }

    function mobileDesktopId() {
      if (mobileAuthGlobal) return '';
      return mobileAuthDesktopId || desktopId || '';
    }

    function mobileEndpoint(path, options) {
      var id = options && options.desktop ? mobileDesktopId() : '';
      if (!id) return path;
      return path + (path.indexOf('?') === -1 ? '?' : '&') + 'desktopId=' + encodeURIComponent(id);
    }

    function mobileBody(body, options) {
      var id = options && options.desktop ? mobileDesktopId() : '';
      var next = Object.assign({}, body || {});
      if (id) next.desktopId = id;
      return next;
    }

    function startDesktopOauthPairing() {
      if (desktopId) {
        connect('mobile');
        return;
      }
      activeMode = 'desktop';
      localStorage.setItem('piagent.remote.webMode', activeMode);
      updateModeButtons();
      setStatus('Not paired', 'scan QR from desktop', 'bad');
      showLogin('Pair this device with PiAgent Desktop.', 'Open PiAgent on the computer, then Parameters -> Remote Access -> QR.');
      restoreIntro(false);
      if (loginState) loginState.textContent = 'Waiting for a desktop pairing link or QR scan.';
    }

    async function startMobileOAuth() {
      activeMode = 'mobile';
      localStorage.setItem('piagent.remote.webMode', activeMode);
      updateModeButtons();
      setStatus('Opening sign-in', 'OpenAI OAuth', 'run');
      if (loginState) loginState.textContent = 'Opening OpenAI OAuth...';
      if (mobileAuthPollTimer) clearTimeout(mobileAuthPollTimer);
      if (mobileDevicePollTimer) clearTimeout(mobileDevicePollTimer);
      var oauthWindow = window.open('about:blank', '_blank');
      if (oauthWindow) oauthWindow.opener = null;
      try {
        mobileAuthDesktopId = '';
        mobileAuthGlobal = true;
        localStorage.removeItem('piagent.mobile.authDesktopId');
        localStorage.setItem('piagent.mobile.authGlobal', '1');
        var data = await post('/api/mobile/auth/start', mobileBody({}, { global: true }));
        if (!data.authUrl) throw new Error('OAuth URL missing.');
        if (data.desktopAuthPending && data.state) {
          if (oauthWindow) oauthWindow.close();
          if (mobileOauthManual) mobileOauthManual.classList.add('hidden');
          if (mobileOauthCode) mobileOauthCode.value = '';
          if (loginState) loginState.textContent = 'PiAgent Desktop is authorizing this device automatically...';
          pollMobileDesktopAuth(data.state, data.authUrl, Date.now() + 90000);
          return;
        }
        if (data.deviceAuthPending && data.state && data.userCode) {
          if (mobileOauthManual) mobileOauthManual.classList.add('hidden');
          if (mobileOauthCode) mobileOauthCode.value = '';
          showMobileDeviceCode(data.userCode, data.verificationUrl || data.authUrl);
          if (oauthWindow) oauthWindow.location.href = data.verificationUrl || data.authUrl;
          else location.href = data.verificationUrl || data.authUrl;
          if (loginState) loginState.textContent = 'Enter the OpenAI device code, then keep this page open.';
          pollMobileDeviceAuth(data.state, Date.now() + 15 * 60 * 1000, Number(data.intervalSeconds || 5) * 1000);
          return;
        }
        if (mobileOauthManual) mobileOauthManual.classList.remove('hidden');
        if (mobileDeviceCodePanel) mobileDeviceCodePanel.classList.add('hidden');
        if (mobileOauthCode) mobileOauthCode.value = '';
        if (oauthWindow) oauthWindow.location.href = data.authUrl;
        else location.href = data.authUrl;
        if (loginState) {
          loginState.textContent = data.manualCodeRequired
            ? 'After OpenAI redirects to localhost, paste that URL here.'
            : 'Complete OpenAI sign-in in the opened tab.';
        }
      } catch (error) {
        if (oauthWindow) oauthWindow.close();
        setStatus('Sign in failed', error.message || 'OAuth could not start', 'bad');
        showLogin('OpenAI sign-in failed.', error.message || 'OAuth could not start');
      }
    }

    function showMobileDeviceCode(code, url) {
      if (mobileDeviceCodePanel) mobileDeviceCodePanel.classList.remove('hidden');
      if (mobileDeviceCodeValue) mobileDeviceCodeValue.textContent = code || '';
      if (mobileDeviceCodeLink && url) mobileDeviceCodeLink.href = url;
    }

    async function pollMobileDesktopAuth(state, fallbackAuthUrl, deadline) {
      if (mobileAuthPollTimer) clearTimeout(mobileAuthPollTimer);
      try {
        var data = await post('/api/mobile/auth/claim', mobileBody({ state: state }, { desktop: true }));
        if (data.loggedIn) {
          mobileLoggedIn = true;
          mobileAuthGlobal = false;
          mobileAuthDesktopId = desktopId;
          localStorage.removeItem('piagent.mobile.authGlobal');
          localStorage.setItem('piagent.mobile.authDesktopId', mobileAuthDesktopId);
          await checkMobileAuth();
          if (mobileOauthManual) mobileOauthManual.classList.add('hidden');
          if (mobileOauthCode) mobileOauthCode.value = '';
          setStatus('PiAgent account', mobileLoginDetail(), 'ok');
          showMobileChat(false);
          return;
        }
        if (Date.now() > deadline) {
          throw new Error('Automatic desktop sign-in timed out.');
        }
        if (loginState) loginState.textContent = 'Waiting for PiAgent Desktop OAuth...';
        mobileAuthPollTimer = setTimeout(function () {
          pollMobileDesktopAuth(state, fallbackAuthUrl, deadline);
        }, 1200);
      } catch (error) {
        setStatus('Manual sign-in needed', 'OpenAI OAuth', 'bad');
        if (mobileOauthManual) mobileOauthManual.classList.remove('hidden');
        if (loginState) loginState.textContent = (error.message || 'Automatic sign-in failed') + ' Use manual sign-in if needed.';
      }
    }

    async function pollMobileDeviceAuth(state, deadline, intervalMs) {
      if (mobileDevicePollTimer) clearTimeout(mobileDevicePollTimer);
      try {
        var data = await post('/api/mobile/auth/device/poll', mobileBody({ state: state }));
        if (data.loggedIn) {
          mobileLoggedIn = true;
          mobileAuthGlobal = true;
          mobileAuthDesktopId = '';
          localStorage.setItem('piagent.mobile.authGlobal', '1');
          localStorage.removeItem('piagent.mobile.authDesktopId');
          await checkMobileAuth();
          if (mobileOauthManual) mobileOauthManual.classList.add('hidden');
          if (mobileDeviceCodePanel) mobileDeviceCodePanel.classList.add('hidden');
          if (mobileOauthCode) mobileOauthCode.value = '';
          setStatus('PiAgent account', mobileLoginDetail(), 'ok');
          showMobileChat(false);
          return;
        }
        if (Date.now() > deadline) {
          throw new Error('OpenAI device code expired. Start sign-in again.');
        }
        if (data.userCode) showMobileDeviceCode(data.userCode, data.verificationUrl);
        if (loginState) loginState.textContent = 'Waiting for OpenAI device authorization...';
        mobileDevicePollTimer = setTimeout(function () {
          pollMobileDeviceAuth(state, deadline, intervalMs || 5000);
        }, Math.max(3000, Math.min(intervalMs || 5000, 15000)));
      } catch (error) {
        setStatus('Sign in failed', error.message || 'OpenAI device code failed', 'bad');
        if (loginState) loginState.textContent = error.message || 'OpenAI device code failed';
      }
    }

    async function completeMobileOAuth() {
      var authorization = (mobileOauthCode && mobileOauthCode.value || '').trim();
      if (!authorization) {
        if (loginState) loginState.textContent = 'Paste the localhost callback URL or authorization code.';
        return;
      }
      setStatus('Completing sign-in', 'OpenAI OAuth', 'run');
      if (loginState) loginState.textContent = 'Completing OpenAI sign-in...';
      try {
        await post('/api/mobile/auth/complete', mobileBody({ authorization: authorization }));
        mobileLoggedIn = true;
        mobileAuthGlobal = true;
        mobileAuthDesktopId = '';
        localStorage.setItem('piagent.mobile.authGlobal', '1');
        localStorage.removeItem('piagent.mobile.authDesktopId');
        await checkMobileAuth();
        if (mobileOauthManual) mobileOauthManual.classList.add('hidden');
        if (mobileOauthCode) mobileOauthCode.value = '';
        showMobileChat(false);
      } catch (error) {
        setStatus('Sign in failed', error.message || 'OAuth code rejected', 'bad');
        if (loginState) loginState.textContent = error.message || 'OAuth code rejected';
      }
    }

    async function checkMobileAuth() {
      var response = await fetch(mobileEndpoint('/api/mobile/auth/status'), { credentials: 'include', cache: 'no-store' });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + response.status));
      mobileLoggedIn = Boolean(data.loggedIn);
      mobileOwnerReady = Boolean(data.ownerReady);
      mobileOauthConfigured = Boolean(data.oauthConfigured);
      mobileStandaloneChatConfigured = Boolean(data.standaloneChatConfigured);
      mobileStandaloneChatAllowed = data.standaloneChatAllowed !== false && mobileStandaloneChatConfigured;
      mobileStandaloneChatProvider = data.standaloneChatProvider || 'desktop-required';
      mobileAccountId = data.accountId || '';
      piAccountId = data.piAccountId || (data.account && data.account.id) || '';
      piAccountDesktopLinks = data.account && data.account.desktopLinks ? data.account.desktopLinks.length : 0;
      if (data.defaultThreadId && !mobileThreadId) {
        mobileThreadId = data.defaultThreadId;
        localStorage.setItem('piagent.mobile.threadId', mobileThreadId);
      }
      return mobileLoggedIn;
    }

    async function linkCurrentDesktopToAccount() {
      if (!mobileLoggedIn || !desktopId) return;
      try {
        var data = await post('/api/account/link-desktop', { desktopId: desktopId });
        if (data.account && data.account.id) {
          piAccountId = data.account.id;
          piAccountDesktopLinks = data.account.desktopLinks ? data.account.desktopLinks.length : 0;
          if (activeMode === 'mobile') appendStatus('Desktop linked to this PiAgent account.');
          else setStatus('Approved', 'desktop linked to PiAgent account', 'ok');
        }
      } catch (error) {
        if (activeMode === 'mobile') appendStatus(error.message || 'PiAgent account desktop link failed.', true);
        else setStatus('Approved', 'desktop paired; account link skipped', 'ok');
      }
    }

    async function logoutMobile() {
      if (mobileAuthPollTimer) {
        clearTimeout(mobileAuthPollTimer);
        mobileAuthPollTimer = null;
      }
      if (mobileDevicePollTimer) {
        clearTimeout(mobileDevicePollTimer);
        mobileDevicePollTimer = null;
      }
      try { await post('/api/mobile/auth/logout', mobileBody({})); } catch (error) {}
      mobileLoggedIn = false;
      mobileOwnerReady = false;
      mobileOauthConfigured = false;
      mobileStandaloneChatConfigured = false;
      mobileStandaloneChatAllowed = false;
      mobileStandaloneChatProvider = 'desktop-required';
      mobileAccountId = '';
      piAccountId = '';
      piAccountDesktopLinks = 0;
      localStorage.removeItem('piagent.mobile.threadId');
      localStorage.removeItem('piagent.mobile.authDesktopId');
      localStorage.removeItem('piagent.mobile.authGlobal');
      mobileThreadId = '';
      mobileAuthDesktopId = '';
      mobileAuthGlobal = false;
      if (mobileDeviceCodePanel) mobileDeviceCodePanel.classList.add('hidden');
    }

    function mobileLoginDetail() {
      if (mobileLoggedIn && piAccountId) {
        var modelState = mobileStandaloneChatConfigured && mobileStandaloneChatAllowed
          ? (mobileStandaloneChatProvider === 'openai-api' ? 'standalone model ready' : 'relay model enabled')
          : 'desktop QR needed for model chat';
        return 'PiAgent account ready - ' + modelState + (piAccountDesktopLinks ? ' - ' + piAccountDesktopLinks + ' desktop link' + (piAccountDesktopLinks === 1 ? '' : 's') : '');
      }
      if (!mobileOauthConfigured) return 'OpenAI web OAuth is not configured for rblxagent.com yet';
      return 'Create or open your PiAgent account with OpenAI device OAuth. Desktop coding still requires QR approval.';
    }

    function setLogin(text, detail) {
      updateModeButtons();
      if (activeMode === 'mobile') {
        if (loginLead) loginLead.textContent = text || 'Use Pi Agent on this device.';
        if (loginState) loginState.textContent = detail || (mobileLoggedIn ? 'Signed in with OpenAI OAuth.' : mobileLoginDetail());
        if (loginReconnectButton) loginReconnectButton.classList.add('hidden');
        if (loginForgetButton) loginForgetButton.classList.toggle('hidden', !mobileLoggedIn);
        return;
      }
      if (loginLead) loginLead.textContent = text || 'Connect this device to your desktop.';
      if (loginState) loginState.textContent = detail || '';
      if (loginReconnectButton) loginReconnectButton.classList.toggle('hidden', !desktopId);
      if (loginForgetButton) loginForgetButton.classList.toggle('hidden', !desktopId);
    }

    function showLogin(text, detail) {
      if (remoteLogin) remoteLogin.classList.remove('hidden');
      if (appShell) appShell.classList.add('login-active');
      setLogin(text, detail);
    }

    function showApp() {
      if (remoteLogin) remoteLogin.classList.add('hidden');
      if (appShell) appShell.classList.remove('login-active');
      updateModeButtons();
    }

    function updateViewportInset() {
      var viewport = window.visualViewport;
      var viewportHeight = viewport ? viewport.height : window.innerHeight;
      var keyboardInset = viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
      if (appShell) {
        appShell.style.setProperty('--visual-viewport-height', Math.round(viewportHeight) + 'px');
        appShell.style.setProperty('--keyboard-inset', Math.round(keyboardInset) + 'px');
      }
    }

    function token(bytes) {
      var array = new Uint8Array(bytes || 32);
      crypto.getRandomValues(array);
      var binary = '';
      array.forEach(function (item) { binary += String.fromCharCode(item); });
      return btoa(binary).split('+').join('-').split('/').join('_').replace(/=+$/,'');
    }

    function decodePacked(value) {
      var base64 = value.split('-').join('+').split('_').join('/');
      while (base64.length % 4) base64 += '=';
      return JSON.parse(atob(base64));
    }

    var PENDING_PAIR_KEY = 'piagent.remote.pendingPair';

    function readPendingPair() {
      try {
        var value = sessionStorage.getItem(PENDING_PAIR_KEY);
        return value ? JSON.parse(value) : null;
      } catch (error) {
        sessionStorage.removeItem(PENDING_PAIR_KEY);
        return null;
      }
    }

    function writePendingPair(pair) {
      sessionStorage.setItem(PENDING_PAIR_KEY, JSON.stringify(pair));
    }

    function clearPendingPair() {
      sessionStorage.removeItem(PENDING_PAIR_KEY);
    }

    function setStatus(text, detail, state) {
      topStatus.textContent = text;
      topDetail.textContent = detail || '';
      topDetail.title = detail || '';
      toolbarActivity.textContent = state === 'run' ? 'running' : state === 'ok' ? 'ready' : 'remote';
      toolbarActivity.className = 'toolbar-activity ' + (state === 'run' ? 'running' : state === 'ok' ? 'ready' : 'idle');
      toolbarDetail.textContent = detail || '';
      toolbarDetail.title = detail || '';
      sidebarStatus.textContent = detail ? text + ' - ' + detail : text;
      composerStatus.textContent = state === 'ok'
        ? (activeMode === 'mobile' ? 'PiAgent account ready' : 'Pi Agent Ready')
        : state === 'run'
          ? 'Working'
          : activeMode === 'mobile'
            ? 'OpenAI OAuth'
            : 'Desktop required';
      topStatus.className = 'toolbar-ready ' + (state === 'ok' ? 'ready' : state === 'run' ? 'running' : 'error');
      sidebarDot.className = 'status-dot ' + (state === 'ok' ? 'done' : state === 'run' ? 'running' : 'error');
      composer.classList.toggle('streaming', state === 'run');
    }

    function setRunActive(active) {
      runActive = active;
      sendButton.disabled = active;
      abortButton.classList.toggle('hidden', !active);
      composer.classList.toggle('streaming', active);
    }

    function showChat() {
      showApp();
      if (intro) intro.classList.add('hidden');
      composer.classList.remove('hidden');
      chatColumn.classList.remove('empty-start');
      chatColumn.classList.add('has-thread');
    }

    function restoreIntro(showShell) {
      if (showShell !== false) showApp();
      if (intro) intro.classList.remove('hidden');
      composer.classList.add('hidden');
      chatColumn.classList.add('empty-start');
      chatColumn.classList.remove('has-thread');
    }

    function showMobileChat(keepChat) {
      showApp();
      if (!keepChat) {
        if (intro) intro.classList.remove('hidden');
        chatColumn.classList.add('empty-start');
        chatColumn.classList.remove('has-thread');
      }
      composer.classList.remove('hidden');
      if (introText) introText.textContent = 'Mobile chat uses your PiAgent account. Standalone answers require the official relay backend; Desktop coding requires QR approval for files, shell, browser tools, and long coding runs.';
      setStatus(mobileLoggedIn ? 'PiAgent account' : 'Sign in', mobileLoggedIn ? mobileLoginDetail() : mobileLoginDetail(), mobileLoggedIn ? 'ok' : 'bad');
      if (composerStatus) composerStatus.textContent = mobileLoggedIn ? 'PiAgent account ready' : 'OpenAI OAuth';
      promptEl.placeholder = 'Ask Pi Agent mobile...';
      document.getElementById('remoteAccessButton').innerHTML = '${icon("shield", 13)} Mobile chat ${icon("chevronDown", 12)}';
      document.getElementById('modelButton').innerHTML = mobileStandaloneChatConfigured ? 'OpenAI API ${icon("chevronDown", 12)}' : 'Desktop QR ${icon("chevronDown", 12)}';
    }

    function scrollToBottom() {
      feed.scrollTop = feed.scrollHeight;
    }

    function appendStatus(text, error) {
      showChat();
      var node = document.createElement('div');
      node.className = 'thread-status' + (error ? ' error' : '');
      node.textContent = text || '';
      feed.appendChild(node);
      scrollToBottom();
      return node;
    }

    function appendUser(text) {
      showChat();
      var article = document.createElement('article');
      article.className = 'message user-message';
      var body = document.createElement('div');
      body.className = 'message-text';
      body.textContent = text || '';
      article.appendChild(body);
      feed.appendChild(article);
      scrollToBottom();
      return article;
    }

    function createAgentMessage() {
      var article = document.createElement('article');
      article.className = 'message agent-message';
      var body = document.createElement('div');
      body.className = 'agent-text';
      article.appendChild(body);
      var actions = document.createElement('div');
      actions.className = 'message-actions';
      [['Copy','copy'],['Good response','thumbUp'],['Bad response','thumbDown']].forEach(function (entry) {
        var button = document.createElement('button');
        button.type = 'button';
        button.title = entry[0];
        button.setAttribute('aria-label', entry[0]);
        button.innerHTML = entry[1] === 'copy' ? '${icon("copy", 13)}' : entry[1] === 'thumbUp' ? '${icon("thumbUp", 13)}' : '${icon("thumbDown", 13)}';
        if (entry[1] === 'copy') {
          button.addEventListener('click', function () {
            if (navigator.clipboard) navigator.clipboard.writeText(body.textContent || '');
          });
        }
        actions.appendChild(button);
      });
      article.appendChild(actions);
      feed.appendChild(article);
      return article;
    }

    function appendAssistantDelta(delta) {
      showChat();
      if (!assistantEl) assistantEl = createAgentMessage();
      var body = assistantEl.querySelector('.agent-text');
      body.textContent = (body.textContent || '') + delta;
      scrollToBottom();
    }

    function ensureThinking() {
      showChat();
      if (thinkingEl) return thinkingEl;
      thinkingEl = document.createElement('article');
      thinkingEl.className = 'message thinking-message active';
      var body = document.createElement('div');
      body.className = 'thinking-body';
      var head = document.createElement('button');
      head.className = 'thinking-head';
      head.type = 'button';
      head.setAttribute('aria-expanded', 'false');
      var pulse = document.createElement('span');
      pulse.className = 'thinking-pulse';
      pulse.setAttribute('aria-hidden', 'true');
      var label = document.createElement('span');
      label.className = 'thinking-label';
      label.textContent = (navigator.language || '').toLowerCase().startsWith('fr') ? 'En reflexion' : 'Thinking';
      var action = document.createElement('em');
      action.textContent = 'Show';
      head.appendChild(pulse);
      head.appendChild(label);
      head.appendChild(action);
      thinkingPreview = document.createElement('div');
      thinkingPreview.className = 'thinking-preview';
      thinkingPreview.textContent = 'Working...';
      thinkingDetail = document.createElement('div');
      thinkingDetail.className = 'message-text hidden';
      head.addEventListener('click', function () {
        var expanded = thinkingEl.classList.toggle('expanded');
        head.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        action.textContent = expanded ? 'Hide' : 'Show';
        thinkingPreview.classList.toggle('hidden', expanded);
        thinkingDetail.classList.toggle('hidden', !expanded);
      });
      body.appendChild(head);
      body.appendChild(thinkingPreview);
      body.appendChild(thinkingDetail);
      thinkingEl.appendChild(body);
      feed.appendChild(thinkingEl);
      scrollToBottom();
      return thinkingEl;
    }

    function appendThinking(delta) {
      ensureThinking();
      thinkingDetail.textContent = (thinkingDetail.textContent || '') + delta;
      thinkingPreview.textContent = (thinkingDetail.textContent || 'Working...').slice(0, 160);
      scrollToBottom();
    }

    function finishThinking() {
      if (thinkingEl) {
        thinkingEl.classList.remove('active');
        thinkingEl.classList.add('settled');
      }
    }

    function toolTitle(event) {
      return event.toolName || event.name || 'tool';
    }

    function upsertTool(event, status) {
      showChat();
      var id = event.toolCallId || event.id || toolTitle(event);
      var row = toolRows[id];
      if (!row) {
        row = document.createElement('div');
        row.className = 'tool-row running';
        var button = document.createElement('button');
        button.className = 'tool-summary';
        button.type = 'button';
        var iconSpan = document.createElement('span');
        iconSpan.className = 'tool-icon';
        iconSpan.innerHTML = '${icon("clock", 14)}';
        var text = document.createElement('span');
        text.className = 'tool-text';
        text.textContent = toolTitle(event);
        var elapsed = document.createElement('span');
        elapsed.className = 'tool-elapsed';
        elapsed.textContent = '';
        button.appendChild(iconSpan);
        button.appendChild(text);
        button.appendChild(elapsed);
        var pre = document.createElement('pre');
        pre.className = 'tool-args hidden';
        button.addEventListener('click', function () { pre.classList.toggle('hidden'); });
        row.appendChild(button);
        row.appendChild(pre);
        row._icon = iconSpan;
        row._pre = pre;
        toolRows[id] = row;
        feed.appendChild(row);
      }
      row.className = 'tool-row ' + status;
      row._icon.innerHTML = status === 'error' ? '${icon("x", 14)}' : status === 'done' ? '${icon("check", 14)}' : '${icon("clock", 14)}';
      var details = status === 'running' ? event.args : event.result;
      if (details !== undefined) {
        try { row._pre.textContent = JSON.stringify(details, null, 2); }
        catch (error) { row._pre.textContent = String(details); }
      }
      scrollToBottom();
    }

    async function post(path, body) {
      var response = await fetch(path, { method:'POST', credentials:'include', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body || {}) });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok || data.ok === false) {
        var error = new Error(data.error || ('HTTP ' + response.status));
        error.status = response.status;
        error.data = data;
        throw error;
      }
      return data;
    }

    async function sendMobilePrompt(text) {
      if (!mobileLoggedIn) {
        try { await checkMobileAuth(); } catch (error) {}
      }
      if (!mobileLoggedIn) {
        appendStatus('Sign in with OpenAI OAuth before mobile chat.', true);
        showLogin('Use Pi Agent on this device.', 'Sign in with OpenAI OAuth first');
        setRunActive(false);
        return;
      }
      setRunActive(true);
      assistantEl = null;
      thinkingEl = null;
      thinkingPreview = null;
      thinkingDetail = null;
      toolRows = {};
      setStatus('Working', 'PiAgent mobile chat', 'run');
      ensureThinking();
      appendThinking('Thinking...');
      try {
        var data = await post('/api/mobile/chat', mobileBody({ message: text, threadId: mobileThreadId || undefined }));
        finishThinking();
        if (data.threadId) {
          mobileThreadId = data.threadId;
          localStorage.setItem('piagent.mobile.threadId', mobileThreadId);
        }
        appendAssistantDelta(data.text || 'No response.');
        if (data.account && data.account.id) {
          piAccountId = data.account.id;
          piAccountDesktopLinks = data.account.desktopLinks ? data.account.desktopLinks.length : 0;
        }
        setStatus('PiAgent account', mobileLoginDetail(), 'ok');
      } catch (error) {
        finishThinking();
        appendStatus(error.message || 'Mobile chat failed.', true);
        if (error.status === 401 || (error.data && error.data.authRequired)) {
          mobileLoggedIn = false;
          showLogin('OpenAI sign-in required.', 'Sign in again to continue mobile chat');
          setStatus('Sign in', 'OpenAI OAuth required', 'bad');
        } else {
          setStatus('Mobile chat unavailable', mobileStandaloneChatConfigured ? 'check account access' : 'desktop QR or server backend needed', 'bad');
        }
      } finally {
        setRunActive(false);
      }
    }

    function sendCommand(command) {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        appendStatus('Remote socket is not connected.', true);
        return false;
      }
      ws.send(JSON.stringify(command));
      return true;
    }

    function applyComposerMode() {
      promptEl.placeholder = activeMode === 'mobile' ? 'Ask Pi Agent mobile...' : 'Ask Pi Agent on your desktop...';
      document.getElementById('remoteAccessButton').innerHTML = activeMode === 'mobile'
        ? '${icon("shield", 13)} Mobile chat ${icon("chevronDown", 12)}'
        : '${icon("shield", 13)} Desktop coding ${icon("chevronDown", 12)}';
      document.getElementById('modelButton').innerHTML = activeMode === 'mobile'
        ? (mobileStandaloneChatConfigured ? 'OpenAI API ${icon("chevronDown", 12)}' : 'Desktop QR ${icon("chevronDown", 12)}')
        : '5.5 High ${icon("chevronDown", 12)}';
    }

    function connectedDetail() {
      return activeMode === 'mobile' ? mobileLoginDetail() : 'Pi Agent Ready';
    }

    function connect(mode) {
      if (mode === 'mobile' || mode === 'desktop') {
        activeMode = mode;
        localStorage.setItem('piagent.remote.webMode', activeMode);
      }
      updateModeButtons();
      if (activeMode === 'mobile') {
        checkMobileAuth().then(function (loggedIn) {
          if (loggedIn) {
            setStatus('PiAgent account', connectedDetail(), 'ok');
            showMobileChat(true);
          } else {
            setStatus('Sign in', 'OpenAI OAuth required', 'bad');
            showLogin('Use Pi Agent on this device.', mobileLoginDetail());
            restoreIntro(false);
          }
        }).catch(function (error) {
          setStatus('Sign in', 'OpenAI OAuth required', 'bad');
          showLogin('OpenAI sign-in required.', error.message || 'OAuth status unavailable');
          restoreIntro(false);
        });
        return true;
      }
      if (!desktopId) {
        setStatus('Not paired', 'scan QR from desktop', 'bad');
        showLogin(
          'Connect this device to your desktop.',
          'scan a QR from PiAgent Desktop'
        );
        restoreIntro(false);
        return false;
      }
      applyComposerMode();
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        if (ws.readyState === WebSocket.OPEN) setStatus('Connected', connectedDetail(), 'ok');
        return true;
      }
      setStatus('Connecting', 'waiting for desktop relay', 'run');
      var scheme = location.protocol === 'https:' ? 'wss://' : 'ws://';
      ws = new WebSocket(scheme + location.host + '/relay/client?desktopId=' + encodeURIComponent(desktopId));
      ws.onopen = function () {
        setStatus('Connected', connectedDetail(), 'ok');
        showApp();
        showChat();
        appendStatus('Connected to your desktop PiAgent.');
      };
      ws.onclose = function () {
        setStatus('Disconnected', 'open PiAgent desktop or reconnect', 'bad');
        showLogin(
          'Desktop connection paused.',
          'tap reconnect when the desktop is online'
        );
        setRunActive(false);
      };
      ws.onerror = function () {
        setStatus('Connection error', 'pair again if needed', 'bad');
        showLogin('Connection error.', 'pair again if needed');
      };
      ws.onmessage = function (event) {
        var message = {};
        try { message = JSON.parse(event.data); } catch (error) { return; }
        if (message.type === 'remote_ready') {
          setStatus('Connected', message.desktopConnected ? connectedDetail() : 'desktop offline', message.desktopConnected ? 'ok' : 'bad');
          if (message.desktopConnected) {
            showChat();
          }
          else showLogin('Desktop is offline.', 'open PiAgent on the computer, then reconnect');
          return;
        }
        if (message.type === 'desktop_status') {
          setStatus('Connected', connectedDetail(), 'ok');
          return;
        }
        if (message.type === 'desktop_offline') {
          appendStatus(message.error || 'Desktop is offline.', true);
          setStatus('Disconnected', 'desktop offline', 'bad');
          setRunActive(false);
          return;
        }
        if (message.type === 'command_response') {
          if (!message.ok) appendStatus(message.error || 'Command failed.', true);
          if (message.ok === false || !runActive) setRunActive(false);
          return;
        }
        if (message.type === 'pi_event') handlePiEvent(message.event || {});
      };
    }

    function handlePiEvent(event) {
      var assistantEvent = event.assistantMessageEvent || {};
      if (event.type === 'agent_start') {
        setRunActive(true);
        setStatus('Working', 'Pi Agent is running', 'run');
        ensureThinking();
        return;
      }
      if (event.type === 'message_update' && assistantEvent.type === 'thinking_start') {
        ensureThinking();
        return;
      }
      if (event.type === 'message_update' && assistantEvent.type === 'thinking_delta' && typeof assistantEvent.delta === 'string') {
        appendThinking(assistantEvent.delta);
        return;
      }
      if (event.type === 'message_update' && typeof (assistantEvent.thinking_delta || assistantEvent.thinking || event.thinking_delta || event.thinking) === 'string') {
        appendThinking(assistantEvent.thinking_delta || assistantEvent.thinking || event.thinking_delta || event.thinking);
        return;
      }
      if (event.type === 'message_update' && assistantEvent.type === 'text_delta' && typeof assistantEvent.delta === 'string') {
        finishThinking();
        appendAssistantDelta(assistantEvent.delta);
        return;
      }
      if (event.type === 'tool_execution_start') {
        finishThinking();
        upsertTool(event, 'running');
        return;
      }
      if (event.type === 'tool_execution_end') {
        upsertTool(event, event.isError ? 'error' : 'done');
        return;
      }
      if (event.type === 'agent_end') {
        setRunActive(false);
        setStatus('Connected', 'Pi Agent Ready', 'ok');
        assistantEl = null;
        thinkingEl = null;
        thinkingPreview = null;
        thinkingDetail = null;
        appendStatus('Run complete.');
        return;
      }
      if (event.type === 'process_exit' || event.type === 'process_error' || event.type === 'auth_required') {
        setRunActive(false);
        setStatus('Needs desktop', 'check PiAgent on the computer', 'bad');
        appendStatus(event.message || 'PiAgent process stopped.', true);
      }
    }

    async function pairFromHash() {
      var params = new URLSearchParams(location.hash.slice(1));
      var packed = params.get('pair');
      if (!packed) return false;
      history.replaceState(null, '', location.pathname);
      try {
        activeMode = 'desktop';
        localStorage.setItem('piagent.remote.webMode', activeMode);
        updateModeButtons();
        var payload = decodePacked(packed);
        desktopId = payload.desktopId;
        var deviceSecret = token(32);
        setStatus('Pairing', 'waiting for desktop approval', 'run');
        showLogin('Approval pending.', 'approve this device on the desktop');
        var claim = await post('/api/pair/claim', {
          desktopId: payload.desktopId,
          pairId: payload.pairId,
          pairSecret: payload.pairSecret,
          deviceSecret: deviceSecret,
          deviceName: (navigator.platform || 'iPad') + ' remote'
        });
        setLogin('Approval pending.', 'pairing request sent to the desktop');
        var pending = {
          desktopId: payload.desktopId,
          approvalId: claim.approvalId,
          approvalSecret: claim.approvalSecret,
          deviceSecret: deviceSecret,
          started: Date.now()
        };
        writePendingPair(pending);
        pollPendingPair(pending);
      } catch (error) {
        setStatus('Pairing failed', error.message || 'invalid QR', 'bad');
        showLogin('Pairing failed.', error.message || 'invalid QR');
      }
      return true;
    }

    async function pollPendingPair(pair) {
      if (!pair || !pair.desktopId || !pair.approvalId || !pair.approvalSecret || !pair.deviceSecret) {
        clearPendingPair();
        return false;
      }
      desktopId = pair.desktopId;
      if (Date.now() - (pair.started || Date.now()) > 10 * 60 * 1000) {
        clearPendingPair();
        setStatus('Pairing expired', 'create a new QR', 'bad');
        showLogin('Pairing expired.', 'create a new QR from PiAgent Desktop');
        return false;
      }
      setStatus('Pairing', 'waiting for desktop approval', 'run');
      showLogin('Approval pending.', 'approve this device on the desktop');
      try {
        var state = await post('/api/pair/status', {
          desktopId: pair.desktopId,
          approvalId: pair.approvalId,
          approvalSecret: pair.approvalSecret,
          deviceSecret: pair.deviceSecret
        });
        if (state.status === 'approved') {
          clearPendingPair();
          localStorage.setItem('piagent.remote.desktopId', pair.desktopId);
          desktopId = pair.desktopId;
          setStatus('Approved', 'connecting', 'ok');
          setLogin('Approved.', 'connecting to desktop');
          await linkCurrentDesktopToAccount();
          connect(activeMode);
          return true;
        }
        if (state.status === 'denied') {
          clearPendingPair();
          setStatus('Denied', 'desktop rejected pairing', 'bad');
          showLogin('Pairing denied.', 'create a new QR from desktop');
          return false;
        }
      } catch (error) {
        var message = error.message || 'waiting for desktop approval';
        if (/rejected|expired|invalid|403|404|410/i.test(message)) {
          clearPendingPair();
          showLogin('Pairing failed.', message);
          return false;
        }
        showLogin('Approval pending.', 'retrying while the network recovers');
      }
      setTimeout(function () { pollPendingPair(pair); }, 1800);
      return true;
    }

    function abortRun() {
      if (!runActive) return;
      sendCommand({ type:'abort', id: token(10) });
      setRunActive(false);
      setStatus('Stopping', 'abort requested', 'run');
    }

    composer.addEventListener('submit', function (event) {
      event.preventDefault();
      var text = promptEl.value.trim();
      if (!text || runActive) return;
      appendUser(text);
      promptEl.value = '';
      if (activeMode === 'mobile') {
        sendMobilePrompt(text);
        return;
      }
      setRunActive(true);
      assistantEl = null;
      thinkingEl = null;
      thinkingPreview = null;
      thinkingDetail = null;
      toolRows = {};
      setStatus('Working', 'Pi Agent is running', 'run');
      if (!sendCommand({ type:'prompt', id: token(10), message: text, remoteMode: 'full-agent' })) {
        setRunActive(false);
        setStatus('Disconnected', 'open PiAgent desktop or reconnect', 'bad');
      }
    });

    abortButton.addEventListener('click', abortRun);
    async function forgetDevice() {
      clearPendingPair();
      if (activeMode === 'mobile') await logoutMobile();
      localStorage.removeItem('piagent.remote.desktopId');
      desktopId = '';
      if (ws) ws.close();
      setRunActive(false);
      if (activeMode === 'mobile') {
        setStatus('Signed out', 'OpenAI OAuth required', 'bad');
        showLogin('Use Pi Agent on this device.', 'Sign in with OpenAI OAuth');
      } else {
        setStatus('Forgotten', 'scan a new QR', 'bad');
        showLogin('Connect this device to your desktop.', 'scan a new QR from PiAgent Desktop');
      }
      restoreIntro(false);
      remoteMenu.classList.add('hidden');
      parametersButton.classList.remove('active');
    }

    loginMobileModeButton.addEventListener('click', function () { setMode('mobile'); });
    loginDesktopModeButton.addEventListener('click', function () { setMode('desktop'); });
    mobileModeButton.addEventListener('click', function () { setMode('mobile'); });
    desktopModeButton.addEventListener('click', function () { setMode('desktop'); });
    mobileConnectButton.addEventListener('click', startMobileOAuth);
    mobileOauthCompleteButton.addEventListener('click', completeMobileOAuth);
    mobileStartButton.addEventListener('click', function () {
      if (mobileLoggedIn) {
        showMobileChat(false);
        return;
      }
      startMobileOAuth();
    });
    reconnectButton.addEventListener('click', function () { connect(activeMode); });
    loginReconnectButton.addEventListener('click', function () { connect(activeMode); });
    loginForgetButton.addEventListener('click', forgetDevice);
    document.getElementById('toggleSidebarButton').addEventListener('click', function () { sidebar.classList.toggle('collapsed'); });
    document.getElementById('backButton').addEventListener('click', function () { history.back(); });
    document.getElementById('forwardButton').addEventListener('click', function () { history.forward(); });
    document.getElementById('newThreadButton').addEventListener('click', function () { showChat(); promptEl.focus(); });
    document.getElementById('remoteTaskButton').addEventListener('click', function () { showChat(); scrollToBottom(); });
    document.getElementById('pairingTaskButton').addEventListener('click', function () { restoreIntro(true); });
    document.getElementById('remoteProjectButton').addEventListener('click', function () {
      document.getElementById('remoteFolderChats').classList.toggle('hidden');
    });
    document.getElementById('collapseProjectButton').addEventListener('click', function () {
      document.getElementById('remoteFolderChats').classList.toggle('hidden');
    });
    parametersButton.addEventListener('click', function () {
      remoteMenu.classList.toggle('hidden');
      parametersButton.classList.toggle('active', !remoteMenu.classList.contains('hidden'));
    });
    forgetButton.addEventListener('click', forgetDevice);
    document.getElementById('toolbarSettingsButton').addEventListener('click', function () {
      remoteMenu.classList.toggle('hidden');
      parametersButton.classList.toggle('active', !remoteMenu.classList.contains('hidden'));
    });
    document.getElementById('remoteAccessButton').addEventListener('click', function () {
      if (activeMode === 'mobile') {
        appendStatus('Mobile chat has no desktop file, shell, browser, or credential access. Switch to Desktop coding for that.');
      } else {
        appendStatus('Desktop coding is controlled by QR pairing, desktop approval, and this paired-device token.');
      }
    });
    document.getElementById('modelButton').addEventListener('click', function () {
      if (activeMode === 'mobile') {
        if (mobileStandaloneChatConfigured && mobileStandaloneChatAllowed) appendStatus('Mobile chat uses your PiAgent account plus the official server-backed OpenAI API model.');
        else appendStatus('OAuth creates your PiAgent account. Standalone answers need the official server backend, or use Desktop coding after QR approval.');
      }
      else appendStatus('Model and access settings are inherited from PiAgent Desktop.');
    });
    ['searchButton','extensionsButton','automationsButton','projectsButton','unassociatedButton','toolbarSearchButton','toolbarProjectsButton','toolbarExtensionsButton','addButton'].forEach(function (id) {
      var node = document.getElementById(id);
      if (!node) return;
      node.addEventListener('click', function () {
        if (activeMode === 'mobile') appendStatus('This is available through Desktop coding after QR approval.');
        else appendStatus('This desktop-only surface is routed through the approved PiAgent desktop session when available.');
      });
    });

    ${desktopBackdropScript}
    (function startBackdrop() {
      var canvas = document.getElementById('animatedBackdrop');
      var shell = document.querySelector('.app-shell');
      var runtime = window.PiAgentAnimatedBackdrop;
      if (!canvas || !runtime || !runtime.startAnimatedBackdrop) return;
      var style = getComputedStyle(shell || document.documentElement);
      runtime.startAnimatedBackdrop(canvas, {
        mode: shell && shell.getAttribute('data-background') || 'aurora-glass',
        theme: shell && shell.getAttribute('data-theme') || 'dark',
        palette: shell && shell.getAttribute('data-palette') || 'codex',
        accent: style.getPropertyValue('--accent').trim() || '#58a6ff',
        cursorLight: 'off'
      });
    })();

    updateViewportInset();
    window.addEventListener('resize', updateViewportInset);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateViewportInset);
      window.visualViewport.addEventListener('scroll', updateViewportInset);
    }

    (async function boot() {
      updateModeButtons();
      setRunActive(false);
      if (await pairFromHash()) return;
      var pendingPair = readPendingPair();
      if (pendingPair) {
        activeMode = 'desktop';
        localStorage.setItem('piagent.remote.webMode', activeMode);
        updateModeButtons();
        pollPendingPair(pendingPair);
        return;
      }
      if (activeMode === 'mobile') {
        try {
          if (await checkMobileAuth()) {
            setStatus('PiAgent account', mobileLoginDetail(), 'ok');
            showMobileChat(false);
          } else {
            setStatus('Sign in', 'OpenAI OAuth required', 'bad');
            showLogin('Use Pi Agent on this device.', mobileLoginDetail());
            restoreIntro(false);
          }
        } catch (error) {
          setStatus('Sign in', 'OpenAI OAuth required', 'bad');
          showLogin('OpenAI sign-in required.', error.message || 'OAuth status unavailable');
          restoreIntro(false);
        }
      } else if (desktopId) connect('desktop');
      else {
        setStatus('Not paired', 'scan QR from desktop', 'bad');
        showLogin('Connect this device to your desktop.', 'scan a QR from PiAgent Desktop');
        restoreIntro(false);
      }
    })();
  </script>
</body>
</html>`;
