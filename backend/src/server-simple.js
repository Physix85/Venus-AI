import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use(morgan('combined'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Venus AI Backend is running',
    timestamp: new Date().toISOString(),
    services: {
      backend: 'running',
      mongodb: 'not connected',
      ai_service: 'external',
      chat_processor: 'external'
    }
  });
});

// Test API endpoints
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Venus AI Backend API is working!',
    timestamp: new Date().toISOString()
  });
});

// Mock auth endpoints for testing
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  // Mock successful login
  res.json({
    success: true,
    token: 'mock-jwt-token-for-testing',
    user: {
      id: 'mock-user-id',
      username: 'testuser',
      email: email,
      firstName: 'Test',
      lastName: 'User'
    }
  });
});

app.post('/api/auth/register', (req, res) => {
  const { username, email, password } = req.body;
  
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }
  
  // Mock successful registration
  res.status(201).json({
    success: true,
    token: 'mock-jwt-token-for-testing',
    user: {
      id: 'mock-user-id',
      username: username,
      email: email,
      firstName: '',
      lastName: ''
    }
  });
});

// Mock chat endpoints
app.get('/api/chat', (req, res) => {
  res.json([
    {
      id: 'mock-chat-1',
      title: 'Welcome to Venus AI',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messageCount: 2
    }
  ]);
});

app.post('/api/chat', (req, res) => {
  const { title } = req.body;
  
  res.status(201).json({
    id: 'mock-chat-' + Date.now(),
    title: title || 'New Chat',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messageCount: 0,
    messages: []
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  socket.emit('connected', {
    message: 'Connected to Venus AI',
    socketId: socket.id
  });
  
  socket.on('chat_message', (data) => {
    console.log('Received message:', data);
    
    // Echo back a mock AI response
    setTimeout(() => {
      socket.emit('ai_response', {
        chatId: data.chatId,
        message: {
          role: 'assistant',
          content: `This is a mock response to: "${data.message}". The full AI integration will be available once MongoDB is connected.`,
          timestamp: new Date().toISOString()
        }
      });
    }, 1000);
  });
  
  socket.on('disconnect', (reason) => {
    console.log(`User disconnected: ${socket.id} - Reason: ${reason}`);
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: error.message 
  });
});

// Start server
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Venus AI Backend (Simple Mode) running on port ${PORT}`);
  console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:5173"}`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
  console.log(`⚠️  Note: MongoDB not connected - using mock data`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated');
  });
});

export default app;
