import React, { useState, useEffect } from 'react';
import { getUnreadNotificationCount } from '../lib/notifications';
import NotificationCenter from './NotificationCenter';

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

  const handleBellClick = () => {
    setShowNotificationCenter(true);
  };

  const handleCloseNotificationCenter = () => {
    setShowNotificationCenter(false);
  };

  return (
    <>
      <button
        onClick={handleBellClick}
        className="relative p-2 text-gray-400 hover:text-white transition-colors duration-200 rounded-lg hover:bg-gray-700/50"
        title="Notifications"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4 19h6a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        
        {/* Unread count badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] h-[18px] flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

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
