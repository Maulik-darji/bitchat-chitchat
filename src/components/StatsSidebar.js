import React, { useState, useEffect } from 'react';
import firebaseService from '../lib/firebase';

const StatsSidebar = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const unsubscribe = firebaseService.onUsersUpdate((users) => {
      const totalUsers = users.length;
      const activeUsers = users.filter(user => user.isOnline).length;
      
      setStats({
        totalUsers,
        activeUsers
      });
    });

    return () => unsubscribe();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    try {
      const currentStats = await firebaseService.getCurrentUserCount();
      setStats(currentStats);
    } catch (error) {
      console.error('Error refreshing stats:', error);
    } finally {
      // Add a small delay to show the loading animation
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  };

  return (
    <div className="w-full h-screen bg-[#181818] backdrop-blur-sm border-l border-gray-700/50 p-6 flex-shrink-0 overflow-hidden shadow-lg">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-100 mb-2 flex items-center">
          <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Statistics
        </h2>
        <p className="text-gray-400 text-sm mb-4 text-left">Real-time user activity</p>
      </div>

      <div className="space-y-4">
        {/* Total Users */}
        <div className="backdrop-blur-sm rounded-2xl p-4 border border-gray-700/30" style={{backgroundColor: '#303030'}}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-gray-500 rounded-full mr-3"></div>
              <span className="text-gray-300 font-medium">Total Users</span>
            </div>
            <span className="text-2xl font-bold text-gray-400">{stats.totalUsers}</span>
          </div>
        </div>

        {/* Active Users */}
        <div className="backdrop-blur-sm rounded-2xl p-4 border border-gray-700/30" style={{backgroundColor: '#303030'}}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
              <span className="text-gray-300 font-medium">Active Users</span>
            </div>
            <span className="text-2xl font-bold text-green-400">{stats.activeUsers}</span>
          </div>
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
      {stats.totalUsers > 0 && (
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            Last updated: {new Date().toLocaleTimeString()}
          </p>
        </div>
      )}
    </div>
  );
};

export default StatsSidebar;
