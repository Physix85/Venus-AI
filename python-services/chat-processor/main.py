import os
import asyncio
import logging
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager
from datetime import datetime

import httpx
import structlog
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings
import uvicorn

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

class Settings(BaseSettings):
    # Service Configuration
    service_host: str = Field(default="0.0.0.0", env="SERVICE_HOST")
    service_port: int = Field(default=8002, env="SERVICE_PORT")

    # AI Service Configuration
    ai_service_url: str = Field(default="http://localhost:8001", env="AI_SERVICE_URL")

    # Backend Service Configuration
    backend_service_url: str = Field(default="http://localhost:5000", env="BACKEND_SERVICE_URL")

    # CORS Configuration
    cors_origins: List[str] = Field(default=["http://localhost:3000", "http://localhost:5173"], env="CORS_ORIGINS")

    # Processing Configuration
    max_concurrent_requests: int = Field(default=10, env="MAX_CONCURRENT_REQUESTS")
    request_timeout: int = Field(default=120, env="REQUEST_TIMEOUT")

    # Logging
    log_level: str = Field(default="INFO", env="LOG_LEVEL")

    class Config:
        env_file = ".env"

settings = Settings()

# Pydantic models
class Message(BaseModel):
    role: str
    content: str
    timestamp: Optional[datetime] = None

class ProcessChatRequest(BaseModel):
    chat_id: str = Field(..., description="Chat ID")
    user_id: str = Field(..., description="User ID")
    message: str = Field(..., description="User message")
    chat_settings: Dict[str, Any] = Field(default_factory=dict, description="Chat settings")
    context_messages: List[Message] = Field(default_factory=list, description="Previous messages for context")

class ProcessChatResponse(BaseModel):
    chat_id: str
    message_id: str
    ai_response: str
    processing_time: float
    tokens_used: int
    model_used: str

class HealthResponse(BaseModel):
    status: str
    service: str
    version: str

# Global HTTP client
http_client: Optional[httpx.AsyncClient] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global http_client
    http_client = httpx.AsyncClient(
        timeout=httpx.Timeout(settings.request_timeout),
        limits=httpx.Limits(max_keepalive_connections=20, max_connections=100)
    )
    logger.info("Chat Processor Service started", service="chat-processor", port=settings.service_port)
    
    yield
    
    # Shutdown
    if http_client:
        await http_client.aclose()
    logger.info("Chat Processor Service stopped")

# FastAPI app
app = FastAPI(
    title="Venus AI - Chat Processor",
    description="Chat processing and AI integration service for Venus AI",
    version="1.0.0",
    lifespan=lifespan
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency to get HTTP client
async def get_http_client() -> httpx.AsyncClient:
    if http_client is None:
        raise HTTPException(status_code=503, detail="Service unavailable")
    return http_client

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        service="chat-processor",
        version="1.0.0"
    )

