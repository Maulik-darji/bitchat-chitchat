// Test file to verify vulgar word filtering
// This tests that vulgar words are properly replaced with asterisks

console.log("🧪 Testing Vulgar Word Filtering");
console.log("=" .repeat(50));

// Test messages with vulgar words
const testMessages = [
  "Hello, how are you?",
  "You are a chutiya",
  "Don't be a randi",
  "He is a madarchod",
  "She is a behnchod",
  "This is chut",
  "That is lund",
  "He has gaand",
  "She is bhosda",
  "He is harami",
  "She is behaya",
  "He is rand",
  "You are a gaandu"
];

// Test the filtering function
function testFiltering() {
  console.log("📝 Testing message filtering:");
  console.log("=" .repeat(50));
  
  testMessages.forEach((message, index) => {
    console.log(`\n${index + 1}. Original: "${message}"`);
    
    // Check if message is clean
    const isClean = window.isMessageClean ? window.isMessageClean(message) : true;
    
    if (isClean) {
      console.log("   ✅ Message is clean");
    } else {
      console.log("   ❌ Message contains vulgar content");
      
      // Try to get filtered message
      if (window.filterMessage) {
        const result = window.filterMessage(message);
        console.log(`   🔄 Filtered: "${result.filteredMessage}"`);
        console.log(`   📊 Is Clean: ${result.isClean}`);
      }
      
      // Try to get detected words
      if (window.getDetectedVulgarWords) {
        const detectedWords = window.getDetectedVulgarWords(message);
        if (detectedWords.length > 0) {
          console.log(`   🚫 Detected: ${detectedWords.join(', ')}`);
        }
      }
    }
  });
}

// Test specific vulgar words
function testSpecificWords() {
  console.log("\n🎯 Testing specific vulgar words:");
  console.log("=" .repeat(50));
  
  const vulgarWords = [
    'chutiya', 'randi', 'madarchod', 'behnchod', 'chut', 'lund', 
    'gaand', 'bhosda', 'harami', 'behaya', 'rand', 'gaandu'
  ];
  
  vulgarWords.forEach(word => {
    const message = `You are a ${word}`;
    const isClean = window.isMessageClean ? window.isMessageClean(message) : true;
    
    console.log(`"${word}": ${isClean ? '❌ NOT CAUGHT' : '✅ CAUGHT'}`);
  });
}

// Test the complete flow
function testCompleteFlow() {
  console.log("\n🔄 Testing complete flow:");
  console.log("=" .repeat(50));
  
  const testMessage = "You are a chutiya and randi";
  console.log(`Original message: "${testMessage}"`);
  
  // Step 1: Check if message is clean
  const isClean = window.isMessageClean ? window.isMessageClean(testMessage) : true;
  console.log(`Step 1 - Is clean: ${isClean}`);
  
  if (!isClean) {
    // Step 2: Get filtered message
    if (window.filterMessage) {
      const result = window.filterMessage(testMessage);
      console.log(`Step 2 - Filtered message: "${result.filteredMessage}"`);
      console.log(`Step 2 - Is clean after filtering: ${result.isClean}`);
      
      // Step 3: Check if filtered message can be sent
      const canSendFiltered = window.isMessageClean ? window.isMessageClean(result.filteredMessage) : true;
      console.log(`Step 3 - Can send filtered message: ${canSendFiltered}`);
      
      if (canSendFiltered) {
        console.log("✅ SUCCESS: Vulgar words are properly filtered and can be sent!");
      } else {
        console.log("❌ FAILURE: Filtered message still contains vulgar content!");
      }
    }
  }
}

// Main test runner
function runVulgarFilteringTests() {
  console.log("🚀 Starting Vulgar Word Filtering Tests");
  console.log("=" .repeat(60));
  
  try {
    // Test basic filtering
    testFiltering();
    
    // Test specific words
    testSpecificWords();
    
    // Test complete flow
    testCompleteFlow();
    
    console.log("\n✅ All tests completed!");
    
  } catch (error) {
    console.error("\n❌ Test suite failed:", error.message);
    console.error("Stack trace:", error.stack);
  }
}

// Export test functions for use in browser console
if (typeof window !== 'undefined') {
  window.testVulgarFiltering = {
    runVulgarFilteringTests,
    testFiltering,
    testSpecificWords,
    testCompleteFlow
  };
  
  console.log("🧪 Vulgar filtering test functions loaded!");
  console.log("Run 'window.testVulgarFiltering.runVulgarFilteringTests()' to start testing");
}

// Export for Node.js
export {
  runVulgarFilteringTests,
  testFiltering,
  testSpecificWords,
  testCompleteFlow
};
