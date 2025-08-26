// Test script to manually create device status document
// Run this in browser console to test the device status functionality

// Test function to manually create device status
async function testDeviceStatus() {
  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
    const { getFirestore, doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    
    // Initialize Firebase (you'll need to add your config)
    const firebaseConfig = {
      // Add your Firebase config here
    };
    
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    // Test data
    const username = 'testuser';
    const deviceId = 'test_device_123';
    const deviceDocId = `${username}_${deviceId}`;
    
    // Create device status document
    const deviceStatusDoc = doc(db, 'deviceStatus', deviceDocId);
    await setDoc(deviceStatusDoc, {
      username: username,
      deviceId: deviceId,
      isOnline: true,
      lastSeen: serverTimestamp()
    });
    
    console.log('Device status document created successfully!');
    console.log('Document ID:', deviceDocId);
    console.log('Collection: deviceStatus');
    
  } catch (error) {
    console.error('Error creating device status:', error);
  }
}

// Function to check current device status documents
async function checkDeviceStatus() {
  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
    const { getFirestore, collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    
    const firebaseConfig = {
      // Add your Firebase config here
    };
    
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    const deviceStatusSnapshot = await getDocs(collection(db, 'deviceStatus'));
    
    console.log('Device status documents:');
    deviceStatusSnapshot.forEach((doc) => {
      console.log('Document ID:', doc.id);
      console.log('Data:', doc.data());
    });
    
  } catch (error) {
    console.error('Error checking device status:', error);
  }
}

// Export functions for use
window.testDeviceStatus = testDeviceStatus;
window.checkDeviceStatus = checkDeviceStatus;

console.log('Test functions loaded. Use testDeviceStatus() or checkDeviceStatus() to test.');
