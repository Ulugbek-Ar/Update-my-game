// Piksel Qal'a — Windows dasturi (Tauri). O'yin dist/desktop/index.html dan .exe ichiga
// joylanadi va oflayn ishlaydi; saqlanishlar (localStorage) WebView2 ma'lumotlari bilan
// %LOCALAPPDATA%\com.ulugbek.pikselqala\ papkasida turadi — dastur yangilanganda o'chmaydi.
// Shuning uchun tauri.conf.json dagi "identifier" ni HECH QACHON o'zgartirmang.

// Windows'da konsol oynasi ochilmasin
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // WebView2 bo'lmasa (eski Windows 10) — o'zbekcha xabar va portativ HTML versiya taklifi
    #[cfg(windows)]
    if tauri::webview_version().is_err() {
        no_webview::explain();
        return;
    }

    let mut builder = tauri::Builder::default()
        // oyna o'lchami, joyi va to'liq ekran holati eslab qolinadi (AppData)
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init());

    // Tauri updater faqat imzo kaliti bilan yig'ilgan build'da (CI: TAURI_SIGNING_PRIVATE_KEY,
    // docs/windows.md). Kalitsiz build'da o'yin yangi versiya haqida havola ko'rsatadi.
    if option_env!("PIKSELQALA_UPDATER") == Some("1") {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .run(tauri::generate_context!())
        .expect("Piksel Qal'a ishga tushmadi");
}

#[cfg(windows)]
mod no_webview {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use std::ptr::null;
    use windows_sys::Win32::UI::Shell::ShellExecuteW;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        MessageBoxW, IDYES, MB_ICONWARNING, MB_YESNO, SW_SHOWNORMAL,
    };

    const PORTABLE_HTML: &str = "Piksel Qala.html";
    const RELEASES: &str = "https://github.com/Ulugbek-Ar/Update-my-game/releases/latest";

    fn wide(s: &str) -> Vec<u16> {
        OsStr::new(s).encode_wide().chain(Some(0)).collect()
    }

    fn open(target: &str) {
        let op = wide("open");
        let t = wide(target);
        unsafe {
            ShellExecuteW(
                std::ptr::null_mut(),
                op.as_ptr(),
                t.as_ptr(),
                null(),
                null(),
                SW_SHOWNORMAL,
            );
        }
    }

    pub fn explain() {
        // .exe yonidagi portativ HTML (PikselQala-Windows.zip ichida birga keladi)
        let html = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.join(PORTABLE_HTML)))
            .filter(|p| p.exists());

        let offer = if html.is_some() {
            "\"Ha\" ni bossangiz, o'yinning portativ versiyasi (Piksel Qala.html) brauzerda ochiladi — u ham internetsiz ishlaydi."
        } else {
            "\"Ha\" ni bossangiz, yuklab olish sahifasi ochiladi: u yerdagi PikselQala-portable.zip ichidagi \"Piksel Qala.html\" brauzerda internetsiz ishlaydi."
        };
        let text = format!(
            "Bu kompyuterda Microsoft Edge WebView2 topilmadi — Piksel Qal'a dasturi usiz ochilmaydi.\n\n\
             Yechim 1: WebView2 Runtime'ni o'rnating (bepul, admin huquqi shart emas):\n\
             https://go.microsoft.com/fwlink/p/?LinkId=2124703\n\n\
             Yechim 2: {offer}\n\nPortativ versiyani ochaymi?"
        );
        let title = wide("Piksel Qal'a");
        let body = wide(&text);
        let answer = unsafe {
            MessageBoxW(
                std::ptr::null_mut(),
                body.as_ptr(),
                title.as_ptr(),
                MB_YESNO | MB_ICONWARNING,
            )
        };
        if answer == IDYES {
            match html {
                Some(p) => open(&p.to_string_lossy()),
                None => open(RELEASES),
            }
        }
    }
}
