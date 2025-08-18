@echo off
setlocal enabledelayedexpansion

echo ========================================
echo    Venus AI Python Services Launcher
echo ========================================
echo.

cd /d "%~dp0"

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python is not installed or not in PATH
    echo Please install Python 3.8+ and try again
    pause
    exit /b 1
)

echo ✅ Python found: 
python --version

REM Create virtual environment if it doesn't exist
if not exist "venv" (
    echo.
    echo 📦 Creating virtual environment...
    python -m venv venv
    if %errorlevel% neq 0 (
        echo ❌ Failed to create virtual environment
        pause
        exit /b 1
    )
    echo ✅ Virtual environment created
)

REM Activate virtual environment
echo.
echo 🔄 Activating virtual environment...
call venv\Scripts\activate.bat
if %errorlevel% neq 0 (
    echo ❌ Failed to activate virtual environment
    pause
    exit /b 1
)

REM Upgrade pip
echo.
echo 📈 Upgrading pip...
python -m pip install --upgrade pip --quiet

REM Install dependencies
echo.
echo 📦 Installing dependencies...
pip install -r requirements.txt --quiet
if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    echo Trying to install core dependencies manually...
    pip install fastapi==0.104.1 uvicorn[standard]==0.24.0 httpx==0.25.2 pydantic==2.5.0 pydantic-settings==2.1.0 python-dotenv==1.0.0 structlog==23.2.0 --quiet
    if %errorlevel% neq 0 (
        echo ❌ Failed to install core dependencies
        pause
        exit /b 1
    )
)
echo ✅ Dependencies installed

REM Create environment files
echo.
echo 📝 Setting up environment files...

if not exist "ai-service\.env" (
    copy "ai-service\.env.example" "ai-service\.env" >nul
    echo ✅ Created ai-service\.env
    echo ⚠️  Please add your DeepSeek API key to ai-service\.env
) else (
    echo ✅ ai-service\.env already exists
)

if not exist "chat-processor\.env" (
    copy "chat-processor\.env.example" "chat-processor\.env" >nul
    echo ✅ Created chat-processor\.env
) else (
    echo ✅ chat-processor\.env already exists
)

REM Check if DeepSeek API key is set
findstr /C:"DEEPSEEK_API_KEY=your-deepseek-api-key-here" "ai-service\.env" >nul
if %errorlevel% equ 0 (
    echo.
    echo ⚠️  WARNING: DeepSeek API key not configured!
    echo Please edit ai-service\.env and add your actual API key
    echo.
    set /p continue="Continue anyway? (y/n): "
    if /i "!continue!" neq "y" (
        echo Setup cancelled. Please configure your API key first.
        pause
        exit /b 1
    )
)

echo.
echo 🚀 Starting Python services...
echo.

REM Start AI Service in new window
echo 🤖 Starting AI Service (Port 8001)...
start "Venus AI - AI Service" cmd /k "cd /d "%~dp0ai-service" && call ..\venv\Scripts\activate.bat && python main.py"

REM Wait a moment for AI service to start
timeout /t 3 /nobreak >nul

REM Start Chat Processor in new window
echo 💬 Starting Chat Processor (Port 8002)...
start "Venus AI - Chat Processor" cmd /k "cd /d "%~dp0chat-processor" && call ..\venv\Scripts\activate.bat && python main.py"

REM Wait for services to start
echo.
echo ⏳ Waiting for services to start...
timeout /t 5 /nobreak >nul

REM Check if services are running
echo.
echo 🔍 Checking service health...

REM Check AI Service
curl -s http://localhost:8001/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ AI Service is running on http://localhost:8001
    echo    📖 API Docs: http://localhost:8001/docs
) else (
    echo ⚠️  AI Service may still be starting...
    echo    Check the AI Service window for any errors
)

REM Check Chat Processor
curl -s http://localhost:8002/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Chat Processor is running on http://localhost:8002
    echo    📖 API Docs: http://localhost:8002/docs
) else (
    echo ⚠️  Chat Processor may still be starting...
    echo    Check the Chat Processor window for any errors
)

echo.
echo ========================================
echo    🎉 Python Services Started!
echo ========================================
echo.
echo Services running:
echo • AI Service:      http://localhost:8001
echo • Chat Processor:  http://localhost:8002
echo.
echo API Documentation:
echo • AI Service:      http://localhost:8001/docs
echo • Chat Processor:  http://localhost:8002/docs
echo.
echo To stop services: Close the service windows or press Ctrl+C
echo.

REM Open API documentation in browser
set /p openDocs="Open API documentation in browser? (y/n): "
if /i "%openDocs%" equ "y" (
    start http://localhost:8001/docs
    start http://localhost:8002/docs
)

echo.
echo Press any key to exit this launcher...
pause >nul
