import React, { useEffect, useState, useRef } from 'react';
import firebaseService from '../lib/firebase';

const RemovalNotification = ({ currentUser, onUserRemoved }) => {
  const [notifications, setNotifications] = useState([]);
  const unsubscribeRef = useRef(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (!currentUser?.uid || isInitializedRef.current) return;

    console.log('🔔 Setting up removal notifications listener for UID:', currentUser.uid);
    isInitializedRef.current = true;

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

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        console.log('🔕 Cleaning up removal notifications listener for UID:', currentUser.uid);
        unsubscribeRef.current();
        unsubscribeRef.current = null;
        isInitializedRef.current = false;
      }
    };
  }, [currentUser?.uid]); // Removed onUserRemoved from dependencies to prevent re-initialization

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
