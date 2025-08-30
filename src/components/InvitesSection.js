import React, { useState, useEffect } from 'react';
import firebaseService from '../lib/firebase';

const InvitesSection = ({ username, onInviteAccepted }) => {
  const [pendingInvites, setPendingInvites] = useState([]);
  const [sentInvites, setSentInvites] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let unsubscribeIncoming = () => {};
    let unsubscribeSent = () => {};

    const setupListeners = async () => {
      try {
        // Listen for incoming invites
        unsubscribeIncoming = firebaseService.onUserInvitesUpdate(username, (invites) => {
          setPendingInvites(invites);
        });

        // Listen for sent invites
        unsubscribeSent = firebaseService.onUserSentInvitesUpdate(username, (invites) => {
          setSentInvites(invites);
        });
      } catch (error) {
        console.error('Error setting up invite listeners:', error);
      } finally {
        setIsLoading(false);
      }
    };

    setupListeners();

    return () => {
      try {
        unsubscribeIncoming();
        unsubscribeSent();
      } catch (error) {
        console.error('Error cleaning up invite listeners:', error);
      }
    };
  }, [username]);

  // Track user activity when interacting with invites section
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

  const handleRespondToInvite = async (inviteId, response) => {
    try {
      await firebaseService.respondToInvite(inviteId, response);
      
      if (response === 'accepted') {
        // Find the invite to get the other user's username
        const invite = pendingInvites.find(inv => inv.id === inviteId);
        if (invite) {
          onInviteAccepted(invite.fromUsername);
        }
      }
    } catch (error) {
      console.error('Error responding to invite:', error);
    }
  };

  const handleCancelInvite = async (inviteId) => {
    try {
      await firebaseService.cancelPrivateChatInvite(inviteId);
    } catch (error) {
      console.error('Error canceling invite:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-700/50 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-700/30 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <div className="bg-orange-600/10 border border-orange-500/20 rounded-lg p-3">
          <h3 className="text-orange-400/90 font-semibold text-sm mb-2 flex items-center">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Pending Invites ({pendingInvites.length})
          </h3>
          <div className="space-y-2">
            {pendingInvites.map((invite) => (
              <div key={invite.id} className="bg-gray-700/30 border border-gray-700/50 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-6 h-6 bg-orange-600/20 border border-orange-500/30 rounded-full flex items-center justify-center">
                    <span className="text-orange-400 font-bold text-xs">
                      {invite.fromUsername.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-white/90 font-medium text-sm">{invite.fromUsername}</span>
                </div>
                <p className="text-gray-400/70 text-xs mb-3">wants to start a private chat</p>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleRespondToInvite(invite.id, 'accepted')}
                    className="flex-1 bg-green-600/20 hover:bg-green-600/30 text-green-400 hover:text-green-300 py-1.5 px-2 rounded text-xs font-medium transition-all duration-200 border border-green-500/30 hover:border-green-500/50"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleRespondToInvite(invite.id, 'rejected')}
                    className="flex-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 py-1.5 px-2 rounded text-xs font-medium transition-all duration-200 border border-red-500/30 hover:border-red-500/50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sent Invites */}
      {sentInvites.length > 0 && (
        <div className="bg-blue-600/10 border border-blue-500/20 rounded-lg p-3">
          <h3 className="text-blue-400/90 font-semibold text-sm mb-2 flex items-center">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            Sent Invites ({sentInvites.length})
          </h3>
          <div className="space-y-2">
            {sentInvites.map((invite) => (
              <div key={invite.id} className="bg-gray-700/30 border border-gray-700/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-blue-600/20 border border-blue-500/30 rounded-full flex items-center justify-center">
                      <span className="text-blue-400 font-bold text-xs">
                        {invite.toUsername.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-white/90 font-medium text-sm">{invite.toUsername}</span>
                  </div>
                  <button
                    onClick={() => handleCancelInvite(invite.id)}
                    className="text-red-400 hover:text-red-300 p-1 hover:bg-red-900/20 rounded transition-all duration-200"
                    title="Cancel invite"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className="text-gray-400/70 text-xs">Waiting for response...</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default InvitesSection;
