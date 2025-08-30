import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import firebaseService from '../lib/firebase';

const JoinedRooms = ({ username, onRoomSelect, onViewChange }) => {
  const [joinedRooms, setJoinedRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!username) return;

    const setupListener = async () => {
      try {
        // Get rooms that the user has joined
        const unsubscribe = firebaseService.onMyJoinedRoomsUpdate(username, (roomsList) => {
          console.log('Joined Rooms received:', roomsList);
          setJoinedRooms(roomsList);
          setIsLoading(false);
        });

        return unsubscribe;
      } catch (error) {
        console.error('Error setting up joined rooms listener:', error);
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

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h3 className="text-gray-400/80 font-semibold text-sm lg:text-base">
          Joined Rooms
        </h3>
        <div className="text-gray-500/70 text-xs lg:text-sm">Loading...</div>
      </div>
    );
  }

  if (joinedRooms.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-gray-400/80 font-semibold text-sm lg:text-base">
          Joined Rooms
        </h3>
        <div className="text-gray-500/70 text-xs lg:text-sm">No rooms joined yet</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-gray-400/80 font-semibold text-sm lg:text-base">
        Joined Rooms (Others' Rooms)
      </h3>
      
      <div className="space-y-2">
        {joinedRooms.map((room) => (
          <div
            key={room.id}
            className="bg-gray-800/30 hover:bg-gray-800/50 border border-gray-700/50 rounded-lg p-3 transition-all duration-200 group"
          >
            <div className="flex items-center justify-between">
              <Link
                to={`/room/${room.id}`}
                onClick={() => {
                  console.log('Joined Room clicked:', room);
                  onRoomSelect(room);
                }}
                className="flex-1 text-left hover:text-white/90 transition-colors"
              >
                <div className="font-medium text-white/90 text-sm lg:text-base mb-1">
                  {room.name}
                </div>
                <div className="text-gray-400/70 text-xs lg:text-sm">
                  Created by {room.createdBy}
                </div>
                <div className="text-gray-500/70 text-xs lg:text-sm">
                  {room.createdAt?.toDate ? room.createdAt.toDate().toLocaleDateString() : 'Recently'}
                </div>
                <div className="text-gray-500/70 text-xs lg:text-sm">
                  {room.members?.length || 0} member{(room.members?.length || 0) !== 1 ? 's' : ''}
                </div>
              </Link>
              
              <button
                onClick={async () => {
                  const confirmed = window.confirm(
                    `Are you sure you want to leave the room "${room.name}"?\n\nThis will:\n• Remove you from the room\n• You won't be able to see messages anymore\n• You can rejoin later if you have the room code`
                  );
                  
                  if (confirmed) {
                    // Redirect immediately
                    if (typeof onViewChange === 'function') {
                      onViewChange('home');
                    }
                    
                    try {
                      await firebaseService.leaveRoom(room.id, username);
                      console.log('Left room successfully');
                    } catch (error) {
                      console.error('Error leaving room:', error);
                      alert('Failed to leave room. Please try again.');
                    }
                  }
                }}
                className="text-gray-400/70 hover:text-red-400 hover:bg-red-900/20 p-2 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100 flex-shrink-0"
                title={`Leave ${room.name}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a1 1 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default JoinedRooms;
