import React, { useState, useEffect, useRef } from 'react';
import firebaseService from '../lib/firebase';
import ContentModeration from './ContentModeration';
import { isMessageClean } from '../lib/contentFilter';
import MessageStatus from './MessageStatus';

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
  const messagesUnsubRef = useRef(null);
  const usersUnsubRef = useRef(null);
  const wasMemberRef = useRef(null);
  const inputRef = useRef(null);
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [showContentModeration, setShowContentModeration] = useState(false);
  const [moderationMessage, setModerationMessage] = useState('');
  const isDesktop = typeof window !== 'undefined' && !(window.matchMedia && window.matchMedia('(pointer:coarse)').matches);
  const focusInput = () => {
    if (!isDesktop) return;
    if (typeof window !== 'undefined' && window.__modalOpen) return;
    const el = inputRef.current;
    if (!el) return;
    if (document.activeElement !== el) {
      try { el.focus({ preventScroll: true }); } catch (_) { el.focus(); }
    }
  };

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
    const determineCreator = async () => {
      try {
        const currentUid = await firebaseService.ensureUserUid?.();
        let roomDoc = room;
        // Fetch fresh room data to get createdBy/createdByUid if missing
        if (!roomDoc?.createdBy && !roomDoc?.createdByUid && room?.roomId) {
          try { roomDoc = await firebaseService.getRoom(room.roomId); } catch (_) {}
        }
        const norm = (v) => (v ?? '').toString().trim().toLowerCase();
        const owner = (
          norm(roomDoc?.createdBy) === norm(username) ||
          norm(roomDoc?.creator) === norm(username) ||
          (!!roomDoc?.createdByUid && currentUid && roomDoc.createdByUid === currentUid)
        );
        setIsCreator(!!owner);
      } catch (_) {
        setIsCreator(false);
      }
    };
    determineCreator();
  }, [room, username]);

  useEffect(() => {
    if (!room?.roomId) return;
    // Immediately clear state to avoid showing previous room's data
    setMessages([]);
    setRoomUsers([]);

    // Proactively unsubscribe any previous listeners before attaching new ones
    if (typeof messagesUnsubRef.current === 'function') {
      try { messagesUnsubRef.current(); } catch (_) {}
      messagesUnsubRef.current = null;
    }
    if (typeof usersUnsubRef.current === 'function') {
      try { usersUnsubRef.current(); } catch (_) {}
      usersUnsubRef.current = null;
    }

    const unsubscribeMessages = firebaseService.onRoomMessagesUpdate(room.roomId, (messageList) => {
      setMessages(messageList);
    });
    const unsubscribeUsers = firebaseService.onRoomUsersUpdate(room.roomId, (userList) => {
      setRoomUsers(userList);
      const stillMember = Array.isArray(userList) && userList.some(u => u.username === username);
      // Alert only on transition from wasMember -> not a member
      if (wasMemberRef.current === true && stillMember === false) {
        try { alert('You were removed by the room owner'); } catch (_) {}
        if (typeof props.onViewChange === 'function') {
          props.onViewChange('home');
        }
        if (typeof onLeaveRoom === 'function') {
          onLeaveRoom();
        }
      }
      // Initialize or update previous state
      if (wasMemberRef.current === null) {
        wasMemberRef.current = stillMember;
      } else if (wasMemberRef.current !== stillMember) {
        wasMemberRef.current = stillMember;
      }
    });
    messagesUnsubRef.current = unsubscribeMessages;
    usersUnsubRef.current = unsubscribeUsers;

    return () => {
      if (typeof messagesUnsubRef.current === 'function') {
        try { messagesUnsubRef.current(); } catch (_) {}
        messagesUnsubRef.current = null;
      }
      if (typeof usersUnsubRef.current === 'function') {
        try { usersUnsubRef.current(); } catch (_) {}
        usersUnsubRef.current = null;
      }
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

  // Desktop: keep the input focused so users can type next message immediately
  useEffect(() => {
    if (isDesktop) {
      focusInput();
    }
  }, [isDesktop]);

  useEffect(() => {
    if (isDesktop) {
      focusInput();
    }
  }, [messages.length]);

  // Private rooms don't need spam protection - always allow messages
  // No spam protection needed for private rooms

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending) return;

    const messageText = newMessage.trim();
    
    // Check content moderation
    if (!isMessageClean(messageText)) {
      setModerationMessage(messageText);
      setShowContentModeration(true);
      return;
    }
    
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
      if (isDesktop) {
        focusInput();
        setTimeout(focusInput, 0);
        setTimeout(focusInput, 100);
      }
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

  const handleModeratedSend = async (messageToSend) => {
    setShowContentModeration(false);
    setModerationMessage('');
    
    setNewMessage('');
    setIsSending(true);
    
    try {
      // Create optimistic message (like public chat)
      const optimisticMessage = {
        id: `temp_${Date.now()}`,
        roomId: room.roomId,
        username,
        message: messageToSend,
        timestamp: new Date(),
        isOptimistic: true
      };

      // Add to local state immediately (like public chat)
      setMessages(prev => [...prev, optimisticMessage]);

      // Send to Firebase
      await firebaseService.sendRoomMessage(room.roomId, username, messageToSend);

      // Remove optimistic message and let Firebase update handle the real message
      setMessages(prev => prev.filter(msg => !msg.isOptimistic));
      
    } catch (error) {
      console.error('Error sending moderated message:', error);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => !msg.isOptimistic));
    } finally {
      setIsSending(false);
      if (isDesktop) {
        focusInput();
        setTimeout(focusInput, 0);
        setTimeout(focusInput, 100);
      }
    }
  };

  const closeContentModeration = () => {
    setShowContentModeration(false);
    setModerationMessage('');
  };

  const handleRemoveUser = async (userId, usernameToRemove) => {
    if (!window.confirm(`Are you sure you want to remove ${usernameToRemove} from this room?`)) {
      return;
    }
    
    try {
      await firebaseService.removeUserFromRoom(room.roomId, usernameToRemove);
      setShowUserMenu(null);
    } catch (error) {
      console.error('Error removing user:', error);
      alert(`Failed to remove ${usernameToRemove} from room: ${error.message}`);
    }
  };

  const handleLeaveClick = async () => {
    // Redirect immediately regardless of Firestore speed
    if (typeof props.onViewChange === 'function') {
      props.onViewChange('home');
    }
    if (typeof onLeaveRoom === 'function') {
      onLeaveRoom();
    }
    // Stop listeners and clear UI
    if (typeof messagesUnsubRef.current === 'function') {
      try { messagesUnsubRef.current(); } catch (_) {}
      messagesUnsubRef.current = null;
    }
    if (typeof usersUnsubRef.current === 'function') {
      try { usersUnsubRef.current(); } catch (_) {}
      usersUnsubRef.current = null;
    }
    setMessages([]);
    setRoomUsers([]);
    // Best-effort Firestore leave
    try {
      await firebaseService.leaveRoom(room.roomId, username);
    } catch (error) {
      console.error('Error leaving room from PrivateRoom view (ignored after redirect):', error);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isCurrentUser = (messageUsername) => messageUsername === username;

  const handleCopyText = async (text, messageId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setCopiedMessageId(messageId); // Set the message ID that was copied
      setTimeout(() => {
        setCopied(false);
        setCopiedMessageId(null); // Reset copied message ID
      }, 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  const [copiedMessageId, setCopiedMessageId] = useState(null);

  return (
    <div className="flex h-[100dvh] lg:h-full bg-gray-900/50">
      {/* Content Moderation Modal */}
      <ContentModeration
        message={moderationMessage}
        isVisible={showContentModeration}
        onClose={closeContentModeration}
        onSend={handleModeratedSend}
        showWarning={true}
      />
      
      {/* Users Sidebar - Desktop */}
      <div className="hidden lg:flex w-64 bg-gray-800/60 backdrop-blur-sm border-r border-gray-700/50 flex-col flex-shrink-0">
        {/* Room Header */}
        <div className="p-4 lg:p-6 border-b border-gray-700/50 flex-shrink-0">
          <div className="mb-4 text-left">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-white/90 mb-1 text-left">{room.roomName}</h2>
              <p className="text-gray-400/70 text-sm mb-2 text-left">Private Room</p>
              {isCreator && (
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
              )}
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-gray-700/30">
            <span className="text-gray-400/70 text-sm font-medium">{roomUsers.length} members</span>
            <button
              onClick={handleLeaveClick}
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

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Mobile Header */}
        <div className="lg:hidden sticky top-0 z-30 bg-gray-800/60 backdrop-blur-sm border-b border-gray-700/50 p-3 flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0">
            <button
              onClick={() => setIsMembersOpen(true)}
              className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-700/40"
              title="Show members"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-white/90 truncate">{room.roomName}</h2>
              <p className="text-gray-400/70 text-xs truncate">{roomUsers.length} members</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {isCreator && (
              <button
                onClick={handleCopyCode}
                className="text-gray-400/80 hover:text-yellow-400 p-2 rounded-lg hover:bg-gray-700/40"
                title="Copy room code"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            )}
            <button
              onClick={handleLeaveClick}
              className="text-red-400/80 hover:text-red-300 p-2 rounded-lg hover:bg-red-900/20"
              title="Leave room"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>

        
        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-3 lg:p-6 min-h-0">
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
                          : 'bg-message-bg/40 border-gray-700/30 text-white/90'
                        } 
                        backdrop-blur-sm rounded-2xl px-3 py-2 border break-words inline-block max-w-full
                      `}>
                        <p className="text-sm leading-relaxed mb-2">
                          {message.message}
                        </p>
                        
                        {/* Message status and timestamp */}
                        <div className={`flex items-center justify-end ${isCurrentUser(message.username) ? 'text-green-200/70' : 'text-gray-400/70'}`}>
                          <MessageStatus 
                            status={message.status || 'sent'} 
                            timestamp={message.timestamp}
                            isCurrentUser={isCurrentUser(message.username)}
                          />
                        </div>
                        
                        {/* Action buttons for current user's messages */}
                        {isCurrentUser(message.username) && (
                          <div className="absolute -top-2 -left-2 opacity-0 group-hover:opacity-100 transition-all duration-200 flex space-x-1">
                            {/* Copy button */}
                            <button
                              onClick={() => handleCopyText(message.message, message.id)}
                              className="bg-gray-700/80 hover:bg-gray-600/80 text-gray-300 hover:text-white p-2 rounded-full border border-gray-600/50 hover:border-gray-500/50 transition-all duration-200 shadow-lg"
                              title={copiedMessageId === message.id ? 'Copied!' : 'Copy text'}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                            {/* Edit button */}
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

        {/* Message Input */}
        <div className="bg-gray-800/60 backdrop-blur-sm border-t border-gray-700/50 p-3 lg:p-6 flex-shrink-0">
          <form onSubmit={handleSendMessage} className="flex items-center space-x-2 lg:space-x-4">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 px-3 py-2 lg:px-4 lg:py-3 rounded-xl text-sm lg:text-base transition-all duration-150 bg-[#303030] border border-gray-600/50 text-white/90 placeholder-gray-400/70 focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 focus:outline-none"
              disabled={isSending}
              ref={inputRef}
              autoFocus={isDesktop}
              onBlur={() => { if (isDesktop) setTimeout(focusInput, 0); }}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || isSending}
              className={`px-4 py-2 lg:px-6 lg:py-3 rounded-xl font-medium transition-all duration-200 text-sm lg:text-base flex items-center justify-center min-w-[72px] lg:min-w-[80px] ${
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

      {/* Members Drawer - Mobile */}
      {isMembersOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/60" onClick={() => setIsMembersOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-gray-800/95 backdrop-blur-sm border-r border-gray-700/50 flex flex-col">
            <div className="p-4 border-b border-gray-700/50 flex items-center justify-between">
              <div>
                <h3 className="text-white/90 font-semibold">Members</h3>
                <p className="text-gray-400/70 text-xs">{roomUsers.length} total</p>
              </div>
              <button
                onClick={() => setIsMembersOpen(false)}
                className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-700/40"
                title="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 min-h-0">
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
                        className="text-gray-400/70 hover:text-red-400 hover:bg-red-900/20 p-2 rounded-lg transition-all duration-200 flex-shrink-0"
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
        </div>
      )}
    </div>
  );
};

export default PrivateRoom;
