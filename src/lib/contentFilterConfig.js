// Content Filter Configuration
// This file allows you to easily customize the content filtering behavior

export const FILTER_CONFIG = {
  // Enable/disable content filtering
  ENABLED: true,
  
  // Enable AI-based moderation for better multi-language support
  // DISABLED TEMPORARILY FOR PERFORMANCE
  AI_MODERATION_ENABLED: false,
  
  // Enable AllProfanity integration for comprehensive profanity detection
  ALLPROFANITY_ENABLED: true,
  
  // Enable ignoring of vulgar words in Hindi, Gujarati, and English
  IGNORE_VULGAR_WORDS: true,
  
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
    // Hindi vulgar words written in English text (Romanized)
    'madarchod', 'behnchod', 'chutiya', 'rand', 'chut', 'lund', 'gaand', 'bhosda', 
    'harami', 'behaya', 'randi', 'madar', 'behn', 'bhos', 'haram', 'behay',
    'chutiye', 'chutiyo', 'chutiyon', 'chutiyon', 'chutiyon', 'chutiyon',
    
    // Gujarati vulgar words written in English text (Romanized)
    'gaandu', 'gaand', 'gaandu', 'gaand', 'gaandu', 'gaand', 'gaandu',
    
    // Additional offensive terms
    'retard', 'retarded', 'idiot', 'stupid', 'dumb', 'moron',
    'jerk', 'jerkoff', 'douche', 'douchebag', 'scumbag', 'pieceofshit'
  ],
  
  // Add your own custom patterns here
  ADDITIONAL_PATTERNS: [
    // Hindi vulgar word patterns with variations
    /\b(madarchod|behnchod|chutiya|rand|chut|lund|gaand|bhosda|harami|behaya|randi)\b/gi,
    /\b(madar|behn|bhos|haram|behay)\b/gi,
    
    // Gujarati vulgar word patterns
    /\b(gaandu|gaand)\b/gi,
    
    // Mixed case variations
    /\b[A-Za-z]*(madarchod|behnchod|chutiya|randi)[A-Za-z]*\b/gi
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
  HINDI: {
    ENABLED: true,
    CUSTOM_WORDS: [],
    CUSTOM_PATTERNS: []
  },
  GUJARATI: {
    ENABLED: true,
    CUSTOM_WORDS: [],
    CUSTOM_PATTERNS: []
  },
  BENGALI: {
    ENABLED: true,
    CUSTOM_WORDS: [],
    CUSTOM_PATTERNS: []
  },
  TAMIL: {
    ENABLED: true,
    CUSTOM_WORDS: [],
    CUSTOM_PATTERNS: []
  },
  TELUGU: {
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
