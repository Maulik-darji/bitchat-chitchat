// Content Filter for Chat Messages
// This utility provides functions to filter out vulgar and inappropriate content
// Now integrated with AI-based moderation for better multi-language support

import { FILTER_CONFIG, CUSTOM_FILTER_RULES } from './contentFilterConfig';
import { moderateContent, getModerationReport } from './aiModeration';

// List of vulgar/inappropriate words to filter
const VULGAR_WORDS = [
  // Common vulgar words (filtered for safety)
  'fuck', 'shit', 'bitch', 'ass', 'dick', 'pussy', 'cock', 'cunt',
  'bastard', 'whore', 'slut', 'faggot', 'nigger', 'nigga', 'fag',
  'motherfucker', 'motherfuck', 'fucker', 'fucking', 'fucked',
  'shitty', 'asshole', 'dumbass', 'jackass', 'dumbfuck', 'fuckface',
  'fuckhead', 'fuckwit', 'fuckoff', 'fuckyou', 'fucku', 'fuckoff',
  'fuckup', 'fuckup', 'fuckup', 'fuckup', 'fuckup', 'fuckup',
  
  // Hindi vulgar words written in English text (Romanized)
  'madarchod', 'behnchod', 'chutiya', 'rand', 'chut', 'lund', 'gaand', 'bhosda', 
  'harami', 'behaya', 'randi', 'madar', 'behn', 'bhos', 'haram', 'behay',
  'chutiye', 'chutiyo', 'chutiyon', 'chutiyon', 'chutiyon', 'chutiyon',
  
  // Gujarati vulgar words written in English text (Romanized)
  'gaandu', 'gaand', 'gaandu', 'gaand', 'gaandu', 'gaand', 'gaandu',
  
  // Common variations and misspellings (asterisks are literal characters)
  'f*ck', 'f**k', 'f***', 'f****', 'f*****', 'f******', 'f*******',
  's**t', 's***', 's****', 's*****', 's******', 's*******',
  'b*tch', 'b**ch', 'b***h', 'b****', 'b*****', 'b******',
  'a**', 'a***', 'a****', 'a*****', 'a******', 'a*******',
  'd*ck', 'd**k', 'd***k', 'd****', 'd*****', 'd******',
  
  // Leetspeak variations
  'fuck', 'fuk', 'fuq', 'fukc', 'fucc', 'fucck', 'fuccck',
  'shit', 'shyt', 'sh*t', 'sh!t', 'sh1t', 'sh1t', 'sh!t',
  'bitch', 'b!tch', 'b1tch', 'b!tch', 'b1tch', 'b!tch',
  'ass', 'a$$', 'a$$', 'a$$', 'a$$', 'a$$', 'a$$',
  'dick', 'd!ck', 'd1ck', 'd!ck', 'd1ck', 'd!ck', 'd!ck',
  
  // Common abbreviations
  'wtf', 'omg', 'lol', 'rofl', 'lmfao', 'stfu', 'gtfo',
  'af', 'asf', 'af', 'asf', 'af', 'asf', 'af', 'asf',
  
  // Additional offensive terms
  'retard', 'retarded', 'idiot', 'stupid', 'dumb', 'moron',
  'jerk', 'jerkoff', 'jerkoff', 'jerkoff', 'jerkoff',
  'douche', 'douchebag', 'douchebag', 'douchebag',
  'scumbag', 'scumbag', 'scumbag', 'scumbag',
  'pieceofshit', 'pieceofshit', 'pieceofshit',
  
  // Racial slurs and offensive terms
  'nazi', 'hitler', 'kike', 'spic', 'chink', 'gook', 'towelhead',
  'sandnigger', 'sandnigger', 'sandnigger', 'sandnigger',
  'beaner', 'wetback', 'spic', 'spic', 'spic', 'spic',
  
  // Sexual content
  'porn', 'pornography', 'sex', 'sexual', 'nude', 'naked',
  'penis', 'vagina', 'boobs', 'tits', 'breasts', 'nipples',
  'ejaculate', 'cum', 'semen', 'sperm', 'orgasm', 'climax',
  
  // Violence and threats
  'kill', 'murder', 'death', 'die', 'dead', 'suicide', 'bomb',
  'terrorist', 'terrorism', 'bomb', 'explosion', 'gun', 'shoot',
  'rape', 'raping', 'raped', 'rapist', 'molest', 'molesting'
];

