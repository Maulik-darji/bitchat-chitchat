import React, { useState, useEffect, useRef, useCallback } from 'react';
import firebaseService from '../lib/firebase';
import ContentModeration from './ContentModeration';
import { isMessageClean } from '../lib/contentFilter';
import MessageStatus from './MessageStatus';
import { clearMessageNotifications } from '../lib/notifications';
import { runPerformanceComparison } from '../lib/performanceTest';

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
  const messagesContainerRef = useRef(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [showContentModeration, setShowContentModeration] = useState(false);
  const [moderationMessage, setModerationMessage] = useState('');
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
      
      // Clear notifications when room messages are loaded
      if (messageList.length > 0) {
        try {
          clearMessageNotifications(username, room.roomId, 'room');
        } catch (error) {
          console.error('Error clearing room message notifications:', error);
        }
      }
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



  // Private rooms don't need spam protection - always allow messages
  // No spam protection needed for private rooms

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending) return;

    const messageText = newMessage.trim();
    
    // Check content moderation
    const contentCheck = isMessageClean(messageText);
    if (!contentCheck.isClean) {
      setModerationMessage(messageText);
      setShowContentModeration(true);
      return;
    }
    
    // Clear input immediately for instant feedback
    setNewMessage('');
    
    // Create optimistic message with unique ID
    const optimisticMessage = {
      id: `temp_${Date.now()}_${Math.random()}`,
      roomId: room.roomId,
      username,
      message: messageText,
      timestamp: new Date(),
      isOptimistic: true
    };

    // Add to local state immediately for instant feedback
    setMessages(prev => [...prev, optimisticMessage]);
    
    // Auto-scroll to bottom immediately
    setShouldAutoScroll(true);
    setIsUserScrolling(false);
    
    // Send to Firebase in background (non-blocking)
    try {
      firebaseService.sendRoomMessage(room.roomId, username, messageText).catch(error => {
        console.error('Error sending message:', error);
        // Remove optimistic message on error
        setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
      });
      
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
    }

    // Restore focus immediately on desktop
    if (isDesktop && inputRef.current && !editingMessage) {
      inputRef.current.focus();
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
    
    // Create optimistic message with unique ID
    const optimisticMessage = {
      id: `temp_${Date.now()}_${Math.random()}`,
      roomId: room.roomId,
      username,
      message: messageToSend,
      timestamp: new Date(),
      isOptimistic: true
    };

    // Add to local state IMMEDIATELY for instant feedback
    setMessages(prev => [...prev, optimisticMessage]);
    
    // Auto-scroll to bottom immediately
    setShouldAutoScroll(true);
    setIsUserScrolling(false);
    
    // Send to Firebase in background (non-blocking)
    try {
      firebaseService.sendRoomMessage(room.roomId, username, messageToSend).catch(error => {
        console.error('Error sending moderated message:', error);
        // Remove optimistic message on error
        setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
      });
      
    } catch (error) {
      console.error('Error sending moderated message:', error);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
    }

    // Restore focus immediately on desktop
    if (isDesktop && inputRef.current && !editingMessage) {
      inputRef.current.focus();
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

  const handleUnsend = async (messageId) => {
    console.log('Attempting to unsend message:', messageId);
    console.log('Current user:', username);
    console.log('All messages:', messages);
    
    // Find the message to verify it exists and belongs to current user
    const messageToDelete = messages.find(m => m.id === messageId);
    if (!messageToDelete) {
      alert('Message not found');
      return;
    }
    
    if (messageToDelete.username !== username) {
      alert('You can only unsend your own messages');
      return;
    }
    
    // Prevent unsending optimistic messages
    if (messageToDelete.isOptimistic) {
      alert('Cannot unsend a message that is still being sent');
      return;
    }
    
    try {
      console.log('Message to delete:', messageToDelete);
      console.log('Message ID type:', typeof messageId);
      console.log('Message ID value:', messageId);
      
      // OPTIMISTIC UI UPDATE: Remove message immediately for instant feedback
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      
      // Ensure Firebase is initialized
      if (firebaseService.initialize) {
        await firebaseService.initialize();
      }
      
      await firebaseService.deleteRoomMessage(messageId);
      console.log('Message unsent successfully');
    } catch (error) {
      console.error('Error unsending message:', error);
      
      // REVERT OPTIMISTIC UPDATE on error: Add the message back to the UI
      if (messageToDelete) {
        setMessages(prev => [...prev, messageToDelete]);
      }
      
      // Provide more user-friendly error messages
      let errorMessage = 'Failed to unsend message';
      if (error.message.includes('Message not found')) {
        errorMessage = 'Message not found or already deleted';
      } else if (error.message.includes('You can only delete your own messages')) {
        errorMessage = 'You can only unsend your own messages';
      } else if (error.message.includes('Failed to authenticate')) {
        errorMessage = 'Authentication error. Please refresh the page and try again.';
      } else {
        errorMessage = error.message;
      }
      
      alert(errorMessage);
    }
  };

  const [copiedMessageId, setCopiedMessageId] = useState(null);

  return (
    <div 
      className="flex h-full bg-gray-900/50 relative private-room-container"
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
       
                                       {/* Backdrop overlay - Visible on all screen sizes when sidebar is open */}
        {isMembersOpen && (
          <div className="fixed inset-0 bg-black/60 z-30" onClick={() => setIsMembersOpen(false)} />
        )}
        
        {/* Users Sidebar - Desktop */}
        <div className={`${isMembersOpen ? 'flex' : 'hidden'} w-64 backdrop-blur-sm border-r border-gray-700/50 flex-col flex-shrink-0 h-full absolute inset-y-0 left-0 z-40`} style={{backgroundColor: '#181818'}}>
                   {/* Room Header */}
          <div className="p-4 lg:p-6 border-b border-gray-700/50 flex-shrink-0">
            {/* Close button for mobile */}
            <button
              onClick={() => setIsMembersOpen(false)}
              className="lg:hidden absolute top-4 right-4 text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-700/40"
              title="Close sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
           <div className="mb-4 text-left">
             <div className="flex-1 min-w-0">
               <h2 className="text-lg font-bold text-white/90 mb-1 text-left">{room.roomName}</h2>
               <p className="text-gray-400/70 text-sm mb-2 text-left">Private Room</p>
               {isCreator && (
                 <div className="flex items-center space-x-2 mb-3">
                                       <p className="text-gray-400/70 text-xs text-left">Room Code: <span className="text-yellow-400 font-mono bg-yellow-400/20 px-2 py-1 rounded ml-2">{room.roomId}</span></p>
                   <button
                     onClick={handleCopyCode}
                     className="text-gray-400/70 hover:text-yellow-400 transition-colors duration-200 p-1 rounded hover:bg-yellow-400/10"
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
           <div className="flex items-center justify-between pt-3 border-t border-gray-700/30">
             <span className="text-gray-400/70 text-sm font-medium">{roomUsers.length} members</span>
             <div className="flex items-center space-x-2">
               {/* Performance Test Button */}
               <button
                 onClick={() => runPerformanceComparison(firebaseService, username, room.roomId)}
                 className="text-blue-400/70 hover:text-blue-300 text-xs font-medium transition-all duration-200 px-2 py-1 rounded-lg hover:bg-blue-900/20"
                 title="Test message sending performance"
               >
                 ⚡ Speed Test
               </button>
               <button
                 onClick={handleLeaveClick}
                 className="text-red-400/70 hover:text-red-300 text-sm font-medium transition-all duration-200 px-3 py-1.5 rounded-lg hover:bg-red-900/20"
               >
                 Leave Room
               </button>
             </div>
           </div>
         </div>

         {/* Users List - Fixed height, scrollable if needed */}
         <div className="flex-1 overflow-y-auto p-4 min-h-0">
           <h3 className="text-sm font-medium text-gray-400/70 mb-4 uppercase tracking-wide border-b border-gray-700/30 pb-2">Members</h3>
           <div className="space-y-2">
             {roomUsers.map((user) => (
               <div key={user.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-700/30 transition-all duration-200 group">
                                   <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div className="w-8 h-8 bg-gray-600/30 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white/90 font-bold text-sm">
                        {user.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-white/90 font-medium text-sm truncate text-left">{user.username}</p>
                      <p className="text-green-400/70 text-xs flex items-center text-left">
                        <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                        Online
                      </p>
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
          {/* Header with hamburger menu - Only visible on mobile */}
          <div className="lg:hidden bg-gray-800/60 backdrop-blur-sm border-b border-gray-700/50 p-3 flex items-center justify-between">
            <div className="flex items-center space-x-3 min-w-0">
              <button
                onClick={() => setIsMembersOpen(true)}
                className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-700/40"
                title="Show members"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M3 12h18M3 20h18" />
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

        
                 {/* Messages Container with WhatsApp-style layout - Scrollable */}
                 <div 
                   ref={messagesContainerRef}
                   className="flex-1 overflow-y-auto p-2 lg:p-3 space-y-3 flex flex-col min-h-0 pb-4 relative z-20" 
                   style={{ backgroundColor: '#212121' }}
                 >
                       {/* Hover-triggered Sidebar Toggle Icon - Only visible when sidebar is closed */}
            {!isMembersOpen && (
              <div className="absolute left-0 top-0 w-16 h-full z-10 pointer-events-none">
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 w-12 h-12 bg-gray-700/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg pointer-events-auto">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <button
                  onClick={() => setIsMembersOpen(true)}
                  className="absolute left-0 top-0 w-16 h-full cursor-pointer pointer-events-auto hover:bg-gray-700/20 transition-all duration-200 group"
                  title="Open sidebar"
                />
              </div>
            )}
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
              
              <div className="space-y-4">
                {messages.map((message) => (
                <div key={message.id} className={`flex ${isCurrentUser(message.username) ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs lg:max-w-md ${isCurrentUser(message.username) ? 'text-right' : 'text-left'}`}>
                    {/* Message bubble */}
                    <div className={`relative group ${isCurrentUser(message.username) ? 'ml-auto' : 'mr-auto'}`}>
                                             <div className="text-white/90 rounded-2xl px-3 py-2 break-words inline-block max-w-full" style={{backgroundColor: '#303030'}}>
                        <div className="flex items-center justify-between">
                          <p className="text-sm leading-relaxed flex-1">
                            {message.message}
                          </p>
                          
                          {/* Timestamp and message status */}
                          <div className={`flex items-center space-x-2 ml-2 ${isCurrentUser(message.username) ? 'text-green-200/70' : 'text-gray-400/70'}`}>
                            <span className="text-xs">
                              {formatTime(message.timestamp)}
                            </span>
                            <MessageStatus 
                              status={message.status || 'sent'} 
                              timestamp={message.timestamp}
                              isCurrentUser={isCurrentUser(message.username)}
                            />
                          </div>
                        </div>
                        
                        {/* Message Actions - CSS hover based (same as PublicChat and PrivateChat) */}
                        <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto" 
                             style={{
                               top: '-8px',
                               left: isCurrentUser(message.username) ? 'auto' : '-8px',
                               right: isCurrentUser(message.username) ? '-8px' : 'auto',
                               zIndex: 99999
                             }}>
                          <div className="backdrop-blur-sm border border-gray-600/50 rounded-lg shadow-2xl p-2" style={{ minWidth: '160px', backgroundColor: '#303030' }}>
                            <div className="flex flex-col space-y-1">
                              {/* Copy Text Button */}
                              <button
                                onClick={() => handleCopyText(message.message, message.id)}
                                className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-md transition-colors duration-150"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
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
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            </>
          )}
        </div>

        {/* Twitter-style Message Input - Sticky position */}
        <div 
          className="backdrop-blur-sm p-4 lg:p-6 flex-shrink-0 sticky bottom-0 z-50"
          style={{ backgroundColor: '#303030' }}
        >
          <form onSubmit={handleSendMessage} className="flex space-x-3">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              disabled={isSending}
              className="flex-1 text-white px-4 py-3 rounded-2xl border-2 border-[#202020] focus:border-[#303030] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#202020' }}
              ref={inputRef}
              autoFocus={isDesktop}
              onBlur={(e) => { 
                // Only restore focus on desktop if we're not editing a message
                // and if the blur is not caused by clicking outside the chat area
                if (isDesktop && !editingMessage) {
                  const chatArea = e.currentTarget.closest('.private-room-container');
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
