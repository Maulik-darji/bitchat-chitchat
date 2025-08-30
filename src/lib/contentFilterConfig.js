// Content Filter Configuration
// This file allows you to easily customize the content filtering behavior

export const FILTER_CONFIG = {
  // Enable/disable content filtering
  ENABLED: true,
  
  // Enable AI-based moderation for better multi-language support
  AI_MODERATION_ENABLED: true,
  
  // Action to take when inappropriate content is detected
  // Options: 'block', 'filter', 'warn'
  ACTION: 'warn',
  
  // Whether to show the content moderation modal
  SHOW_MODERATION_MODAL: true,
  
  // Whether to allow users to override and send original content
  ALLOW_OVERRIDE: false,
  
  // Maximum number of repeated words before flagging as spam
  MAX_WORD_REPETITION: 5,
  
  // Minimum word length to check for repetition
  MIN_WORD_LENGTH_FOR_REPETITION: 3,
  
  // Whether to filter common abbreviations (like wtf, omg, etc.)
  FILTER_ABBREVIATIONS: true,
  
  // Whether to filter leetspeak variations
  FILTER_LEETSPEAK: true,
  
  // Whether to filter patterns with spaces between letters
  FILTER_SPACED_PATTERNS: true,
  
  // Whether to filter excessive character repetition
  FILTER_CHARACTER_REPETITION: true,
  
  // Severity levels for different types of content
  SEVERITY_LEVELS: {
    VULGAR: 'high',
    RACIAL: 'high',
    SEXUAL: 'high',
    VIOLENCE: 'high',
    ABBREVIATIONS: 'low',
    REPETITION: 'medium'
  }
};

// Custom filter rules that can be easily modified
export const CUSTOM_FILTER_RULES = {
  // Add your own custom words here
  ADDITIONAL_WORDS: [
    // Add any additional words you want to filter
  ],
  
  // Add your own custom patterns here
  ADDITIONAL_PATTERNS: [
    // Add any additional regex patterns you want to filter
  ],
  
  // Words that should NOT be filtered (whitelist)
  WHITELIST: [
    // Add words that should never be filtered, even if they match patterns
    'assassin', 'assassination', 'assassin', 'assassinate',
    'classic', 'classical', 'classify', 'classification',
    'passion', 'passionate', 'passionately',
    'grass', 'glass', 'assume', 'assumption',
    'mass', 'massive', 'massively', 'massacre',
    'bass', 'brass', 'class', 'classroom',
    'assist', 'assistant', 'assistance',
    'pass', 'passage', 'passenger', 'passport',
    'grass', 'grassland', 'grasshopper',
    'assemble', 'assembly', 'assembler',
    'assess', 'assessment', 'assessor',
    'assert', 'assertion', 'assertive',
    'assign', 'assignment', 'assignee',
    'associate', 'association', 'associative',
    'assume', 'assumption', 'assuming',
    'assure', 'assurance', 'assured',
    'assume', 'assumption', 'assuming',
    'assume', 'assumption', 'assuming'
  ]
};

// Language-specific configurations
export const LANGUAGE_CONFIG = {
  ENGLISH: {
    ENABLED: true,
    CUSTOM_WORDS: [],
    CUSTOM_PATTERNS: []
  },
  // Add other languages as needed
  SPANISH: {
    ENABLED: false,
    CUSTOM_WORDS: [],
    CUSTOM_PATTERNS: []
  }
};

// Age-based filtering (for future use)
export const AGE_BASED_FILTERING = {
  ENABLED: false,
  AGE_GROUPS: {
    ALL_AGES: {
      STRICTNESS: 'high',
      FILTER_ABBREVIATIONS: true,
      FILTER_LEETSPEAK: true
    },
    TEEN: {
      STRICTNESS: 'medium',
      FILTER_ABBREVIATIONS: false,
      FILTER_LEETSPEAK: true
    },
    ADULT: {
      STRICTNESS: 'low',
      FILTER_ABBREVIATIONS: false,
      FILTER_LEETSPEAK: false
    }
  }
};

export default {
  FILTER_CONFIG,
  CUSTOM_FILTER_RULES,
  LANGUAGE_CONFIG,
  AGE_BASED_FILTERING
};
