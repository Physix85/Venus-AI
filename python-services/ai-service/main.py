import os
import asyncio
import logging
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager

import httpx
import structlog
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
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
    # API Configuration
    deepseek_api_key: str = Field(..., env="DEEPSEEK_API_KEY")
    deepseek_api_url: str = Field(default="https://api.deepseek.com/v1", env="DEEPSEEK_API_URL")

    # Service Configuration
    service_host: str = Field(default="0.0.0.0", env="SERVICE_HOST")
    service_port: int = Field(default=8001, env="SERVICE_PORT")

    # CORS Configuration
    cors_origins: List[str] = Field(default=["http://localhost:3000", "http://localhost:5173"], env="CORS_ORIGINS")

    # Rate Limiting
    max_requests_per_minute: int = Field(default=60, env="MAX_REQUESTS_PER_MINUTE")
    max_tokens_per_request: int = Field(default=8192, env="MAX_TOKENS_PER_REQUEST")

    # Timeouts
    request_timeout: int = Field(default=120, env="REQUEST_TIMEOUT")

    # Logging
    log_level: str = Field(default="INFO", env="LOG_LEVEL")

    class Config:
        env_file = ".env"

settings = Settings()

# Pydantic models
class Message(BaseModel):
    role: str = Field(..., description="Role of the message sender")
    content: str = Field(..., description="Content of the message")

class ChatRequest(BaseModel):
    messages: List[Message] = Field(..., description="List of messages in the conversation")
    model: str = Field(default="deepseek/deepseek-r1", description="Model to use for generation")
    temperature: float = Field(default=0.7, ge=0.0, le=2.0, description="Sampling temperature")
    max_tokens: int = Field(default=2048, ge=1, le=8192, description="Maximum tokens to generate")
    stream: bool = Field(default=False, description="Whether to stream the response")
    system_prompt: Optional[str] = Field(default=None, description="System prompt to use")

class ChatResponse(BaseModel):
    id: str
    object: str
    created: int
    model: str
    choices: List[Dict[str, Any]]
    usage: Dict[str, Any]  # Changed from Dict[str, int] to handle nested structures
    processing_time: float
    provider: Optional[str] = None  # Optional field for OpenRouter
    system_fingerprint: Optional[str] = None  # Optional field

class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    uptime: float

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
    logger.info("AI Service started", service="ai-service", port=settings.service_port)
    
    yield
    
    # Shutdown
    if http_client:
        await http_client.aclose()
    logger.info("AI Service stopped")

# FastAPI app
app = FastAPI(
    title="Venus AI - AI Service",
    description="DeepSeek R1 API integration service for Venus AI",
    version="1.0.0",
    lifespan=lifespan
)

# Add middleware to log all requests
@app.middleware("http")
async def log_requests(request, call_next):
    print(f"DEBUG: Incoming request: {request.method} {request.url}")
    print(f"DEBUG: Headers: {dict(request.headers)}")

    response = await call_next(request)

    print(f"DEBUG: Response status: {response.status_code}")
    return response

# Routers
from pdf_extract import router as pdf_router  # type: ignore
from doc_extract import router as doc_router  # type: ignore
app.include_router(pdf_router)
app.include_router(doc_router)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"]  # Configure appropriately for production
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
        service="ai-service",
        version="1.0.0",
        uptime=0.0  # TODO: Implement actual uptime tracking
    )

@app.post("/chat/completions", response_model=ChatResponse)
async def create_chat_completion(
    request: ChatRequest,
    background_tasks: BackgroundTasks,
    client: httpx.AsyncClient = Depends(get_http_client)
):
    """Create a chat completion using DeepSeek R1 API"""

    print(f"DEBUG: Received request: {request}")

    try:
        # Prepare messages for DeepSeek API
        messages = []
        
        # Add system prompt if provided
        if request.system_prompt:
            messages.append({
                "role": "system",
                "content": request.system_prompt
            })
        
        # Add conversation messages
        for msg in request.messages:
            messages.append({
                "role": msg.role,
                "content": msg.content
            })
        
        # Prepare request payload
        payload = {
            "model": request.model,
            "messages": messages,
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
            "stream": request.stream
        }
        
        # Headers for DeepSeek API / OpenRouter
        headers = {
            "Authorization": f"Bearer {settings.deepseek_api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:5173",  # Required by OpenRouter
            "X-Title": "Venus AI"  # Optional but recommended
        }
        
        # Make request to DeepSeek API
        start_time = asyncio.get_event_loop().time()
        
        response = await client.post(
            f"{settings.deepseek_api_url}/chat/completions",
            json=payload,
            headers=headers
        )
        
        processing_time = asyncio.get_event_loop().time() - start_time
        
        if response.status_code != 200:
            logger.error(
                "DeepSeek API error",
                status_code=response.status_code,
                response=response.text
            )
            raise HTTPException(
                status_code=response.status_code,
                detail=f"DeepSeek API error: {response.text}"
            )
        
        result = response.json()
        
        # Add processing time to response
        result["processing_time"] = processing_time
        
        # Log successful completion
        logger.info(
            "Chat completion successful",
            model=request.model,
            processing_time=processing_time,
            tokens_used=result.get("usage", {}).get("total_tokens", 0)
        )
        
        return ChatResponse(**result)
        
    except httpx.TimeoutException:
        logger.error("Request timeout to DeepSeek API")
        raise HTTPException(status_code=504, detail="Request timeout")
    
    except httpx.RequestError as e:
        logger.error("Request error to DeepSeek API", error=str(e))
        raise HTTPException(status_code=502, detail="Failed to connect to AI service")
    
    except Exception as e:
        logger.error("Unexpected error in chat completion", error=str(e))
        print(f"DEBUG: Exception details: {e}")
        print(f"DEBUG: Exception type: {type(e)}")
        import traceback
        print(f"DEBUG: Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/models")
async def list_models():
    """List available models"""
    return {
        "data": [
            {
                "id": "deepseek/deepseek-r1",
                "object": "model",
                "created": 1640995200,
                "owned_by": "deepseek"
            },
            {
                "id": "deepseek/deepseek-chat",
                "object": "model",
                "created": 1640995200,
                "owned_by": "deepseek"
            },
            {
                "id": "deepseek/deepseek-coder",
                "object": "model",
                "created": 1640995200,
                "owned_by": "deepseek"
            }
        ]
    }

if __name__ == "__main__":
    print("Starting Venus AI Service...")
    print(f"Service will run on {settings.service_host}:{settings.service_port}")
    print(f"DeepSeek API URL: {settings.deepseek_api_url}")
    print(f"API Key configured: {'Yes' if settings.deepseek_api_key else 'No'}")

    uvicorn.run(
        "main:app",
        host=settings.service_host,
        port=settings.service_port,
        reload=True,
        log_level="debug"
    )
