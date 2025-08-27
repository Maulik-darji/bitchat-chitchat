import React, { useState, useEffect } from 'react';
import './App.css';
import UsernameModal from './components/UsernameModal';
import Sidebar from './components/Sidebar';
import PublicChat from './components/PublicChat';
import StatsSidebar from './components/StatsSidebar';
import JoinRoom from './components/JoinRoom';
import CreateRoom from './components/CreateRoom';
import PrivateRoom from './components/PrivateRoom';
import firebaseService from './lib/firebase';

function App() {
  const [username, setUsername] = useState(null);
  const [currentView, setCurrentView] = useState('home');
  const [currentRoom, setCurrentRoom] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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
        }
      } catch (error) {
        console.error('App initialization failed:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeApp();
  }, []);

  const handleUsernameSet = async (newUsername) => {
    try {
      await firebaseService.createUser(newUsername);
      setUsername(newUsername);
      sessionStorage.setItem('username', newUsername);
    } catch (error) {
      throw error;
    }
  };

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
  };

  const handleCloseModal = () => {
    setCurrentView('home');
  };

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
      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed top-4 left-4 z-40">
        <button
          onClick={() => setCurrentView('mobile-menu')}
          className="bg-gray-800/80 backdrop-blur-sm p-3 rounded-full text-gray-300 hover:text-white hover:bg-gray-700/80 transition-all duration-200 border border-gray-700/50 shadow-lg"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Main Layout */}
      <div className="flex h-full">
        {/* Left Sidebar - Hidden on small screens */}
        <div className="hidden lg:block w-64 h-screen overflow-hidden">
          <Sidebar
            currentView={currentView}
            onViewChange={setCurrentView}
            username={username}
            onLogout={handleLogout}
            isLoggingOut={isLoggingOut}
            onEditUsername={handleEditUsername}
          />
        </div>

        {/* Center Content Area */}
        <div className="flex-1 h-full overflow-hidden">
          {currentView === 'home' && (
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="bg-gray-800/80 backdrop-blur-sm border-b border-gray-700/50 p-4">
                <div className="flex items-center justify-between">
                  <h1 className="text-2xl font-bold text-white text-left">Public Chat</h1>
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
              
              {/* Chat Area */}
              <div className="flex-1 overflow-y-auto">
                <PublicChat username={username} />
              </div>
            </div>
          )}

          {currentView === 'private-room' && currentRoom && (
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="bg-gray-800/80 backdrop-blur-sm border-b border-gray-700/50 p-4">
                <div className="flex items-center justify-between">
                  <h1 className="text-2xl font-bold text-white">Private Room: {currentRoom.name}</h1>
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
              
              {/* Chat Area */}
              <div className="flex-1 overflow-y-auto">
                <PrivateRoom roomId={currentRoom.id} roomName={currentRoom.name} username={username} />
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
                setCurrentRoom({ id: roomId, name: roomName });
                setCurrentView('private-room');
              }}
              onClose={handleCloseModal}
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
              />
            </div>

            {/* Close Button Area */}
            <div className="flex-1 flex items-center justify-center">
              <button
                onClick={() => setCurrentView('home')}
                className="bg-gray-800/80 backdrop-blur-sm p-3 rounded-full text-gray-300 hover:text-white hover:bg-gray-700/80 transition-all duration-200 border border-gray-700/50 shadow-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18L6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
