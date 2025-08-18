@echo off
cd /d "%~dp0"
call venv\Scripts\activate.bat
cd chat-processor
python main.py
pause
