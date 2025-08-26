import React, { useState } from 'react';
import firebaseService from '../lib/firebase';

const CreateRoom = ({ username, onRoomCreated, onClose }) => {
  const [roomName, setRoomName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!roomName.trim()) return;

    setIsCreating(true);
    setError('');

    try {
      const roomId = await firebaseService.createRoom(roomName.trim(), username);
      const room = await firebaseService.getRoom(roomId);
      onRoomCreated(roomId, room.name);
    } catch (error) {
      console.error('Error creating room:', error);
      setError(error.message || 'Failed to create room');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50" onClick={onClose}>
      <div className="glass rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-center mb-6 relative">
          <button
            onClick={onClose}
            className="absolute top-0 right-0 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h2 className="text-2xl font-bold text-white mb-2">Create Private Room</h2>
          <p className="text-gray-300">Create a new private chatroom and invite others</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="roomName" className="block text-sm font-medium text-gray-300 mb-2">
              Room Name
            </label>
            <input
              type="text"
              id="roomName"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent text-white placeholder-gray-400"
              placeholder="Enter room name"
              disabled={isCreating}
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-900 bg-opacity-20 p-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isCreating || !roomName.trim()}
            className="w-full bg-gray-600 hover:bg-gray-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            {isCreating ? 'Creating...' : 'Create Room'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-400 text-sm">
            Already have a room code?{' '}
            <button
              onClick={() => onRoomCreated(null)} // This will trigger join room view
              className="text-gray-400 hover:text-gray-300 underline"
            >
              Join existing room
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default CreateRoom;
