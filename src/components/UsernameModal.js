import React, { useState, useRef, useEffect } from 'react';
import firebaseService from '../lib/firebase';

const UsernameModal = ({ onUsernameSet }) => {
  const [username, setUsername] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const isSubmittingRef = useRef(false);

  // Cleanup effect
  useEffect(() => {
    return () => {
      isSubmittingRef.current = false;
    };
  }, []);

  // Reset errors and any stuck flags when user edits the input
  useEffect(() => {
    if (username) {
      setError('');
      setSuggestions([]);
      // Safety: ensure flags are released if previous attempt got stuck on some devices
      isSubmittingRef.current = false;
      setIsChecking(false);
    }
  }, [username]);

  const generateSuggestions = (baseUsername) => {
    const suggestions = [];
    for (let i = 1; i <= 5; i++) {
      suggestions.push(`${baseUsername}${Math.floor(Math.random() * 1000)}`);
    }
    return suggestions;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    // Prevent double submission using ref
    if (isSubmittingRef.current || isChecking) {
      console.log('Preventing double submission');
      return;
    }

    isSubmittingRef.current = true;
    setIsChecking(true);
    setError('');

    try {
      console.log('Creating user:', username.trim());
      // Try to create the user directly - this will fail if username already exists
      await firebaseService.createUser(username.trim());
      console.log('User created successfully, calling onUsernameSet');
      onUsernameSet(username.trim());
    } catch (err) {
      console.error('Error in handleSubmit:', err);
      if (err.message === 'Username already exists') {
        setError('Username is already taken');
        setSuggestions(generateSuggestions(username.trim()));
      } else {
        setError('Error creating username. Please try again.');
      }
    } finally {
      setIsChecking(false);
      isSubmittingRef.current = false;
    }
  };

  const handleSuggestionClick = async (suggestedUsername) => {
    // Prevent double submission using ref
    if (isSubmittingRef.current || isChecking) {
      console.log('Preventing double submission in suggestion click');
      return;
    }

    isSubmittingRef.current = true;
    setUsername(suggestedUsername);
    setIsChecking(true);
    setError('');

    try {
      console.log('Creating user from suggestion:', suggestedUsername);
      // Try to create the user directly - this will fail if username already exists
      await firebaseService.createUser(suggestedUsername);
      console.log('User created successfully from suggestion, calling onUsernameSet');
      onUsernameSet(suggestedUsername);
    } catch (err) {
      console.error('Error in handleSuggestionClick:', err);
      if (err.message === 'Username already exists') {
        setError('This suggestion is also taken, try another one');
      } else {
        setError('Error creating username. Please try again.');
      }
    } finally {
      setIsChecking(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass rounded-lg p-6 lg:p-8 w-full max-w-md mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl lg:text-3xl font-bold text-white mb-2">Welcome to Basicaly Chat</h1>
          <p className="text-gray-300 text-sm lg:text-base">Choose your username to get started</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent text-white placeholder-gray-400 text-sm lg:text-base"
              placeholder="Enter your username"
              disabled={isChecking}
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-900 bg-opacity-20 p-3 rounded-lg">
              {error}
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-gray-300">Try:</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-full transition-colors"
                    disabled={isChecking}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isChecking || !username.trim()}
            className="w-full bg-gray-600 hover:bg-gray-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors text-sm lg:text-base"
          >
            {isChecking ? 'Checking...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default UsernameModal;
