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
  const [isSending, setIsSending] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState('');
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy room code:', error);
    }
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

  // Private rooms don't need spam protection - always allow messages
  // No spam protection needed for private rooms

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setIsSending(true);

    try {
      // Create optimistic message (like public chat)
      const optimisticMessage = {
        id: `temp_${Date.now()}`,
        roomId: room.roomId,
        username,
        message: messageText,
        timestamp: new Date(),
        isOptimistic: true
      };

      // Add to local state immediately (like public chat)
      setMessages(prev => [...prev, optimisticMessage]);

      // Send to Firebase
      await firebaseService.sendRoomMessage(room.roomId, username, messageText);

      // Remove optimistic message and let Firebase update handle the real message
      setMessages(prev => prev.filter(msg => !msg.isOptimistic));
      
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => !msg.isOptimistic));
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

  const handleRemoveUser = async (userId, username) => {
    if (!window.confirm(`Are you sure you want to remove ${username} from this room?`)) {
      return;
    }
    
    try {
      await firebaseService.removeUserFromRoom(room.roomId, userId);
      setShowUserMenu(null);
    } catch (error) {
      console.error('Error removing user:', error);
      alert(`Failed to remove ${username} from room: ${error.message}`);
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
          <div className="mb-4 text-left">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-white/90 mb-1 text-left">{room.roomName}</h2>
              <p className="text-gray-400/70 text-sm mb-2 text-left">Private Room</p>
              <div className="flex items-center space-x-2">
                <p className="text-gray-400/70 text-xs text-left">Room Code: <span className="text-yellow-400 font-mono">{room.roomId}</span></p>
                <button
                  onClick={handleCopyCode}
                  className="text-gray-400/70 hover:text-yellow-400 transition-colors duration-200 p-1 rounded"
                  title="Copy room code"
                >
                  {copied ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-gray-700/30">
            <span className="text-gray-400/70 text-sm font-medium">{roomUsers.length} members</span>
            <button
              onClick={onLeaveRoom}
              className="text-red-400/70 hover:text-red-300 text-sm font-medium transition-all duration-200 px-3 py-1.5 rounded-lg hover:bg-red-900/20"
            >
              Leave Room
            </button>
          </div>
        </div>

        {/* Users List - Fixed height, scrollable if needed */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          <h3 className="text-sm font-medium text-gray-400/70 mb-4 uppercase tracking-wide border-b border-gray-700/30 pb-2">Members</h3>
          <div className="space-y-3">
            {roomUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-700/30 transition-all duration-200 group">
                <div className="flex items-center justify-start flex-1 min-w-0">
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-white/90 font-medium text-sm truncate">{user.username}</p>
                    <p className="text-gray-400/70 text-xs">Online</p>
                  </div>
                </div>
                {isCreator && user.username !== username && (
                  <button
                    onClick={() => handleRemoveUser(user.id, user.username)}
                    className="text-gray-400/70 hover:text-red-400 hover:bg-red-900/20 p-2 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100 flex-shrink-0"
                    title={`Remove ${user.username} from room`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chat Area - Fixed position */}
      <div className="flex-1 flex flex-col min-h-0">

        
        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          {messages.length === 0 ? (
            <div className="text-center text-gray-400/70 py-16">
              <p className="text-xl font-medium mb-2">No messages yet</p>
              <p className="text-sm text-gray-500/70">Start your private room conversation!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${isCurrentUser(message.username) ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs lg:max-w-md ${isCurrentUser(message.username) ? 'text-right' : 'text-left'}`}>
                    {/* Message bubble */}
                    <div className={`relative group ${isCurrentUser(message.username) ? 'ml-auto' : 'mr-auto'}`}>
                      <div className={`
                        ${isCurrentUser(message.username) 
                          ? 'bg-green-600/20 border-green-500/30 text-white/90' 
                          : 'bg-gray-800/40 border-gray-700/30 text-white/90'
                        } 
                        backdrop-blur-sm rounded-2xl px-4 py-2.5 border break-words inline-block max-w-full
                      `}>
                        <p className="text-sm leading-relaxed mb-2">
                          {message.message}
                        </p>
                        
                        {/* Timestamp inside message bubble */}
                        <div className={`flex items-center justify-end ${isCurrentUser(message.username) ? 'text-green-200/70' : 'text-gray-400/70'}`}>
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
                              className="bg-gray-700/80 hover:bg-gray-600/80 text-gray-300 hover:text-white p-2 rounded-full border border-gray-600/50 hover:border-gray-500/50 transition-all duration-200 shadow-lg"
                              title="Edit message"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            </div>
          )}
        </div>

        {/* Message Input - Fixed position */}
        <div className="bg-gray-800/60 backdrop-blur-sm border-t border-gray-700/50 p-4 lg:p-6 flex-shrink-0">
          <form onSubmit={handleSendMessage} className="flex items-center space-x-4">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 px-4 py-3 rounded-xl text-sm lg:text-base transition-all duration-150 bg-gray-700/50 border border-gray-600/50 text-white/90 placeholder-gray-400/70 focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 focus:outline-none"
              disabled={isSending}
              autoFocus
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || isSending}
              className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 text-sm lg:text-base flex items-center justify-center min-w-[80px] ${
                newMessage.trim() && !isSending
                  ? 'bg-green-600/20 hover:bg-green-600/30 text-green-400 hover:text-green-300 border border-green-500/30 hover:border-green-500/50 shadow-lg hover:shadow-green-500/10'
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
              ) : 'Send'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PrivateRoom;
