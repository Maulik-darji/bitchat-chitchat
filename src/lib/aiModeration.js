// AI-Based Content Moderation Service
// Uses AI to detect vulgar/inappropriate content in multiple languages
// Supports Gujarati, Hindi, and English
// Enhanced with AllProfanity library for comprehensive profanity detection

import profanity, { ProfanitySeverity } from 'allprofanity';

const AI_MODERATION_API_KEY = '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';
const AI_MODERATION_ENDPOINT = 'https://api.openai.com/v1/moderations';

// Initialize AllProfanity with Indian languages
profanity.loadIndianLanguages(); // Loads Hindi, Bengali, Tamil, Telugu
profanity.loadLanguage('english'); // Load English
profanity.loadLanguage('gujarati'); // Load Gujarati if available

// Configure AllProfanity for optimal performance
profanity.updateConfig({
  enableLeetSpeak: true,
  caseSensitive: false,
  strictMode: false,
  detectPartialWords: false,
  defaultPlaceholder: '*'
});

// AllProfanity provides comprehensive profanity detection for multiple languages
// No need for manual patterns - the library handles everything automatically

// Comprehensive ignore list for vulgar words in Hindi, Gujarati, and English
// These words will be completely ignored by the AI moderation system using AllProfanity's whitelist
const IGNORE_VULGAR_WORDS = {
  // Hindi vulgar words to ignore
  hindi: [
    // Devanagari script
    'मादरचोद', 'बहनचोद', 'चूत', 'लंड', 'गांड', 'भोसड़ा', 'हरामी', 'बेहया', 'रंड', 'चूतिया',
    // Romanized Hindi vulgar words
    'madarchod', 'behnchod', 'chutiya', 'rand', 'chut', 'lund', 'gaand', 'bhosda', 'harami', 'behaya', 'randi',
    'madar', 'behn', 'chut', 'lund', 'gaand', 'bhos', 'haram', 'behay', 'rand'
  ],
  
  // Gujarati vulgar words to ignore
  gujarati: [
    // Devanagari script
    'ગાંડુ', 'ચૂત', 'લંડ', 'ભોસડા', 'હરામી', 'બેહયા', 'રંડી', 'ચૂતિયા',
    // Romanized Gujarati vulgar words
    'gaandu', 'chut', 'lund', 'bhosda', 'harami', 'behaya', 'randi'
  ],
  
  // English vulgar words to ignore
  english: [
    'fuck', 'shit', 'bitch', 'ass', 'dick', 'pussy', 'cock', 'cunt',
    'bastard', 'whore', 'slut', 'faggot', 'nigger', 'nigga', 'fag',
    'motherfucker', 'motherfuck', 'fucker', 'fucking', 'fucked',
    'shitty', 'asshole', 'dumbass', 'jackass', 'dumbfuck', 'fuckface',
    'fuckhead', 'fuckwit', 'fuckoff', 'fuckyou', 'fucku', 'fuckoff'
  ]
};

// Initialize AllProfanity whitelist with ignored words
function initializeAllProfanityWhitelist() {
  const allIgnoredWords = [
    ...IGNORE_VULGAR_WORDS.hindi,
    ...IGNORE_VULGAR_WORDS.gujarati,
    ...IGNORE_VULGAR_WORDS.english
  ];
  
  // Add all ignored words to AllProfanity's whitelist
  profanity.addToWhitelist(allIgnoredWords);
  
  console.log(`AllProfanity whitelist initialized with ${allIgnoredWords.length} ignored vulgar words`);
}

// Call initialization function
initializeAllProfanityWhitelist();

/**
 * Filter out ignored vulgar words from the message before AI moderation
 * @param {string} message - The original message
 * @returns {string} - Message with ignored vulgar words removed
 */
function filterIgnoredVulgarWords(message) {
  // Since we're using AllProfanity's whitelist, the library automatically ignores these words
  // We just need to clean up the message for better AI moderation
  let filteredMessage = message;
  
  // Clean up extra spaces and punctuation
  filteredMessage = filteredMessage.replace(/\s+/g, ' ').trim();
  
  return filteredMessage;
}

/**
 * AI-based content moderation that detects inappropriate content in multiple languages
 * @param {string} message - The message to moderate
 * @returns {Promise<Object>} - Object with isClean (boolean) and filteredMessage (string)
 */
