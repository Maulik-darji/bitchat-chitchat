// Cleanup script to move device status documents from users collection to deviceStatus collection
// Run this in your Firebase console or as a Cloud Function

const admin = require('firebase-admin');
const db = admin.firestore();

async function cleanupDeviceStatusDocuments() {
  try {
    console.log('Starting cleanup of device status documents...');
    
    // Get all documents from users collection that have isDeviceStatus flag
    const usersSnapshot = await db.collection('users')
      .where('isDeviceStatus', '==', true)
      .get();
    
    console.log(`Found ${usersSnapshot.size} device status documents to move`);
    
    const batch = db.batch();
    let movedCount = 0;
    
    usersSnapshot.forEach((doc) => {
      const data = doc.data();
      
      // Create new document in deviceStatus collection
      const newDocRef = db.collection('deviceStatus').doc(doc.id);
      batch.set(newDocRef, {
        username: data.username,
        deviceId: data.deviceId,
        isOnline: data.isOnline,
        lastSeen: data.lastSeen
      });
      
      // Delete from users collection
      batch.delete(doc.ref);
      
      movedCount++;
    });
    
    // Commit the batch
    await batch.commit();
    
    console.log(`Successfully moved ${movedCount} device status documents to deviceStatus collection`);
    console.log('Cleanup completed successfully!');
    
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

// Export for use as Cloud Function
exports.cleanupDeviceStatusDocuments = cleanupDeviceStatusDocuments;

// For direct execution
if (require.main === module) {
  cleanupDeviceStatusDocuments();
}
