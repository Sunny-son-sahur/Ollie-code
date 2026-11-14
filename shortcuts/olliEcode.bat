@echo off
REM olliEcode launcher. Starts the TUI with spoof mode on and auto-compaction off
REM baked into the overlay. Drag this .bat to your Desktop to pin it.
set OLLIECODE_SPOOF_UNLIMITED=1
"%~dp0..\olliecode.exe" %*
