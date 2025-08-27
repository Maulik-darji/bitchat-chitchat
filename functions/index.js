const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

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
        privateChats: privateChats.docs.length
      }
    };
    
  } catch (error) {
    console.error(`[MANUAL CLEANUP] ❌ Error:`, error);
    throw new functions.https.HttpsError('internal', 'Cleanup failed', error);
  }
});