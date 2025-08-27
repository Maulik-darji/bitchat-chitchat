import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously
} from 'firebase/auth';
import { 
  initializeFirestore,
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

// Firebase configuration - Project credentials
const firebaseConfig = {
  apiKey: "AIzaSyCKQar0RRhf_0F9HK0xSCOMmaNbJL7_1pM",
  authDomain: "aerobic-copilot-449112-s6.firebaseapp.com",
  projectId: "aerobic-copilot-449112-s6",
  storageBucket: "aerobic-copilot-449112-s6.firebasestorage.app",
  messagingSenderId: "790758007005",
  appId: "1:790758007005:web:25588360b14774e2737b34",
  measurementId: "G-4YR66Y35TR"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true
});
const functions = getFunctions(app);

// Collection names
const COLLECTIONS = {
  USERS: 'users',
  PUBLIC_CHATS: 'publicChats',
  ROOM_MESSAGES: 'roomMessages',
  ROOM_USERS: 'roomUsers',
  ROOMS: 'rooms'
};

// Spam protection configuration
const SPAM_CONFIG = {
  MAX_MESSAGES: 5,
  RAPID_THRESHOLD: 3,
  RAPID_TIME_WINDOW: 10000, // 10 seconds
  MIN_INTERVAL: 2000, // 2 seconds
  COOLDOWN_PERIOD: 30000 // 30 seconds
};

// In-memory spam tracking
const spamTracker = new Map();

// In-memory online users tracking
const onlineUsers = new Map();

/**
 * Main Firebase Service Class
 */
class FirebaseService {
  constructor() {
    this.auth = auth;
    this.db = db;
    this.functions = functions;
    this.isInitialized = false;
    this.initPromise = null;
    this.unsubscribeFns = new Set();
  }

  /**
   * Initialize the Firebase service
   */
  async initialize() {
    if (this.isInitialized) return this.auth.currentUser;
    if (this.initPromise) return this.initPromise;
    
    try {
      this.initPromise = signInAnonymously(auth)
        .then((userCredential) => {
          this.isInitialized = true;
          console.log('Firebase initialized successfully');
          return userCredential.user;
        })
        .catch((error) => {
          // Reset initPromise so subsequent attempts can retry
          this.initPromise = null;
          throw error;
        });
      return await this.initPromise;
    } catch (error) {
      console.error('Error initializing Firebase:', error);
      throw error;
    }
  }

