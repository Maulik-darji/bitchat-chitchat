import React, { useState, useEffect } from 'react';
import { filterMessage, getDetectedVulgarWords, getFilterMessage } from '../lib/contentFilter';

const ContentModeration = ({ 
  message, 
  onMessageChange, 
  onSend, 
  isVisible = false, 
  onClose,
  showWarning = true 
}) => {
  const [filteredMessage, setFilteredMessage] = useState('');
  const [isClean, setIsClean] = useState(true);
  const [detectedWords, setDetectedWords] = useState([]);
  const [warningMessage, setWarningMessage] = useState('');

  useEffect(() => {
    if (message) {
      const result = filterMessage(message);
      setFilteredMessage(result.filteredMessage);
      setIsClean(result.isClean);
      
      if (!result.isClean) {
        const words = getDetectedVulgarWords(message);
        setDetectedWords(words);
        setWarningMessage(getFilterMessage(words));
      } else {
        setDetectedWords([]);
        setWarningMessage('');
      }
    } else {
      setFilteredMessage('');
      setIsClean(true);
      setDetectedWords([]);
      setWarningMessage('');
    }
  }, [message]);

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

  if (!isVisible || !message) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Content Moderation Warning
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

        {showWarning && (
          <div className="mb-4">
            <div className="flex items-center mb-3">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Inappropriate Content Detected
                </h4>
              </div>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              {warningMessage}
            </p>
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
            Content moderation helps maintain a respectful environment for all users.
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
