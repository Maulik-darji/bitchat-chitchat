/**
 * Performance Test Utility for Message Sending
 * Tests the speed difference between public chat and private room message sending
 */

export const measureMessageSendingPerformance = async (firebaseService, testType, params) => {
  const startTime = performance.now();
  
  try {
    if (testType === 'public') {
      await firebaseService.sendPublicMessage(params.username, params.message, params.replyTo);
    } else if (testType === 'private') {
      await firebaseService.sendRoomMessage(params.roomId, params.username, params.message);
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log(`✅ ${testType.toUpperCase()} message sent in ${duration.toFixed(2)}ms`);
    return duration;
    
  } catch (error) {
    console.error(`❌ Error sending ${testType} message:`, error);
    return -1;
  }
};

export const runPerformanceComparison = async (firebaseService, username, roomId) => {
  console.log('🚀 Starting Message Sending Performance Test...');
  
  const testMessage = 'Performance test message ' + Date.now();
  
  // Test public chat
  const publicDuration = await measureMessageSendingPerformance(firebaseService, 'public', {
    username,
    message: testMessage
  });
  
  // Wait a bit between tests
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test private room
  const privateDuration = await measureMessageSendingPerformance(firebaseService, 'private', {
    roomId,
    username,
    message: testMessage
  });
  
  if (publicDuration > 0 && privateDuration > 0) {
    const difference = privateDuration - publicDuration;
    const improvement = ((difference / privateDuration) * 100).toFixed(1);
    
    console.log('\n📊 PERFORMANCE RESULTS:');
    console.log(`Public Chat: ${publicDuration.toFixed(2)}ms`);
    console.log(`Private Room: ${privateDuration.toFixed(2)}ms`);
    console.log(`Difference: ${difference.toFixed(2)}ms`);
    
    if (difference > 0) {
      console.log(`Private room is ${difference.toFixed(2)}ms slower`);
      console.log(`Target improvement: ${improvement}%`);
    } else {
      console.log(`🎉 Private room is now FASTER by ${Math.abs(difference).toFixed(2)}ms!`);
    }
  }
  
  return { publicDuration, privateDuration };
};

// Auto-run test if imported directly
if (typeof window !== 'undefined') {
  window.runMessagePerformanceTest = runPerformanceComparison;
}
