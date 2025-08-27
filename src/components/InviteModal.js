import React, { useState, useEffect } from 'react';
import firebaseService from '../lib/firebase';

const InviteModal = ({ username, onClose, onInviteSent }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const searchUsers = async () => {
      if (searchTerm.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      setError('');
      
      try {
        const users = await firebaseService.searchUsers(searchTerm, username);
        setSearchResults(users);
      } catch (error) {
        console.error('Error searching users:', error);
        setError('Failed to search users');
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, username]);

  const handleSendInvite = async (targetUsername) => {
    setIsSending(true);
    setError('');
    
    try {
      await firebaseService.sendPrivateChatInvite(username, targetUsername);
      onInviteSent(targetUsername);
      onClose();
    } catch (error) {
      console.error('Error sending invite:', error);
      setError(error.message || 'Failed to send invite');
    } finally {
      setIsSending(false);
    }
  };

  const handleUserSelect = (user) => {
    setSelectedUser(user);
    setSearchTerm(user.username);
    setSearchResults([]);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800/95 backdrop-blur-md border border-gray-700/50 rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white/90">Invite User for Private Chat</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Search Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Search by username
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Type @username..."
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white/90 placeholder-gray-400/70 focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all duration-200"
                autoFocus
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <svg className="animate-spin w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-600/20 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="bg-gray-700/30 border border-gray-600/30 rounded-lg max-h-48 overflow-y-auto">
              {searchResults.map((user) => (
                <button
                  key={user.username}
                  onClick={() => handleUserSelect(user)}
                  className="w-full flex items-center space-x-3 p-3 hover:bg-gray-600/30 transition-all duration-200 text-left"
                >
                  <div className="w-8 h-8 bg-gray-600/20 border border-gray-500/30 rounded-full flex items-center justify-center">
                    <span className="text-gray-300 font-bold text-sm">
                      {user.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-white/90 font-medium">{user.username}</p>
                    <p className="text-gray-400/70 text-xs">
                      {user.isOnline ? 'Online' : 'Offline'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Selected User */}
          {selectedUser && (
            <div className="bg-green-600/20 border border-green-500/30 rounded-lg p-4">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-green-600/20 border border-green-500/30 rounded-full flex items-center justify-center">
                  <span className="text-green-400 font-bold text-lg">
                    {selectedUser.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-white/90 font-semibold">{selectedUser.username}</p>
                  <p className="text-green-400/70 text-sm">
                    {selectedUser.isOnline ? 'Online' : 'Offline'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleSendInvite(selectedUser.username)}
                disabled={isSending}
                className="w-full bg-green-600/20 hover:bg-green-600/30 text-green-400 hover:text-green-300 py-2 px-4 rounded-lg transition-all duration-200 border border-green-500/30 hover:border-green-500/50 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {isSending ? (
                  <div className="flex items-center justify-center space-x-2">
                    <svg className="animate-spin w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Sending Invite...</span>
                  </div>
                ) : (
                  'Send Invite'
                )}
              </button>
            </div>
          )}

          {/* No Results */}
          {searchTerm.length >= 2 && searchResults.length === 0 && !isSearching && (
            <div className="text-center text-gray-400 py-4">
              <p>No users found matching "{searchTerm}"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InviteModal;
