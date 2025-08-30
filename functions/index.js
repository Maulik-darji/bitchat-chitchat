const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

/**
 * COMPREHENSIVE USER DATA CLEANUP SYSTEM
 * 
 * This system ensures that when a user is deleted, ALL their associated data
 * across ALL Firestore collections is automatically deleted to maintain data integrity.
 * 
 * Collections cleaned up:
 * - users: User profile documents
 * - publicChats: Public chat messages
 * - roomMessages: Private room messages
 * - roomUsers: Room membership records
 * - rooms: Private rooms created by user
 * - invites: Room and chat invitations
 * - privateMessages: Direct message conversations
 * - privateChats: Private chat sessions
 * - removalNotifications: User removal notifications
 * - notifications: General user notifications
 * 
 * The cleanup happens in two ways:
 * 1. Automatic: When Firebase Auth user is deleted (onUserDeleted)
 * 2. Manual: When user clicks "Delete Account & Logout" (manualCleanup)
 */

exports.onUserDeleted = functions.auth.user().onDelete(async (user) => {
  try {
    console.log(`[AUTH DELETE] User deleted: ${user.uid}`);
    
    const db = admin.firestore();
    const batch = db.batch();
    let deletedCount = 0;

    // Find user document
    const usersSnapshot = await db
      .collection('users')
      .where('uid', '==', user.uid)
      .limit(1)
      .get();

    let username = null;
    if (!usersSnapshot.empty) {
      const userDoc = usersSnapshot.docs[0];
      username = userDoc.data().username;
      batch.delete(userDoc.ref);
      deletedCount++;
      console.log(`[AUTH DELETE] Found user: ${username}`);
    }

    // Delete public messages
    const publicChats = await db
      .collection('publicChats')
      .where('uid', '==', user.uid)
      .get();
    
    publicChats.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });

    // Delete room messages
    const roomMessages = await db
      .collection('roomMessages')
      .where('uid', '==', user.uid)
      .get();
    
    roomMessages.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });

    // Delete room users
    const roomUsers = await db
      .collection('roomUsers')
      .where('uid', '==', user.uid)
      .get();
    
    roomUsers.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });

    // Delete rooms created by user
    const rooms = await db
      .collection('rooms')
      .where('createdByUid', '==', user.uid)
      .get();
    
    rooms.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });

    // Delete invites sent by user
    const invitesSent = await db
      .collection('invites')
      .where('fromUid', '==', user.uid)
      .get();
    
    invitesSent.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });

    // Delete private messages by user
    const privateMessages = await db
      .collection('privateMessages')
      .where('uid', '==', user.uid)
      .get();
    
    privateMessages.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });

    // Delete private chats where user is a participant
    const privateChats = await db
      .collection('privateChats')
      .where('participants', 'array-contains', user.uid)
      .get();
    
    privateChats.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });

    // Delete removal notifications for user
    const removalNotifications = await db
      .collection('removalNotifications')
      .where('removedUid', '==', user.uid)
      .get();
    
    removalNotifications.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });

    // Delete general notifications for user
    const notifications = await db
      .collection('notifications')
      .where('username', '==', username)
      .get();
    
    notifications.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });

    // Legacy cleanup by username (fallback cleanup)
    if (username) {
      const publicByUsername = await db
        .collection('publicChats')
        .where('username', '==', username)
        .get();
      publicByUsername.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });

      const roomMsgsByUsername = await db
        .collection('roomMessages')
        .where('username', '==', username)
        .get();
      roomMsgsByUsername.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });

      const roomUsersByUsername = await db
        .collection('roomUsers')
        .where('username', '==', username)
        .get();
      roomUsersByUsername.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });

      const roomsByCreator = await db
        .collection('rooms')
        .where('createdBy', '==', username)
        .get();
      roomsByCreator.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });

      // Delete invites sent by username
      const invitesSentByUsername = await db
        .collection('invites')
        .where('fromUsername', '==', username)
        .get();
      invitesSentByUsername.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });

      // Delete invites received by username
      const invitesReceivedByUsername = await db
        .collection('invites')
        .where('toUsername', '==', username)
        .get();
      invitesReceivedByUsername.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });

      // Delete private messages by username
      const privateMessagesByUsername = await db
        .collection('privateMessages')
        .where('username', '==', username)
        .get();
      privateMessagesByUsername.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });

      // Delete private chats where username is a participant
      const privateChatsByUsername = await db
        .collection('privateChats')
        .where('participants', 'array-contains', username)
        .get();
      privateChatsByUsername.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });

      // Delete removal notifications for username
      const removalNotificationsByUsername = await db
        .collection('removalNotifications')
        .where('removedUsername', '==', username)
        .get();
      removalNotificationsByUsername.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });

      // Delete general notifications for username
      const notificationsByUsername = await db
        .collection('notifications')
        .where('username', '==', username)
        .get();
      notificationsByUsername.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });
    }

    await batch.commit();
    console.log(`[AUTH DELETE] ✅ Cleaned up ${deletedCount} documents for UID: ${user.uid}`);
    console.log(`[AUTH DELETE] 📊 Cleanup Summary:`);
    console.log(`  - User document: ${username ? 'deleted' : 'not found'}`);
    console.log(`  - Public messages: ${publicChats.docs.length} deleted`);
    console.log(`  - Room messages: ${roomMessages.docs.length} deleted`);
    console.log(`  - Room users: ${roomUsers.docs.length} deleted`);
    console.log(`  - Rooms created: ${rooms.docs.length} deleted`);
    console.log(`  - Invites sent: ${invitesSent.docs.length} deleted`);
    console.log(`  - Private messages: ${privateMessages.docs.length} deleted`);
    console.log(`  - Private chats: ${privateChats.docs.length} deleted`);
    console.log(`  - Removal notifications: ${removalNotifications.docs.length} deleted`);
    console.log(`  - General notifications: ${notifications.docs.length} deleted`);
    
    return { success: true, deletedCount };
    
  } catch (error) {
    console.error(`[AUTH DELETE] ❌ Error:`, error);
    throw error;
  }
});

