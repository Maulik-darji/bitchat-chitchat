import React, { useState, useEffect, useRef } from 'react';
import firebaseService from '../lib/firebase';

const PrivateRoom = (props) => {
  const { username, onLeaveRoom } = props;
  const room = props.room || { roomId: props.roomId, roomName: props.roomName, creator: props.creator };
  const [messages, setMessages] = useState([]);
  const [roomUsers, setRoomUsers] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(null);
  const [isCreator, setIsCreator] = useState(false);
  const [spamStatus, setSpamStatus] = useState({ allowed: true, remaining: 'unlimited', cooldown: 0, isRapidMode: false });
  const [spamError, setSpamError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    setIsCreator(room?.creator === username);
  }, [room, username]);

  useEffect(() => {
    if (!room?.roomId) return;
    const unsubscribeMessages = firebaseService.onRoomMessagesUpdate(room.roomId, (messageList) => {
      setMessages(messageList);
    });

    const unsubscribeUsers = firebaseService.onRoomUsersUpdate(room.roomId, (userList) => {
      setRoomUsers(userList);
    });

    return () => {
      unsubscribeMessages && unsubscribeMessages();
      unsubscribeUsers && unsubscribeUsers();
    };
  }, [room?.roomId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Add a more robust scroll mechanism for new messages
  useEffect(() => {
    if (messages.length > 0) {
      // Small delay to ensure DOM is updated
      const timer = setTimeout(() => {
        scrollToBottom();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages.length]);

  // Update spam status periodically
  useEffect(() => {
    const updateSpamStatus = () => {
      const status = firebaseService.getSpamStatus(username);
      setSpamStatus(status);
      
      // Clear spam error if user is no longer blocked
      if (status.allowed && spamError) {
        setSpamError('');
      }
    };

    // Update immediately
    updateSpamStatus();
    
    // Update every second to show countdown
    const interval = setInterval(updateSpamStatus, 1000);
    
    return () => clearInterval(interval);
  }, [username, spamError]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setIsSending(true);

    try {
      // Create optimistic message
      const optimisticMessage = {
        id: `temp_${Date.now()}`,
        roomId: room.roomId,
        username,
        message: messageText,
        timestamp: new Date(),
        isOptimistic: true
      };

      // Add message to UI immediately
      setMessages(prev => [...prev, optimisticMessage]);
      
      // Send to Firebase
      await firebaseService.sendRoomMessage(room.roomId, username, messageText);
      setSpamError('');
      
      // Remove optimistic message (Firebase listener will add the real one)
      setMessages(prev => prev.filter(msg => !msg.isOptimistic));
      
    } catch (error) {
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => !msg.isOptimistic));
      
      if (error.message.includes('Spam protection:')) {
        setSpamError(error.message);
      } else {
        // Silent fail for other errors
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleEditMessage = async (messageId, newText) => {
    if (!newText.trim()) return;

    try {
      await firebaseService.editRoomMessage(room.roomId, messageId, newText.trim());
      setEditingMessage(null);
      setEditText('');
    } catch (error) {
      // Silent fail for privacy
    }
  };

  const handleRemoveUser = async (userId) => {
    try {
      await firebaseService.removeUserFromRoom(room.roomId, userId);
      setShowUserMenu(null);
    } catch (error) {
      // Silent fail for privacy
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isCurrentUser = (messageUsername) => messageUsername === username;

  return (
    <div className="flex h-screen lg:h-full bg-gray-900/50">
      {/* Users Sidebar - Fixed position */}
      <div className="w-64 bg-gray-800/60 backdrop-blur-sm border-r border-gray-700/50 flex flex-col flex-shrink-0">
        {/* Room Header */}
        <div className="p-4 lg:p-6 border-b border-gray-700/50 flex-shrink-0">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-8 h-8 bg-green-600/20 border border-green-500/30 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white/90">{room.roomName}</h2>
              <p className="text-gray-400/70 text-sm">Private Room</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400/70 text-sm">{roomUsers.length} members</span>
            <button
              onClick={onLeaveRoom}
              className="text-red-400/70 hover:text-red-300 text-sm font-medium transition-all duration-200"
            >
              Leave Room
            </button>
          </div>
        </div>

        {/* Users List - Fixed height, scrollable if needed */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          <h3 className="text-sm font-medium text-gray-400/70 mb-3 uppercase tracking-wide">Members</h3>
          <div className="space-y-2">
            {roomUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-700/30 transition-all duration-200">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-600/20 border border-gray-500/30 rounded-full flex items-center justify-center">
                    <span className="text-gray-400 font-bold text-sm">
                      {user.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-white/90 font-medium text-sm">{user.username}</p>
                    <p className="text-gray-400/70 text-xs">Online</p>
                  </div>
                </div>
                {isCreator && user.username !== username && (
                  <div className="relative">
                    <button
                      onClick={() => setShowUserMenu(showUserMenu === user.id ? null : user.id)}
                      className="text-gray-400/70 hover:text-white/90 p-1 rounded transition-all duration-200"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                    {showUserMenu === user.id && (
                      <div className="absolute right-0 top-8 bg-gray-800/95 backdrop-blur-sm border border-gray-700/50 rounded-lg shadow-lg z-10 min-w-[120px]">
                        <button
                          onClick={() => handleRemoveUser(user.username)}
                          className="w-full text-left px-3 py-2 text-red-400/70 hover:text-red-300 hover:bg-red-600/20 text-sm transition-all duration-200"
                        >
                          Remove User
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chat Area - Fixed height, only messages scroll */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Chat Header - Fixed position */}
        <div className="bg-gray-800/60 backdrop-blur-sm border-b border-gray-700/50 p-4 lg:p-6 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-white/90">{room.roomName}</h1>
              <p className="text-gray-400/70 text-sm lg:text-base">Private conversation</p>
            </div>
            <div className="text-right">
              <p className="text-gray-400/70 text-sm">{roomUsers.length} members</p>
              <p className="text-gray-500/70 text-xs">Created by {room.creator}</p>
            </div>
          </div>
        </div>

        {/* Messages - Scrollable */}
        <div className="flex-1 overflow-y-auto p-2 lg:p-3 space-y-3 flex flex-col min-h-0">
          {messages.length === 0 ? (
            <div className="text-center text-gray-400/70 py-12">
              <div className="w-16 h-16 bg-gray-800/50 border border-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-500/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-lg font-medium">No messages yet</p>
              <p className="text-sm">Start the conversation in this private room!</p>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div key={message.id} className={`flex ${isCurrentUser(message.username) ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs lg:max-w-md ${isCurrentUser(message.username) ? 'text-right' : 'text-left'}`}>
                    {/* Username and timestamp - only show for other users */}
                    {!isCurrentUser(message.username) && (
                      <div className="mb-2 ml-2">
                        <span className="text-green-400/90 font-medium text-sm">
                          {message.username}
                        </span>
                        <span className="text-gray-500/70 text-xs ml-2">
                          {formatTime(message.timestamp)}
                        </span>
                      </div>
                    )}
                    
                    {/* Message bubble */}
                    <div className={`relative group ${isCurrentUser(message.username) ? 'ml-auto' : 'mr-auto'}`}>
                      <div className={`
                        ${isCurrentUser(message.username) 
                          ? 'bg-green-600/20 border-green-500/30 text-white/90' 
                          : 'bg-gray-800/40 border-gray-700/30 text-white/90'
                        } 
                        backdrop-blur-sm rounded-2xl px-2.5 py-1.5 border break-words inline-block
                      `}>
                        <p className="text-sm leading-relaxed mb-1">
                          {message.message}
                        </p>
                        
                        {/* Timestamp inside message bubble - WhatsApp style */}
                        <div className={`flex items-center justify-end space-x-2 ${isCurrentUser(message.username) ? 'text-green-200/70' : 'text-gray-400/70'}`}>
                          <span className="text-xs">
                            {formatTime(message.timestamp)}
                          </span>
                        </div>
                        
                        {/* Edit button for current user's messages */}
                        {isCurrentUser(message.username) && (
                          <div className="absolute -top-2 -left-2 opacity-0 group-hover:opacity-100 transition-all duration-200">
                            <button
                              onClick={() => {
                                setEditingMessage(message.id);
                                setEditText(message.message);
                              }}
                              className="bg-gray-700/80 hover:bg-gray-600/80 text-gray-300 hover:text-white p-1.5 rounded-full border border-gray-600/50 hover:border-gray-500/50 transition-all duration-200"
                              title="Edit message"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Message Input - Fixed position */}
        <div className="bg-gray-800/60 backdrop-blur-sm border-t border-gray-700/50 p-4 lg:p-6 flex-shrink-0">
          {/* Spam Protection Info */}
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="text-xs text-gray-400">
                  {spamStatus.allowed ? (
                    <span className="text-green-400">
                      {spamStatus.remaining} messages remaining
                    </span>
                  ) : (
                    <span className="text-red-400">
                      Cooldown: <span className="font-mono font-bold">{spamStatus.cooldown}s</span>
                    </span>
                  )}
                </span>
              </div>
              
              {/* Live Countdown Timer */}
              {!spamStatus.allowed && spamStatus.cooldown > 0 && (
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                  <span className="text-xs text-red-400 font-mono">
                    {spamStatus.cooldown}s
                  </span>
                </div>
              )}
            </div>
            
            {/* Spam Error Display */}
            {spamError && (
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs text-red-400 max-w-xs truncate" title={spamError}>
                  {spamError}
                </span>
              </div>
            )}
          </div>

          <form onSubmit={handleSendMessage} className="flex space-x-3">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={spamStatus.allowed ? "Type your message..." : "Please wait before sending more messages..."}
              className={`flex-1 px-4 py-3 rounded-lg text-sm lg:text-base transition-all duration-200 ${
                spamStatus.allowed 
                  ? 'bg-gray-700/50 border border-gray-600/50 text-white/90 placeholder-gray-400/70 focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50' 
                  : 'bg-gray-600/30 border border-gray-500/30 text-gray-500/70 placeholder-gray-500/50 cursor-not-allowed'
              }`}
              disabled={!spamStatus.allowed || isSending}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || !spamStatus.allowed || isSending}
              className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 text-sm lg:text-base ${
                spamStatus.allowed && newMessage.trim() && !isSending
                  ? 'bg-green-600/20 hover:bg-green-600/30 text-green-400 hover:text-green-300 border border-green-500/30 hover:border-green-500/50'
                  : 'bg-gray-600/20 text-gray-500 border border-gray-500/30 cursor-not-allowed'
              }`}
            >
              {isSending ? (
                <div className="flex items-center space-x-2">
                  <svg className="animate-spin w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Sending...</span>
                </div>
              ) : spamStatus.allowed ? 'Send' : 'Blocked'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PrivateRoom;
