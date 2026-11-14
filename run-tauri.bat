@echo off
rem Runs the Tauri CLI with the MSVC toolchain on PATH (needed on this machine).
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" >nul
npx tauri %*
