import React, { useState, useEffect, useRef } from 'react';
import firebaseService from '../lib/firebase';

const PublicChat = ({ username, sidebarWidth = 256 }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [spamStatus, setSpamStatus] = useState({ canSend: true, remainingMessages: 5, cooldown: 0 });
  const [spamError, setSpamError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const isDesktop = typeof window !== 'undefined' && !(window.matchMedia && window.matchMedia('(pointer:coarse)').matches);
  const focusInput = () => {
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
    const unsubscribe = firebaseService.onPublicChatsUpdate((messageList) => {
      setMessages(messageList);
    });

    // Listen for refresh event from main header
    const handleRefreshEvent = () => {
      handleRefresh();
    };
    window.addEventListener('refreshPublicChat', handleRefreshEvent);

    return () => {
      unsubscribe();
      window.removeEventListener('refreshPublicChat', handleRefreshEvent);
    };
  }, []);

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
      
      // Clear spam error if user can send
      if (status.canSend && spamError) {
        setSpamError('');
      }
    };

    // Update immediately
    updateSpamStatus();
    
    // Update every second to show countdown
    const interval = setInterval(updateSpamStatus, 1000);
    
    return () => clearInterval(interval);
  }, [username, spamError]);

  // Desktop: keep the input focused so users can type next message immediately
  useEffect(() => {
    if (isDesktop) {
      focusInput();
    }
  }, [isDesktop]);

  // Also re-focus after message list changes (common blur cause in SPA hot UI updates)
  useEffect(() => {
    if (isDesktop) {
      focusInput();
    }
  }, [messages.length]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setIsSending(true);

    try {
      // Check spam protection
      const spamCheck = firebaseService.checkSpam(username);
      if (!spamCheck.allowed) {
        setSpamError(spamCheck.reason);
        setIsSending(false);
        return;
      }

      // Create optimistic message
      const optimisticMessage = {
        id: `temp_${Date.now()}`,
        username,
        message: messageText,
        timestamp: new Date(),
        isOptimistic: true
      };

      // Add to local state immediately
      setMessages(prev => [...prev, optimisticMessage]);

      // Send to Firebase
      await firebaseService.sendPublicMessage(username, messageText);

      // Remove optimistic message and let Firebase update handle the real message
      setMessages(prev => prev.filter(msg => !msg.isOptimistic));
    } catch (error) {
      console.error('Error sending message:', error);
      setSpamError(error.message);
      
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
      await firebaseService.editPublicMessage(messageId, newText.trim());
      setEditingMessage(null);
      setEditText('');
    } catch (error) {
      console.error('Error editing message:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await firebaseService.forceRefresh();
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isCurrentUser = (messageUsername) => messageUsername === username;

  return (
    <div className="flex flex-col h-full bg-gray-900/50 relative">


      {/* Messages Container with WhatsApp-style layout - Scrollable */}
      <div className="flex-1 overflow-y-auto p-2 lg:p-3 space-y-3 flex flex-col min-h-0 pb-4" style={{ paddingBottom: '120px' }}>
        {messages.length === 0 ? (
          <div className="text-center text-gray-400/70 py-12">
            <div className="w-16 h-16 bg-gray-800/50 border border-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-500/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-lg font-medium">No messages yet</p>
            <p className="text-sm">Be the first to start the conversation!</p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div key={message.id} className={`flex ${isCurrentUser(message.username) ? 'justify-end' : 'justify-start'}`}>
                {editingMessage === message.id ? (
                  <div className="max-w-xs lg:max-w-md w-full">
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
                          className="w-full bg-gray-700/50 border border-gray-600/50 rounded-lg p-3 text-white/90 resize-none focus:ring-2 focus:ring-gray-500/50 focus:border-gray-500/50 transition-all duration-200"
                          rows="3"
                          autoFocus
                        />
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditMessage(message.id, editText)}
                            className="bg-gray-600/20 hover:bg-gray-600/30 text-gray-400 hover:text-gray-300 px-4 py-2 rounded-lg text-sm transition-all duration-200 border border-gray-500/30 hover:border-gray-500/50"
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
                    {/* Username and timestamp - only show for other users */}
                    {!isCurrentUser(message.username) && (
                      <div className="mb-2 ml-2">
                        <span className="text-gray-400/90 font-medium text-sm">
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
                          ? 'bg-gray-600/20 border-gray-500/30 text-white/90' 
                          : 'bg-gray-800/40 border-gray-700/30 text-white/90'
                        } 
                        backdrop-blur-sm rounded-2xl px-2.5 py-1.5 border break-words inline-block
                      `}>
                        <p className="text-sm leading-relaxed mb-1">
                          {message.message}
                        </p>
                        
                        {/* Timestamp inside message bubble - WhatsApp style */}
                        <div className={`flex items-center justify-end space-x-2 ${isCurrentUser(message.username) ? 'text-gray-200/70' : 'text-gray-400/70'}`}>
                          <span className="text-xs">
                            {formatTime(message.timestamp)}
                          </span>
                          {message.edited && (
                            <span className="text-xs bg-gray-700/30 px-1 py-0.5 rounded text-xs">edited</span>
                          )}
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
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Twitter-style Message Input - Fixed position */}
      <div 
        className="bg-gray-800/60 backdrop-blur-sm border-t border-gray-700/50 p-4 lg:p-6 flex-shrink-0 fixed bottom-0 left-0 right-0 z-10"
        style={{ 
          left: window.innerWidth >= 1024 ? `${sidebarWidth}px` : '0px',
          right: window.innerWidth >= 1280 ? '320px' : '0px'
        }}
        onClick={() => { if (isDesktop) inputRef.current?.focus(); }}
      >
        {/* Spam Error Display - Only show when there's an actual error */}
        {spamError && (
          <div className="px-4 py-2 bg-red-900/30 border border-red-700/50 mb-4">
            <p className="text-red-300 text-sm">{spamError}</p>
          </div>
        )}

        {/* Message Input */}
        <form onSubmit={handleSendMessage} className="flex space-x-3">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            disabled={isSending || !spamStatus.canSend}
            className="flex-1 bg-gray-800 text-white px-4 py-3 rounded-2xl border border-gray-700 focus:border-gray-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            ref={inputRef}
            autoFocus={isDesktop}
            onBlur={() => {
              // Immediately re-focus on desktop if focus leaves input
              if (isDesktop) setTimeout(focusInput, 0);
            }}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || isSending || !spamStatus.canSend}
            className="bg-gray-600 hover:bg-gray-500 text-white px-6 py-3 rounded-2xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onMouseDown={(e) => {
              // Prevent button from stealing focus before submit
              e.preventDefault();
            }}
          >
            {isSending ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PublicChat;
