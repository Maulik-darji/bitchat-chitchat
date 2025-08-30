// Test file for AllProfanity Integration
// Run this in your browser console or Node.js environment

// Import the moderation functions
import { 
  moderateContent, 
  getComprehensiveProfanityAnalysis, 
  getIgnoredVulgarWordsInfo,
  moderateBatch 
} from './src/lib/aiModeration.js';

// Test messages in different languages
const testMessages = [
  // English - Clean
  "Hello, how are you today?",
  
  // English - Contains vulgar words (should be ignored due to whitelist)
  "This is a test message with some content",
  
  // Hindi - Clean
  "नमस्ते, आप कैसे हैं?",
  
  // Hindi - Contains vulgar words (should be ignored due to whitelist)
  "यह एक परीक्षण संदेश है",
  
  // Gujarati - Clean
  "નમસ્તે, તમે કેમ છો?",
  
  // Gujarati - Contains vulgar words (should be ignored due to whitelist)
  "આ એક પરીક્ષણ સંદેશ છે",
  
  // Mixed language
  "Hello नमस्तે, how are you?",
  
  // Leet-speak test (should be detected by AllProfanity)
  "You are a f#cking a55hole!",
  
  // Hindi vulgar words in English text (should be caught by content filter)
  "You are a chutiya",
  "Don't be a randi",
  "He is a madarchod",
  "She is a behnchod",
  
  // Empty message
  "",
  
  // Very long message
  "This is a very long message that contains multiple sentences and should be processed by the content moderation system. It includes various types of content to test the system's capabilities."
];

// Test function for comprehensive profanity analysis
async function testComprehensiveAnalysis() {
  console.log("🔍 Testing Comprehensive Profanity Analysis");
  console.log("=" .repeat(50));
  
  for (let i = 0; i < testMessages.length; i++) {
    const message = testMessages[i];
    console.log(`\n📝 Message ${i + 1}: "${message}"`);
    
    try {
      const analysis = getComprehensiveProfanityAnalysis(message);
      
      console.log(`   Is Profane: ${analysis.isProfane}`);
      console.log(`   Severity Level: ${analysis.severityLevel}`);
      console.log(`   Language: ${analysis.language}`);
      console.log(`   Detected Words: ${analysis.detectedWords.length > 0 ? analysis.detectedWords.join(', ') : 'None'}`);
      console.log(`   Whitelisted Words: ${analysis.whitelistedWords.length > 0 ? analysis.whitelistedWords.join(', ') : 'None'}`);
      console.log(`   Total Words: ${analysis.totalWords}`);
      console.log(`   Recommendations: ${analysis.recommendations.join(', ')}`);
      
      if (analysis.isProfane) {
        console.log(`   Clean Version: "${analysis.cleanVersion}"`);
      }
      
    } catch (error) {
      console.error(`   ❌ Error analyzing message:`, error.message);
    }
  }
}

// Test function for ignored vulgar words
async function testIgnoredVulgarWords() {
  console.log("\n🚫 Testing Ignored Vulgar Words");
  console.log("=" .repeat(50));
  
  const testVulgarMessages = [
    "This message contains fuck and shit",
    "यह संदेश चूत और लंड शब्दों को शामिल करता है",
    "આ સંદેશ ચૂત અને લંડ શબ્દો ધરાવે છે",
    "Mixed message with fuck and चूत",
    "Clean message without any vulgar words"
  ];
  
  for (let i = 0; i < testVulgarMessages.length; i++) {
    const message = testVulgarMessages[i];
    console.log(`\n📝 Vulgar Test ${i + 1}: "${message}"`);
    
    try {
      const info = getIgnoredVulgarWordsInfo(message);
      
      console.log(`   Has Ignored Words: ${info.hasIgnoredWords}`);
      console.log(`   Total Ignored Words: ${info.totalIgnoredWords}`);
      console.log(`   Ignored Words: ${info.ignoredWords.length > 0 ? info.ignoredWords.join(', ') : 'None'}`);
      console.log(`   Is Profane: ${info.profanityInfo.isProfane}`);
      console.log(`   Severity Level: ${info.profanityInfo.severityLevel}`);
      console.log(`   Detected Words: ${info.profanityInfo.detectedWords.length > 0 ? info.profanityInfo.detectedWords.join(', ') : 'None'}`);
      
    } catch (error) {
      console.error(`   ❌ Error analyzing vulgar words:`, error.message);
    }
  }
}