  /**
   * Check if username is available
   */
  async checkUsernameAvailability(username) {
    try {
      const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, username));
      return !userDoc.exists();
    } catch (error) {
      console.error('Error checking username availability:', error);
      return false;
    }
  }

  /**
   * Create a new user with UID tracking
   */
  async createUser(username) {
    try {
      const current = auth.currentUser;
      if (!current) {
        throw new Error('No authenticated user');
      }

      const userRef = doc(db, COLLECTIONS.USERS, username);
      await setDoc(userRef, {
        username,
        uid: current.uid, // CRITICAL: Link to Auth UID
        createdAt: serverTimestamp(),
        isOnline: true,
        lastSeen: serverTimestamp()
      });
      
      // Add to online users
      onlineUsers.set(username, true);
      
      return username;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Update user status
   */
  async updateUserStatus(username, isOnline) {
    try {
      const current = auth.currentUser;
      if (!current) return;

      const userRef = doc(db, COLLECTIONS.USERS, username);
      await updateDoc(userRef, {
        isOnline,
        lastSeen: serverTimestamp(),
        uid: current.uid // Ensure UID is always present
      });
      
      if (isOnline) {
        onlineUsers.set(username, true);
      } else {
        onlineUsers.delete(username);
      }
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  }

  

  /**
   * Send public message with UID tracking
   */
  async sendPublicMessage(username, message) {
    try {
      const current = auth.currentUser;
      if (!current) throw new Error('No authenticated user');

      const messageRef = doc(collection(db, COLLECTIONS.PUBLIC_CHATS));
      await setDoc(messageRef, {
        id: messageRef.id,
        uid: current.uid, // CRITICAL: Link to Auth UID
        username,
        message,
        timestamp: serverTimestamp()
      });
      return messageRef.id;
    } catch (error) {
      console.error('Error sending public message:', error);
      throw error;
    }
  }

  /**
   * Edit public message
   */
  async editPublicMessage(messageId, newText) {
    try {
      const current = auth.currentUser;
      if (!current) throw new Error('No authenticated user');

      const messageRef = doc(db, COLLECTIONS.PUBLIC_CHATS, messageId);
      await updateDoc(messageRef, {
        message: newText,
        editedAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error('Error editing public message:', error);
      throw error;
    }
  }

  /**
   * Send room message with UID tracking
   */
  async sendRoomMessage(roomId, username, message) {
    try {
      const current = auth.currentUser;
      if (!current) throw new Error('No authenticated user');

      const messageRef = doc(collection(db, COLLECTIONS.ROOM_MESSAGES));
      await setDoc(messageRef, {
        id: messageRef.id,
        roomId,
        uid: current.uid, // CRITICAL: Link to Auth UID
        username,
        message,
        timestamp: serverTimestamp()
      });
      return messageRef.id;
    } catch (error) {
      console.error('Error sending room message:', error);
      throw error;
    }
  }

  /**
   * Edit room message
   */
  async editRoomMessage(roomId, messageId, newText) {
    try {
      const current = auth.currentUser;
      if (!current) throw new Error('No authenticated user');

      const messageRef = doc(db, COLLECTIONS.ROOM_MESSAGES, messageId);
      await updateDoc(messageRef, {
        message: newText,
        editedAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error('Error editing room message:', error);
      throw error;
    }
  }

  /**
   * Create private room with UID tracking
   */
  async createRoom(roomName, username) {
    try {
      const current = auth.currentUser;
      if (!current) throw new Error('No authenticated user');

      const roomRef = doc(collection(db, COLLECTIONS.ROOMS));
      await setDoc(roomRef, {
        id: roomRef.id,
        name: roomName,
        createdBy: username,
        createdByUid: current.uid, // CRITICAL: Link to Auth UID
        createdAt: serverTimestamp(),
        members: [username]
      });
      
      // Add user to room with UID tracking
      await setDoc(doc(db, COLLECTIONS.ROOM_USERS, `${roomRef.id}_${username}`), {
        roomId: roomRef.id,
        uid: current.uid, // CRITICAL: Link to Auth UID
        username,
        joinedAt: serverTimestamp()
      });
      
      return roomRef.id;
    } catch (error) {
      console.error('Error creating private room:', error);
      throw error;
    }
  }

  /**
   * Get room by ID
   */
  async getRoom(roomId) {
    try {
      const roomDoc = await getDoc(doc(db, COLLECTIONS.ROOMS, roomId));
      if (!roomDoc.exists()) {
        throw new Error('Room not found');
      }
      return { id: roomDoc.id, ...roomDoc.data() };
    } catch (error) {
      console.error('Error getting room:', error);
      throw error;
    }
  }

  /**
   * Join private room with UID tracking
   */
  async joinRoom(roomCode, username) {
    try {
      const current = auth.currentUser;
      if (!current) throw new Error('No authenticated user');

      // Check if room exists
      const roomDoc = await getDoc(doc(db, COLLECTIONS.ROOMS, roomCode));
      if (!roomDoc.exists()) {
        throw new Error('Room not found');
      }
      
      // Add user to room with UID tracking
      await setDoc(doc(db, COLLECTIONS.ROOM_USERS, `${roomCode}_${username}`), {
        roomId: roomCode,
        uid: current.uid, // CRITICAL: Link to Auth UID
        username,
        joinedAt: serverTimestamp()
      });
      
      // Update room members
      const roomRef = doc(db, COLLECTIONS.ROOMS, roomCode);
      const roomData = roomDoc.data();
      if (!roomData.members.includes(username)) {
        await updateDoc(roomRef, {
          members: [...roomData.members, username]
        });
      }
      
      return { id: roomCode, ...roomData };
    } catch (error) {
      console.error('Error joining private room:', error);
      throw error;
    }
  }

  /**
   * Get public chat messages
   */
  onPublicChatsUpdate(callback) {
    const q = query(
      collection(db, COLLECTIONS.PUBLIC_CHATS),
      orderBy('timestamp', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages = [];
      snapshot.forEach((doc) => {
        messages.push({ id: doc.id, ...doc.data() });
      });
      callback(messages);
    });
    this.unsubscribeFns.add(unsubscribe);
    return () => {
      try { unsubscribe(); } catch (_) {}
      this.unsubscribeFns.delete(unsubscribe);
    };
  }

  /**
   * Get room messages
   */
  onRoomMessagesUpdate(roomId, callback) {
    const q = query(
      collection(db, COLLECTIONS.ROOM_MESSAGES),
      where('roomId', '==', roomId),
      orderBy('timestamp', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages = [];
      snapshot.forEach((doc) => {
        messages.push({ id: doc.id, ...doc.data() });
      });
      callback(messages);
    });
    this.unsubscribeFns.add(unsubscribe);
    return () => {
      try { unsubscribe(); } catch (_) {}
      this.unsubscribeFns.delete(unsubscribe);
    };
  }

  /**
   * Get room users
   */
  onRoomUsersUpdate(roomId, callback) {
    const q = query(
      collection(db, COLLECTIONS.ROOM_USERS),
      where('roomId', '==', roomId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = [];
      snapshot.forEach((doc) => {
        users.push({ id: doc.id, ...doc.data() });
      });
      callback(users);
    });
    this.unsubscribeFns.add(unsubscribe);
    return () => {
      try { unsubscribe(); } catch (_) {}
      this.unsubscribeFns.delete(unsubscribe);
    };
  }

  /**
   * Get users list
   */
  onUsersUpdate(callback) {
    const unsubscribe = onSnapshot(collection(db, COLLECTIONS.USERS), (snapshot) => {
      const users = [];
      snapshot.forEach((doc) => {
        users.push({ id: doc.id, ...doc.data() });
      });
      callback(users);
    });
    this.unsubscribeFns.add(unsubscribe);
    return () => {
      try { unsubscribe(); } catch (_) {}
      this.unsubscribeFns.delete(unsubscribe);
    };
  }

  /**
   * Get rooms list
   */
  onRoomsUpdate(callback) {
    const unsubscribe = onSnapshot(collection(db, COLLECTIONS.ROOMS), (snapshot) => {
      const rooms = [];
      snapshot.forEach((doc) => {
        rooms.push({ id: doc.id, ...doc.data() });
      });
      callback(rooms);
    });
    this.unsubscribeFns.add(unsubscribe);
    return () => {
      try { unsubscribe(); } catch (_) {}
      this.unsubscribeFns.delete(unsubscribe);
    };
  }

  /**
   * Get current user count
   */
  async getCurrentUserCount() {
    try {
      const usersSnapshot = await getDocs(collection(db, COLLECTIONS.USERS));
      const totalUsers = usersSnapshot.size;
      
      // Count online users
      let activeUsers = 0;
      usersSnapshot.forEach((doc) => {
        const userData = doc.data();
        if (userData.isOnline) {
          activeUsers++;
        }
      });
      
      return { totalUsers, activeUsers };
    } catch (error) {
      console.error('Error getting user count:', error);
      return { totalUsers: 0, activeUsers: 0 };
    }
  }

  /**
   * Force refresh messages
   */
  async forceRefresh() {
    console.log('Force refresh requested');
    return true;
  }

  /**
   * Check spam status
   */
  getSpamStatus(username) {
    if (!spamTracker.has(username)) {
      return { canSend: true, remainingMessages: SPAM_CONFIG.MAX_MESSAGES, cooldown: 0 };
    }
    
    const userData = spamTracker.get(username);
    const now = Date.now();
    
    // Check if user is blocked
    if (userData.isBlocked && now < userData.blockUntil) {
      const cooldown = Math.ceil((userData.blockUntil - now) / 1000);
      return { canSend: false, remainingMessages: 0, cooldown };
    }
    
    // Check rapid mode
    if (userData.lastRapidTime && (now - userData.lastRapidTime) < SPAM_CONFIG.RAPID_TIME_WINDOW) {
      const remaining = SPAM_CONFIG.MAX_MESSAGES - userData.rapidMessageCount;
      return { canSend: remaining > 0, remainingMessages: Math.max(0, remaining), cooldown: 0 };
    }
    
    // Reset rapid mode if enough time has passed
    if (userData.lastRapidTime && (now - userData.lastRapidTime) >= SPAM_CONFIG.RAPID_TIME_WINDOW) {
      userData.rapidMessageCount = 0;
      userData.lastRapidTime = null;
    }
    
    return { canSend: true, remainingMessages: SPAM_CONFIG.MAX_MESSAGES, cooldown: 0 };
  }

  /**
   * Check if message is spam
   */
  checkSpam(username) {
    const now = Date.now();
    
    if (!spamTracker.has(username)) {
      spamTracker.set(username, {
        messageHistory: [],
        rapidMessageCount: 0,
        lastMessageTime: now,
        lastRapidTime: null,
        isBlocked: false,
        blockUntil: 0
      });
    }
    
    const userData = spamTracker.get(username);
    
    // Check if user is blocked
    if (userData.isBlocked && now < userData.blockUntil) {
      return { allowed: false, reason: 'You are blocked from sending messages. Please wait for the cooldown to end.' };
    }
    
    // Check minimum interval between messages
    if (userData.lastMessageTime && (now - userData.lastMessageTime) < SPAM_CONFIG.MIN_INTERVAL) {
      // This is a rapid message
      userData.rapidMessageCount++;
      userData.lastRapidTime = userData.lastRapidTime || now;
      
      // Check if rapid mode limit exceeded
      if (userData.rapidMessageCount >= SPAM_CONFIG.MAX_MESSAGES) {
        userData.isBlocked = true;
        userData.blockUntil = now + SPAM_CONFIG.COOLDOWN_PERIOD;
        return { allowed: false, reason: `You have exceeded the rapid message limit. Please wait ${SPAM_CONFIG.COOLDOWN_PERIOD / 1000} seconds.` };
      }
    } else {
      // Normal message, reset rapid mode
      userData.rapidMessageCount = 0;
      userData.lastRapidTime = null;
    }
    
    // Update message history
    userData.messageHistory.push(now);
    userData.lastMessageTime = now;
    
    // Keep only recent messages (last 30 seconds)
    userData.messageHistory = userData.messageHistory.filter(
      time => (now - time) < 30000
    );
    
    return { allowed: true };
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    return auth.currentUser;
  }

    /**
   * Sign out user (Cloud Function will handle data cleanup automatically)
   */
   async signOut() {
     try {
       // Stop all active listeners before signing out to avoid noisy stream errors
       this.stopAllListeners();
       await auth.signOut();
       this.isInitialized = false;
       onlineUsers.clear();
       spamTracker.clear();
       console.log('User signed out successfully');
     } catch (error) {
       console.error('Error signing out:', error);
       throw error;
     }
   }

  /**
   * Delete current user account and all associated data
   * This will trigger the Cloud Function to clean up Firestore data
   */
  async deleteUserAccount() {
     try {
       const currentUser = auth.currentUser;
       if (!currentUser) {
         throw new Error('No user is currently signed in');
       }

       console.log(`Deleting user account: ${currentUser.uid}`);
       
       // Stop all active listeners before deleting account
       this.stopAllListeners();
       
       // Try to refresh the token first to handle expiration
       try {
         await currentUser.getIdToken(true);
       } catch (tokenError) {
         console.log('Token refresh failed, trying to re-authenticate');
         // Try to re-authenticate anonymously
         try {
           await signInAnonymously(auth);
           // Get the new user and try to delete
           const newUser = auth.currentUser;
           if (newUser) {
             await newUser.delete();
             console.log('User account deleted successfully after re-authentication');
             this.isInitialized = false;
             onlineUsers.clear();
             spamTracker.clear();
             return;
           }
         } catch (reauthError) {
           console.log('Re-authentication failed, proceeding with manual cleanup');
         }
       }
       
       // Try to delete the Firebase Authentication user
       try {
         await currentUser.delete();
         console.log('User account deleted successfully');
       } catch (deleteError) {
         console.log('Could not delete auth user (token may be expired), proceeding with manual cleanup');
         
                   // If deletion fails due to token expiration, do manual cleanup
          await this.cleanupUserData(currentUser.uid);
        }
       
       this.isInitialized = false;
       onlineUsers.clear();
       spamTracker.clear();
       
     } catch (error) {
       console.error('Error deleting user account:', error);
       throw error;
     }
   }

  /**
   * Manual cleanup function - call this when a user is deleted from Authentication
   * This replaces the Cloud Function for users who can't deploy functions
   */
  async cleanupUserData(uid, fallbackUsername = null) {
    try {
      console.log(`Starting manual cleanup for UID: ${uid}`);
      
      // Find the username associated with this UID
      const usersSnapshot = await getDocs(
        query(collection(db, 'users'), where('uid', '==', uid))
      );
      
      let username = null;
      if (!usersSnapshot.empty) {
        const userDoc = usersSnapshot.docs[0];
        username = userDoc.data().username;
        console.log(`Found username for UID: ${username}`);
      } else if (fallbackUsername) {
        // If we can't find by UID, use the fallback username
        username = fallbackUsername;
        console.log(`Using fallback username: ${username}`);
      }
      
      const batch = writeBatch(db);
      let deletedCount = 0;
      
      // Delete user document
      if (!usersSnapshot.empty) {
        batch.delete(usersSnapshot.docs[0].ref);
        deletedCount++;
      }
      
      // Delete public messages by UID
      const publicChatsSnapshot = await getDocs(
        query(collection(db, 'publicChats'), where('uid', '==', uid))
      );
      publicChatsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });
      
      // Delete room messages by UID
      const roomMessagesSnapshot = await getDocs(
        query(collection(db, 'roomMessages'), where('uid', '==', uid))
      );
      roomMessagesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });
      
      // Delete room users by UID
      const roomUsersSnapshot = await getDocs(
        query(collection(db, 'roomUsers'), where('uid', '==', uid))
      );
      roomUsersSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });
      
      // Delete rooms created by this user
      const roomsSnapshot = await getDocs(
        query(collection(db, 'rooms'), where('createdByUid', '==', uid))
      );
      roomsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });
      
      // Legacy cleanup by username (for old docs without uid)
      if (username) {
        // Delete public messages by username
        const publicByUsername = await getDocs(
          query(collection(db, 'publicChats'), where('username', '==', username))
        );
        publicByUsername.docs.forEach(doc => {
          batch.delete(doc.ref);
          deletedCount++;
        });
        
        // Delete room messages by username
        const roomMsgsByUsername = await getDocs(
          query(collection(db, 'roomMessages'), where('username', '==', username))
        );
        roomMsgsByUsername.docs.forEach(doc => {
          batch.delete(doc.ref);
          deletedCount++;
        });
        
        // Delete room users by username
        const roomUsersByUsername = await getDocs(
          query(collection(db, 'roomUsers'), where('username', '==', username))
        );
        roomUsersByUsername.docs.forEach(doc => {
          batch.delete(doc.ref);
          deletedCount++;
        });
        
        // Delete rooms created by username
        const roomsByCreator = await getDocs(
          query(collection(db, 'rooms'), where('createdBy', '==', username))
        );
        roomsByCreator.docs.forEach(doc => {
          batch.delete(doc.ref);
          deletedCount++;
        });
      }
      
      await batch.commit();
      console.log(`Manual cleanup completed. Deleted ${deletedCount} documents for UID: ${uid}`);
      return { success: true, deletedCount };
      
    } catch (error) {
      console.error(`Error in manual cleanup for UID ${uid}:`, error);
      throw error;
    }
  }

  /**
   * Stop all active Firestore listeners
   */
  stopAllListeners() {
    this.unsubscribeFns.forEach((fn) => {
      try { fn(); } catch (_) {}
    });
    this.unsubscribeFns.clear();
  }
}

// Create and export service instance
const firebaseService = new FirebaseService();
export default firebaseService;