// Manual cleanup function that can be called from client
exports.manualCleanup = functions.https.onCall(async (data, context) => {
  try {
    // Check if user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const uid = context.auth.uid;
    console.log(`[MANUAL CLEANUP] Starting manual cleanup for UID: ${uid}`);
    
    const db = admin.firestore();
    const batch = db.batch();
    let deletedCount = 0;

    // Find user document
    const usersSnapshot = await db
      .collection('users')
      .where('uid', '==', uid)
      .limit(1)
      .get();

    let username = null;
    if (!usersSnapshot.empty) {
      const userDoc = usersSnapshot.docs[0];
      username = userDoc.data().username;
      batch.delete(userDoc.ref);
      deletedCount++;
      console.log(`[MANUAL CLEANUP] Found user: ${username}`);
    }

    // Delete public messages
    const publicChats = await db
      .collection('publicChats')
      .where('uid', '==', uid)
      .get();
    
    publicChats.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });

    // Delete room messages
    const roomMessages = await db
      .collection('roomMessages')
      .where('uid', '==', uid)
      .get();
    
    roomMessages.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });

    // Delete room users
    const roomUsers = await db
      .collection('roomUsers')
      .where('uid', '==', uid)
      .get();
    
    roomUsers.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });

    // Delete rooms created by user
    const rooms = await db
      .collection('rooms')
      .where('createdByUid', '==', uid)
      .get();
    
    rooms.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });

    // Delete invites sent by user
    const invitesSent = await db
      .collection('invites')
      .where('fromUid', '==', uid)
      .get();
    
    invitesSent.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });

    // Delete private messages by user
    const privateMessages = await db
      .collection('privateMessages')
      .where('uid', '==', uid)
      .get();
    
    privateMessages.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });

    // Delete private chats where user is a participant
    const privateChats = await db
      .collection('privateChats')
      .where('participants', 'array-contains', uid)
      .get();
    
    privateChats.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });

    // Delete removal notifications for user
    const removalNotifications = await db
      .collection('removalNotifications')
      .where('removedUid', '==', uid)
      .get();
    
    removalNotifications.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });

    // Delete general notifications for user
    const notifications = await db
      .collection('notifications')
      .where('username', '==', username)
      .get();
    
    notifications.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });

    // Legacy cleanup by username
    if (username) {
      const publicByUsername = await db
        .collection('publicChats')
        .where('username', '==', username)
        .get();
      publicByUsername.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });

      const roomMsgsByUsername = await db
        .collection('roomMessages')
        .where('username', '==', username)
        .get();
      roomMsgsByUsername.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });

      const roomUsersByUsername = await db
        .collection('roomUsers')
        .where('username', '==', username)
        .get();
      roomUsersByUsername.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });

      const roomsByCreator = await db
        .collection('rooms')
        .where('createdBy', '==', username)
        .get();
      roomsByCreator.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });

      // Delete invites sent by username
      const invitesSentByUsername = await db
        .collection('invites')
        .where('fromUsername', '==', username)
        .get();
      invitesSentByUsername.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });

      // Delete invites received by username
      const invitesReceivedByUsername = await db
        .collection('invites')
        .where('toUsername', '==', username)
        .get();
      invitesReceivedByUsername.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });

      // Delete private messages by username
      const privateMessagesByUsername = await db
        .collection('privateMessages')
        .where('username', '==', username)
        .get();
      privateMessagesByUsername.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });

      // Delete private chats where username is a participant
      const privateChatsByUsername = await db
        .collection('privateChats')
        .where('participants', 'array-contains', username)
        .get();
      privateChatsByUsername.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });

      // Delete removal notifications for username
      const removalNotificationsByUsername = await db
        .collection('removalNotifications')
        .where('removedUsername', '==', username)
        .get();
      removalNotificationsByUsername.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });

      // Delete general notifications for username
      const notificationsByUsername = await db
        .collection('notifications')
        .where('username', '==', username)
        .get();
      notificationsByUsername.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });
    }

    await batch.commit();
    console.log(`[MANUAL CLEANUP] ✅ Cleaned up ${deletedCount} documents for UID: ${uid}`);
    
    return { 
      success: true, 
      deletedCount,
      username,
      summary: {
        userDocument: username ? 'deleted' : 'not found',
        publicMessages: publicChats.docs.length,
        roomMessages: roomMessages.docs.length,
        roomUsers: roomUsers.docs.length,
        roomsCreated: rooms.docs.length,
        invitesSent: invitesSent.docs.length,
        privateMessages: privateMessages.docs.length,
        privateChats: privateChats.docs.length,
        removalNotifications: removalNotifications.docs.length,
        generalNotifications: notifications.docs.length
      }
    };
    
  } catch (error) {
    console.error(`[MANUAL CLEANUP] ❌ Error:`, error);
    throw new functions.https.HttpsError('internal', 'Cleanup failed', error);
  }
});

