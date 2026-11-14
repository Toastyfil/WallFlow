@echo off
rem Load the MSVC + Windows SDK environment, then run cargo with the given args.
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" >nul
cargo %*
