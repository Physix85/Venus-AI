import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import LoadingSpinner from "../components/LoadingSpinner";
import {
  UserIcon,
  EnvelopeIcon,
  CalendarIcon,
} from "@heroicons/react/24/outline";

const Profile = () => {
  const { user, updateProfile, loading } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    preferences: {
      theme: user?.preferences?.theme || "system",
      language: user?.preferences?.language || "en",
      notifications: {
        email: user?.preferences?.notifications?.email || true,
        push: user?.preferences?.notifications?.push || true,
      },
    },
  });

  const handleChange = (e) => {
    const { name, value, checked } = e.target;

    if (name.includes(".")) {
      const [parent, child] = name.split(".");
      if (parent === "notifications") {
        setFormData((prev) => ({
          ...prev,
          preferences: {
            ...prev.preferences,
            notifications: {
              ...prev.preferences.notifications,
              [child]: checked,
            },
          },
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          preferences: {
            ...prev.preferences,
            [child]: value,
          },
        }));
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await updateProfile(formData);
    if (result.success) {
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      preferences: {
        theme: user?.preferences?.theme || "system",
        language: user?.preferences?.language || "en",
        notifications: {
          email: user?.preferences?.notifications?.email || true,
          push: user?.preferences?.notifications?.push || true,
        },
      },
    });
    setIsEditing(false);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Profile
            </h1>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="btn-primary"
              >
                Edit Profile
              </button>
            )}
          </div>
        </div>

        {/* Profile Content */}
        <div className="px-6 py-6">
          {!isEditing ? (
            // View Mode
            <div className="space-y-6">
              {/* Avatar and Basic Info */}
              <div className="flex items-center space-x-6">
                <div className="w-24 h-24 bg-primary-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-2xl font-bold">
                    {user.firstName?.charAt(0)}
                    {user.lastName?.charAt(0)}
                  </span>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {user.firstName} {user.lastName}
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400">
                    @{user.username}
                  </p>
                  <p className="text-gray-500 dark:text-gray-400">
                    {user.email}
                  </p>
                </div>
              </div>

              {/* Account Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Account Information
                  </h3>

                  <div className="flex items-center space-x-3">
                    <UserIcon className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Full Name
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {user.firstName} {user.lastName}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <EnvelopeIcon className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Email
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {user.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <CalendarIcon className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Member Since
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Preferences
                  </h3>

                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Theme
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                      {user.preferences?.theme || "System"}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Language
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {user.preferences?.language === "en"
                        ? "English"
                        : user.preferences?.language}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Notifications
                    </p>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      <p>
                        Email:{" "}
                        {user.preferences?.notifications?.email
                          ? "Enabled"
                          : "Disabled"}
                      </p>
                      <p>
                        Push:{" "}
                        {user.preferences?.notifications?.push
                          ? "Enabled"
                          : "Disabled"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Edit Mode
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label
                    htmlFor="firstName"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    First Name
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="lastName"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Last Name
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="theme"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Theme
                  </label>
                  <select
                    id="theme"
                    name="preferences.theme"
                    value={formData.preferences.theme}
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="system">System</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="language"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Language
                  </label>
                  <select
                    id="language"
                    name="preferences.language"
                    value={formData.preferences.language}
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="en">English</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Notification Preferences
                </h3>

                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="notifications.email"
                      checked={formData.preferences.notifications.email}
                      onChange={handleChange}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      Email notifications
                    </span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="notifications.push"
                      checked={formData.preferences.notifications.push}
                      onChange={handleChange}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      Push notifications
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                >
                  {loading ? (
                    <LoadingSpinner size="sm" color="white" />
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