// Additional patterns to catch creative attempts to bypass filters
const PATTERNS = [
  // Spaces between letters
  /\b\w+\s+\w+\s+\w+\s+\w+\s+\w+\s+\w+\s+\w+\s+\w+\s+\w+\s+\w+\s+\w+\b/gi,
  
  // Repeated characters
  /\b\w*(\w)\1{3,}\w*\b/gi,
  
  // Mixed case variations
  /\b[A-Za-z]*[Ff][Uu][Cc][Kk][A-Za-z]*\b/gi,
  /\b[A-Za-z]*[Ss][Hh][Ii][Tt][A-Za-z]*\b/gi,
  /\b[A-Za-z]*[Bb][Ii][Tt][Cc][Hh][A-Za-z]*\b/gi,
  
  // Hindi vulgar word variations (mixed case)
  /\b[A-Za-z]*[Mm][Aa][Dd][Aa][Rr][Cc][Hh][Oo][Dd][A-Za-z]*\b/gi,
  /\b[A-Za-z]*[Bb][Ee][Hh][Nn][Cc][Hh][Oo][Dd][A-Za-z]*\b/gi,
  /\b[A-Za-z]*[Cc][Hh][Uu][Tt][Ii][Yy][Aa][A-Za-z]*\b/gi,
  /\b[A-Za-z]*[Rr][Aa][Nn][Dd][Ii][A-Za-z]*\b/gi,
  /\b[A-Za-z]*[Cc][Hh][Uu][Tt][A-Za-z]*\b/gi,
  /\b[A-Za-z]*[Ll][Uu][Nn][Dd][A-Za-z]*\b/gi,
  /\b[A-Za-z]*[Gg][Aa][Aa][Nn][Dd][A-Za-z]*\b/gi,
  /\b[A-Za-z]*[Bb][Hh][Oo][Ss][Dd][Aa][A-Za-z]*\b/gi,
  
  // Numbers replacing letters in Hindi vulgar words
  /\b\w*[Mm][Aa][Dd][Aa][Rr][Cc][Hh][Oo][Dd]\w*\b/gi,
  /\b\w*[Bb][Ee][Hh][Nn][Cc][Hh][Oo][Dd]\w*\b/gi,
  /\b\w*[Cc][Hh][Uu][Tt][Ii][Yy][Aa]\w*\b/gi,
  /\b\w*[Rr][Aa][Nn][Dd][Ii]\w*\b/gi,
  
  // Unicode variations
  /\b\w*[Ff][Uu][Cc][Kk]\w*\b/gi,
  /\b\w*[Ss][Hh][Ii][Tt]\w*\b/gi,
  /\b\w*[Bb][Ii][Tt][Cc][Hh]\w*\b/gi
];

/**
 * Check if a message contains vulgar or inappropriate content
 * @param {string} message - The message to check
 * @returns {Object} - Object with isClean (boolean) and filteredMessage (string)
 */
export function filterMessage(message) {
  if (!message || typeof message !== 'string') {
    return { isClean: true, filteredMessage: message };
  }

  // Check if filtering is enabled
  if (!FILTER_CONFIG.ENABLED) {
    return { isClean: true, filteredMessage: message };
  }

  let filteredMessage = message;
  let isClean = true;

  // Check for vulgar words (case insensitive)
  const lowerMessage = message.toLowerCase();
  
  // Combine default vulgar words with custom additional words
  const allVulgarWords = [...VULGAR_WORDS, ...CUSTOM_FILTER_RULES.ADDITIONAL_WORDS];
  
  for (const word of allVulgarWords) {
    // Skip whitelisted words
    if (CUSTOM_FILTER_RULES.WHITELIST.includes(word.toLowerCase())) {
      continue;
    }
    
    // Properly escape special regex characters including asterisks
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedWord}\\b`, 'gi');
    if (regex.test(lowerMessage)) {
      isClean = false;
      // Replace vulgar words with asterisks
      filteredMessage = filteredMessage.replace(regex, '*'.repeat(word.length));
    }
  }

  // Check for patterns if enabled
  if (FILTER_CONFIG.FILTER_SPACED_PATTERNS) {
    for (const pattern of PATTERNS) {
      if (pattern.test(message)) {
        isClean = false;
        // Replace matched patterns with asterisks
        filteredMessage = filteredMessage.replace(pattern, (match) => '*'.repeat(match.length));
      }
    }
  }

  // Check for excessive repetition (spam-like behavior) if enabled
  if (FILTER_CONFIG.FILTER_CHARACTER_REPETITION) {
    const words = message.toLowerCase().split(/\s+/);
    const wordCounts = {};
    
    for (const word of words) {
      if (word.length > FILTER_CONFIG.MIN_WORD_LENGTH_FOR_REPETITION) {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
        if (wordCounts[word] > FILTER_CONFIG.MAX_WORD_REPETITION) {
          isClean = false;
          const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
          filteredMessage = filteredMessage.replace(regex, '*'.repeat(word.length));
        }
      }
    }
  }

  return { isClean, filteredMessage };
}

/**
 * Check if a message contains vulgar or inappropriate content
 * @param {string} message - The message to check
 * @returns {Object} - Object with isClean (boolean) and filteredMessage (string)
 */
export function isMessageClean(message) {
  if (!message || typeof message !== 'string') {
    return { isClean: true, filteredMessage: message };
  }

  // Fast path: check if message is too short to contain vulgar content
  if (message.length < 3) {
    return { isClean: true, filteredMessage: message };
  }

  // Create a single optimized regex pattern for all vulgar words
  if (!window.vulgarPattern) {
    const vulgarWords = VULGAR_WORDS.map(word => 
      word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    ).join('|');
    window.vulgarPattern = new RegExp(`\\b(${vulgarWords})\\b`, 'gi');
  }

  // Check for vulgar words with single regex test
  if (window.vulgarPattern.test(message)) {
    return { isClean: false, filteredMessage: message };
  }

  // Only check patterns if message is longer and no vulgar words found
  if (message.length > 10 && FILTER_CONFIG.FILTER_SPACED_PATTERNS) {
    for (const pattern of PATTERNS) {
      if (pattern.test(message)) {
        return { isClean: false, filteredMessage: message };
      }
    }
  }

  return { isClean: true, filteredMessage: message };
}

/**
 * Get a list of detected vulgar words in a message
 * @param {string} message - The message to analyze
 * @returns {Array} - Array of detected vulgar words
 */
export function getDetectedVulgarWords(message) {
  if (!message || typeof message !== 'string') {
    return [];
  }

  const detected = [];
  const lowerMessage = message.toLowerCase();
  
  for (const word of VULGAR_WORDS) {
    // Properly escape special regex characters including asterisks
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedWord}\\b`, 'gi');
    if (regex.test(lowerMessage)) {
      detected.push(word);
    }
  }

  return [...new Set(detected)]; // Remove duplicates
}

