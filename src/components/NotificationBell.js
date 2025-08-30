import React, { useState, useEffect } from 'react';
import { getUnreadNotificationCount } from '../lib/notifications';
import NotificationCenter from './NotificationCenter';
import firebaseService from '../lib/firebase';

const NotificationBell = ({ username }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);

  useEffect(() => {
    if (!username) return;

    const unsubscribe = getUnreadNotificationCount(username, (count) => {
      setUnreadCount(count);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [username]);

  // Track user activity when interacting with notification bell
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

  const handleBellClick = () => {
    setShowNotificationCenter(true);
  };

  const handleCloseNotificationCenter = () => {
    setShowNotificationCenter(false);
  };

  return (
    <>
      <div>
        <button
          onClick={handleBellClick}
          className="relative p-2 text-gray-400 hover:text-white transition-colors duration-200 rounded-lg" style={{backgroundColor: '#303030'}}
          title="Notifications"
        >
          <span className="material-symbols-outlined text-2xl">
            {unreadCount > 0 ? 'notifications_unread' : 'notifications'}
          </span>
          
          {/* Unread count badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] h-[18px] flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Notification Center Modal */}
      <NotificationCenter
        username={username}
        isVisible={showNotificationCenter}
        onClose={handleCloseNotificationCenter}
      />
    </>
  );
};

export default NotificationBell;
