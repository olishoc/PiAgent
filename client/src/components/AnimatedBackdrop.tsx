import { useEffect, useRef } from "react";
import type { AppSettings } from "../App";

type BackdropMode = AppSettings["animatedBackground"];
type ThemeMode = "dark" | "light" | "system" | undefined;

interface AnimatedBackdropProps {
  mode: BackdropMode;
  theme: ThemeMode;
  palette: AppSettings["themePreset"];
  accent: string;
  cursorLight: AppSettings["cursorLight"];
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

interface PointerState {
  x: number;
  y: number;
  active: boolean;
  down: boolean;
  nearInteractive: boolean;
  lastSeen: number;
}

const paletteAccents: Record<AppSettings["themePreset"], [string, string, string]> = {
  codex: ["#4cf2ff", "#b79cff", "#ff6f9f"],
  graphite: ["#f3f5f7", "#93a4b8", "#66d9ef"],
  midnight: ["#3fe7ff", "#776bff", "#d46cff"],
  ember: ["#ffd07a", "#ff784f", "#ffb1a1"],
  absolute: ["#ffffff", "#79f7ff", "#ff3b30"],
  paper: ["#7ed7ff", "#f5ffffff", "#ffd27a"],
  dawn: ["#ffcf90", "#ff9f7a", "#7ed7ff"],
  contrast: ["#ffffff", "#00f5ff", "#ff453a"]
};

function parseHex(input: string): Rgb {
  const value = input.trim().replace("#", "");
  const hex = value.length === 3
    ? value.split("").map((part) => `${part}${part}`).join("")
    : value.padEnd(6, "0").slice(0, 6);
  const number = Number.parseInt(hex, 16);
  if (!Number.isFinite(number)) return { r: 88, g: 166, b: 255 };
  return {
    r: (number >> 16) & 255,
    g: (number >> 8) & 255,
    b: number & 255
  };
}

function rgba(color: string | Rgb, alpha: number) {
  const next = typeof color === "string" ? parseHex(color) : color;
  return `rgba(${next.r}, ${next.g}, ${next.b}, ${alpha})`;
}

function mix(a: Rgb, b: Rgb, amount: number): Rgb {
  return {
    r: Math.round(a.r + (b.r - a.r) * amount),
    g: Math.round(a.g + (b.g - a.g) * amount),
    b: Math.round(a.b + (b.b - a.b) * amount)
  };
}

function fract(value: number) {
  return value - Math.floor(value);
}

function star(seed: number, width: number, height: number) {
  const x = fract(Math.sin(seed * 12.9898) * 43758.5453) * width;
  const y = fract(Math.sin(seed * 78.233) * 24634.6345) * height * 0.54;
  const size = 0.6 + fract(Math.sin(seed * 37.719) * 15423.33) * 1.5;
  return { x, y, size };
}

function fillBase(ctx: CanvasRenderingContext2D, width: number, height: number, mode: BackdropMode, light: boolean, colors: string[]) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  if (mode === "cartoon-beach") {
    gradient.addColorStop(0, light ? "#8cdfff" : "#111a39");
    gradient.addColorStop(0.48, light ? "#ffe7a8" : "#1d2a56");
    gradient.addColorStop(1, light ? "#63c7ce" : "#051326");
  } else if (mode === "solar-frost") {
    gradient.addColorStop(0, light ? "#ecfbff" : "#d8f8ff");
    gradient.addColorStop(0.55, light ? "#d7f1ff" : "#8fcce8");
    gradient.addColorStop(1, light ? "#c6e8eb" : "#dff8ff");
  } else if (mode === "sci-fi-grid") {
    gradient.addColorStop(0, "#02040d");
    gradient.addColorStop(0.55, "#05091a");
    gradient.addColorStop(1, "#010207");
  } else {
    gradient.addColorStop(0, light ? "#dff6ff" : "#03101b");
    gradient.addColorStop(0.52, light ? "#f5fdff" : "#060712");
    gradient.addColorStop(1, light ? "#bfe9ef" : "#010205");
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.18, height * 0.08, 0, width * 0.18, height * 0.08, width * 0.72);
  glow.addColorStop(0, rgba(colors[0], light ? 0.28 : 0.34));
  glow.addColorStop(0.48, rgba(colors[1], light ? 0.14 : 0.2));
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalCompositeOperation = light ? "source-over" : "screen";
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = "source-over";
}

