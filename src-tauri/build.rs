fn main() {
    // PIKSELQALA_UPDATER=1 — updater imzo kaliti bor build (src/main.rs)
    println!("cargo:rerun-if-env-changed=PIKSELQALA_UPDATER");
    tauri_build::build()
}
