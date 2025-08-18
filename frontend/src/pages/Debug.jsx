import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const Debug = () => {
  const { user, isAuthenticated, loading, token } = useAuth();

  const clearLocalStorage = () => {
    localStorage.clear();
    window.location.reload();
  };

  const showLocalStorage = () => {
    const token = localStorage.getItem('token');
    console.log('Token in localStorage:', token);
    alert(`Token in localStorage: ${token || 'No token found'}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          Debug Page
        </h1>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Authentication State
          </h2>
          <div className="space-y-2 text-sm">
            <p><strong>Is Authenticated:</strong> {isAuthenticated ? 'Yes' : 'No'}</p>
            <p><strong>Loading:</strong> {loading ? 'Yes' : 'No'}</p>
            <p><strong>User:</strong> {user ? JSON.stringify(user, null, 2) : 'No user'}</p>
            <p><strong>Token:</strong> {token ? 'Token exists' : 'No token'}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Actions
          </h2>
          <div className="space-y-4">
            <button
              onClick={showLocalStorage}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
            >
              Show localStorage Token
            </button>
            <button
              onClick={clearLocalStorage}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md ml-4"
            >
              Clear localStorage & Reload
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Debug;
