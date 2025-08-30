// AI-Based Content Moderation Service
// Uses AI to detect vulgar/inappropriate content in multiple languages
// Supports Gujarati, Hindi, and English

const AI_MODERATION_API_KEY = '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';
const AI_MODERATION_ENDPOINT = 'https://api.openai.com/v1/moderations';

// Enhanced vulgar word patterns for Indian languages
const VULGAR_PATTERNS = {
  // Hindi vulgar words (both Devanagari and Romanized)
  hindi: [
    // Devanagari script
    /\b(मादरचोद|मादरचोद|मादरचोद|मादरचोद)\b/gi,
    /\b(बहनचोद|बहनचोद|बहनचोद)\b/gi,
    /\b(चूत|चूत|चूत|चूत)\b/gi,
    /\b(लंड|लंड|लंड|लंड)\b/gi,
    /\b(गांड|गांड|गांड|गांड)\b/gi,
    /\b(भोसड़ा|भोसड़ा|भोसड़ा)\b/gi,
    /\b(हरामी|हरामी|हरामी)\b/gi,
    /\b(बेहया|बेहया|बेहया)\b/gi,
    /\b(रंड|रंड|रंड|रंड)\b/gi,
    /\b(चूतिया|चूतिया|चूतिया)\b/gi,
    
    // Romanized Hindi vulgar words
    /\b(madarchod|madarchod|madarchod)\b/gi,
    /\b(behnchod|behnchod|behnchod)\b/gi,
    /\b(chutiya|chutiya|chutiya)\b/gi,
    /\b(rand|rand|rand|rand)\b/gi,
    /\b(chut|chut|chut|chut)\b/gi,
    /\b(lund|lund|lund|lund)\b/gi,
    /\b(gaand|gaand|gaand|gaand)\b/gi,
    /\b(bhosda|bhosda|bhosda)\b/gi,
    /\b(harami|harami|harami)\b/gi,
    /\b(behaya|behaya|behaya)\b/gi,
    /\b(randi|randi|randi)\b/gi,
    
    // Common variations and misspellings
    /\b(madar|madar|madar)\b/gi,
    /\b(behn|behn|behn)\b/gi,
    /\b(chut|chut|chut)\b/gi,
    /\b(lund|lund|lund)\b/gi,
    /\b(gaand|gaand|gaand)\b/gi,
    /\b(bhos|bhos|bhos)\b/gi,
    /\b(haram|haram|haram)\b/gi,
    /\b(behay|behay|behay)\b/gi,
    /\b(rand|rand|rand)\b/gi
  ],
  
  // Gujarati vulgar words
  gujarati: [
    // Devanagari script
    /\b(ગાંડુ|ગાંડુ|ગાંડુ)\b/gi,
    /\b(ચૂત|ચૂત|ચૂત|ચૂત)\b/gi,
    /\b(લંડ|લંડ|લંડ|લંડ)\b/gi,
    /\b(ભોસડા|ભોસડા|ભોસડા)\b/gi,
    /\b(હરામી|હરામી|હરામી)\b/gi,
    /\b(બેહયા|બેહયા|બેહયા)\b/gi,
    /\b(રંડી|રંડી|રંડી)\b/gi,
    /\b(ચૂતિયા|ચૂતિયા|ચૂતિયા)\b/gi,
    
    // Romanized Gujarati vulgar words
    /\b(gaandu|gaandu|gaandu)\b/gi,
    /\b(chut|chut|chut|chut)\b/gi,
    /\b(lund|lund|lund|lund)\b/gi,
    /\b(bhosda|bhosda|bhosda)\b/gi,
    /\b(harami|harami|harami)\b/gi,
    /\b(behaya|behaya|behaya)\b/gi,
    /\b(randi|randi|randi)\b/gi
  ],
  
  // English vulgar words (enhanced)
  english: [
    /\b(fuck|shit|bitch|ass|dick|pussy|cock|cunt)\b/gi,
    /\b(bastard|whore|slut|faggot|nigger|nigga|fag)\b/gi,
    /\b(motherfucker|motherfuck|fucker|fucking|fucked)\b/gi,
    /\b(shitty|asshole|dumbass|jackass|dumbfuck|fuckface)\b/gi,
    /\b(fuckhead|fuckwit|fuckoff|fuckyou|fucku|fuckoff)\b/gi
  ]
};

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
    // First, do local language-specific vulgar word check
    const localCheck = performLocalVulgarCheck(message);
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

    // If local check passes, use AI moderation
    const response = await fetch(AI_MODERATION_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AI_MODERATION_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: message,
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
 * Perform local vulgar word check for Indian languages
 * @param {string} message - The message to check
 * @returns {Object} - Local check result
 */
function performLocalVulgarCheck(message) {
  const language = detectLanguage(message);
  const patterns = VULGAR_PATTERNS[language] || [];
  
  // Also check all language patterns for mixed content
  const allPatterns = [
    ...VULGAR_PATTERNS.hindi,
    ...VULGAR_PATTERNS.gujarati,
    ...VULGAR_PATTERNS.english
  ];
  
  let isClean = true;
  let detectedWords = [];
  
  for (const pattern of allPatterns) {
    if (pattern.test(message)) {
      isClean = false;
      // Extract the matched words
      const matches = message.match(pattern);
      if (matches) {
        detectedWords.push(...matches);
      }
    }
  }
  
  return {
    isClean,
    language,
    detectedWords: [...new Set(detectedWords)] // Remove duplicates
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
  // Basic fallback - check for obvious patterns
  const obviousPatterns = [
    /\b(fuck|shit|bitch|ass|dick|pussy|cock|cunt)\b/gi,
    /\b(मादरचोद|चूत|लंड|गांड|भोसड़ा|हरामी|बेहया)\b/gi, // Hindi vulgar words
    /\b(ગાંડુ|ચૂત|લંડ|ભોસડા|હરામી|બેહયા)\b/gi // Gujarati vulgar words
  ];
  
  let isClean = true;
  for (const pattern of obviousPatterns) {
    if (pattern.test(message)) {
      isClean = false;
      break;
    }
  }
  
  return {
    isClean,
    confidence: 0.5, // Lower confidence for fallback
    details: { fallback: true },
    rawResult: null
  };
}

/**
 * Enhanced fallback moderation for local detection
 * @param {string} message - The message to check
 * @returns {Object} - Enhanced moderation result
 */
function enhancedFallbackModeration(message) {
  const localCheck = performLocalVulgarCheck(message);
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
      detectedWords: detectedWords
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

export default {
  moderateContent,
  moderateBatch,
  getModerationReport
};
