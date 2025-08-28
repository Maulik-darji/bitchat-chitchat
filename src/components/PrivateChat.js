import React, { useState, useEffect, useRef } from 'react';
import firebaseService from '../lib/firebase';
import MessageActions from './MessageActions';

const PrivateChat = ({ chatId, otherUsername, username, onClose, onUserRemoved, hideHeader = false }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState('');
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const [longPressedMessageId, setLongPressedMessageId] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
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

  useEffect(() => {
    if (!chatId) return;
    
    let unsubscribe = () => {};

    const setupListener = async () => {
      try {
        unsubscribe = firebaseService.onPrivateChatMessagesUpdate(chatId, (messageList) => {
          setMessages(prevMessages => {
            // Keep optimistic messages that haven't been confirmed yet
            const optimisticMessages = prevMessages.filter(msg => msg.isOptimistic);
            
            // Combine real messages from Firebase with optimistic messages
            const combinedMessages = [...messageList, ...optimisticMessages];
            
            // Remove optimistic messages that have been confirmed (same content and username)
            const filteredMessages = combinedMessages.filter(msg => {
              if (!msg.isOptimistic) return true;
              
              // Check if this optimistic message has been confirmed by a real message
              const isConfirmed = messageList.some(realMsg => 
                realMsg.message === msg.message && 
                realMsg.username === msg.username &&
                Math.abs(realMsg.timestamp?.toDate?.() - msg.timestamp) < 5000 // Within 5 seconds
              );
              
              return !isConfirmed;
            });
            
            return filteredMessages;
          });
        });
      } catch (error) {
        console.error('Error setting up private chat messages listener:', error);
      }
    };

    setupListener();

    return () => {
      try {
        unsubscribe && unsubscribe();
      } catch (error) {
        console.error('Error cleaning up private chat messages listener:', error);
      }
    };
  }, [chatId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Desktop: keep input focused
  useEffect(() => {
    if (isDesktop) focusInput();
  }, [isDesktop]);

  useEffect(() => {
    if (isDesktop) focusInput();
  }, [messages.length]);

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
        chatId,
        username,
        message: messageText,
        timestamp: new Date(),
        isOptimistic: true,
        replyTo: replyingTo ? {
          id: replyingTo.id,
          username: replyingTo.username,
          message: replyingTo.message
        } : null
      };

      // Add optimistic message to UI
      setMessages(prev => [...prev, optimisticMessage]);

      // Send message to Firebase
      await firebaseService.sendPrivateMessage(chatId, username, messageText, replyingTo ? {
        id: replyingTo.id,
        username: replyingTo.username,
        message: replyingTo.message
      } : null);

      // Clear reply state
      setReplyingTo(null);
      
    } catch (error) {
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => !msg.isOptimistic));
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
      if (isDesktop) {
        focusInput();
        setTimeout(focusInput, 0);
        setTimeout(focusInput, 100);
      }
    }
  };

  const handleReply = (message) => {
    setReplyingTo(message);
    // Clear long-press state for this message
    setLongPressedMessageId(null);
    inputRef.current?.focus();
  };

  const handleUnsend = async (messageId) => {
    try {
      await firebaseService.deletePrivateMessage(messageId);
      console.log('Message unsent successfully');
      // Clear long-press state for this message
      setLongPressedMessageId(null);
    } catch (error) {
      console.error('Error unsending message:', error);
      alert('Failed to unsend message: ' + error.message);
    }
  };

  const handleEditMessage = async (messageId, newText) => {
    if (!newText.trim()) return;

    try {
      await firebaseService.editPrivateMessage(messageId, newText.trim());
      setEditingMessage(null);
      setEditText('');
    } catch (error) {
      console.error('Error editing message:', error);
    }
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isCurrentUser = (messageUsername) => messageUsername === username;

  return (
    <div className="flex h-full bg-gray-900/50">
      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Scroll container holds sticky header + messages so header sticks while scrolling */}
        <div
          className="flex-1 overflow-y-auto flex flex-col min-h-0 will-change-scroll"
          style={{ WebkitOverflowScrolling: 'touch', position: 'relative' }}
        >
          {/* Optional internal header (hidden when parent renders a fixed header) */}
          {!hideHeader && (
            <div className="sticky top-0 z-30 bg-gray-800/60 backdrop-blur-sm border-b border-gray-700/50 p-4 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 lg:w-10 lg:h-10 bg-purple-600/20 border border-purple-500/30 rounded-full flex items-center justify-center">
                    <span className="text-purple-400 font-bold text-lg">
                      {otherUsername.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-white/90">{otherUsername}</h1>
                    <p className="hidden lg:block text-purple-400/70 text-sm">Private Chat</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={async () => {
                      if (window.confirm(`Are you sure you want to remove ${otherUsername} from this private chat?`)) {
                        try {
                          await firebaseService.removeUserFromPrivateChat(chatId, otherUsername);
                          if (onUserRemoved) {
                            onUserRemoved(otherUsername);
                          }
                        } catch (error) {
                          console.error('Error removing user:', error);
                          alert('Failed to remove user from chat');
                        }
                      }
                    }}
                    className="text-red-400 hover:text-red-300 transition-colors p-2 rounded-lg hover:bg-red-600/20"
                    title="Remove user from chat"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-600/20"
                    title="Exit private chat"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 p-2 lg:p-3 space-y-3 flex flex-col min-h-0">
          {messages.length === 0 ? (
            <div className="text-center text-gray-400/70 py-12">
              <div className="w-16 h-16 bg-purple-800/50 border border-purple-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-500/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-lg font-medium">No messages yet</p>
              <p className="text-sm">Start your private conversation with {otherUsername}!</p>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div key={message.id} className={`flex ${isCurrentUser(message.username) ? 'justify-end' : 'justify-start'}`}>
                  {editingMessage === message.id ? (
                    <div className="max-w-xs lg:max-w-md relative z-[9998]">
                      <div className="bg-gray-800/40 backdrop-blur-sm rounded-lg p-4 border border-gray-700/30">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="text-gray-400/90 font-medium text-sm">
                                {message.username}
                              </span>
                              <span className="text-gray-500/70 text-xs">
                                {formatTime(message.timestamp)}
                              </span>
                            </div>
                            <span className="text-yellow-400/80 text-xs font-medium">Editing...</span>
                          </div>
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="w-full bg-gray-700/50 border border-gray-600/50 rounded-lg p-3 text-white/90 resize-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-200"
                            rows="3"
                            autoFocus
                          />
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEditMessage(message.id, editText)}
                              className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 hover:text-purple-300 px-4 py-2 rounded-lg text-sm transition-all duration-200 border border-purple-500/30 hover:border-purple-500/50"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingMessage(null);
                                setEditText('');
                              }}
                              className="bg-gray-600/20 hover:bg-gray-600/30 text-gray-400 hover:text-gray-300 px-4 py-2 rounded-lg text-sm transition-all duration-200 border border-gray-500/30 hover:border-gray-500/50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                  <div className={`max-w-xs lg:max-w-md ${isCurrentUser(message.username) ? 'text-right' : 'text-left'}`}>
                    {/* Message bubble */}
                    <div className={`relative group ${isCurrentUser(message.username) ? 'ml-auto' : 'mr-auto'}`}>
                      <div className={`
                        ${isCurrentUser(message.username) 
                          ? 'bg-purple-600/20 border-purple-500/30 text-white/90' 
                          : 'bg-gray-800/40 border-gray-700/30 text-white/90'
                        } 
                        backdrop-blur-sm rounded-2xl px-2.5 py-1.5 border break-words inline-block
                      `}>
                        {/* Reply indicator */}
                        {replyingTo && replyingTo.id === message.id && (
                          <div className="mb-2 p-2 bg-gray-700/30 rounded-lg border-l-4 border-purple-500">
                            <p className="text-xs text-gray-400">Replying to:</p>
                            <p className="text-sm text-gray-300">{message.message}</p>
                          </div>
                        )}
                        
                        {/* Reply to message indicator */}
                        {message.replyTo && (
                          <div className="mb-2 p-2 bg-gray-700/30 rounded-lg border-l-4 border-purple-500">
                            <p className="text-xs text-gray-400">Replying to {message.replyTo.username}:</p>
                            <p className="text-sm text-gray-300">{message.replyTo.message}</p>
                          </div>
                        )}
                        
                        <p className="text-sm leading-relaxed mb-1">
                          {message.message}
                        </p>
                        
                        {/* Timestamp inside message bubble */}
                        <div className={`flex items-center justify-end space-x-2 ${isCurrentUser(message.username) ? 'text-purple-200/70' : 'text-gray-400/70'}`}>
                          <span className="text-xs">
                            {formatTime(message.timestamp)}
                          </span>
                          {message.edited && (
                            <span className="text-xs bg-gray-700/30 px-1 py-0.5 rounded text-xs">edited</span>
                          )}
                        </div>
                      </div>
                      
                      {/* Message Actions - CSS hover based */}
                      <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto" 
                           style={{
                             top: '-8px',
                             left: isCurrentUser(message.username) ? 'auto' : '-8px',
                             right: isCurrentUser(message.username) ? '-8px' : 'auto',
                             zIndex: 99999
                           }}>
                        <div className="bg-gray-800/95 backdrop-blur-sm border border-gray-600/50 rounded-lg shadow-2xl p-2" style={{ minWidth: '120px' }}>
                          <div className="flex flex-col space-y-1">
                            {/* Reply Button */}
                            <button
                              onClick={() => handleReply(message)}
                              className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-md transition-colors duration-150"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                              </svg>
                              <span>Reply</span>
                            </button>

                            {/* Edit Button - Only show for current user's messages */}
                            {isCurrentUser(message.username) && (
                              <button
                                onClick={() => {
                                  setEditingMessage(message.id);
                                  setEditText(message.message);
                                }}
                                className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-md transition-colors duration-150"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                <span>Edit</span>
                              </button>
                            )}

                            {/* Unsend Button - Only show for current user's messages */}
                            {isCurrentUser(message.username) && (
                              <button
                                onClick={() => handleUnsend(message.id)}
                                className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-600/20 rounded-md transition-colors duration-150"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                <span>Unsend</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
              <div ref={messagesEndRef} />
            </>
          )}
          </div>
        </div>

        {/* Message Input */}
        <div className="bg-gray-800/60 backdrop-blur-sm border-t border-gray-700/50 p-4 lg:p-6 flex-shrink-0" onClick={() => { if (isDesktop) inputRef.current?.focus(); }}>
          {/* Reply indicator */}
          {replyingTo && (
            <div className="mb-3 p-3 bg-gray-700/30 rounded-lg border-l-4 border-purple-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">Replying to {replyingTo.username}:</p>
                  <p className="text-sm text-gray-300">{replyingTo.message}</p>
                </div>
                <button
                  onClick={cancelReply}
                  className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-600/20 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}
          
          <form onSubmit={handleSendMessage} className="flex space-x-3">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white/90 placeholder-gray-400/70 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-200"
              disabled={isSending}
              ref={inputRef}
              autoFocus={isDesktop}
              onBlur={() => { 
                // Only re-focus on desktop if we're not editing a message
                if (isDesktop && !editingMessage) setTimeout(focusInput, 0); 
              }}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || isSending}
              className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                newMessage.trim() && !isSending
                  ? 'bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 hover:text-purple-300 border border-purple-500/30 hover:border-purple-500/50'
                  : 'bg-gray-600/20 text-gray-500 border border-gray-500/30 cursor-not-allowed'
              }`}
              onMouseDown={(e) => { e.preventDefault(); }}
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

export default PrivateChat;
