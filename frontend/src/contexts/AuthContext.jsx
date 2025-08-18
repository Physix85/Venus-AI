import React, { createContext, useContext, useReducer, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";

const AuthContext = createContext();

// API base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Configure axios defaults
axios.defaults.baseURL = API_BASE_URL;

// Auth reducer
const authReducer = (state, action) => {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_USER":
      return {
        ...state,
        user: action.payload,
        isAuthenticated: !!action.payload,
        loading: false,
      };
    case "SET_TOKEN":
      return { ...state, token: action.payload };
    case "LOGOUT":
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
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
  user: null,
  token: localStorage.getItem("token"),
  isAuthenticated: false,
  loading: true,
  error: null,
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Set auth token in axios headers
  const setAuthToken = (token) => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      localStorage.setItem("token", token);
    } else {
      delete axios.defaults.headers.common["Authorization"];
      localStorage.removeItem("token");
    }
  };

  // Load user on app start
  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem("token");

      if (token) {
        setAuthToken(token);
        try {
          const response = await axios.get("/auth/me");
          dispatch({ type: "SET_USER", payload: response.data.user });
          dispatch({ type: "SET_TOKEN", payload: token });
        } catch (error) {
          console.error("Failed to load user:", error);
          localStorage.removeItem("token");
          delete axios.defaults.headers.common["Authorization"];
          dispatch({ type: "LOGOUT" });
        }
      } else {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    };

    loadUser();
  }, []);

  // Register user
  const register = async (userData) => {
    try {
      console.log("AuthContext: Starting registration with:", userData);
      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "CLEAR_ERROR" });

      console.log("AuthContext: Making API call to /auth/register");
      const response = await axios.post("/auth/register", userData);
      console.log("AuthContext: API response:", response.data);

      const { token, user } = response.data;

      setAuthToken(token);
      dispatch({ type: "SET_USER", payload: user });
      dispatch({ type: "SET_TOKEN", payload: token });

      toast.success(
        "🎉 Welcome to Venus AI! Your account has been created successfully."
      );
      console.log("AuthContext: Registration successful, returning success");
      return { success: true };
    } catch (error) {
      console.log("AuthContext: Registration error:", error);
      const errorMessage = error.response?.data?.error || "Registration failed";
      dispatch({ type: "SET_ERROR", payload: errorMessage });
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // Login user
  const login = async (credentials) => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "CLEAR_ERROR" });

      const response = await axios.post("/auth/login", credentials);
      const { token, user } = response.data;

      setAuthToken(token);
      dispatch({ type: "SET_USER", payload: user });
      dispatch({ type: "SET_TOKEN", payload: token });

      toast.success(`Welcome back, ${user.firstName}!`);
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.error || "Login failed";
      dispatch({ type: "SET_ERROR", payload: errorMessage });
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // Logout user
  const logout = async () => {
    try {
      // Call logout endpoint if authenticated
      if (state.token) {
        await axios.post("/auth/logout");
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setAuthToken(null);
      dispatch({ type: "LOGOUT" });
      toast.success("Logged out successfully");
    }
  };

  // Update profile
  const updateProfile = async (profileData) => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "CLEAR_ERROR" });

      const response = await axios.put("/auth/update-profile", profileData);
      dispatch({ type: "SET_USER", payload: response.data.user });

      toast.success("Profile updated successfully");
      return { success: true };
    } catch (error) {
      const errorMessage =
        error.response?.data?.error || "Profile update failed";
      dispatch({ type: "SET_ERROR", payload: errorMessage });
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // Change password
  const changePassword = async (passwordData) => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "CLEAR_ERROR" });

      await axios.put("/auth/change-password", passwordData);

      toast.success("Password changed successfully");
      return { success: true };
    } catch (error) {
      const errorMessage =
        error.response?.data?.error || "Password change failed";
      dispatch({ type: "SET_ERROR", payload: errorMessage });
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // Clear error
  const clearError = () => {
    dispatch({ type: "CLEAR_ERROR" });
  };

  const value = {
    ...state,
    register,
    login,
    logout,
    updateProfile,
    changePassword,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
