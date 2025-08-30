# AllProfanity Integration for Content Moderation

This document describes the integration of the [AllProfanity](https://github.com/ayush-jadaun/AllProfanity) library into our content moderation system to provide comprehensive profanity detection in multiple languages.

## Overview

AllProfanity is a blazing-fast, multi-language, enterprise-grade profanity filter for JavaScript/TypeScript that provides:

- **Ultra-Fast O(n) Detection:** TRIE-based, single-pass algorithm
- **Multi-Language Support:** Built-in dictionaries for English, Hindi, French, German, Spanish, Bengali, Tamil, Telugu
- **Multiple Scripts:** Detects profanity in Latin/Roman and native scripts (Devanagari, Tamil, Telugu, etc.)
- **Advanced Leet-Speak Normalization:** Detects obfuscated profanities
- **Unicode & Punctuation Robustness:** Handles mixed language content
- **Flexible Cleaning:** Replace matches with configurable placeholders
- **Whitelisting:** Exclude safe words from detection
- **Severity Levels:** Assess offensive content levels

## Installation

The AllProfanity library has been installed via npm:

```bash
npm install allprofanity
```

## Configuration

### API Key Update

The content moderation API key has been updated to:
```
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
```

### AllProfanity Initialization

The library is automatically initialized in `src/lib/aiModeration.js`:

```javascript
import profanity, { ProfanitySeverity } from 'allprofanity';

// Initialize with Indian languages
profanity.loadIndianLanguages(); // Loads Hindi, Bengali, Tamil, Telugu
profanity.loadLanguage('english'); // Load English
profanity.loadLanguage('gujarati'); // Load Gujarati if available

// Configure for optimal performance
profanity.updateConfig({
  enableLeetSpeak: true,
  caseSensitive: false,
  strictMode: false,
  detectPartialWords: false,
  defaultPlaceholder: '*'
});
```

## Vulgar Words Ignored

The system is configured to ignore vulgar words in the following languages:

### Hindi (हिंदी)
- Devanagari script: मादरचोद, बहनचोद, चूत, लंड, गांड, भोसड़ा, हरामी, बेहया, रंड, चूतिया
- Romanized: madarchod, behnchod, chutiya, rand, chut, lund, gaand, bhosda, harami, behaya, randi

### Gujarati (ગુજરાતી)
- Devanagari script: ગાંડુ, ચૂત, લંડ, ભોસડા, હરામી, બેહયા, રંડી, ચૂતિયા
- Romanized: gaandu, chut, lund, bhosda, harami, behaya, randi

### English
- Common vulgar words: fuck, shit, bitch, ass, dick, pussy, cock, cunt, bastard, whore, slut, etc.

## API Functions

### 1. `moderateContent(message)`
Main content moderation function that uses both AllProfanity and AI moderation.

```javascript
import { moderateContent } from './lib/aiModeration';

const result = await moderateContent("Your message here");
console.log(result.isClean); // boolean
console.log(result.confidence); // number (0-1)
console.log(result.details); // detailed analysis
```

### 2. `getComprehensiveProfanityAnalysis(message)`
Get detailed profanity analysis using AllProfanity.

```javascript
import { getComprehensiveProfanityAnalysis } from './lib/aiModeration';

const analysis = getComprehensiveProfanityAnalysis("Your message here");
console.log(analysis.severityLevel); // MILD, MODERATE, SEVERE, EXTREME
console.log(analysis.detectedWords); // array of detected profane words
console.log(analysis.cleanVersion); // cleaned version of the message
```

### 3. `getIgnoredVulgarWordsInfo(message)`
Get information about which vulgar words were ignored.

```javascript
import { getIgnoredVulgarWordsInfo } from './lib/aiModeration';

const info = getIgnoredVulgarWordsInfo("Your message here");
console.log(info.hasIgnoredWords); // boolean
console.log(info.ignoredWords); // array of ignored words
console.log(info.profanityInfo); // detailed profanity information
```

## Severity Levels

AllProfanity provides severity levels for profanity detection:

| Level    | Enum Value | Description                         |
| -------- | ---------- | ----------------------------------- |
| MILD     | 1          | 1 unique/total word                 |
| MODERATE | 2          | 2 unique or total words             |
| SEVERE   | 3          | 3 unique/total words                |
| EXTREME  | 4          | 4+ unique or 5+ total profane words |

## Language Support

The system now supports comprehensive profanity detection in:

- **English** - Latin script
- **Hindi** - Devanagari and Romanized scripts
- **Gujarati** - Devanagari and Romanized scripts
- **Bengali** - Bengali script
- **Tamil** - Tamil script
- **Telugu** - Telugu script

## Example Usage

### Basic Content Moderation
```javascript
import { moderateContent } from './lib/aiModeration';

const message = "This is a test message with some content";
const result = await moderateContent(message);

if (result.isClean) {
  console.log("Message is appropriate");
} else {
  console.log("Message contains inappropriate content");
  console.log("Confidence:", result.confidence);
  console.log("Details:", result.details);
}
```

### Profanity Analysis
```javascript
import { getComprehensiveProfanityAnalysis } from './lib/aiModeration';

const message = "Your message here";
const analysis = getComprehensiveProfanityAnalysis(message);

console.log("Is Profane:", analysis.isProfane);
console.log("Severity Level:", analysis.severityLevel);
console.log("Detected Words:", analysis.detectedWords);
console.log("Clean Version:", analysis.cleanVersion);
console.log("Recommendations:", analysis.recommendations);
```

### Batch Moderation
```javascript
import { moderateBatch } from './lib/aiModeration';

const messages = [
  "Message 1",
  "Message 2",
  "Message 3"
];

const results = await moderateBatch(messages);
results.forEach((result, index) => {
  console.log(`Message ${index + 1}:`, result.isClean ? "Clean" : "Flagged");
});
```

## Configuration Options

### Content Filter Configuration
```javascript
// src/lib/contentFilterConfig.js
export const FILTER_CONFIG = {
  ENABLED: true,
  AI_MODERATION_ENABLED: true,
  ALLPROFANITY_ENABLED: true, // New option
  IGNORE_VULGAR_WORDS: true,
  ACTION: 'warn', // 'block', 'filter', 'warn'
  SHOW_MODERATION_MODAL: true,
  ALLOW_OVERRIDE: false
};
```

### AllProfanity Configuration
```javascript
profanity.updateConfig({
  enableLeetSpeak: true,        // Detect leet-speak variations
  caseSensitive: false,         // Case-insensitive detection
  strictMode: false,            // Relaxed matching
  detectPartialWords: false,    // Full word matching only
  defaultPlaceholder: '*'       // Default replacement character
});
```

## Performance Benefits

- **Faster Detection:** TRIE-based algorithm provides O(n) performance
- **Reduced False Positives:** Advanced language detection and context awareness
- **Better Language Support:** Native support for Indian languages and scripts
- **Leet-Speak Detection:** Catches obfuscated profanities like `f#ck`, `a55hole`
- **Unicode Support:** Handles mixed-language content seamlessly

## Security Features

- **No Wordlist Exposure:** Internal word lists are not exposed for security
- **Whitelist Management:** Safe words can be added to prevent false positives
- **Configurable Actions:** Choose between block, filter, or warn actions
- **Audit Trail:** Detailed logging of moderation decisions

## Troubleshooting

### Common Issues

1. **Import Errors:** Ensure AllProfanity is properly installed
2. **Language Detection:** Check if required languages are loaded
3. **Performance Issues:** Monitor memory usage with large dictionaries
4. **False Positives:** Use whitelist to exclude safe words

### Debug Mode

Enable debug logging to troubleshoot issues:

```javascript
// Add to your configuration
profanity.updateConfig({
  debug: true
});
```

## Future Enhancements

- **Custom Language Packs:** Add support for additional languages
- **Contextual Detection:** Improve accuracy with context awareness
- **Machine Learning:** Integrate ML-based content analysis
- **Real-time Updates:** Dynamic dictionary updates
- **API Rate Limiting:** Optimize API usage for cost efficiency

## References

- [AllProfanity GitHub Repository](https://github.com/ayush-jadaun/AllProfanity)
- [AllProfanity npm Package](https://www.npmjs.com/package/allprofanity)
- [Content Moderation API Documentation](https://platform.openai.com/docs/guides/moderation)

## Support

For issues related to:
- **AllProfanity Integration:** Check this document and the library's GitHub repository
- **Content Moderation API:** Refer to OpenAI's official documentation
- **Custom Configuration:** Review the configuration files in `src/lib/`

---

*Last updated: December 2024*
*Version: 2.0.0*
