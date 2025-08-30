import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  getUserNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead, 
  deleteNotification,
  deleteAllUserNotifications,
  getUnreadNotificationCount,
  NOTIFICATION_TYPES
} from '../lib/notifications';
import firebaseService from '../lib/firebase';

const NotificationCenter = ({ username, isVisible, onClose }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const modalRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!username || !isVisible) return;

    let unsubscribeNotifications;
    let unsubscribeUnreadCount;

    const setupNotifications = async () => {
      try {
        setIsLoading(true);
        
        // Listen for notifications
        unsubscribeNotifications = getUserNotifications(username, (notificationsList) => {
          setNotifications(notificationsList);
        });

        // Listen for unread count
        unsubscribeUnreadCount = getUnreadNotificationCount(username, (count) => {
          setUnreadCount(count);
        });
      } catch (error) {
        console.error('Error setting up notifications:', error);
      } finally {
        setIsLoading(false);
      }
    };

    setupNotifications();

    return () => {
      if (unsubscribeNotifications) unsubscribeNotifications();
      if (unsubscribeUnreadCount) unsubscribeUnreadCount();
    };
  }, [username, isVisible]);

  // Handle escape key press to close modal
  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape' && isVisible) {
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener('keydown', handleEscapeKey);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'unset';
    };
  }, [isVisible, onClose]);

  // Track user activity when interacting with notification center
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

  // Handle click outside modal to close
  const handleBackdropClick = (event) => {
    if (modalRef.current && !modalRef.current.contains(event.target)) {
      onClose();
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await markNotificationAsRead(notificationId);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead(username);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const handleDeleteNotification = async (notificationId) => {
    try {
      await deleteNotification(notificationId);
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleDeleteAllNotifications = async () => {
    if (window.confirm('Are you sure you want to delete all notifications?')) {
      try {
        await deleteAllUserNotifications(username);
      } catch (error) {
        console.error('Error deleting all notifications:', error);
      }
    }
  };

  const handleNotificationClick = (notification) => {
    // Use the actionUrl if available, otherwise construct based on type
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
      onClose();
      return;
    }
    
    // Fallback navigation based on notification type
    let url = '/';
    switch (notification.type) {
      case NOTIFICATION_TYPES.ROOM_JOIN:
        url = `/room/${notification.roomId}`;
        break;
      case NOTIFICATION_TYPES.INVITE_RECEIVED:
        url = `/invites`;
        break;
      case NOTIFICATION_TYPES.INVITE_ACCEPTED:
        url = `/room/${notification.roomId}`;
        break;
      case NOTIFICATION_TYPES.MESSAGE_RECEIVED:
        if (notification.messageType === 'room') {
          url = `/room/${notification.roomId}`;
        } else {
          url = `/private-chat/${notification.chatId}`;
        }
        break;
      default:
        url = '/';
        break;
    }
    navigate(url);
    onClose();
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case NOTIFICATION_TYPES.ROOM_JOIN:
        return (
          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        );
      case NOTIFICATION_TYPES.INVITE_RECEIVED:
        return (
          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
      case NOTIFICATION_TYPES.INVITE_ACCEPTED:
        return (
          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case NOTIFICATION_TYPES.MESSAGE_RECEIVED:
        return (
          <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  if (!isVisible) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-end z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div 
        ref={modalRef}
        className="rounded-lg shadow-xl w-full max-w-xs mx-auto flex flex-col max-h-[70vh] sm:max-h-[60vh] lg:mt-20 lg:mr-4 lg:max-w-sm" style={{backgroundColor: '#303030'}}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-bold text-white">Notifications</h2>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-blue-400 hover:text-blue-300 text-sm px-3 py-1 rounded-md hover:bg-blue-900/20 transition-colors hidden sm:block"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={handleDeleteAllNotifications}
              className="text-red-400 hover:text-red-300 text-sm px-3 py-1 rounded-md hover:bg-red-900/20 transition-colors hidden sm:block"
            >
              Clear all
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white bg-transparent hover:bg-gray-700/50 p-2 rounded-lg transition-all duration-200"
              title="Close notifications (ESC)"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile action buttons */}
        <div className="sm:hidden flex items-center justify-center space-x-2 p-3 border-b border-gray-700/50">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-blue-400 hover:text-blue-300 text-sm px-4 py-2 rounded-md hover:bg-blue-900/20 transition-colors flex-1"
            >
              Mark all read
            </button>
          )}
          <button
            onClick={handleDeleteAllNotifications}
            className="text-red-400 hover:text-red-300 text-sm px-4 py-2 rounded-md hover:bg-red-900/20 transition-colors flex-1"
          >
            Clear all
          </button>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center px-6 pt-24 pb-8 flex flex-col items-center justify-center min-h-[300px]">
              <div className="w-16 h-16 bg-gray-700/50 border border-gray-600/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-white text-2xl" style={{fontSize: '1.5rem'}}>
                  notifications
                </span>
                {/* Fallback icon in case Material Symbols doesn't load */}
                <svg className="w-8 h-8 text-white absolute" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{display: 'none'}}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4 19h6a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2zM9 17v1a3 3 0 003 3 3 3 0 003-3v-1" />
                </svg>
              </div>
              <p className="text-gray-300 text-lg font-semibold mb-2">No notifications yet</p>
              <p className="text-gray-400 text-sm mb-6">You're all caught up!</p>
              
              {/* Close button for empty state */}
              <button
                onClick={onClose}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-all duration-200 font-medium"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 rounded-lg border transition-all duration-200 cursor-pointer hover:bg-gray-700/30 ${
                    notification.status === 'unread'
                      ? 'bg-blue-900/20 border-blue-700/50'
                      : 'bg-gray-700/20 border-gray-600/50'
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-white">
                          {notification.message}
                        </p>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-400">
                            {formatTime(notification.createdAt)}
                          </span>
                          {notification.status === 'unread' && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                          )}
                          {/* Click indicator */}
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                      
                      {notification.messagePreview && (
                        <p className="text-sm text-gray-300 mt-1">
                          {notification.messagePreview}
                        </p>
                      )}
                      
                      <div className="flex items-center space-x-2 mt-3">
                        {notification.status === 'unread' && (
                          <button
                            onClick={() => handleMarkAsRead(notification.id)}
                            className="text-blue-400 hover:text-blue-300 text-xs px-2 py-1 rounded-md hover:bg-blue-900/20 transition-colors"
                          >
                            Mark as read
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteNotification(notification.id)}
                          className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded-md hover:bg-red-900/20 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationCenter;
