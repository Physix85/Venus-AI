import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SocketProvider } from "./contexts/SocketContext";
import { ChatProvider } from "./contexts/ChatContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Chat from "./pages/Chat";
import ChatHistory from "./pages/ChatHistory";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Debug from "./pages/Debug";
import "./App.css";

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ChatProvider>
          <SocketProvider>
            <Router>
              <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
                <Routes>
                  {/* Public routes */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/debug" element={<Debug />} />

                  {/* Protected routes */}
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <Layout>
                          <Chat />
                        </Layout>
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/chat/:chatId?"
                    element={
                      <ProtectedRoute>
                        <Layout>
                          <Chat />
                        </Layout>
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/chats"
                    element={
                      <ProtectedRoute>
                        <Layout>
                          <ChatHistory />
                        </Layout>
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute>
                        <Layout>
                          <Profile />
                        </Layout>
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/settings"
                    element={
                      <ProtectedRoute>
                        <Layout>
                          <Settings />
                        </Layout>
                      </ProtectedRoute>
                    }
                  />

                  {/* Catch all route */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>

                {/* Toast notifications */}
                <Toaster
                  position="top-right"
                  toastOptions={{
                    duration: 4000,
                    style: {
                      background: "var(--toast-bg)",
                      color: "var(--toast-color)",
                    },
                    success: {
                      iconTheme: {
                        primary: "#10b981",
                        secondary: "#ffffff",
                      },
                    },
                    error: {
                      iconTheme: {
                        primary: "#ef4444",
                        secondary: "#ffffff",
                      },
                    },
                  }}
                />
              </div>
            </Router>
          </SocketProvider>
        </ChatProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
