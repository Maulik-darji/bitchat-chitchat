# Content Moderation System

This document explains how to use and customize the content moderation system in your chat application.

## Overview

The content moderation system automatically detects and filters inappropriate content from messages before they are sent. It includes:

- **Word filtering**: Detects vulgar, offensive, and inappropriate words
- **Pattern detection**: Catches attempts to bypass filters (leetspeak, spacing, etc.)
- **Spam detection**: Identifies excessive word repetition
- **User choice**: Users can choose to send filtered content or override warnings

## Features

### 1. Automatic Content Detection
- Filters vulgar and offensive language
- Detects racial slurs and hate speech
- Identifies sexual content and violence
- Catches spam-like behavior

### 2. Smart Pattern Recognition
- **Leetspeak variations**: `f*ck`, `f**k`, `fuq`, etc.
- **Spaced patterns**: `f u c k`, `s h i t`, etc.
- **Character repetition**: `fuuuuck`, `shiiit`, etc.
- **Mixed case**: `FuCk`, `ShIt`, etc.

### 3. User Experience
- Shows warning modal when inappropriate content is detected
- Displays original vs. filtered message
- Lists detected problematic words
- Gives users choice: send filtered, send original, or cancel

## Configuration

### Basic Settings (`src/lib/contentFilterConfig.js`)

```javascript
export const FILTER_CONFIG = {
  // Enable/disable content filtering
  ENABLED: true,
  
  // Action to take when inappropriate content is detected
  ACTION: 'warn', // Options: 'block', 'filter', 'warn'
  
  // Whether to show the content moderation modal
  SHOW_MODERATION_MODAL: true,
  
  // Whether to allow users to override and send original content
  ALLOW_OVERRIDE: false, // Users cannot bypass content filters
  
  // Maximum word repetition before flagging as spam
  MAX_WORD_REPETITION: 5,
  
  // Minimum word length for repetition checking
  MIN_WORD_LENGTH_FOR_REPETITION: 3
};
```

### Custom Filter Rules

```javascript
export const CUSTOM_FILTER_RULES = {
  // Add your own custom words here
  ADDITIONAL_WORDS: [
    'customword1',
    'customword2'
  ],
  
  // Add your own custom patterns here
  ADDITIONAL_PATTERNS: [
    /your-custom-pattern/gi
  ],
  
  // Words that should NEVER be filtered (whitelist)
  WHITELIST: [
    'assassin', 'classic', 'passion', 'grass', 'glass'
    // Add legitimate words that might trigger false positives
  ]
};
```

## Usage

### For Users

1. **Type a message** in any chat (public, private, or room)
2. **If inappropriate content is detected**:
   - A warning modal appears
   - Shows original vs. filtered message
   - Lists detected problematic words
3. **Choose an action**:
   - **Send Filtered Message**: Sends the cleaned version
   - **Send Original Message**: Sends as-is (admin override)
   - **Cancel**: Returns to editing

### For Developers

#### Integration

The content moderation is automatically integrated into:
- `PublicChat` component
- `PrivateChat` component  
- `PrivateRoom` component

#### Customization

1. **Modify filter words**: Edit `VULGAR_WORDS` array in `contentFilter.js`
2. **Adjust patterns**: Modify `PATTERNS` array in `contentFilter.js`
3. **Change behavior**: Update `FILTER_CONFIG` in `contentFilterConfig.js`
4. **Add custom rules**: Use `CUSTOM_FILTER_RULES` in `contentFilterConfig.js`

#### API Functions

```javascript
import { 
  filterMessage, 
  isMessageClean, 
  getDetectedVulgarWords,
  getFilterMessage 
} from '../lib/contentFilter';

// Check if message is clean
const isClean = isMessageClean(message);

// Filter a message
const { isClean, filteredMessage } = filterMessage(message);

// Get detected vulgar words
const vulgarWords = getDetectedVulgarWords(message);

// Get user-friendly warning message
const warning = getFilterMessage(vulgarWords);
```

## Customization Examples

### Add Custom Words

```javascript
// In contentFilterConfig.js
export const CUSTOM_FILTER_RULES = {
  ADDITIONAL_WORDS: [
    'yourcustomword',
    'anotherword',
    'company-specific-term'
  ]
};
```

### Disable Specific Filtering

```javascript
// In contentFilterConfig.js
export const FILTER_CONFIG = {
  FILTER_ABBREVIATIONS: false,  // Don't filter wtf, omg, etc.
  FILTER_LEETSPEAK: false,      // Don't filter leetspeak variations
  FILTER_SPACED_PATTERNS: false // Don't filter spaced patterns
};
```

### Change Filter Strictness

```javascript
// In contentFilterConfig.js
export const FILTER_CONFIG = {
  MAX_WORD_REPETITION: 3,        // More strict: flag after 3 repetitions
  MIN_WORD_LENGTH_FOR_REPETITION: 4, // Only check words 4+ characters
  ACTION: 'block'                 // Block instead of warn
};
```

## Advanced Features

### Language Support

```javascript
export const LANGUAGE_CONFIG = {
  ENGLISH: {
    ENABLED: true,
    CUSTOM_WORDS: ['english-specific-word']
  },
  SPANISH: {
    ENABLED: true,
    CUSTOM_WORDS: ['palabra-española']
  }
};
```

### Age-Based Filtering

```javascript
export const AGE_BASED_FILTERING = {
  ENABLED: true,
  AGE_GROUPS: {
    ALL_AGES: {
      STRICTNESS: 'high',
      FILTER_ABBREVIATIONS: true
    },
    ADULT: {
      STRICTNESS: 'low',
      FILTER_ABBREVIATIONS: false
    }
  }
};
```

## Troubleshooting

### Common Issues

1. **False positives**: Add legitimate words to `WHITELIST`
2. **Missing words**: Add to `ADDITIONAL_WORDS` or `VULGAR_WORDS`
3. **Performance**: Reduce pattern complexity or disable unused features

### Debug Mode

```javascript
// Add to contentFilterConfig.js
export const DEBUG_MODE = {
  ENABLED: true,
  LOG_DETECTED_WORDS: true,
  LOG_FILTER_ACTIONS: true
};
```

## Security Considerations

- **Client-side filtering**: This is for user experience, not security
- **Server-side validation**: Always validate content on the server
- **Admin override**: Consider if users should be able to bypass filters
- **Logging**: Consider logging filter actions for moderation purposes

## Future Enhancements

- Machine learning-based content detection
- Context-aware filtering
- User reporting system
- Automatic content flagging
- Multi-language support
- Custom filter training

## Support

For questions or issues with the content moderation system:
1. Check this documentation
2. Review the configuration files
3. Test with different message types
4. Check browser console for errors
