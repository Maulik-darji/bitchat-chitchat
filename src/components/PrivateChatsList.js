import React, { useState, useEffect } from 'react';
import firebaseService from '../lib/firebase';

const PrivateChatsList = ({ username, onChatSelect }) => {
  const [removingUsers, setRemovingUsers] = useState(new Set());
  const [hoveredChat, setHoveredChat] = useState(null);
  const [privateChats, setPrivateChats] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let unsubscribe = () => {};

    const setupListener = async () => {
      try {
        console.log('Setting up private chats listener for:', username);
        unsubscribe = firebaseService.onUserPrivateChatsUpdate(username, (chats) => {
          console.log('PrivateChatsList received chats:', chats);
          console.log('Chats data structure:', chats.map(chat => ({
            id: chat.id,
            participants: chat.participants,
            hasParticipants: !!chat.participants,
            participantsType: typeof chat.participants,
            isArray: Array.isArray(chat.participants)
          })));
          setPrivateChats(chats);
          setIsLoading(false);
        });
      } catch (error) {
        console.error('Error setting up private chats listener:', error);
        setIsLoading(false);
      }
    };

    setupListener();

    return () => {
      try {
        unsubscribe();
      } catch (error) {
        console.error('Error cleaning up private chats listener:', error);
      }
    };
  }, [username]);

  const getOtherUsername = (chat) => {
    if (!chat.participants || !Array.isArray(chat.participants)) {
      console.warn('Invalid chat data:', chat);
      return null;
    }
    
    // Filter out the current user and get the other participant
    const otherParticipants = chat.participants.filter(participant => participant !== username);
    
    if (otherParticipants.length === 0) {
      console.warn('No other participants found in chat:', chat);
      return null;
    }
    
    if (otherParticipants.length > 1) {
      console.warn('Multiple other participants found in chat (unexpected):', chat);
      return null;
    }
    
    return otherParticipants[0];
  };

  const formatLastMessageTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const handleRemoveUser = async (chatId, otherUsername, e) => {
    e.stopPropagation(); // Prevent triggering the chat selection
    
    if (!window.confirm(`Are you sure you want to remove ${otherUsername} from this chat?`)) {
      return;
    }

    setRemovingUsers(prev => new Set(prev).add(otherUsername));
    
    try {
      await firebaseService.removeUserFromPrivateChat(chatId, otherUsername);
      console.log(`Successfully removed ${otherUsername} from chat`);
    } catch (error) {
      console.error('Error removing user from chat:', error);
      alert(`Failed to remove ${otherUsername} from chat: ${error.message}`);
    } finally {
      setRemovingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(otherUsername);
        return newSet;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-700/50 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-700/30 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (privateChats.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-purple-400/90 font-semibold text-sm flex items-center">
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        Direct Message (DM)
      </h3>
      <div className="space-y-1">
        {privateChats
          .filter(chat => {
            // Pre-filter chats to ensure they have valid data
            if (!chat.participants || !Array.isArray(chat.participants) || chat.participants.length < 2) {
              return false; // Skip invalid chats
            }
            return true;
          })
          .map((chat) => {
          const otherUsername = getOtherUsername(chat);
          
          // Skip rendering if we can't get the other username
          if (!otherUsername) {
            return null; // This should not happen due to pre-filtering, but safety check
          }
          
          return (
            <div
              key={chat.id}
              className="w-full flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-700/30 transition-all duration-200 group"
              onMouseEnter={() => setHoveredChat(chat.id)}
              onMouseLeave={() => setHoveredChat(null)}
            >
              <button
                onClick={() => {
                  if (otherUsername && onChatSelect) {
                    onChatSelect(otherUsername);
                  } else {
                    console.warn('Cannot select chat - missing username or callback:', { otherUsername, hasCallback: !!onChatSelect });
                  }
                }}
                className="flex items-center space-x-2 flex-1 text-left"
              >
                <div className="w-8 h-8 bg-purple-600/20 border border-purple-500/30 rounded-full flex items-center justify-center">
                  <span className="text-purple-400 font-bold text-sm">
                    {otherUsername.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white/90 font-medium text-sm truncate">{otherUsername}</p>
                  <p className="text-gray-400/70 text-xs truncate">
                    {chat.lastMessageAt ? formatLastMessageTime(chat.lastMessageAt) : 'No messages yet'}
                  </p>
                </div>
              </button>
              
              {/* Remove User Button - Only visible on hover */}
              {hoveredChat === chat.id && (
                <button
                  onClick={(e) => handleRemoveUser(chat.id, otherUsername, e)}
                  disabled={removingUsers.has(otherUsername)}
                  className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={`Remove ${otherUsername} from chat`}
                >
                  {removingUsers.has(otherUsername) ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PrivateChatsList;