// Test function for batch moderation
async function testBatchModeration() {
  console.log("\n📦 Testing Batch Moderation");
  console.log("=" .repeat(50));
  
  try {
    const results = await moderateBatch(testMessages);
    
    console.log(`Processed ${results.length} messages:`);
    
    results.forEach((result, index) => {
      const message = testMessages[index];
      const status = result.isClean ? "✅ Clean" : "❌ Flagged";
      const confidence = (result.confidence * 100).toFixed(1);
      
      console.log(`   ${index + 1}. ${status} (${confidence}% confidence) - "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
      
      if (!result.isClean && result.details) {
        console.log(`      Details: ${JSON.stringify(result.details, null, 2)}`);
      }
    });
    
  } catch (error) {
    console.error("❌ Batch moderation failed:", error.message);
  }
}

// Test function for individual content moderation
async function testIndividualModeration() {
  console.log("\n🔐 Testing Individual Content Moderation");
  console.log("=" .repeat(50));
  
  const testModerationMessages = [
    "This is a clean message",
    "This message contains inappropriate content",
    "नमस्ते, यह एक स्वच्छ संदेश है",
    "Hello, this is a test message"
  ];
  
  for (let i = 0; i < testModerationMessages.length; i++) {
    const message = testModerationMessages[i];
    console.log(`\n📝 Moderation Test ${i + 1}: "${message}"`);
    
    try {
      const result = await moderateContent(message);
      
      console.log(`   Is Clean: ${result.isClean}`);
      console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`   Language: ${result.details.language || 'Unknown'}`);
      
      if (result.details.severity) {
        console.log(`   Severity: ${result.details.severity}`);
      }
      
      if (result.details.categories) {
        console.log(`   Categories: ${Object.keys(result.details.categories).filter(key => result.details.categories[key]).join(', ')}`);
      }
      
    } catch (error) {
      console.error(`   ❌ Error moderating content:`, error.message);
    }
  }
}

// Main test runner
async function runAllTests() {
  console.log("🚀 Starting AllProfanity Integration Tests");
  console.log("=" .repeat(60));
  
  try {
    // Test comprehensive analysis
    await testComprehensiveAnalysis();
    
    // Test ignored vulgar words
    await testIgnoredVulgarWords();
    
    // Test batch moderation
    await testBatchModeration();
    
    // Test individual moderation
    await testIndividualModeration();
    
    console.log("\n✅ All tests completed successfully!");
    console.log("\n📚 For more information, see:");
    console.log("   - ALLPROFANITY_INTEGRATION_README.md");
    console.log("   - AI_MODERATION_README.md");
    
  } catch (error) {
    console.error("\n❌ Test suite failed:", error.message);
    console.error("Stack trace:", error.stack);
  }
}

// Export test functions for use in browser console
if (typeof window !== 'undefined') {
  window.testAllProfanity = {
    runAllTests,
    testComprehensiveAnalysis,
    testIgnoredVulgarWords,
    testBatchModeration,
    testIndividualModeration
  };
  
  console.log("🧪 AllProfanity test functions loaded!");
  console.log("Run 'window.testAllProfanity.runAllTests()' to start testing");
}

// Export for Node.js
export {
  runAllTests,
  testComprehensiveAnalysis,
  testIgnoredVulgarWords,
  testBatchModeration,
  testIndividualModeration
};
