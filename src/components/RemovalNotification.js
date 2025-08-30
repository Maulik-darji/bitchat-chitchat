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

  // Track user activity when interacting with removal notifications
  useEffect(() => {
    if (!currentUser?.username) return;

    let activityTimeout;
    
    const updateActivity = async () => {
      try {
        await firebaseService.updateUserActivity(currentUser.username);
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
  }, [currentUser?.username]);

  // Don't render anything visible - this component just handles notifications
  return null;
};

export default RemovalNotification;
