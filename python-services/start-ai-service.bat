@echo off
cd /d "%~dp0"
call venv\Scripts\activate.bat
cd ai-service
python main.py
pause
