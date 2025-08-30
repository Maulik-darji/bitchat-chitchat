// Test script for cleanup functionality
// This helps verify that user data cleanup works correctly

import { FirebaseService } from './firebase';

/**
 * Test the cleanup functionality
 * Run this in browser console: window.testCleanup()
 */
export async function testCleanup() {
  console.log('🧪 Testing User Data Cleanup...\n');
  
  try {
    // Test 1: Test username cleanup
    console.log('📝 Test 1: Username Cleanup');
    console.log('This will test cleaning up a specific username from all collections');
    
    const testUsername = prompt('Enter a username to test cleanup (or cancel to skip):');
    if (testUsername) {
      console.log(`Testing cleanup for username: ${testUsername}`);
      
      const result = await FirebaseService.cleanupUsername(testUsername);
      console.log('✅ Username cleanup result:', result);
    } else {
      console.log('⏭️  Skipping username cleanup test');
    }
    
    console.log('\n' + '─'.repeat(50) + '\n');
    
    // Test 2: Test UID cleanup
    console.log('📝 Test 2: UID Cleanup');
    console.log('This will test cleaning up by UID (requires current user)');
    
    const currentUser = FirebaseService.auth.currentUser;
    if (currentUser) {
      console.log(`Current user UID: ${currentUser.uid}`);
      
      const result = await FirebaseService.cleanupUserData(currentUser.uid);
      console.log('✅ UID cleanup result:', result);
    } else {
      console.log('⏭️  No current user, skipping UID cleanup test');
    }
    
    console.log('\n' + '─'.repeat(50) + '\n');
    
    // Test 3: Test account deletion (WARNING: This will delete the current account!)
    console.log('📝 Test 3: Account Deletion (DANGEROUS!)');
    console.log('⚠️  WARNING: This will permanently delete the current user account!');
    
    const confirmDelete = confirm('Do you want to test account deletion? This will DELETE your account!');
    if (confirmDelete) {
      console.log('🚨 Proceeding with account deletion test...');
      
      try {
        await FirebaseService.deleteUserAccount();
        console.log('✅ Account deletion completed successfully');
      } catch (error) {
        console.error('❌ Account deletion failed:', error);
      }
    } else {
      console.log('⏭️  Skipping account deletion test');
    }
    
    console.log('\n✅ Cleanup testing completed!');
    
  } catch (error) {
    console.error('❌ Error during cleanup testing:', error);
  }
}

/**
 * Test cleanup for a specific username without deleting the current account
 * Run this in browser console: window.testUsernameCleanup('username')
 */
export async function testUsernameCleanup(username) {
  if (!username) {
    console.error('❌ Please provide a username to test');
    return;
  }
  
  console.log(`🧪 Testing username cleanup for: ${username}`);
  
  try {
    const result = await FirebaseService.cleanupUsername(username);
    console.log('✅ Username cleanup result:', result);
    
    // Verify cleanup by checking if documents still exist
    console.log('\n🔍 Verifying cleanup...');
    
    // Check users collection
    try {
      const userDoc = await FirebaseService.db.collection('users').doc(username).get();
      if (userDoc.exists) {
        console.log('⚠️  User document still exists in users collection');
      } else {
        console.log('✅ User document removed from users collection');
      }
    } catch (error) {
      console.log('⚠️  Could not check users collection:', error);
    }
    
    // Check public chats
    try {
      const publicChats = await FirebaseService.db.collection('publicChats')
        .where('username', '==', username)
        .get();
      
      if (publicChats.empty) {
        console.log('✅ No public chat messages found for username');
      } else {
        console.log(`⚠️  Found ${publicChats.docs.length} public chat messages still exist`);
      }
    } catch (error) {
      console.log('⚠️  Could not check public chats:', error);
    }
    
    // Check room messages
    try {
      const roomMessages = await FirebaseService.db.collection('roomMessages')
        .where('username', '==', username)
        .get();
      
      if (roomMessages.empty) {
        console.log('✅ No room messages found for username');
      } else {
        console.log(`⚠️  Found ${roomMessages.docs.length} room messages still exist`);
      }
    } catch (error) {
      console.log('⚠️  Could not check room messages:', error);
    }
    
  } catch (error) {
    console.error('❌ Error during username cleanup test:', error);
  }
}

// Export functions for browser console access
if (typeof window !== 'undefined') {
  window.testCleanup = testCleanup;
  window.testUsernameCleanup = testUsernameCleanup;
  
  console.log('🧪 Cleanup test functions loaded:');
  console.log('  - window.testCleanup() - Run full cleanup tests');
  console.log('  - window.testUsernameCleanup("username") - Test cleanup for specific username');
}
