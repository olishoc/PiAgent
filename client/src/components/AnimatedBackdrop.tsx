import { useEffect, useRef } from "react";
import type { AppSettings } from "../App";
import { startAnimatedBackdrop } from "../lib/animatedBackdropCore";

type BackdropMode = AppSettings["animatedBackground"];
type ThemeMode = "dark" | "light" | "system" | undefined;

interface AnimatedBackdropProps {
  mode: BackdropMode;
  theme: ThemeMode;
  palette: AppSettings["themePreset"];
  accent: string;
  cursorLight: AppSettings["cursorLight"];
}

export default function AnimatedBackdrop({ mode, theme, palette, accent, cursorLight }: AnimatedBackdropProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return startAnimatedBackdrop(canvas, { mode, theme, palette, accent, cursorLight });
  }, [mode, theme, palette, accent, cursorLight]);

  return <canvas ref={canvasRef} className="animated-backdrop-canvas" aria-hidden="true" />;
}
