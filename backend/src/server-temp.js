import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// In-memory storage for temporary chat history
let chats = [];
let users = [];
let currentChatId = 1;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());

// Simple auth middleware (temporary)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied', message: 'No token provided' });
  }
  
  // For demo purposes, accept any token and create a default user
  req.user = { id: 'demo-user', username: 'Demo User' };
  next();
};

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Venus AI Backend is running (Temporary Mode)",
    timestamp: new Date().toISOString(),
  });
});

// Get all chats for user
app.get("/api/chat", authenticateToken, (req, res) => {
  const userChats = chats.filter(chat => chat.userId === req.user.id);
  res.json({
    chats: userChats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    pagination: {
      currentPage: 1,
      totalPages: 1,
      totalChats: userChats.length,
      hasNextPage: false,
      hasPrevPage: false,
    },
  });
});

// Get specific chat
app.get("/api/chat/:chatId", authenticateToken, (req, res) => {
  const chat = chats.find(c => c._id === req.params.chatId && c.userId === req.user.id);
  if (!chat) {
    return res.status(404).json({ error: "Chat not found" });
  }
  res.json(chat);
});

// Create new chat
app.post("/api/chat", authenticateToken, (req, res) => {
  const { title } = req.body;
  const newChat = {
    _id: `chat-${currentChatId++}`,
    userId: req.user.id,
    title: title || "New Chat",
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    statistics: {
      messageCount: 0,
      totalTokens: 0,
      lastActivity: new Date(),
    },
    settings: {
      model: "deepseek/deepseek-r1",
      temperature: 0.7,
      maxTokens: 2048,
      systemPrompt: "You are Venus AI, a helpful and intelligent assistant.",
    },
  };
  
  chats.push(newChat);
  res.status(201).json(newChat);
});

// Send message to chat
app.post("/api/chat/:chatId/messages", authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;
    const chatId = req.params.chatId;
    
    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }
    
    let chat = chats.find(c => c._id === chatId && c.userId === req.user.id);
    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }
    
    // Add user message
    const userMessage = {
      role: "user",
      content: message.trim(),
      timestamp: new Date(),
    };
    
    chat.messages.push(userMessage);
    
    // Call AI service
    const aiServiceUrl = process.env.AI_SERVICE_URL || "http://localhost:8001";
    const messagesForAI = chat.messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));
    
    try {
      const response = await fetch(`${aiServiceUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messagesForAI,
          model: chat.settings.model,
          temperature: chat.settings.temperature,
          max_tokens: chat.settings.maxTokens,
        }),
      });
      
      if (response.ok) {
        const aiData = await response.json();
        const aiMessage = {
          role: "assistant",
          content: aiData.choices[0].message.content,
          timestamp: new Date(),
          metadata: {
            model: aiData.model,
            usage: aiData.usage,
          },
        };
        
        chat.messages.push(aiMessage);
        
        // Update chat statistics
        chat.statistics.messageCount = chat.messages.length;
        chat.statistics.totalTokens += aiData.usage?.total_tokens || 0;
        chat.statistics.lastActivity = new Date();
        chat.updatedAt = new Date();
        
        // Update title if first exchange
        if (chat.messages.length === 2 && chat.title === "New Chat") {
          chat.title = message.length > 50 ? message.substring(0, 47) + "..." : message;
        }
        
        res.json({
          userMessage,
          aiMessage,
          chat: {
            id: chat._id,
            title: chat.title,
            messageCount: chat.statistics.messageCount,
            totalTokens: chat.statistics.totalTokens,
          },
        });
      } else {
        throw new Error('AI service error');
      }
    } catch (error) {
      console.error('AI service error:', error);
      res.status(500).json({ error: "Failed to get AI response" });
    }
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// Delete chat
app.delete("/api/chat/:chatId", authenticateToken, (req, res) => {
  const chatIndex = chats.findIndex(c => c._id === req.params.chatId && c.userId === req.user.id);
  if (chatIndex === -1) {
    return res.status(404).json({ error: "Chat not found" });
  }
  
  chats.splice(chatIndex, 1);
  res.json({ message: "Chat deleted successfully" });
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Venus AI Backend running on port ${PORT} (Temporary Mode)`);
  console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:5173"}`);
  console.log(`⚠️  Using in-memory storage - chats will be lost on restart`);
});
