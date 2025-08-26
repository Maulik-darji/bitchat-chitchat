import React, { useState } from 'react';

const Sidebar = ({ currentView, onViewChange, username, onLogout, isLoggingOut, onEditUsername }) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const menuItems = [
    { 
      id: 'home', 
      label: 'Home', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    },
    { 
      id: 'join-room', 
      label: 'Join Private Room', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      )
    },
    { 
      id: 'create-room', 
      label: 'Create Private Room', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      )
    }
  ];

  const handleLogoutClick = () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete your account and logout?\n\nThis action will:\n• Permanently delete your account\n• Remove all your messages\n• Delete all your private rooms\n• Remove you from all rooms\n\nThis action cannot be undone.'
    );
    
    if (confirmed) {
      onLogout();
    }
  };

  const handleEditUsername = async () => {
    if (!newUsername.trim() || newUsername.trim() === username) {
      setShowEditModal(false);
      setNewUsername('');
      return;
    }

    setIsSaving(true);
    try {
      await onEditUsername(newUsername.trim());
      setShowEditModal(false);
      setNewUsername('');
    } catch (error) {
      alert('Failed to update username. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full h-screen bg-gray-900/95 backdrop-blur-md border-r border-gray-800/50 flex flex-col flex-shrink-0 shadow-lg">
      {/* Header */}
      <div className="p-4 lg:p-6 border-b border-gray-800/50 flex-shrink-0 rounded-b-2xl">
        <h1 className="text-2xl lg:text-3xl font-extrabold text-white/95 mb-2 lg:mb-3 tracking-tight">Sipher</h1>
        <p className="text-gray-400/80 text-sm lg:text-base font-medium">Private & Secure Messaging</p>
      </div>

      {/* Navigation Menu */}
      <div className="flex-1 p-3 lg:p-4 space-y-2 min-h-0 overflow-y-auto rounded-xl scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`w-full flex items-center space-x-2 lg:space-x-3 px-3 lg:px-4 py-2 lg:py-3 rounded-full transition-all duration-200 text-left ${
              currentView === item.id
                ? 'bg-gray-600/20 text-gray-300 border border-gray-500/30'
                : 'text-gray-300 hover:bg-gray-800/50 hover:text-white/90'
            }`}
          >
            <div className="flex-shrink-0">{item.icon}</div>
            <span className="font-semibold text-sm lg:text-base">{item.label}</span>
          </button>
        ))}
      </div>

      {/* User Profile Section */}
      <div className="p-3 lg:p-4 border-t border-gray-800/50 flex-shrink-0 rounded-t-2xl min-h-0">
        <div className="flex items-center space-x-2 lg:space-x-3 mb-3 lg:mb-4">
          <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gray-600/20 border border-gray-500/30 rounded-full flex items-center justify-center">
            <span className="text-gray-300 font-bold text-lg lg:text-xl">
              {username.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-white/95 font-semibold text-sm lg:text-base truncate">{username}</p>
            <p className="text-green-400/90 text-xs lg:text-sm font-medium">Online</p>
          </div>
          <button
            onClick={() => setShowEditModal(true)}
            className="text-gray-400/70 hover:text-white/90 p-1 rounded transition-all duration-200"
            title="Edit username"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>

        {/* Edit Username Modal */}
        {showEditModal && (
          <div className="bg-gray-800/90 backdrop-blur-sm rounded-2xl p-3 lg:p-4 border border-gray-700/50 mb-3 lg:mb-4">
            <h3 className="text-white/90 font-medium mb-2 lg:mb-3 text-sm lg:text-base">Edit Username</h3>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="Enter new username"
              className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white/90 placeholder-gray-400/70 focus:ring-2 focus:ring-gray-500/50 focus:border-gray-500/50 transition-all duration-200 mb-2 lg:mb-3 text-sm lg:text-base"
              autoFocus
            />
            <div className="flex space-x-2">
              <button
                onClick={handleEditUsername}
                disabled={isSaving}
                className="bg-gray-600/20 hover:bg-gray-600/30 text-gray-300 hover:text-gray-200 px-2 lg:px-3 py-1 lg:py-1.5 rounded-lg text-xs lg:text-sm transition-all duration-200 border border-gray-500/30 hover:border-gray-500/50 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setNewUsername('');
                }}
                className="bg-gray-600/20 hover:bg-gray-600/30 text-gray-400 hover:text-gray-300 px-2 lg:px-3 py-1 lg:py-1.5 rounded-lg text-xs lg:text-sm transition-all duration-200 border border-gray-500/30 hover:border-gray-500/50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Logout Button */}
        <button
          onClick={handleLogoutClick}
          disabled={isLoggingOut}
          className="w-full bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 py-3 px-4 rounded-full transition-all duration-200 border border-red-500/30 hover:border-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm lg:text-base shadow-lg hover:shadow-xl"
        >
          {isLoggingOut ? (
            <div className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 lg:mr-3 h-3 w-3 lg:h-4 lg:w-4 text-red-400" xmlns="http://http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-xs lg:text-sm">Deleting Account...</span>
            </div>
          ) : (
            <span className="whitespace-nowrap">Delete Account & Logout</span>
          )}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
