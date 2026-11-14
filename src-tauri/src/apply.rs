use std::path::{Path, PathBuf};

use windows::Win32::UI::WindowsAndMessaging::{
    SPI_SETDESKWALLPAPER, SPIF_SENDCHANGE, SPIF_UPDATEINIFILE, SystemParametersInfoW,
};

use crate::store::cache_dir;

fn run(command: &str, args: &[&str]) -> Result<(), String> {
    let status = std::process::Command::new(command)
        .args(args)
        .creation_flags_hidden()
        .status()
        .map_err(|error| error.to_string())?;

    if status.success() {
        Ok(())
    } else {
        Err(format!("{command} exited with {status}"))
    }
}

trait Hidden {
    fn creation_flags_hidden(&mut self) -> &mut Self;
}

impl Hidden for std::process::Command {
    fn creation_flags_hidden(&mut self) -> &mut Self {
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            self.creation_flags(0x0800_0000);
        }
        self
    }
}

/// "Fill" style, exactly like the Electron build set via PowerShell.
fn set_fill_style() {
    let _ = run(
        "reg",
        &[
            "add",
            "HKCU\\Control Panel\\Desktop",
            "/v",
            "WallpaperStyle",
            "/t",
            "REG_SZ",
            "/d",
            "10",
            "/f",
        ],
    );
    let _ = run(
        "reg",
        &[
            "add",
            "HKCU\\Control Panel\\Desktop",
            "/v",
            "TileWallpaper",
            "/t",
            "REG_SZ",
            "/d",
            "0",
            "/f",
        ],
    );
}

pub fn set_wallpaper(path: &Path) -> Result<(), String> {
    set_fill_style();
    let wide: Vec<u16> = path
        .to_string_lossy()
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();

    unsafe {
        SystemParametersInfoW(
            SPI_SETDESKWALLPAPER,
            0,
            Some(wide.as_ptr() as *mut core::ffi::c_void),
            SPIF_UPDATEINIFILE | SPIF_SENDCHANGE,
        )
        .map_err(|error| error.to_string())
    }
}

pub fn download(url: &str) -> Result<PathBuf, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .user_agent("WallFlow/1.1.3 (desktop wallpaper app)")
        .build()
        .map_err(|error| error.to_string())?;

    let response = client.get(url).send().map_err(|error| error.to_string())?;
    if !response.status().is_success() {
        return Err(format!("download failed ({})", response.status()));
    }

    let bytes = response.bytes().map_err(|error| error.to_string())?;
    if bytes.len() < 8_000 {
        return Err("downloaded file is too small".to_string());
    }

    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|value| value.as_millis())
        .unwrap_or(0);
    let path = cache_dir().join(format!("wallpaper-{stamp}.img"));
    std::fs::write(&path, &bytes).map_err(|error| error.to_string())?;
    Ok(path)
}
