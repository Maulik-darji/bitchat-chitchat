import React, { useState, useEffect, useRef, useCallback } from 'react';
import firebaseService from '../lib/firebase';
import ContentModeration from './ContentModeration';
import { isMessageClean } from '../lib/contentFilter';
import MessageStatus from './MessageStatus';

const PublicChat = ({ username, sidebarWidth = 256 }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState('');

  const [spamStatus, setSpamStatus] = useState({ canSend: true, remainingMessages: 5, cooldown: 0 });
  const [spamError, setSpamError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
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
  const isMobile = typeof window !== 'undefined' && (window.matchMedia && window.matchMedia('(pointer:coarse)').matches);
  const isDesktop = typeof window !== 'undefined' && !(window.matchMedia && window.matchMedia('(pointer:coarse)').matches);



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
    const unsubscribe = firebaseService.onPublicChatsUpdate((messageList) => {
      // Preserve scroll position before updating messages
      const restoreScroll = preserveScrollPosition();
      
      setMessages(messageList);
      
      // Restore scroll position after state update
      if (restoreScroll) {
        // Use requestAnimationFrame to ensure DOM is updated
        requestAnimationFrame(() => {
          restoreScroll();
        });
      }
      
      // Emit message count to parent component
      window.dispatchEvent(new CustomEvent('messageCountUpdate', { 
        detail: { count: messageList.length } 
      }));
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
  }, [preserveScrollPosition]);

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

  // Add a more robust scroll mechanism for new messages
  useEffect(() => {
    if (messages.length > 0 && shouldAutoScroll) {
      // Small delay to ensure DOM is updated
      const timer = setTimeout(() => {
        smartScrollToBottom();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages.length, shouldAutoScroll]);

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

  // Focus input initially and maintain focus (only on desktop)
  useEffect(() => {
    // Focus initially only on desktop
    if (isDesktop) {
      if (inputRef.current && document.activeElement !== inputRef.current) {
        inputRef.current.focus();
      }
    }
  }, [isDesktop]);

  // Maintain focus when messages change (new messages arrive) - only on desktop
  useEffect(() => {
    if (messages.length > 0 && isDesktop) {
      if (inputRef.current && !editingMessage) {
        inputRef.current.focus();
      }
    }
  }, [messages.length, isDesktop]);

  // Add scroll event listener to detect user scrolling
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  // Remove the auto-re-focus effect that was causing the persistent focus

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
    
    // If message is clean, send it directly
    await sendMessageToFirebase(messageText);
  };

  // Separate function to send message to Firebase
  const sendMessageToFirebase = async (messageText) => {
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
        isOptimistic: true,
        replyTo: replyingTo ? {
          id: replyingTo.id,
          username: replyingTo.username,
          message: replyingTo.message
        } : null
      };

      // Add to local state immediately
      setMessages(prev => [...prev, optimisticMessage]);

      // Send to Firebase
      await firebaseService.sendPublicMessage(username, messageText, replyingTo ? {
        id: replyingTo.id,
        username: replyingTo.username,
        message: replyingTo.message
      } : null);

      // Remove optimistic message and let Firebase update handle the real message
      setMessages(prev => prev.filter(msg => !msg.isOptimistic));
      
      // Clear reply state AFTER successful send
      setReplyingTo(null);
      
      // Auto-scroll to bottom when user sends a message
      setShouldAutoScroll(true);
      setIsUserScrolling(false);
    } catch (error) {
      console.error('Error sending message:', error);
      setSpamError(error.message);
      
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => !msg.isOptimistic));
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



  const handleReply = (message) => {
    setReplyingTo(message);
    if (isDesktop) {
      inputRef.current?.focus();
    }
  };

  const handleUnsend = async (messageId) => {
    try {
      await firebaseService.deletePublicMessage(messageId);
      console.log('Message unsent successfully');
    } catch (error) {
      console.error('Error unsending message:', error);
      alert('Failed to unsend message: ' + error.message);
    }
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  const handleRefresh = async () => {
    try {
      await firebaseService.forceRefresh();
    } catch (error) {
      console.error('Error refreshing:', error);
    }
  };

  const handleModeratedSend = async (messageToSend) => {
    setShowContentModeration(false);
    setModerationMessage('');
    
    // Always send the message (filtered or original) using the common function
    await sendMessageToFirebase(messageToSend);
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

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isCurrentUser = (messageUsername) => messageUsername === username;

  return (
    <div 
      className="flex flex-col h-full bg-gray-900/50 relative public-chat-container"
    >
      {/* Content Moderation Modal */}
      <ContentModeration
        message={moderationMessage}
        isVisible={showContentModeration}
        onClose={closeContentModeration}
        onSend={handleModeratedSend}
        showWarning={true}
      />

      {/* Messages Container with WhatsApp-style layout - Scrollable */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-2 lg:p-3 space-y-3 flex flex-col min-h-0 pb-4 relative z-20" 
        style={{ backgroundColor: '#212121' }}
      >
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
                                         <div className="backdrop-blur-sm rounded-lg p-4 border" style={{ backgroundColor: '#303030', borderColor: '#202020' }}>
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
                           className="w-full rounded-lg p-3 text-white/90 resize-none focus:ring-2 focus:ring-gray-500/50 focus:border-gray-500/50 transition-all duration-200"
                           style={{ backgroundColor: '#202020', border: '1px solid #202020' }}
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
                    <div 
                      className={`relative group ${isCurrentUser(message.username) ? 'ml-auto' : 'mr-auto'}`}
                    >
                      <div className={`
                        ${isCurrentUser(message.username) 
                          ? 'bg-gray-600/20 border-gray-500/30 text-white/90' 
                          : 'bg-gray-700/20 border-gray-600/30 text-white/90'
                        } 
                        backdrop-blur-sm rounded-2xl px-2.5 py-1.5 border break-words inline-block
                      `}>
                        {/* Reply indicator - shows when this message is being replied to */}
                        {replyingTo && replyingTo.id === message.id && (
                          <div className="mb-2 p-2 bg-gray-700/30 rounded-lg border-l-4 border-gray-500">
                            <p className="text-xs text-gray-400">Replying to:</p>
                            <p className="text-sm text-gray-300">{message.message}</p>
                          </div>
                        )}
                        
                        {/* Reply to message indicator - shows when this message is a reply to another message */}
                        {message.replyTo && (
                          <div className="mb-2 p-2 bg-gray-700/30 rounded-lg border-l-4 border-gray-500">
                            <p className="text-xs text-gray-400">Replying to {message.replyTo.username}:</p>
                            <p className="text-sm text-gray-300">{message.replyTo.message}</p>
                          </div>
                        )}
                        
                        <p className="text-sm leading-relaxed mb-1">
                          {message.message}
                        </p>
                        
                        {/* Message status and timestamp - WhatsApp style */}
                        <div className={`flex items-center justify-end space-x-2 ${isCurrentUser(message.username) ? 'text-gray-200/70' : 'text-gray-400/70'}`}>
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
                      

                      
                      {/* Message Actions - CSS hover based (same as PrivateChat.js) */}
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
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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

      {/* Twitter-style Message Input - Sticky position */}
             <div 
         className="backdrop-blur-sm p-4 lg:p-6 flex-shrink-0 sticky bottom-0 z-50"
         style={{ backgroundColor: '#303030' }}
       >
        {/* Spam Error Display - Only show when there's an actual error */}
        {spamError && (
          <div className="px-4 py-2 bg-red-900/30 border border-red-700/50 mb-4">
            <p className="text-red-300 text-sm">{spamError}</p>
          </div>
        )}

        {/* Message Input */}
        <form onSubmit={handleSendMessage} className="flex space-x-3 input-container">
          {/* Reply indicator */}
          {replyingTo && (
            <div className="mb-3 p-3 bg-gray-700/30 rounded-lg border-l-4 border-gray-500">
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
          
                     <input
             type="text"
             value={newMessage}
             onChange={(e) => setNewMessage(e.target.value)}
             placeholder="Type your message..."
             disabled={isSending || !spamStatus.canSend}
             className="flex-1 text-white px-4 py-3 rounded-2xl border-2 border-[#202020] focus:border-[#303030] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
             style={{ backgroundColor: '#202020' }}
             ref={inputRef}
             autoFocus={isDesktop}
             onKeyDown={(e) => {
               if (e.key === 'Enter' && !e.shiftKey) {
                 e.preventDefault();
                 handleSendMessage(e);
               }
             }}
             onBlur={(e) => {
               // Only restore focus on desktop if we're not editing a message
               // and if the blur is not caused by clicking outside the chat area
               if (isDesktop && !editingMessage) {
                 const chatArea = e.currentTarget.closest('.public-chat-container');
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
             disabled={!newMessage.trim() || isSending || !spamStatus.canSend}
             className="bg-gray-600 hover:bg-gray-500 text-white px-6 py-3 rounded-2xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
             onMouseDown={(e) => {
               // Prevent button from stealing focus before submit
               e.preventDefault();
             }}
           >
             {isSending ? (
               <div className="flex items-center space-x-2">
                 <svg className="w-5 h-5 text-gray-400/70 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                 </svg>
                 <span>Sending...</span>
               </div>
             ) : (
               <span className="material-symbols-outlined text-white text-2xl">
                 send
               </span>
             )}
           </button>
        </form>
      </div>
    </div>
  );
};

export default PublicChat;
