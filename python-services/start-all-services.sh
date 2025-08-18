#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "========================================"
echo "   Venus AI Python Services Launcher"
echo "========================================"
echo

cd "$(dirname "$0")"

# Check if Python is installed
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo -e "${RED}❌ Python is not installed or not in PATH${NC}"
    echo "Please install Python 3.8+ and try again"
    exit 1
fi

# Use python3 if available, otherwise python
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
    PIP_CMD="pip3"
else
    PYTHON_CMD="python"
    PIP_CMD="pip"
fi

echo -e "${GREEN}✅ Python found:${NC}"
$PYTHON_CMD --version

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo
    echo -e "${BLUE}📦 Creating virtual environment...${NC}"
    $PYTHON_CMD -m venv venv
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to create virtual environment${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Virtual environment created${NC}"
fi

# Activate virtual environment
echo
echo -e "${BLUE}🔄 Activating virtual environment...${NC}"
source venv/bin/activate
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to activate virtual environment${NC}"
    exit 1
fi

# Upgrade pip
echo
echo -e "${BLUE}📈 Upgrading pip...${NC}"
$PYTHON_CMD -m pip install --upgrade pip --quiet

# Install dependencies
echo
echo -e "${BLUE}📦 Installing dependencies...${NC}"
pip install -r requirements.txt --quiet
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Failed to install all dependencies, trying core dependencies...${NC}"
    pip install fastapi==0.104.1 uvicorn[standard]==0.24.0 httpx==0.25.2 pydantic==2.5.0 pydantic-settings==2.1.0 python-dotenv==1.0.0 structlog==23.2.0 --quiet
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to install core dependencies${NC}"
        exit 1
    fi
fi
echo -e "${GREEN}✅ Dependencies installed${NC}"

# Create environment files
echo
echo -e "${BLUE}📝 Setting up environment files...${NC}"

if [ ! -f "ai-service/.env" ]; then
    cp ai-service/.env.example ai-service/.env
    echo -e "${GREEN}✅ Created ai-service/.env${NC}"
    echo -e "${YELLOW}⚠️  Please add your DeepSeek API key to ai-service/.env${NC}"
else
    echo -e "${GREEN}✅ ai-service/.env already exists${NC}"
fi

if [ ! -f "chat-processor/.env" ]; then
    cp chat-processor/.env.example chat-processor/.env
    echo -e "${GREEN}✅ Created chat-processor/.env${NC}"
else
    echo -e "${GREEN}✅ chat-processor/.env already exists${NC}"
fi

# Check if DeepSeek API key is set
if grep -q "DEEPSEEK_API_KEY=your-deepseek-api-key-here" "ai-service/.env"; then
    echo
    echo -e "${YELLOW}⚠️  WARNING: DeepSeek API key not configured!${NC}"
    echo "Please edit ai-service/.env and add your actual API key"
    echo
    read -p "Continue anyway? (y/n): " continue
    if [[ $continue != "y" && $continue != "Y" ]]; then
        echo "Setup cancelled. Please configure your API key first."
        exit 1
    fi
fi

echo
echo -e "${BLUE}🚀 Starting Python services...${NC}"
echo

# Function to start service in background
start_service() {
    local service_name=$1
    local service_dir=$2
    local port=$3
    
    echo -e "${BLUE}🤖 Starting $service_name (Port $port)...${NC}"
    
    # Start service in background
    cd "$service_dir"
    source ../venv/bin/activate
    nohup python main.py > "../logs/${service_name}.log" 2>&1 &
    echo $! > "../logs/${service_name}.pid"
    cd ..
    
    # Wait a moment for service to start
    sleep 2
}

# Create logs directory
mkdir -p logs

# Start AI Service
start_service "ai-service" "ai-service" "8001"

# Start Chat Processor
start_service "chat-processor" "chat-processor" "8002"

# Wait for services to start
echo
echo -e "${BLUE}⏳ Waiting for services to start...${NC}"
sleep 5

# Check if services are running
echo
echo -e "${BLUE}🔍 Checking service health...${NC}"

# Check AI Service
if curl -s http://localhost:8001/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ AI Service is running on http://localhost:8001${NC}"
    echo -e "   📖 API Docs: http://localhost:8001/docs"
else
    echo -e "${YELLOW}⚠️  AI Service may still be starting...${NC}"
    echo "   Check logs/ai-service.log for any errors"
fi

# Check Chat Processor
if curl -s http://localhost:8002/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Chat Processor is running on http://localhost:8002${NC}"
    echo -e "   📖 API Docs: http://localhost:8002/docs"
else
    echo -e "${YELLOW}⚠️  Chat Processor may still be starting...${NC}"
    echo "   Check logs/chat-processor.log for any errors"
fi

echo
echo "========================================"
echo -e "   ${GREEN}🎉 Python Services Started!${NC}"
echo "========================================"
echo
echo "Services running:"
echo "• AI Service:      http://localhost:8001"
echo "• Chat Processor:  http://localhost:8002"
echo
echo "API Documentation:"
echo "• AI Service:      http://localhost:8001/docs"
echo "• Chat Processor:  http://localhost:8002/docs"
echo
echo "Logs:"
echo "• AI Service:      logs/ai-service.log"
echo "• Chat Processor:  logs/chat-processor.log"
echo
echo "To stop services: run ./stop-all-services.sh"
echo

# Ask to open API documentation
read -p "Open API documentation in browser? (y/n): " openDocs
if [[ $openDocs == "y" || $openDocs == "Y" ]]; then
    if command -v xdg-open &> /dev/null; then
        xdg-open http://localhost:8001/docs
        xdg-open http://localhost:8002/docs
    elif command -v open &> /dev/null; then
        open http://localhost:8001/docs
        open http://localhost:8002/docs
    else
        echo "Please manually open:"
        echo "http://localhost:8001/docs"
        echo "http://localhost:8002/docs"
    fi
fi

echo
echo "Services are running in the background."
echo "Press any key to exit this launcher..."
read -n 1
