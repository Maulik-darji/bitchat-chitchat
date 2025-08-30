// Test file for Hindi vulgar words written in English text
// This tests the content filtering system's ability to catch Hindi vulgar words

import { filterMessage, isMessageClean, getDetectedVulgarWords } from './src/lib/contentFilter.js';

// Test messages with Hindi vulgar words written in English text
const testMessages = [
  // Clean messages
  "Hello, how are you?",
  "नमस्ते, आप कैसे हैं?",
  "નમસ્તે, તમે કેમ છો?",
  
  // Hindi vulgar words in English text
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
  
  // Mixed case variations
  "You are a Chutiya",
  "Don't be a Randi",
  "He is a Madarchod",
  "She is a Behnchod",
  
  // With context
  "Hello, you are a chutiya person",
  "Good morning, don't be a randi",
  "How are you? You seem like a madarchod",
  
  // Multiple vulgar words
  "You are a chutiya and randi",
  "He is both madarchod and behnchod",
  "She is chut and lund",
  
  // Edge cases
  "chutiya", // Just the word
  "RANDI", // All caps
  "MadArChOd", // Mixed case
  "behnchod.", // With punctuation
  " chutiya ", // With spaces
  
  // Gujarati vulgar words in English text
  "You are a gaandu",
  "He has gaand",
  
  // Mixed language
  "Hello नमस्ते, you are a chutiya",
  "નમસ્તે, you are a randi",
  
  // False positives (should not be caught)
  "I am passionate about this",
  "This is a classic example",
  "Please assist me",
  "I will pass the exam",
  "The grass is green",
  "Glass is transparent",
  "I assume you know",
  "This is massive",
  "Bass guitar sounds good",
  "Brass instruments are loud",
  "Class is important",
  "Assembly is required",
  "Assessment is needed",
  "Assert your rights",
  "Assign the task",
  "Associate with good people",
  "Assume responsibility",
  "Assure quality"
];

// Test function for content filtering
function testContentFiltering() {
  console.log("🔍 Testing Hindi Vulgar Words in English Text");
  console.log("=" .repeat(60));
  
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  
  for (let i = 0; i < testMessages.length; i++) {
    const message = testMessages[i];
    totalTests++;
    
    console.log(`\n📝 Test ${i + 1}: "${message}"`);
    
    try {
      // Test basic filtering
      const filterResult = filterMessage(message);
      const isClean = isMessageClean(message);
      const detectedWords = getDetectedVulgarWords(message);
      
      console.log(`   Is Clean: ${isClean}`);
      console.log(`   Filtered Message: "${filterResult.filteredMessage}"`);
      console.log(`   Detected Words: ${detectedWords.length > 0 ? detectedWords.join(', ') : 'None'}`);
      
      // Determine if this should be caught or not
      const shouldBeCaught = message.toLowerCase().includes('chutiya') || 
                            message.toLowerCase().includes('randi') ||
                            message.toLowerCase().includes('madarchod') ||
                            message.toLowerCase().includes('behnchod') ||
                            message.toLowerCase().includes('chut') ||
                            message.toLowerCase().includes('lund') ||
                            message.toLowerCase().includes('gaand') ||
                            message.toLowerCase().includes('bhosda') ||
                            message.toLowerCase().includes('harami') ||
                            message.toLowerCase().includes('behaya') ||
                            message.toLowerCase().includes('rand') ||
                            message.toLowerCase().includes('gaandu');
      
      const isCorrectlyHandled = shouldBeCaught ? !isClean : isClean;
      
      if (isCorrectlyHandled) {
        console.log(`   ✅ PASS: Correctly ${shouldBeCaught ? 'caught' : 'allowed'}`);
        passedTests++;
      } else {
        console.log(`   ❌ FAIL: Should have been ${shouldBeCaught ? 'caught' : 'allowed'}`);
        failedTests++;
      }
      
    } catch (error) {
      console.error(`   ❌ ERROR: ${error.message}`);
      failedTests++;
    }
  }
  
  // Summary
  console.log("\n" + "=" .repeat(60));
  console.log("📊 TEST SUMMARY");
  console.log("=" .repeat(60));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests} ✅`);
  console.log(`Failed: ${failedTests} ❌`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  if (failedTests === 0) {
    console.log("\n🎉 All tests passed! Hindi vulgar words are being properly filtered.");
  } else {
    console.log(`\n⚠️  ${failedTests} tests failed. Some Hindi vulgar words may not be properly filtered.`);
  }
}

// Test specific Hindi vulgar words
function testSpecificHindiWords() {
  console.log("\n🎯 Testing Specific Hindi Vulgar Words");
  console.log("=" .repeat(50));
  
  const hindiVulgarWords = [
    'chutiya', 'randi', 'madarchod', 'behnchod', 'chut', 'lund', 
    'gaand', 'bhosda', 'harami', 'behaya', 'rand', 'gaandu'
  ];
  
  hindiVulgarWords.forEach(word => {
    const message = `You are a ${word}`;
    const isClean = isMessageClean(message);
    const detectedWords = getDetectedVulgarWords(message);
    
    console.log(`"${word}": ${isClean ? '❌ NOT CAUGHT' : '✅ CAUGHT'} (Detected: ${detectedWords.join(', ')})`);
  });
}

// Test variations and misspellings
function testVariations() {
  console.log("\n🔄 Testing Variations and Misspellings");
  console.log("=" .repeat(50));
  
  const variations = [
    'Chutiya', 'CHUTIYA', 'ChUtIYa', 'chutiya', 'CHUTIYA',
    'Randi', 'RANDI', 'RaNdI', 'randi', 'RANDI',
    'Madarchod', 'MADARCHOD', 'MaDaRcHoD', 'madarchod', 'MADARCHOD',
    'Behnchod', 'BEHNCHOD', 'BeHnChOd', 'behnchod', 'BEHNCHOD'
  ];
  
  variations.forEach(variation => {
    const message = `You are a ${variation}`;
    const isClean = isMessageClean(message);
    
    console.log(`"${variation}": ${isClean ? '❌ NOT CAUGHT' : '✅ CAUGHT'}`);
  });
}

// Main test runner
function runHindiVulgarTests() {
  console.log("🚀 Starting Hindi Vulgar Words Tests");
  console.log("=" .repeat(60));
  
  try {
    // Test content filtering
    testContentFiltering();
    
    // Test specific words
    testSpecificHindiWords();
    
    // Test variations
    testVariations();
    
    console.log("\n✅ All Hindi vulgar word tests completed!");
    
  } catch (error) {
    console.error("\n❌ Test suite failed:", error.message);
    console.error("Stack trace:", error.stack);
  }
}

// Export test functions for use in browser console
if (typeof window !== 'undefined') {
  window.testHindiVulgarWords = {
    runHindiVulgarTests,
    testContentFiltering,
    testSpecificHindiWords,
    testVariations
  };
  
  console.log("🧪 Hindi vulgar words test functions loaded!");
  console.log("Run 'window.testHindiVulgarWords.runHindiVulgarTests()' to start testing");
}

// Export for Node.js
export {
  runHindiVulgarTests,
  testContentFiltering,
  testSpecificHindiWords,
  testVariations
};
