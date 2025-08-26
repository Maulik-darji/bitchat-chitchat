import React, { useState } from 'react';
import firebaseService from '../lib/firebase';

const JoinRoom = ({ username, onJoinRoom, onClose }) => {
  const [roomCode, setRoomCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!roomCode.trim()) return;

    setIsJoining(true);
    setError('');

    try {
      const room = await firebaseService.joinRoom(roomCode.trim(), username);
      onJoinRoom(room.id, room.name);
    } catch (error) {
      console.error('Error joining room:', error);
      setError(error.message || 'Failed to join room');
    } finally {
      setIsJoining(false);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setRoomCode(text);
    } catch (error) {
      console.error('Failed to read clipboard:', error);
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
          <h2 className="text-2xl font-bold text-white mb-2">Join Private Room</h2>
          <p className="text-gray-300">Enter the room code or paste from clipboard</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="roomCode" className="block text-sm font-medium text-gray-300 mb-2">
              Room Code
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                id="roomCode"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                className="flex-1 px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent text-white placeholder-gray-400"
                placeholder="Enter room code"
                disabled={isJoining}
              />
              <button
                type="button"
                onClick={handlePasteFromClipboard}
                className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                title="Paste from clipboard"
              >
                📋
              </button>
            </div>
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-900 bg-opacity-20 p-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isJoining || !roomCode.trim()}
            className="w-full bg-gray-600 hover:bg-gray-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            {isJoining ? 'Joining...' : 'Join Room'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-400 text-sm">
            Don't have a room code?{' '}
            <button
              onClick={() => onJoinRoom(null)} // This will trigger create room view
              className="text-gray-400 hover:text-gray-300 underline"
            >
              Create a new room
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default JoinRoom;
