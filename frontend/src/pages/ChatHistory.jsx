import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import axios from "axios";
import {
  MagnifyingGlassIcon,
  ChatBubbleLeftIcon,
  BookmarkIcon,
  TrashIcon,
  EllipsisVerticalIcon,
  CalendarIcon,
  ClockIcon,
  HashtagIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { BookmarkIcon as BookmarkIconSolid } from "@heroicons/react/24/solid";
import LoadingSpinner from "../components/LoadingSpinner";

const ChatHistory = () => {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("updatedAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchChats = async (page = 1) => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 20,
        search: searchTerm,
        sortBy,
        sortOrder,
        ...(showPinnedOnly && { isPinned: "true" }),
      };

      const response = await axios.get("/chat", { params });
      setChats(response.data.chats);
      setPagination(response.data.pagination);
      setCurrentPage(page);
    } catch (error) {
      console.error("Error fetching chats:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChats(1);
  }, [searchTerm, sortBy, sortOrder, showPinnedOnly]);

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
    setCurrentPage(1);
  };

  const togglePin = async (chatId, currentPinStatus) => {
    try {
      await axios.put(`/chat/${chatId}/pin`, {
        isPinned: !currentPinStatus,
      });
      fetchChats(currentPage);
    } catch (error) {
      console.error("Error toggling pin:", error);
    }
  };

  const deleteChat = async (chatId) => {
    if (window.confirm("Are you sure you want to delete this chat?")) {
      try {
        await axios.delete(`/chat/${chatId}`);
        fetchChats(currentPage);
      } catch (error) {
        console.error("Error deleting chat:", error);
      }
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return "Today";
    if (diffDays === 2) return "Yesterday";
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    return date.toLocaleDateString();
  };

  const ChatCard = ({ chat }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow duration-200">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <Link
              to={`/chat/${chat._id}`}
              className="block hover:text-purple-600 dark:hover:text-purple-400 transition-colors duration-200"
            >
              <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">
                {chat.title || "Untitled Chat"}
              </h3>
            </Link>

            <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center">
                <CalendarIcon className="h-4 w-4 mr-1" />
                {formatDate(chat.updatedAt)}
              </div>

              <div className="flex items-center">
                <ChatBubbleLeftIcon className="h-4 w-4 mr-1" />
                {chat.statistics?.messageCount || 0} messages
              </div>

              {chat.tags && chat.tags.length > 0 && (
                <div className="flex items-center">
                  <HashtagIcon className="h-4 w-4 mr-1" />
                  {chat.tags.slice(0, 2).join(", ")}
                  {chat.tags.length > 2 && "..."}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2 ml-4">
            <button
              onClick={() => togglePin(chat._id, chat.isPinned)}
              className={`p-2 rounded-lg transition-colors duration-200 ${
                chat.isPinned
                  ? "text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300"
                  : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              }`}
              title={chat.isPinned ? "Unpin chat" : "Pin chat"}
            >
              {chat.isPinned ? (
                <BookmarkIconSolid className="h-5 w-5" />
              ) : (
                <BookmarkIcon className="h-5 w-5" />
              )}
            </button>

            <button
              onClick={() => deleteChat(chat._id)}
              className="p-2 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200"
              title="Delete chat"
            >
              <TrashIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading && chats.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Chat History
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {pagination.totalChats || 0} conversations
            </p>
          </div>

          <Link
            to="/"
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-600 text-white rounded-lg hover:from-purple-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            New Chat
          </Link>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchTerm}
              onChange={handleSearch}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowPinnedOnly(!showPinnedOnly)}
              className={`px-4 py-2 rounded-lg border transition-colors duration-200 ${
                showPinnedOnly
                  ? "bg-purple-100 dark:bg-purple-900 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300"
                  : "bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
              }`}
            >
              <BookmarkIcon className="h-4 w-4 mr-2 inline" />
              Pinned Only
            </button>

            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split("-");
                setSortBy(field);
                setSortOrder(order);
              }}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="updatedAt-desc">Latest First</option>
              <option value="updatedAt-asc">Oldest First</option>
              <option value="title-asc">Title A-Z</option>
              <option value="title-desc">Title Z-A</option>
              <option value="createdAt-desc">Created Latest</option>
              <option value="createdAt-asc">Created Oldest</option>
            </select>
          </div>
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : chats.length === 0 ? (
          <div className="text-center py-12">
            <ChatBubbleLeftIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {!user
                ? "Please login to see your chat history"
                : searchTerm || showPinnedOnly
                ? "No chats found"
                : "No chats yet"}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {!user
                ? "Create an account or login to start chatting with Venus AI"
                : searchTerm || showPinnedOnly
                ? "Try adjusting your search or filters"
                : "Start a conversation to see your chat history here"}
            </p>
            {!user ? (
              <div className="space-x-4">
                <Link
                  to="/login"
                  className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-600 text-white rounded-lg hover:from-purple-600 hover:to-blue-700 transition-all duration-200"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center px-4 py-2 border border-purple-500 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all duration-200"
                >
                  Sign Up
                </Link>
              </div>
            ) : (
              !searchTerm &&
              !showPinnedOnly && (
                <Link
                  to="/"
                  className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-600 text-white rounded-lg hover:from-purple-600 hover:to-blue-700 transition-all duration-200"
                >
                  <PlusIcon className="h-5 w-5 mr-2" />
                  Start Your First Chat
                </Link>
              )
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {chats.map((chat) => (
              <ChatCard key={chat._id} chat={chat} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Showing page {pagination.currentPage} of {pagination.totalPages}
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => fetchChats(currentPage - 1)}
                disabled={!pagination.hasPrevPage}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
              >
                Previous
              </button>

              <button
                onClick={() => fetchChats(currentPage + 1)}
                disabled={!pagination.hasNextPage}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatHistory;
