// Simple test file for content filter functions
// Run this in browser console to test the filter

import { 
  filterMessage, 
  isMessageClean, 
  getDetectedVulgarWords,
  getFilterMessage 
} from './contentFilter';

// Test cases
const testMessages = [
  "Hello, how are you?", // Should be clean
  "This is a test message", // Should be clean
  "What the fuck is this?", // Should be flagged
  "This is bullshit", // Should be flagged
  "F U C K you", // Should be flagged (spaced)
  "fuuuuck this", // Should be flagged (repeated chars)
  "F*ck this", // Should be flagged (asterisk)
  "This is a legitimate message about grass and glass", // Should be clean (whitelisted words)
  "Hello world", // Should be clean
  "This message contains multiple bad words like shit and fuck", // Should be flagged
];

console.log("=== Content Filter Test Results ===");

testMessages.forEach((message, index) => {
  console.log(`\nTest ${index + 1}: "${message}"`);
  
  const isClean = isMessageClean(message);
  const { isClean: filterClean, filteredMessage } = filterMessage(message);
  const detectedWords = getDetectedVulgarWords(message);
  const warning = getFilterMessage(detectedWords);
  
  console.log(`  Is Clean: ${isClean}`);
  console.log(`  Filter Clean: ${filterClean}`);
  console.log(`  Detected Words: [${detectedWords.join(', ')}]`);
  console.log(`  Warning: ${warning}`);
  console.log(`  Filtered: "${filteredMessage}"`);
});

console.log("\n=== Test Complete ===");

// Test specific patterns
console.log("\n=== Pattern Tests ===");

const patternTests = [
  "f u c k", // Spaced
  "f*ck", // Asterisk
  "fuuuuck", // Repeated chars
  "FuCk", // Mixed case
  "sh!t", // Exclamation
  "sh1t", // Number
  "wtf", // Abbreviation
  "omg", // Abbreviation
];

patternTests.forEach((test, index) => {
  const result = filterMessage(test);
  console.log(`Pattern ${index + 1}: "${test}" -> Clean: ${result.isClean}, Filtered: "${result.filteredMessage}"`);
});

export { testMessages, patternTests };
