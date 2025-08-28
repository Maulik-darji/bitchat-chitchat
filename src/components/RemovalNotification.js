import React, { useEffect, useState } from 'react';
import firebaseService from '../lib/firebase';

const RemovalNotification = ({ currentUser, onUserRemoved }) => {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!currentUser?.uid) return;

    // Listen for removal notifications
    const unsubscribe = firebaseService.onRemovalNotificationsUpdate(
      currentUser.uid,
      (newNotifications) => {
        setNotifications(newNotifications);
        
        // Show alert for each new notification and trigger redirect
        newNotifications.forEach(notification => {
          if (!notification.read) {
            alert(notification.message);
            // Mark as read
            firebaseService.markRemovalNotificationAsRead(notification.id);
            
            // Trigger redirect to home page
            if (onUserRemoved) {
              onUserRemoved(notification.removedUsername);
            }
          }
        });
      }
    );

    return unsubscribe;
  }, [currentUser?.uid, onUserRemoved]);

  // Don't render anything visible - this component just handles notifications
  return null;
};

export default RemovalNotification;
