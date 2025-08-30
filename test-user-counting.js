// Test file for user counting functionality
// Run this with: node test-user-counting.js

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

// Firebase configuration (use your own config)
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || 'AIzaSyAKjAAHMPsHR65B-tNT9FzfsfLJ-OwrdkI',
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || 'fluid-cosmos-469510-q8.firebaseapp.com',
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || 'fluid-cosmos-469510-q8',
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || 'fluid-cosmos-469510-q8.firebasestorage.app',
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '86564786373',
  appId: process.env.REACT_APP_FIREBASE_APP_ID || '1:86564786373:web:d71885afea20c0ac08e0ac',
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || 'G-QETQ5QT99M'
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testUserCounting() {
  try {
    console.log('🔍 Testing user counting functionality...\n');
    
    // Test 1: Get total user count
    console.log('📊 Test 1: Getting total user count...');
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const totalUsers = usersSnapshot.size;
    console.log(`✅ Total users in database: ${totalUsers}\n`);
    
    // Test 2: Analyze user data
    console.log('📊 Test 2: Analyzing user data...');
    let onlineUsers = 0;
    let activeUsers = 0;
    let recentUsers = 0;
    const now = Date.now();
    const HEARTBEAT_TIMEOUT = 20000; // 20 seconds for more accurate tracking
    const RECENT_ACTIVITY_TIMEOUT = 300000; // 5 minutes
    
    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      
      // Count online users
      if (userData.isOnline) {
        onlineUsers++;
      }
      
      // Count active users (tab active + recent heartbeat)
      if (userData.isTabActive && userData.lastHeartbeat) {
        const lastHeartbeat = userData.lastHeartbeat.toDate ? userData.lastHeartbeat.toDate().getTime() : userData.lastHeartbeat;
        const timeSinceHeartbeat = now - lastHeartbeat;
        
        if (timeSinceHeartbeat < HEARTBEAT_TIMEOUT) {
          activeUsers++;
        }
      }
      
      // Count users with recent activity
      if (userData.lastSeen) {
        const lastSeen = userData.lastSeen.toDate ? userData.lastSeen.toDate().getTime() : userData.lastSeen;
        const timeSinceLastSeen = now - lastSeen;
        
        if (timeSinceLastSeen < RECENT_ACTIVITY_TIMEOUT) {
          recentUsers++;
        }
      }
    });
    
    console.log(`✅ Online users: ${onlineUsers}`);
    console.log(`✅ Active users: ${activeUsers}`);
    console.log(`✅ Recent users: ${recentUsers}\n`);
    
    // Test 3: Display sample user data
    console.log('📊 Test 3: Sample user data (first 3 users)...');
    let count = 0;
    usersSnapshot.forEach((doc) => {
      if (count < 3) {
        const userData = doc.data();
        console.log(`   User ${count + 1}: ${userData.username || 'Unknown'}`);
        console.log(`     - Online: ${userData.isOnline || false}`);
        console.log(`     - Tab Active: ${userData.isTabActive || false}`);
        console.log(`     - Last Heartbeat: ${userData.lastHeartbeat ? 'Yes' : 'No'}`);
        console.log(`     - Last Seen: ${userData.lastSeen ? 'Yes' : 'No'}`);
        console.log('');
        count++;
      }
    });
    
    // Test 4: Summary
    console.log('📊 Test 4: Summary');
    console.log(`✅ Total users: ${totalUsers}`);
    console.log(`✅ Online users: ${onlineUsers}`);
    console.log(`✅ Active users: ${activeUsers}`);
    console.log(`✅ Recent users: ${recentUsers}`);
    console.log(`✅ Data source: Firestore Database`);
    console.log(`✅ Timestamp: ${new Date().toISOString()}`);
    
    console.log('\n🎉 User counting test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing user counting:', error);
  }
}

// Run the test
testUserCounting();
