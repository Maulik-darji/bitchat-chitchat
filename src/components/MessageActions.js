import React, { useState, useRef, useEffect } from 'react';
import firebaseService from '../lib/firebase';

const MessageActions = ({ 
  message, 
  isCurrentUser, 
  onReply, 
  onUnsend, 
  onEdit,
  showEdit = true,
  className = "",
  onClose,
  username // Add username prop
}) => {
  const [isLongPressed, setIsLongPressed] = useState(false);
  const longPressTimer = useRef(null);
  const isDesktop = typeof window !== 'undefined' && !(window.matchMedia && window.matchMedia('(pointer:coarse)').matches);

  // Handle long press for mobile
  const handleTouchStart = () => {
    if (isDesktop) return;
    
    longPressTimer.current = setTimeout(() => {
      setIsLongPressed(true);
    }, 500); // 500ms long press
  };

  const handleTouchEnd = () => {
    if (isDesktop) return;
    
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTouchMove = () => {
    if (isDesktop) return;
    
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Close actions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isLongPressed && !event.target.closest('.message-actions')) {
        setIsLongPressed(false);
        // Call onClose if provided
        if (onClose) {
          onClose();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isLongPressed, onClose]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  // Track user activity when interacting with message actions
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
    const events = ['mousedown', 'mousemove', 'keydown', 'click'];
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

  const handleReply = () => {
    onReply(message);
    setIsLongPressed(false);
    // Call onClose if provided
    if (onClose) {
      onClose();
    }
  };

  const handleUnsend = () => {
    if (window.confirm('Are you sure you want to unsend this message? This action cannot be undone.')) {
      onUnsend(message.id);
      setIsLongPressed(false);
      // Call onClose if provided
      if (onClose) {
        onClose();
      }
    }
  };

  const handleEdit = () => {
    onEdit(message);
    setIsLongPressed(false);
    // Call onClose if provided
    if (onClose) {
      onClose();
    }
  };

  // Don't render anything if not long-pressed (mobile) and not hovered (desktop)
  // Hover state is managed by parent components
  if (!isLongPressed) {
    return null;
  }

  return (
    <div 
      className={`message-actions absolute -top-2 -left-2 bg-gray-800/95 backdrop-blur-sm border border-gray-600/50 rounded-lg shadow-lg z-50 ${className}`}
      style={{
        minWidth: '160px',
        transform: 'translateY(-100%)'
      }}
    >
      <div className="flex flex-col p-1">
        {/* Reply Button */}
        <button
          onClick={handleReply}
          className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-md transition-colors duration-150"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
          <span>Reply</span>
        </button>

        {/* Edit Button - Only show for current user's messages */}
        {isCurrentUser && showEdit && (
          <button
            onClick={handleEdit}
            className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-md transition-colors duration-150"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>Edit</span>
          </button>
        )}

        {/* Unsend Button - Only show for current user's messages */}
        {isCurrentUser && (
          <button
            onClick={handleUnsend}
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
  );
};

export default MessageActions;
