use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{Manager, State};
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

// --- MCP and JSON-RPC Structures ---

#[derive(Serialize, Debug)]
struct JsonRpcRequest<'a> {
    jsonrpc: &'a str,
    id: u64,
    method: &'a str,
    params: Value,
}

#[derive(Deserialize, Debug)]
#[allow(dead_code)]
struct JsonRpcResponse {
    // id: u64,
    result: Option<Value>,
    error: Option<Value>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Tool {
    pub name: String,
    pub description: String,
    #[serde(rename = "inputSchema")]
    pub input_schema: Option<Value>,
}

#[derive(Deserialize, Debug)]
struct ListToolsResult {
    tools: Vec<Tool>,
}

#[derive(Deserialize, Debug)]
struct InitializeResult {
    // We don't need to inspect the result for now
}

// --- Tauri State ---

struct McpClient {
    process: Child,
    tools: Vec<Tool>,
}

struct AppState {
    mcp_clients: Arc<Mutex<HashMap<String, McpClient>>>,
}

impl AppState {
    fn new() -> Self {
        Self {
            mcp_clients: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

// --- MCP Server Configuration ---

#[derive(Deserialize, Clone)]
struct McpServerConfig {
    command: String,
    args: Vec<String>,
    env: Option<HashMap<String, String>>,
}

#[derive(Deserialize, Clone)]
struct McpServersConfig {
    #[serde(rename = "mcpServers")]
    mcp_servers: HashMap<String, McpServerConfig>,
}

// --- Tauri Commands ---

#[tauri::command]
fn list_tools(state: State<AppState>) -> Vec<Tool> {
    let clients = state.mcp_clients.lock().unwrap();
    clients.values().flat_map(|client| client.tools.clone()).collect()
}

// This is a simplified placeholder. A real implementation needs robust request/response matching.
#[tauri::command]
async fn call_tool(
    server_name: String,
    tool_name: String,
    args: Value,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let mut clients = state.mcp_clients.lock().unwrap();
    if let Some(client) = clients.get_mut(&server_name) {
        let stdin = client.process.stdin.as_mut().unwrap();
        let request = JsonRpcRequest {
            jsonrpc: "2.0",
            id: 2, // Needs proper ID management
            method: "tools/call",
            params: serde_json::json!({
                "name": tool_name,
                "arguments": args
            }),
        };
        let request_payload = serde_json::to_string(&request).unwrap() + "\n";
        stdin.write_all(request_payload.as_bytes()).unwrap();

        // Simplified response reading. A real implementation needs a dedicated reader task.
        let mut reader = BufReader::new(client.process.stdout.as_mut().unwrap());
        let mut line = String::new();
        reader.read_line(&mut line).unwrap();
        let response: JsonRpcResponse = serde_json::from_str(&line).unwrap();
        
        Ok(response.result.unwrap_or_default())

    } else {
        Err(format!("Server '{}' not found", server_name))
    }
}


// --- Setup Logic ---

fn get_config_path(app_handle: &tauri::AppHandle) -> PathBuf {
    app_handle.path().app_config_dir().unwrap().join("mcp_servers.json")
}

async fn setup_mcp_servers(app_handle: &tauri::AppHandle) -> HashMap<String, McpClient> {
    let config_path = get_config_path(app_handle);
    if !config_path.exists() {
        log::info!("MCP config file not found at: {:?}", config_path);
        let resource_path = app_handle
            .path()
            .resolve("mcp_servers.json", tauri::path::BaseDirectory::Resource)
            .unwrap();
        fs::create_dir_all(config_path.parent().unwrap()).unwrap();
        fs::copy(resource_path, &config_path).unwrap();
        log::info!("Copied default MCP config to: {:?}", config_path);
    }

    let config_content = fs::read_to_string(config_path).expect("Failed to read MCP config file");
    let config: McpServersConfig =
        serde_json::from_str(&config_content).expect("Failed to parse MCP config file");

    let mut clients = HashMap::new();

    for (name, server_config) in config.mcp_servers {
        log::info!("Launching MCP server: {}", name);
        let mut command = Command::new(&server_config.command);
        command.args(&server_config.args);
        command.stdin(Stdio::piped());
        command.stdout(Stdio::piped());
        command.stderr(Stdio::piped());

        if let Some(env_vars) = &server_config.env {
            command.envs(env_vars);
        }

        if let Ok(mut child) = command.spawn() {
            log::info!("Successfully launched MCP server '{}'", name);

            let mut stdin = child.stdin.take().unwrap();
            let mut reader = BufReader::new(child.stdout.take().unwrap());

            // 1. Initialize
            let init_request = JsonRpcRequest {
                jsonrpc: "2.0",
                id: 0,
                method: "initialize",
                params: serde_json::json!({ "protocolVersion": "2025-06-18", "capabilities": {} }),
            };
            let payload = serde_json::to_string(&init_request).unwrap() + "\n";
            stdin.write_all(payload.as_bytes()).unwrap();

            let mut line = String::new();
            reader.read_line(&mut line).unwrap();
            let _init_response: JsonRpcResponse = serde_json::from_str(&line).unwrap();
            log::info!("Server '{}' initialized", name);

            // 2. List Tools
            let list_tools_request = JsonRpcRequest {
                jsonrpc: "2.0",
                id: 1,
                method: "tools/list",
                params: serde_json::json!({}),
            };
            let payload = serde_json::to_string(&list_tools_request).unwrap() + "\n";
            stdin.write_all(payload.as_bytes()).unwrap();

            line.clear();
            reader.read_line(&mut line).unwrap();
            let list_tools_response: JsonRpcResponse = serde_json::from_str(&line).unwrap();
            let list_tools_result: ListToolsResult =
                serde_json::from_value(list_tools_response.result.unwrap()).unwrap();
            
            log::info!("Found {} tools for server '{}'", list_tools_result.tools.len(), name);

            child.stdin = Some(stdin);
            child.stdout = Some(reader.into_inner());

            clients.insert(
                name,
                McpClient {
                    process: child,
                    tools: list_tools_result.tools,
                },
            );
        } else {
            log::error!("Failed to launch MCP server '{}'", name);
        }
    }
    clients
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let rt = tokio::runtime::Runtime::new().unwrap();
    let _enter = rt.enter();

    tauri::Builder::default()
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![list_tools, call_tool])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            #[cfg(target_os = "macos")]
            apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, None)
                .expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");

            let window_ = window.clone();
            app.handle()
                .plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_shortcuts(["CmdOrCtrl+`"])
                        .unwrap()
                        .with_handler(move |_app, _shortcut, event| {
                            if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                                if window_.is_visible().unwrap() {
                                    window_.hide().unwrap();
                                } else {
                                    window_.show().unwrap();
                                    window_.set_focus().unwrap();
                                }
                            }
                        })
                        .build(),
                )
                .unwrap();
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            let app_handle_clone = app.handle().clone();
            let app_state: State<AppState> = app.state();
            let clients_arc = app_state.mcp_clients.clone();

            // Run server setup in a separate thread
            std::thread::spawn(move || {
                let rt = tokio::runtime::Runtime::new().unwrap();
                rt.block_on(async {
                    let clients = setup_mcp_servers(&app_handle_clone).await;
                    *clients_arc.lock().unwrap() = clients;
                });
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
