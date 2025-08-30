import React, { useState, useEffect } from 'react';
import firebaseService from '../lib/firebase';

const StatsSidebar = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    onlineUsers: 0,
    lastUpdated: null
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Use the new comprehensive user stats method for real-time updates
    const unsubscribe = firebaseService.onUserStats((userStats) => {
      // Only keep totalUsers, onlineUsers, and lastUpdated
      setStats({
        totalUsers: userStats.totalUsers,
        onlineUsers: userStats.onlineUsers,
        lastUpdated: userStats.lastUpdated
      });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    try {
      const currentStats = await firebaseService.getCurrentUserCount();
      // Only keep totalUsers, onlineUsers, and lastUpdated
      setStats({
        totalUsers: currentStats.totalUsers,
        onlineUsers: currentStats.onlineUsers,
        lastUpdated: currentStats.lastUpdated
      });
    } catch (error) {
      console.error('Error refreshing stats:', error);
    } finally {
      // Add a small delay to show the loading animation
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  };

  const formatLastUpdated = (timestamp) => {
    if (!timestamp) return 'Never';
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString();
    } catch (error) {
      return 'Invalid time';
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-screen bg-[#181818] backdrop-blur-sm border-l border-gray-700/50 p-6 flex-shrink-0 overflow-hidden shadow-lg">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-400 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading user statistics...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-[#181818] backdrop-blur-sm border-l border-gray-700/50 p-6 flex-shrink-0 overflow-hidden shadow-lg">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-100 mb-2 flex items-center">
          <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Statistics
        </h2>
        <p className="text-gray-400 text-sm mb-4 text-left">Real-time user activity from Firestore</p>
      </div>

      <div className="space-y-4">
        {/* Total Users - Most Important */}
        <div className="backdrop-blur-sm rounded-2xl p-4 border border-gray-700/30" style={{backgroundColor: '#303030'}}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
              <span className="text-gray-300 font-medium">Total Users</span>
            </div>
            <span className="text-2xl font-bold text-blue-400">{stats.totalUsers}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">All registered users in database</p>
        </div>

        {/* Active Users */}
        <div className="backdrop-blur-sm rounded-2xl p-4 border border-gray-700/30" style={{backgroundColor: '#303030'}}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
              <span className="text-gray-300 font-medium">Active Users</span>
            </div>
            <span className="text-2xl font-bold text-green-400">{stats.onlineUsers}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Currently online</p>
        </div>
      </div>

      {/* Refresh Button */}
      <div className="mt-6">
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="w-full bg-[#303030] hover:bg-gray-700/70 disabled:bg-gray-600/20 text-gray-200 py-3 px-4 rounded-full transition-all duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRefreshing ? (
            <>
              <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refreshing...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Stats
            </>
          )}
        </button>
      </div>

      {/* Last Update */}
      {stats.lastUpdated && (
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            Last updated: {formatLastUpdated(stats.lastUpdated)}
          </p>
        </div>
      )}


    </div>
  );
};

export default StatsSidebar;
