import React, { useState } from 'react';
import InviteModal from './InviteModal';
import InvitesSection from './InvitesSection';
import PrivateChatsList from './PrivateChatsList';
import MyPrivateRooms from './MyPrivateRooms';
import JoinedRooms from './JoinedRooms';

const Sidebar = ({ currentView, onViewChange, username, onLogout, isLoggingOut, onEditUsername, onInviteAccepted, onRoomSelect, sidebarWidth = 256 }) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Helper function to create responsive icons
  const createResponsiveIcon = (svgPath) => (
    <svg className={`${
      sidebarWidth < 280 ? 'w-4 h-4' : sidebarWidth < 320 ? 'w-4.5 h-4.5' : 'w-5 h-5'
    }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {svgPath}
    </svg>
  );

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
    },
    { 
      id: 'invite-user', 
      label: 'Invite User for Private Chat', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
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

  const handleInviteClick = () => {
    setShowInviteModal(true);
  };

  const handleInviteSent = (targetUsername) => {
    // You can add a success notification here if needed
    console.log(`Invite sent to ${targetUsername}`);
  };

  return (
    <div className="w-full h-screen flex flex-col flex-shrink-0">
      {/* Header */}
      <div className={`border-b border-gray-800/50 flex-shrink-0 rounded-b-2xl ${
        sidebarWidth < 280 ? 'p-3' : sidebarWidth < 320 ? 'p-3.5' : 'p-4 lg:p-6'
      }`}>
        <div className="flex items-center justify-center mb-2 relative">
          {/* Logo */}
          <img 
            src="/android-chrome-512x512.png" 
            alt="Basicaly Logo" 
            className={`${
              sidebarWidth < 280 ? 'w-8 h-8' : sidebarWidth < 320 ? 'w-10 h-10' : 'w-12 h-12 lg:w-16 lg:h-16'
            } mr-2 rounded-full`}
          />
          <h1 className={`font-extrabold text-white/95 tracking-tight ${
            sidebarWidth < 280 ? 'text-xl' : sidebarWidth < 320 ? 'text-2xl' : 'text-2xl lg:text-3xl'
          }`}>Basicaly</h1>
          {/* Close Button - Mobile Only */}
          <button
            onClick={() => onViewChange('home')}
            className="lg:hidden absolute right-0 text-gray-400 hover:text-white transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className={`text-gray-400/80 font-medium ${
          sidebarWidth < 280 ? 'text-xs' : sidebarWidth < 320 ? 'text-sm' : 'text-sm lg:text-base'
        }`}>Messaging Without Boundaries.</p>
      </div>

      {/* Navigation Menu */}
      <div className={`flex-1 space-y-2 min-h-0 overflow-y-auto rounded-xl scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent ${
        sidebarWidth < 280 ? 'p-2' : sidebarWidth < 320 ? 'p-2.5' : 'p-3 lg:p-4'
      }`}>
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              if (item.id === 'invite-user') {
                handleInviteClick();
              } else {
                onViewChange(item.id);
              }
            }}
            className={`w-full flex items-center rounded-full transition-all duration-200 text-left ${
              currentView === item.id
                ? 'bg-gray-600/20 text-gray-300 border border-gray-500/30'
                : 'text-gray-300 hover:bg-gray-800/50 hover:text-white/90'
            } ${
              sidebarWidth < 280 ? 'space-x-1.5 px-2 py-1.5' : sidebarWidth < 320 ? 'space-x-2 px-2.5 py-2' : 'space-x-2 lg:space-x-3 px-3 lg:px-4 py-2 lg:py-3'
            }`}
          >
            <div className="flex-shrink-0">{item.icon}</div>
            <span className={`font-semibold ${
              sidebarWidth < 280 ? 'text-xs' : sidebarWidth < 320 ? 'text-sm' : 'text-sm lg:text-base'
            }`}>{item.label}</span>
          </button>
        ))}

        {/* Invites Section */}
        <InvitesSection 
          username={username} 
          onInviteAccepted={onInviteAccepted}
        />

        {/* Joined Rooms */}
        <JoinedRooms
          username={username}
          onRoomSelect={onRoomSelect}
          onViewChange={onViewChange}
        />

        {/* My Private Rooms */}
        <MyPrivateRooms
          username={username}
          onRoomSelect={onRoomSelect}
          sidebarWidth={sidebarWidth}
        />

        {/* Private Chats List */}
        <PrivateChatsList
          username={username}
          onChatSelect={(otherUsername) => {
            // This will be handled by the parent component
            onInviteAccepted(otherUsername);
          }}
        />
      </div>

      {/* User Profile Section */}
      <div className={`border-t border-gray-800/50 flex-shrink-0 rounded-t-2xl min-h-0 ${
        sidebarWidth < 280 ? 'p-2' : sidebarWidth < 320 ? 'p-2.5' : 'p-3 lg:p-4'
      }`}>
        <div className={`flex items-center space-x-2 mb-3 ${
          sidebarWidth < 280 ? 'space-x-2 mb-2' : sidebarWidth < 320 ? 'space-x-2.5 mb-3' : 'lg:space-x-3 lg:mb-4'
        }`}>
          <div className={`bg-gray-600/20 border border-gray-500/30 rounded-full flex items-center justify-center ${
            sidebarWidth < 280 ? 'w-8 h-8' : sidebarWidth < 320 ? 'w-9 h-9' : 'w-10 h-10 lg:w-12 lg:h-12'
          }`}>
            <span className={`text-gray-300 font-bold ${
              sidebarWidth < 280 ? 'text-sm' : sidebarWidth < 320 ? 'text-base' : 'text-lg lg:text-xl'
            }`}>
              {username.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className={`text-white/95 font-semibold truncate ${
              sidebarWidth < 280 ? 'text-xs' : sidebarWidth < 320 ? 'text-sm' : 'text-sm lg:text-base'
            }`}>{username}</p>
            <p className={`text-green-400/90 font-medium ${
              sidebarWidth < 280 ? 'text-xs' : sidebarWidth < 320 ? 'text-xs' : 'text-xs lg:text-sm'
            }`}>Online</p>
          </div>
          <button
            onClick={() => setShowEditModal(true)}
            className="text-gray-400/70 hover:text-white/90 p-1 rounded transition-all duration-200"
            title="Edit username"
          >
            <svg className={`${
              sidebarWidth < 280 ? 'w-3 h-3' : sidebarWidth < 320 ? 'w-3.5 h-3.5' : 'w-4 h-4'
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>

        {/* Edit Username Modal */}
        {showEditModal && (
          <div className={`bg-gray-800/90 backdrop-blur-sm rounded-2xl border border-gray-700/50 mb-3 ${
            sidebarWidth < 280 ? 'p-2 mb-2' : sidebarWidth < 320 ? 'p-2.5 mb-3' : 'lg:p-4 lg:mb-4'
          }`}>
            <h3 className={`text-white/90 font-medium mb-2 ${
              sidebarWidth < 280 ? 'text-xs mb-1.5' : sidebarWidth < 320 ? 'text-sm mb-2' : 'lg:text-base lg:mb-3'
            }`}>Edit Username</h3>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="Enter new username"
              className={`w-full bg-gray-700/50 border border-gray-600/50 rounded-lg text-white/90 placeholder-gray-400/70 focus:ring-2 focus:ring-gray-500/50 focus:border-gray-500/50 transition-all duration-200 mb-2 ${
                sidebarWidth < 280 ? 'px-2 py-1.5 text-xs mb-1.5' : sidebarWidth < 320 ? 'px-2.5 py-2 text-sm mb-2' : 'px-3 py-2 lg:mb-3 text-sm lg:text-base'
              }`}
              autoFocus
            />
            <div className="flex space-x-2">
              <button
                onClick={handleEditUsername}
                disabled={isSaving}
                className={`bg-gray-600/20 hover:bg-gray-600/30 text-gray-300 hover:text-gray-200 rounded-lg transition-all duration-200 border border-gray-500/30 hover:border-gray-500/50 disabled:opacity-50 ${
                  sidebarWidth < 280 ? 'px-1.5 py-1 text-xs' : sidebarWidth < 320 ? 'px-2 py-1 text-xs' : 'px-2 lg:px-3 py-1 lg:py-1.5 text-xs lg:text-sm'
                }`}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setNewUsername('');
                }}
                className={`bg-gray-600/20 hover:bg-gray-600/30 text-gray-400 hover:text-gray-300 rounded-lg transition-all duration-200 border border-gray-500/30 hover:border-gray-500/50 ${
                  sidebarWidth < 280 ? 'px-1.5 py-1 text-xs' : sidebarWidth < 320 ? 'px-2 py-1 text-xs' : 'px-2 lg:px-3 py-1 lg:py-1.5 text-xs lg:text-sm'
                }`}
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
          className={`w-full bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 rounded-full transition-all duration-200 border border-red-500/30 hover:border-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg hover:shadow-xl ${
            sidebarWidth < 280 
              ? 'py-2 px-3 text-xs' 
              : sidebarWidth < 320 
                ? 'py-2.5 px-3.5 text-sm' 
                : 'py-3 px-4 text-sm lg:text-base'
          }`}
        >
          {isLoggingOut ? (
            <div className="flex items-center justify-center">
              <svg className={`animate-spin -ml-1 mr-2 text-red-400 ${
                sidebarWidth < 280 ? 'h-3 w-3' : sidebarWidth < 320 ? 'h-3 w-3' : 'h-3 w-3 lg:h-4 lg:w-4'
              }`} xmlns="http://http.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className={`${
                sidebarWidth < 280 ? 'text-xs' : sidebarWidth < 320 ? 'text-xs' : 'text-xs lg:text-sm'
              }`}>Deleting Account...</span>
            </div>
          ) : (
            <span className={`whitespace-nowrap ${
              sidebarWidth < 280 ? 'text-xs' : sidebarWidth < 320 ? 'text-sm' : 'text-sm lg:text-base'
            }`}>Delete Account & Logout</span>
          )}
        </button>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteModal
          username={username}
          onClose={() => setShowInviteModal(false)}
          onInviteSent={handleInviteSent}
        />
      )}
    </div>
  );
};

export default Sidebar;
