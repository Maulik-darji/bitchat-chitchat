import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import './App.css';
import UsernameModal from './components/UsernameModal';
import Sidebar from './components/Sidebar';
import PublicChat from './components/PublicChat';
import StatsSidebar from './components/StatsSidebar';
import JoinRoom from './components/JoinRoom';
import CreateRoom from './components/CreateRoom';
import PrivateRoom from './components/PrivateRoom';
import PrivateChat from './components/PrivateChat';
import firebaseService from './lib/firebase';
import RemovalNotification from './components/RemovalNotification';
import NotificationBell from './components/NotificationBell';

// Wrapper component to handle routing logic
const AppContent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [username, setUsername] = useState(null);
  const [currentView, setCurrentView] = useState('home');
  const [currentRoom, setCurrentRoom] = useState(null);
  const [currentPrivateChat, setCurrentPrivateChat] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebarWidth');
    return saved ? parseInt(saved) : 256;
  }); // Default 256px (w-64)
  const [isResizing, setIsResizing] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const resizeRef = useRef(null);
  const [securityWarning, setSecurityWarning] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false); // Flag to prevent circular dependency
  const navigationRef = useRef(false); // More reliable navigation tracking
  const lastNavigationTime = useRef(0); // Track last navigation time for debouncing
  const [viewTransition, setViewTransition] = useState(false); // Smooth view transitions


  // Handle URL changes and validate access
  useEffect(() => {
    if (isNavigating || navigationRef.current) {
      console.log('🚫 Skipping URL change handling - programmatically navigating');
      return; // Skip if we're programmatically navigating
    }
    
    // Debounce URL change handling to prevent rapid successive calls
    const timeoutId = setTimeout(() => {
      console.log('📍 URL changed to:', location.pathname);
      const path = location.pathname;
      
      // Only update currentView if it's different from what we're about to set
      // This prevents unnecessary state updates that could trigger the sync effect
      if (path === '/' && currentView !== 'home') {
        console.log('🏠 Setting view to home from URL');
        setCurrentView('home');
      } else if (path.startsWith('/room/')) {
        const roomId = path.split('/room/')[1];
        
        // SECURITY: Validate that the user has access to this room
        if (username && roomId) {
          validateRoomAccess(roomId, username);
        } else {
          // If not authenticated or no username, redirect to home
          navigate('/', { replace: true });
        }
      } else if (path.startsWith('/chat/')) {
        const chatId = path.split('/chat/')[1];
        
        // SECURITY: Validate that the user has access to this chat
        if (username && chatId) {
          // Only validate if we don't already have this chat loaded
          if (!currentPrivateChat || currentPrivateChat.chatId !== chatId) {
            validateChatAccess(chatId, username);
          } else {
            console.log('🔄 Chat already loaded, skipping validation:', chatId);
          }
        } else {
          // If not authenticated or no username, redirect to home
          navigate('/', { replace: true });
        }
      } else if (path === '/join-room' && currentView !== 'join-room') {
        console.log('🔗 Setting view to join-room from URL');
        setCurrentView('join-room');
      } else if (path === '/create-room' && currentView !== 'create-room') {
        console.log('🔗 Setting view to create-room from URL');
        setCurrentView('create-room');
      } else if (path === '/invite-user' && currentView !== 'invite-user') {
        console.log('🔗 Setting view to invite-user from URL');
        setCurrentView('invite-user');
      }
    }, 100); // 100ms debounce
    
    return () => clearTimeout(timeoutId);
  }, [location.pathname, username, navigate, isNavigating, currentView, currentPrivateChat]);

  // Function to validate chat access
  const validateChatAccess = async (chatId, username) => {
    try {
      // SECURITY: Validate chat ID format to prevent malicious URL manipulation
      if (!chatId || typeof chatId !== 'string' || chatId.length > 100) {
        console.warn(`Invalid chat ID format: ${chatId}`);
        setSecurityWarning(`Security Alert: Invalid chat URL format detected. This incident has been logged.`);
        setTimeout(() => setSecurityWarning(null), 5000);
        navigate('/', { replace: true });
        return;
      }

      // Check if chat ID contains only valid characters (alphanumeric and underscores)
      if (!/^[a-zA-Z0-9_]+$/.test(chatId)) {
        console.warn(`Chat ID contains invalid characters: ${chatId}`);
        setSecurityWarning(`Security Alert: Invalid chat URL characters detected. This incident has been logged.`);
        setTimeout(() => setSecurityWarning(null), 5000);
        navigate('/', { replace: true });
        return;
      }

      // Check if we already have this chat loaded to prevent redundant calls
      if (currentPrivateChat && currentPrivateChat.chatId === chatId) {
        console.log('🔄 Chat already loaded, skipping validation:', chatId);
        setCurrentView('private-chat');
        return;
      }

      // Check if user is a participant in this chat
      const hasAccess = await firebaseService.validateChatAccess(chatId, username);
      
      if (hasAccess) {
        // User has access, set the chat and view
        const chatData = await firebaseService.getPrivateChatData(chatId);
        if (chatData) {
          setCurrentPrivateChat(chatData);
          setCurrentView('private-chat');
        } else {
          // Chat doesn't exist, redirect to home
          navigate('/', { replace: true });
        }
      } else {
        // User doesn't have access, show security warning and redirect to home
        console.warn(`User ${username} attempted to access unauthorized chat: ${chatId}`);
        setSecurityWarning(`Security Alert: You attempted to access a private chat you don't have permission to view. This incident has been logged.`);
        setTimeout(() => setSecurityWarning(null), 5000); // Clear warning after 5 seconds
        navigate('/', { replace: true });
      }
    } catch (error) {
      console.error('Error validating chat access:', error);
      // On error, redirect to home for security
      navigate('/', { replace: true });
    }
  };

  // Function to validate room access
  const validateRoomAccess = async (roomId, username) => {
    try {
      // SECURITY: Validate room ID format to prevent malicious URL manipulation
      if (!roomId || typeof roomId !== 'string' || roomId.length > 100) {
        console.warn(`Invalid room ID format: ${roomId}`);
        setSecurityWarning(`Security Alert: Invalid room URL format detected. This incident has been logged.`);
        setTimeout(() => setSecurityWarning(null), 5000);
        navigate('/', { replace: true });
        return;
      }

      // Check if room ID contains only valid characters (alphanumeric and underscores)
      if (!/^[a-zA-Z0-9_]+$/.test(roomId)) {
        console.warn(`Room ID contains invalid characters: ${roomId}`);
        setSecurityWarning(`Security Alert: Invalid room URL characters detected. This incident has been logged.`);
        setTimeout(() => setSecurityWarning(null), 5000);
        navigate('/', { replace: true });
        return;
      }

      // Check if user is a member of this room
      const hasAccess = await firebaseService.validateRoomAccess(roomId, username);
      
      if (hasAccess) {
        // User has access, set the room and view
        const roomData = await firebaseService.getRoomData(roomId);
        if (roomData) {
          setCurrentRoom(roomData);
          setCurrentView('private-room');
        } else {
          // Room doesn't exist, redirect to home
          navigate('/', { replace: true });
        }
      } else {
        // User doesn't have access, show security warning and redirect to home
        console.warn(`User ${username} attempted to access unauthorized room: ${roomId}`);
        setSecurityWarning(`Security Alert: You attempted to access a private room you don't have permission to view. This incident has been logged.`);
        setTimeout(() => setSecurityWarning(null), 5000); // Clear warning after 5 seconds
        navigate('/', { replace: true });
      }
    } catch (error) {
      console.error('Error validating room access:', error);
      // On error, redirect to home for security
      navigate('/', { replace: true });
    }
  };

  // Sync current view with URL - FIXED to prevent circular dependency
  useEffect(() => {
    if (username && !isNavigating && !navigationRef.current) {
      const path = location.pathname;
      let shouldNavigate = false;
      let targetPath = '/';
      
      // Only navigate if currentView doesn't match the URL
      switch (currentView) {
        case 'home':
          if (path !== '/') {
            shouldNavigate = true;
            targetPath = '/';
          }
          break;
        case 'join-room':
          if (path !== '/join-room') {
            shouldNavigate = true;
            targetPath = '/join-room';
          }
          break;
        case 'create-room':
          if (path !== '/create-room') {
            shouldNavigate = true;
            targetPath = '/create-room';
          }
          break;
        case 'invite-user':
          if (path !== '/invite-user') {
            shouldNavigate = true;
            targetPath = '/invite-user';
          }
          break;
        case 'private-room':
          if (currentRoom && path !== `/room/${currentRoom.id}`) {
            shouldNavigate = true;
            targetPath = `/room/${currentRoom.id}`;
          }
          break;
        case 'private-chat':
          if (currentPrivateChat && path !== `/chat/${currentPrivateChat.chatId}`) {
            shouldNavigate = true;
            targetPath = `/chat/${currentPrivateChat.chatId}`;
          }
          break;
      }
      
      if (shouldNavigate) {
        // Debounce navigation to prevent rapid successive attempts
        const now = Date.now();
        if (now - lastNavigationTime.current < 200) {
          console.log('🚫 Skipping navigation - too soon after last navigation');
          return;
        }
        
        console.log('🔄 Syncing currentView to URL:', currentView, '->', targetPath);
        setIsNavigating(true); // Set flag to prevent circular dependency
        navigationRef.current = true; // Set ref flag
        lastNavigationTime.current = now; // Update last navigation time
        
        navigate(targetPath, { replace: true });
        
        // Reset flags after navigation completes
        setTimeout(() => {
          console.log('✅ Navigation flag reset');
          setIsNavigating(false);
          navigationRef.current = false;
        }, 100); // Increased timeout for reliability
      }
    }
  }, [currentView, currentRoom, currentPrivateChat, username, navigate, isNavigating, location.pathname]);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize Firebase
        await firebaseService.initialize();
        
        // Check for existing username in localStorage (persistent across tab closes)
        const savedUsername = localStorage.getItem('username');
        
        if (savedUsername) {
          setUsername(savedUsername);
          // Backfill uid onto legacy user doc so server cleanup works by UID
          await firebaseService.ensureUserUid(savedUsername);

          // Restore last view and context
          const savedView = localStorage.getItem('currentView');
          const savedRoom = localStorage.getItem('currentRoom');
          const savedPrivateChat = localStorage.getItem('currentPrivateChat');

          if (savedView) {
            setCurrentView(savedView);
          }

          if (savedRoom) {
            try {
              const parsedRoom = JSON.parse(savedRoom);
              if (parsedRoom && parsedRoom.id && parsedRoom.name) {
                setCurrentRoom(parsedRoom);
              }
            } catch (_) {}
          }

          if (savedPrivateChat) {
            try {
              const parsedChat = JSON.parse(savedPrivateChat);
              if (parsedChat && parsedChat.chatId && parsedChat.otherUsername) {
                setCurrentPrivateChat(parsedChat);
              }
            } catch (_) {}
          }
          
          console.log('Session restored successfully for user:', savedUsername);
        }
      } catch (error) {
        console.error('App initialization failed:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeApp();

    // Cleanup function to prevent memory leaks
    return () => {
      console.log('🧹 App component unmounting - cleaning up Firebase listeners');
      try {
        firebaseService.cleanup();
      } catch (error) {
        console.warn('Error during cleanup:', error);
      }
    };
  }, []);

  // Persist navigation state so refresh resumes where user left off
  useEffect(() => {
    if (username) {
      localStorage.setItem('currentView', currentView);
    }
  }, [username, currentView]);

  useEffect(() => {
    if (username) {
      if (currentRoom) {
        localStorage.setItem('currentRoom', JSON.stringify(currentRoom));
      } else {
        localStorage.removeItem('currentRoom');
      }
    }
  }, [username, currentRoom]);

  useEffect(() => {
    if (username) {
      if (currentPrivateChat) {
        localStorage.setItem('currentPrivateChat', JSON.stringify(currentPrivateChat));
      } else {
        localStorage.removeItem('currentPrivateChat');
      }
    }
  }, [username, currentPrivateChat]);

  const handleUsernameSet = async (newUsername) => {
    try {
      // The user has already been created in the UsernameModal
      // Just set the username in the app state
      console.log('Setting username in app state:', newUsername);
      setUsername(newUsername);
      
      // Store username in localStorage for persistence (never expires)
      localStorage.setItem('username', newUsername);
      
      console.log('Session created for user:', newUsername, '(never expires)');
    } catch (error) {
      console.error('Error setting username in app state:', error);
      throw error;
    }
  };

  // Tab visibility tracking and heartbeat system
  useEffect(() => {
    if (!username) return;

    let heartbeatInterval;
    let isTabActive = true;

    // Function to update tab status
    const updateTabStatus = async (active) => {
      isTabActive = active;
      try {
        await firebaseService.updateUserTabStatus(username, active);
        if (active) {
          // Send immediate heartbeat when tab becomes active
          await firebaseService.sendHeartbeat(username);
        }
      } catch (error) {
        console.error('Error updating tab status:', error);
      }
    };

    // Function to send heartbeat
    const sendHeartbeat = async () => {
      if (isTabActive) {
        try {
          await firebaseService.sendHeartbeat(username);
        } catch (error) {
          console.error('Error sending heartbeat:', error);
        }
      }
    };

    // Tab visibility change handler
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      updateTabStatus(isVisible);
    };

    // Page focus/blur handlers for better tracking
    const handleFocus = () => updateTabStatus(true);
    const handleBlur = () => updateTabStatus(false);

    // Set up event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    // Start heartbeat (every 10 seconds for more accurate tracking)
    heartbeatInterval = setInterval(sendHeartbeat, 10000);

    // Initial status update
    updateTabStatus(true);

    // Cleanup function
    return () => {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      
      // Set user as inactive when component unmounts
      if (username) {
        firebaseService.updateUserTabStatus(username, false).catch(console.error);
      }
    };
  }, [username]);

  // Handle browser/tab close - immediately mark user as inactive
  useEffect(() => {
    if (!username) return;

    const handleBeforeUnload = async () => {
      try {
        // Use sendBeacon for more reliable delivery during page unload
        if (navigator.sendBeacon) {
          const data = new FormData();
          data.append('username', username);
          data.append('action', 'userLeft');
          navigator.sendBeacon('/api/user-left', data);
        }
        
        // Use the new handleUserLeft method for better status tracking
        await firebaseService.handleUserLeft(username);
      } catch (error) {
        // Ignore errors during page unload
        console.log('User left the page');
      }
    };

    const handlePageHide = async () => {
      try {
        // Use the new handleUserLeft method for better status tracking
        await firebaseService.handleUserLeft(username);
      } catch (error) {
        // Ignore errors during page hide
        console.log('User left the page');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [username]);

  // Debug functions - only available in development
  const debugUsernameIssue = async (testUsername) => {
    if (process.env.NODE_ENV !== 'development') {
      console.warn('Debug functions are only available in development mode');
      return;
    }
    
    console.log('=== DEBUGGING USERNAME ISSUE ===');
    console.log('Test username:', testUsername);
    
    try {
      // List current users
      console.log('0. Current users in database:');
      await firebaseService.listAllUsers();
      
      // Clear all caches
      console.log('1. Clearing caches...');
      await firebaseService.clearCache();
      await firebaseService.clearIndexedDBCache();
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Force check username
      console.log('2. Force checking username...');
      const isAvailable = await firebaseService.forceCheckUsername(testUsername);
      console.log('Username available:', isAvailable);
      
      // Try to create user
      console.log('3. Attempting to create user...');
      await firebaseService.createUser(testUsername);
      console.log('✅ User created successfully!');
      
      // Clean up - delete the test user
      console.log('4. Cleaning up test user...');
      await firebaseService.forceDeleteUsername(testUsername);
      console.log('✅ Test user deleted successfully!');
      
    } catch (error) {
      console.error('❌ Debug failed:', error);
    }
  };

  // Function to clear a specific username that might be causing issues
  const clearUsername = async (usernameToClear) => {
    if (process.env.NODE_ENV !== 'development') {
      console.warn('Debug functions are only available in development mode');
      return;
    }
    
    console.log(`=== CLEARING USERNAME: ${usernameToClear} ===`);
    try {
      await firebaseService.forceDeleteUsername(usernameToClear);
      console.log(`✅ Username "${usernameToClear}" cleared successfully!`);
    } catch (error) {
      console.error(`❌ Failed to clear username "${usernameToClear}":`, error);
    }
  };

  // Debug functions removed for production security

  const handleLogout = async () => {
    if (!username) return;
    
    setIsLoggingOut(true);
    
    try {
      // Set user offline
      await firebaseService.updateUserStatus(username, false);
      
      // Delete the user account (this will trigger the Cloud Function to clean up all data)
      await firebaseService.deleteUserAccount();
      
      // Clear session
      localStorage.removeItem('username');
      setUsername(null);
      setCurrentView('home');
      setCurrentRoom(null);
    } catch (error) {
      console.error('Delete account error:', error);
      
      // If deletion fails, try to sign out and clean up manually
      try {
        // Try to get the current user UID before signing out
        const currentUser = firebaseService.auth.currentUser;
        const uid = currentUser?.uid;
        
        // Sign out
        await firebaseService.signOut();
        
        // If we have a UID, try manual cleanup
        if (uid) {
          try {
            await firebaseService.cleanupUserData(uid, username);
          } catch (cleanupError) {
            console.error('Manual cleanup failed:', cleanupError);
          }
        }
      } catch (signOutError) {
        console.error('Sign out error:', signOutError);
      }
      
      // Clear session regardless of errors
      localStorage.removeItem('username');
      setUsername(null);
      setCurrentView('home');
      setCurrentRoom(null);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleEditUsername = () => {
    setUsername(null);
    localStorage.removeItem('username');
    setCurrentView('home');
    setCurrentRoom(null);
    setCurrentPrivateChat(null);
  };

  const handleInviteAccepted = async (otherUsername) => {
    try {
      // Create chat ID (sorted usernames to ensure consistency)
      const sortedUsers = [username, otherUsername].sort();
      const chatId = firebaseService.getSafeChatId(sortedUsers[0], sortedUsers[1]);
      
      console.log('Handling invite acceptance for:', { username, otherUsername, chatId });
      
      // Check if private chat already exists before trying to create it
      const chatExists = await firebaseService.validateChatAccess(chatId, username);
      
      if (!chatExists) {
        // Only create the chat if it doesn't exist
        await firebaseService.createPrivateChat(username, otherUsername);
      } else {
        console.log('Private chat already exists, skipping creation:', chatId);
      }
      
      setCurrentPrivateChat({
        chatId,
        otherUsername
      });
      setCurrentView('private-chat');
    } catch (error) {
      console.error('Error handling invite acceptance:', error);
    }
  };

  const handleUserRemoved = (removedUsername) => {
    console.log('User removed from chat:', removedUsername);
    // Close the private chat and return to home
    setCurrentPrivateChat(null);
    setCurrentView('home');
  };

  const handleCloseModal = () => {
    setCurrentView('home');
  };

  // Sidebar resize handlers
  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleMouseMove = (e) => {
    if (!isResizing) return;
    
    // Store the current mouse position in the ref
    resizeRef.current = e.clientX;
    
    // Use requestAnimationFrame for smoother updates
    requestAnimationFrame(() => {
      if (resizeRef.current !== null) {
        const newWidth = resizeRef.current;
        const minWidth = 200; // Minimum sidebar width
        const maxWidth = Math.min(500, window.innerWidth * 0.4); // Max 40% of window width
        
        if (newWidth >= minWidth && newWidth <= maxWidth) {
          setSidebarWidth(newWidth);
        }
      }
    });
  };

  const handleMouseUp = () => {
    setIsResizing(false);
    resizeRef.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  const handleDoubleClick = () => {
    setSidebarWidth(256); // Reset to default width
  };

  // Add global mouse event listeners for resizing
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing]);

  // Listen for message count updates from PublicChat
  useEffect(() => {
    const handleMessageCountUpdate = (event) => {
      setMessageCount(event.detail.count);
    };

    window.addEventListener('messageCountUpdate', handleMessageCountUpdate);
    
    return () => {
      window.removeEventListener('messageCountUpdate', handleMessageCountUpdate);
    };
  }, []);

  // Save sidebar width to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('sidebarWidth', sidebarWidth.toString());
  }, [sidebarWidth]);

  // Handle window resize to adjust sidebar width if needed
  useEffect(() => {
    const handleWindowResize = () => {
      const minWidth = 200;
      const maxWidth = Math.min(500, window.innerWidth * 0.4); // Max 40% of window width
      
      if (sidebarWidth < minWidth) {
        setSidebarWidth(minWidth);
      } else if (sidebarWidth > maxWidth) {
        setSidebarWidth(maxWidth);
      }
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [sidebarWidth]);

  // Create a stable navigation handler to prevent infinite loops
  const handleViewChange = useCallback((newView) => {
    if (isNavigating || navigationRef.current) {
      console.log('🚫 Skipping view change - navigation in progress');
      return;
    }
    
    // Debounce view changes to prevent rapid successive attempts
    const now = Date.now();
    if (now - lastNavigationTime.current < 200) {
      console.log('🚫 Skipping view change - too soon after last navigation');
      return;
    }
    
    console.log('🔄 Changing view to:', newView);
    
    // Start smooth transition
    setViewTransition(true);
    
    // Small delay for smooth transition effect
    setTimeout(() => {
      setCurrentView(newView);
      setViewTransition(false);
    }, 150);
    
    lastNavigationTime.current = now; // Update last navigation time
  }, [isNavigating]);

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#181818' }}>
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!username) {
    return <UsernameModal onUsernameSet={handleUsernameSet} />;
  }

  return (
    <div className="App h-screen overflow-hidden">
      {/* Removal Notification Handler - Invisible component that listens for notifications */}
      <RemovalNotification 
        currentUser={firebaseService.auth.currentUser} 
        onUserRemoved={handleUserRemoved}
      />
      
      {/* Main Layout */}
      <div className="flex h-full">
        
        {/* Security Warning */}
        {securityWarning && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg max-w-md text-center">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">{securityWarning}</span>
            </div>
          </div>
        )}
        {/* Left Sidebar - Hidden on small screens */}
        <div 
          className={`hidden lg:block h-screen overflow-hidden backdrop-blur-md border-r border-gray-800/50 ${
            isResizing ? '' : 'transition-all duration-200'
          }`}
          style={{ width: `${sidebarWidth}px`, backgroundColor: '#181818' }}
        >
          <Sidebar
            currentView={currentView}
            onViewChange={handleViewChange}
            username={username}
            onLogout={handleLogout}
            isLoggingOut={isLoggingOut}
            onEditUsername={handleEditUsername}
            onInviteAccepted={handleInviteAccepted}
            onRoomSelect={(room) => {
              console.log('Room selected in App.js:', room);
              setCurrentRoom({ id: room.id, name: room.name });
              setCurrentView('private-room');
            }}
            sidebarWidth={sidebarWidth}
          />
        </div>

        {/* Resize Handle */}
        <div 
          className={`hidden lg:block w-1 cursor-col-resize transition-colors duration-200 group relative ${
            isResizing 
              ? 'bg-blue-500/70' 
              : 'bg-gray-700/50 hover:bg-gray-600/70'
          }`}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          title="Drag to resize sidebar • Double-click to reset"
        >
                     <div className={`absolute inset-0 flex items-center justify-center ${
             isResizing ? 'bg-[#303030]' : 'bg-[#1d1d1d]'
           }`}>
            <div className={`w-0.5 h-8 transition-colors duration-200 ${
              isResizing 
                ? 'bg-blue-400/90' 
                : 'bg-gray-500/50 group-hover:bg-gray-400/70'
            }`}></div>
          </div>
          {/* Resize indicator */}
          {isResizing && (
            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-20">
              {sidebarWidth}px
            </div>
          )}
          {/* Hover indicator */}
          <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded whitespace-nowrap z-10">
            {sidebarWidth}px
          </div>
        </div>

        {/* Center Content Area */}
        <div className="flex-1 h-full overflow-hidden">
          {currentView === 'home' && (
            <div className="h-full flex flex-col">
              {/* Fixed header that stays visible even when mobile keyboard appears */}
              <div
                className="fixed top-0 backdrop-blur-sm border-b border-gray-700/50 p-4 z-50"
                style={{
                  left: typeof window !== 'undefined' && window.innerWidth >= 1024 ? `${sidebarWidth}px` : '0px',
                  right: typeof window !== 'undefined' && window.innerWidth >= 1280 ? '320px' : '0px',
                  backgroundColor: '#212121'
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {/* Hamburger Menu - Mobile Only */}
                    <button
                      onClick={() => setCurrentView('mobile-menu')}
                      className="lg:hidden text-gray-300 hover:text-white transition-colors p-1"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                    </button>
                    <h1 className="text-2xl font-bold text-white text-left">Public Chat</h1>
                  </div>
                  <div className="flex items-center space-x-3">
                    {/* Message Count */}
                    <div className="flex items-center space-x-2 p-2 hover:bg-[#303030] disabled:bg-gray-600/20 rounded-lg transition-all duration-200">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{backgroundColor: '#303030'}}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <span className="text-gray-300 font-medium">{messageCount}</span>
                    </div>
                    {/* Notification Bell */}
                    <NotificationBell username={username} />
                    <button
                      onClick={() => {
                        setIsRefreshing(true);
                        // Trigger refresh in PublicChat component
                        const event = new CustomEvent('refreshPublicChat');
                        window.dispatchEvent(event);
                        // Reset loading state after a short delay
                        setTimeout(() => setIsRefreshing(false), 1000);
                      }}
                      disabled={isRefreshing}
                                             className="p-2 hover:bg-[#303030] disabled:bg-gray-600/20 rounded-lg transition-all duration-200"
                      title="Refresh messages"
                    >
                      {isRefreshing ? (
                        <svg className="w-5 h-5 text-gray-400/70 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-gray-400/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
              {/* Scrollable messages area with top padding to account for fixed header */}
              <div className="flex-1 overflow-y-auto min-h-0 pt-20" style={{ backgroundColor: '#212121' }}>
                <PublicChat username={username} sidebarWidth={sidebarWidth} />
              </div>
            </div>
          )}

          {currentView === 'private-room' && currentRoom && (
            <div className="h-full flex flex-col">
              {/* Fixed header to avoid keyboard scroll push on mobile */}
              <div
                className="fixed top-0 z-50 backdrop-blur-sm border-b border-gray-700/50 p-4"
                style={{
                  left: typeof window !== 'undefined' && window.innerWidth >= 1024 ? `${sidebarWidth}px` : '0px',
                  right: typeof window !== 'undefined' && window.innerWidth >= 1280 ? '320px' : '0px',
                  backgroundColor: '#212121'
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {/* Hamburger Menu - Mobile Only */}
                    <button
                      onClick={() => setCurrentView('mobile-menu')}
                      className="lg:hidden text-gray-300 hover:text-white transition-colors p-1"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                    </button>
                    <h1 className="text-2xl font-bold text-white">Private Room: {currentRoom.name}</h1>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => setCurrentView('home')}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
              {/* Scroll area offset by header height */}
              <div className="flex-1 overflow-y-auto pt-16" style={{ backgroundColor: '#212121' }}>
                <PrivateRoom
                  roomId={currentRoom.id}
                  roomName={currentRoom.name}
                  username={username}
                  onViewChange={handleViewChange}
                  onLeaveRoom={() => {
                    setCurrentView('home');
                    setCurrentRoom(null);
                  }}
                />
              </div>
            </div>
          )}

          {/* Join Room Modal */}
          {currentView === 'join-room' && (
            <JoinRoom
              username={username}
              onJoinRoom={(roomId, roomName) => {
                setCurrentRoom({ id: roomId, name: roomName });
                setCurrentView('private-room');
              }}
              onClose={handleCloseModal}
            />
          )}

          {/* Create Room Modal */}
          {currentView === 'create-room' && (
            <CreateRoom
              username={username}
              onCreateRoom={(roomId, roomName) => {
                if (roomId && roomName) {
                  setCurrentRoom({ id: roomId, name: roomName });
                  setCurrentView('private-room');
                } else {
                  // If roomId is null, switch to join room view
                  setCurrentView('join-room');
                }
              }}
              onClose={handleCloseModal}
            />
          )}

          {/* Private Chat */}
          {currentView === 'private-chat' && currentPrivateChat && (
            <div className="h-full flex flex-col">
              {/* Fixed header to avoid keyboard scroll push on mobile */}
              <div
                className="fixed top-0 z-50 backdrop-blur-sm border-b border-gray-700/50 p-4"
                style={{
                  left: typeof window !== 'undefined' && window.innerWidth >= 1024 ? `${sidebarWidth}px` : '0px',
                  right: typeof window !== 'undefined' && window.innerWidth >= 1280 ? '320px' : '0px',
                  backgroundColor: '#212121'
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {/* Hamburger Menu - Mobile Only */}
                    <button
                      onClick={() => setCurrentView('mobile-menu')}
                      className="lg:hidden text-gray-300 hover:text-white transition-colors p-1"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                    </button>
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 lg:w-10 lg:h-10 bg-purple-600/20 border border-purple-500/30 rounded-full flex items-center justify-center">
                        <span className="text-purple-400 font-bold text-lg">
                          {currentPrivateChat.otherUsername.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h1 className="text-2xl font-bold text-white/90">{currentPrivateChat.otherUsername}</h1>
                        <p className="hidden lg:block text-purple-400/70 text-sm">Private Chat</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={async () => {
                        if (window.confirm(`Are you sure you want to remove ${currentPrivateChat.otherUsername} from this private chat?`)) {
                          try {
                            await firebaseService.removeUserFromPrivateChat(currentPrivateChat.chatId, currentPrivateChat.otherUsername);
                            if (handleUserRemoved) {
                              handleUserRemoved(currentPrivateChat.otherUsername);
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
                      onClick={() => {
                        console.log('🚪 Exit button clicked - setting view to home');
                        setCurrentView('home');
                        setCurrentPrivateChat(null);
                      }}
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
              {/* Scroll area offset by header height */}
              <div className="flex-1 overflow-y-auto pt-16" style={{ backgroundColor: '#212121' }}>
                <PrivateChat
                  chatId={currentPrivateChat.chatId}
                  otherUsername={currentPrivateChat.otherUsername}
                  username={username}
                  onClose={() => {
                    console.log('💬 PrivateChat onClose called - setting view to home');
                    setCurrentView('home');
                    setCurrentPrivateChat(null);
                  }}
                  onUserRemoved={handleUserRemoved}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Hidden on screens < 900px */}
        <div className="hidden xl:block w-80 h-screen overflow-hidden" style={{ backgroundColor: '#181818' }}>
          <StatsSidebar />
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {currentView === 'mobile-menu' && (
        <div className="lg:hidden fixed inset-0 z-50 backdrop-blur-md" style={{ backgroundColor: '#181818' }}>
          <div className="flex h-full">
            {/* Sidebar Content */}
            <div className="w-64 h-full overflow-y-auto" style={{ backgroundColor: '#181818' }}>
              <Sidebar
                currentView={currentView}
                onViewChange={handleViewChange}
                username={username}
                onLogout={handleLogout}
                isLoggingOut={isLoggingOut}
                onEditUsername={handleEditUsername}
                onInviteAccepted={handleInviteAccepted}
                onRoomSelect={(room) => {
                  setCurrentRoom({ id: room.id, name: room.name });
                  setCurrentView('private-room');
                }}
              />
            </div>

            {/* Tap to close area */}
            <div className="flex-1" onClick={() => setCurrentView('home')}></div>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
