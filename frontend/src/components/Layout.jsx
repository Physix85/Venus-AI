import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useSocket } from "../contexts/SocketContext";
import { useChat } from "../contexts/ChatContext";
import ChatHistorySidebar from "./ChatHistorySidebar";
import {
  Bars3Icon,
  XMarkIcon,
  ChatBubbleLeftIcon,
  UserIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
  SparklesIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const { theme, changeTheme } = useTheme();
  const { isConnected, onlineUsers } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const navigation = [
    {
      name: "Chat History",
      href: "/chats",
      icon: ChatBubbleLeftIcon,
      current: location.pathname === "/chats",
    },
    {
      name: "Profile",
      href: "/profile",
      icon: UserIcon,
      current: location.pathname === "/profile",
    },
    {
      name: "Settings",
      href: "/settings",
      icon: Cog6ToothIcon,
      current: location.pathname === "/settings",
    },
  ];

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

  const toggleTheme = () => {
    const themes = ["light", "dark", "system"];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    changeTheme(themes[nextIndex]);
  };

  const Sidebar = ({ mobile = false }) => (
    <div className={`flex flex-col h-full ${mobile ? "w-full" : "w-64"}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-600 rounded-lg flex items-center justify-center">
            <SparklesIcon className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            Venus AI
          </h1>
        </div>
        {mobile && (
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-2">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              to={item.href}
              onClick={() => mobile && setSidebarOpen(false)}
              className={`flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                item.current
                  ? "bg-gradient-to-r from-purple-500 to-blue-600 text-white shadow-lg"
                  : item.primary
                  ? "bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 text-purple-700 dark:text-purple-300 hover:from-purple-100 hover:to-blue-100 dark:hover:from-purple-900/30 dark:hover:to-blue-900/30"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <Icon
                className={`h-5 w-5 mr-3 ${item.current ? "text-white" : ""}`}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto px-4 py-3 border-t border-gray-200 dark:border-gray-700">
        <ChatHistorySidebar
          currentChatId={location.pathname.split("/")[2]}
          onChatSelect={() => mobile && setSidebarOpen(false)}
          key={location.pathname} // Force re-render when route changes
        />
      </div>

      {/* Connection Status */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2 text-sm">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? "bg-green-500" : "bg-yellow-500"
            }`}
          ></div>
          <span className="text-gray-600 dark:text-gray-400">
            {isConnected ? "Connected" : "Connecting..."}
          </span>
          {onlineUsers > 0 && (
            <span className="text-gray-500 dark:text-gray-500">
              • {onlineUsers} online
            </span>
          )}
        </div>
      </div>

      {/* User Menu */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">
                {user?.username?.charAt(0).toUpperCase() || "U"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {user?.username || "User"}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {user?.email || "user@example.com"}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200"
              title={`Switch to ${
                theme === "light"
                  ? "dark"
                  : theme === "dark"
                  ? "system"
                  : "light"
              } theme`}
            >
              <ThemeIcon className="h-4 w-4" />
            </button>

            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200"
              title="Sign out"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex bg-gray-50 dark:bg-gray-900">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-white dark:bg-gray-800 shadow-xl">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
          <Sidebar />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <div className="lg:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <Bars3Icon className="h-6 w-6" />
            </button>

            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-blue-600 rounded-md flex items-center justify-center">
                <SparklesIcon className="h-4 w-4 text-white" />
              </div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                Venus AI
              </h1>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <ThemeIcon className="h-5 w-5" />
              </button>

              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {user?.username?.charAt(0).toUpperCase() || "U"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
