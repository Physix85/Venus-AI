import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    // Get theme from localStorage or default to 'system'
    const savedTheme = localStorage.getItem("venus-ai-theme");
    return savedTheme || "system";
  });

  const [isDark, setIsDark] = useState(false);

  // Function to get system preference
  const getSystemTheme = () => {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  };

  // Function to apply theme
  const applyTheme = useCallback((newTheme) => {
    const root = window.document.documentElement;

    let effectiveTheme = newTheme;
    if (newTheme === "system") {
      effectiveTheme = getSystemTheme();
    }

    // Remove existing theme classes
    root.classList.remove("light", "dark");

    // Add new theme class
    root.classList.add(effectiveTheme);

    // Update CSS custom properties for toast styling
    if (effectiveTheme === "dark") {
      root.style.setProperty("--toast-bg", "#374151");
      root.style.setProperty("--toast-color", "#f9fafb");
      setIsDark(true);
    } else {
      root.style.setProperty("--toast-bg", "#ffffff");
      root.style.setProperty("--toast-color", "#111827");
      setIsDark(false);
    }
  }, []);

  // Function to change theme
  const changeTheme = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem("venus-ai-theme", newTheme);
    // Don't call applyTheme here - let the useEffect handle it
  };

  // Function to toggle between light and dark (skips system)
  const toggleTheme = () => {
    const newTheme = isDark ? "light" : "dark";
    changeTheme(newTheme);
  };

  // Apply theme when it changes and on mount
  useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      if (theme === "system") {
        applyTheme("system");
      }
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme, applyTheme]);

  const value = {
    theme,
    isDark,
    changeTheme,
    toggleTheme,
    themes: [
      { value: "light", label: "Light", icon: "☀️" },
      { value: "dark", label: "Dark", icon: "🌙" },
      { value: "system", label: "System", icon: "💻" },
    ],
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
