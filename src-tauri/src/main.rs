use std::{
    fs::{self, OpenOptions},
    io::{Read, Write},
    net::TcpStream,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::Mutex,
    time::Duration,
};
use tauri::{Manager, State};

struct BackendProcess(Mutex<Option<Child>>);
const BACKEND_ADDR: &str = "127.0.0.1:1456";
const EXPECTED_BACKEND_VERSION: &str = env!("CARGO_PKG_VERSION");

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
        root.join("binaries")
            .join("node-x86_64-pc-windows-msvc.exe"),
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

fn write_launcher_log(app: &tauri::AppHandle, message: &str) {
    let Ok(log_dir) = app.path().app_log_dir() else {
        return;
    };
    if fs::create_dir_all(&log_dir).is_err() {
        return;
    }
    let log_path = log_dir.join("backend.log");
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(log_path) {
        let _ = writeln!(file, "[launcher] {message}");
    }
}

fn port_accepts_connection() -> bool {
    TcpStream::connect_timeout(
        &BACKEND_ADDR
            .parse()
            .expect("hard-coded backend address is valid"),
        Duration::from_millis(200),
    )
    .is_ok()
}

fn backend_health() -> Option<serde_json::Value> {
    let mut stream = TcpStream::connect_timeout(
        &BACKEND_ADDR
            .parse()
            .expect("hard-coded backend address is valid"),
        Duration::from_millis(300),
    )
    .ok()?;
    let _ = stream.set_read_timeout(Some(Duration::from_millis(600)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(300)));
    stream
        .write_all(b"GET /api/health HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n")
        .ok()?;

    let mut response = String::new();
    stream.read_to_string(&mut response).ok()?;
    let body = response.split("\r\n\r\n").nth(1)?;
    serde_json::from_str(body.trim()).ok()
}

fn backend_matches_expected(health: &serde_json::Value) -> bool {
    health.get("ok").and_then(|value| value.as_bool()) == Some(true)
        && health.get("app").and_then(|value| value.as_str()) == Some("PiAgent")
        && health.get("version").and_then(|value| value.as_str()) == Some(EXPECTED_BACKEND_VERSION)
        && health
            .pointer("/features/subagents")
            .and_then(|value| value.as_bool())
            == Some(true)
}

fn describe_backend_health(health: &serde_json::Value) -> String {
    let app = health
        .get("app")
        .and_then(|value| value.as_str())
        .unwrap_or("unknown app");
    let version = health
        .get("version")
        .and_then(|value| value.as_str())
        .unwrap_or("unknown version");
    format!("{app} {version}")
}

#[cfg(target_os = "windows")]
fn kill_stale_backend_processes(root: &Path) {
    if cfg!(debug_assertions) {
        return;
    }

    let root_text = root.to_string_lossy().to_string();
    let script = r#"$root = $env:PIAGENT_BACKEND_ROOT
Get-CimInstance Win32_Process | Where-Object {
    ($_.Name -eq 'node.exe' -or $_.Name -eq 'node-x86_64-pc-windows-msvc.exe') -and
    ($_.CommandLine -like '*server\dist\index.js*' -or $_.CommandLine -like '*server/dist/index.js*') -and
    $_.CommandLine -like ('*' + $root + '*')
} | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}"#;

    let _ = Command::new("powershell.exe")
        .arg("-NoProfile")
        .arg("-ExecutionPolicy")
        .arg("Bypass")
        .arg("-Command")
        .arg(script)
        .env("PIAGENT_BACKEND_ROOT", root_text)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();
}

#[cfg(not(target_os = "windows"))]
fn kill_stale_backend_processes(_root: &Path) {}

