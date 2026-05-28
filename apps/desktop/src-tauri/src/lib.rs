use tauri::{Emitter, Listener};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Register the deep-link event listener.
            // When the OS delivers an atlas:// URL to the app, this handler
            // receives it and forwards it to the webview via a Tauri event.
            //
            // The web layer (desktop_auth.ts) listens for "atlas://auth-callback"
            // and extracts the one-time code and state from the URL.
            let app_handle = app.handle().clone();
            app.listen("deep-link://new-url", move |event| {
                // The payload is a JSON array of URL strings
                // e.g. ["atlas://auth/callback?code=<code>&state=<state>"]
                if let Ok(urls) = serde_json::from_str::<Vec<String>>(event.payload()) {
                    for url in urls {
                        if url.starts_with("atlas://auth/callback") {
                            // Forward to the webview — never log the URL (contains the one-time code)
                            let _ = app_handle.emit(
                                "atlas://auth-callback",
                                serde_json::json!({ "url": url }),
                            );
                        }
                    }
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