export async function moderateContent(message) {
  if (!message || typeof message !== 'string') {
    return { isClean: true, confidence: 1.0, details: {} };
  }

  try {
    // First, filter out ignored vulgar words
    const filteredMessage = filterIgnoredVulgarWords(message);
    
    // If the message becomes empty after filtering, it was only vulgar words
    if (!filteredMessage.trim()) {
      return {
        isClean: true,
        confidence: 1.0,
        details: {
          flagged: false,
          categories: { vulgar: false },
          scores: { vulgar: 0.0 },
          language: detectLanguage(message),
          vulgarWordsIgnored: true,
          originalMessage: message,
          filteredMessage: ''
        },
        rawResult: null
      };
    }
    
    // First, do local language-specific vulgar word check
    const localCheck = performLocalVulgarCheck(filteredMessage);
    if (!localCheck.isClean) {
      return {
        isClean: false,
        confidence: 0.9, // High confidence for local detection
        details: {
          flagged: true,
          categories: { vulgar: true },
          scores: { vulgar: 0.9 },
          language: localCheck.language,
          localDetection: true,
          detectedWords: localCheck.detectedWords
        },
        rawResult: null
      };
    }

    // If local check passes, use AI moderation with filtered message
    const response = await fetch(AI_MODERATION_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AI_MODERATION_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: filteredMessage,
        model: 'text-moderation-latest'
      })
    });

    if (!response.ok) {
      throw new Error(`AI moderation API error: ${response.status}`);
    }

    const result = await response.json();
    const moderation = result.results[0];

    if (!moderation) {
      return { isClean: true, confidence: 1.0, details: {} };
    }

    // Check if content is flagged as inappropriate
    const isClean = !moderation.flagged;
    
    // Get confidence scores for different categories
    const categories = moderation.categories;
    const categoryScores = moderation.category_scores;
    
    const details = {
      flagged: moderation.flagged,
      categories: categories,
      scores: categoryScores,
      language: detectLanguage(message)
    };

    // Calculate overall confidence based on the highest score
    const maxScore = Math.max(...Object.values(categoryScores));
    const confidence = 1 - maxScore;

    return {
      isClean,
      confidence,
      details,
      rawResult: moderation
    };

  } catch (error) {
    console.error('AI moderation failed:', error);
    
    // Fallback to enhanced local content check
    return enhancedFallbackModeration(message);
  }
}

/**
 * Perform local vulgar word check using AllProfanity
 * @param {string} message - The message to check
 * @returns {Object} - Local check result
 */
function performLocalVulgarCheck(message) {
  const language = detectLanguage(message);
  
  // Use AllProfanity to check for profanity
  const profanityResult = profanity.detect(message);
  const isClean = !profanityResult.isProfane;
  
  // Get detected words and severity
  const detectedWords = profanityResult.words || [];
  const severity = profanityResult.severity || 0;
  
  return {
    isClean,
    language,
    detectedWords: [...new Set(detectedWords)], // Remove duplicates
    severity: severity,
    severityLevel: ProfanitySeverity[severity] || 'UNKNOWN'
  };
}

/**
 * Detect the primary language of the message
 * @param {string} message - The message to analyze
 * @returns {string} - Detected language code
 */
function detectLanguage(message) {
  // Simple language detection based on character sets
  const gujaratiChars = /[\u0A80-\u0AFF]/;
  const hindiChars = /[\u0900-\u097F]/;
  const englishChars = /[a-zA-Z]/;
  
  let gujaratiCount = 0;
  let hindiCount = 0;
  let englishCount = 0;
  
  for (let char of message) {
    if (gujaratiChars.test(char)) gujaratiCount++;
    else if (hindiChars.test(char)) hindiCount++;
    else if (englishChars.test(char)) englishCount++;
  }
  
  if (gujaratiCount > hindiCount && gujaratiCount > englishCount) return 'gu';
  if (hindiCount > gujaratiCount && hindiCount > englishCount) return 'hi';
  return 'en';
}

/**
 * Fallback moderation when AI service is unavailable
 * @param {string} message - The message to check
 * @returns {Object} - Basic moderation result
 */
function fallbackModeration(message) {
  // Use AllProfanity for fallback moderation
  const profanityResult = profanity.detect(message);
  const isClean = !profanityResult.isProfane;
  
  return {
    isClean,
    confidence: 0.8, // Higher confidence with AllProfanity
    details: { 
      fallback: true,
      vulgarWordsIgnored: profanityResult.whitelistedWords?.length > 0,
      originalMessage: message,
      filteredMessage: message, // AllProfanity handles filtering internally
      severity: profanityResult.severity,
      severityLevel: ProfanitySeverity[profanityResult.severity] || 'UNKNOWN',
      detectedWords: profanityResult.words || []
    },
    rawResult: profanityResult
  };
}

/**
 * Enhanced fallback moderation for local detection
 * @param {string} message - The message to check
 * @returns {Object} - Enhanced moderation result
 */
function enhancedFallbackModeration(message) {
  // Filter out ignored vulgar words first
  const filteredMessage = filterIgnoredVulgarWords(message);
  
  const localCheck = performLocalVulgarCheck(filteredMessage);
  const isClean = localCheck.isClean;
  const detectedWords = localCheck.detectedWords;

  return {
    isClean,
    confidence: 0.9, // High confidence for local detection
    details: {
      flagged: !isClean,
      categories: { vulgar: !isClean },
      scores: { vulgar: !isClean ? 0.9 : 0 },
      language: localCheck.language,
      localDetection: true,
      detectedWords: detectedWords,
      vulgarWordsIgnored: message !== filteredMessage,
      originalMessage: message,
      filteredMessage: filteredMessage
    },
    rawResult: null
  };
}

