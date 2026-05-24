use std::{
    fs::{self, OpenOptions},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::Mutex,
};
use tauri::{Manager, State};

struct BackendProcess(Mutex<Option<Child>>);

fn project_root(app: &tauri::AppHandle) -> std::path::PathBuf {
    if cfg!(debug_assertions) {
        std::env::current_dir()
            .ok()
            .and_then(|cwd| cwd.parent().map(|p| p.to_path_buf()))
            .unwrap_or_else(|| std::path::PathBuf::from(".."))
    } else {
        app.path()
            .resource_dir()
            .unwrap_or_else(|_| std::env::current_exe().unwrap_or_default())
    }
}

fn node_executable(root: &Path) -> PathBuf {
    if cfg!(debug_assertions) {
        return PathBuf::from("node");
    }

    [
        root.join("binaries").join("node-x86_64-pc-windows-msvc.exe"),
        root.join("node-x86_64-pc-windows-msvc.exe"),
        root.join("node.exe"),
    ]
    .into_iter()
    .find(|candidate| candidate.exists())
    .unwrap_or_else(|| PathBuf::from("node"))
}

fn backend_log_stdio(app: &tauri::AppHandle) -> (Stdio, Stdio) {
    let Ok(log_dir) = app.path().app_log_dir() else {
        return (Stdio::null(), Stdio::null());
    };
    if fs::create_dir_all(&log_dir).is_err() {
        return (Stdio::null(), Stdio::null());
    }

    let log_path = log_dir.join("backend.log");
    let Ok(stdout_file) = OpenOptions::new().create(true).append(true).open(&log_path) else {
        return (Stdio::null(), Stdio::null());
    };
    let stderr_file = match stdout_file.try_clone() {
        Ok(file) => file,
        Err(_) => return (Stdio::from(stdout_file), Stdio::null()),
    };

    (Stdio::from(stdout_file), Stdio::from(stderr_file))
}

fn start_backend(app: &tauri::AppHandle, state: &State<BackendProcess>) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|_| "backend lock poisoned".to_string())?;
    if let Some(child) = guard.as_mut() {
        match child.try_wait() {
            Ok(Some(_)) => {
                *guard = None;
            }
            Ok(None) => return Ok(()),
            Err(_) => {
                let _ = child.kill();
                *guard = None;
            }
        }
    }

    let root = if cfg!(debug_assertions) {
        std::env::current_dir()
            .ok()
            .and_then(|cwd| cwd.parent().map(|p| p.to_path_buf()))
            .unwrap_or_else(|| std::path::PathBuf::from(".."))
    } else {
        app.path()
            .resource_dir()
            .map_err(|e| e.to_string())?
    };
    let server_entry = root.join("server").join("dist").join("index.js");
    if !server_entry.exists() {
        return Err(format!("backend entry missing: {}", server_entry.display()));
    }
    let server_entry_arg = PathBuf::from("server").join("dist").join("index.js");

    let node = node_executable(&root);
    let (stdout, stderr) = backend_log_stdio(app);
    let child = Command::new(&node)
        .arg(server_entry_arg)
        .current_dir(&root)
        .env("NODE_ENV", "production")
        .env("PIAGENT_PORT", "1456")
        .stdin(Stdio::null())
        .stdout(stdout)
        .stderr(stderr)
        .spawn()
        .map_err(|e| format!("unable to start Node backend with {}: {e}", node.display()))?;

    *guard = Some(child);
    Ok(())
}

#[tauri::command]
fn backend_status(app: tauri::AppHandle, state: State<BackendProcess>) -> Result<String, String> {
    start_backend(&app, &state)?;
    Ok("running".to_string())
}

#[tauri::command]
fn app_root(app: tauri::AppHandle) -> String {
    project_root(&app).display().to_string()
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(BackendProcess(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![backend_status, app_root])
        .setup(|app| {
            let handle = app.handle().clone();
            let state = handle.state::<BackendProcess>();
            let _ = start_backend(&handle, &state);
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let child = {
                    let state = window.state::<BackendProcess>();
                    state.0.lock().ok().and_then(|mut guard| guard.take())
                };
                if let Some(mut child) = child {
                    let _ = child.kill();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running PiAgent");
}

fn main() {
    run();
}
