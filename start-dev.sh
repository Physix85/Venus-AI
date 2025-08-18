#!/bin/bash

# Venus AI Development Startup Script

echo "🚀 Starting Venus AI Development Environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a port is in use
port_in_use() {
    lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null
}

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

if ! command_exists node; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18+ and try again.${NC}"
    exit 1
fi

if ! command_exists npm; then
    echo -e "${RED}❌ npm is not installed. Please install npm and try again.${NC}"
    exit 1
fi

if ! command_exists python3; then
    echo -e "${RED}❌ Python 3 is not installed. Please install Python 3.9+ and try again.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Check if ports are available
echo -e "${BLUE}Checking port availability...${NC}"

PORTS=(5000 5173 8001 8002 27017 6379)
for port in "${PORTS[@]}"; do
    if port_in_use $port; then
        echo -e "${YELLOW}⚠️  Port $port is already in use. Please stop the service using this port.${NC}"
    fi
done

# Create environment files if they don't exist
echo -e "${BLUE}Setting up environment files...${NC}"

if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}Creating backend/.env from example...${NC}"
    cp backend/.env.example backend/.env
fi

if [ ! -f "python-services/ai-service/.env" ]; then
    echo -e "${YELLOW}Creating ai-service/.env from example...${NC}"
    cp python-services/ai-service/.env.example python-services/ai-service/.env
fi

if [ ! -f "python-services/chat-processor/.env" ]; then
    echo -e "${YELLOW}Creating chat-processor/.env from example...${NC}"
    cp python-services/chat-processor/.env.example python-services/chat-processor/.env
fi

# Install dependencies
echo -e "${BLUE}Installing dependencies...${NC}"

echo -e "${YELLOW}Installing frontend dependencies...${NC}"
cd frontend && npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to install frontend dependencies${NC}"
    exit 1
fi

echo -e "${YELLOW}Installing backend dependencies...${NC}"
cd ../backend && npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to install backend dependencies${NC}"
    exit 1
fi

echo -e "${YELLOW}Installing Python dependencies...${NC}"
cd ../python-services
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to install Python dependencies${NC}"
    exit 1
fi

cd ..

echo -e "${GREEN}✅ Dependencies installed successfully${NC}"

# Start services
echo -e "${BLUE}Starting services...${NC}"

# Start MongoDB (if not running)
if ! port_in_use 27017; then
    echo -e "${YELLOW}Starting MongoDB...${NC}"
    if command_exists mongod; then
        mongod --dbpath ./data/db --fork --logpath ./data/mongodb.log
    else
        echo -e "${YELLOW}MongoDB not found locally. Please start MongoDB manually or use Docker.${NC}"
    fi
fi

# Start Redis (if not running)
if ! port_in_use 6379; then
    echo -e "${YELLOW}Starting Redis...${NC}"
    if command_exists redis-server; then
        redis-server --daemonize yes
    else
        echo -e "${YELLOW}Redis not found locally. Please start Redis manually or use Docker.${NC}"
    fi
fi

# Start Python services
echo -e "${YELLOW}Starting AI Service...${NC}"
cd python-services
source venv/bin/activate
cd ai-service
uvicorn main:app --host 0.0.0.0 --port 8001 --reload &
AI_SERVICE_PID=$!

cd ../chat-processor
uvicorn main:app --host 0.0.0.0 --port 8002 --reload &
CHAT_PROCESSOR_PID=$!

cd ../../

# Start backend
echo -e "${YELLOW}Starting Backend...${NC}"
cd backend
npm run dev &
BACKEND_PID=$!

cd ..

# Start frontend
echo -e "${YELLOW}Starting Frontend...${NC}"
cd frontend
npm run dev &
FRONTEND_PID=$!

cd ..

# Wait a moment for services to start
sleep 5

echo -e "${GREEN}🎉 Venus AI Development Environment Started!${NC}"
echo -e "${BLUE}Services running on:${NC}"
echo -e "  Frontend: ${GREEN}http://localhost:5173${NC}"
echo -e "  Backend API: ${GREEN}http://localhost:5000${NC}"
echo -e "  AI Service: ${GREEN}http://localhost:8001${NC}"
echo -e "  Chat Processor: ${GREEN}http://localhost:8002${NC}"
echo -e "  MongoDB: ${GREEN}mongodb://localhost:27017${NC}"
echo -e "  Redis: ${GREEN}redis://localhost:6379${NC}"

echo -e "\n${YELLOW}Press Ctrl+C to stop all services${NC}"

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Stopping services...${NC}"
    kill $FRONTEND_PID $BACKEND_PID $AI_SERVICE_PID $CHAT_PROCESSOR_PID 2>/dev/null
    echo -e "${GREEN}✅ All services stopped${NC}"
    exit 0
}

# Trap Ctrl+C
trap cleanup INT

# Wait for user to stop
wait
