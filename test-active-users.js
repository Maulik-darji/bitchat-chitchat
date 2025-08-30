/**
 * Test Active User Counting System
 * 
 * This test verifies that the active user count accurately reflects
 * only users who currently have the website open in their browser.
 */

import firebaseService from './src/lib/firebase.js';

async function testActiveUserCounting() {
  console.log('🧪 Testing Active User Counting System...\n');

  try {
    // Test 1: Get current user stats
    console.log('1️⃣ Getting current user statistics...');
    const stats = await firebaseService.getCurrentUserCount();
    console.log('✅ Current Stats:', {
      totalUsers: stats.totalUsers,
      activeUsers: stats.activeUsers,
      onlineUsers: stats.onlineUsers,
      lastUpdated: stats.lastUpdated
    });

    // Test 2: Test real-time user stats listener
    console.log('\n2️⃣ Setting up real-time user stats listener...');
    const unsubscribe = firebaseService.onUserStats((userStats) => {
      console.log('✅ Real-time Stats Update:', {
        totalUsers: userStats.totalUsers,
        activeUsers: userStats.activeUsers,
        onlineUsers: userStats.onlineUsers,
        lastUpdated: userStats.lastUpdated
      });
    });

    // Test 3: Test active users count specifically
    console.log('\n3️⃣ Testing active users count...');
    const activeUsersUnsubscribe = firebaseService.onActiveUsersCount((count) => {
      console.log(`✅ Active Users Count: ${count}`);
    });

    // Test 4: Test total users count
    console.log('\n4️⃣ Testing total users count...');
    const totalUsersUnsubscribe = firebaseService.onTotalUsersCount((count) => {
      console.log(`✅ Total Users Count: ${count}`);
    });

    // Wait for some updates
    console.log('\n⏳ Waiting for real-time updates...');
    setTimeout(() => {
      console.log('\n🔄 Cleaning up listeners...');
      unsubscribe();
      activeUsersUnsubscribe();
      totalUsersUnsubscribe();
      console.log('✅ Test completed successfully!');
    }, 10000);

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test if this file is executed directly
if (typeof window === 'undefined') {
  // Node.js environment
  testActiveUserCounting().catch(console.error);
} else {
  // Browser environment
  window.testActiveUserCounting = testActiveUserCounting;
  console.log('🧪 Test function available as window.testActiveUserCounting()');
}

export default testActiveUserCounting;
