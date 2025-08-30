# AI-Based Content Moderation System with AllProfanity Integration

This system provides intelligent content moderation for your chat application using AI and the powerful AllProfanity library to detect inappropriate content in **Gujarati**, **Hindi**, **Bengali**, **Tamil**, **Telugu**, and **English** languages.

## 🚀 Features

- **Multi-language Support**: Automatically detects and moderates content in Gujarati, Hindi, Bengali, Tamil, Telugu, and English
- **AI-Powered**: Uses OpenAI's content moderation API for intelligent detection
- **AllProfanity Integration**: Enterprise-grade profanity detection with TRIE-based algorithm
- **Smart Whitelisting**: Automatically ignores specified vulgar words in all supported languages
- **Enhanced Local Detection**: Comprehensive patterns for Indian language vulgar words
- **Fallback System**: Advanced local detection when AI is unavailable
- **Real-time Analysis**: Provides confidence scores and detailed reports
- **Language Detection**: Automatically identifies the primary language of messages
- **Severity Levels**: Categorizes content by severity (MILD, MODERATE, SEVERE, EXTREME)
- **Leet-Speak Detection**: Catches obfuscated profanities like `f#ck`, `a55hole`

## 🔧 Setup

### 1. API Key Configuration

The system is already configured with your API key:
```javascript
const AI_MODERATION_API_KEY = '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';
```

### 2. Enable AI Moderation and AllProfanity

In `src/lib/contentFilterConfig.js`, ensure both AI moderation and AllProfanity are enabled:
```javascript
export const FILTER_CONFIG = {
  AI_MODERATION_ENABLED: true,    // Set to true to enable AI moderation
  ALLPROFANITY_ENABLED: true,     // Set to true to enable AllProfanity
  IGNORE_VULGAR_WORDS: true,      // Set to true to enable vulgar word whitelisting
  // ... other settings
};
```

## 🎯 AllProfanity Integration

The system now integrates the powerful AllProfanity library for comprehensive profanity detection:

### Key Benefits:
- **Ultra-Fast Detection**: TRIE-based algorithm provides O(n) performance
- **Multi-Script Support**: Handles Devanagari, Tamil, Telugu, Bengali, and Latin scripts
- **Leet-Speak Detection**: Catches obfuscated profanities like `f#ck`, `a55hole`
- **Smart Whitelisting**: Automatically ignores specified vulgar words
- **Severity Assessment**: Provides detailed severity levels (MILD, MODERATE, SEVERE, EXTREME)

### Supported Languages:
- **Hindi** (हिंदी) - Devanagari and Romanized scripts
- **Gujarati** (ગુજરાતી) - Gujarati and Romanized scripts  
- **Bengali** (বাংলা) - Bengali script
- **Tamil** (தமிழ்) - Tamil script
- **Telugu** (తెలుగు) - Telugu script
- **English** - Latin script

## 🎯 Enhanced Hindi & Gujarati Detection

The system now includes comprehensive patterns for Indian language vulgar words:

### Hindi Vulgar Words Detected:
- **Devanagari Script**: मादरचोद, बहनचोद, चूत, लंड, गांड, भोसड़ा, हरामी, बेहया, रंड, चूतिया
- **Romanized**: madarchod, behnchod, chutiya, rand, chut, lund, gaand, bhosda, harami, behaya, randi
- **Variations**: madar, behn, chut, lund, gaand, bhos, haram, behay, rand

### Gujarati Vulgar Words Detected:
- **Gujarati Script**: ગાંડુ, ચૂત, લંડ, ભોસડા, હરામી, બેહયા, રંડી, ચૂતિયા
- **Romanized**: gaandu, chut, lund, bhosda, harami, behaya, randi

### How It Works:
1. **Local Detection First**: Checks for known vulgar patterns before AI analysis
2. **High Confidence**: Local detection provides 90%+ confidence for known words
3. **AI Enhancement**: AI catches context, intent, and variations not in patterns
4. **Fallback Protection**: Traditional filtering when both systems are unavailable

## 📖 Usage

### Basic Content Moderation

