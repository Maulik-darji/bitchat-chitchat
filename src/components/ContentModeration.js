import React, { useState, useEffect } from 'react';
import { filterMessage, getDetectedVulgarWords, getFilterMessage } from '../lib/contentFilter';
import { filterMessageAI, isMessageCleanAI } from '../lib/contentFilter';

const ContentModeration = ({ 
  message, 
  onMessageChange, 
  onSend, 
  isVisible = false, 
  onClose,
  showWarning = true,
  useAI = true // New prop to enable/disable AI moderation
}) => {
  const [filteredMessage, setFilteredMessage] = useState('');
  const [isClean, setIsClean] = useState(true);
  const [detectedWords, setDetectedWords] = useState([]);
  const [warningMessage, setWarningMessage] = useState('');
  const [moderationReport, setModerationReport] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [language, setLanguage] = useState('en');

  useEffect(() => {
    if (message) {
      setIsLoading(true);
      
      if (useAI) {
        // Use AI moderation
        filterMessageAI(message).then(result => {
          setFilteredMessage(result.filteredMessage);
          setIsClean(result.isClean);
          setLanguage(result.language || 'en');
          
          if (result.report) {
            setModerationReport(result.report);
            setWarningMessage(getAIWarningMessage(result.report));
          } else {
            setModerationReport(null);
            setWarningMessage('');
          }
          
          // Fallback to traditional detection for backward compatibility
          if (!result.isClean) {
            const words = getDetectedVulgarWords(message);
            setDetectedWords(words);
          } else {
            setDetectedWords([]);
          }
          
          setIsLoading(false);
        }).catch(error => {
          console.error('AI moderation failed:', error);
          // Fallback to traditional filtering
          const result = filterMessage(message);
          setFilteredMessage(result.filteredMessage);
          setIsClean(result.isClean);
          setLanguage('en');
          setModerationReport(null);
          
          if (!result.isClean) {
            const words = getDetectedVulgarWords(message);
            setDetectedWords(words);
            setWarningMessage(getFilterMessage(words));
          } else {
            setDetectedWords([]);
            setWarningMessage('');
          }
          
          setIsLoading(false);
        });
      } else {
        // Use traditional filtering
        const result = filterMessage(message);
        setFilteredMessage(result.filteredMessage);
        setIsClean(result.isClean);
        setLanguage('en');
        setModerationReport(null);
        
        if (!result.isClean) {
          const words = getDetectedVulgarWords(message);
          setDetectedWords(words);
          setWarningMessage(getFilterMessage(words));
        } else {
          setDetectedWords([]);
          setWarningMessage('');
        }
        
        setIsLoading(false);
      }
    } else {
      setFilteredMessage('');
      setIsClean(true);
      setDetectedWords([]);
      setWarningMessage('');
      setModerationReport(null);
      setLanguage('en');
      setIsLoading(false);
    }
  }, [message, useAI]);

  const handleSendFiltered = () => {
    if (isClean) {
      onSend(message);
    } else {
      // Send the filtered version instead
      onSend(filteredMessage);
    }
  };

  const handleSendClean = () => {
    // Always send the filtered/cleaned version
    onSend(filteredMessage);
  };

  // Get AI-specific warning message
  const getAIWarningMessage = (report) => {
    if (!report) return '';
    
    const languageNames = {
      'en': 'English',
      'hi': 'Hindi',
      'gu': 'Gujarati'
    };
    
    const languageName = languageNames[report.language] || 'Unknown';
    
    if (report.severity === 'high') {
      return `Your message contains highly inappropriate content in ${languageName}. Please rewrite your message completely.`;
    } else if (report.severity === 'medium') {
      return `Your message contains some inappropriate content in ${languageName}. Please review and edit before sending.`;
    }
    
    return `Your message contains inappropriate content in ${languageName}. Please revise your message.`;
  };

  if (!isVisible || !message) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {useAI ? 'AI Content Moderation' : 'Content Moderation Warning'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isLoading && (
          <div className="mb-4 text-center">
            <div className="inline-flex items-center px-4 py-2 text-sm text-blue-600 bg-blue-100 rounded-md">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Analyzing content with AI...
            </div>
          </div>
        )}

        {showWarning && !isLoading && (
          <div className="mb-4">
            <div className="flex items-center mb-3">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  {useAI ? 'AI Detected Inappropriate Content' : 'Inappropriate Content Detected'}
                </h4>
              </div>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              {warningMessage}
            </p>
            
            {useAI && moderationReport && (
              <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900 rounded-md">
                <p className="text-xs text-blue-800 dark:text-blue-200 mb-2">
                  <strong>AI Analysis:</strong> {moderationReport.confidence > 0.8 ? 'High confidence' : 'Medium confidence'} detection
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>Language:</strong> {language === 'en' ? 'English' : language === 'hi' ? 'Hindi' : language === 'gu' ? 'Gujarati' : 'Unknown'}
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>Severity:</strong> {moderationReport.severity}
                </p>
              </div>
            )}
            
            <p className="text-sm text-red-600 dark:text-red-400 mb-3 font-medium">
              ⚠️ You must send the cleaned version. Original content with inappropriate language cannot be sent.
            </p>

            {detectedWords.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Detected words:
                </p>
                <div className="flex flex-wrap gap-1">
                  {detectedWords.map((word, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                    >
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Your Message (Contains Inappropriate Content):
          </label>
          <div className="p-3 bg-red-100 dark:bg-red-900 rounded-md text-sm text-gray-800 dark:text-gray-200 border border-red-300 dark:border-red-700">
            {message}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Cleaned Version (Safe to Send):
          </label>
          <div className="p-3 bg-green-100 dark:bg-green-900 rounded-md text-sm text-gray-800 dark:text-gray-200 border border-green-300 dark:border-green-700">
            {filteredMessage}
          </div>
        </div>

        <div className="flex flex-col space-y-2">
          <button
            onClick={handleSendClean}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition duration-200"
          >
            Send Filtered Message
          </button>
          
          <button
            onClick={onClose}
            className="w-full bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded-md transition duration-200"
          >
            Cancel & Edit
          </button>
        </div>

        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 text-center">
          <p>
            {useAI ? 'AI-powered content moderation helps maintain a respectful environment across multiple languages.' : 'Content moderation helps maintain a respectful environment for all users.'}
          </p>
          <p className="mt-1 text-red-500 dark:text-red-400 font-medium">
            Inappropriate content is automatically filtered and cannot be sent.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ContentModeration;
