import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";
import toast from "react-hot-toast";

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { isAuthenticated, token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState(new Map());
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const socketRef = useRef(null);

  // Socket connection
  useEffect(() => {
    // Clean up existing socket first
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
      setOnlineUsers([]);
      setTypingUsers(new Map());
    }

    if (isAuthenticated && token) {
      const socketUrl =
        import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

      const newSocket = io(socketUrl, {
        auth: {
          token: token,
        },
        transports: ["websocket", "polling"],
        timeout: 20000,
        forceNew: true,
      });

      // Connection event handlers
      newSocket.on("connect", () => {
        console.log("Socket connected:", newSocket.id);
        setIsConnected(true);
        reconnectAttempts.current = 0;
        toast.success("Connected to Venus AI", { duration: 2000 });
      });

      newSocket.on("disconnect", (reason) => {
        console.log("Socket disconnected:", reason);
        setIsConnected(false);
        setOnlineUsers([]);
        setTypingUsers(new Map());

        if (reason === "io server disconnect") {
          // Server initiated disconnect, try to reconnect
          newSocket.connect();
        }
      });

      newSocket.on("connect_error", (error) => {
        console.error("Socket connection error:", error);
        setIsConnected(false);

        reconnectAttempts.current += 1;
        if (reconnectAttempts.current >= maxReconnectAttempts) {
          toast.error(
            "Failed to connect to Venus AI. Please refresh the page."
          );
        }
      });

      // User presence events
      newSocket.on("user_online", (users) => {
        setOnlineUsers(users);
      });

      newSocket.on("user_joined", (user) => {
        setOnlineUsers((prev) => [...prev, user]);
      });

      newSocket.on("user_left", (userId) => {
        setOnlineUsers((prev) => prev.filter((user) => user.id !== userId));
      });

      // Typing events
      newSocket.on("user_typing", ({ userId, username, chatId }) => {
        setTypingUsers((prev) => {
          const newMap = new Map(prev);
          newMap.set(userId, { username, chatId, timestamp: Date.now() });
          return newMap;
        });

        // Clear typing indicator after 3 seconds
        setTimeout(() => {
          setTypingUsers((prev) => {
            const newMap = new Map(prev);
            newMap.delete(userId);
            return newMap;
          });
        }, 3000);
      });

      newSocket.on("user_stopped_typing", ({ userId }) => {
        setTypingUsers((prev) => {
          const newMap = new Map(prev);
          newMap.delete(userId);
          return newMap;
        });
      });

      // Chat events
      newSocket.on("new_message", (message) => {
        // This will be handled by individual chat components
        console.log("New message received:", message);
      });

      newSocket.on("message_updated", (message) => {
        console.log("Message updated:", message);
      });

      newSocket.on("chat_created", (chat) => {
        console.log("New chat created:", chat);
      });

      // Error handling
      newSocket.on("error", (error) => {
        console.error("Socket error:", error);
        console.error("Error details:", JSON.stringify(error, null, 2));
        toast.error(error.message || "An error occurred");
      });

      socketRef.current = newSocket;
      setSocket(newSocket);
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
        setOnlineUsers([]);
        setTypingUsers(new Map());
      }
    };
  }, [isAuthenticated, token]);

  // Socket utility functions
  const joinChat = (chatId) => {
    if (socket && isConnected) {
      socket.emit("join_chat", chatId);
    }
  };

  const leaveChat = (chatId) => {
    if (socket && isConnected) {
      socket.emit("leave_chat", chatId);
    }
  };

  const sendMessage = (chatId, message, attachments = []) => {
    if (socket && isConnected) {
      socket.emit("chat_message", { chatId, message, attachments });
    }
  };

  const startTyping = (chatId) => {
    if (socket && isConnected) {
      socket.emit("start_typing", chatId);
    }
  };

  const stopTyping = (chatId) => {
    if (socket && isConnected) {
      socket.emit("stop_typing", chatId);
    }
  };

  const subscribeToChat = (chatId, callback) => {
    if (socket) {
      socket.on(`chat_${chatId}`, callback);
      return () => socket.off(`chat_${chatId}`, callback);
    }
  };

  const subscribeToMessages = (callback) => {
    if (socket) {
      socket.on("new_message", callback);
      return () => socket.off("new_message", callback);
    }
  };

  const value = {
    socket,
    isConnected,
    onlineUsers,
    typingUsers,
    joinChat,
    leaveChat,
    sendMessage,
    startTyping,
    stopTyping,
    subscribeToChat,
    subscribeToMessages,
  };

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};
