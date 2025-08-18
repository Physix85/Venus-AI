import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import axios from "axios";
import {
  ChatBubbleLeftIcon,
  TrashIcon,
  EllipsisHorizontalIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

const ChatHistorySidebar = ({ currentChatId, onChatSelect }) => {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState({
    today: true,
    yesterday: true,
    last7days: true,
    last30days: false,
    older: false,
  });
  const { user } = useAuth();

  const fetchChats = async () => {
    try {
      setLoading(true);

      // Get token from localStorage to ensure we have authentication
      const token = localStorage.getItem("token");
      if (!token) {
        setChats([]);
        return;
      }

      const response = await axios.get("/chat", {
        params: {
          limit: 100,
          sortBy: "updatedAt",
          sortOrder: "desc",
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setChats(response.data.chats || []);
    } catch (error) {
      console.error("Error fetching chats:", error);
      if (error.response?.status === 401) {
        setChats([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchChats();
    }
  }, [user]);

  // Refresh chats when currentChatId changes (new chat created or switched)
  useEffect(() => {
    if (user && currentChatId && currentChatId !== "undefined") {
      // Small delay to ensure the chat is saved in the backend
      const timeoutId = setTimeout(() => {
        fetchChats();
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [currentChatId, user]);

  // Refresh chats when window gains focus (user comes back to tab)
  useEffect(() => {
    const handleFocus = () => {
      if (user) {
        fetchChats();
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [user]);

  const deleteChat = async (chatId, e) => {
    e.preventDefault();
    e.stopPropagation();

    if (window.confirm("Are you sure you want to delete this chat?")) {
      try {
        const token = localStorage.getItem("token");
        await axios.delete(`/chat/${chatId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        fetchChats(); // Refresh the list
      } catch (error) {
        console.error("Error deleting chat:", error);
      }
    }
  };

  const groupChatsByDate = (chats) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const last7days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const groups = {
      today: [],
      yesterday: [],
      last7days: [],
      last30days: [],
      older: [],
    };

    chats.forEach((chat) => {
      const chatDate = new Date(chat.updatedAt);
      const chatDay = new Date(
        chatDate.getFullYear(),
        chatDate.getMonth(),
        chatDate.getDate()
      );

      if (chatDay.getTime() === today.getTime()) {
        groups.today.push(chat);
      } else if (chatDay.getTime() === yesterday.getTime()) {
        groups.yesterday.push(chat);
      } else if (chatDate >= last7days) {
        groups.last7days.push(chat);
      } else if (chatDate >= last30days) {
        groups.last30days.push(chat);
      } else {
        groups.older.push(chat);
      }
    });

    return groups;
  };

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const formatChatTitle = (title) => {
    if (!title || title === "New Chat") {
      return "Untitled Chat";
    }
    return title.length > 30 ? title.substring(0, 30) + "..." : title;
  };

  const ChatItem = ({ chat }) => (
    <Link
      to={`/chat/${chat._id}`}
      onClick={onChatSelect}
      className={`group flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800 ${
        currentChatId === chat._id
          ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
          : "text-gray-700 dark:text-gray-300"
      }`}
    >
      <div className="flex items-center min-w-0 flex-1">
        <ChatBubbleLeftIcon className="h-4 w-4 mr-2 flex-shrink-0 text-gray-400" />
        <span className="truncate">{formatChatTitle(chat.title)}</span>
      </div>

      <button
        onClick={(e) => deleteChat(chat._id, e)}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-opacity duration-200"
        title="Delete chat"
      >
        <TrashIcon className="h-3 w-3 text-gray-400 hover:text-red-500" />
      </button>
    </Link>
  );

  const SectionHeader = ({ title, count, section, children }) => (
    <div className="mb-2">
      <button
        onClick={() => toggleSection(section)}
        className="flex items-center justify-between w-full px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors duration-200"
      >
        <span>
          {title} {count > 0 && `(${count})`}
        </span>
        {count > 0 &&
          (expandedSections[section] ? (
            <ChevronDownIcon className="h-3 w-3" />
          ) : (
            <ChevronRightIcon className="h-3 w-3" />
          ))}
      </button>

      {expandedSections[section] && count > 0 && (
        <div className="space-y-1 mt-1">{children}</div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  const groupedChats = groupChatsByDate(chats);

  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex gap-2 mb-4">
        <Link
          to="/"
          onClick={onChatSelect}
          className="flex items-center justify-center flex-1 px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-500 to-blue-600 rounded-lg hover:from-purple-600 hover:to-blue-700 transition-all duration-200 shadow-sm hover:shadow-md"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          New Chat
        </Link>

        <button
          onClick={fetchChats}
          disabled={loading}
          className="flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 disabled:opacity-50"
          title="Refresh chat list"
        >
          <ArrowPathIcon
            className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      <SectionHeader
        title="Today"
        count={groupedChats.today.length}
        section="today"
      >
        {groupedChats.today.map((chat) => (
          <ChatItem key={chat._id} chat={chat} />
        ))}
      </SectionHeader>

      <SectionHeader
        title="Yesterday"
        count={groupedChats.yesterday.length}
        section="yesterday"
      >
        {groupedChats.yesterday.map((chat) => (
          <ChatItem key={chat._id} chat={chat} />
        ))}
      </SectionHeader>

      <SectionHeader
        title="Previous 7 days"
        count={groupedChats.last7days.length}
        section="last7days"
      >
        {groupedChats.last7days.map((chat) => (
          <ChatItem key={chat._id} chat={chat} />
        ))}
      </SectionHeader>

      <SectionHeader
        title="Previous 30 days"
        count={groupedChats.last30days.length}
        section="last30days"
      >
        {groupedChats.last30days.map((chat) => (
          <ChatItem key={chat._id} chat={chat} />
        ))}
      </SectionHeader>

      <SectionHeader
        title="Older"
        count={groupedChats.older.length}
        section="older"
      >
        {groupedChats.older.map((chat) => (
          <ChatItem key={chat._id} chat={chat} />
        ))}
      </SectionHeader>

      {chats.length === 0 && !loading && (
        <div className="text-center py-8">
          <ChatBubbleLeftIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {user
              ? "No conversations yet"
              : "Please login to see your chat history"}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {user
              ? "Start a new chat to see your history here"
              : "Create an account or login to continue"}
          </p>
        </div>
      )}

      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Loading your conversations...
          </p>
        </div>
      )}
    </div>
  );
};

export default ChatHistorySidebar;
