// Test file for AI Moderation functionality
// This demonstrates how the AI moderation works

import { moderateContent, getModerationReport } from './aiModeration';

// Test messages in different languages
const testMessages = {
  english: {
    clean: "Hello, how are you today?",
    vulgar: "This is a test message with inappropriate content",
    mixed: "Hello there, this is a normal message"
  },
  hindi: {
    clean: "नमस्ते, आप कैसे हैं?",
    vulgar: "यह एक अश्लील संदेश है",
    mixed: "नमस्ते, आज का दिन कैसा है?",
    // Test specific Hindi vulgar words
    madarchod: "madarchod",
    behnchod: "behnchod", 
    chutiya: "chutiya",
    rand: "rand",
    chut: "chut",
    lund: "lund",
    gaand: "gaand",
    bhosda: "bhosda",
    harami: "harami",
    behaya: "behaya",
    randi: "randi"
  },
  gujarati: {
    clean: "નમસ્તે, તમે કેમ છો?",
    vulgar: "આ એક અશ્લીલ સંદેશ છે",
    mixed: "નમસ્તે, આજનો દિવસ કેવો છે?",
    // Test specific Gujarati vulgar words
    gaandu: "gaandu",
    chut: "chut",
    lund: "lund",
    bhosda: "bhosda",
    harami: "harami",
    behaya: "behaya",
    randi: "randi"
  }
};

// Function to test moderation
async function testModeration() {
  console.log('🧪 Testing AI Content Moderation...\n');
  
  for (const [language, messages] of Object.entries(testMessages)) {
    console.log(`📝 Testing ${language.toUpperCase()} messages:`);
    
    for (const [type, message] of Object.entries(messages)) {
      try {
        console.log(`\n  Testing ${type} message: "${message}"`);
        
        const result = await moderateContent(message);
        const report = getModerationReport(result);
        
        console.log(`    ✅ Clean: ${result.isClean}`);
        console.log(`    📊 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
        console.log(`    🚨 Severity: ${report.severity}`);
        console.log(`    🌐 Language: ${report.language}`);
        
        if (result.details.localDetection) {
          console.log(`    🔍 Local Detection: ${result.details.detectedWords?.join(', ') || 'None'}`);
        }
        
        if (report.flaggedCategories.length > 0) {
          console.log(`    ⚠️  Flagged categories: ${report.flaggedCategories.map(c => c.category).join(', ')}`);
        }
        
      } catch (error) {
        console.log(`    ❌ Error: ${error.message}`);
      }
    }
    console.log('\n' + '─'.repeat(50) + '\n');
  }
}

// Function to specifically test Hindi vulgar words
async function testHindiVulgarWords() {
  console.log('🚨 Testing Hindi Vulgar Words Detection...\n');
  
  const hindiVulgarWords = [
    'madarchod', 'behnchod', 'chutiya', 'rand', 'chut', 'lund', 
    'gaand', 'bhosda', 'harami', 'behaya', 'randi'
  ];
  
  for (const word of hindiVulgarWords) {
    try {
      console.log(`Testing: "${word}"`);
      
      const result = await moderateContent(word);
      const report = getModerationReport(result);
      
      console.log(`  ✅ Clean: ${result.isClean}`);
      console.log(`  📊 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`  🚨 Severity: ${report.severity}`);
      console.log(`  🌐 Language: ${report.language}`);
      
      if (result.details.localDetection) {
        console.log(`  🔍 Local Detection: ${result.details.detectedWords?.join(', ') || 'None'}`);
      }
      
      if (result.isClean) {
        console.log(`  ⚠️  WARNING: "${word}" was NOT detected as vulgar!`);
      } else {
        console.log(`  ✅ SUCCESS: "${word}" was correctly detected as vulgar`);
      }
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
    console.log('');
  }
}

// Function to test batch moderation
async function testBatchModeration() {
  console.log('🔄 Testing Batch Moderation...\n');
  
  const allMessages = [
    ...Object.values(testMessages.english),
    ...Object.values(testMessages.hindi),
    ...Object.values(testMessages.gujarati)
  ];
  
  try {
    const results = await Promise.all(
      allMessages.map(msg => moderateContent(msg))
    );
    
    console.log(`📊 Processed ${results.length} messages`);
    
    const cleanCount = results.filter(r => r.isClean).length;
    const flaggedCount = results.length - cleanCount;
    
    console.log(`✅ Clean messages: ${cleanCount}`);
    console.log(`🚨 Flagged messages: ${flaggedCount}`);
    
  } catch (error) {
    console.log(`❌ Batch moderation error: ${error.message}`);
  }
}

// Export test functions
export { testModeration, testBatchModeration, testHindiVulgarWords };

// Run tests if this file is executed directly
if (typeof window !== 'undefined') {
  // Browser environment
  window.testAIModeration = testModeration;
  window.testBatchModeration = testBatchModeration;
  window.testHindiVulgarWords = testHindiVulgarWords;
  
  console.log('🧪 AI Moderation tests loaded. Use:');
  console.log('  - window.testAIModeration() to run all tests');
  console.log('  - window.testHindiVulgarWords() to test Hindi vulgar words');
  console.log('  - window.testBatchModeration() to test batch processing');
} else {
  // Node.js environment
  console.log('🧪 AI Moderation tests loaded for Node.js environment.');
}
