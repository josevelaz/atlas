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
            // Two deep-link paths are handled:
            //
            //   atlas://auth/callback        — Better Auth desktop sign-in callback
            //     Forwarded as event "atlas://auth-callback"
            //     The web layer (desktop_auth.ts) listens for this event.
            //
            //   atlas://mailbox-connect/callback — Mailbox OAuth connect callback
            //     Forwarded as event "atlas://mailbox-connect-callback"
            //     The web layer (desktop_mailbox.ts) listens for this event.
            //     Only the `state` parameter is forwarded — the OAuth code
            //     stays server-side and is never exposed to the webview.
            //
            // Security: neither handler logs the incoming URL because it may
            // contain sensitive OAuth parameters.
            let app_handle = app.handle().clone();
            app.listen("deep-link://new-url", move |event| {
                // The payload is a JSON array of URL strings
                // e.g. ["atlas://auth/callback?code=<code>&state=<state>"]
                if let Ok(urls) = serde_json::from_str::<Vec<String>>(event.payload()) {
                    for url in &urls {
                        if url.starts_with("atlas://auth/callback") {
                            // Better Auth sign-in callback — forward to webview.
                            // Never log the URL (contains the one-time code).
                            let _ = app_handle.emit(
                                "atlas://auth-callback",
                                serde_json::json!({ "url": url }),
                            );
                        } else if url.starts_with("atlas://mailbox-connect/callback") {
                            // Mailbox-connect callback — forward only the state
                            // parameter to the webview. The OAuth code stays
                            // server-side and must never be forwarded here.
                            if let Ok(parsed) = url::Url::parse(url) {
                                let state = parsed
                                    .query_pairs()
                                    .find(|(k, _)| k == "state")
                                    .map(|(_, v)| v.into_owned());
                                let error = parsed
                                    .query_pairs()
                                    .find(|(k, _)| k == "error")
                                    .map(|(_, v)| v.into_owned());

                                // Emit only sanitized fields — no raw URL, no code
                                let _ = app_handle.emit(
                                    "atlas://mailbox-connect-callback",
                                    serde_json::json!({
                                        "state": state,
                                        "error": error,
                                    }),
                                );
                            }
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
