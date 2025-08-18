import express from "express";
import axios from "axios";
import Chat from "../models/Chat.js";
import User from "../models/User.js";

const router = express.Router();

// Get all chats for a user with pagination and search
router.get("/", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      sortBy = "updatedAt",
      sortOrder = "desc",
      isPinned,
      tags,
    } = req.query;

    // Convert sortOrder to number
    const sortOrderNum = sortOrder === "asc" ? 1 : -1;

    // Parse tags if provided
    const tagsArray = tags ? (Array.isArray(tags) ? tags : [tags]) : [];

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      sortBy,
      sortOrder: sortOrderNum,
      tags: tagsArray,
      isPinned: isPinned !== undefined ? isPinned === "true" : undefined,
    };

    const chats = await Chat.findUserChats(req.user.id, options);

    // Get total count for pagination
    const totalQuery = { userId: req.user.id, isActive: true };
    if (search) {
      totalQuery.$or = [
        { title: { $regex: search, $options: "i" } },
        { "messages.content": { $regex: search, $options: "i" } },
      ];
    }
    if (tagsArray.length > 0) {
      totalQuery.tags = { $in: tagsArray };
    }
    if (typeof options.isPinned === "boolean") {
      totalQuery.isPinned = options.isPinned;
    }

    const total = await Chat.countDocuments(totalQuery);
    const totalPages = Math.ceil(total / options.limit);

    res.json({
      chats,
      pagination: {
        currentPage: options.page,
        totalPages,
        totalChats: total,
        hasNextPage: options.page < totalPages,
        hasPrevPage: options.page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching chats:", error);
    res.status(500).json({ error: "Failed to fetch chats" });
  }
});

// Get recent chats (for sidebar)
router.get("/recent", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const recentChats = await Chat.find({
      userId: req.user.id,
      isActive: true,
    })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .select("title updatedAt statistics.messageCount statistics.lastActivity")
      .lean();

    res.json(recentChats);
  } catch (error) {
    console.error("Error fetching recent chats:", error);
    res.status(500).json({ error: "Failed to fetch recent chats" });
  }
});

// Pin/unpin a chat
router.put("/:chatId/pin", async (req, res) => {
  try {
    const { isPinned } = req.body;

    const chat = await Chat.findOne({
      _id: req.params.chatId,
      userId: req.user.id,
    });

    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    chat.isPinned = isPinned;
    await chat.save();

    res.json({
      message: isPinned
        ? "Chat pinned successfully"
        : "Chat unpinned successfully",
      isPinned: chat.isPinned,
    });
  } catch (error) {
    console.error("Error updating chat pin status:", error);
    res.status(500).json({ error: "Failed to update chat pin status" });
  }
});

// Get a specific chat with messages
router.get("/:chatId", async (req, res) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.chatId,
      userId: req.user.id,
    });

    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    res.json(chat);
  } catch (error) {
    console.error("Error fetching chat:", error);
    res.status(500).json({ error: "Failed to fetch chat" });
  }
});

// Create a new chat
router.post("/", async (req, res) => {
  try {
    const { title, settings } = req.body;

    const chat = new Chat({
      userId: req.user.id,
      title: title || "New Chat",
      settings: {
        model: settings?.model || "deepseek/deepseek-r1",
        temperature: settings?.temperature || 0.7,
        maxTokens: settings?.maxTokens || 2048,
        systemPrompt:
          settings?.systemPrompt ||
          "You are Venus AI, a helpful and intelligent assistant.",
      },
    });

    await chat.save();
    res.status(201).json(chat);
  } catch (error) {
    console.error("Error creating chat:", error);
    res.status(500).json({ error: "Failed to create chat" });
  }
});

// Send a message to a chat
router.post("/:chatId/messages", async (req, res) => {
  try {
    const { message, attachments = [] } = req.body;
    const chatId = req.params.chatId;

    if (!message && (!attachments || attachments.length === 0)) {
      return res
        .status(400)
        .json({ error: "Message or attachments are required" });
    }

    // Find the chat
    const chat = await Chat.findOne({
      _id: chatId,
      userId: req.user.id,
    });

    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
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
        // Generate a title from the first user message
        const firstMessage = message.trim();
        chat.title =
          firstMessage.length > 50
            ? firstMessage.substring(0, 47) + "..."
            : firstMessage;
      }

      await chat.save();

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
    } catch (aiError) {
      console.error("AI Service Error:", aiError.message);

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

      res.json({
        userMessage,
        aiMessage: errorMessage,
        chat: {
          id: chat._id,
          title: chat.title,
          messageCount: chat.statistics.messageCount,
          totalTokens: chat.statistics.totalTokens,
        },
        warning: "AI service temporarily unavailable",
      });
    }
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// Update chat settings
router.put("/:chatId/settings", async (req, res) => {
  try {
    const { settings } = req.body;

    const chat = await Chat.findOne({
      _id: req.params.chatId,
      userId: req.user.id,
    });

    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    // Update settings
    if (settings.model) chat.settings.model = settings.model;
    if (settings.temperature !== undefined)
      chat.settings.temperature = settings.temperature;
    if (settings.maxTokens) chat.settings.maxTokens = settings.maxTokens;
    if (settings.systemPrompt)
      chat.settings.systemPrompt = settings.systemPrompt;

    await chat.save();
    res.json(chat.settings);
  } catch (error) {
    console.error("Error updating chat settings:", error);
    res.status(500).json({ error: "Failed to update chat settings" });
  }
});

// Delete a chat
router.delete("/:chatId", async (req, res) => {
  try {
    const chat = await Chat.findOneAndDelete({
      _id: req.params.chatId,
      userId: req.user.id,
    });

    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    res.json({ message: "Chat deleted successfully" });
  } catch (error) {
    console.error("Error deleting chat:", error);
    res.status(500).json({ error: "Failed to delete chat" });
  }
});

// Share/unshare a chat
router.put("/:chatId/share", async (req, res) => {
  try {
    const { isShared } = req.body;

    const chat = await Chat.findOne({
      _id: req.params.chatId,
      userId: req.user.id,
    });

    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    chat.isShared = isShared;
    await chat.save();

    res.json({
      message: isShared
        ? "Chat shared successfully"
        : "Chat unshared successfully",
      isShared: chat.isShared,
    });
  } catch (error) {
    console.error("Error updating chat share status:", error);
    res.status(500).json({ error: "Failed to update chat share status" });
  }
});

export default router;
