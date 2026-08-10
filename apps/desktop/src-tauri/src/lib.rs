// agentgrid desktop shell — wraps the React + xterm UI in a native window
// and keeps the Fastify API (:4318) running via ensure-server.mjs.
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, RunEvent};

struct ServerGuard(Mutex<Option<Child>>);

fn health_ok() -> bool {
    Command::new("curl")
        .args([
            "-fsS",
            "--max-time",
            "1",
            "http://127.0.0.1:4318/api/health",
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

fn resolve_ensure_script(app: &AppHandle) -> Option<PathBuf> {
    if let Ok(resource) = app.path().resource_dir() {
        let bundled = resource.join("ensure-server.mjs");
        if bundled.exists() {
            return Some(bundled);
        }
    }
    let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../scripts/ensure-server.mjs");
    if dev.exists() {
        return Some(dev);
    }
    None
}

fn resolve_repo_root() -> Option<PathBuf> {
    if let Ok(root) = std::env::var("AGENTGRID_ROOT") {
        let p = PathBuf::from(root);
        if p.join("pnpm-workspace.yaml").exists() {
            return Some(p);
        }
    }
    let mut dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    for _ in 0..6 {
        if dir.join("pnpm-workspace.yaml").exists() {
            return Some(dir);
        }
        if !dir.pop() {
            break;
        }
    }
    None
}

fn spawn_ensure_server(app: &AppHandle) -> Option<Child> {
    let script = match resolve_ensure_script(app) {
        Some(s) => s,
        None => {
            eprintln!("[agentgrid] ensure-server.mjs not found");
            return None;
        }
    };
    let mut cmd = Command::new("node");
    cmd.arg(&script).stdout(Stdio::inherit()).stderr(Stdio::inherit());
    if let Some(root) = resolve_repo_root() {
        cmd.env("AGENTGRID_ROOT", root);
    }
    match cmd.spawn() {
        Ok(child) => {
            eprintln!("[agentgrid] ensure-server started ({})", script.display());
            Some(child)
        }
        Err(err) => {
            eprintln!("[agentgrid] failed to start ensure-server: {err}");
            None
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let child = spawn_ensure_server(app.handle());
            app.manage(ServerGuard(Mutex::new(child)));
            if !health_ok() {
                eprintln!(
                    "[agentgrid] waiting for API on :4318 — if this hangs, run: pnpm --filter @agentgrid/server start"
                );
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building agentgrid")
        .run(|app_handle, event| {
            if let RunEvent::Exit = event {
                if let Some(guard) = app_handle.try_state::<ServerGuard>() {
                    if let Ok(mut slot) = guard.0.lock() {
                        if let Some(mut child) = slot.take() {
                            let _ = child.kill();
                            let _ = child.wait();
                        }
                    }
                }
            }
        });
}