#[cfg(target_os = "windows")]
fn kill_backend_port_owner(root: &Path, health_version: &str) {
    let root_text = root.to_string_lossy().to_string();
    let script = r#"$root = $env:PIAGENT_BACKEND_ROOT
$healthVersion = $env:PIAGENT_HEALTH_VERSION
Get-NetTCPConnection -LocalPort 1456 -State Listen -ErrorAction SilentlyContinue |
Select-Object -ExpandProperty OwningProcess -Unique |
ForEach-Object {
    $process = Get-CimInstance Win32_Process -Filter ("ProcessId=" + $_) -ErrorAction SilentlyContinue
    if ($process) {
        $cmd = [string]$process.CommandLine
        $isNode = $process.Name -eq 'node.exe' -or $process.Name -eq 'node-x86_64-pc-windows-msvc.exe'
        $isServerDist = $cmd -like '*server\dist\index.js*' -or $cmd -like '*server/dist/index.js*'
        $isPackagedBackend = $isServerDist -and $cmd -like ('*' + $root + '*')
        $isTsxDevBackend = $cmd -like '*node_modules*tsx*' -and $cmd -like '*index.ts*'
        $isNodeDevBackend = $isServerDist
        $isDevBackend = $healthVersion -eq 'dev' -and ($isTsxDevBackend -or $isNodeDevBackend)
        if ($isNode -and ($isPackagedBackend -or $isDevBackend)) {
            Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
        }
    }
}"#;

    let _ = Command::new("powershell.exe")
        .arg("-NoProfile")
        .arg("-ExecutionPolicy")
        .arg("Bypass")
        .arg("-Command")
        .arg(script)
        .env("PIAGENT_BACKEND_ROOT", root_text)
        .env("PIAGENT_HEALTH_VERSION", health_version)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();
}

#[cfg(not(target_os = "windows"))]
fn kill_backend_port_owner(_root: &Path, _health_version: &str) {}

fn start_backend(app: &tauri::AppHandle, state: &State<BackendProcess>) -> Result<(), String> {
    let mut guard = state
        .0
        .lock()
        .map_err(|_| "backend lock poisoned".to_string())?;
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
        app.path().resource_dir().map_err(|e| e.to_string())?
    };
    let server_entry = root.join("server").join("dist").join("index.js");
    if !server_entry.exists() {
        return Err(format!("backend entry missing: {}", server_entry.display()));
    }
    let client_index = root.join("client").join("dist").join("index.html");
    if !client_index.exists() {
        return Err(format!("client bundle missing: {}", client_index.display()));
    }
    if let Some(health) = backend_health() {
        if backend_matches_expected(&health) {
            return Ok(());
        }
        if health.get("app").and_then(|value| value.as_str()) == Some("PiAgent") {
            let health_version = health.get("version").and_then(|value| value.as_str()).unwrap_or("");
            kill_backend_port_owner(&root, health_version);
        }
    }
    kill_stale_backend_processes(&root);
    std::thread::sleep(Duration::from_millis(250));
    if let Some(health) = backend_health() {
        if backend_matches_expected(&health) {
            return Ok(());
        }
        return Err(format!(
            "backend port 1456 is occupied by {}, expected PiAgent {}",
            describe_backend_health(&health),
            EXPECTED_BACKEND_VERSION
        ));
    }
    if port_accepts_connection() {
        return Err("backend port 1456 is occupied by a non-PiAgent process".to_string());
    }
    let server_entry_arg = PathBuf::from("server").join("dist").join("index.js");

    let node = node_executable(&root);
    let (stdout, stderr) = backend_log_stdio(app);
    let mut child = Command::new(&node)
        .arg(server_entry_arg)
        .current_dir(&root)
        .env("NODE_ENV", "production")
        .env("PIAGENT_PORT", "1456")
        .env("PIAGENT_VERSION", EXPECTED_BACKEND_VERSION)
        .stdin(Stdio::null())
        .stdout(stdout)
        .stderr(stderr)
        .spawn()
        .map_err(|e| format!("unable to start Node backend with {}: {e}", node.display()))?;

    for _ in 0..50 {
        if let Some(health) = backend_health() {
            if backend_matches_expected(&health) {
                *guard = Some(child);
                return Ok(());
            }
        }
        if let Ok(Some(status)) = child.try_wait() {
            return Err(format!("backend exited before becoming ready: {status}"));
        }
        std::thread::sleep(Duration::from_millis(100));
    }

    let _ = child.kill();
    Err(format!(
        "backend did not become ready on port 1456 with version {}",
        EXPECTED_BACKEND_VERSION
    ))
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
            if let Err(error) = start_backend(&handle, &state) {
                write_launcher_log(&handle, &format!("backend start failed: {error}"));
            }
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
