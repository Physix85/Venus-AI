import React, { createContext, useContext, useReducer, useEffect } from "react";
import { useAuth } from "./AuthContext";
import axios from "axios";

const ChatContext = createContext();

// Chat reducer
const chatReducer = (state, action) => {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_CURRENT_CHAT":
      return { ...state, currentChat: action.payload, loading: false };
    case "SET_MESSAGES":
      return { ...state, messages: action.payload };
    case "ADD_MESSAGE":
      return { ...state, messages: [...state.messages, action.payload] };
    case "UPDATE_MESSAGE":
      return {
        ...state,
        messages: state.messages.map((msg) =>
          msg.id === action.payload.id ? { ...msg, ...action.payload } : msg
        ),
      };
    case "SET_RECENT_CHATS":
      return { ...state, recentChats: action.payload };
    case "CLEAR_CHAT":
      return {
        ...state,
        currentChat: null,
        messages: [],
        loading: false,
      };
    case "SET_ERROR":
      return { ...state, error: action.payload, loading: false };
    case "CLEAR_ERROR":
      return { ...state, error: null };
    default:
      return state;
  }
};

// Initial state
const initialState = {
  currentChat: null,
  messages: [],
  recentChats: [],
  loading: false,
  error: null,
};

export const ChatProvider = ({ children }) => {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const { user, token } = useAuth();

  // Load a specific chat
  const loadChat = async (chatId) => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "CLEAR_ERROR" });

      if (!chatId || chatId === "default") {
        // New chat - clear current state and show welcome message
        dispatch({ type: "CLEAR_CHAT" });
        dispatch({
          type: "SET_MESSAGES",
          payload: [
            {
              id: "welcome",
              role: "assistant",
              content:
                "Hello! I'm Venus AI, your intelligent assistant powered by advanced reasoning. I can help you with a wide variety of tasks including:\n\n• Answering questions and providing explanations\n• Writing and editing content\n• Problem-solving and analysis\n• Creative tasks and brainstorming\n• Code assistance and debugging\n\nWhat would you like to explore today?",
              timestamp: new Date(),
            },
          ],
        });
        return;
      }

      const response = await axios.get(`/chat/${chatId}`);
      const chat = response.data;

      dispatch({ type: "SET_CURRENT_CHAT", payload: chat });

      // Convert backend messages to frontend format
      const formattedMessages = chat.messages.map((msg, index) => ({
        id: `${chat._id}-${index}`,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp),
      }));

      dispatch({ type: "SET_MESSAGES", payload: formattedMessages });
    } catch (error) {
      console.error("Error loading chat:", error);
      dispatch({ type: "SET_ERROR", payload: "Failed to load chat" });

      // Show welcome message on error
      dispatch({
        type: "SET_MESSAGES",
        payload: [
          {
            id: "welcome",
            role: "assistant",
            content:
              "Hello! I'm Venus AI, your intelligent assistant powered by advanced reasoning. I can help you with a wide variety of tasks including:\n\n• Answering questions and providing explanations\n• Writing and editing content\n• Problem-solving and analysis\n• Creative tasks and brainstorming\n• Code assistance and debugging\n\nWhat would you like to explore today?",
            timestamp: new Date(),
          },
        ],
      });
    }
  };

  // Load recent chats
  const loadRecentChats = async () => {
    try {
      const response = await axios.get("/chat/recent", {
        params: { limit: 5 },
      });
      dispatch({ type: "SET_RECENT_CHATS", payload: response.data });
    } catch (error) {
      console.error("Error loading recent chats:", error);
    }
  };

  // Create a new chat
  const createNewChat = async (title = "New Chat", settings = {}) => {
    try {
      const response = await axios.post("/chat", {
        title,
        settings: {
          model: "deepseek/deepseek-r1",
          temperature: 0.7,
          maxTokens: 2048,
          systemPrompt:
            "You are Venus AI, a helpful and intelligent assistant.",
          ...settings,
        },
      });

      const newChat = response.data;
      dispatch({ type: "SET_CURRENT_CHAT", payload: newChat });
      dispatch({ type: "SET_MESSAGES", payload: [] });

      // Refresh recent chats
      loadRecentChats();

      return newChat;
    } catch (error) {
      console.error("Error creating new chat:", error);
      dispatch({ type: "SET_ERROR", payload: "Failed to create new chat" });
      throw error;
    }
  };

  // Add a message to current chat
  const addMessage = (message) => {
    dispatch({ type: "ADD_MESSAGE", payload: message });
  };

  // Update a message
  const updateMessage = (messageUpdate) => {
    dispatch({ type: "UPDATE_MESSAGE", payload: messageUpdate });
  };

  // Clear current chat
  const clearChat = () => {
    dispatch({ type: "CLEAR_CHAT" });
  };

  // Clear error
  const clearError = () => {
    dispatch({ type: "CLEAR_ERROR" });
  };

  // Load recent chats when user changes
  useEffect(() => {
    if (user && token) {
      loadRecentChats();
    }
  }, [user, token]);

  const value = {
    ...state,
    loadChat,
    loadRecentChats,
    createNewChat,
    addMessage,
    updateMessage,
    clearChat,
    clearError,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
};

export default ChatContext;
