import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSocket } from "../contexts/SocketContext";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import {
  PaperAirplaneIcon,
  SparklesIcon,
  UserIcon,
  ClipboardDocumentIcon,
  ArrowPathIcon,
  ArrowRightOnRectangleIcon,
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
  PaperClipIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import LoadingSpinner from "../components/LoadingSpinner";
import axios from "axios";

const Chat = () => {
  const { chatId } = useParams();
  const navigate = useNavigate();

  const { isConnected, sendMessage, socket } = useSocket();
  const { user, logout } = useAuth();
  const { theme, changeTheme } = useTheme();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [chatLoading, setChatLoading] = useState(true);
  const [currentChat, setCurrentChat] = useState(null);
  const [attachments, setAttachments] = useState([]); // uploaded attachment metadata
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const toggleTheme = () => {
    const themes = ["light", "dark", "system"];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    changeTheme(themes[nextIndex]);
  };

  const getThemeIcon = () => {
    switch (theme) {
      case "light":
        return SunIcon;
      case "dark":
        return MoonIcon;
      default:
        return ComputerDesktopIcon;
    }
  };

  const ThemeIcon = getThemeIcon();

  // Load chat messages when component mounts or chatId changes
  useEffect(() => {
    const loadChat = async () => {
      setChatLoading(true);
      setCurrentChat(null); // Clear current chat while loading

      try {
        if (chatId && chatId !== "default") {
          // Load existing chat (use axios so baseURL and auth headers are applied)
          const response = await axios.get(`/chat/${chatId}`);
          const chat = response.data;
          setCurrentChat(chat);

          // Convert backend messages to frontend format
          const formattedMessages = chat.messages.map((msg, index) => ({
            id: `${chat._id}-${index}`,
            role: msg.role,
            content: msg.content,
            timestamp: new Date(msg.timestamp),
            attachments: msg.attachments || [],
          }));

          setMessages(formattedMessages);

          // Update page title with chat title
          document.title = `${chat.title || "Chat"} - Venus AI`;
        } else {
          // New chat, show welcome message
          setCurrentChat(null);
          setMessages([
            {
              id: "welcome",
              role: "assistant",
              content:
                "Hello! I'm Venus AI, your intelligent assistant powered by advanced reasoning. I can help you with a wide variety of tasks including:\n\n• Answering questions and providing explanations\n• Writing and editing content\n• Problem-solving and analysis\n• Creative tasks and brainstorming\n• Code assistance and debugging\n\nWhat would you like to explore today?",
              timestamp: new Date(),
            },
          ]);

          // Reset page title
          document.title = "Venus AI";
        }
      } catch (error) {
        console.error("Error loading chat:", error);
        // Show welcome message on error
        setCurrentChat(null);
        setMessages([
          {
            id: "welcome",
            role: "assistant",
            content:
              "Hello! I'm Venus AI, your intelligent assistant powered by advanced reasoning. I can help you with a wide variety of tasks including:\n\n• Answering questions and providing explanations\n• Writing and editing content\n• Problem-solving and analysis\n• Creative tasks and brainstorming\n• Code assistance and debugging\n\nWhat would you like to explore today?",
            timestamp: new Date(),
          },
        ]);
      } finally {
        setChatLoading(false);
      }
    };

    loadChat();
  }, [chatId, navigate]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Cleanup socket listeners on unmount
  useEffect(() => {
    return () => {
      // Clean up any remaining event listeners when component unmounts
      if (socket) {
        socket.off("ai_response");
        socket.off("ai_typing");
        socket.off("error");
      }
    };
  }, [socket]);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    setUploading(true);
    try {
      const { data } = await axios.post(`/upload`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setAttachments((prev) => [...prev, ...(data.attachments || [])]);
    } catch (err) {
      console.error("Upload failed", err);
      alert(
        err.response?.data?.error || "Failed to upload files. Please try again."
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (idx) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if ((!inputMessage.trim() && attachments.length === 0) || isLoading) return;

    const userMessage = {
      id: Date.now().toString(),
      role: "user",
      content: inputMessage.trim(),
      timestamp: new Date(),
      attachments,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);
    setIsTyping(true);

    console.log("Sending message:", {
      userMessage: userMessage.content,
      currentChat: currentChat?._id,
      chatId,
      isConnected,
      hasSocket: !!socket,
      hasSendMessage: !!sendMessage,
    });

    try {
      // Send message via socket if connected
      if (isConnected && sendMessage) {
        // Use current chat ID or create a new one
        const activeChatId = currentChat?._id || chatId || "default";
        console.log("Sending via socket with chatId:", activeChatId);
        sendMessage(activeChatId, userMessage.content, attachments);

        // Create a unique response handler for this message
        const messageId = Date.now();
        let responseReceived = false;

        // Listen for AI response via socket
        const handleAIResponse = (data) => {
          console.log("Received AI response:", data);
          console.log("Chat info in response:", data.chat);

          if (
            data.message &&
            data.message.role === "assistant" &&
            !responseReceived
          ) {
            responseReceived = true;

            const aiResponse = {
              id: (messageId + 1).toString(),
              role: "assistant",
              content: data.message.content,
              timestamp: new Date(data.message.timestamp),
            };

            setMessages((prev) => [...prev, aiResponse]);
            setIsLoading(false);
            setIsTyping(false);

            // Update current chat info if provided
            if (data.chat) {
              setCurrentChat((prev) => ({
                ...prev,
                _id: data.chat.id,
                title: data.chat.title,
                messageCount: data.chat.messageCount,
                totalTokens: data.chat.totalTokens,
              }));

              // Update URL if we're in a new chat
              if ((!chatId || chatId === "default") && data.chat.id) {
                navigate(`/chat/${data.chat.id}`, { replace: true });
              }

              // Update page title
              document.title = `${data.chat.title || "Chat"} - Venus AI`;
            }

            // Clean up the event listener
            if (socket) {
              socket.off("ai_response", handleAIResponse);
            }

            // Clear timeout
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
          }
        };

        // Listen for AI typing indicator
        const handleAITyping = (data) => {
          console.log("AI typing status:", data);
          setIsTyping(data.typing);
        };

        // Listen for errors
        const handleError = (error) => {
          console.error("Socket error:", error);
          responseReceived = true;

          const errorResponse = {
            id: (messageId + 1).toString(),
            role: "assistant",
            content:
              error.message ||
              "I apologize, but I'm currently unable to process your request. Please try again later.",
            timestamp: new Date(),
          };

          setMessages((prev) => [...prev, errorResponse]);
          setIsLoading(false);
          setIsTyping(false);

          // Clean up event listeners
          if (socket) {
            socket.off("ai_response", handleAIResponse);
            socket.off("ai_typing", handleAITyping);
            socket.off("error", handleError);
          }

          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        };

        // Set up event listeners
        if (socket) {
          socket.on("ai_response", handleAIResponse);
          socket.on("ai_typing", handleAITyping);
          socket.on("error", handleError);
        }

        // Set timeout for 60 seconds (increased from 30)
        const timeoutId = setTimeout(() => {
          if (!responseReceived) {
            console.log("AI response timeout");
            responseReceived = true;

            const timeoutResponse = {
              id: (messageId + 1).toString(),
              role: "assistant",
              content:
                "I apologize, but my response is taking longer than expected. Please try asking your question again.",
              timestamp: new Date(),
            };

            setMessages((prev) => [...prev, timeoutResponse]);
            setIsLoading(false);
            setIsTyping(false);

            // Clean up event listeners
            if (socket) {
              socket.off("ai_response", handleAIResponse);
              socket.off("ai_typing", handleAITyping);
              socket.off("error", handleError);
            }
          }
        }, 60000);
      } else {
        // Fallback to direct API call if socket not connected
        const activeChatId = currentChat?._id || chatId || "default";
        const { data } = await axios.post(`/chat/${activeChatId}/messages`, {
          message: userMessage.content,
          attachments,
        });

        const aiResponse = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.aiMessage.content,
          timestamp: new Date(data.aiMessage.timestamp),
        };
        setMessages((prev) => [...prev, aiResponse]);

        // Update current chat info if provided
        if (data.chat) {
          setCurrentChat((prev) => ({
            ...prev,
            _id: data.chat.id,
            title: data.chat.title,
            messageCount: data.chat.messageCount,
            totalTokens: data.chat.totalTokens,
          }));

          // Update URL if we're in a new chat
          if ((!chatId || chatId === "default") && data.chat.id) {
            window.history.replaceState(null, "", `/chat/${data.chat.id}`);
          }
        }

        setIsLoading(false);
        setIsTyping(false);
        setAttachments([]);
        setAttachments([]);
      }
    } catch (error) {
      console.error("Error sending message:", error);

      // Show error message
      const errorResponse = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          "I apologize, but I'm currently unable to process your request. Please try again later.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorResponse]);

      setIsLoading(false);
      setIsTyping(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const MessageBubble = ({ message }) => {
    const isUser = message.role === "user";

    return (
      <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-6`}>
        <div
          className={`flex max-w-[85%] sm:max-w-[75%] ${
            isUser ? "flex-row-reverse" : "flex-row"
          }`}
        >
          {/* Avatar */}
          <div className={`flex-shrink-0 ${isUser ? "ml-3" : "mr-3"}`}>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                isUser
                  ? "bg-gradient-to-r from-blue-500 to-purple-600"
                  : "bg-gradient-to-r from-purple-500 to-pink-500"
              }`}
            >
              {isUser ? (
                <UserIcon className="h-5 w-5 text-white" />
              ) : (
                <SparklesIcon className="h-5 w-5 text-white" />
              )}
            </div>
          </div>

          {/* Message Content */}
          <div
            className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
          >
            <div
              className={`relative px-4 py-3 rounded-2xl shadow-sm ${
                isUser
                  ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                  : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
              }`}
            >
              <div
                className={`text-sm leading-relaxed ${
                  isUser ? "text-white" : "text-gray-900 dark:text-gray-100"
                }`}
              >
                {message.content.split("\n").map((line, index) => (
                  <React.Fragment key={index}>
                    {line}
                    {index < message.content.split("\n").length - 1 && <br />}
                  </React.Fragment>
                ))}
              </div>

              {/* Attachments */}
              {Array.isArray(message.attachments) &&
                message.attachments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {message.attachments.map((att, i) => (
                      <div key={i} className="flex items-center gap-2">
                        {att.mimeType?.startsWith("image/") ? (
                          <a href={att.url} target="_blank" rel="noreferrer">
                            <img
                              src={att.url}
                              alt={att.filename}
                              className="w-20 h-14 object-cover rounded border border-gray-200 dark:border-gray-700"
                            />
                          </a>
                        ) : (
                          <PaperClipIcon className="h-4 w-4 text-gray-400" />
                        )}
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noreferrer"
                          className={`text-xs underline ${
                            isUser
                              ? "text-white/90"
                              : "text-blue-600 dark:text-blue-400"
                          }`}
                        >
                          {att.filename}
                        </a>
                        <span
                          className={`text-[10px] ${
                            isUser ? "text-white/70" : "text-gray-400"
                          }`}
                        >
                          {att.mimeType}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

              {/* Copy button for assistant messages */}
              {!isUser && (
                <button
                  onClick={() => copyToClipboard(message.content)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                  title="Copy message"
                >
                  <ClipboardDocumentIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                </button>
              )}
            </div>

            {/* Timestamp */}
            <div
              className={`text-xs text-gray-500 dark:text-gray-400 mt-1 ${
                isUser ? "text-right" : "text-left"
              }`}
            >
              {formatTimestamp(message.timestamp)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const TypingIndicator = () => (
    <div className="flex justify-start mb-6">
      <div className="flex max-w-[75%]">
        <div className="flex-shrink-0 mr-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
            <SparklesIcon className="h-5 w-5 text-white" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 shadow-sm">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
            <div
              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: "0.1s" }}
            ></div>
            <div
              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: "0.2s" }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <SparklesIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                Venus AI
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isConnected ? "Connected" : "Connecting..."}
              </p>
            </div>
          </div>

          {/* User Info and Actions */}
          <div className="flex items-center space-x-4">
            {/* Connection Status */}
            <div className="flex items-center space-x-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  isConnected ? "bg-green-500" : "bg-yellow-500"
                }`}
              ></div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {isConnected ? "Online" : "Connecting"}
              </span>
            </div>

            {/* User Avatar */}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {user?.username?.charAt(0).toUpperCase() || "U"}
                </span>
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:block">
                {user?.username || "User"}
              </span>
            </div>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200 border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600"
              title={`Switch to ${
                theme === "light"
                  ? "dark"
                  : theme === "dark"
                  ? "system"
                  : "light"
              } theme`}
            >
              <ThemeIcon className="h-4 w-4" />
              <span className="hidden sm:block">Theme</span>
            </button>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200 border border-gray-200 dark:border-gray-600 hover:border-red-300 dark:hover:border-red-600"
              title="Sign out"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
              <span className="hidden sm:block">Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        <div className="max-w-4xl mx-auto">
          {chatLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400">
                Loading chat...
              </span>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div key={message.id} className="group">
                  <MessageBubble message={message} />
                </div>
              ))}

              {isTyping && <TypingIndicator />}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700 px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <form
            onSubmit={handleSendMessage}
            className="flex items-end space-x-3"
          >
            <div className="flex-1 relative">
              {/* Selected attachments */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {attachments.map((att, idx) => (
                    <div
                      key={`${att.savedAs}-${idx}`}
                      className="flex items-center gap-2 px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                    >
                      <PaperClipIcon className="h-3 w-3 text-gray-500" />
                      <a
                        href={att.url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        {att.filename}
                      </a>
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        className="hover:text-red-500"
                        title="Remove"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <textarea
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                placeholder={
                  chatLoading
                    ? "Loading chat..."
                    : uploading
                    ? "Uploading attachments..."
                    : "Type your message... (Press Enter to send, Shift+Enter for new line)"
                }
                className="w-full px-4 py-3 pr-20 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                rows="1"
                style={{ minHeight: "48px", maxHeight: "120px" }}
                disabled={isLoading || chatLoading || uploading}
              />

              {/* Attach button */}
              <div className="absolute right-2 top-2 flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,application/pdf,text/plain"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
                  title="Attach files"
                  disabled={uploading}
                >
                  <PaperClipIcon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={
                (!inputMessage.trim() && attachments.length === 0) ||
                isLoading ||
                chatLoading ||
                uploading
              }
              className="flex-shrink-0 w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-full flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
            >
              {isLoading ? (
                <ArrowPathIcon className="h-5 w-5 animate-spin" />
              ) : (
                <PaperAirplaneIcon className="h-5 w-5" />
              )}
            </button>
          </form>

          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
            Venus AI can make mistakes. Consider checking important information.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