/**
 * Clean up orphaned data - removes any documents that reference non-existent users
 * This function can be called periodically to maintain data integrity
 */
exports.cleanupOrphanedData = functions.https.onCall(async (data, context) => {
  try {
    // Check if user is authenticated and is an admin (you can add admin check here)
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    console.log(`[ORPHANED CLEANUP] Starting orphaned data cleanup`);
    
    const db = admin.firestore();
    const batch = db.batch();
    let deletedCount = 0;
    let orphanedData = {};

    // Get all usernames that exist
    const usersSnapshot = await db.collection('users').get();
    const validUsernames = new Set();
    const validUids = new Set();
    
    usersSnapshot.docs.forEach(doc => {
      const userData = doc.data();
      if (userData.username) validUsernames.add(userData.username);
      if (userData.uid) validUids.add(userData.uid);
    });

    console.log(`[ORPHANED CLEANUP] Found ${validUsernames.size} valid usernames and ${validUids.size} valid UIDs`);

    // Clean up orphaned public chats
    const publicChats = await db.collection('publicChats').get();
    const orphanedPublicChats = publicChats.docs.filter(doc => {
      const data = doc.data();
      return (!data.uid || !validUids.has(data.uid)) && (!data.username || !validUsernames.has(data.username));
    });
    
    orphanedPublicChats.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });
    orphanedData.publicChats = orphanedPublicChats.length;

    // Clean up orphaned room messages
    const roomMessages = await db.collection('roomMessages').get();
    const orphanedRoomMessages = roomMessages.docs.filter(doc => {
      const data = doc.data();
      return (!data.uid || !validUids.has(data.uid)) && (!data.username || !validUsernames.has(data.username));
    });
    
    orphanedRoomMessages.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });
    orphanedData.roomMessages = orphanedRoomMessages.length;

    // Clean up orphaned room users
    const roomUsers = await db.collection('roomUsers').get();
    const orphanedRoomUsers = roomUsers.docs.filter(doc => {
      const data = doc.data();
      return (!data.uid || !validUids.has(data.uid)) && (!data.username || !validUsernames.has(data.username));
    });
    
    orphanedRoomUsers.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });
    orphanedData.roomUsers = orphanedRoomUsers.length;

    // Clean up orphaned rooms
    const rooms = await db.collection('rooms').get();
    const orphanedRooms = rooms.docs.filter(doc => {
      const data = doc.data();
      return (!data.createdByUid || !validUids.has(data.createdByUid)) && (!data.createdBy || !validUsernames.has(data.createdBy));
    });
    
    orphanedRooms.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });
    orphanedData.rooms = orphanedRooms.length;

    // Clean up orphaned invites
    const invites = await db.collection('invites').get();
    const orphanedInvites = invites.docs.filter(doc => {
      const data = doc.data();
      return (!data.fromUid || !validUids.has(data.fromUid)) && 
             (!data.fromUsername || !validUsernames.has(data.fromUsername)) &&
             (!data.toUsername || !validUsernames.has(data.toUsername));
    });
    
    orphanedInvites.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });
    orphanedData.invites = orphanedInvites.length;

    // Clean up orphaned private messages
    const privateMessages = await db.collection('privateMessages').get();
    const orphanedPrivateMessages = privateMessages.docs.filter(doc => {
      const data = doc.data();
      return (!data.uid || !validUids.has(data.uid)) && (!data.username || !validUsernames.has(data.username));
    });
    
    orphanedPrivateMessages.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });
    orphanedData.privateMessages = orphanedPrivateMessages.length;

    // Clean up orphaned notifications
    const notifications = await db.collection('notifications').get();
    const orphanedNotifications = notifications.docs.filter(doc => {
      const data = doc.data();
      return !data.username || !validUsernames.has(data.username);
    });
    
    orphanedNotifications.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });
    orphanedData.notifications = orphanedNotifications.length;

    // Clean up orphaned removal notifications
    const removalNotifications = await db.collection('removalNotifications').get();
    const orphanedRemovalNotifications = removalNotifications.docs.filter(doc => {
      const data = doc.data();
      return (!data.removedUid || !validUids.has(data.removedUid)) && 
             (!data.removedUsername || !validUsernames.has(data.removedUsername));
    });
    
    orphanedRemovalNotifications.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });
    orphanedData.removalNotifications = orphanedRemovalNotifications.length;

    if (deletedCount > 0) {
      await batch.commit();
      console.log(`[ORPHANED CLEANUP] ✅ Cleaned up ${deletedCount} orphaned documents`);
    } else {
      console.log(`[ORPHANED CLEANUP] ✅ No orphaned data found`);
    }

    return {
      success: true,
      deletedCount,
      orphanedData,
      summary: `Cleaned up ${deletedCount} orphaned documents across all collections`
    };

  } catch (error) {
    console.error(`[ORPHANED CLEANUP] ❌ Error:`, error);
    throw new functions.https.HttpsError('internal', 'Orphaned data cleanup failed', error);
  }
});