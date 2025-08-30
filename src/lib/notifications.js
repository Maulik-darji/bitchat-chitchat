import { 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc,
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  writeBatch,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { db } from './firebase';

// Collection names for notifications
const NOTIFICATION_COLLECTIONS = {
  NOTIFICATIONS: 'notifications',
  ROOM_JOINS: 'roomJoins',
  INVITE_ACCEPTANCES: 'inviteAcceptances'
};

// Notification types
export const NOTIFICATION_TYPES = {
  ROOM_JOIN: 'room_join',
  INVITE_RECEIVED: 'invite_received',
  INVITE_ACCEPTED: 'invite_accepted',
  MESSAGE_RECEIVED: 'message_received'
};

// Notification status
export const NOTIFICATION_STATUS = {
  UNREAD: 'unread',
  READ: 'read'
};

/**
 * Create a notification
 */
export const createNotification = async (notificationData) => {
  try {
    console.log('Creating notification with data:', notificationData);
    const notificationRef = doc(collection(db, NOTIFICATION_COLLECTIONS.NOTIFICATIONS));
    const notification = {
      id: notificationRef.id,
      ...notificationData,
      createdAt: serverTimestamp(),
      status: NOTIFICATION_STATUS.UNREAD
    };
    
    console.log('Final notification object:', notification);
    await setDoc(notificationRef, notification);
    console.log('Notification created successfully with ID:', notificationRef.id);
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

/**
 * Get notifications for a user
 */
export const getUserNotifications = (username, callback) => {
  try {
    console.log('Getting notifications for username:', username);
    const q = query(
      collection(db, NOTIFICATION_COLLECTIONS.NOTIFICATIONS),
      where('recipientUsername', '==', username),
      orderBy('createdAt', 'desc')
    );
    
    console.log('Notification query created:', q);
    
    return onSnapshot(q, (snapshot) => {
      console.log('Notification snapshot received, size:', snapshot.size);
      const notifications = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        console.log('Notification doc:', { id: doc.id, ...data });
        notifications.push({ id: doc.id, ...data });
      });
      console.log('Final notifications array:', notifications);
      callback(notifications);
    }, (error) => {
      console.error('Error in notification snapshot:', error);
    });
  } catch (error) {
    console.error('Error getting user notifications:', error);
    throw error;
  }
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (notificationId) => {
  try {
    const notificationRef = doc(db, NOTIFICATION_COLLECTIONS.NOTIFICATIONS, notificationId);
    await updateDoc(notificationRef, {
      status: NOTIFICATION_STATUS.READ,
      readAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

/**
 * Mark all notifications as read for a user
 */
export const markAllNotificationsAsRead = async (username) => {
  try {
    const q = query(
      collection(db, NOTIFICATION_COLLECTIONS.NOTIFICATIONS),
      where('recipientUsername', '==', username),
      where('status', '==', NOTIFICATION_STATUS.UNREAD)
    );
    
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    
    snapshot.forEach((doc) => {
      batch.update(doc.ref, {
        status: NOTIFICATION_STATUS.READ,
        readAt: serverTimestamp()
      });
    });
    
    await batch.commit();
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};

/**
 * Clear message notifications for a specific chat or room
 */
export const clearMessageNotifications = async (username, chatIdOrRoomId, messageType = 'private') => {
  try {
    const q = query(
      collection(db, NOTIFICATION_COLLECTIONS.NOTIFICATIONS),
      where('recipientUsername', '==', username),
      where('type', '==', NOTIFICATION_TYPES.MESSAGE_RECEIVED),
      where('status', '==', NOTIFICATION_STATUS.UNREAD)
    );
    
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      // Check if this notification is for the specific chat/room
      if (messageType === 'room' && data.roomId === chatIdOrRoomId) {
        batch.update(doc.ref, {
          status: NOTIFICATION_STATUS.READ,
          readAt: serverTimestamp()
        });
      } else if (messageType === 'private' && data.chatId === chatIdOrRoomId) {
        batch.update(doc.ref, {
          status: NOTIFICATION_STATUS.READ,
          readAt: serverTimestamp()
        });
      }
    });
    
    await batch.commit();
    console.log(`Cleared message notifications for ${messageType}: ${chatIdOrRoomId}`);
  } catch (error) {
    console.error('Error clearing message notifications:', error);
    throw error;
  }
};

/**
 * Delete a notification
 */
export const deleteNotification = async (notificationId) => {
  try {
    const notificationRef = doc(db, NOTIFICATION_COLLECTIONS.NOTIFICATIONS, notificationId);
    await deleteDoc(notificationRef);
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
};

/**
 * Delete all notifications for a user
 */
export const deleteAllUserNotifications = async (username) => {
  try {
    const q = query(
      collection(db, NOTIFICATION_COLLECTIONS.NOTIFICATIONS),
      where('recipientUsername', '==', username)
    );
    
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    
    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
  } catch (error) {
    console.error('Error deleting all user notifications:', error);
    throw error;
  }
};

/**
 * Get unread notification count for a user
 */
export const getUnreadNotificationCount = (username, callback) => {
  try {
    const q = query(
      collection(db, NOTIFICATION_COLLECTIONS.NOTIFICATIONS),
      where('recipientUsername', '==', username),
      where('status', '==', NOTIFICATION_STATUS.UNREAD)
    );
    
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.size);
    });
  } catch (error) {
    console.error('Error getting unread notification count:', error);
    throw error;
  }
};

/**
 * Create room join notification
 */
export const createRoomJoinNotification = async (roomId, roomName, username, roomCreator) => {
  try {
    const notificationData = {
      type: NOTIFICATION_TYPES.ROOM_JOIN,
      recipientUsername: roomCreator,
      senderUsername: username,
      roomId,
      roomName,
      message: `${username} joined your private room "${roomName}"`,
      actionUrl: `/room/${roomId}`
    };
    
    return await createNotification(notificationData);
  } catch (error) {
    console.error('Error creating room join notification:', error);
    throw error;
  }
};

/**
 * Create invite received notification
 */
export const createInviteReceivedNotification = async (inviteId, roomId, roomName, senderUsername, recipientUsername) => {
  try {
    const notificationData = {
      type: NOTIFICATION_TYPES.INVITE_RECEIVED,
      recipientUsername,
      senderUsername,
      inviteId,
      roomId,
      roomName,
      message: `${senderUsername} invited you to join private room "${roomName}"`,
      actionUrl: `/invites`
    };
    
    return await createNotification(notificationData);
  } catch (error) {
    console.error('Error creating invite received notification:', error);
    throw error;
  }
};

/**
 * Create invite accepted notification
 */
export const createInviteAcceptedNotification = async (roomId, roomName, acceptorUsername, inviterUsername) => {
  try {
    const notificationData = {
      type: NOTIFICATION_TYPES.INVITE_ACCEPTED,
      recipientUsername: inviterUsername,
      senderUsername: acceptorUsername,
      roomId,
      roomName,
      message: `${acceptorUsername} accepted your invitation to join "${roomName}"`,
      actionUrl: `/room/${roomId}`
    };
    
    return await createNotification(notificationData);
  } catch (error) {
    console.error('Error creating invite accepted notification:', error);
    throw error;
  }
};

/**
 * Create message received notification (for private chats and room messages)
 */
export const createMessageReceivedNotification = async (chatIdOrRoomId, senderUsername, recipientUsername, messagePreview, messageType = 'private') => {
  try {
    console.log('Creating message notification:', { chatIdOrRoomId, senderUsername, recipientUsername, messagePreview, messageType });
    
    const isRoom = messageType === 'room';
    const actionUrl = isRoom ? `/room/${chatIdOrRoomId}` : `/private-chat/${chatIdOrRoomId}`;
    const message = isRoom ? `New message in room from ${senderUsername}` : `New message from ${senderUsername}`;
    
    const notificationData = {
      type: NOTIFICATION_TYPES.MESSAGE_RECEIVED,
      recipientUsername,
      senderUsername,
      chatId: chatIdOrRoomId, // Keep field name for backward compatibility
      roomId: isRoom ? chatIdOrRoomId : null, // Add roomId for room messages
      messagePreview: messagePreview.length > 50 ? messagePreview.substring(0, 50) + '...' : messagePreview,
      message,
      actionUrl,
      messageType
    };
    
    console.log('Message notification data:', notificationData);
    const result = await createNotification(notificationData);
    console.log('Message notification created successfully:', result);
    return result;
  } catch (error) {
    console.error('Error creating message received notification:', error);
    throw error;
  }
};

export default {
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteAllUserNotifications,
  getUnreadNotificationCount,
  createRoomJoinNotification,
  createInviteReceivedNotification,
  createInviteAcceptedNotification,
  createMessageReceivedNotification,
  clearMessageNotifications,
  NOTIFICATION_TYPES,
  NOTIFICATION_STATUS
};
