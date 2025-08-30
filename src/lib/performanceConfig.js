// Performance Configuration for Chat Application
// This file controls various performance optimizations

export const PERFORMANCE_CONFIG = {
  // Message Sending Optimizations
  MESSAGE_SENDING: {
    // Enable optimistic updates for instant UI feedback
    ENABLE_OPTIMISTIC_UPDATES: true,
    
    // Use fast spam checks instead of full checks
    USE_FAST_SPAM_CHECK: true,
    
    // Send messages to Firebase in background (non-blocking)
    NON_BLOCKING_FIREBASE: true,
    
    // Immediate focus restoration after sending
    IMMEDIATE_FOCUS_RESTORATION: true,
    
    // Immediate input clearing for instant feedback
    IMMEDIATE_INPUT_CLEAR: true,
    
    // Immediate auto-scroll after sending
    IMMEDIATE_AUTO_SCROLL: true
  },

  // Content Filtering Optimizations
  CONTENT_FILTERING: {
    // Use cached regex patterns for faster filtering
    USE_CACHED_PATTERNS: true,
    
    // Skip pattern checks for short messages
    SKIP_PATTERNS_FOR_SHORT_MESSAGES: true,
    
    // Short message threshold (characters)
    SHORT_MESSAGE_THRESHOLD: 3,
    
    // Long message threshold for pattern checks
    LONG_MESSAGE_THRESHOLD: 10
  },

  // Firebase Optimizations
  FIREBASE: {
    // Use batch operations for better performance
    USE_BATCH_OPERATIONS: true,
    
    // Non-blocking user activity updates
    NON_BLOCKING_ACTIVITY_UPDATES: true,
    
    // Non-blocking message commits
    NON_BLOCKING_MESSAGE_COMMITS: true
  },

  // UI Optimizations
  UI: {
    // Remove delays in focus restoration
    REMOVE_FOCUS_DELAYS: true,
    
    // Remove delays in auto-scroll
    REMOVE_SCROLL_DELAYS: true,
    
    // Use unique IDs for optimistic messages
    USE_UNIQUE_OPTIMISTIC_IDS: true
  }
};

// Helper function to check if an optimization is enabled
export function isOptimizationEnabled(category, feature) {
  return PERFORMANCE_CONFIG[category]?.[feature] === true;
}

// Helper function to get optimization value
export function getOptimizationValue(category, feature) {
  return PERFORMANCE_CONFIG[category]?.[feature];
}

// Export individual configs for easy access
export const MESSAGE_CONFIG = PERFORMANCE_CONFIG.MESSAGE_SENDING;
export const FILTER_CONFIG = PERFORMANCE_CONFIG.CONTENT_FILTERING;
export const FIREBASE_CONFIG = PERFORMANCE_CONFIG.FIREBASE;
export const UI_CONFIG = PERFORMANCE_CONFIG.UI;
