import React, { useState, useEffect } from 'react';
import { filterMessage, getDetectedVulgarWords, getFilterMessage } from '../lib/contentFilter';
import { filterMessageAI, isMessageCleanAI } from '../lib/contentFilter';
import firebaseService from '../lib/firebase';

const ContentModeration = ({ 
  message, 
  onMessageChange, 
  onSend, 
  isVisible = false, 
  onClose,
  showWarning = true,
  useAI = true, // New prop to enable/disable AI moderation
  username // Add username prop
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

  // Track user activity when interacting with content moderation
  useEffect(() => {
    if (!username) return;

    let activityTimeout;
    
    const updateActivity = async () => {
      try {
        await firebaseService.updateUserActivity(username);
      } catch (error) {
        console.error('Error updating user activity:', error);
      }
    };

    const handleUserActivity = () => {
      // Clear existing timeout
      if (activityTimeout) {
        clearTimeout(activityTimeout);
      }
      
      // Set new timeout to update activity after 2 seconds of inactivity
      activityTimeout = setTimeout(updateActivity, 2000);
    };

    // Track various user interactions
    const events = ['mousedown', 'mousemove', 'keydown', 'click'];
    events.forEach(event => {
      document.addEventListener(event, handleUserActivity, { passive: true });
    });

    return () => {
      if (activityTimeout) {
        clearTimeout(activityTimeout);
      }
      events.forEach(event => {
        document.removeEventListener(event, handleUserActivity);
      });
    };
  }, [username]);

  const handleSendFiltered = () => {
    // Send the FILTERED message (with asterisks), not the original
    onSend(filteredMessage);
  };

  const handleSendClean = () => {
    // Send the FILTERED message (with asterisks), not the original
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-[#1a1a1a] border border-[#333] rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#1a1a1a] border-b border-[#333] p-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">
                  {useAI ? 'AI Content Moderation' : 'Content Moderation Warning'}
                </h3>
                <p className="text-[#999] text-xs">Maintaining community standards</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-[#666] hover:text-white transition-colors duration-200 p-2 hover:bg-[#333] rounded-xl"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-6">
              <div className="inline-flex items-center px-4 py-3 text-sm text-blue-400 bg-[#0f1a2a] border border-[#1e3a8a] rounded-xl">
                <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="font-medium">Analyzing content...</span>
              </div>
            </div>
          )}

          {/* Warning Section */}
          {showWarning && !isLoading && (
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-1">
                  <div className="w-8 h-8 bg-yellow-500/20 border border-yellow-500/40 rounded-lg flex items-center justify-center">
                    <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <div className="flex-1">
                  <h4 className="text-base font-semibold text-yellow-400 mb-2">
                    {useAI ? 'AI Detected Inappropriate Content' : 'Inappropriate Content Detected'}
                  </h4>
                  <p className="text-[#ccc] text-sm leading-relaxed">
                    {warningMessage}
                  </p>
                </div>
              </div>
              
              {/* AI Analysis Box */}
              {useAI && moderationReport && (
                <div className="p-3 bg-[#0f1a2a] border border-[#1e3a8a] rounded-lg">
                  <h5 className="text-blue-400 font-semibold mb-3 text-center text-sm">AI Analysis Report</h5>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-[#1e3a8a]/20 p-2 rounded-lg border border-[#1e3a8a]/30">
                      <p className="text-xs text-blue-300 mb-1 uppercase tracking-wide">Confidence</p>
                      <p className="text-sm font-bold text-blue-200">
                        {moderationReport.confidence > 0.8 ? 'High' : 'Medium'}
                      </p>
                    </div>
                    <div className="bg-[#1e3a8a]/20 p-2 rounded-lg border border-[#1e3a8a]/30">
                      <p className="text-xs text-blue-300 mb-1 uppercase tracking-wide">Language</p>
                      <p className="text-sm font-bold text-blue-200">
                        {language === 'en' ? 'English' : language === 'hi' ? 'Hindi' : language === 'gu' ? 'Gujarati' : 'Unknown'}
                      </p>
                    </div>
                    <div className="bg-[#1e3a8a]/20 p-2 rounded-lg border border-[#1e3a8a]/30">
                      <p className="text-xs text-blue-300 mb-1 uppercase tracking-wide">Severity</p>
                      <p className="text-sm font-bold text-blue-200 capitalize">
                        {moderationReport.severity}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Critical Warning */}
              <div className="p-3 bg-red-900/20 border border-red-700/40 rounded-lg">
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <p className="text-red-300 text-sm font-medium">
                    You must send the cleaned version. Original content with inappropriate language cannot be sent.
                  </p>
                </div>
              </div>

              {/* Detected Words */}
              {detectedWords.length > 0 && (
                <div>
                  <p className="text-xs text-[#999] mb-2 font-medium uppercase tracking-wide">
                    Detected Words
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {detectedWords.map((word, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-900/40 text-red-300 border border-red-700/50"
                      >
                        {word}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Message Comparison */}
          <div className="space-y-3">
            {/* Original Message */}
            <div>
              <label className="block text-xs font-medium text-[#ccc] mb-2 flex items-center space-x-2">
                <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>Original Message (Contains Inappropriate Content)</span>
              </label>
              <div className="p-3 bg-red-900/20 border border-red-700/40 rounded-lg text-[#ccc] text-sm">
                {message}
              </div>
            </div>

            {/* Cleaned Version */}
            <div>
              <label className="block text-xs font-medium text-[#ccc] mb-2 flex items-center space-x-2">
                <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Cleaned Version (Safe to Send)</span>
              </label>
              <div className="p-3 bg-green-900/20 border border-green-700/40 rounded-lg text-[#ccc] text-sm">
                {filteredMessage}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col space-y-2 pt-3">
            <button
              onClick={handleSendFiltered}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl border border-green-500/30"
            >
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                <span>Send Filtered Message</span>
              </div>
            </button>
            
            <button
              onClick={onClose}
              className="w-full bg-[#333] hover:bg-[#444] text-[#ccc] font-medium py-3 px-4 rounded-xl transition-colors duration-200 border border-[#555] hover:border-[#666]"
            >
              Cancel & Edit
            </button>
          </div>

          {/* Footer */}
          <div className="text-center pt-4 border-t border-[#333]">
            <div className="p-3 bg-[#0f0f0f] border border-[#333] rounded-lg">
              <p className="text-xs text-[#999] leading-relaxed">
                {useAI ? 'AI-powered content moderation helps maintain a respectful environment across multiple languages.' : 'Content moderation helps maintain a respectful environment for all users.'}
              </p>
              <p className="mt-2 text-xs text-red-400 font-medium">
                Inappropriate content is automatically filtered and cannot be sent.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContentModeration;
