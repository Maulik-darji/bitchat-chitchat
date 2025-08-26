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
    }

    await batch.commit();
    console.log(`[AUTH DELETE] ✅ Cleaned up ${deletedCount} documents for UID: ${user.uid}`);
    
    return { success: true, deletedCount };
    
  } catch (error) {
    console.error(`[AUTH DELETE] ❌ Error:`, error);
    throw error;
  }
});