import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema(
  {
    filename: String,
    savedAs: String,
    mimeType: String,
    size: Number,
    url: String,
    textExcerpt: String,
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant", "system"],
      required: true,
    },
    content: {
      type: String,
      required: [true, "Message content is required"],
      maxlength: [10000, "Message content cannot exceed 10000 characters"],
    },
    attachments: [attachmentSchema],
    timestamp: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      model: {
        type: String,
        default: "deepseek-r1",
      },
      tokens: {
        prompt: { type: Number, default: 0 },
        completion: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
      },
      processingTime: {
        type: Number, // in milliseconds
        default: 0,
      },
      error: {
        type: String,
        default: null,
      },
    },
  },
  {
    _id: true,
    timestamps: false,
  }
);

const chatSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: [true, "Chat title is required"],
      trim: true,
      maxlength: [200, "Chat title cannot exceed 200 characters"],
      default: "New Chat",
    },
    messages: [messageSchema],
    isActive: {
      type: Boolean,
      default: true,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    tags: [
      {
        type: String,
        trim: true,
        maxlength: [50, "Tag cannot exceed 50 characters"],
      },
    ],
    settings: {
      model: {
        type: String,
        default: "deepseek/deepseek-r1",
        enum: [
          "deepseek-r1",
          "deepseek-chat",
          "deepseek-coder",
          "deepseek/deepseek-r1",
          "deepseek/deepseek-chat",
          "deepseek/deepseek-coder",
        ],
      },
      temperature: {
        type: Number,
        default: 0.7,
        min: 0,
        max: 2,
      },
      maxTokens: {
        type: Number,
        default: 2048,
        min: 1,
        max: 8192,
      },
      systemPrompt: {
        type: String,
        default: "You are Venus AI, a helpful and intelligent assistant.",
        maxlength: [2000, "System prompt cannot exceed 2000 characters"],
      },
    },
    statistics: {
      messageCount: {
        type: Number,
        default: 0,
      },
      totalTokens: {
        type: Number,
        default: 0,
      },
      lastActivity: {
        type: Date,
        default: Date.now,
      },
    },
    sharedWith: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        permission: {
          type: String,
          enum: ["read", "write"],
          default: "read",
        },
        sharedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isPublic: {
      type: Boolean,
      default: false,
    },
    publicId: {
      type: String,
      sparse: true, // Only enforce uniqueness for non-null values
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better query performance
chatSchema.index({ userId: 1, createdAt: -1 });
chatSchema.index({ userId: 1, isPinned: -1, updatedAt: -1 });
chatSchema.index({ publicId: 1 }, { unique: true, sparse: true });
chatSchema.index({ "statistics.lastActivity": -1 });

// Virtual for message count
chatSchema.virtual("messageCount").get(function () {
  return this.messages.length;
});

// Virtual for last message
chatSchema.virtual("lastMessage").get(function () {
  return this.messages.length > 0
    ? this.messages[this.messages.length - 1]
    : null;
});

// Pre-save middleware to update statistics
chatSchema.pre("save", function (next) {
  if (this.isModified("messages")) {
    this.statistics.messageCount = this.messages.length;
    this.statistics.totalTokens = this.messages.reduce((total, msg) => {
      return total + (msg.metadata?.tokens?.total || 0);
    }, 0);
    this.statistics.lastActivity = new Date();
  }
  next();
});

// Instance method to add message
chatSchema.methods.addMessage = function (
  role,
  content,
  metadata = {},
  attachments = []
) {
  const message = {
    role,
    content,
    attachments,
    timestamp: new Date(),
    metadata: {
      model: metadata.model || this.settings.model,
      tokens: metadata.tokens || { prompt: 0, completion: 0, total: 0 },
      processingTime: metadata.processingTime || 0,
      error: metadata.error || null,
    },
  };

  this.messages.push(message);
  return message;
};

// Instance method to update title based on first message
chatSchema.methods.generateTitle = function () {
  if (this.messages.length > 0) {
    const firstUserMessage = this.messages.find((msg) => msg.role === "user");
    if (firstUserMessage) {
      // Take first 50 characters of the first user message as title
      this.title = firstUserMessage.content.substring(0, 50).trim();
      if (firstUserMessage.content.length > 50) {
        this.title += "...";
      }
    }
  }
};

// Static method to find user's chats with pagination
chatSchema.statics.findUserChats = function (userId, options = {}) {
  const {
    page = 1,
    limit = 20,
    sortBy = "updatedAt",
    sortOrder = -1,
    search = "",
    tags = [],
    isPinned,
  } = options;

  const query = { userId, isActive: true };

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { "messages.content": { $regex: search, $options: "i" } },
    ];
  }

  if (tags.length > 0) {
    query.tags = { $in: tags };
  }

  if (typeof isPinned === "boolean") {
    query.isPinned = isPinned;
  }

  const skip = (page - 1) * limit;

  return this.find(query)
    .sort({ [sortBy]: sortOrder })
    .skip(skip)
    .limit(limit)
    .populate("userId", "username firstName lastName avatar")
    .lean();
};

const Chat = mongoose.model("Chat", chatSchema);

export default Chat;
