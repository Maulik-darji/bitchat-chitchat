// Utility script to manually clean up a username from the database
// Run this in the browser console when you need to force delete a username

async function cleanupUsername(username) {
  try {
    console.log(`Starting manual cleanup for username: ${username}`);
    
    // Import Firebase modules
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
    const { getFirestore, doc, deleteDoc, collection, query, where, getDocs, writeBatch } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const { getAuth, signInAnonymously } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
    
    // Firebase configuration
    const firebaseConfig = {
      apiKey: "AIzaSyCKQar0RRhf_0F9HK0xSCOMmaNbJL7_1pM",
      authDomain: "aerobic-copilot-449112-s6.firebaseapp.com",
      projectId: "aerobic-copilot-449112-s6",
      storageBucket: "aerobic-copilot-449112-s6.firebasestorage.app",
      messagingSenderId: "790758007005",
      appId: "1:790758007005:web:25588360b14774e2737b34",
      measurementId: "G-4YR66Y35TR"
    };
    
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const auth = getAuth(app);
    
    // Sign in anonymously
    await signInAnonymously(auth);
    console.log('Authenticated successfully');
    
    const batch = writeBatch(db);
    let deletedCount = 0;
    
    // Delete user document
    const userRef = doc(db, 'users', username);
    batch.delete(userRef);
    deletedCount++;
    console.log('Added user document to batch delete');
    
    // Delete public messages by username
    const publicChatsSnapshot = await getDocs(
      query(collection(db, 'publicChats'), where('username', '==', username))
    );
    publicChatsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });
    console.log(`Found ${publicChatsSnapshot.docs.length} public messages to delete`);
    
    // Delete room messages by username
    const roomMessagesSnapshot = await getDocs(
      query(collection(db, 'roomMessages'), where('username', '==', username))
    );
    roomMessagesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });
    console.log(`Found ${roomMessagesSnapshot.docs.length} room messages to delete`);
    
    // Delete room users by username
    const roomUsersSnapshot = await getDocs(
      query(collection(db, 'roomUsers'), where('username', '==', username))
    );
    roomUsersSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });
    console.log(`Found ${roomUsersSnapshot.docs.length} room users to delete`);
    
    // Delete rooms created by username
    const roomsSnapshot = await getDocs(
      query(collection(db, 'rooms'), where('createdBy', '==', username))
    );
    roomsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });
    console.log(`Found ${roomsSnapshot.docs.length} rooms to delete`);
    
    // Commit the batch
    await batch.commit();
    console.log(`✅ Cleanup completed successfully! Deleted ${deletedCount} documents for username: ${username}`);
    
    return { success: true, deletedCount };
    
  } catch (error) {
    console.error(`❌ Error in cleanup for username ${username}:`, error);
    throw error;
  }
}

// Usage: Run this in the browser console
// cleanupUsername('niceone').then(result => console.log('Cleanup result:', result));