@app.post("/process-chat", response_model=ProcessChatResponse)
async def process_chat_message(
    request: ProcessChatRequest,
    background_tasks: BackgroundTasks,
    client: httpx.AsyncClient = Depends(get_http_client)
):
    """Process a chat message and generate AI response"""
    
    try:
        start_time = asyncio.get_event_loop().time()
        
        # Prepare messages for AI service
        messages = []
        
        # Add context messages (previous conversation)
        for msg in request.context_messages[-10:]:  # Limit to last 10 messages
            messages.append({
                "role": msg.role,
                "content": msg.content
            })
        
        # Add current user message
        messages.append({
            "role": "user",
            "content": request.message
        })
        
        # Get chat settings with defaults
        chat_settings = request.chat_settings
        model = chat_settings.get("model", "deepseek/deepseek-r1")
        temperature = chat_settings.get("temperature", 0.7)
        max_tokens = chat_settings.get("maxTokens", 2048)
        system_prompt = chat_settings.get("systemPrompt", "You are Venus AI, a helpful and intelligent assistant.")
        
        # Prepare AI service request
        ai_request = {
            "messages": messages,
            "model": model,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "system_prompt": system_prompt,
            "stream": False
        }
        
        # Call AI service
        logger.info("Calling AI service", chat_id=request.chat_id, model=model)
        
        ai_response = await client.post(
            f"{settings.ai_service_url}/chat/completions",
            json=ai_request
        )
        
        if ai_response.status_code != 200:
            logger.error(
                "AI service error",
                status_code=ai_response.status_code,
                response=ai_response.text
            )
            raise HTTPException(
                status_code=ai_response.status_code,
                detail=f"AI service error: {ai_response.text}"
            )
        
        ai_result = ai_response.json()
        
        # Extract AI response
        ai_message = ai_result["choices"][0]["message"]["content"]
        tokens_used = ai_result["usage"]["total_tokens"]
        
        processing_time = asyncio.get_event_loop().time() - start_time
        
        # Generate message ID (in real implementation, this would come from the database)
        message_id = f"msg_{int(datetime.now().timestamp() * 1000)}"
        
        # Log successful processing
        logger.info(
            "Chat message processed successfully",
            chat_id=request.chat_id,
            user_id=request.user_id,
            processing_time=processing_time,
            tokens_used=tokens_used,
            model=model
        )
        
        # Schedule background task to save to database
        background_tasks.add_task(
            save_chat_message,
            request.chat_id,
            request.user_id,
            request.message,
            ai_message,
            tokens_used,
            model,
            processing_time
        )
        
        return ProcessChatResponse(
            chat_id=request.chat_id,
            message_id=message_id,
            ai_response=ai_message,
            processing_time=processing_time,
            tokens_used=tokens_used,
            model_used=model
        )
        
    except httpx.TimeoutException:
        logger.error("Request timeout", chat_id=request.chat_id)
        raise HTTPException(status_code=504, detail="Request timeout")
    
    except httpx.RequestError as e:
        logger.error("Request error", error=str(e), chat_id=request.chat_id)
        raise HTTPException(status_code=502, detail="Failed to process chat message")
    
    except Exception as e:
        logger.error("Unexpected error in chat processing", error=str(e), chat_id=request.chat_id)
        raise HTTPException(status_code=500, detail="Internal server error")

async def save_chat_message(
    chat_id: str,
    user_id: str,
    user_message: str,
    ai_response: str,
    tokens_used: int,
    model: str,
    processing_time: float
):
    """Background task to save chat message to database via backend API"""
    try:
        # This would call the backend API to save the messages
        # For now, just log the action
        logger.info(
            "Saving chat message to database",
            chat_id=chat_id,
            user_id=user_id,
            tokens_used=tokens_used,
            model=model
        )
        
        # In a real implementation, you would make an API call to the backend:
        # await http_client.post(
        #     f"{settings.backend_service_url}/api/chat/{chat_id}/messages",
        #     json={
        #         "user_message": user_message,
        #         "ai_response": ai_response,
        #         "tokens_used": tokens_used,
        #         "model": model,
        #         "processing_time": processing_time
        #     }
        # )
        
    except Exception as e:
        logger.error("Failed to save chat message", error=str(e), chat_id=chat_id)

@app.post("/analyze-sentiment")
async def analyze_sentiment(
    text: str,
    client: httpx.AsyncClient = Depends(get_http_client)
):
    """Analyze sentiment of text (example additional feature)"""
    try:
        # Simple sentiment analysis using AI service
        messages = [
            {
                "role": "system",
                "content": "Analyze the sentiment of the following text and respond with only: positive, negative, or neutral."
            },
            {
                "role": "user",
                "content": text
            }
        ]
        
        ai_request = {
            "messages": messages,
            "model": "deepseek/deepseek-chat",
            "temperature": 0.1,
            "max_tokens": 10
        }
        
        response = await client.post(
            f"{settings.ai_service_url}/chat/completions",
            json=ai_request
        )
        
        if response.status_code == 200:
            result = response.json()
            sentiment = result["choices"][0]["message"]["content"].strip().lower()
            return {"sentiment": sentiment}
        else:
            return {"sentiment": "neutral"}
            
    except Exception as e:
        logger.error("Sentiment analysis error", error=str(e))
        return {"sentiment": "neutral"}

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.service_host,
        port=settings.service_port,
        reload=True,
        log_config=None
    )
