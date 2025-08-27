import React, { useState, useEffect, useRef } from 'react';
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

function App() {
  const [username, setUsername] = useState(null);
  const [currentView, setCurrentView] = useState('home');
  const [currentRoom, setCurrentRoom] = useState(null);
  const [currentPrivateChat, setCurrentPrivateChat] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebarWidth');
    return saved ? parseInt(saved) : 256;
  }); // Default 256px (w-64)
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef(null);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize Firebase
        await firebaseService.initialize();
        
        // Check for existing username in sessionStorage
        const savedUsername = sessionStorage.getItem('username');
        if (savedUsername) {
          setUsername(savedUsername);
          // Backfill uid onto legacy user doc so server cleanup works by UID
          await firebaseService.ensureUserUid(savedUsername);

          // Restore last view and context
          const savedView = sessionStorage.getItem('currentView');
          const savedRoom = sessionStorage.getItem('currentRoom');
          const savedPrivateChat = sessionStorage.getItem('currentPrivateChat');

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
        }
      } catch (error) {
        console.error('App initialization failed:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeApp();
  }, []);

  // Persist navigation state so refresh resumes where user left off
  useEffect(() => {
    if (username) {
      sessionStorage.setItem('currentView', currentView);
    }
  }, [username, currentView]);

  useEffect(() => {
    if (username) {
      if (currentRoom) {
        sessionStorage.setItem('currentRoom', JSON.stringify(currentRoom));
      } else {
        sessionStorage.removeItem('currentRoom');
      }
    }
  }, [username, currentRoom]);

  useEffect(() => {
    if (username) {
      if (currentPrivateChat) {
        sessionStorage.setItem('currentPrivateChat', JSON.stringify(currentPrivateChat));
      } else {
        sessionStorage.removeItem('currentPrivateChat');
      }
    }
  }, [username, currentPrivateChat]);

  const handleUsernameSet = async (newUsername) => {
    try {
      // The user has already been created in the UsernameModal
      // Just set the username in the app state
      console.log('Setting username in app state:', newUsername);
      setUsername(newUsername);
      sessionStorage.setItem('username', newUsername);
    } catch (error) {
      console.error('Error setting username in app state:', error);
      throw error;
    }
  };

  // Debug function - can be called from browser console
  const debugUsernameIssue = async (testUsername) => {
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
    console.log(`=== CLEARING USERNAME: ${usernameToClear} ===`);
    try {
      await firebaseService.forceDeleteUsername(usernameToClear);
      console.log(`✅ Username "${usernameToClear}" cleared successfully!`);
    } catch (error) {
      console.error(`❌ Failed to clear username "${usernameToClear}":`, error);
    }
  };

  // Make debug functions available globally
  useEffect(() => {
    window.debugUsernameIssue = debugUsernameIssue;
    window.clearUsername = clearUsername;
    window.listAllUsers = () => firebaseService.listAllAuthAndFirestoreUsers();
    console.log('Debug functions available:');
    console.log('- window.debugUsernameIssue(username)');
    console.log('- window.clearUsername(username)');
    console.log('- window.listAllUsers()');
  }, []);

  const handleLogout = async () => {
    if (!username) return;
    
    setIsLoggingOut(true);
    
    try {
      // Set user offline
      await firebaseService.updateUserStatus(username, false);
      
      // Delete the user account (this will trigger the Cloud Function to clean up all data)
      await firebaseService.deleteUserAccount();
      
      // Clear session
      sessionStorage.removeItem('username');
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
      sessionStorage.removeItem('username');
      setUsername(null);
      setCurrentView('home');
      setCurrentRoom(null);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleEditUsername = () => {
    setUsername(null);
    sessionStorage.removeItem('username');
    setCurrentView('home');
    setCurrentRoom(null);
    setCurrentPrivateChat(null);
  };

  const handleInviteAccepted = async (otherUsername) => {
    try {
      // Create chat ID (sorted usernames to ensure consistency)
      const sortedUsers = [username, otherUsername].sort();
      const chatId = `${sortedUsers[0]}_${sortedUsers[1]}`;
      
      console.log('Handling invite acceptance for:', { username, otherUsername, chatId });
      
      // Ensure the private chat exists
      await firebaseService.createPrivateChat(username, otherUsername);
      
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

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Initializing...</div>
      </div>
    );
  }

  if (!username) {
    return <UsernameModal onUsernameSet={handleUsernameSet} />;
  }

      return (
      <div className="App h-screen overflow-hidden">
        {/* Main Layout */}
      <div className="flex h-full">
        {/* Left Sidebar - Hidden on small screens */}
        <div 
          className={`hidden lg:block h-screen overflow-hidden bg-gray-900/95 backdrop-blur-md border-r border-gray-800/50 ${
            isResizing ? '' : 'transition-all duration-200'
          }`}
          style={{ width: `${sidebarWidth}px` }}
        >
          <Sidebar
            currentView={currentView}
            onViewChange={setCurrentView}
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
          <div className="absolute inset-0 flex items-center justify-center">
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
              {/* Fixed header to avoid keyboard scroll push on mobile */}
              <div
                className="fixed top-0 z-50 bg-gray-800/80 backdrop-blur-sm border-b border-gray-700/50 p-4"
                style={{
                  left: typeof window !== 'undefined' && window.innerWidth >= 1024 ? `${sidebarWidth}px` : '0px',
                  right: typeof window !== 'undefined' && window.innerWidth >= 1280 ? '320px' : '0px'
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
                  <button
                    onClick={() => {
                      // Trigger refresh in PublicChat component
                      const event = new CustomEvent('refreshPublicChat');
                      window.dispatchEvent(event);
                    }}
                    className="p-2 bg-gray-700/50 hover:bg-gray-600/50 disabled:bg-gray-600/20 rounded-lg border border-gray-600/50 hover:border-gray-500/50 disabled:border-gray-500/30 transition-all duration-200"
                    title="Refresh messages"
                  >
                    <svg className="w-5 h-5 text-gray-400/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </div>
              {/* Scroll area offset by header height */}
              <div className="flex-1 overflow-y-auto pt-16">
                <PublicChat username={username} sidebarWidth={sidebarWidth} />
              </div>
            </div>
          )}

          {currentView === 'private-room' && currentRoom && (
            <div className="h-full flex flex-col">
              {/* Fixed header to avoid keyboard scroll push on mobile */}
              <div
                className="fixed top-0 z-50 bg-gray-800/80 backdrop-blur-sm border-b border-gray-700/50 p-4"
                style={{
                  left: typeof window !== 'undefined' && window.innerWidth >= 1024 ? `${sidebarWidth}px` : '0px',
                  right: typeof window !== 'undefined' && window.innerWidth >= 1280 ? '320px' : '0px'
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
              {/* Scroll area offset by header height */}
              <div className="flex-1 overflow-y-auto pt-16">
                <PrivateRoom
                  roomId={currentRoom.id}
                  roomName={currentRoom.name}
                  username={username}
                  onViewChange={setCurrentView}
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
            <PrivateChat
              chatId={currentPrivateChat.chatId}
              otherUsername={currentPrivateChat.otherUsername}
              username={username}
              onClose={() => {
                setCurrentView('home');
                setCurrentPrivateChat(null);
              }}
              onUserRemoved={handleUserRemoved}
            />
          )}
        </div>

        {/* Right Sidebar - Hidden on screens < 900px */}
        <div className="hidden xl:block w-80 h-screen overflow-hidden">
          <StatsSidebar />
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {currentView === 'mobile-menu' && (
        <div className="lg:hidden fixed inset-0 z-50 bg-gray-900/95 backdrop-blur-md">
          <div className="flex h-full">
            {/* Sidebar Content */}
            <div className="w-64 h-full overflow-y-auto">
              <Sidebar
                currentView={currentView}
                onViewChange={setCurrentView}
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

export default App;
