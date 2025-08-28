import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  writeBatch,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import firebaseService from './firebase';

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
    const notificationRef = doc(collection(firebaseService.db, NOTIFICATION_COLLECTIONS.NOTIFICATIONS));
    const notification = {
      id: notificationRef.id,
      ...notificationData,
      createdAt: serverTimestamp(),
      status: NOTIFICATION_STATUS.UNREAD
    };
    
    await setDoc(notificationRef, notification);
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
    const q = query(
      collection(firebaseService.db, NOTIFICATION_COLLECTIONS.NOTIFICATIONS),
      where('recipientUsername', '==', username),
      orderBy('createdAt', 'desc')
    );
    
    return onSnapshot(q, (snapshot) => {
      const notifications = [];
      snapshot.forEach((doc) => {
        notifications.push({ id: doc.id, ...doc.data() });
      });
      callback(notifications);
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
    const notificationRef = doc(firebaseService.db, NOTIFICATION_COLLECTIONS.NOTIFICATIONS, notificationId);
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
      collection(firebaseService.db, NOTIFICATION_COLLECTIONS.NOTIFICATIONS),
      where('recipientUsername', '==', username),
      where('status', '==', NOTIFICATION_STATUS.UNREAD)
    );
    
    const snapshot = await getDocs(q);
    const batch = writeBatch(firebaseService.db);
    
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
 * Delete a notification
 */
export const deleteNotification = async (notificationId) => {
  try {
    const notificationRef = doc(firebaseService.db, NOTIFICATION_COLLECTIONS.NOTIFICATIONS, notificationId);
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
      collection(firebaseService.db, NOTIFICATION_COLLECTIONS.NOTIFICATIONS),
      where('recipientUsername', '==', username)
    );
    
    const snapshot = await getDocs(q);
    const batch = writeBatch(firebaseService.db);
    
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
      collection(firebaseService.db, NOTIFICATION_COLLECTIONS.NOTIFICATIONS),
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
 * Create message received notification (for private chats)
 */
export const createMessageReceivedNotification = async (chatId, senderUsername, recipientUsername, messagePreview) => {
  try {
    const notificationData = {
      type: NOTIFICATION_TYPES.MESSAGE_RECEIVED,
      recipientUsername,
      senderUsername,
      chatId,
      messagePreview: messagePreview.length > 50 ? messagePreview.substring(0, 50) + '...' : messagePreview,
      message: `New message from ${senderUsername}`,
      actionUrl: `/private-chat/${chatId}`
    };
    
    return await createNotification(notificationData);
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
  NOTIFICATION_TYPES,
  NOTIFICATION_STATUS
};
