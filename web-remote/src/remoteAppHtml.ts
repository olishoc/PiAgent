export const remoteAppHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
  <meta name="description" content="Secure remote access to your local PiAgent desktop."/>
  <meta name="theme-color" content="#050506"/>
  <title>PiAgent Remote</title>
  <style nonce="__CSP_NONCE__">
    :root{color-scheme:dark;--bg:#050506;--panel:rgba(19,20,23,.66);--panel-strong:rgba(31,32,35,.84);--panel-soft:rgba(255,255,255,.055);--text:#f5f5f2;--muted:#aeb3b8;--faint:#747b84;--line:rgba(255,255,255,.115);--line-strong:rgba(255,255,255,.22);--accent:#ff4d43;--accent2:#ffffff;--ok:#7df3a2;--warn:#ffd37a;--bad:#ff7b72;--shadow:rgba(0,0,0,.44);--lane:min(820px,calc(100vw - 34px));--font:"OpenAI Sans",Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    *{box-sizing:border-box}html,body{height:100%;overflow:hidden}body{margin:0;font-family:var(--font);background:var(--bg);color:var(--text);font-size:13.5px;line-height:1.54;-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}
    button,textarea{font:inherit}button{cursor:pointer}button:disabled{cursor:not-allowed;opacity:.48}
    .environment{position:fixed;inset:-8vh -8vw;z-index:0;overflow:hidden;background:radial-gradient(circle at 18% 12%,rgba(255,255,255,.16),transparent 20rem),radial-gradient(circle at 72% 6%,rgba(255,77,67,.22),transparent 25rem),linear-gradient(180deg,#050506 0%,#0a0b0e 46%,#050506 100%)}
    .environment:before{content:"";position:absolute;inset:-20%;background:conic-gradient(from 210deg at 50% 42%,transparent,rgba(255,77,67,.22),rgba(255,255,255,.13),rgba(91,141,255,.18),transparent 72%);filter:blur(50px);opacity:.58;animation:aurora 22s ease-in-out infinite alternate}
    .environment:after{content:"";position:absolute;left:-10%;right:-10%;bottom:-10%;height:48%;background:repeating-radial-gradient(ellipse at 50% 115%,rgba(255,255,255,.11) 0 1px,transparent 1px 18px),linear-gradient(180deg,transparent,rgba(255,255,255,.08));filter:blur(.2px);transform-origin:center bottom;animation:waves 13s linear infinite}
    .stars{position:absolute;inset:0;background-image:radial-gradient(circle,rgba(255,255,255,.72) 0 1px,transparent 1.7px),radial-gradient(circle,rgba(255,77,67,.5) 0 1px,transparent 1.6px);background-size:130px 120px,210px 180px;background-position:0 0,40px 50px;opacity:.18;animation:stars 46s linear infinite}
    @keyframes aurora{0%{transform:translate3d(-3%,2%,0) rotate(-5deg) scale(1)}100%{transform:translate3d(4%,-2%,0) rotate(7deg) scale(1.08)}}@keyframes waves{0%{background-position:0 0,0 0;transform:translateY(0) scaleY(1)}100%{background-position:180px 0,0 0;transform:translateY(1.5%) scaleY(1.03)}}@keyframes stars{to{background-position:260px 120px,250px 230px}}
    .app{position:relative;z-index:1;height:100dvh;display:grid;grid-template-columns:264px 1fr;padding:12px;gap:12px}
    .rail,.main,.composer,.tool-row,.message.user,.thinking-card,.intro-card,.status-pill,.quick button{border:1px solid var(--line);background:linear-gradient(135deg,rgba(255,255,255,.105),rgba(255,255,255,.04));box-shadow:0 22px 70px var(--shadow),inset 0 1px 0 rgba(255,255,255,.12);backdrop-filter:blur(24px) saturate(1.35);-webkit-backdrop-filter:blur(24px) saturate(1.35)}
    .rail{border-radius:24px;padding:14px;display:flex;flex-direction:column;min-height:0;overflow:hidden}
    .brand{display:flex;align-items:center;gap:11px;padding:3px 2px 13px}.pi-mark{width:34px;height:34px;border-radius:10px;background:#050505;border:1px solid rgba(255,255,255,.24);display:grid;place-items:center;box-shadow:0 0 24px rgba(255,77,67,.32),inset 0 1px 0 rgba(255,255,255,.12)}.pi-mark span{display:grid;place-items:center;width:20px;height:20px;background:#bd332e;color:#fff;font-weight:800;font-size:15px;line-height:1;border:1px solid rgba(255,255,255,.78);text-shadow:0 0 12px rgba(255,255,255,.8)}.brand strong{font-size:15px;letter-spacing:-.02em;text-shadow:0 0 14px rgba(255,255,255,.22)}.brand em{display:block;color:var(--muted);font-size:11px;font-style:normal}
    .nav-block{border-top:1px solid var(--line);padding-top:12px;margin-top:2px;display:grid;gap:8px}.nav-row{min-height:34px;display:flex;align-items:center;justify-content:space-between;gap:10px;border-radius:12px;padding:0 10px;color:var(--muted);background:rgba(255,255,255,.035)}.nav-row strong{font-size:12px;color:var(--text);font-weight:520}.dot{width:8px;height:8px;border-radius:999px;background:var(--bad);box-shadow:0 0 16px var(--bad)}.dot.ok{background:var(--ok);box-shadow:0 0 16px var(--ok)}.dot.run{background:var(--warn);box-shadow:0 0 16px var(--warn);animation:pulse 1.8s ease-in-out infinite}
    .quick{margin-top:auto;display:grid;gap:8px}.quick button,.icon-btn{min-height:34px;border:1px solid var(--line);border-radius:12px;color:var(--text);background:rgba(255,255,255,.045);display:flex;align-items:center;justify-content:center;gap:8px}.quick button:hover,.icon-btn:hover{border-color:var(--line-strong);box-shadow:0 0 22px rgba(255,255,255,.08)}
    .main{min-width:0;min-height:0;border-radius:28px;display:grid;grid-template-rows:auto 1fr auto;overflow:hidden;position:relative}
    .topbar{height:58px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 18px;background:rgba(5,5,6,.22)}.thread-title{display:flex;align-items:center;gap:9px;min-width:0}.thread-title strong{font-weight:620;font-size:14px;text-shadow:0 0 16px rgba(255,255,255,.22)}.thread-title span{color:var(--muted);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.status-pill{height:32px;border-radius:999px;padding:0 11px;display:flex;align-items:center;gap:8px;color:var(--muted);font-size:12px;box-shadow:none}.status-pill strong{color:var(--text);font-weight:560}
    .feed{position:relative;min-height:0;overflow:auto;overflow-x:hidden;padding:24px max(18px,calc((100% - var(--lane))/2)) 18px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.24) transparent}.feed::-webkit-scrollbar{width:10px}.feed::-webkit-scrollbar-thumb{background:rgba(255,255,255,.2);border-radius:999px;border:3px solid transparent;background-clip:content-box}
    .intro-card{width:min(620px,100%);margin:10vh auto 0;border-radius:26px;padding:30px;text-align:center}.intro-mark{width:72px;height:72px;border-radius:20px;margin:0 auto 16px}.intro-mark span{width:42px;height:42px;font-size:27px}.intro-card h1{font-size:clamp(34px,7vw,70px);line-height:.9;letter-spacing:-.065em;margin:0 0 13px}.intro-card p{margin:0 auto;color:var(--muted);max-width:470px}.chips{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-top:17px}.chip{border:1px solid var(--line);border-radius:999px;padding:7px 10px;color:#dfe5ed;background:rgba(255,255,255,.055);font-size:11.5px}
    .message{width:var(--lane);max-width:var(--lane);margin:16px auto;color:var(--text);white-space:pre-wrap}.message.assistant{padding:1px 2px;text-shadow:0 0 14px rgba(255,255,255,.16)}.message.user{width:min(560px,calc(var(--lane) - 80px));margin-left:auto;margin-right:0;border-radius:18px;padding:12px 14px;background:linear-gradient(135deg,rgba(255,255,255,.13),rgba(255,255,255,.058))}.message.status{color:var(--muted);font-size:12.5px}.message.error{color:#ffd7d4}.message-actions{display:flex;gap:6px;margin-top:7px}.message-actions button{min-width:42px;height:26px;border-radius:9px;border:1px solid var(--line);background:rgba(255,255,255,.045);color:var(--muted);font-size:12px}
    .thinking-card{width:var(--lane);margin:14px auto;border-radius:18px;padding:11px 13px;background:linear-gradient(135deg,rgba(255,211,122,.13),rgba(255,255,255,.055));box-shadow:0 0 32px rgba(255,211,122,.12),inset 0 1px 0 rgba(255,255,255,.13);animation:thinkingGlow 2.6s ease-in-out infinite}.thinking-title{display:flex;align-items:center;justify-content:space-between;gap:10px;color:#fff3d6;font-size:12px}.thinking-title strong{font-weight:560}.thinking-body{margin-top:8px;color:#e9edf3;white-space:pre-wrap;max-height:180px;overflow:auto}.thinking-card.collapsed .thinking-body{display:none}
    .tool-row{width:var(--lane);margin:10px auto;border-radius:14px;padding:10px 12px;box-shadow:none;background:rgba(255,255,255,.05);display:grid;gap:5px}.tool-row header{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:12px}.tool-row strong{color:var(--text);font-weight:550}.tool-row pre{margin:0;white-space:pre-wrap;word-break:break-word;color:var(--faint);font:12px/1.45 ui-monospace,SFMono-Regular,Cascadia Code,Consolas,monospace;max-height:120px;overflow:hidden}.tool-row.running .tool-dot{animation:pulse 1.4s ease-in-out infinite}.tool-row.error{border-color:rgba(255,123,114,.34)}.tool-dot{width:7px;height:7px;border-radius:999px;background:var(--ok);box-shadow:0 0 12px var(--ok)}
    .composer{margin:0 max(12px,calc((100% - var(--lane))/2)) max(12px,env(safe-area-inset-bottom));border-radius:24px;display:grid;grid-template-columns:1fr auto auto;gap:8px;padding:8px;background:linear-gradient(135deg,rgba(255,255,255,.13),rgba(255,255,255,.055))}.composer textarea{min-height:52px;max-height:180px;resize:none;border:0;outline:0;color:var(--text);background:rgba(255,255,255,.035);border-radius:18px;padding:15px 14px}.composer textarea::placeholder{color:rgba(245,245,242,.48)}.send-btn{min-width:58px;border:1px solid rgba(255,255,255,.18);border-radius:18px;background:linear-gradient(135deg,#ff4d43,#ff8177);color:#fff;font-weight:650;box-shadow:0 0 28px rgba(255,77,67,.24)}.send-btn:hover{box-shadow:0 0 36px rgba(255,77,67,.36)}.abort-btn{width:50px;border:1px solid var(--line);border-radius:18px;background:rgba(255,255,255,.045);color:var(--muted)}
    .mobile-top{display:none}.hidden{display:none!important}
    @keyframes pulse{50%{opacity:.52;transform:scale(.82)}}@keyframes thinkingGlow{0%,100%{box-shadow:0 0 22px rgba(255,211,122,.08),inset 0 1px 0 rgba(255,255,255,.13)}50%{box-shadow:0 0 42px rgba(255,211,122,.22),inset 0 1px 0 rgba(255,255,255,.2)}}
    @media(max-width:860px){html,body{overflow:hidden}.app{grid-template-columns:1fr;padding:0;gap:0}.rail{display:none}.main{border-radius:0;border:0;height:100dvh}.mobile-top{display:flex}.topbar{height:54px;padding:0 12px;overflow:hidden}.status-pill{display:none}.feed{padding:18px max(12px,calc((100% - var(--lane))/2)) 14px}.intro-card{width:100%;max-width:540px;margin-top:6vh;padding:24px 18px}.composer{margin:0 10px max(10px,env(safe-area-inset-bottom));grid-template-columns:1fr auto}.abort-btn{display:none}.message.user{width:min(620px,calc(100vw - 44px))}.thread-title>span{display:none}}
    @media(max-width:650px){.intro-card{max-width:340px}.chips{max-width:310px;margin-left:auto;margin-right:auto}}
    @media(max-width:440px){:root{--lane:calc(100vw - 22px)}body{font-size:13px}.intro-card{max-width:340px;padding:22px 16px}.intro-card h1{font-size:clamp(30px,9vw,36px)}.intro-card p{font-size:12.5px}.chips{gap:7px}.chip{max-width:100%}.composer{border-radius:20px}.composer textarea{min-height:50px}.send-btn{min-width:52px}}
  </style>
</head>
<body>
  <div class="environment" aria-hidden="true"><div class="stars"></div></div>
  <svg width="0" height="0" class="hidden" aria-hidden="true" focusable="false">
    <filter id="remote-glass-soft" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.012 0.028" numOctaves="2" seed="17" result="noise"><animate attributeName="baseFrequency" dur="15s" values="0.010 0.024;0.016 0.034;0.010 0.024" repeatCount="indefinite"/></feTurbulence>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <filter id="remote-glass-strong" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.016 0.038" numOctaves="3" seed="19" result="noise"><animate attributeName="baseFrequency" dur="13s" values="0.013 0.032;0.022 0.048;0.013 0.032" repeatCount="indefinite"/></feTurbulence>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="9" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
  </svg>
  <div class="app">
    <aside class="rail">
      <div class="brand"><div class="pi-mark"><span>P</span></div><div><strong>Pi Agent</strong><em>Remote desktop</em></div></div>
      <div class="nav-block">
        <div class="nav-row"><strong>Status</strong><span id="railStatus">Not paired</span></div>
        <div class="nav-row"><strong>Mode</strong><span id="railMode">remote</span></div>
        <div class="nav-row"><strong>Desktop</strong><span id="railDesktop">offline</span></div>
      </div>
      <div class="nav-block">
        <div class="nav-row"><strong>Pairing</strong><span>QR approval</span></div>
        <div class="nav-row"><strong>Relay</strong><span>Cloudflare</span></div>
        <div class="nav-row"><strong>Tools</strong><span>desktop policy</span></div>
      </div>
      <div class="quick">
        <button id="reconnectButton" type="button">Reconnect</button>
        <button id="forgetButton" type="button">Forget iPad pairing</button>
      </div>
    </aside>
    <main class="main">
      <header class="topbar">
        <div class="thread-title mobile-top"><div class="pi-mark"><span>P</span></div><strong>Pi Agent</strong><span>iPad remote</span></div>
        <div class="thread-title"><span class="dot" id="dot"></span><strong id="topStatus">Not paired</strong><span id="topDetail">scan QR from desktop</span></div>
        <div class="status-pill"><strong id="modePill">Remote</strong><span id="desktopPill">desktop required</span></div>
      </header>
      <section id="feed" class="feed" aria-live="polite">
        <div id="intro" class="intro-card">
          <div class="pi-mark intro-mark"><span>P</span></div>
          <h1>PiAgent from iPad.</h1>
          <p id="introText">Open PiAgent on the computer, enable Remote Access, create a QR code, then approve this iPad on the desktop.</p>
          <div class="chips"><span class="chip">Outbound tunnel</span><span class="chip">One-use QR</span><span class="chip">Desktop approval</span><span class="chip">Revocable devices</span></div>
        </div>
      </section>
      <form id="composer" class="composer hidden">
        <textarea id="prompt" maxlength="12000" rows="1" placeholder="Ask PiAgent anything on your computer..."></textarea>
        <button id="abortButton" class="abort-btn" type="button" title="Abort current run">Stop</button>
        <button id="sendButton" class="send-btn" type="submit">Send</button>
      </form>
    </main>
  </div>
  <script nonce="__CSP_NONCE__">
    var feed = document.getElementById('feed');
    var intro = document.getElementById('intro');
    var composer = document.getElementById('composer');
    var promptEl = document.getElementById('prompt');
    var sendButton = document.getElementById('sendButton');
    var abortButton = document.getElementById('abortButton');
    var dot = document.getElementById('dot');
    var topStatus = document.getElementById('topStatus');
    var topDetail = document.getElementById('topDetail');
    var modePill = document.getElementById('modePill');
    var desktopPill = document.getElementById('desktopPill');
    var railStatus = document.getElementById('railStatus');
    var railMode = document.getElementById('railMode');
    var railDesktop = document.getElementById('railDesktop');
    var reconnectButton = document.getElementById('reconnectButton');
    var forgetButton = document.getElementById('forgetButton');
    var desktopId = localStorage.getItem('piagent.remote.desktopId') || '';
    var ws = null;
    var runActive = false;
    var assistantEl = null;
    var thinkingEl = null;
    var thinkingBody = null;
    var tools = {};

    function setStatus(text, detail, state) {
      topStatus.textContent = text;
      topDetail.textContent = detail || '';
      railStatus.textContent = text;
      dot.classList.toggle('ok', state === 'ok');
      dot.classList.toggle('run', state === 'run');
    }

    function setMode(mode, desktopConnected) {
      modePill.textContent = mode || 'Remote';
      railMode.textContent = mode || 'remote';
      desktopPill.textContent = desktopConnected ? 'desktop online' : 'desktop offline';
      railDesktop.textContent = desktopConnected ? 'online' : 'offline';
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

    function scrollToBottom() {
      feed.scrollTop = feed.scrollHeight;
    }

    function showChat() {
      if (intro) intro.classList.add('hidden');
      composer.classList.remove('hidden');
    }

    function appendMessage(kind, text) {
      showChat();
      var item = document.createElement('div');
      item.className = 'message ' + kind;
      item.textContent = text || '';
      if (kind === 'assistant') {
        var actions = document.createElement('div');
        actions.className = 'message-actions';
        var copy = document.createElement('button');
        copy.type = 'button';
        copy.title = 'Copy';
        copy.textContent = 'Copy';
        copy.addEventListener('click', function () {
          navigator.clipboard && navigator.clipboard.writeText(item.firstChild ? item.firstChild.textContent || item.textContent : item.textContent);
        });
        actions.appendChild(copy);
        item.appendChild(actions);
      }
      feed.appendChild(item);
      scrollToBottom();
      return item;
    }

    function appendAssistantDelta(delta) {
      if (!assistantEl) assistantEl = appendMessage('assistant', '');
      var first = assistantEl.firstChild;
      if (first && first.nodeType === Node.TEXT_NODE) first.textContent = (first.textContent || '') + delta;
      else assistantEl.insertBefore(document.createTextNode(delta), assistantEl.firstChild);
      scrollToBottom();
    }

    function ensureThinking() {
      if (thinkingEl) return thinkingEl;
      thinkingEl = document.createElement('div');
      thinkingEl.className = 'thinking-card';
      var title = document.createElement('button');
      title.type = 'button';
      title.className = 'thinking-title icon-btn';
      var titleStrong = document.createElement('strong');
      titleStrong.textContent = 'Thinking';
      var titleState = document.createElement('span');
      titleState.textContent = 'Hide';
      title.appendChild(titleStrong);
      title.appendChild(titleState);
      thinkingBody = document.createElement('div');
      thinkingBody.className = 'thinking-body';
      title.addEventListener('click', function () {
        thinkingEl.classList.toggle('collapsed');
        titleState.textContent = thinkingEl.classList.contains('collapsed') ? 'Show' : 'Hide';
      });
      thinkingEl.appendChild(title);
      thinkingEl.appendChild(thinkingBody);
      feed.appendChild(thinkingEl);
      return thinkingEl;
    }

    function appendThinking(delta) {
      ensureThinking();
      thinkingBody.textContent = (thinkingBody.textContent || '') + delta;
      scrollToBottom();
    }

    function toolLabel(event) {
      return event.toolName || event.name || 'tool';
    }

    function upsertTool(event, status) {
      showChat();
      var id = event.toolCallId || event.id || toolLabel(event);
      var row = tools[id];
      if (!row) {
        row = document.createElement('div');
        row.className = 'tool-row running';
        var header = document.createElement('header');
        var dotEl = document.createElement('span');
        dotEl.className = 'tool-dot';
        var title = document.createElement('strong');
        title.textContent = toolLabel(event);
        var state = document.createElement('span');
        state.textContent = 'running';
        header.appendChild(dotEl);
        header.appendChild(title);
        header.appendChild(state);
        var pre = document.createElement('pre');
        row.appendChild(header);
        row.appendChild(pre);
        row._state = state;
        row._pre = pre;
        tools[id] = row;
        feed.appendChild(row);
      }
      row.classList.toggle('running', status === 'running');
      row.classList.toggle('error', status === 'error');
      row._state.textContent = status;
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

    function sendCommand(command) {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        appendMessage('status error', 'Remote socket is not connected.');
        return false;
      }
      ws.send(JSON.stringify(command));
      return true;
    }

    function connect() {
      if (!desktopId) {
        setStatus('Not paired', 'scan QR from desktop', 'bad');
        return;
      }
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
      setStatus('Connecting', 'waiting for desktop relay', 'run');
      var scheme = location.protocol === 'https:' ? 'wss://' : 'ws://';
      ws = new WebSocket(scheme + location.host + '/relay/client?desktopId=' + encodeURIComponent(desktopId));
      ws.onopen = function () {
        setStatus('Connected', 'Pi Agent Ready', 'ok');
        setMode('remote', true);
        showChat();
        appendMessage('status', 'Connected to your desktop PiAgent.');
      };
      ws.onclose = function () {
        setStatus('Disconnected', 'open PiAgent desktop or reconnect', 'bad');
        setMode(modePill.textContent, false);
        runActive = false;
        sendButton.disabled = false;
      };
      ws.onerror = function () {
        setStatus('Connection error', 'pair again if needed', 'bad');
      };
      ws.onmessage = function (event) {
        var message = {};
        try { message = JSON.parse(event.data); } catch (error) { return; }
        if (message.type === 'remote_ready') {
          setStatus('Connected', 'Pi Agent Ready', 'ok');
          setMode(modePill.textContent, Boolean(message.desktopConnected));
          return;
        }
        if (message.type === 'desktop_status') {
          var status = message.status || {};
          setMode(status.mode || 'remote', true);
          return;
        }
        if (message.type === 'desktop_offline') {
          appendMessage('status error', message.error || 'Desktop is offline.');
          setMode(modePill.textContent, false);
          runActive = false;
          sendButton.disabled = false;
          dot.classList.remove('run');
          return;
        }
        if (message.type === 'command_response') {
          if (!message.ok) appendMessage('status error', message.error || 'Command failed.');
          if (message.ok === false || !runActive) sendButton.disabled = false;
          return;
        }
        if (message.type === 'pi_event') handlePiEvent(message.event || {});
      };
    }

    function handlePiEvent(event) {
      var assistantEvent = event.assistantMessageEvent || {};
      if (event.type === 'agent_start') {
        runActive = true;
        sendButton.disabled = true;
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
        appendAssistantDelta(assistantEvent.delta);
        return;
      }
      if (event.type === 'tool_execution_start') {
        upsertTool(event, 'running');
        return;
      }
      if (event.type === 'tool_execution_end') {
        upsertTool(event, event.isError ? 'error' : 'done');
        return;
      }
      if (event.type === 'agent_end') {
        runActive = false;
        sendButton.disabled = false;
        setStatus('Connected', 'Pi Agent Ready', 'ok');
        assistantEl = null;
        thinkingEl = null;
        thinkingBody = null;
        appendMessage('status', 'Run complete.');
        return;
      }
      if (event.type === 'process_exit' || event.type === 'process_error' || event.type === 'auth_required') {
        runActive = false;
        sendButton.disabled = false;
        setStatus('Needs desktop', 'check PiAgent on the computer', 'bad');
        appendMessage('status error', event.message || 'PiAgent process stopped.');
      }
    }

    async function pairFromHash() {
      var params = new URLSearchParams(location.hash.slice(1));
      var packed = params.get('pair');
      if (!packed) return false;
      history.replaceState(null, '', location.pathname);
      try {
        var payload = decodePacked(packed);
        desktopId = payload.desktopId;
        var deviceSecret = token(32);
        setStatus('Pairing', 'waiting for desktop approval', 'run');
        var claim = await post('/api/pair/claim', {
          desktopId: payload.desktopId,
          pairId: payload.pairId,
          pairSecret: payload.pairSecret,
          deviceSecret: deviceSecret,
          deviceName: (navigator.platform || 'iPad') + ' remote'
        });
        appendMessage('status', 'Pairing request sent. Approve this device in PiAgent Desktop.');
        var started = Date.now();
        var poll = async function () {
          if (Date.now() - started > 10 * 60 * 1000) {
            setStatus('Pairing expired', 'create a new QR', 'bad');
            return;
          }
          try {
            var state = await post('/api/pair/status', {
              desktopId: payload.desktopId,
              approvalId: claim.approvalId,
              approvalSecret: claim.approvalSecret,
              deviceSecret: deviceSecret
            });
            if (state.status === 'approved') {
              localStorage.setItem('piagent.remote.desktopId', payload.desktopId);
              desktopId = payload.desktopId;
              setStatus('Approved', 'connecting', 'ok');
              connect();
              return;
            }
            if (state.status === 'denied') {
              setStatus('Denied', 'desktop rejected pairing', 'bad');
              return;
            }
          } catch (error) {
            appendMessage('status error', error.message || 'Pairing failed.');
            return;
          }
          setTimeout(poll, 1800);
        };
        poll();
      } catch (error) {
        setStatus('Pairing failed', error.message || 'invalid QR', 'bad');
      }
      return true;
    }

    composer.addEventListener('submit', function (event) {
      event.preventDefault();
      var text = promptEl.value.trim();
      if (!text || runActive) return;
      appendMessage('user', text);
      promptEl.value = '';
      runActive = true;
      sendButton.disabled = true;
      assistantEl = null;
      thinkingEl = null;
      thinkingBody = null;
      tools = {};
      setStatus('Working', 'Pi Agent is running', 'run');
      sendCommand({ type:'prompt', id: token(10), message: text });
    });

    promptEl.addEventListener('input', function () {
      promptEl.style.height = 'auto';
      promptEl.style.height = Math.min(180, promptEl.scrollHeight) + 'px';
    });

    abortButton.addEventListener('click', function () {
      if (!runActive) return;
      sendCommand({ type:'abort', id: token(10) });
      runActive = false;
      sendButton.disabled = false;
      setStatus('Stopping', 'abort requested', 'run');
    });

    reconnectButton.addEventListener('click', connect);
    forgetButton.addEventListener('click', function () {
      localStorage.removeItem('piagent.remote.desktopId');
      desktopId = '';
      if (ws) ws.close();
      setStatus('Forgotten', 'scan a new QR', 'bad');
    });

    (async function boot() {
      setMode('remote', false);
      if (await pairFromHash()) return;
      if (desktopId) connect();
      else setStatus('Not paired', 'scan QR from desktop', 'bad');
    })();
  </script>
</body>
</html>`;