/**
 * Get a user-friendly message about content filtering
 * @param {Array} vulgarWords - Array of detected vulgar words
 * @returns {string} - User-friendly message
 */
export function getFilterMessage(vulgarWords) {
  if (!vulgarWords || vulgarWords.length === 0) {
    return '';
  }
  
  if (vulgarWords.length === 1) {
    return `Your message contains inappropriate language ("${vulgarWords[0]}"). Please revise your message.`;
  } else {
    return `Your message contains ${vulgarWords.length} inappropriate words. Please revise your message.`;
  }
}

/**
 * Check if a message contains vulgar or inappropriate content using AI moderation
 * @param {string} message - The message to check
 * @returns {Promise<Object>} - Object with isClean (boolean) and filteredMessage (string)
 */
export async function filterMessageAI(message) {
  if (!message || typeof message !== 'string') {
    return { isClean: true, filteredMessage: message };
  }

  // Check if AI moderation is enabled
  if (!FILTER_CONFIG.AI_MODERATION_ENABLED) {
    // Fallback to traditional filtering
    return filterMessage(message);
  }

  try {
    // Use AI moderation for detection and reporting
    const moderationResult = await moderateContent(message);
    const report = getModerationReport(moderationResult);
    
    if (moderationResult.isClean) {
      return { isClean: true, filteredMessage: message, report };
    } else {
      // Always use traditional filtering for the actual message replacement
      // This ensures vulgar words are properly replaced with asterisks
      const traditionalFilter = filterMessage(message);
      
      return { 
        isClean: false, 
        filteredMessage: traditionalFilter.filteredMessage, // Use traditionally filtered message
        report,
        confidence: moderationResult.confidence,
        language: report.language
      };
    }
  } catch (error) {
    console.error('AI moderation failed, falling back to traditional filtering:', error);
    // Fallback to traditional filtering
    return filterMessage(message);
  }
}



/**
 * Check if a message contains vulgar content without filtering it (AI version)
 * @param {string} message - The message to check
 * @returns {Promise<boolean>} - True if message is clean, false if it contains vulgar content
 */
export async function isMessageCleanAI(message) {
  if (!message || typeof message !== 'string') {
    return true;
  }

  if (!FILTER_CONFIG.AI_MODERATION_ENABLED) {
    return isMessageClean(message);
  }

  try {
    const moderationResult = await moderateContent(message);
    return moderationResult.isClean;
  } catch (error) {
    console.error('AI moderation failed, falling back to traditional check:', error);
    return isMessageClean(message);
  }
}

export default {
  filterMessage,
  filterMessageAI,
  isMessageClean,
  isMessageCleanAI,
  getDetectedVulgarWords,
  getFilterMessage
};