```javascript
import { moderateContent, getModerationReport } from './lib/aiModeration';

// Moderate a single message
const result = await moderateContent("Your message here");
const report = getModerationReport(result);

console.log(`Is clean: ${result.isClean}`);
console.log(`Confidence: ${result.confidence}`);
console.log(`Language: ${report.language}`);
console.log(`Severity: ${report.severity}`);
```

### AllProfanity Profanity Analysis

```javascript
import { getComprehensiveProfanityAnalysis } from './lib/aiModeration';

// Get detailed profanity analysis
const analysis = getComprehensiveProfanityAnalysis("Your message here");

console.log(`Is Profane: ${analysis.isProfane}`);
console.log(`Severity Level: ${analysis.severityLevel}`);
console.log(`Detected Words: ${analysis.detectedWords}`);
console.log(`Clean Version: ${analysis.cleanVersion}`);
console.log(`Recommendations: ${analysis.recommendations}`);
```

### Vulgar Word Whitelist Information

```javascript
import { getIgnoredVulgarWordsInfo } from './lib/aiModeration';

// Get information about ignored vulgar words
const info = getIgnoredVulgarWordsInfo("Your message here");

console.log(`Has Ignored Words: ${info.hasIgnoredWords}`);
console.log(`Ignored Words: ${info.ignoredWords}`);
console.log(`Profanity Info:`, info.profanityInfo);
```

### Integration with Content Filter

```javascript
import { filterMessageAI } from './lib/contentFilter';

// Use AI moderation with filtering
const filteredResult = await filterMessageAI("Your message here");

if (filteredResult.isClean) {
  // Message is safe to send
  sendMessage(filteredResult.filteredMessage);
} else {
  // Show moderation warning
  showModerationWarning(filteredResult);
}
```

### Batch Moderation

```javascript
import { moderateBatch } from './lib/aiModeration';

const messages = ["Message 1", "Message 2", "Message 3"];
const results = await moderateBatch(messages);

results.forEach((result, index) => {
  console.log(`Message ${index + 1}: ${result.isClean ? 'Clean' : 'Flagged'}`);
});
```

## 🎯 How It Works

### 1. Language Detection
The system automatically detects the primary language of each message:
- **Gujarati**: Unicode range `\u0A80-\u0AFF`
- **Hindi**: Unicode range `\u0900-\u097F`
- **English**: Latin alphabet characters

### 2. Local Vulgar Word Check
Before AI analysis, the system checks against comprehensive patterns:
- **Hindi**: 30+ patterns including Devanagari and Romanized
- **Gujarati**: 15+ patterns including Gujarati script and Romanized
- **English**: Enhanced patterns for common vulgar words

### 3. AI Analysis
Messages that pass local checks are sent to OpenAI's content moderation API which analyzes:
- Hate speech and harassment
- Sexual content
- Violence and threats
- Self-harm content
- And other inappropriate categories

### 4. Content Filtering
Based on analysis results:
- **High severity**: Entire message replaced with asterisks
- **Medium severity**: Specific flagged content cleaned
- **Low severity**: Warning shown to user

### 5. Fallback System
If AI moderation fails, the system falls back to enhanced local detection for comprehensive protection.

## 🔍 Content Moderation Categories

The AI system detects various types of inappropriate content:

- **Hate**: Hate speech, discrimination, racism
- **Harassment**: Bullying, threats, intimidation
- **Sexual**: Explicit sexual content, harassment
- **Violence**: Threats, violence, self-harm
- **Self-harm**: Suicide, self-injury content

## 📊 AllProfanity Severity Levels

AllProfanity provides detailed severity assessment:

| Level    | Enum Value | Description                         |
| -------- | ---------- | ----------------------------------- |
| MILD     | 1          | 1 unique/total word                 |
| MODERATE | 2          | 2 unique or total words             |
| SEVERE   | 3          | 3 unique/total words                |
| EXTREME  | 4          | 4+ unique or 5+ total profane words |

## 📱 Component Integration

### ContentModeration Component

The `ContentModeration` component now supports AI moderation:

```javascript
<ContentModeration
  message={userMessage}
  onMessageChange={setMessage}
  onSend={handleSend}
  useAI={true}  // Enable AI moderation
  isVisible={showModeration}
  onClose={() => setShowModeration(false)}
/>
```