function drawStars(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, light: boolean) {
  if (light) return;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < 90; i += 1) {
    const item = star(i + 1, width, height);
    const twinkle = 0.32 + Math.sin(time * 1.2 + i * 0.9) * 0.22;
    ctx.fillStyle = `rgba(255,255,255,${Math.max(0.08, twinkle)})`;
    ctx.beginPath();
    ctx.arc(item.x, item.y, item.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawAurora(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, colors: string[], light: boolean) {
  ctx.save();
  ctx.globalCompositeOperation = light ? "source-over" : "screen";
  for (let band = 0; band < 3; band += 1) {
    const base = height * (0.14 + band * 0.09);
    const amplitude = height * (0.05 + band * 0.018);
    const gradient = ctx.createLinearGradient(0, base, width, base + height * 0.24);
    gradient.addColorStop(0, rgba(colors[band % colors.length], 0));
    gradient.addColorStop(0.34, rgba(colors[band % colors.length], light ? 0.17 : 0.28));
    gradient.addColorStop(0.58, rgba(colors[(band + 1) % colors.length], light ? 0.14 : 0.22));
    gradient.addColorStop(1, rgba(colors[(band + 2) % colors.length], 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(-80, base);
    for (let x = -80; x <= width + 80; x += Math.max(18, width / 42)) {
      const y = base
        + Math.sin((x / width) * Math.PI * 3.2 + time * (0.55 + band * 0.11)) * amplitude
        + Math.sin((x / width) * Math.PI * 7.5 - time * 0.34) * amplitude * 0.42;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width + 80, base + height * 0.34);
    ctx.lineTo(-80, base + height * 0.22);
    ctx.closePath();
    ctx.filter = `blur(${10 + band * 8}px)`;
    ctx.fill();
    ctx.filter = "none";
  }
  ctx.restore();
}

function drawOcean(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, colors: string[], light: boolean, lunar = false) {
  const horizon = lunar ? height * 0.38 : height * 0.46;
  ctx.save();
  if (lunar) {
    const moon = ctx.createRadialGradient(width * 0.72, height * 0.16, 0, width * 0.72, height * 0.16, height * 0.24);
    moon.addColorStop(0, "rgba(255,255,255,0.9)");
    moon.addColorStop(0.16, "rgba(255,255,255,0.36)");
    moon.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = moon;
    ctx.fillRect(0, 0, width, height);
  }
  const sea = ctx.createLinearGradient(0, horizon, 0, height);
  sea.addColorStop(0, light ? "rgba(95,205,220,0.68)" : "rgba(12,57,82,0.82)");
  sea.addColorStop(1, light ? "rgba(45,158,173,0.9)" : "rgba(1,4,12,0.96)");
  ctx.fillStyle = sea;
  ctx.fillRect(0, horizon, width, height - horizon);
  ctx.globalCompositeOperation = light ? "source-over" : "screen";
  for (let row = 0; row < 24; row += 1) {
    const y = horizon + row * ((height - horizon) / 21);
    const amp = 4 + row * 0.48;
    const alpha = lunar ? 0.1 + row * 0.009 : 0.08 + row * 0.006;
    ctx.strokeStyle = row % 3 === 0 ? rgba(colors[0], alpha) : `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = Math.max(0.6, 1.4 - row * 0.02);
    ctx.beginPath();
    for (let x = -40; x <= width + 40; x += 18) {
      const wave = Math.sin(x * 0.018 + time * (0.55 + row * 0.012) + row * 0.55) * amp;
      const ripple = Math.sin(x * 0.052 - time * 0.35) * amp * 0.32;
      if (x === -40) ctx.moveTo(x, y + wave + ripple);
      else ctx.lineTo(x, y + wave + ripple);
    }
    ctx.stroke();
  }
  if (lunar) {
    const reflect = ctx.createLinearGradient(width * 0.68, horizon, width * 0.68, height);
    reflect.addColorStop(0, "rgba(255,255,255,0.28)");
    reflect.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = reflect;
    ctx.beginPath();
    ctx.moveTo(width * 0.62, horizon);
    ctx.lineTo(width * 0.78, horizon);
    ctx.lineTo(width * 0.58, height);
    ctx.lineTo(width * 0.84, height);
    ctx.closePath();
    ctx.filter = "blur(18px)";
    ctx.fill();
    ctx.filter = "none";
  }
  ctx.restore();
}

function drawPrism(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, colors: string[]) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < 14; i += 1) {
    const angle = time * 0.11 + i * 0.52;
    const radius = Math.min(width, height) * (0.16 + i * 0.018);
    const x = width * 0.5 + Math.cos(angle) * radius * 1.4;
    const y = height * 0.46 + Math.sin(angle * 1.3) * radius * 0.82;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 2.4);
    gradient.addColorStop(0, rgba(colors[i % colors.length], 0.18));
    gradient.addColorStop(0.36, rgba(colors[(i + 1) % colors.length], 0.09));
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();
}

function drawSciFi(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, colors: string[]) {
  const horizon = height * 0.48;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.strokeStyle = rgba(colors[0], 0.28);
  ctx.lineWidth = 1;
  const shift = (time * 44) % 46;
  for (let i = 0; i < 26; i += 1) {
    const y = horizon + Math.pow(i / 25, 1.75) * (height - horizon + 80) - shift;
    ctx.globalAlpha = Math.max(0.08, i / 25);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (let i = -16; i <= 16; i += 1) {
    const x = width * 0.5 + i * width * 0.045;
    ctx.beginPath();
    ctx.moveTo(width * 0.5, horizon);
    ctx.lineTo(x * 2 - width * 0.5, height + 40);
    ctx.stroke();
  }
  const scanner = ctx.createLinearGradient(0, 0, width, 0);
  scanner.addColorStop(0, "rgba(0,0,0,0)");
  scanner.addColorStop(0.5, rgba(colors[1], 0.34));
  scanner.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = scanner;
  ctx.globalAlpha = 0.9;
  const scannerX = ((time * 96) % (width + 320)) - 160;
  ctx.fillRect(scannerX, 0, 120, height);
  ctx.restore();
}

function drawCartoonBeach(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, colors: string[], light: boolean) {
  ctx.save();
  const sunX = width * 0.18;
  const sunY = height * 0.16;
  const sun = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, height * 0.22);
  sun.addColorStop(0, light ? "rgba(255,255,255,0.95)" : "rgba(255,218,137,0.72)");
  sun.addColorStop(0.22, light ? "rgba(255,220,120,0.62)" : "rgba(255,168,75,0.28)");
  sun.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, width, height);

  ctx.globalCompositeOperation = light ? "source-over" : "screen";
  for (let i = 0; i < 16; i += 1) {
    const x = (i / 15) * width;
    const y = height * 0.34 + Math.sin(i * 0.9 + time * 0.7) * 16;
    ctx.strokeStyle = rgba(colors[i % colors.length], light ? 0.22 : 0.42);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x - width * 0.08, y);
    ctx.quadraticCurveTo(x, y + 18, x + width * 0.08, y);
    ctx.stroke();
    ctx.fillStyle = `rgba(255,255,255,${light ? 0.34 : 0.52})`;
    ctx.beginPath();
    ctx.arc(x, y + Math.sin(time * 2 + i) * 3, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  drawOcean(ctx, width, height, time * 0.85, colors, light);
  ctx.restore();
}

function drawPointerLight(ctx: CanvasRenderingContext2D, pointer: PointerState, width: number, height: number, time: number, colors: string[], cursorLight: AppSettings["cursorLight"]) {
  if (cursorLight === "off" || !pointer.active || pointer.x < 0 || pointer.y < 0 || pointer.x > width || pointer.y > height) return;
  const elapsed = performance.now() - pointer.lastSeen;
  if (elapsed > 1400) return;
  const intensity = (cursorLight === "strong" ? 0.34 : 0.18) + (pointer.down ? 0.24 : 0) + (pointer.nearInteractive ? 0.13 : 0);
  const radius = (cursorLight === "strong" ? 170 : 92) * (pointer.down ? 1.16 : 1);
  const gradient = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, radius);
  gradient.addColorStop(0, `rgba(255,255,255,${Math.min(0.72, intensity + 0.14)})`);
  gradient.addColorStop(0.13, rgba(colors[0], intensity));
  gradient.addColorStop(0.46, rgba(colors[1], intensity * 0.42));
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(pointer.x, pointer.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMotionWash(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, colors: string[], light: boolean) {
  const x = width * (0.5 + Math.sin(time * 0.23) * 0.38);
  const y = height * (0.42 + Math.cos(time * 0.19) * 0.16);
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, Math.max(width, height) * 0.62);
  gradient.addColorStop(0, rgba(colors[0], light ? 0.08 : 0.12));
  gradient.addColorStop(0.36, rgba(colors[1], light ? 0.045 : 0.07));
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.globalCompositeOperation = light ? "source-over" : "screen";
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

export default function AnimatedBackdrop({ mode, theme, palette, accent, cursorLight }: AnimatedBackdropProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const pointer: PointerState = { x: -1000, y: -1000, active: false, down: false, nearInteractive: false, lastSeen: 0 };
    const paletteColors = paletteAccents[palette] ?? paletteAccents.codex;
    const accentRgb = parseHex(accent);
    const colors = [
      rgba(mix(parseHex(paletteColors[0]), accentRgb, 0.22), 1).replace("rgba", "rgb").replace(", 1)", ")"),
      paletteColors[1],
      paletteColors[2]
    ];
    const light = theme === "light" || mode === "solar-frost";
    let width = 0;
    let height = 0;
    let animationFrame = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const interactiveSelector = "button, a, input, textarea, select, [role='button'], .composer, .pill-menu, .setting-select-menu, .session-row, .project-row, .message-actions, .toolbar-actions";
    const move = (event: PointerEvent | MouseEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = pointer.x >= 0 && pointer.y >= 0 && pointer.x <= window.innerWidth && pointer.y <= window.innerHeight;
      pointer.nearInteractive = event.target instanceof Element && Boolean(event.target.closest(interactiveSelector));
      pointer.lastSeen = performance.now();
    };
    const down = (event: PointerEvent | MouseEvent) => {
      move(event);
      pointer.down = true;
    };
    const up = (event: PointerEvent | MouseEvent) => {
      move(event);
      pointer.down = false;
    };
    const leave = () => {
      pointer.active = false;
      pointer.down = false;
      pointer.nearInteractive = false;
    };

    const draw = (now: number) => {
      const time = now / 1000;
      ctx.clearRect(0, 0, width, height);
      fillBase(ctx, width, height, mode, light, colors);
      drawStars(ctx, width, height, time, light || mode === "cartoon-beach");
      if (mode === "aurora-glass") drawAurora(ctx, width, height, time, colors, light);
      if (mode === "midnight-ocean") {
        drawAurora(ctx, width, height, time * 0.45, colors, light);
        drawOcean(ctx, width, height, time, colors, light);
      }
      if (mode === "liquid-prism") drawPrism(ctx, width, height, time, colors);
      if (mode === "solar-frost") {
        drawAurora(ctx, width, height, time * 0.28, ["#ffffff", colors[0], colors[1]], true);
        drawOcean(ctx, width, height, time * 0.36, colors, true);
      }
      if (mode === "sci-fi-grid") {
        drawAurora(ctx, width, height, time * 0.25, colors, false);
        drawSciFi(ctx, width, height, time, colors);
      }
      if (mode === "lunar-waves") {
        drawAurora(ctx, width, height, time * 0.35, colors, false);
        drawOcean(ctx, width, height, time, colors, false, true);
      }
      if (mode === "cartoon-beach") drawCartoonBeach(ctx, width, height, time, colors, light);
      drawMotionWash(ctx, width, height, time, colors, light);
      drawPointerLight(ctx, pointer, width, height, time, colors, cursorLight);
      animationFrame = window.requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", down, { passive: true });
    window.addEventListener("pointerup", up, { passive: true });
    window.addEventListener("mousemove", move, { passive: true });
    window.addEventListener("mousedown", down, { passive: true });
    window.addEventListener("mouseup", up, { passive: true });
    window.addEventListener("blur", leave);
    document.addEventListener("mouseleave", leave);
    animationFrame = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mousedown", down);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("blur", leave);
      document.removeEventListener("mouseleave", leave);
    };
  }, [mode, theme, palette, accent, cursorLight]);

  return <canvas ref={canvasRef} className="animated-backdrop-canvas" aria-hidden="true" />;
}
