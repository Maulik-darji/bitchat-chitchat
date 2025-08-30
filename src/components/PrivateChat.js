import React, { useState, useEffect, useRef, useCallback } from 'react';
import firebaseService from '../lib/firebase';
import MessageActions from './MessageActions';
import ContentModeration from './ContentModeration';
import { isMessageClean } from '../lib/contentFilter';
import MessageStatus from './MessageStatus';
import { clearMessageNotifications } from '../lib/notifications';

const PrivateChat = ({ chatId, otherUsername, username, onClose, onUserRemoved }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState('');
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const [longPressedMessageId, setLongPressedMessageId] = useState(null);
  const [showContentModeration, setShowContentModeration] = useState(false);
  const [moderationMessage, setModerationMessage] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollTimeoutRef = useRef(null);
  const lastScrollTopRef = useRef(0);
  const isDesktop = typeof window !== 'undefined' && !(window.matchMedia && window.matchMedia('(pointer:coarse)').matches);
  const isMobile = typeof window !== 'undefined' && (window.matchMedia && window.matchMedia('(pointer:coarse)').matches);



  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Check if user is at the bottom of the chat with mobile-optimized threshold
  const isAtBottom = useCallback(() => {
    if (!messagesContainerRef.current) return true;
    const container = messagesContainerRef.current;
    // Increase threshold for mobile devices to prevent accidental auto-scroll
    const threshold = isMobile ? 150 : 100;
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  }, [isMobile]);

  // Debounced scroll handler to prevent rapid state changes
  const handleScroll = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      if (messagesContainerRef.current) {
        const container = messagesContainerRef.current;
        const currentScrollTop = container.scrollTop;
        const atBottom = isAtBottom();
        
        // Only update state if there's a meaningful change (prevents micro-adjustments)
        const scrollChanged = Math.abs(currentScrollTop - lastScrollTopRef.current) > 5;
        
        if (scrollChanged) {
          setShouldAutoScroll(atBottom);
          setIsUserScrolling(!atBottom);
          lastScrollTopRef.current = currentScrollTop;
        }
      }
    }, 100); // 100ms debounce for smooth experience
  }, [isAtBottom]);

  // Smart scroll that only auto-scrolls when appropriate
  const smartScrollToBottom = useCallback(() => {
    if (shouldAutoScroll) {
      scrollToBottom();
    }
  }, [shouldAutoScroll]);

  // Handle when user manually scrolls to bottom
  const handleScrollToBottom = () => {
    setShouldAutoScroll(true);
    setIsUserScrolling(false);
    scrollToBottom();
  };

  // Store current scroll position before messages update
  const preserveScrollPosition = useCallback(() => {
    if (messagesContainerRef.current && !shouldAutoScroll) {
      const container = messagesContainerRef.current;
      const currentScrollTop = container.scrollTop;
      const currentScrollHeight = container.scrollHeight;
      
      // Store the position relative to the bottom
      const distanceFromBottom = currentScrollHeight - currentScrollTop;
      
      // Return a function to restore the position
      return () => {
        if (container && !shouldAutoScroll) {
          const newScrollHeight = container.scrollHeight;
          const newScrollTop = newScrollHeight - distanceFromBottom;
          container.scrollTop = newScrollTop;
        }
      };
    }
    return null;
  }, [shouldAutoScroll]);

    useEffect(() => {
    if (!chatId) return;

    let unsubscribe = () => {};
    let hasMarkedAsRead = false; // Track if we've already marked messages as read

    const setupListener = async () => {
      try {
        unsubscribe = firebaseService.onPrivateChatMessagesUpdate(chatId, (messageList) => {
          // Preserve scroll position before updating messages
          const restoreScroll = preserveScrollPosition();
          
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
          
          // Restore scroll position after state update
          if (restoreScroll) {
            // Use requestAnimationFrame to ensure DOM is updated
            requestAnimationFrame(() => {
              restoreScroll();
            });
          }
          
          // Mark messages as read only once when chat is first opened
          if (messageList.length > 0 && !hasMarkedAsRead) {
            try {
              console.log('Marking messages as read for chat:', chatId, 'user:', username);
              firebaseService.markAllPrivateMessagesAsRead(chatId, username);
              // Clear notifications when messages are marked as read
              clearMessageNotifications(username, chatId, 'private');
              hasMarkedAsRead = true; // Mark as done to prevent infinite loop
              console.log('Successfully marked messages as read and cleared notifications');
            } catch (error) {
              console.error('Error marking messages as read:', error);
              // Even if marking as read fails, don't retry to prevent infinite loop
              hasMarkedAsRead = true;
            }
          }
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
  }, [chatId, username]);

  useEffect(() => {
    // Only auto-scroll if user is at bottom or if this is the first load
    if (messages.length > 0 && shouldAutoScroll) {
      // Add a small delay for mobile devices to ensure smooth scrolling
      const delay = isMobile ? 150 : 100;
      const timer = setTimeout(() => {
        smartScrollToBottom();
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [messages, shouldAutoScroll, smartScrollToBottom, isMobile]);



  // Add scroll event listener to detect user scrolling
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      // Add touch events for mobile devices
      container.addEventListener('touchstart', handleScroll);
      container.addEventListener('touchmove', handleScroll);
      container.addEventListener('touchend', handleScroll);
      
      return () => {
        container.removeEventListener('scroll', handleScroll);
        container.removeEventListener('touchstart', handleScroll);
        container.removeEventListener('touchmove', handleScroll);
        container.removeEventListener('touchend', handleScroll);
        // Clean up timeout to prevent memory leaks
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
      };
    }
  }, [handleScroll]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Track user activity (scrolling, clicking, etc.)
  useEffect(() => {
    if (!username) return;

    let activityTimeout;
    
    const updateActivity = async () => {
      try {
        await firebaseService.updateUserActivity(username);
      } catch (error) {
        console.error('Error updating user activity:', error);
      }
    };

    const handleUserActivity = () => {
      // Clear existing timeout
      if (activityTimeout) {
        clearTimeout(activityTimeout);
      }
      
      // Set new timeout to update activity after 2 seconds of inactivity
      activityTimeout = setTimeout(updateActivity, 2000);
    };

    // Track various user interactions
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, handleUserActivity, { passive: true });
    });

    return () => {
      if (activityTimeout) {
        clearTimeout(activityTimeout);
      }
      events.forEach(event => {
        document.removeEventListener(event, handleUserActivity);
      });
    };
  }, [username]);



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
      
      // Auto-scroll to bottom when user sends a message
      setShouldAutoScroll(true);
      setIsUserScrolling(false);
      
    } catch (error) {
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => !msg.isOptimistic));
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
      // Restore focus on desktop devices after sending message
      if (isDesktop) {
        // Use a short delay to ensure the DOM has updated
        setTimeout(() => {
          if (inputRef.current && !editingMessage) {
            inputRef.current.focus();
          }
        }, 50);
      }
    }
  };

  const handleReply = (message) => {
    setReplyingTo(message);
    // Clear long-press state for this message
    setLongPressedMessageId(null);
    if (isDesktop) {
      inputRef.current?.focus();
    }
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

  const handleModeratedSend = async (messageToSend) => {
    setShowContentModeration(false);
    setModerationMessage('');
    
    setNewMessage('');
    setIsSending(true);
    
    try {
      // Create optimistic message
      const optimisticMessage = {
        id: `temp_${Date.now()}`,
        chatId,
        username,
        message: messageToSend,
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
      await firebaseService.sendPrivateMessage(chatId, username, messageToSend, replyingTo ? {
        id: replyingTo.id,
        username: replyingTo.username,
        message: replyingTo.message
      } : null);

      // Clear reply state
      setReplyingTo(null);
      
    } catch (error) {
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => !msg.isOptimistic));
      console.error('Error sending moderated message:', error);
    } finally {
      setIsSending(false);
      // Restore focus on desktop devices after sending message
      if (isDesktop) {
        // Use a short delay to ensure the DOM has updated
        setTimeout(() => {
          if (inputRef.current && !editingMessage) {
            inputRef.current.focus();
          }
        }, 50);
      }
    }
  };

  const closeContentModeration = () => {
    setShowContentModeration(false);
    setModerationMessage('');
  };

  const handleCopyText = async (text, messageId) => {
    try {
      await navigator.clipboard.writeText(text);
      console.log('Text copied to clipboard');
      
      // Show copied state
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000); // Reset after 2 seconds
    } catch (error) {
      console.error('Failed to copy text:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      // Show copied state even for fallback
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
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
    <div 
      className="flex h-full private-chat-container" 
      style={{ backgroundColor: '#212121' }}
    >
      {/* Content Moderation Modal */}
      <ContentModeration
        message={moderationMessage}
        isVisible={showContentModeration}
        onClose={closeContentModeration}
        onSend={handleModeratedSend}
        showWarning={true}
        username={username}
      />
      
      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Scroll container holds sticky header + messages so header sticks while scrolling */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto flex flex-col min-h-0 will-change-scroll"
          style={{ WebkitOverflowScrolling: 'touch', position: 'relative' }}
        >
          {/* Header is now handled by parent App.js for consistent mobile behavior */}

          {/* Messages */}
          <div className="flex-1 p-2 lg:p-3 space-y-3 flex flex-col min-h-0" style={{ backgroundColor: '#212121' }}>
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
              {/* Scroll to bottom button - only show when user is not at bottom */}
              {isUserScrolling && (
                <div className="sticky top-2 z-30 flex justify-center">
                  <button
                    onClick={handleScrollToBottom}
                    className="bg-gray-700/80 hover:bg-gray-600/80 text-white/90 hover:text-white backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border border-gray-600/50 hover:border-gray-500/50 shadow-lg"
                  >
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                      <span>New messages</span>
                    </div>
                  </button>
                </div>
              )}
              
              {messages.map((message) => (
                <div key={message.id} className={`flex ${isCurrentUser(message.username) ? 'justify-end' : 'justify-start'}`}>
                  {editingMessage === message.id ? (
                    <div className="max-w-xs lg:max-w-md relative z-[9998]">
                                             <div className="bg-gray-800/95 backdrop-blur-sm rounded-lg p-4 border border-gray-600/50">
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
                            className="w-full border border-gray-600/50 rounded-lg p-3 text-white/90 resize-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-200"
                            style={{ backgroundColor: '#202020' }}
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
                          : 'bg-gray-700/20 border-gray-600/30 text-white/90'
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
                        
                                                 {/* Message status and timestamp */}
                         <div className={`flex items-center justify-end space-x-2 ${isCurrentUser(message.username) ? 'text-purple-200/70' : 'text-gray-400/70'}`}>
                           <MessageStatus 
                             status={message.status || 'sent'} 
                             timestamp={message.timestamp}
                             isCurrentUser={isCurrentUser(message.username)}
                           />
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
                                                                                                   <div className="backdrop-blur-sm border border-gray-600/50 rounded-lg shadow-2xl p-2" style={{ minWidth: '160px', backgroundColor: '#303030' }}>
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

                                                         {/* Copy Text Button */}
                                                           <button
                                onClick={() => handleCopyText(message.message, message.id)}
                                className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-md transition-colors duration-150"
                              >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 002 2v8a2 2 0 002 2z" />
                              </svg>
                              <span>{copiedMessageId === message.id ? 'Copied!' : 'Copy Text'}</span>
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
                            <div className="backdrop-blur-sm border-t border-gray-700/50 p-4 lg:p-6 flex-shrink-0" style={{ backgroundColor: '#303030' }}>
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
              className="flex-1 text-white px-4 py-3 rounded-2xl border-2 border-[#202020] focus:border-[#303030] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#202020' }}
              disabled={isSending}
              ref={inputRef}
              autoFocus={isDesktop}
              onBlur={(e) => { 
                // Only restore focus on desktop if we're not editing a message
                // and if the blur is not caused by clicking outside the chat area
                if (isDesktop && !editingMessage) {
                  const chatArea = e.currentTarget.closest('.private-chat-container');
                  const relatedTarget = e.relatedTarget;
                  
                  // Check if the blur is caused by clicking outside the chat area
                  if (chatArea && (!relatedTarget || !chatArea.contains(relatedTarget))) {
                    // User clicked outside the chat area - don't restore focus
                    return;
                  }
                  
                  // For internal interactions, restore focus after a short delay
                  // This allows other elements to be clicked without interference
                  setTimeout(() => {
                    if (inputRef.current && !editingMessage && document.activeElement !== inputRef.current) {
                      inputRef.current.focus();
                    }
                  }, 100);
                }
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
               ) : (
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                 </svg>
               )}
             </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PrivateChat;
