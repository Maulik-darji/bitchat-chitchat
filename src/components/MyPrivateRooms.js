import React, { useState, useEffect } from 'react';
import firebaseService from '../lib/firebase';

const MyPrivateRooms = ({ username, onRoomSelect, sidebarWidth = 256 }) => {
  const [myRooms, setMyRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingRoom, setDeletingRoom] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedRooms, setSelectedRooms] = useState(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [isDeletingMultiple, setIsDeletingMultiple] = useState(false);

  useEffect(() => {
    if (!username) return;

    const setupListener = async () => {
      try {
        // Get rooms created by the current user
        const unsubscribe = firebaseService.onMyRoomsUpdate(username, (roomsList) => {
          console.log('My Private Rooms received:', roomsList);
          setMyRooms(roomsList);
          setIsLoading(false);
        });

        return unsubscribe;
      } catch (error) {
        console.error('Error setting up my rooms listener:', error);
        setIsLoading(false);
      }
    };

    const cleanup = setupListener();
    return () => {
      if (cleanup && typeof cleanup === 'function') {
        cleanup();
      }
    };
  }, [username]);

  const handleDeleteRoom = async (roomId, roomName) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete the room "${roomName}"?\n\nThis will:\n• Permanently delete the room\n• Remove all messages in the room\n• Remove all members from the room\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingRoom(roomId);
    try {
      await firebaseService.deleteRoom(roomId);
      console.log('Room deleted successfully');
    } catch (error) {
      console.error('Error deleting room:', error);
      alert('Failed to delete room. Please try again.');
    } finally {
      setDeletingRoom(null);
    }
  };

  const handleCopyRoomCode = async (roomCode) => {
    try {
      await navigator.clipboard.writeText(roomCode);
      console.log('Room code copied to clipboard');
    } catch (error) {
      console.error('Failed to copy room code:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = roomCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  };

  const toggleMultiSelectMode = () => {
    setIsMultiSelectMode(!isMultiSelectMode);
    if (isMultiSelectMode) {
      setSelectedRooms(new Set()); // Clear selections when exiting multi-select
    }
  };

  const toggleRoomSelection = (roomId) => {
    const newSelectedRooms = new Set(selectedRooms);
    if (newSelectedRooms.has(roomId)) {
      newSelectedRooms.delete(roomId);
    } else {
      newSelectedRooms.add(roomId);
    }
    setSelectedRooms(newSelectedRooms);
  };

  const selectAllRooms = () => {
    if (selectedRooms.size === myRooms.length) {
      setSelectedRooms(new Set()); // Deselect all
    } else {
      setSelectedRooms(new Set(myRooms.map(room => room.id))); // Select all
    }
  };

  const deleteSelectedRooms = async () => {
    if (selectedRooms.size === 0) return;

    const roomNames = myRooms
      .filter(room => selectedRooms.has(room.id))
      .map(room => room.name)
      .join(', ');

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedRooms.size} room${selectedRooms.size > 1 ? 's' : ''}?\n\nRooms to delete: ${roomNames}\n\nThis will:\n• Permanently delete all selected rooms\n• Remove all messages in these rooms\n• Remove all members from these rooms\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    setIsDeletingMultiple(true);
    try {
      const deletePromises = Array.from(selectedRooms).map(roomId => 
        firebaseService.deleteRoom(roomId)
      );
      await Promise.all(deletePromises);
      console.log('All selected rooms deleted successfully');
      setSelectedRooms(new Set());
      setIsMultiSelectMode(false);
    } catch (error) {
      console.error('Error deleting rooms:', error);
      alert('Failed to delete some rooms. Please try again.');
    } finally {
      setIsDeletingMultiple(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className={`text-gray-400/80 font-semibold flex items-center ${
            sidebarWidth < 280 ? 'text-xs' : sidebarWidth < 320 ? 'text-sm' : 'text-sm lg:text-base'
          }`}>
            <svg className={`${
              sidebarWidth < 280 ? 'w-3 h-3 mr-1.5' : sidebarWidth < 320 ? 'w-3.5 h-3.5 mr-2' : 'w-4 h-4 mr-2'
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            My Private Rooms
          </h3>
        </div>
        <div className={`text-gray-500/70 ${
          sidebarWidth < 280 ? 'text-xs' : sidebarWidth < 320 ? 'text-xs' : 'text-xs lg:text-sm'
        }`}>Loading...</div>
      </div>
    );
  }

  if (myRooms.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className={`text-gray-400/80 font-semibold flex items-center ${
            sidebarWidth < 280 ? 'text-xs' : sidebarWidth < 320 ? 'text-sm' : 'text-sm lg:text-base'
          }`}>
            <svg className={`${
              sidebarWidth < 280 ? 'w-3 h-3 mr-1.5' : sidebarWidth < 320 ? 'w-3.5 h-3.5 mr-2' : 'w-4 h-4 mr-2'
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            My Private Rooms
          </h3>
        </div>
        <div className={`text-gray-500/70 ${
          sidebarWidth < 280 ? 'text-xs' : sidebarWidth < 320 ? 'text-xs' : 'text-xs lg:text-sm'
        }`}>No rooms created yet</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className={`text-gray-400/80 font-semibold flex items-center ${
          sidebarWidth < 280 ? 'text-xs' : sidebarWidth < 320 ? 'text-sm' : 'text-sm lg:text-base'
        }`}>
          <svg className={`${
            sidebarWidth < 280 ? 'w-3 h-3 mr-1.5' : sidebarWidth < 320 ? 'w-3.5 h-3.5 mr-2' : 'w-4 h-4 mr-2'
          }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          My Private Rooms
        </h3>
        
        <div className="flex items-center space-x-1">
          {isExpanded && (
            <button
              onClick={toggleMultiSelectMode}
              className={`text-gray-400/70 hover:text-gray-300 transition-all duration-200 ${
                sidebarWidth < 280 ? 'p-1' : sidebarWidth < 320 ? 'p-1.5' : 'p-2'
              } ${isMultiSelectMode ? 'text-blue-400' : ''}`}
              title={isMultiSelectMode ? "Exit multi-select" : "Multi-select rooms"}
            >
              <svg 
                className={`${
                  sidebarWidth < 280 ? 'w-3 h-3' : sidebarWidth < 320 ? 'w-3.5 h-3.5' : 'w-4 h-4'
                }`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`text-gray-400/70 hover:text-gray-300 transition-all duration-200 ${
              sidebarWidth < 280 ? 'p-1' : sidebarWidth < 320 ? 'p-1.5' : 'p-2'
            }`}
            title={isExpanded ? "Collapse rooms" : "Expand rooms"}
          >
            <svg 
              className={`${
                sidebarWidth < 280 ? 'w-3 h-3' : sidebarWidth < 320 ? 'w-3.5 h-3.5' : 'w-4 h-4'
              } transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>
      
      {isExpanded && (
        <>
          {isMultiSelectMode && (
            <div className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-3 mb-3">
              <div className="flex items-center justify-between mb-3">
                <span className={`text-gray-300 font-medium ${
                  sidebarWidth < 280 ? 'text-xs' : sidebarWidth < 320 ? 'text-sm' : 'text-sm'
                }`}>
                  {selectedRooms.size} of {myRooms.length} selected
                </span>
                <button
                  onClick={selectAllRooms}
                  className={`text-blue-400/70 hover:text-blue-300 transition-all duration-200 ${
                    sidebarWidth < 280 ? 'text-xs px-2 py-1' : sidebarWidth < 320 ? 'text-xs px-2.5 py-1' : 'text-sm px-3 py-1.5'
                  }`}
                >
                  {selectedRooms.size === myRooms.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              
              {selectedRooms.size > 0 && (
                <div className="flex space-x-2">
                  <button
                    onClick={deleteSelectedRooms}
                    disabled={isDeletingMultiple}
                    className={`bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/50 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                      sidebarWidth < 280 ? 'text-xs px-2 py-1' : sidebarWidth < 320 ? 'text-xs px-2.5 py-1' : 'text-sm px-3 py-1.5'
                    }`}
                  >
                    {isDeletingMultiple ? (
                      <div className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Deleting...
                      </div>
                    ) : (
                      `Delete ${selectedRooms.size} Room${selectedRooms.size > 1 ? 's' : ''}`
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
          
          <div className="space-y-2">
          {myRooms.map((room) => (
            <div
              key={room.id}
                              className="rounded-lg p-3 transition-all duration-200 group" style={{backgroundColor: '#222222'}}
            >
                          <div className="flex items-center justify-between">
              {isMultiSelectMode && (
                <div className="flex items-center mr-2">
                  <input
                    type="checkbox"
                    checked={selectedRooms.has(room.id)}
                    onChange={() => toggleRoomSelection(room.id)}
                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                  />
                </div>
              )}
              <button
                onClick={() => {
                  if (!isMultiSelectMode) {
                    console.log('My Private Room clicked:', room);
                    onRoomSelect(room);
                  } else {
                    toggleRoomSelection(room.id);
                  }
                }}
                className={`flex-1 text-left hover:text-white/90 transition-colors ${
                  isMultiSelectMode ? 'cursor-pointer' : ''
                }`}
              >
                  <div className={`font-medium text-white/90 mb-1 ${
                    sidebarWidth < 280 ? 'text-xs' : sidebarWidth < 320 ? 'text-sm' : 'text-sm lg:text-base'
                  }`}>
                    {room.name}
                  </div>
                  <div className={`text-gray-400/70 ${
                    sidebarWidth < 280 ? 'text-xs' : sidebarWidth < 320 ? 'text-xs' : 'text-xs lg:text-sm'
                  }`}>
                    Created {room.createdAt?.toDate ? room.createdAt.toDate().toLocaleDateString() : 'Recently'}
                  </div>
                  <div className={`text-gray-500/70 ${
                    sidebarWidth < 280 ? 'text-xs' : sidebarWidth < 320 ? 'text-xs' : 'text-xs lg:text-sm'
                  }`}>
                    {room.members?.length || 0} member{(room.members?.length || 0) !== 1 ? 's' : ''}
                  </div>
                </button>
                
                {!isMultiSelectMode && (
                  <button
                    onClick={() => handleDeleteRoom(room.id, room.name)}
                    disabled={deletingRoom === room.id}
                    className={`text-red-400/70 hover:text-red-300 rounded transition-all duration-200 opacity-0 group-hover:opacity-100 disabled:opacity-50 ${
                      sidebarWidth < 280 ? 'p-1' : sidebarWidth < 320 ? 'p-1.5' : 'p-1.5'
                    }`}
                    title="Delete room"
                  >
                    {deletingRoom === room.id ? (
                      <svg className={`${
                        sidebarWidth < 280 ? 'w-3 h-3' : sidebarWidth < 320 ? 'w-3.5 h-3.5' : 'w-4 h-4'
                      } animate-spin`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    ) : (
                      <svg className={`${
                        sidebarWidth < 280 ? 'w-3 h-3' : sidebarWidth < 320 ? 'w-3.5 h-3.5' : 'w-4 h-4'
                      }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        </>
      )}
    </div>
  );
};

export default MyPrivateRooms;
  