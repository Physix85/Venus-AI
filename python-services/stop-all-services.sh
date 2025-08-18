#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "========================================"
echo "   Venus AI Python Services Stopper"
echo "========================================"
echo

cd "$(dirname "$0")"

# Function to stop service
stop_service() {
    local service_name=$1
    local port=$2
    
    echo -e "${BLUE}🛑 Stopping $service_name...${NC}"
    
    # Check if PID file exists
    if [ -f "logs/${service_name}.pid" ]; then
        local pid=$(cat "logs/${service_name}.pid")
        if ps -p $pid > /dev/null 2>&1; then
            kill $pid
            echo -e "${GREEN}✅ $service_name stopped (PID: $pid)${NC}"
        else
            echo -e "${YELLOW}⚠️  $service_name was not running (PID: $pid)${NC}"
        fi
        rm -f "logs/${service_name}.pid"
    else
        echo -e "${YELLOW}⚠️  No PID file found for $service_name${NC}"
    fi
    
    # Also try to kill by port
    local process_on_port=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$process_on_port" ]; then
        kill $process_on_port 2>/dev/null
        echo -e "${GREEN}✅ Killed process on port $port${NC}"
    fi
}

# Stop services
stop_service "ai-service" "8001"
stop_service "chat-processor" "8002"

echo
echo -e "${GREEN}🎉 All Python services stopped!${NC}"
echo
