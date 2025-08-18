import jwt from "jsonwebtoken";
import axios from "axios";
import Chat from "../models/Chat.js";
import User from "../models/User.js";

// Store active connections
const activeConnections = new Map();

// Authenticate socket connection
const authenticateSocket = async (socket, next) => {
  try {
    const token =
      socket.handshake.auth.token ||
      socket.handshake.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return next(new Error("Authentication token required"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return next(new Error("User not found"));
    }

    socket.user = user;
    next();
  } catch (error) {
    next(new Error("Invalid authentication token"));
  }
};

// Handle socket connection
export const handleSocketConnection = (socket, io) => {
  console.log(`User connected: ${socket.id}`);

  // Check if user is authenticated
  if (!socket.user) {
    console.log("Unauthenticated socket connection");
    socket.emit("error", { message: "Authentication required" });
    socket.disconnect();
    return;
  }

  console.log(
    `Authenticated user connected: ${socket.user.username} (${socket.id})`
  );

  // Store connection
  activeConnections.set(socket.user.id.toString(), {
    socketId: socket.id,
    user: socket.user,
    connectedAt: new Date(),
  });

  // Join user to their personal room
  socket.join(`user_${socket.user.id}`);

  // Send connection confirmation
  socket.emit("connected", {
    message: "Connected to Venus AI",
    user: {
      id: socket.user.id,
      username: socket.user.username,
      email: socket.user.email,
    },
  });

  // Handle chat message
  socket.on("chat_message", async (data) => {
    try {
      console.log("Received chat message:", {
        chatId: data?.chatId,
        message: data?.message?.substring(0, 50),
        userId: socket.user?.id,
        userEmail: socket.user?.email,
        attachments: data?.attachments?.length || 0,
        fullData: data,
      });
      const { chatId, message, attachments = [] } = data;

      if ((!message || !message.trim()) && attachments.length === 0) {
        console.log("Empty message received");
        socket.emit("error", {
          message: "Message or attachments are required",
        });
        return;
      }

      // Find or create the chat
      let chat;

      if (chatId === "default") {
        console.log("Creating new chat for user:", socket.user.id);
        // For "default" chatId, always create a new chat
        chat = new Chat({
          userId: socket.user.id,
          title: "New Chat",
          settings: {
            model: "deepseek/deepseek-r1",
            temperature: 0.7,
            maxTokens: 2048,
            systemPrompt:
              "You are Venus AI, a helpful and intelligent assistant.",
          },
          messages: [],
          statistics: {
            messageCount: 0,
            totalTokens: 0,
            lastActivity: new Date(),
          },
        });
        await chat.save();
        console.log("Created new chat with ID:", chat._id);
      } else {
        // For specific chatId, try to find the exact chat
        try {
          chat = await Chat.findOne({
            _id: chatId,
            userId: socket.user.id,
          });
        } catch (error) {
          socket.emit("error", { message: "Invalid chat ID" });
          return;
        }

        if (!chat) {
          socket.emit("error", { message: "Chat not found" });
          return;
        }
      }

      // Build content including attachment excerpts
      const attachmentNotes = (attachments || [])
        .map((a) =>
          a.textExcerpt
            ? `\n[Attachment: ${a.filename}]\n${a.textExcerpt}`
            : `\n[Attachment: ${a.filename}]`
        )
        .join("\n");
      const fullContent = `${(message || "").trim()}${attachmentNotes}`.trim();

      // Add user message to chat
      const userMessage = {
        role: "user",
        content: fullContent || "(no text, attachments only)",
        attachments,
        timestamp: new Date(),
      };

      chat.messages.push(userMessage);

      // Emit user message immediately
      socket.emit("message_received", {
        chatId,
        message: userMessage,
      });

      // Emit typing indicator
      socket.emit("ai_typing", { chatId, typing: true });

      // Prepare messages for AI service
      const messagesForAI = chat.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // Add system prompt if it's the first message
      if (chat.messages.length === 1) {
        messagesForAI.unshift({
          role: "system",
          content: chat.settings.systemPrompt,
        });
      }

      try {
        // Call AI service
        const aiServiceUrl =
          process.env.AI_SERVICE_URL || "http://localhost:8001";

        console.log("Calling AI service:", {
          url: `${aiServiceUrl}/chat/completions`,
          model: chat.settings.model,
          messageCount: messagesForAI.length,
          userId: socket.user.id,
        });

        const aiResponse = await axios.post(
          `${aiServiceUrl}/chat/completions`,
          {
            messages: messagesForAI,
            model: chat.settings.model,
            temperature: chat.settings.temperature,
            max_tokens: chat.settings.maxTokens,
          },
          {
            timeout: 120000, // 2 minutes timeout
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        console.log("AI service response received:", {
          status: aiResponse.status,
          model: aiResponse.data?.model,
          usage: aiResponse.data?.usage,
          contentLength:
            aiResponse.data?.choices?.[0]?.message?.content?.length,
        });

        // Stop typing indicator
        socket.emit("ai_typing", { chatId, typing: false });

        // Add AI response to chat
        const aiMessage = {
          role: "assistant",
          content: aiResponse.data.choices[0].message.content,
          timestamp: new Date(),
          metadata: {
            model: aiResponse.data.model,
            usage: aiResponse.data.usage,
          },
        };

        chat.messages.push(aiMessage);

        // Update chat statistics
        chat.statistics.messageCount = chat.messages.length;
        chat.statistics.totalTokens += aiResponse.data.usage?.total_tokens || 0;
        chat.statistics.lastActivity = new Date();

        // Update chat title if it's the first exchange
        if (chat.messages.length === 2 && chat.title === "New Chat") {
          const firstMessage = message.trim();
          chat.title =
            firstMessage.length > 50
              ? firstMessage.substring(0, 47) + "..."
              : firstMessage;
        }

        await chat.save();

        console.log("Chat saved successfully:", {
          chatId: chat._id,
          title: chat.title,
          messageCount: chat.messages.length,
          userId: socket.user.id,
        });

        console.log("Emitting AI response to client:", {
          chatId,
          messageLength: aiMessage.content.length,
          socketId: socket.id,
          userId: socket.user.id,
        });

        // Emit AI response
        socket.emit("ai_response", {
          chatId: chat._id, // Use the actual chat ID, not the original "default"
          message: aiMessage,
          chat: {
            id: chat._id,
            title: chat.title,
            messageCount: chat.statistics.messageCount,
            totalTokens: chat.statistics.totalTokens,
          },
        });
      } catch (aiError) {
        console.error("AI Service Error:", aiError.message);

        // Stop typing indicator
        socket.emit("ai_typing", { chatId, typing: false });

        // Add error message to chat
        const errorMessage = {
          role: "assistant",
          content:
            "I apologize, but I'm currently unable to process your request. Please try again later.",
          timestamp: new Date(),
          metadata: {
            error: true,
            errorType: "ai_service_error",
          },
        };

        chat.messages.push(errorMessage);
        chat.statistics.messageCount = chat.messages.length;
        chat.statistics.lastActivity = new Date();

        await chat.save();

        socket.emit("ai_response", {
          chatId: chat._id, // Use the actual chat ID, not the original "default"
          message: errorMessage,
          chat: {
            id: chat._id,
            title: chat.title,
            messageCount: chat.statistics.messageCount,
            totalTokens: chat.statistics.totalTokens,
          },
          error: "AI service temporarily unavailable",
        });
      }
    } catch (error) {
      console.error("Socket chat message error:", error);
      console.error("Error stack:", error.stack);
      socket.emit("error", {
        message: "Failed to process message",
        details: error.message,
      });
    }
  });

  // Handle typing indicator
  socket.on("typing", (data) => {
    const { chatId, typing } = data;
    socket.to(`chat_${chatId}`).emit("user_typing", {
      userId: socket.user.id,
      username: socket.user.username,
      typing,
    });
  });

  // Handle join chat room
  socket.on("join_chat", (data) => {
    const { chatId } = data;
    socket.join(`chat_${chatId}`);
    console.log(`User ${socket.user.username} joined chat ${chatId}`);
  });

  // Handle leave chat room
  socket.on("leave_chat", (data) => {
    const { chatId } = data;
    socket.leave(`chat_${chatId}`);
    console.log(`User ${socket.user.username} left chat ${chatId}`);
  });

  // Handle ping for connection health
  socket.on("ping", () => {
    socket.emit("pong", { timestamp: new Date().toISOString() });
  });

  // Handle disconnect
  socket.on("disconnect", (reason) => {
    if (socket.user) {
      console.log(
        `User disconnected: ${socket.user.username} (${socket.id}) - Reason: ${reason}`
      );

      // Remove from active connections
      activeConnections.delete(socket.user.id.toString());
    } else {
      console.log(
        `Unauthenticated socket disconnected: ${socket.id} - Reason: ${reason}`
      );
    }

    // Leave all rooms
    socket.rooms.forEach((room) => {
      if (room !== socket.id) {
        socket.leave(room);
      }
    });
  });

  // Handle connection errors
  socket.on("error", (error) => {
    if (socket.user) {
      console.error(`Socket error for user ${socket.user.username}:`, error);
    } else {
      console.error(
        `Socket error for unauthenticated connection ${socket.id}:`,
        error
      );
    }
  });
};

// Middleware to authenticate socket connections
export const socketAuthMiddleware = (socket, next) => {
  authenticateSocket(socket, next);
};

// Get active connections count
export const getActiveConnectionsCount = () => {
  return activeConnections.size;
};

// Get active connections for a specific user
export const getUserConnection = (userId) => {
  return activeConnections.get(userId.toString());
};

// Broadcast message to all connected users
export const broadcastToAll = (io, event, data) => {
  io.emit(event, data);
};

// Broadcast message to specific user
export const broadcastToUser = (io, userId, event, data) => {
  io.to(`user_${userId}`).emit(event, data);
};

// Broadcast message to chat participants
export const broadcastToChat = (io, chatId, event, data) => {
  io.to(`chat_${chatId}`).emit(event, data);
};

export default {
  handleSocketConnection,
  socketAuthMiddleware,
  getActiveConnectionsCount,
  getUserConnection,
  broadcastToAll,
  broadcastToUser,
  broadcastToChat,
};
