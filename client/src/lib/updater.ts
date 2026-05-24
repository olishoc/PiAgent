export type UpdateState = "idle" | "checking" | "available" | "current" | "installing" | "error";

export interface UpdateStatus {
  state: UpdateState;
  message: string;
}

export async function checkAndInstallUpdate(onStatus: (status: UpdateStatus) => void) {
  const tauri = (window as any).__TAURI_INTERNALS__;
  if (!tauri) {
    onStatus({ state: "error", message: "Updates are available only in the desktop app." });
    return;
  }

  onStatus({ state: "checking", message: "Checking for updates..." });
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (!update) {
      onStatus({ state: "current", message: "PiAgent is up to date." });
      return;
    }

    onStatus({ state: "available", message: `Installing PiAgent ${update.version}...` });
    await update.downloadAndInstall();
    onStatus({ state: "installing", message: "Update installed. Restart PiAgent to finish." });
  } catch (error) {
    onStatus({ state: "error", message: error instanceof Error ? error.message : String(error) });
  }
}