### Features:
- **Loading State**: Shows "Analyzing content with AI..." while processing
- **Language Display**: Shows detected language (English/Hindi/Gujarati)
- **Confidence Scores**: Displays AI confidence in detection
- **Severity Levels**: Shows content severity (low/medium/high)
- **Detailed Reports**: Provides specific category information
- **Local Detection**: Shows when vulgar words are caught by local patterns

## 🧪 Testing

### Browser Console Testing

Open your browser console and run:
```javascript
// Test individual moderation
window.testAIModeration();

// Test Hindi vulgar words specifically
window.testHindiVulgarWords();

// Test batch moderation
window.testBatchModeration();
```

### Test Messages

The system includes test messages in all supported languages:
- **English**: Clean and inappropriate content
- **Hindi**: नमस्ते messages with various content types + specific vulgar words
- **Gujarati**: નમસ્તે messages with various content types + specific vulgar words

### Hindi Vulgar Word Testing
The system specifically tests these Hindi vulgar words:
- madarchod, behnchod, chutiya, rand
- chut, lund, gaand, bhosda
- harami, behaya, randi

## ⚙️ Configuration Options

### AI Moderation Settings

```javascript
// In contentFilterConfig.js
export const FILTER_CONFIG = {
  AI_MODERATION_ENABLED: true,        // Enable/disable AI moderation
  ACTION: 'warn',                     // Action on detection: 'block', 'filter', 'warn'
  SHOW_MODERATION_MODAL: true,        // Show moderation warning modal
  ALLOW_OVERRIDE: false,              // Allow users to override moderation
};
```

### Language-Specific Settings

```javascript
export const LANGUAGE_CONFIG = {
  ENGLISH: { ENABLED: true },
  HINDI: { ENABLED: true },
  GUJARATI: { ENABLED: true }
};
```

## 🚨 Error Handling

The system includes robust error handling:

1. **API Failures**: Falls back to enhanced local detection
2. **Network Issues**: Graceful degradation with local patterns
3. **Invalid Responses**: Error logging and fallback
4. **Rate Limiting**: Handles API limits gracefully

## 📊 Performance

- **Async Processing**: Non-blocking content analysis
- **Local First**: Fast local detection before AI calls
- **Batch Support**: Process multiple messages efficiently
- **Caching**: Results can be cached for repeated content
- **Fallback**: Enhanced local detection when AI is unavailable

## 🔒 Security

- **API Key Protection**: Key stored in client-side code (consider moving to environment variables for production)
- **Content Privacy**: Messages sent to OpenAI for analysis
- **No Storage**: Raw messages not stored permanently
- **User Control**: Users can see what content was flagged
- **Local Detection**: Sensitive content caught locally without external API calls

## 🚀 Future Enhancements

- **Custom Categories**: Add language-specific moderation rules
- **User Feedback**: Learn from user corrections
- **Context Awareness**: Consider conversation context
- **Performance Optimization**: Implement result caching
- **Multi-modal**: Support for images and other content types
- **Pattern Updates**: Regular updates to vulgar word patterns
- **Additional Languages**: Support for Arabic, Russian, and other languages
- **Contextual Detection**: Improve accuracy with conversation context
- **Machine Learning**: Integrate ML-based content analysis
- **Real-time Updates**: Dynamic dictionary updates

## 📞 Support

For issues or questions about the AI moderation system:
1. Check browser console for error messages
2. Verify API key is valid and has sufficient credits
3. Test with the provided test functions
4. Review OpenAI API documentation for rate limits and usage
5. Test Hindi vulgar words with `window.testHindiVulgarWords()`

---

**Note**: This system provides intelligent content moderation but should not be the only line of defense. Consider implementing additional safety measures and user reporting systems for comprehensive content management.

**AllProfanity Integration**: The system now includes enterprise-grade profanity detection with comprehensive support for Indian languages and scripts, providing immediate detection without waiting for AI analysis.

**Additional Documentation**: For detailed information about the AllProfanity integration, see `ALLPROFANITY_INTEGRATION_README.md`.