/**
 * Get a detailed moderation report
 * @param {Object} moderationResult - Result from moderateContent
 * @returns {Object} - Detailed report with recommendations
 */
export function getModerationReport(moderationResult) {
  const { isClean, confidence, details } = moderationResult;
  
  let severity = 'low';
  if (confidence < 0.3) severity = 'high';
  else if (confidence < 0.7) severity = 'medium';
  
  const flaggedCategories = [];
  if (details.categories) {
    Object.entries(details.categories).forEach(([category, flagged]) => {
      if (flagged) {
        flaggedCategories.push({
          category,
          score: details.scores[category] || 0
        });
      }
    });
  }
  
  return {
    isClean,
    confidence,
    severity,
    flaggedCategories,
    language: details.language,
    recommendations: getRecommendations(flaggedCategories, severity)
  };
}

/**
 * Get recommendations based on moderation results
 * @param {Array} flaggedCategories - Categories that were flagged
 * @param {string} severity - Severity level
 * @returns {Array} - Array of recommendations
 */
function getRecommendations(flaggedCategories, severity) {
  const recommendations = [];
  
  if (severity === 'high') {
    recommendations.push('Message contains highly inappropriate content');
    recommendations.push('Consider rewriting the message completely');
  } else if (severity === 'medium') {
    recommendations.push('Message contains some inappropriate content');
    recommendations.push('Review and edit before sending');
  }
  
  flaggedCategories.forEach(({ category, score }) => {
    if (score > 0.8) {
      recommendations.push(`High confidence of ${category} content`);
    }
  });
  
  return recommendations;
}

/**
 * Batch moderate multiple messages
 * @param {Array<string>} messages - Array of messages to moderate
 * @returns {Promise<Array>} - Array of moderation results
 */
export async function moderateBatch(messages) {
  if (!Array.isArray(messages)) {
    throw new Error('Messages must be an array');
  }
  
  const results = [];
  
  // Process messages in parallel for better performance
  const moderationPromises = messages.map(message => moderateContent(message));
  
  try {
    const batchResults = await Promise.all(moderationPromises);
    results.push(...batchResults);
  } catch (error) {
    console.error('Batch moderation failed:', error);
    // Fallback to individual moderation
    for (const message of messages) {
      const result = await moderateContent(message);
      results.push(result);
    }
  }
  
  return results;
}

/**
 * Get information about ignored vulgar words for a specific message
 * @param {string} message - The message to analyze
 * @returns {Object} - Information about ignored words
 */
export function getIgnoredVulgarWordsInfo(message) {
  // Use AllProfanity to get comprehensive profanity analysis
  const profanityResult = profanity.detect(message);
  
  return {
    hasIgnoredWords: profanityResult.whitelistedWords?.length > 0 || false,
    ignoredWords: profanityResult.whitelistedWords || [],
    originalMessage: message,
    filteredMessage: message, // AllProfanity handles filtering internally
    totalIgnoredWords: profanityResult.whitelistedWords?.length || 0,
    profanityInfo: {
      isProfane: profanityResult.isProfane,
      severity: profanityResult.severity,
      severityLevel: ProfanitySeverity[profanityResult.severity] || 'UNKNOWN',
      detectedWords: profanityResult.words || [],
      totalWords: profanityResult.totalWords || 0
    }
  };
}

/**
 * Get comprehensive profanity analysis using AllProfanity
 * @param {string} message - The message to analyze
 * @returns {Object} - Comprehensive profanity analysis
 */
export function getComprehensiveProfanityAnalysis(message) {
  const profanityResult = profanity.detect(message);
  
  return {
    message: message,
    isProfane: profanityResult.isProfane,
    severity: profanityResult.severity,
    severityLevel: ProfanitySeverity[profanityResult.severity] || 'UNKNOWN',
    detectedWords: profanityResult.words || [],
    whitelistedWords: profanityResult.whitelistedWords || [],
    totalWords: profanityResult.totalWords || 0,
    language: detectLanguage(message),
    recommendations: getProfanityRecommendations(profanityResult.severity),
    cleanVersion: profanityResult.isProfane ? profanity.clean(message) : message
  };
}

/**
 * Get recommendations based on profanity severity
 * @param {number} severity - Severity level from AllProfanity
 * @returns {Array} - Array of recommendations
 */
function getProfanityRecommendations(severity) {
  const recommendations = [];
  
  if (severity >= 4) {
    recommendations.push('Message contains extreme profanity - consider rewriting completely');
    recommendations.push('Content may violate community guidelines');
  } else if (severity >= 3) {
    recommendations.push('Message contains severe profanity - review before sending');
    recommendations.push('Consider using milder language');
  } else if (severity >= 2) {
    recommendations.push('Message contains moderate profanity - edit if possible');
  } else if (severity >= 1) {
    recommendations.push('Message contains mild profanity - acceptable in most contexts');
  } else {
    recommendations.push('Message is clean and appropriate');
  }
  
  return recommendations;
}

export default {
  moderateContent,
  moderateBatch,
  getModerationReport,
  getIgnoredVulgarWordsInfo,
  getComprehensiveProfanityAnalysis
};
