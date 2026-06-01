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
}
.remote-shell .app-icon-mark {
  border: 0 !important;
  background: center center / 100% 100% no-repeat url("/piagent-icon.ico"), #050505 !important;
  background-origin: border-box !important;
  background-clip: border-box !important;
}
.remote-login-panel .app-icon-mark,
.remote-shell .empty-icon.app-icon-mark {
  border-radius: 0 !important;
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
        <span class="login-icon app-icon-mark" aria-hidden="true"></span>
        <h1>Pi Agent</h1>
        <p id="loginLead">Use Pi Agent on this device or connect to your desktop.</p>
        <div class="remote-mode-switch" role="tablist" aria-label="PiAgent web mode">
          <button id="loginMobileModeButton" class="active" type="button">Mobile chat</button>
          <button id="loginDesktopModeButton" type="button">Desktop coding</button>
        </div>
        <div class="remote-mode-panel" id="mobileLoginPanel">
          <div class="mobile-oauth-panel">
            <p>Mobile chat uses PiAgent's OpenAI OAuth session from your approved desktop. No OpenAI API key is accepted or stored by this public relay.</p>
            <div class="mobile-oauth-actions">
              <button id="mobileConnectButton" class="login-button" type="button">connect with PiAgent OAuth</button>
              <button id="mobileStartButton" class="login-button secondary" type="button">open mobile chat</button>
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
        <span class="brand-mark app-icon-mark" aria-hidden="true"></span>
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
          <span class="brand-mark app-icon-mark" aria-hidden="true"></span>
          <strong>Pi Agent</strong>
          <em class="toolbar-ready ready" id="topStatus">Mobile chat</em>
          <span class="toolbar-thread" id="topDetail" title="OpenAI OAuth stays on the paired desktop">PiAgent OAuth</span>
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
                <div class="empty-icon-stage" aria-hidden="true">
                  <span class="empty-icon app-icon-mark"></span>
                </div>
                <h1><span>Ready when you are</span></h1>
                <p id="introText">Mobile chat runs here. Switch to Desktop coding when you need files, shell, browser tools, or long coding runs on your computer.</p>
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
    var remoteMenu = document.getElementById('remoteMenu');
    var parametersButton = document.getElementById('parametersButton');
    var reconnectButton = document.getElementById('reconnectButton');
    var forgetButton = document.getElementById('forgetButton');
    var desktopId = localStorage.getItem('piagent.remote.desktopId') || '';
    var activeMode = localStorage.getItem('piagent.remote.webMode') || 'mobile';
    var ws = null;
    var runActive = false;
    var assistantEl = null;
    var thinkingEl = null;
    var thinkingPreview = null;
    var thinkingDetail = null;
    var toolRows = {};
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
        connect('mobile');
        setRunActive(false);
        if (!desktopId) {
          setStatus('Not paired', 'connect PiAgent OAuth', 'bad');
          showLogin('Use Pi Agent on this device.', 'Pair with desktop PiAgent OAuth to start mobile chat');
          restoreIntro(false);
        } else {
          showMobileChat(options && options.keepChat);
        }
      } else if (desktopId) {
        connect('desktop');
      } else {
        setStatus('Not paired', 'scan QR from desktop', 'bad');
        showLogin('Connect this device to your desktop.', 'scan a QR from PiAgent Desktop');
        restoreIntro(false);
      }
    }

    function setLogin(text, detail) {
      updateModeButtons();
      if (activeMode === 'mobile') {
        if (loginLead) loginLead.textContent = text || 'Use Pi Agent on this device.';
        if (loginState) loginState.textContent = detail || (desktopId ? 'Paired with PiAgent OAuth.' : 'Pair this device with PiAgent Desktop first.');
        if (loginReconnectButton) loginReconnectButton.classList.toggle('hidden', !desktopId);
        if (loginForgetButton) loginForgetButton.classList.toggle('hidden', !desktopId);
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
        ? (activeMode === 'mobile' ? 'Mobile ready' : 'Pi Agent Ready')
        : state === 'run'
          ? 'Working'
          : activeMode === 'mobile'
            ? 'Pair desktop OAuth'
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
      if (introText) introText.textContent = 'Mobile chat uses PiAgent OAuth in safe mode. Switch to Desktop coding when you need files, shell, browser tools, or long coding runs on your computer.';
      setStatus(desktopId ? 'Mobile chat' : 'Not paired', desktopId ? 'PiAgent OAuth safe chat' : 'pair PiAgent OAuth', desktopId ? 'ok' : 'bad');
      if (composerStatus) composerStatus.textContent = desktopId ? 'Mobile ready' : 'Pair with PiAgent OAuth';
      promptEl.placeholder = 'Ask Pi Agent mobile...';
      document.getElementById('remoteAccessButton').innerHTML = '${icon("shield", 13)} Mobile chat ${icon("chevronDown", 12)}';
      document.getElementById('modelButton').innerHTML = 'PiAgent OAuth ${icon("chevronDown", 12)}';
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
      if (!response.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + response.status));
      return data;
    }

    function sendMobilePrompt(text) {
      if (!desktopId) {
        appendStatus('Pair this device with PiAgent Desktop OAuth before mobile chat.', true);
        showLogin('Use Pi Agent on this device.', 'Pair with desktop PiAgent OAuth first');
        setRunActive(false);
        return;
      }
      setRunActive(true);
      assistantEl = null;
      thinkingEl = null;
      thinkingPreview = null;
      thinkingDetail = null;
      toolRows = {};
      setStatus('Working', 'PiAgent OAuth safe chat', 'run');
      ensureThinking();
      appendThinking('Sending through the approved PiAgent OAuth desktop session...');
      if (!sendCommand({ type:'prompt', id: token(10), message: text, remoteMode: 'safe-chat' })) {
        setRunActive(false);
        setStatus('Disconnected', 'open PiAgent desktop or reconnect', 'bad');
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
        ? 'PiAgent OAuth ${icon("chevronDown", 12)}'
        : '5.5 High ${icon("chevronDown", 12)}';
    }

    function connectedDetail() {
      return activeMode === 'mobile' ? 'PiAgent OAuth safe chat' : 'Pi Agent Ready';
    }

    function connect(mode) {
      if (mode === 'mobile' || mode === 'desktop') {
        activeMode = mode;
        localStorage.setItem('piagent.remote.webMode', activeMode);
      }
      updateModeButtons();
      if (!desktopId) {
        setStatus('Not paired', activeMode === 'mobile' ? 'pair PiAgent OAuth' : 'scan QR from desktop', 'bad');
        showLogin(
          activeMode === 'mobile' ? 'Use Pi Agent on this device.' : 'Connect this device to your desktop.',
          activeMode === 'mobile' ? 'pair with desktop PiAgent OAuth first' : 'scan a QR from PiAgent Desktop'
        );
        restoreIntro(false);
        return false;
      }
      applyComposerMode();
      if (activeMode === 'mobile') showMobileChat(true);
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        if (ws.readyState === WebSocket.OPEN) setStatus(activeMode === 'mobile' ? 'Mobile chat' : 'Connected', connectedDetail(), 'ok');
        return true;
      }
      setStatus('Connecting', activeMode === 'mobile' ? 'connecting PiAgent OAuth' : 'waiting for desktop relay', 'run');
      var scheme = location.protocol === 'https:' ? 'wss://' : 'ws://';
      ws = new WebSocket(scheme + location.host + '/relay/client?desktopId=' + encodeURIComponent(desktopId));
      ws.onopen = function () {
        setStatus(activeMode === 'mobile' ? 'Mobile chat' : 'Connected', connectedDetail(), 'ok');
        showApp();
        showChat();
        appendStatus(activeMode === 'mobile' ? 'Connected to PiAgent OAuth safe chat.' : 'Connected to your desktop PiAgent.');
      };
      ws.onclose = function () {
        setStatus('Disconnected', activeMode === 'mobile' ? 'open PiAgent desktop' : 'open PiAgent desktop or reconnect', 'bad');
        showLogin(
          activeMode === 'mobile' ? 'PiAgent OAuth connection paused.' : 'Desktop connection paused.',
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
          setStatus(activeMode === 'mobile' ? 'Mobile chat' : 'Connected', message.desktopConnected ? connectedDetail() : 'desktop offline', message.desktopConnected ? 'ok' : 'bad');
          if (message.desktopConnected) {
            if (activeMode === 'mobile') showMobileChat(true);
            else showChat();
          }
          else showLogin('Desktop is offline.', 'open PiAgent on the computer, then reconnect');
          return;
        }
        if (message.type === 'desktop_status') {
          setStatus(activeMode === 'mobile' ? 'Mobile chat' : 'Connected', connectedDetail(), 'ok');
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
    function forgetDevice() {
      clearPendingPair();
      localStorage.removeItem('piagent.remote.desktopId');
      desktopId = '';
      if (ws) ws.close();
      setRunActive(false);
      setStatus('Forgotten', 'scan a new QR', 'bad');
      showLogin('Connect this device to your desktop.', 'scan a new QR from PiAgent Desktop');
      restoreIntro(false);
      remoteMenu.classList.add('hidden');
      parametersButton.classList.remove('active');
    }

    loginMobileModeButton.addEventListener('click', function () { setMode('mobile'); });
    loginDesktopModeButton.addEventListener('click', function () { setMode('desktop'); });
    mobileModeButton.addEventListener('click', function () { setMode('mobile'); });
    desktopModeButton.addEventListener('click', function () { setMode('desktop'); });
    mobileConnectButton.addEventListener('click', function () { connect('mobile'); });
    mobileStartButton.addEventListener('click', function () { if (connect('mobile')) showMobileChat(false); });
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
      if (activeMode === 'mobile') appendStatus('Model selection is inherited from PiAgent OAuth on the paired desktop.');
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
        if (desktopId) connect('mobile');
        else {
          setStatus('Not paired', 'pair PiAgent OAuth', 'bad');
          showLogin('Use Pi Agent on this device.', 'Pair with desktop PiAgent OAuth first');
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
