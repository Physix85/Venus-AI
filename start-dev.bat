@echo off
echo 🚀 Starting Venus AI Development Environment...

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js 18+ and try again.
    pause
    exit /b 1
)

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python is not installed. Please install Python 3.9+ and try again.
    pause
    exit /b 1
)

echo ✅ Prerequisites check passed

REM Create environment files if they don't exist
echo Setting up environment files...

if not exist "backend\.env" (
    echo Creating backend\.env from example...
    copy "backend\.env.example" "backend\.env"
)

if not exist "python-services\ai-service\.env" (
    echo Creating ai-service\.env from example...
    copy "python-services\ai-service\.env.example" "python-services\ai-service\.env"
)

if not exist "python-services\chat-processor\.env" (
    echo Creating chat-processor\.env from example...
    copy "python-services\chat-processor\.env.example" "python-services\chat-processor\.env"
)

REM Install dependencies
echo Installing dependencies...

echo Installing frontend dependencies...
cd frontend
call npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install frontend dependencies
    pause
    exit /b 1
)

echo Installing backend dependencies...
cd ..\backend
call npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install backend dependencies
    pause
    exit /b 1
)

echo Installing Python dependencies...
cd ..\python-services
if not exist "venv" (
    python -m venv venv
)
call venv\Scripts\activate.bat
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ❌ Failed to install Python dependencies
    pause
    exit /b 1
)

cd ..

echo ✅ Dependencies installed successfully

REM Start services
echo Starting services...

REM Start Python services
echo Starting AI Service...
cd python-services
call venv\Scripts\activate.bat
cd ai-service
start "AI Service" cmd /k "uvicorn main:app --host 0.0.0.0 --port 8001 --reload"

cd ..\chat-processor
start "Chat Processor" cmd /k "uvicorn main:app --host 0.0.0.0 --port 8002 --reload"

cd ..\..

REM Start backend
echo Starting Backend...
cd backend
start "Backend" cmd /k "npm run dev"

cd ..

REM Start frontend
echo Starting Frontend...
cd frontend
start "Frontend" cmd /k "npm run dev"

cd ..

echo 🎉 Venus AI Development Environment Started!
echo Services running on:
echo   Frontend: http://localhost:5173
echo   Backend API: http://localhost:5000
echo   AI Service: http://localhost:8001
echo   Chat Processor: http://localhost:8002

echo.
echo Press any key to open the application in your browser...
pause >nul

start http://localhost:5173

echo.
echo All services are running in separate windows.
echo Close the individual service windows to stop them.
pause
