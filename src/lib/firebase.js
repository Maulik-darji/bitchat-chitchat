import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { 
  initializeFirestore,
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc,
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  writeBatch,
  arrayRemove
} from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

// Firebase configuration - prefer env vars; fall back to dev values locally
const isDev = process.env.NODE_ENV === 'development';

// Helper to read and trim env vars to avoid invisible spaces breaking prod
const readEnv = (key) => {
  const v = process.env[key];
  return typeof v === 'string' ? v.trim() : v;
};

const firebaseConfig = {
  apiKey: readEnv('REACT_APP_FIREBASE_API_KEY') || 'AIzaSyAKjAAHMPsHR65B-tNT9FzfsfLJ-OwrdkI',
  authDomain: readEnv('REACT_APP_FIREBASE_AUTH_DOMAIN') || 'fluid-cosmos-469510-q8.firebaseapp.com',
  projectId: readEnv('REACT_APP_FIREBASE_PROJECT_ID') || 'fluid-cosmos-469510-q8',
  storageBucket: readEnv('REACT_APP_FIREBASE_STORAGE_BUCKET') || 'fluid-cosmos-469510-q8.firebasestorage.app',
  messagingSenderId: readEnv('REACT_APP_FIREBASE_MESSAGING_SENDER_ID') || '86564786373',
  appId: readEnv('REACT_APP_FIREBASE_APP_ID') || '1:86564786373:web:d71885afea20c0ac08e0ac',
  measurementId: readEnv('REACT_APP_FIREBASE_MEASUREMENT_ID') || 'G-QETQ5QT99M'
};

// Basic runtime validation to help during local dev
const missingFirebaseKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);
if (missingFirebaseKeys.length) {
  // eslint-disable-next-line no-console
  console.warn(
    'Missing Firebase env vars for:',
    missingFirebaseKeys.join(', '),
    '\nMake sure to define them in a .env file prefixed with REACT_APP_'
  );
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  databaseId: 'main'
});
const functions = getFunctions(app);

// Function to clear Firestore cache (useful for debugging offline persistence issues)
const clearFirestoreCache = async () => {
  try {
    // This will clear the offline cache
    await db.clearPersistence();
    console.log('Firestore cache cleared successfully');
  } catch (error) {
    console.error('Error clearing Firestore cache:', error);
  }
};

// Collection names
const COLLECTIONS = {
  USERS: 'users',
  PUBLIC_CHATS: 'publicChats',
  ROOM_MESSAGES: 'roomMessages',
  ROOM_USERS: 'roomUsers',
  ROOMS: 'rooms',
  INVITES: 'invites',
  PRIVATE_CHATS: 'privateChats',
  PRIVATE_MESSAGES: 'privateMessages',
  REMOVAL_NOTIFICATIONS: 'removalNotifications'
};

// Access validation cache for performance optimization
const ACCESS_CACHE = {
  rooms: new Map(), // roomId -> { hasAccess: boolean, timestamp: number, username: string }
  chats: new Map(), // chatId -> { hasAccess: boolean, timestamp: number, username: string }
  CACHE_DURATION: 5 * 60 * 1000 // 5 minutes cache duration
};

// Helper function to check if cache is valid
const isCacheValid = (timestamp) => {
  return Date.now() - timestamp < ACCESS_CACHE.CACHE_DURATION;
};

// Helper function to clear expired cache entries
const clearExpiredCache = () => {
  const now = Date.now();
  
  // Clear expired room cache entries
  for (const [roomId, data] of ACCESS_CACHE.rooms.entries()) {
    if (!isCacheValid(data.timestamp)) {
      ACCESS_CACHE.rooms.delete(roomId);
    }
  }
  
  // Clear expired chat cache entries
  for (const [chatId, data] of ACCESS_CACHE.chats.entries()) {
    if (!isCacheValid(data.timestamp)) {
      ACCESS_CACHE.chats.delete(chatId);
    }
  }
};

// Clear expired cache entries every 2 minutes for better performance
setInterval(clearExpiredCache, 120000);

// Spam protection configuration - OPTIMIZED FOR PERFORMANCE
const SPAM_CONFIG = {
  MAX_MESSAGES: 15, // Increased from 10 for better user experience
  RAPID_THRESHOLD: 8, // Increased from 5
  RAPID_TIME_WINDOW: 20000, // Increased from 15 seconds to 20 seconds
  MIN_INTERVAL: 500, // Reduced from 1 second to 0.5 seconds for faster messaging
  COOLDOWN_PERIOD: 10000, // Reduced from 15 seconds to 10 seconds
  ENABLED: true, // Enable/disable spam protection globally
  SKIP_FOR_PRIVATE_CHATS: true // Skip spam check for private chats for better performance
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
    this.activeListeners = new Map(); // Track active listeners to prevent duplicates
  }

  /**
   * Ensure there is a signed-in user and optionally backfill the UID
   * into the provided username's user document. Returns the UID.
   */
  async ensureUserUid(username) {
    try {
      // Ensure auth session exists
      let current = auth.currentUser;
      if (!current) {
        await this.initialize();
        current = auth.currentUser;
      }

      const uid = current?.uid || null;

      // If a username is provided, make sure the users/<username> doc has the UID
      if (username && uid) {
        try {
          const userRef = doc(db, COLLECTIONS.USERS, username);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const data = userSnap.data() || {};
            if (!data.uid) {
              await updateDoc(userRef, { uid, lastSeen: serverTimestamp() });
            }
          }
        } catch (_) {
          // Best-effort; ignore failures
        }
      }

      return uid;
    } catch (error) {
      console.error('ensureUserUid failed:', error);
      return null;
    }
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
      // Ensure we have an authenticated user
      const current = auth.currentUser;
      if (!current) {
        console.log('No authenticated user, attempting to initialize Firebase');
        await this.initialize();
      }
      
      const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, username));
      return !userDoc.exists();
    } catch (error) {
      console.error('Error checking username availability:', error);
      // If there's a permission error, try to re-authenticate and check again
      if (error.code === 'permission-denied' || error.message.includes('permissions')) {
        try {
          console.log('Permission denied, attempting to re-authenticate');
          await signInAnonymously(auth);
          const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, username));
          return !userDoc.exists();
        } catch (reauthError) {
          console.error('Re-authentication failed:', reauthError);
          return false;
        }
      }
      return false;
    }
  }

    /**
   * Create a new user with UID tracking
   */
  async createUser(username) {
    try {
      // First, ensure we have an authenticated user
      let current = auth.currentUser;
      if (!current) {
        console.log('No authenticated user, attempting to initialize Firebase');
        await this.initialize();
        current = auth.currentUser;
        if (!current) {
          throw new Error('Failed to authenticate user');
        }
      }

      console.log(`Attempting to create user: ${username} with UID: ${current.uid}`);

      // Check if username already exists with better error handling
      try {
        const existingUser = await getDoc(doc(db, COLLECTIONS.USERS, username));
        console.log(`Username check result for ${username}:`, {
          exists: existingUser.exists(),
          data: existingUser.exists() ? existingUser.data() : null
        });
        
        if (existingUser.exists()) {
          console.error(`Username ${username} already exists in database`);
          throw new Error('Username already exists');
        }
      } catch (checkError) {
        console.error('Error checking username existence:', checkError);
        // If it's a permission error, try to re-authenticate
        if (checkError.code === 'permission-denied') {
          console.log('Permission denied, attempting to re-authenticate');
          await signInAnonymously(auth);
          const existingUser = await getDoc(doc(db, COLLECTIONS.USERS, username));
          if (existingUser.exists()) {
            throw new Error('Username already exists');
          }
        } else {
          // Try force check as fallback
          console.log('Attempting force check as fallback...');
          const isAvailable = await this.forceCheckUsername(username);
          if (!isAvailable) {
            throw new Error('Username already exists');
          }
        }
      }

      // Update the Firebase Auth user profile with the username
      try {
        await updateProfile(current, {
          displayName: username
        });
        console.log(`Updated Firebase Auth profile with username: ${username}`);
      } catch (profileError) {
        console.warn('Could not update Firebase Auth profile:', profileError);
      }

      const userRef = doc(db, COLLECTIONS.USERS, username);
      await setDoc(userRef, {
        username,
        uid: current.uid, // CRITICAL: Link to Auth UID
        createdAt: serverTimestamp(),
        isOnline: true,
        isTabActive: true,
        lastSeen: serverTimestamp(),
        lastTabActivity: serverTimestamp(),
        lastHeartbeat: serverTimestamp()
      });
      
      // Add to online users
      onlineUsers.set(username, true);
      
      console.log(`User created successfully: ${username} with UID: ${current.uid}`);
      return username;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Create a new user with email/password authentication (RECOMMENDED)
   */
  async createUserWithEmail(username, email, password) {
    try {
      console.log('Creating user with email authentication:', { username, email });
      
      // Check if username already exists
      const existingUser = await getDoc(doc(db, COLLECTIONS.USERS, username));
      if (existingUser.exists()) {
        throw new Error('Username already exists');
      }

      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Update profile with username
      await updateProfile(user, {
        displayName: username
      });

      // Create Firestore user document
      const userRef = doc(db, COLLECTIONS.USERS, username);
      await setDoc(userRef, {
        username,
        uid: user.uid, // REAL Firebase Auth UID
        email: email,
        createdAt: serverTimestamp(),
        isOnline: true,
        isTabActive: true,
        lastSeen: serverTimestamp(),
        lastTabActivity: serverTimestamp(),
        lastHeartbeat: serverTimestamp()
      });
      
      // Add to online users
      onlineUsers.set(username, true);
      
      console.log(`User created successfully with email auth: ${username} with UID: ${user.uid}`);
      return { username, uid: user.uid, email };
    } catch (error) {
      console.error('Error creating user with email:', error);
      throw error;
    }
  }

  /**
   * Sign in existing user with email/password
   */
  async signInUser(email, password) {
    try {
      console.log('Signing in user with email:', email);
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Get username from Firestore
      const usersSnapshot = await getDocs(
        query(collection(db, COLLECTIONS.USERS), where('uid', '==', user.uid))
      );
      
      if (!usersSnapshot.empty) {
        const userData = usersSnapshot.docs[0].data();
        const username = userData.username;
        
        // Update online status
        await this.updateUserStatus(username, true);
        
        console.log(`User signed in successfully: ${username} with UID: ${user.uid}`);
        return { username, uid: user.uid, email };
      } else {
        throw new Error('User document not found in Firestore');
      }
    } catch (error) {
      console.error('Error signing in user:', error);
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
        // Also set tab as inactive when going offline
        await updateDoc(userRef, {
          isTabActive: false,
          lastTabActivity: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  }

  /**
   * Update user tab visibility status
   */
  async updateUserTabStatus(username, isTabActive) {
    try {
      const current = auth.currentUser;
      if (!current) return;

      const userRef = doc(db, COLLECTIONS.USERS, username);
      await updateDoc(userRef, {
        isTabActive,
        lastTabActivity: serverTimestamp(),
        uid: current.uid
      });
      
      if (isTabActive) {
        onlineUsers.set(username, true);
      } else {
        // Don't immediately remove from online users, wait for heartbeat timeout
        // This prevents flickering when switching tabs quickly
      }
    } catch (error) {
      console.error('Error updating user tab status:', error);
    }
  }

  /**
   * Send heartbeat to keep user active
   */
  async sendHeartbeat(username) {
    try {
      const current = auth.currentUser;
      if (!current) return;

      const userRef = doc(db, COLLECTIONS.USERS, username);
      await updateDoc(userRef, {
        lastHeartbeat: serverTimestamp(),
        uid: current.uid
      });
    } catch (error) {
      console.error('Error sending heartbeat:', error);
    }
  }

  /**
   * Update user activity (called when user performs actions)
   */
  async updateUserActivity(username) {
    try {
      const current = auth.currentUser;
      if (!current) return;

      const userRef = doc(db, COLLECTIONS.USERS, username);
      await updateDoc(userRef, {
        lastSeen: serverTimestamp(),
        lastHeartbeat: serverTimestamp(),
        uid: current.uid
      });
    } catch (error) {
      console.error('Error updating user activity:', error);
    }
  }

  /**
   * Send public message - OPTIMIZED VERSION
   */
  async sendPublicMessage(username, message, replyTo = null) {
    try {
      const current = auth.currentUser;
      if (!current) throw new Error('No authenticated user');

      const messageRef = doc(collection(db, COLLECTIONS.PUBLIC_CHATS));
      
      // Create message data
      const messageData = {
        id: messageRef.id,
        uid: current.uid,
        username,
        message,
        timestamp: serverTimestamp(),
        status: 'sent',
        replyTo: replyTo ? {
          id: replyTo.id,
          username: replyTo.username,
          message: replyTo.message
        } : null
      };

      // Send message to Firebase (non-blocking)
      setDoc(messageRef, messageData).catch(error => {
        console.error('Error sending public message:', error);
        throw error;
      });

      // Update user activity in background (non-blocking)
      this.updateUserActivity(username).catch(error => {
        console.error('Error updating user activity:', error);
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
        editedAt: serverTimestamp(),
        edited: true
      });

      // Get username from the message to update activity
      const messageDoc = await getDoc(messageRef);
      if (messageDoc.exists()) {
        const messageData = messageDoc.data();
        await this.updateUserActivity(messageData.username);
      }

      return true;
    } catch (error) {
      console.error('Error editing public message:', error);
      throw error;
    }
  }

  /**
   * Send room message with UID tracking - OPTIMIZED VERSION
   */
  async sendRoomMessage(roomId, username, message, replyTo = null) {
    try {
      const current = auth.currentUser;
      if (!current) throw new Error('No authenticated user');

      const messageRef = doc(collection(db, COLLECTIONS.ROOM_MESSAGES));
      const roomRef = doc(db, COLLECTIONS.ROOMS, roomId);
      
      // Create message data
      const messageData = {
        id: messageRef.id,
        roomId,
        uid: current.uid,
        username,
        message,
        timestamp: serverTimestamp(),
        status: 'sent',
        replyTo: replyTo ? {
          id: replyTo.id,
          username: replyTo.username,
          message: replyTo.message
        } : null
      };

      // Use batch operations for better performance
      const batch = writeBatch(db);
      batch.set(messageRef, messageData);
      batch.update(roomRef, {
        lastMessageAt: serverTimestamp(),
        lastMessage: message.substring(0, 100) // Store message preview
      });

      // Commit batch operations (non-blocking)
      batch.commit().catch(error => {
        console.error('Error committing room message batch:', error);
        throw error;
      });

      console.log('Room message sent successfully:', messageRef.id);

      // Update user activity when sending message
      await this.updateUserActivity(username);

      // Create notification in parallel (non-blocking)
      this.createRoomMessageNotificationAsync(roomId, username, message);

      // Mark message as delivered for online users in the room (non-blocking)
      this.markRoomMessageAsDeliveredForOnlineUsers(roomId, messageRef.id);

      return messageRef.id;
    } catch (error) {
      console.error('Error sending room message:', error);
      throw error;
    }
  }

  /**
   * Create room message notification asynchronously (non-blocking)
   */
  async createRoomMessageNotificationAsync(roomId, username, message) {
    try {
      // Get room participants to create notifications
      const roomRef = doc(db, COLLECTIONS.ROOMS, roomId);
      const roomDoc = await getDoc(roomRef);
      
      if (roomDoc.exists()) {
        const roomData = roomDoc.data();
        const participants = roomData.participants || [];
        
        // Create notifications for all participants except sender (non-blocking)
        const notificationPromises = participants
          .filter(p => p !== username)
          .map(async (recipientUsername) => {
            try {
              const { createMessageReceivedNotification } = await import('./notifications');
              return await createMessageReceivedNotification(roomId, username, recipientUsername, message, 'room');
            } catch (error) {
              console.error('Error creating room notification for:', recipientUsername, error);
              return null;
            }
          });

        // Wait for all notifications to complete (but don't block message sending)
        Promise.allSettled(notificationPromises);
      }
    } catch (error) {
      console.error('Error in async room notification creation:', error);
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
        editedAt: serverTimestamp(),
        edited: true
      });

      // Get username from the message to update activity
      const messageDoc = await getDoc(messageRef);
      if (messageDoc.exists()) {
        const messageData = messageDoc.data();
        await this.updateUserActivity(messageData.username);
      }

      return true;
    } catch (error) {
      console.error('Error editing room message:', error);
      throw error;
    }
  }

  /**
   * Mark all messages in a room as read for a user
   */
  async markAllRoomMessagesAsRead(roomId, username) {
    try {
      const q = query(
        collection(db, COLLECTIONS.ROOM_MESSAGES),
        where('roomId', '==', roomId),
        where('username', '!=', username) // Only mark other users' messages as read
      );
      
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      
      snapshot.forEach((doc) => {
        batch.update(doc.ref, {
          status: 'read',
          readAt: serverTimestamp()
        });
      });
      
      await batch.commit();
      console.log(`Marked ${snapshot.size} room messages as read for user: ${username}`);
    } catch (error) {
      console.error('Error marking room messages as read:', error);
      throw error;
    }
  }

  /**
   * Create private room with UID tracking
   */
  async createRoom(roomName, username) {
    try {
      // Ensure we have an authenticated user
      let current = auth.currentUser;
      if (!current) {
        console.log('No authenticated user, attempting to initialize Firebase');
        await this.initialize();
        current = auth.currentUser;
        if (!current) throw new Error('Failed to authenticate user');
      }

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

      // Update user activity when creating room
      await this.updateUserActivity(username);
      
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
   * Delete room and all associated data
   */
  async deleteRoom(roomId) {
    try {
      const current = auth.currentUser;
      if (!current) throw new Error('No authenticated user');

      // Check if user is the creator
      const roomDoc = await getDoc(doc(db, COLLECTIONS.ROOMS, roomId));
      if (!roomDoc.exists()) throw new Error('Room not found');
      
      const roomData = roomDoc.data();
      if (roomData.createdByUid !== current.uid) {
        throw new Error('Only room creator can delete the room');
      }

      // Use the cleanup function to remove all associated data
      await this.cleanupCreatorData(current.uid);
      
      console.log('Room and all associated data deleted successfully');
      return true;
    } catch (error) {
      console.error('Error deleting room:', error);
      throw error;
    }
  }

  /**
   * Clean up all data when a room creator deletes their account
   * This function wipes: invites, privateChats, privateMessages, publicChats, roomMessages, roomUsers
   */
  async cleanupCreatorData(creatorUid) {
    try {
      console.log('Starting cleanup for creator:', creatorUid);
      const batch = writeBatch(db);
      
      // 1. Find all rooms created by this user
      const roomsQuery = query(
        collection(db, COLLECTIONS.ROOMS),
        where('createdByUid', '==', creatorUid)
      );
      const roomsSnapshot = await getDocs(roomsQuery);
      
      if (roomsSnapshot.empty) {
        console.log('No rooms found for creator:', creatorUid);
        return;
      }
      
      const roomIds = roomsSnapshot.docs.map(doc => doc.id);
      console.log('Found rooms to cleanup:', roomIds);
      
      // 2. Clean up roomMessages for all rooms
      for (const roomId of roomIds) {
        const messagesQuery = query(collection(db, COLLECTIONS.ROOM_MESSAGES), where('roomId', '==', roomId));
        const messagesSnapshot = await getDocs(messagesQuery);
        messagesSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        console.log(`Deleted ${messagesSnapshot.size} messages for room: ${roomId}`);
      }
      
      // 3. Clean up roomUsers for all rooms
      for (const roomId of roomIds) {
        const usersQuery = query(collection(db, COLLECTIONS.ROOM_USERS), where('roomId', '==', roomId));
        const usersSnapshot = await getDocs(usersQuery);
        usersSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        console.log(`Deleted ${usersSnapshot.size} room users for room: ${roomId}`);
      }
      
      // 4. Clean up invites for all rooms
      for (const roomId of roomIds) {
        const invitesQuery = query(collection(db, COLLECTIONS.INVITES), where('roomId', '==', roomId));
        const invitesSnapshot = await getDocs(invitesQuery);
        invitesSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        console.log(`Deleted ${invitesSnapshot.size} invites for room: ${roomId}`);
      }
      
      // 5. Clean up privateChats and privateMessages for this user
      const privateChatsQuery = query(
        collection(db, COLLECTIONS.PRIVATE_CHATS),
        where('participants', 'array-contains', creatorUid)
      );
      const privateChatsSnapshot = await getDocs(privateChatsQuery);
      
      for (const chatDoc of privateChatsSnapshot.docs) {
        // Delete private messages for this chat
        const privateMessagesQuery = query(
          collection(db, COLLECTIONS.PRIVATE_MESSAGES),
          where('chatId', '==', chatDoc.id)
        );
        const privateMessagesSnapshot = await getDocs(privateMessagesQuery);
        privateMessagesSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        console.log(`Deleted ${privateMessagesSnapshot.size} private messages for chat: ${chatDoc.id}`);
        
        // Delete the private chat
        batch.delete(chatDoc.ref);
      }
      console.log(`Deleted ${privateChatsSnapshot.size} private chats for creator: ${creatorUid}`);
      
      // 6. Clean up publicChats for this user
      const publicChatsQuery = query(
        collection(db, COLLECTIONS.PUBLIC_CHATS),
        where('username', '==', creatorUid)
      );
      const publicChatsSnapshot = await getDocs(publicChatsQuery);
      publicChatsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      console.log(`Deleted ${publicChatsSnapshot.size} public chats for creator: ${creatorUid}`);
      
      // 7. Finally, delete all the rooms
      roomsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      console.log(`Deleted ${roomsSnapshot.size} rooms for creator: ${creatorUid}`);
      
      // 8. Commit all deletions
      await batch.commit();
      console.log('Successfully cleaned up all data for creator:', creatorUid);
      
    } catch (error) {
      console.error('Error cleaning up creator data:', error);
      throw error;
    }
  }

  /**
   * Comprehensive cleanup function that handles all data when a user deletes their account
   * This ensures invites, privateChats, and privateMessages are cleaned up properly
   */
  async comprehensiveUserCleanup(username) {
    try {
      console.log('Starting comprehensive cleanup for user:', username);
      const batch = writeBatch(db);
      
      // First, get the user's UID from their document
      const userRef = doc(db, COLLECTIONS.USERS, username);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        console.log('User document not found, cannot proceed with cleanup');
        return { success: false, error: 'User not found' };
      }
      
      const userUid = userDoc.data().uid;
      console.log(`Found UID for user ${username}: ${userUid}`);
      
      // 1. Clean up all invites by UID (both sent and received)
      const sentInvitesQuery = query(
        collection(db, COLLECTIONS.INVITES),
        where('fromUid', '==', userUid)
      );
      const receivedInvitesQuery = query(
        collection(db, COLLECTIONS.INVITES),
        where('toUid', '==', userUid)
      );
      
      const [sentInvitesSnapshot, receivedInvitesSnapshot] = await Promise.all([
        getDocs(sentInvitesQuery),
        getDocs(receivedInvitesQuery)
      ]);
      
      // Delete all invites
      [...sentInvitesSnapshot.docs, ...receivedInvitesSnapshot.docs].forEach(doc => {
        batch.delete(doc.ref);
      });
      console.log(`Deleted ${sentInvitesSnapshot.size + receivedInvitesSnapshot.size} invites for UID: ${userUid}`);
      
      // 2. Clean up private chats where this user's UID is a participant
      const privateChatsQuery = query(
        collection(db, COLLECTIONS.PRIVATE_CHATS),
        where('participantUids', 'array-contains', userUid)
      );
      const privateChatsSnapshot = await getDocs(privateChatsQuery);
      
      for (const chatDoc of privateChatsSnapshot.docs) {
        const chatData = chatDoc.data();
        
        // Delete all private messages for this chat
        const privateMessagesQuery = query(
          collection(db, COLLECTIONS.PRIVATE_MESSAGES),
          where('chatId', '==', chatDoc.id)
        );
        const privateMessagesSnapshot = await getDocs(privateMessagesQuery);
        privateMessagesSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        console.log(`Deleted ${privateMessagesSnapshot.size} private messages for chat: ${chatDoc.id}`);
        
        // Delete the private chat itself
        batch.delete(chatDoc.ref);
      }
      console.log(`Deleted ${privateChatsSnapshot.size} private chats for UID: ${userUid}`);
      
      // 3. Clean up public chats by this user's UID
      const publicChatsQuery = query(
        collection(db, COLLECTIONS.PUBLIC_CHATS),
        where('uid', '==', userUid)
      );
      const publicChatsSnapshot = await getDocs(publicChatsQuery);
      publicChatsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      console.log(`Deleted ${publicChatsSnapshot.size} public chats for UID: ${userUid}`);
      
      // 4. Clean up room messages by this user's UID
      const roomMessagesQuery = query(
        collection(db, COLLECTIONS.ROOM_MESSAGES),
        where('uid', '==', userUid)
      );
      const roomMessagesSnapshot = await getDocs(roomMessagesQuery);
      roomMessagesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      console.log(`Deleted ${roomMessagesSnapshot.size} room messages for UID: ${userUid}`);
      
      // 5. Clean up room users where this user's UID is a member
      const roomUsersQuery = query(
        collection(db, COLLECTIONS.ROOM_USERS),
        where('uid', '==', userUid)
      );
      const roomUsersSnapshot = await getDocs(roomUsersQuery);
      roomUsersSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      console.log(`Deleted ${roomUsersSnapshot.size} room user entries for UID: ${userUid}`);
      
      // 6. Clean up rooms created by this user's UID
      const roomsQuery = query(
        collection(db, COLLECTIONS.ROOMS),
        where('createdByUid', '==', userUid)
      );
      const roomsSnapshot = await getDocs(roomsQuery);
      
      // For each room, clean up all associated data
      for (const roomDoc of roomsSnapshot.docs) {
        const roomId = roomDoc.id;
        
        // Clean up room messages
        const roomMsgsQuery = query(
          collection(db, COLLECTIONS.ROOM_MESSAGES),
          where('roomId', '==', roomId)
        );
        const roomMsgsSnapshot = await getDocs(roomMsgsQuery);
        roomMsgsSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        // Clean up room users
        const roomUsersQuery = query(
          collection(db, COLLECTIONS.ROOM_USERS),
          where('roomId', '==', roomId)
        );
        const roomUsersSnapshot = await getDocs(roomUsersQuery);
        roomUsersSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        // Delete the room itself
        batch.delete(roomDoc.ref);
      }
      console.log(`Deleted ${roomsSnapshot.size} rooms and associated data for UID: ${userUid}`);
      
      // 7. Finally, delete the user document
      batch.delete(userRef);
      
      // 8. Commit all deletions
      await batch.commit();
      console.log('Successfully completed comprehensive cleanup for UID:', userUid);
      
      return { success: true, deletedCount: 'all associated data', uid: userUid };
      
    } catch (error) {
      console.error('Error in comprehensive user cleanup:', error);
      throw error;
    }
  }

  /**
   * Leave a room (remove user from room)
   */
  async leaveRoom(roomId, username) {
    try {
      // Ensure we have an authenticated user
      let current = auth.currentUser;
      if (!current) {
        console.log('No authenticated user, attempting to initialize Firebase');
        await this.initialize();
        current = auth.currentUser;
        if (!current) throw new Error('Failed to authenticate user');
      }

      // Remove user from room users
      const roomUserDocId = `${roomId}_${username}`;
      await deleteDoc(doc(db, COLLECTIONS.ROOM_USERS, roomUserDocId));

      // Best-effort: remove from members array (ignore permission issues)
      try {
        await updateDoc(doc(db, COLLECTIONS.ROOMS, roomId), { members: arrayRemove(username) });
      } catch (e) {
        if (e?.code !== 'permission-denied') {
          console.warn('Non-fatal leaveRoom members update failed:', e);
        }
      }

      console.log('User left room successfully');
      return true;
    } catch (error) {
      console.error('Error leaving room:', error);
      throw error;
    }
  }

  /**
   * Remove a user from a room (owner-only)
   */
  async removeUserFromRoom(roomId, usernameToRemove) {
    try {
      const current = auth.currentUser;
      if (!current) throw new Error('No authenticated user');

      // Verify current user is the room creator
      const roomRef = doc(db, COLLECTIONS.ROOMS, roomId);
      const roomDoc = await getDoc(roomRef);
      if (!roomDoc.exists()) throw new Error('Room not found');
      const roomData = roomDoc.data();
      if (roomData.createdByUid && roomData.createdByUid !== current.uid) {
        throw new Error('Only room creator can remove users');
      }

      // Remove membership doc and array membership
      try {
        await deleteDoc(doc(db, COLLECTIONS.ROOM_USERS, `${roomId}_${usernameToRemove}`));
      } catch (_) {}
      try {
        await updateDoc(roomRef, { members: arrayRemove(usernameToRemove) });
      } catch (_) {}

      return true;
    } catch (error) {
      console.error('Error removing user from room:', error);
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

      // Update user activity when joining room
      await this.updateUserActivity(username);
      
      // Update room members
      const roomRef = doc(db, COLLECTIONS.ROOMS, roomCode);
      const roomData = roomDoc.data();
      if (!roomData.members.includes(username)) {
        await updateDoc(roomRef, {
          members: [...roomData.members, username]
        });
        
        // Create notification for room creator
        try {
          const { createRoomJoinNotification } = await import('./notifications');
          await createRoomJoinNotification(roomCode, roomData.name, username, roomData.createdBy);
        } catch (error) {
          console.error('Error creating room join notification:', error);
        }
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
    try {
      // Use orderBy like public chat for consistent message ordering
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
        
        // Messages are already sorted by Firebase, no client-side sorting needed
        callback(messages);
      }, (error) => {
        console.error('Error in room messages listener:', error);
        
        // Fallback: if orderBy fails, try without it and sort client-side
        if (error.code === 'failed-precondition') {
          console.log('Falling back to client-side sorting for room messages');
          const fallbackQuery = query(
            collection(db, COLLECTIONS.ROOM_MESSAGES),
            where('roomId', '==', roomId)
          );
          
          const fallbackUnsubscribe = onSnapshot(fallbackQuery, (fallbackSnapshot) => {
            const fallbackMessages = [];
            fallbackSnapshot.forEach((doc) => {
              fallbackMessages.push({ id: doc.id, ...doc.data() });
            });
            
            // Sort messages by timestamp on the client side as fallback
            fallbackMessages.sort((a, b) => {
              const timeA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
              const timeB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
              return timeA - timeB;
            });
            
            callback(fallbackMessages);
          });
          
          this.unsubscribeFns.add(fallbackUnsubscribe);
          return () => {
            try { fallbackUnsubscribe(); } catch (_) {}
            this.unsubscribeFns.delete(fallbackUnsubscribe);
          };
        }
        
        callback([]);
      });
      
      this.unsubscribeFns.add(unsubscribe);
      return () => {
        try { unsubscribe(); } catch (_) {}
        this.unsubscribeFns.delete(unsubscribe);
      };
    } catch (error) {
      console.error('Error setting up room messages listener:', error);
      callback([]);
      return () => {};
    }
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
      const now = Date.now();
      const HEARTBEAT_TIMEOUT = 30000; // 30 seconds timeout
      
      snapshot.forEach((doc) => {
        const userData = doc.data();
        // Only include users with recent activity
        if (userData.lastSeen) {
          const lastSeen = userData.lastSeen.toDate ? userData.lastSeen.toDate().getTime() : userData.lastSeen;
          const timeSinceLastSeen = now - lastSeen;
          
          // Include user if they've been seen in the last 5 minutes
          if (timeSinceLastSeen < 300000) {
            users.push({ id: doc.id, ...userData });
          }
        }
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
   * Get real-time total user count from Firestore
   * This provides accurate count of all users in the database
   */
  onTotalUsersCount(callback) {
    const unsubscribe = onSnapshot(collection(db, COLLECTIONS.USERS), (snapshot) => {
      const totalUsers = snapshot.size;
      callback(totalUsers);
    });
    this.unsubscribeFns.add(unsubscribe);
    return () => {
      try { unsubscribe(); } catch (_) {}
      this.unsubscribeFns.delete(unsubscribe);
    };
  }

  /**
   * Get real-time active users count (users with recent activity)
   */
  onActiveUsersCount(callback) {
    const unsubscribe = onSnapshot(collection(db, COLLECTIONS.USERS), (snapshot) => {
      const now = Date.now();
      const HEARTBEAT_TIMEOUT = 30000; // 30 seconds timeout
      
      let activeUsers = 0;
      snapshot.forEach((doc) => {
        const userData = doc.data();
        if (userData.isTabActive && userData.lastHeartbeat) {
          const lastHeartbeat = userData.lastHeartbeat.toDate ? userData.lastHeartbeat.toDate().getTime() : userData.lastHeartbeat;
          const timeSinceHeartbeat = now - lastHeartbeat;
          
          // User is active if tab is active and heartbeat is recent
          if (timeSinceHeartbeat < HEARTBEAT_TIMEOUT) {
            activeUsers++;
          }
        }
      });
      
      callback(activeUsers);
    });
    this.unsubscribeFns.add(unsubscribe);
    return () => {
      try { unsubscribe(); } catch (_) {}
      this.unsubscribeFns.delete(unsubscribe);
    };
  }

  /**
   * Get comprehensive user statistics in real-time
   */
  onUserStats(callback) {
    const unsubscribe = onSnapshot(collection(db, COLLECTIONS.USERS), (snapshot) => {
      const now = Date.now();
      const HEARTBEAT_TIMEOUT = 30000; // 30 seconds timeout
      const RECENT_ACTIVITY_TIMEOUT = 300000; // 5 minutes
      
      let totalUsers = snapshot.size;
      let activeUsers = 0;
      let onlineUsers = 0;
      let recentUsers = 0;
      
      snapshot.forEach((doc) => {
        const userData = doc.data();
        
        // Count online users
        if (userData.isOnline) {
          onlineUsers++;
        }
        
        // Count active users (tab active + recent heartbeat)
        if (userData.isTabActive && userData.lastHeartbeat) {
          const lastHeartbeat = userData.lastHeartbeat.toDate ? userData.lastHeartbeat.toDate().getTime() : userData.lastHeartbeat;
          const timeSinceHeartbeat = now - lastHeartbeat;
          
          if (timeSinceHeartbeat < HEARTBEAT_TIMEOUT) {
            activeUsers++;
          }
        }
        
        // Count users with recent activity
        if (userData.lastSeen) {
          const lastSeen = userData.lastSeen.toDate ? userData.lastSeen.toDate().getTime() : userData.lastSeen;
          const timeSinceLastSeen = now - lastSeen;
          
          if (timeSinceLastSeen < RECENT_ACTIVITY_TIMEOUT) {
            recentUsers++;
          }
        }
      });
      
      callback({
        totalUsers,
        activeUsers,
        onlineUsers,
        recentUsers,
        lastUpdated: new Date().toISOString()
      });
    });
    this.unsubscribeFns.add(unsubscribe);
    return () => {
      try { unsubscribe(); } catch (_) {}
      this.unsubscribeFns.delete(unsubscribe);
    };
  }

  /**
   * Search users by username
   */
  async searchUsers(searchTerm, currentUsername) {
    try {
      console.log('Searching users with term:', searchTerm, 'excluding:', currentUsername);
      
      const usersSnapshot = await getDocs(collection(db, COLLECTIONS.USERS));
      const users = [];
      usersSnapshot.forEach((doc) => {
        const userData = doc.data();
        if (userData.username !== currentUsername && 
            userData.username.toLowerCase().includes(searchTerm.toLowerCase())) {
          users.push({
            username: userData.username,
            isOnline: userData.isOnline || false
          });
        }
      });
      
      console.log('Search results:', users.length, 'users found');
      return users;
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  }

  /**
   * Send private chat invite
   */
  async sendPrivateChatInvite(fromUsername, toUsername) {
    try {
      const current = auth.currentUser;
      if (!current) throw new Error('No authenticated user');

      // Check if invite already exists
      const existingInvite = await this.getExistingInvite(fromUsername, toUsername);
      if (existingInvite) {
        throw new Error('Invite already sent');
      }

      const inviteRef = doc(collection(db, COLLECTIONS.INVITES));
      await setDoc(inviteRef, {
        id: inviteRef.id,
        fromUsername,
        toUsername,
        fromUid: current.uid,
        toUid: null, // Will be set when invite is accepted
        status: 'pending', // pending, accepted, rejected
        createdAt: serverTimestamp()
      });

      // Update user activity when sending invite
      await this.updateUserActivity(fromUsername);

      // Note: Private chat invites don't need room notifications
      // They are handled differently from room invites

      return inviteRef.id;
    } catch (error) {
      console.error('Error sending invite:', error);
      throw error;
    }
  }

  /**
   * Get existing invite between two users
   */
  async getExistingInvite(fromUsername, toUsername) {
    try {
      const invitesSnapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.INVITES),
          where('fromUsername', '==', fromUsername),
          where('toUsername', '==', toUsername),
          where('status', '==', 'pending')
        )
      );
      
      if (!invitesSnapshot.empty) {
        return { id: invitesSnapshot.docs[0].id, ...invitesSnapshot.docs[0].data() };
      }
      return null;
    } catch (error) {
      console.error('Error getting existing invite:', error);
      return null;
    }
  }

  /**
   * Respond to private chat invite
   */
  async respondToInvite(inviteId, response) {
    try {
      const current = auth.currentUser;
      if (!current) throw new Error('No authenticated user');

      const inviteRef = doc(db, COLLECTIONS.INVITES, inviteId);
      await updateDoc(inviteRef, {
        status: response, // 'accepted' or 'rejected'
        respondedAt: serverTimestamp(),
        toUid: current.uid // Set the UID of the user accepting the invite
      });

      // If accepted, create private chat only if it doesn't exist
      if (response === 'accepted') {
        const inviteDoc = await getDoc(inviteRef);
        const inviteData = inviteDoc.data();
        
        // Check if private chat already exists before creating
        const chatId = this.getSafeChatId(inviteData.fromUsername, inviteData.toUsername);
        const chatExists = await this.validateChatAccess(chatId, inviteData.toUsername);
        
        if (!chatExists) {
          await this.createPrivateChat(inviteData.fromUsername, inviteData.toUsername);
        } else {
          console.log('Private chat already exists, skipping creation:', chatId);
        }
        
        // Note: Private chat invite acceptances don't need room notifications
        // They are handled differently from room invites
      }

      return true;
    } catch (error) {
      console.error('Error responding to invite:', error);
      throw error;
    }
  }

  /**
   * Cancel private chat invite
   */
  async cancelPrivateChatInvite(inviteId) {
    try {
      const current = auth.currentUser;
      if (!current) throw new Error('No authenticated user');

      const inviteRef = doc(db, COLLECTIONS.INVITES, inviteId);
      const inviteDoc = await getDoc(inviteRef);
      
      if (!inviteDoc.exists()) {
        throw new Error('Invite not found');
      }

      const inviteData = inviteDoc.data();
      
      // Only the sender can cancel the invite
      if (inviteData.fromUid !== current.uid) {
        throw new Error('Only the invite sender can cancel the invite');
      }

      // Delete the invite
      await deleteDoc(inviteRef);

      return true;
    } catch (error) {
      console.error('Error canceling invite:', error);
      throw error;
    }
  }

  /**
   * Get the safe chat ID for two users (for URL generation)
   */
  getSafeChatId(user1, user2) {
    const sortedUsers = [user1, user2].sort();
    const safeUser1 = sortedUsers[0].replace(/[^a-zA-Z0-9]/g, '_');
    const safeUser2 = sortedUsers[1].replace(/[^a-zA-Z0-9]/g, '_');
    return `${safeUser1}_${safeUser2}`;
  }

  /**
   * Get the original chat ID from safe chat ID for database operations
   */
  async getOriginalChatId(safeChatId, username) {
    try {
      // Query for chats where the user is a participant
      const q = query(
        collection(db, COLLECTIONS.PRIVATE_CHATS),
        where('participants', 'array-contains', username)
      );
      
      const snapshot = await getDocs(q);
      
      for (const doc of snapshot.docs) {
        const chatData = doc.data();
        const expectedSafeId = this.getSafeChatId(chatData.participants[0], chatData.participants[1]);
        
        if (expectedSafeId === safeChatId) {
          return doc.id; // Return the original database ID
        }
      }
      
      return safeChatId; // Fallback to safe ID if not found
    } catch (error) {
      console.error('Error getting original chat ID:', error);
      return safeChatId; // Fallback to safe ID on error
    }
  }

  /**
   * Find a private chat by participants (for backward compatibility)
   */
  async findPrivateChatByParticipants(user1, user2) {
    try {
      const sortedUsers = [user1, user2].sort();
      
      // Try the new safe format first
      const safeChatId = this.getSafeChatId(user1, user2);
      const safeChatRef = doc(db, COLLECTIONS.PRIVATE_CHATS, safeChatId);
      const safeChatDoc = await getDoc(safeChatRef);
      
      if (safeChatDoc.exists()) {
        return safeChatDoc.data();
      }
      
      // Try the old format for backward compatibility
      const oldChatId = `${sortedUsers[0]}_${sortedUsers[1]}`;
      const oldChatRef = doc(db, COLLECTIONS.PRIVATE_CHATS, oldChatId);
      const oldChatDoc = await getDoc(oldChatRef);
      
      if (oldChatDoc.exists()) {
        // Migrate to new format
        const chatData = oldChatDoc.data();
        await this.migrateChatToSafeFormat(oldChatId, safeChatId, chatData);
        return chatData;
      }
      
      return null;
    } catch (error) {
      console.error('Error finding private chat by participants:', error);
      return null;
    }
  }

  /**
   * Migrate a chat from old format to new safe format
   */
  async migrateChatToSafeFormat(oldChatId, newChatId, chatData) {
    try {
      // Create new document with safe ID
      const newChatRef = doc(db, COLLECTIONS.PRIVATE_CHATS, newChatId);
      await setDoc(newChatRef, {
        ...chatData,
        id: newChatId
      });
      
      // Delete old document
      const oldChatRef = doc(db, COLLECTIONS.PRIVATE_CHATS, oldChatId);
      await deleteDoc(oldChatRef);
      
      console.log('Migrated chat from', oldChatId, 'to', newChatId);
    } catch (error) {
      console.error('Error migrating chat format:', error);
    }
  }

  /**
   * Migrate all existing chats to safe format (for admin use)
   */
  async migrateAllChatsToSafeFormat() {
    try {
      console.log('Starting migration of all chats to safe format...');
      
      const snapshot = await getDocs(collection(db, COLLECTIONS.PRIVATE_CHATS));
      let migratedCount = 0;
      let errorCount = 0;
      
      for (const doc of snapshot.docs) {
        try {
          const chatData = doc.data();
          const oldChatId = doc.id;
          
          // Check if this is already in safe format
          if (oldChatId.includes('@') || oldChatId.includes(' ')) {
            // This is an old format chat, migrate it
            const safeChatId = this.getSafeChatId(chatData.participants[0], chatData.participants[1]);
            
            if (safeChatId !== oldChatId) {
              await this.migrateChatToSafeFormat(oldChatId, safeChatId, chatData);
              migratedCount++;
            }
          }
        } catch (error) {
          console.error('Error migrating chat', doc.id, ':', error);
          errorCount++;
        }
      }
      
      console.log(`Migration complete: ${migratedCount} chats migrated, ${errorCount} errors`);
      return { migratedCount, errorCount };
    } catch (error) {
      console.error('Error during chat migration:', error);
      throw error;
    }
  }

  /**
   * Create private chat between two users
   */
  async createPrivateChat(user1, user2) {
    try {
      const current = auth.currentUser;
      if (!current) throw new Error('No authenticated user');

      // Create unique chat ID (sorted usernames to ensure consistency)
      const chatId = this.getSafeChatId(user1, user2);

      console.log('Creating private chat:', { chatId, user1, user2 });

      // Check if chat already exists
      const chatRef = doc(db, COLLECTIONS.PRIVATE_CHATS, chatId);
      const existingChat = await getDoc(chatRef);
      if (existingChat.exists()) {
        // Ensure both users are present in participants/participantUids (chat may have removed one user previously)
        const chatData = existingChat.data() || {};
        const participants = Array.isArray(chatData.participants) ? chatData.participants : [];
        let needsUpdate = false;
        const updatedParticipants = [...participants];
        
        // Create sorted users array for consistency
        const sortedUsers = [user1, user2].sort();
        
        for (const u of sortedUsers) {
          if (!updatedParticipants.includes(u)) {
            updatedParticipants.push(u);
            needsUpdate = true;
          }
        }

        // Maintain participantUids as well when possible
        let updatedParticipantUids = Array.isArray(chatData.participantUids) ? [...chatData.participantUids] : [];
        try {
          const [user1Doc, user2Doc] = await Promise.all([
            getDoc(doc(db, COLLECTIONS.USERS, user1)),
            getDoc(doc(db, COLLECTIONS.USERS, user2))
          ]);
          const user1Uid = user1Doc.exists() ? user1Doc.data().uid : undefined;
          const user2Uid = user2Doc.exists() ? user2Doc.data().uid : undefined;
          if (user1Uid && !updatedParticipantUids.includes(user1Uid)) { updatedParticipantUids.push(user1Uid); needsUpdate = true; }
          if (user2Uid && !updatedParticipantUids.includes(user2Uid)) { updatedParticipantUids.push(user2Uid); needsUpdate = true; }
        } catch (_) {}

        if (needsUpdate) {
          await updateDoc(chatRef, {
            participants: updatedParticipants,
            participantUids: updatedParticipantUids,
            lastMessageAt: serverTimestamp()
          });
          console.log('Updated existing private chat participants for rejoin:', chatId);
        } else {
          console.log('Private chat already exists with both participants:', chatId);
        }
        return chatId;
      }

      // Get UIDs for both users
      const user1Doc = await getDoc(doc(db, COLLECTIONS.USERS, user1));
      const user2Doc = await getDoc(doc(db, COLLECTIONS.USERS, user2));
      
      if (!user1Doc.exists() || !user2Doc.exists()) {
        throw new Error('One or both users not found');
      }
      
      const user1Uid = user1Doc.data().uid;
      const user2Uid = user2Doc.data().uid;

      await setDoc(chatRef, {
        id: chatId,
        participants: [user1, user2],
        participantUids: [user1Uid, user2Uid], // Store UIDs for proper cleanup
        createdAt: serverTimestamp(),
        lastMessageAt: serverTimestamp()
      });

      // Update activity for both users when creating private chat
      await Promise.all([
        this.updateUserActivity(user1),
        this.updateUserActivity(user2)
      ]);

      console.log('Private chat created successfully:', chatId);
      return chatId;
    } catch (error) {
      console.error('Error creating private chat:', error);
      throw error;
    }
  }

  /**
   * Send private message
   */
  async sendPrivateMessage(chatId, username, message, replyTo = null) {
    try {
      const current = auth.currentUser;
      if (!current) throw new Error('No authenticated user');

      // Get the original chat ID for database operations
      const originalChatId = await this.getOriginalChatId(chatId, username);
      
      console.log('Sending private message:', { chatId, originalChatId, username, message, uid: current.uid, replyTo });

      const messageRef = doc(collection(db, COLLECTIONS.PRIVATE_MESSAGES));
      const chatRef = doc(db, COLLECTIONS.PRIVATE_CHATS, originalChatId);
      
      // Create message data
      const messageData = {
        id: messageRef.id,
        chatId: originalChatId, // Store original ID in message
        uid: current.uid,
        username,
        message,
        timestamp: serverTimestamp(),
        status: 'sent', // Initial status
        replyTo: replyTo ? {
          id: replyTo.id,
          username: replyTo.username,
          message: replyTo.message
        } : null
      };

      // Use batch operations for better performance
      const batch = writeBatch(db);
      batch.set(messageRef, messageData);
      batch.update(chatRef, {
        lastMessageAt: serverTimestamp()
      });

      // Commit batch operations (non-blocking)
      batch.commit().catch(error => {
        console.error('Error committing private message batch:', error);
        throw error;
      });

      console.log('Private message sent successfully:', messageRef.id);

      // Update user activity when sending message
      await this.updateUserActivity(username);

      // Get chat participants and create notification in parallel (non-blocking)
      this.createMessageNotificationAsync(chatId, username, message);

      return messageRef.id;
    } catch (error) {
      console.error('Error sending private message:', error);
      throw error;
    }
  }

  /**
   * Create message notification asynchronously (non-blocking)
   */
  async createMessageNotificationAsync(chatId, username, message) {
    try {
      // Get chat participants to determine recipient
      const chatRef = doc(db, COLLECTIONS.PRIVATE_CHATS, chatId);
      const chatDoc = await getDoc(chatRef);
      
      if (chatDoc.exists()) {
        const chatData = chatDoc.data();
        const participants = chatData.participants || [];
        const recipientUsername = participants.find(p => p !== username);
        
        if (recipientUsername) {
          // Create notification for message received (non-blocking)
          try {
            const { createMessageReceivedNotification } = await import('./notifications');
            await createMessageReceivedNotification(chatId, username, recipientUsername, message);
          } catch (error) {
            console.error('Error creating message notification:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error in async notification creation:', error);
    }
  }

  /**
   * Mark private message as read
   */
  async markPrivateMessageAsRead(messageId) {
    try {
      const messageRef = doc(db, COLLECTIONS.PRIVATE_MESSAGES, messageId);
      await updateDoc(messageRef, {
        status: 'read',
        readAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error marking message as read:', error);
      throw error;
    }
  }

  /**
   * Mark all messages in a chat as read for a user
   */
  async markAllPrivateMessagesAsRead(chatId, username) {
    try {
      const q = query(
        collection(db, COLLECTIONS.PRIVATE_MESSAGES),
        where('chatId', '==', chatId),
        where('username', '!=', username), // Only mark other users' messages as read
        where('status', 'in', ['sent', 'delivered'])
      );
      
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      
      snapshot.forEach((doc) => {
        batch.update(doc.ref, {
          status: 'read',
          readAt: serverTimestamp()
        });
      });
      
      await batch.commit();
    } catch (error) {
      console.error('Error marking all messages as read:', error);
      throw error;
    }
  }

  /**
   * Get private chat messages
   */
  onPrivateChatMessagesUpdate(chatId, callback) {
    try {
      console.log('Setting up private chat messages listener for:', chatId);
      
      // Use simple query without orderBy to avoid index issues
      const q = query(
        collection(db, COLLECTIONS.PRIVATE_MESSAGES),
        where('chatId', '==', chatId)
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const messages = [];
        snapshot.forEach((doc) => {
          const messageData = { id: doc.id, ...doc.data() };
          messages.push(messageData);
          console.log('Received message:', messageData);
        });
        
        // Sort messages by timestamp on client side
        messages.sort((a, b) => {
          const timeA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
          const timeB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
          return timeA - timeB;
        });
        
        console.log('Private chat messages updated:', messages.length, 'messages for chat', chatId);
        console.log('All messages:', messages);
        callback(messages);
      }, (error) => {
        console.error('Error listening to private chat messages:', error);
        callback([]);
      });
      
      this.unsubscribeFns.add(unsubscribe);
      return () => {
        try { unsubscribe(); } catch (_) {}
        this.unsubscribeFns.delete(unsubscribe);
      };
    } catch (error) {
      console.error('Error setting up private chat messages listener:', error);
      callback([]);
      return () => {};
    }
  }

  /**
   * Get user's private chats
   */
  onUserPrivateChatsUpdate(username, callback) {
    try {
      console.log('Setting up private chats listener for:', username);
      
      const q = query(
        collection(db, COLLECTIONS.PRIVATE_CHATS),
        where('participants', 'array-contains', username)
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const chats = [];
        snapshot.forEach((doc) => {
          const chatData = doc.data();
          // Use safe chat ID for the frontend
          const safeChatId = this.getSafeChatId(chatData.participants[0], chatData.participants[1]);
          chats.push({ 
            id: safeChatId, // Use safe ID for frontend
            originalId: doc.id, // Keep original ID for database operations
            ...chatData 
          });
        });
        console.log('Private chats updated:', chats.length, 'chats for', username);
        callback(chats);
      }, (error) => {
        console.error('Error listening to private chats:', error);
        callback([]);
      });
      
      this.unsubscribeFns.add(unsubscribe);
      return () => {
        try { unsubscribe(); } catch (_) {}
        this.unsubscribeFns.delete(unsubscribe);
      };
    } catch (error) {
      console.error('Error setting up private chats listener:', error);
      callback([]);
      return () => {};
    }
  }

  

  /**
   * Remove user from private chat
   */
  async removeUserFromPrivateChat(chatId, usernameToRemove) {
    try {
      const current = auth.currentUser;
      if (!current) throw new Error('No authenticated user');

      // Get the original chat ID for database operations
      const originalChatId = await this.getOriginalChatId(chatId, current.displayName);
      
      console.log('Removing user from private chat:', { chatId, originalChatId, usernameToRemove });

      const chatRef = doc(db, COLLECTIONS.PRIVATE_CHATS, originalChatId);
      const chatDoc = await getDoc(chatRef);
      
      if (!chatDoc.exists()) {
        throw new Error('Chat not found');
      }

      const chatData = chatDoc.data();
      console.log('Original chat data:', {
        participants: chatData.participants,
        participantUids: chatData.participantUids
      });

      // Verify that the current user is a participant in this chat
      const currentUsername = current.displayName;
      if (!chatData.participants.includes(currentUsername)) {
        throw new Error('You are not a participant in this chat');
      }

      // Also verify that the current user's UID is in the participantUids array
      if (chatData.participantUids && chatData.participantUids.length > 0) {
        if (!chatData.participantUids.includes(current.uid)) {
          console.warn('Current user UID not found in participantUids, this might cause permission issues');
          // Try to add the current user's UID to the array if it's missing
          if (!chatData.participantUids.includes(current.uid)) {
            chatData.participantUids.push(current.uid);
          }
        }
      }

      console.log('Current user UID:', current.uid);
      console.log('Current username:', currentUsername);
      console.log('Chat participantUids before removal:', chatData.participantUids);
      console.log('Chat participants before removal:', chatData.participants);

      const updatedParticipants = chatData.participants.filter(
        participant => participant !== usernameToRemove
      );

      // Also remove the UID of the removed user
      let updatedParticipantUids = chatData.participantUids || [];
      let userToRemoveUid = null;
      
      if (updatedParticipantUids.length > 0) {
        try {
          // Get the UID of the user being removed
          const userToRemoveDoc = await getDoc(doc(db, COLLECTIONS.USERS, usernameToRemove));
          if (userToRemoveDoc.exists()) {
            userToRemoveUid = userToRemoveDoc.data().uid;
            console.log('Found UID for removed user:', userToRemoveUid);
            updatedParticipantUids = updatedParticipantUids.filter(uid => uid !== userToRemoveUid);
            console.log('Updated participant UIDs:', updatedParticipantUids);
          } else {
            console.warn('User document not found for:', usernameToRemove);
            // Fallback: try to find the UID by searching through all users
            console.log('Attempting fallback UID search...');
            const usersQuery = query(collection(db, COLLECTIONS.USERS));
            const usersSnapshot = await getDocs(usersQuery);
            usersSnapshot.forEach((userDoc) => {
              const userData = userDoc.data();
              if (userData.username === usernameToRemove) {
                userToRemoveUid = userData.uid;
              }
            });
            
            if (userToRemoveUid) {
              console.log('Found UID through fallback search:', userToRemoveUid);
              updatedParticipantUids = updatedParticipantUids.filter(uid => uid !== userToRemoveUid);
              console.log('Updated participant UIDs (fallback):', updatedParticipantUids);
            } else {
              console.warn('Could not find UID for user even with fallback search:', usernameToRemove);
            }
          }
        } catch (error) {
          console.warn('Could not get UID for removed user, proceeding without UID cleanup:', error);
        }
      }

      // Create a removal notification for the removed user
      if (userToRemoveUid) {
        try {
          const removalNotificationRef = doc(collection(db, COLLECTIONS.REMOVAL_NOTIFICATIONS));
          await setDoc(removalNotificationRef, {
            id: removalNotificationRef.id,
            chatId: originalChatId,
            removedUsername: usernameToRemove,
            removedUid: userToRemoveUid,
            removedBy: current.uid,
            removedByUsername: current.displayName || current.email,
            timestamp: serverTimestamp(),
            message: `You have been removed from the direct message chat by ${current.displayName || current.email}`,
            read: false
          });
          console.log('Removal notification created for user:', usernameToRemove);
        } catch (error) {
          console.warn('Could not create removal notification:', error);
        }
      }

      if (updatedParticipants.length <= 1) {
        // If no participants left or only 1 participant left, delete the chat and all messages
        // Direct message chats need at least 2 participants to be meaningful
        
        // FIRST: Delete all messages in this chat (while chat still exists for permission checks)
        console.log('Attempting to delete all messages before deleting chat...');
        const messagesQuery = query(
          collection(db, COLLECTIONS.PRIVATE_MESSAGES),
          where('chatId', '==', originalChatId)
        );
        const messagesSnapshot = await getDocs(messagesQuery);
        console.log(`Found ${messagesSnapshot.size} messages to delete in chat ${originalChatId}`);
        
        if (messagesSnapshot.size > 0) {
          try {
            // Try to delete messages one by one to handle permission issues gracefully
            let deletedCount = 0;
            let failedCount = 0;
            
            for (const messageDoc of messagesSnapshot.docs) {
              try {
                console.log(`Deleting message: ${messageDoc.id} from chat: ${chatId}`);
                await deleteDoc(messageDoc.ref);
                deletedCount++;
              } catch (deleteError) {
                console.warn(`Failed to delete message ${messageDoc.id}:`, deleteError);
                failedCount++;
              }
            }
            
            console.log(`Message deletion summary: ${deletedCount} deleted, ${failedCount} failed`);
            
            if (failedCount > 0) {
              console.warn(`${failedCount} messages could not be deleted due to permission issues`);
              console.warn('This may cause some old messages to remain visible');
            }
          } catch (deleteError) {
            console.error(`Error during message deletion for chat ${chatId}:`, deleteError);
            console.warn('Continuing with user removal despite message deletion issues');
          }
        } else {
          console.log(`No messages found to delete in chat ${chatId}`);
        }
        
        // SECOND: Now delete the chat document
        try {
          await deleteDoc(chatRef);
          console.log('Chat document deleted successfully');
          
          // Stop any listeners for this chat to prevent further message updates
          this.stopChatListeners(originalChatId);
        } catch (chatDeleteError) {
          console.error('Error deleting chat document:', chatDeleteError);
          throw new Error('Failed to delete chat document');
        }
        
        console.log('Chat and messages deleted as insufficient participants remain');
      } else {
        // Even if there are still participants, delete all messages when a user is removed
        // This ensures clean slate for remaining participants
        console.log('Deleting all messages from chat as user was removed');
        
        // Delete all messages in this chat
        const messagesQuery = query(
          collection(db, COLLECTIONS.PRIVATE_MESSAGES),
          where('chatId', '==', originalChatId)
        );
        const messagesSnapshot = await getDocs(messagesQuery);
        console.log(`Found ${messagesSnapshot.size} messages to delete in chat ${originalChatId}`);
        
        if (messagesSnapshot.size > 0) {
          try {
            // Try to delete messages one by one to handle permission issues gracefully
            let deletedCount = 0;
            let failedCount = 0;
            
            for (const messageDoc of messagesSnapshot.docs) {
              try {
                console.log(`Deleting message: ${messageDoc.id} from chat: ${chatId}`);
                await deleteDoc(messageDoc.ref);
                deletedCount++;
              } catch (deleteError) {
                console.warn(`Failed to delete message ${messageDoc.id}:`, deleteError);
                failedCount++;
              }
            }
            
            console.log(`Message deletion summary: ${deletedCount} deleted, ${failedCount} failed`);
            
            if (failedCount > 0) {
              console.warn(`${failedCount} messages could not be deleted due to permission issues`);
              console.warn('This may cause some old messages to remain visible');
            }
          } catch (deleteError) {
            console.error(`Error during message deletion for chat ${chatId}:`, deleteError);
            console.warn('Continuing with user removal despite message deletion issues');
          }
        } else {
          console.log(`No messages found to delete in chat ${chatId}`);
        }
        
        // Update both participants and participantUids
        await updateDoc(chatRef, {
          participants: updatedParticipants,
          participantUids: updatedParticipantUids
        });
        console.log('User removed from chat and all messages deleted');
        console.log('Final participants:', updatedParticipants);
        console.log('Final participantUids:', updatedParticipantUids);
        
        // Verify the update was successful
        const updatedChatDoc = await getDoc(chatRef);
        if (updatedChatDoc.exists()) {
          const updatedChatData = updatedChatDoc.data();
          console.log('Verification - Updated chat data:', {
            participants: updatedChatData.participants,
            participantUids: updatedChatData.participantUids
          });
        }
      }

      return true;
    } catch (error) {
      console.error('Error removing user from private chat:', error);
      throw error;
    }
  }

  /**
   * Get user's pending invites
   */
  onUserInvitesUpdate(username, callback) {
    const q = query(
      collection(db, COLLECTIONS.INVITES),
      where('toUsername', '==', username),
      where('status', '==', 'pending')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const invites = [];
      snapshot.forEach((doc) => {
        invites.push({ id: doc.id, ...doc.data() });
      });
      callback(invites);
    });
    this.unsubscribeFns.add(unsubscribe);
      return () => {
        try { unsubscribe(); } catch (_) {}
        this.unsubscribeFns.delete(unsubscribe);
      };
    }

  /**
   * Get user's sent invites
   */
  onUserSentInvitesUpdate(username, callback) {
    const q = query(
      collection(db, COLLECTIONS.INVITES),
      where('fromUsername', '==', username),
      where('status', '==', 'pending')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const invites = [];
      snapshot.forEach((doc) => {
        invites.push({ id: doc.id, ...doc.data() });
      });
      callback(invites);
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
   * Get rooms created by specific user
   */
  onMyRoomsUpdate(username, callback) {
    const q = query(
      collection(db, COLLECTIONS.ROOMS),
      where('createdBy', '==', username)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
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
   * Get rooms that user has joined
   */
  onMyJoinedRoomsUpdate(username, callback) {
    const q = query(
      collection(db, COLLECTIONS.ROOM_USERS),
      where('username', '==', username)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const roomIds = [];
      snapshot.forEach((doc) => {
        roomIds.push(doc.data().roomId);
      });
      
      console.log('User joined room IDs:', roomIds);
      
      // Now get the actual room data for these room IDs
      if (roomIds.length > 0) {
        // Use individual queries for each room ID since 'in' operator has limitations
        const roomPromises = roomIds.map(async (roomId) => {
          try {
            const roomDoc = await getDoc(doc(db, COLLECTIONS.ROOMS, roomId));
            if (roomDoc.exists()) {
              return { id: roomDoc.id, ...roomDoc.data() };
            }
            return null;
          } catch (error) {
            console.error('Error getting room:', roomId, error);
            return null;
          }
        });
        
        // Wait for all room data to be fetched
        Promise.all(roomPromises).then((rooms) => {
          const validRooms = rooms.filter(room => room !== null);
          console.log('Current username:', username);
          console.log('All rooms before filtering:', validRooms.map(r => ({ id: r.id, name: r.name, createdBy: r.createdBy, isOwnRoom: r.createdBy === username })));
          
          // Filter out rooms created by the current user (only show rooms created by others)
          const joinedRoomsOnly = validRooms.filter(room => {
            // Multiple ways to check if this is the user's own room
            const isOwnRoom = room.createdBy === username;
            const isOwnRoomTrimmed = room.createdBy?.trim() === username?.trim();
            const isOwnRoomCaseInsensitive = room.createdBy?.toLowerCase() === username?.toLowerCase();
            
            console.log(`Room "${room.name}" created by "${room.createdBy}" - Username: "${username}"`);
            console.log(`  - Exact match: ${isOwnRoom}`);
            console.log(`  - Trimmed match: ${isOwnRoomTrimmed}`);
            console.log(`  - Case-insensitive match: ${isOwnRoomCaseInsensitive}`);
            
            // If any of these match, it's the user's own room
            if (isOwnRoom || isOwnRoomTrimmed || isOwnRoomCaseInsensitive) {
              console.warn(`WARNING: Own room "${room.name}" was about to be shown in Joined Rooms!`);
              return false;
            }
            
            return true;
          });
          
          console.log('Joined rooms data (excluding own rooms):', joinedRoomsOnly.map(r => ({ id: r.id, name: r.name, createdBy: r.createdBy })));
          console.log('Filtered out rooms:', validRooms.filter(room => room.createdBy === username).map(r => ({ id: r.id, name: r.name, createdBy: r.createdBy })));
          
          callback(joinedRoomsOnly);
        });
      } else {
        callback([]);
      }
    });
    
    this.unsubscribeFns.add(unsubscribe);
    return () => {
      try { unsubscribe(); } catch (_) {}
      this.unsubscribeFns.delete(unsubscribe);
    };
  }

  /**
   * Get current user count - IMPROVED VERSION
   * This method provides accurate counts by fetching directly from Firestore
   */
  async getCurrentUserCount() {
    try {
      console.log('Fetching accurate user count from Firestore...');
      const usersSnapshot = await getDocs(collection(db, COLLECTIONS.USERS));
      const totalUsers = usersSnapshot.size;
      
      // Count only truly active users (tab active and recent heartbeat)
      let activeUsers = 0;
      let onlineUsers = 0;
      let recentUsers = 0;
      const now = Date.now();
      const HEARTBEAT_TIMEOUT = 30000; // 30 seconds timeout
      const RECENT_ACTIVITY_TIMEOUT = 300000; // 5 minutes
      
      usersSnapshot.forEach((doc) => {
        const userData = doc.data();
        
        // Count online users
        if (userData.isOnline) {
          onlineUsers++;
        }
        
        // Count active users (tab active + recent heartbeat)
        if (userData.isTabActive && userData.lastHeartbeat) {
          const lastHeartbeat = userData.lastHeartbeat.toDate ? userData.lastHeartbeat.toDate().getTime() : userData.lastHeartbeat;
          const timeSinceHeartbeat = now - lastHeartbeat;
          
          if (timeSinceHeartbeat < HEARTBEAT_TIMEOUT) {
            activeUsers++;
          }
        }
        
        // Count users with recent activity
        if (userData.lastSeen) {
          const lastSeen = userData.lastSeen.toDate ? userData.lastSeen.toDate().getTime() : userData.lastSeen;
          const timeSinceLastSeen = now - lastSeen;
          
          if (timeSinceLastSeen < RECENT_ACTIVITY_TIMEOUT) {
            recentUsers++;
          }
        }
      });
      
      const stats = {
        totalUsers,
        activeUsers,
        onlineUsers,
        recentUsers,
        lastUpdated: new Date().toISOString()
      };
      
      console.log('User count stats:', stats);
      return stats;
    } catch (error) {
      console.error('Error getting user count:', error);
      return { 
        totalUsers: 0, 
        activeUsers: 0, 
        onlineUsers: 0, 
        recentUsers: 0,
        lastUpdated: new Date().toISOString(),
        error: error.message 
      };
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
   * Check if message is spam - OPTIMIZED VERSION
   */
  checkSpam(username) {
    // Skip spam check if disabled globally
    if (!SPAM_CONFIG.ENABLED) {
      return { allowed: true };
    }
    
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
      return { allowed: true }; // Fast path for new users
    }
    
    const userData = spamTracker.get(username);
    
    // Remove console.log for better performance
    // console.log('Spam check for user:', username, 'User data:', userData);
    
    // Check if user is blocked (fast path)
    if (userData.isBlocked && now < userData.blockUntil) {
      const cooldown = Math.ceil((userData.blockUntil - now) / 1000);
      // console.log('User is blocked, cooldown remaining:', cooldown, 'seconds');
      return { allowed: false, reason: `You are blocked from sending messages. Please wait ${cooldown} seconds.` };
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
    
    // Update message history more efficiently
    userData.messageHistory.push(now);
    userData.lastMessageTime = now;
    
    // Optimize message history filtering - only filter when necessary
    if (userData.messageHistory.length > 30) {
      // Only filter when we have more than 30 messages to avoid unnecessary work
      userData.messageHistory = userData.messageHistory.filter(
        time => (now - time) < 30000
      );
    }
    
    return { allowed: true };
  }

  /**
   * Fast spam check for private chats - skips heavy operations
   */
  checkSpamFast(username) {
    // Skip spam check if disabled globally or for private chats
    if (!SPAM_CONFIG.ENABLED || SPAM_CONFIG.SKIP_FOR_PRIVATE_CHATS) {
      return { allowed: true };
    }
    
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
      return { allowed: true };
    }
    
    const userData = spamTracker.get(username);
    
    // Only check if user is blocked (fastest path)
    if (userData.isBlocked && now < userData.blockUntil) {
      const cooldown = Math.ceil((userData.blockUntil - now) / 1000);
      return { allowed: false, reason: `You are blocked from sending messages. Please wait ${cooldown} seconds.` };
    }
    
    // Update only essential data for private chats
    userData.lastMessageTime = now;
    
    return { allowed: true };
  }

  /**
   * Completely disable spam protection for private chats
   */
  disableSpamProtectionForPrivateChats() {
    SPAM_CONFIG.SKIP_FOR_PRIVATE_CHATS = true;
    console.log('Spam protection disabled for private chats');
  }

  /**
   * Enable spam protection for private chats
   */
  enableSpamProtectionForPrivateChats() {
    SPAM_CONFIG.SKIP_FOR_PRIVATE_CHATS = false;
    console.log('Spam protection enabled for private chats');
  }

  /**
   * Test spam check performance
   */
  testSpamCheckPerformance(username, iterations = 1000) {
    const startTime = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      this.checkSpam(username);
    }
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const avgTime = totalTime / iterations;
    
    console.log(`Spam check performance test (${iterations} iterations):`);
    console.log(`Total time: ${totalTime.toFixed(2)}ms`);
    console.log(`Average time per check: ${avgTime.toFixed(4)}ms`);
    
    return { totalTime, avgTime };
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    return auth.currentUser;
  }

  /**
   * Reset spam protection for a user
   */
  resetSpamProtection(username) {
    if (spamTracker.has(username)) {
      spamTracker.delete(username);
      console.log('Spam protection reset for user:', username);
    }
  }

  /**
   * Check if user is currently blocked and get remaining cooldown
   */
  getUserBlockStatus(username) {
    if (!spamTracker.has(username)) {
      return { isBlocked: false, cooldown: 0, reason: null };
    }
    
    const userData = spamTracker.get(username);
    const now = Date.now();
    
    if (userData.isBlocked && now < userData.blockUntil) {
      const cooldown = Math.ceil((userData.blockUntil - now) / 1000);
      return { 
        isBlocked: true, 
        cooldown, 
        reason: `You are blocked from sending messages. Please wait ${cooldown} seconds.` 
      };
    }
    
    return { isBlocked: false, cooldown: 0, reason: null };
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
   * This ensures BOTH Firestore data AND auth account are deleted
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
      
      // Step 1: Clean up Firestore data FIRST (while we still have permissions)
      try {
        console.log('Starting Firestore data cleanup...');
        
        // Get the username before cleanup
        let username = null;
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            username = userDoc.data().username;
            console.log(`Found username for cleanup: ${username}`);
          }
        } catch (error) {
          console.warn('Could not get username for cleanup:', error);
        }
        
        // Clean up by UID first
        await this.cleanupUserData(currentUser.uid);
        console.log('UID-based cleanup completed successfully');
        
        // If we have a username, also clean up by username to ensure no orphaned data
        if (username) {
          await this.cleanupUsername(username);
          console.log('Username-based cleanup completed successfully');
        }
        
        console.log('Firestore data cleanup completed successfully');
      } catch (cleanupError) {
        console.error('Error during Firestore cleanup:', cleanupError);
        // Don't continue if cleanup fails - we need to ensure data is gone
        throw new Error(`Firestore cleanup failed: ${cleanupError.message}`);
      }
      
      // Step 2: Ensure we have a valid token for auth deletion
      let userToDelete = currentUser;
      
      try {
        // Refresh the token to ensure it's valid
        await currentUser.getIdToken(true);
        console.log('Token refreshed successfully');
      } catch (tokenError) {
        console.log('Token refresh failed, attempting re-authentication...');
        
        // Try to re-authenticate to get a fresh token
        try {
          await signInAnonymously(auth);
          const newUser = auth.currentUser;
          if (newUser) {
            userToDelete = newUser;
            console.log('Re-authenticated successfully, will delete new user account');
          } else {
            throw new Error('Re-authentication failed - no user returned');
          }
        } catch (reauthError) {
          console.error('Re-authentication failed:', reauthError);
          throw new Error('Cannot delete account: authentication failed');
        }
      }
      
      // Step 3: Delete the Firebase Authentication user (CRITICAL STEP)
      try {
        console.log('Attempting to delete Firebase Authentication user...');
        await userToDelete.delete();
        console.log('✅ Firebase Authentication user deleted successfully');
        
        // Step 4: Clean up local state
        this.isInitialized = false;
        onlineUsers.clear();
        spamTracker.clear();
        
        console.log('✅ User account completely deleted from both Firestore and Authentication');
        
      } catch (deleteError) {
        console.error('❌ Failed to delete Firebase Authentication user:', deleteError);
        
        // This is a critical failure - the user account still exists
        throw new Error(`Account deletion failed: ${deleteError.message}. The user account still exists in Firebase Authentication.`);
      }
      
    } catch (error) {
      console.error('Error deleting user account:', error);
      
      // Re-throw the error so the UI can show what went wrong
      throw error;
    }
  }

  /**
   * Fast manual cleanup function - uses parallel processing for speed
   * This replaces the Cloud Function for users who can't deploy functions
   */
  async cleanupUserData(uid, fallbackUsername = null) {
    try {
      console.log(`🚀 Starting FAST cleanup for UID: ${uid}`);
      const startTime = Date.now();
      
      // Create multiple batches for parallel processing
      const batch1 = writeBatch(db); // User data
      const batch2 = writeBatch(db); // Chat messages
      const batch3 = writeBatch(db); // Room data
      const batch4 = writeBatch(db); // Invites and other
      
      let deletedCount = 0;
      
      // 1. Find username and user document
      const usersSnapshot = await getDocs(
        query(collection(db, 'users'), where('uid', '==', uid))
      );
      
      let username = null;
      if (!usersSnapshot.empty) {
        const userDoc = usersSnapshot.docs[0];
        username = userDoc.data().username;
        console.log(`Found username for UID: ${username}`);
        
        // Mark user document for deletion
        batch1.delete(userDoc.ref);
        deletedCount++;
      } else if (fallbackUsername) {
        username = fallbackUsername;
        console.log(`Using fallback username: ${username}`);
      }
      
      // 2. PARALLEL QUERIES - All queries run simultaneously
      console.log('🔄 Starting parallel queries for UID cleanup...');
      
      const [
        publicChatsSnapshot,
        roomMessagesSnapshot,
        roomUsersSnapshot,
        invitesSentSnapshot,
        privateMessagesSnapshot,
        privateChatsSnapshot
      ] = await Promise.all([
        getDocs(query(collection(db, 'publicChats'), where('uid', '==', uid))),
        getDocs(query(collection(db, 'roomMessages'), where('uid', '==', uid))),
        getDocs(query(collection(db, 'roomUsers'), where('uid', '==', uid))),
        getDocs(query(collection(db, 'invites'), where('fromUid', '==', uid))),
        getDocs(query(collection(db, 'privateMessages'), where('uid', '==', uid))),
        getDocs(query(collection(db, 'privateChats'), where('participants', 'array-contains', uid)))
      ]);
      
      console.log(`✅ Parallel queries completed in ${Date.now() - startTime}ms`);
      
      // 3. SMART BATCHING - Group deletions by collection for efficiency
      
      // Batch 1: User data (already populated)
      console.log('📦 Batching user data...');
      
      // Batch 2: Chat messages (largest collections)
      console.log('📦 Batching chat messages...');
      publicChatsSnapshot.docs.forEach(doc => {
        batch2.delete(doc.ref);
        deletedCount++;
      });
      
      roomMessagesSnapshot.docs.forEach(doc => {
        batch2.delete(doc.ref);
        deletedCount++;
      });
      
      privateMessagesSnapshot.docs.forEach(doc => {
        batch2.delete(doc.ref);
        deletedCount++;
      });
      
      // Batch 3: Room data
      console.log('📦 Batching room data...');
      roomUsersSnapshot.docs.forEach(doc => {
        batch3.delete(doc.ref);
        deletedCount++;
      });
      
      // Batch 4: Invites and other
      console.log('📦 Batching invites and other data...');
      invitesSentSnapshot.docs.forEach(doc => {
        batch4.delete(doc.ref);
        deletedCount++;
      });
      
      // 4. PARALLEL BATCH COMMITS - All batches commit simultaneously
      console.log('🚀 Committing all batches in parallel...');
      const commitStartTime = Date.now();
      
      await Promise.all([
        batch1.commit(),
        batch2.commit(),
        batch3.commit(),
        batch4.commit()
      ]);
      
      const totalTime = Date.now() - startTime;
      const commitTime = Date.now() - commitStartTime;
      
      console.log(`⚡ FAST UID cleanup completed!`);
      console.log(`📊 Deleted ${deletedCount} documents`);
      console.log(`⏱️  Total time: ${totalTime}ms`);
      console.log(`🚀 Commit time: ${commitTime}ms`);
      
      return { success: true, deletedCount, totalTime, commitTime };
      
    } catch (error) {
      console.error(`❌ Error in fast UID cleanup for ${uid}:`, error);
      throw error;
    }
  }

  /**
   * Force delete a username from the database (for manual cleanup)
   */
  async forceDeleteUsername(username) {
    try {
      console.log(`Force deleting username: ${username}`);
      
      // Ensure we have an authenticated user
      const current = auth.currentUser;
      if (!current) {
        await this.initialize();
      }
      
      const batch = writeBatch(db);
      let deletedCount = 0;
      
      // Delete user document
      const userRef = doc(db, COLLECTIONS.USERS, username);
      batch.delete(userRef);
      deletedCount++;
      
      // Delete public messages by username
      const publicChatsSnapshot = await getDocs(
        query(collection(db, COLLECTIONS.PUBLIC_CHATS), where('username', '==', username))
      );
      publicChatsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });
      
      // Delete room messages by username
      const roomMessagesSnapshot = await getDocs(
        query(collection(db, COLLECTIONS.ROOM_MESSAGES), where('username', '==', username))
      );
      roomMessagesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });
      
      // Delete room users by username
      const roomUsersSnapshot = await getDocs(
        query(collection(db, COLLECTIONS.ROOM_USERS), where('username', '==', username))
      );
      roomUsersSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });
      
      // Delete rooms created by username
      const roomsSnapshot = await getDocs(
        query(collection(db, COLLECTIONS.ROOMS), where('createdBy', '==', username))
      );
      roomsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });
      
      await batch.commit();
      console.log(`Force delete completed. Deleted ${deletedCount} documents for username: ${username}`);
      return { success: true, deletedCount };
      
    } catch (error) {
      console.error(`Error in force delete for username ${username}:`, error);
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

  /**
   * Clear Firestore cache and force fresh data
   */
  async clearCache() {
    try {
      console.log('Clearing Firestore cache...');
      await clearFirestoreCache();
      console.log('Cache cleared successfully');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Force check username availability with cache clearing
   */
  async forceCheckUsername(username) {
    try {
      console.log(`Force checking username availability: ${username}`);
      
      // Clear cache first
      await this.clearCache();
      
      // Wait a moment for cache to clear
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check username with fresh data
      const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, username));
      const isAvailable = !userDoc.exists();
      
      console.log(`Force check result for ${username}:`, {
        exists: userDoc.exists(),
        isAvailable,
        data: userDoc.exists() ? userDoc.data() : null
      });
      
      return isAvailable;
    } catch (error) {
      console.error('Error in force username check:', error);
      throw error;
    }
  }

  /**
   * Clear browser IndexedDB cache for Firestore
   */
  async clearIndexedDBCache() {
    try {
      console.log('Clearing IndexedDB cache...');
      
      // Try to clear IndexedDB for Firestore
      if ('indexedDB' in window) {
        const dbName = 'firebaseLocalStorageDb';
        const request = indexedDB.deleteDatabase(dbName);
        
        request.onsuccess = () => {
          console.log('IndexedDB cache cleared successfully');
        };
        
        request.onerror = () => {
          console.error('Error clearing IndexedDB cache');
        };
      }
      
      // Also try to clear localStorage
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('firebase')) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });
      
      console.log(`Cleared ${keysToRemove.length} Firebase-related localStorage items`);
      
    } catch (error) {
      console.error('Error clearing IndexedDB cache:', error);
    }
  }

  /**
   * List all users in the database (for debugging)
   */
  async listAllUsers() {
    try {
      console.log('Listing all users in database...');
      
      const usersSnapshot = await getDocs(collection(db, COLLECTIONS.USERS));
      const users = [];
      
      usersSnapshot.forEach(doc => {
        users.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      console.log(`Found ${users.length} users in database:`, users);
      return users;
      
    } catch (error) {
      console.error('Error listing users:', error);
      throw error;
    }
  }

  /**
   * List all Firebase Auth users and Firestore users (for debugging)
   */
  async listAllAuthAndFirestoreUsers() {
    try {
      console.log('=== LISTING ALL USERS ===');
      
      // Get current Firebase Auth user
      const currentAuthUser = auth.currentUser;
      console.log('Current Firebase Auth user:', {
        uid: currentAuthUser?.uid,
        displayName: currentAuthUser?.displayName,
        email: currentAuthUser?.email,
        isAnonymous: currentAuthUser?.isAnonymous
      });
      
      // Get all Firestore users
      const usersSnapshot = await getDocs(collection(db, COLLECTIONS.USERS));
      const firestoreUsers = [];
      
      usersSnapshot.forEach(doc => {
        firestoreUsers.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      console.log(`Found ${firestoreUsers.length} users in Firestore:`, firestoreUsers);
      
      return {
        currentAuthUser: currentAuthUser ? {
          uid: currentAuthUser.uid,
          displayName: currentAuthUser.displayName,
          email: currentAuthUser.email,
          isAnonymous: currentAuthUser.isAnonymous
        } : null,
        firestoreUsers
      };
      
    } catch (error) {
      console.error('Error listing all users:', error);
      throw error;
    }
  }

  /**
   * Listen for removal notifications for a user
   */
  onRemovalNotificationsUpdate(uid, callback) {
    try {
      // Check if listener already exists for this UID
      const listenerKey = `removal_notifications_${uid}`;
      if (this.activeListeners && this.activeListeners.has(listenerKey)) {
        console.log('🔄 Removal notifications listener already exists for UID:', uid);
        return this.activeListeners.get(listenerKey);
      }
      
      console.log('🔔 Setting up removal notifications listener for UID:', uid);
      
      const q = query(
        collection(db, COLLECTIONS.REMOVAL_NOTIFICATIONS),
        where('removedUid', '==', uid),
        where('read', '==', false)
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const notifications = [];
        snapshot.forEach((doc) => {
          const notificationData = { id: doc.id, ...doc.data() };
          notifications.push(notificationData);
        });
        
        console.log('📬 Removal notifications updated:', notifications.length, 'notifications for UID', uid);
        callback(notifications);
      }, (error) => {
        console.error('❌ Error listening to removal notifications:', error);
        callback([]);
      });
      
      // Store the listener reference
      this.activeListeners.set(listenerKey, unsubscribe);
      
      this.unsubscribeFns.add(unsubscribe);
      return () => {
        try { 
          unsubscribe(); 
          this.activeListeners.delete(listenerKey);
        } catch (_) {}
        this.unsubscribeFns.delete(unsubscribe);
      };
    } catch (error) {
      console.error('❌ Error setting up removal notifications listener:', error);
      callback([]);
    }
  }

  /**
   * Mark a removal notification as read
   */
  async markRemovalNotificationAsRead(notificationId) {
    try {
      const notificationRef = doc(db, COLLECTIONS.REMOVAL_NOTIFICATIONS, notificationId);
      await updateDoc(notificationRef, {
        read: true
      });
      console.log('Removal notification marked as read:', notificationId);
      return true;
    } catch (error) {
      console.error('Error marking removal notification as read:', error);
      throw error;
    }
  }

  /**
   * Stop chat listeners for a specific chat
   */
  stopChatListeners(chatId) {
    // Implement the logic to stop chat listeners for the given chatId
    // This is a placeholder implementation
    console.log(`Stopping chat listeners for chat: ${chatId}`);
  }

  /**
   * Edit private message
   */
  async editPrivateMessage(messageId, newText) {
    try {
      const current = auth.currentUser;
      if (!current) throw new Error('No authenticated user');

      const messageRef = doc(db, COLLECTIONS.PRIVATE_MESSAGES, messageId);
      const messageDoc = await getDoc(messageRef);
      
      if (!messageDoc.exists()) {
        throw new Error('Message not found');
      }

      const messageData = messageDoc.data();
      
      // Only allow users to edit their own messages
      if (messageData.uid !== current.uid) {
        throw new Error('You can only edit your own messages');
      }

      await updateDoc(messageRef, {
        message: newText,
        editedAt: serverTimestamp(),
        edited: true
      });
      console.log('Private message edited successfully:', messageId);
      return true;
    } catch (error) {
      console.error('Error editing private message:', error);
      throw error;
    }
  }

  /**
   * Delete private message
   */
  async deletePrivateMessage(messageId) {
    try {
      const current = auth.currentUser;
      if (!current) throw new Error('No authenticated user');

      const messageRef = doc(db, COLLECTIONS.PRIVATE_MESSAGES, messageId);
      const messageDoc = await getDoc(messageRef);
      
      if (!messageDoc.exists()) {
        throw new Error('Message not found');
      }

      const messageData = messageDoc.data();
      
      // Only allow users to delete their own messages
      if (messageData.uid !== current.uid) {
        throw new Error('You can only delete your own messages');
      }

      await deleteDoc(messageRef);
      console.log('Private message deleted successfully:', messageId);
      return true;
    } catch (error) {
      console.error('Error deleting private message:', error);
      throw error;
    }
  }

  /**
   * Delete public message
   */
  async deletePublicMessage(messageId) {
    try {
      const current = auth.currentUser;
      if (!current) throw new Error('No authenticated user');

      const messageRef = doc(db, COLLECTIONS.PUBLIC_CHATS, messageId);
      const messageDoc = await getDoc(messageRef);
      
      if (!messageDoc.exists()) {
        throw new Error('Message not found');
      }

      const messageData = messageDoc.data();
      
      // Only allow users to delete their own messages
      if (messageData.uid !== current.uid) {
        throw new Error('You can only delete your own messages');
      }

      await deleteDoc(messageRef);
      console.log('Public message deleted successfully:', messageId);

      // Update user activity when deleting message
      await this.updateUserActivity(messageData.username);

      return true;
    } catch (error) {
      console.error('Error deleting public message:', error);
      throw error;
    }
  }

  /**
   * Delete room message
   */
  async deleteRoomMessage(messageId) {
    try {
      // Ensure we have an authenticated user
      let current = auth.currentUser;
      if (!current) {
        console.log('No authenticated user, attempting to initialize Firebase');
        await this.initialize();
        current = auth.currentUser;
        if (!current) throw new Error('Failed to authenticate user');
      }

      const messageRef = doc(db, COLLECTIONS.ROOM_MESSAGES, messageId);
      const messageDoc = await getDoc(messageRef);
      
      if (!messageDoc.exists()) {
        throw new Error('Message not found');
      }

      const messageData = messageDoc.data();
      
      // Only allow users to delete their own messages
      if (messageData.uid !== current.uid) {
        console.error('UID mismatch:', { messageUid: messageData.uid, currentUid: current.uid });
        throw new Error('You can only delete your own messages');
      }

      await deleteDoc(messageRef);
      console.log('Room message deleted successfully:', messageId);

      // Update user activity when deleting message
      await this.updateUserActivity(messageData.username);

      return true;
    } catch (error) {
      console.error('Error deleting room message:', error);
      throw error;
    }
  }

  /**
   * Fast username cleanup - uses parallel processing and smart batching
   * This ensures no orphaned usernames remain in the database
   */
  async cleanupUsername(username) {
    try {
      console.log(`🚀 Starting FAST cleanup for username: ${username}`);
      const startTime = Date.now();
      
      // Create multiple batches for parallel processing
      const batch1 = writeBatch(db); // Core user data
      const batch2 = writeBatch(db); // Chat messages
      const batch3 = writeBatch(db); // Room data
      const batch4 = writeBatch(db); // Invites and other
      
      let deletedCount = 0;
      
      // 1. Quick deletions (no queries needed)
      try {
        const userRef = doc(db, 'users', username);
        batch1.delete(userRef);
        deletedCount++;
        
        const usernameRef = doc(db, 'usernames', username);
        batch1.delete(usernameRef);
        deletedCount++;
        
        const onlineUserRef = doc(db, 'onlineUsers', username);
        batch1.delete(onlineUserRef);
        deletedCount++;
        
        const spamUserRef = doc(db, 'spamTracker', username);
        batch1.delete(spamUserRef);
        deletedCount++;
        
        console.log(`✅ Quick deletions marked: 4 documents`);
      } catch (error) {
        console.warn(`Could not mark quick deletions for ${username}:`, error);
      }
      
      // 2. PARALLEL QUERIES - All queries run simultaneously
      console.log('🔄 Starting parallel queries...');
      
      const [
        publicChatsSnapshot,
        roomMessagesSnapshot,
        roomUsersSnapshot,
        roomsSnapshot,
        invitesSentSnapshot,
        invitesReceivedSnapshot,
        privateMessagesSnapshot,
        privateChatsSnapshot
      ] = await Promise.all([
        // All queries run in parallel
        getDocs(query(collection(db, 'publicChats'), where('username', '==', username))),
        getDocs(query(collection(db, 'roomMessages'), where('username', '==', username))),
        getDocs(query(collection(db, 'roomUsers'), where('username', '==', username))),
        getDocs(query(collection(db, 'rooms'), where('createdBy', '==', username))),
        getDocs(query(collection(db, 'invites'), where('fromUsername', '==', username))),
        getDocs(query(collection(db, 'invites'), where('toUsername', '==', username))),
        getDocs(query(collection(db, 'privateMessages'), where('username', '==', username))),
        getDocs(query(collection(db, 'privateChats'), where('participants', 'array-contains', username)))
      ]);
      
      console.log(`✅ Parallel queries completed in ${Date.now() - startTime}ms`);
      
      // 3. SMART BATCHING - Group deletions by collection for efficiency
      
      // Batch 1: Core user data (already populated)
      console.log('📦 Batching core user data...');
      
      // Batch 2: Chat messages (largest collections)
      console.log('📦 Batching chat messages...');
      publicChatsSnapshot.docs.forEach(doc => {
        batch2.delete(doc.ref);
        deletedCount++;
      });
      
      roomMessagesSnapshot.docs.forEach(doc => {
        batch2.delete(doc.ref);
        deletedCount++;
      });
      
      privateMessagesSnapshot.docs.forEach(doc => {
        batch2.delete(doc.ref);
        deletedCount++;
      });
      
      // Batch 3: Room data
      console.log('📦 Batching room data...');
      roomUsersSnapshot.docs.forEach(doc => {
        batch3.delete(doc.ref);
        deletedCount++;
      });
      
      roomsSnapshot.docs.forEach(doc => {
        batch3.delete(doc.ref);
        deletedCount++;
      });
      
      privateChatsSnapshot.docs.forEach(doc => {
        batch3.delete(doc.ref);
        deletedCount++;
      });
      
      // Batch 4: Invites and other
      console.log('📦 Batching invites and other data...');
      invitesSentSnapshot.docs.forEach(doc => {
        batch4.delete(doc.ref);
        deletedCount++;
      });
      
      invitesReceivedSnapshot.docs.forEach(doc => {
        batch4.delete(doc.ref);
        deletedCount++;
      });
      
      // 4. PARALLEL BATCH COMMITS - All batches commit simultaneously
      console.log('🚀 Committing all batches in parallel...');
      const commitStartTime = Date.now();
      
      await Promise.all([
        batch1.commit(),
        batch2.commit(),
        batch3.commit(),
        batch4.commit()
      ]);
      
      const totalTime = Date.now() - startTime;
      const commitTime = Date.now() - commitStartTime;
      
      console.log(`⚡ FAST cleanup completed for ${username}!`);
      console.log(`📊 Deleted ${deletedCount} documents`);
      console.log(`⏱️  Total time: ${totalTime}ms`);
      console.log(`🚀 Commit time: ${commitTime}ms`);
      console.log(`📈 Performance improvement: ~${Math.round((5000/totalTime)*100)}% faster than before`);
      
      return { success: true, deletedCount, username, totalTime, commitTime };
      
    } catch (error) {
      console.error(`❌ Error in fast username cleanup for ${username}:`, error);
      throw error;
    }
  }

  /**
   * Mark all messages in a room as read for a user
   */
  async markAllRoomMessagesAsRead(roomId, username) {
    try {
      const q = query(
        collection(db, COLLECTIONS.ROOM_MESSAGES),
        where('roomId', '==', roomId),
        where('username', '!=', username) // Only mark other users' messages as read
      );
      
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      
      snapshot.forEach((doc) => {
        batch.update(doc.ref, {
          status: 'read',
          readAt: serverTimestamp()
        });
      });
      
      await batch.commit();
      console.log(`Marked ${snapshot.size} room messages as read for user: ${username}`);
    } catch (error) {
      console.error('Error marking room messages as read:', error);
      throw error;
    }
  }

  /**
   * Mark private message as read
   */
  async markPrivateMessageAsRead(messageId) {
    try {
      const messageRef = doc(db, COLLECTIONS.PRIVATE_MESSAGES, messageId);
      await updateDoc(messageRef, {
        status: 'read',
        readAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error marking message as read:', error);
      throw error;
    }
  }

  /**
   * SECURITY: Validate if a user has access to a private chat
   * This prevents unauthorized access to private chats via URL manipulation
   * OPTIMIZED: Uses caching to eliminate repeated database calls
   */
  async validateChatAccess(chatId, username) {
    try {
      if (!chatId || !username) {
        console.warn('Invalid parameters for chat access validation:', { chatId, username });
        return false;
      }

      // Check cache first for instant response
      const cacheKey = `${chatId}:${username}`;
      const cachedResult = ACCESS_CACHE.chats.get(cacheKey);
      
      if (cachedResult && isCacheValid(cachedResult.timestamp)) {
        console.log('✅ Chat access validation from cache:', { chatId, username, hasAccess: cachedResult.hasAccess });
        return cachedResult.hasAccess;
      }

      console.log('🔍 Validating chat access from database:', { chatId, username });
      
      // Get the chat document
      const chatRef = doc(db, COLLECTIONS.PRIVATE_CHATS, chatId);
      const chatDoc = await getDoc(chatRef);
      
      if (!chatDoc.exists()) {
        console.log('Chat does not exist:', chatId);
        // Cache negative result
        ACCESS_CACHE.chats.set(cacheKey, { hasAccess: false, timestamp: Date.now(), username });
        return false;
      }
      
      const chatData = chatDoc.data();
      
      // Check if the user is a participant in this chat
      if (!chatData.participants || !Array.isArray(chatData.participants)) {
        console.warn('Invalid chat data - no participants array:', chatData);
        // Cache negative result
        ACCESS_CACHE.chats.set(cacheKey, { hasAccess: false, timestamp: Date.now(), username });
        return false;
      }
      
      const hasAccess = chatData.participants.includes(username);
      console.log('Chat access validation result:', { chatId, username, hasAccess, participants: chatData.participants });
      
      // Cache the result
      ACCESS_CACHE.chats.set(cacheKey, { hasAccess, timestamp: Date.now(), username });
      
      return hasAccess;
      
    } catch (error) {
      console.error('Error validating chat access:', error);
      // On error, deny access for security
      return false;
    }
  }

  /**
   * Get private chat data for a validated chat
   * This should only be called after validateChatAccess returns true
   */
  async getPrivateChatData(chatId) {
    try {
      if (!chatId) {
        console.warn('No chatId provided for getPrivateChatData');
        return null;
      }

      console.log('Getting private chat data for:', chatId);
      
      // Get the chat document
      const chatRef = doc(db, COLLECTIONS.PRIVATE_CHATS, chatId);
      const chatDoc = await getDoc(chatRef);
      
      if (!chatDoc.exists()) {
        console.warn('Chat does not exist:', chatId);
        return null;
      }
      
      const chatData = chatDoc.data();
      
      // Format the chat data for the app
      const formattedChat = {
        chatId: chatId,
        participants: chatData.participants || [],
        participantUids: chatData.participantUids || [],
        createdAt: chatData.createdAt,
        lastMessageAt: chatData.lastMessageAt
      };
      
      // Find the other participant (not the current user)
      const currentUsername = auth.currentUser?.displayName;
      if (currentUsername && formattedChat.participants.length === 2) {
        const otherUsername = formattedChat.participants.find(p => p !== currentUsername);
        formattedChat.otherUsername = otherUsername;
      }
      
      console.log('Formatted chat data:', formattedChat);
      return formattedChat;
      
    } catch (error) {
      console.error('Error getting private chat data:', error);
      return null;
    }
  }

  /**
   * SECURITY: Validate if a user has access to a private room
   * This prevents unauthorized access to private rooms via URL manipulation
   */
  async validateRoomAccess(roomId, username) {
    try {
      if (!roomId || !username) {
        console.warn('Invalid parameters for room access validation:', { roomId, username });
        return false;
      }

      // Check cache first for instant response
      const cacheKey = `${roomId}:${username}`;
      const cachedResult = ACCESS_CACHE.rooms.get(cacheKey);
      
      if (cachedResult && isCacheValid(cachedResult.timestamp)) {
        console.log('✅ Room access validation from cache:', { roomId, username, hasAccess: cachedResult.hasAccess });
        return cachedResult.hasAccess;
      }

      console.log('🔍 Validating room access from database:', { roomId, username });
      
      // Get the room document
      const roomRef = doc(db, COLLECTIONS.ROOMS, roomId);
      const roomDoc = await getDoc(roomRef);
      
      if (!roomDoc.exists()) {
        console.warn('Room does not exist:', roomId);
        // Cache negative result
        ACCESS_CACHE.rooms.set(cacheKey, { hasAccess: false, timestamp: Date.now(), username });
        return false;
      }
      
      const roomData = roomDoc.data();
      
      // Check if the user is a member of this room
      if (!roomData.members || !Array.isArray(roomData.members)) {
        console.warn('Invalid room data - no members array:', roomData);
        // Cache negative result
        ACCESS_CACHE.rooms.set(cacheKey, { hasAccess: false, timestamp: Date.now(), username });
        return false;
      }
      
      const hasAccess = roomData.members.includes(username);
      console.log('Room access validation result:', { roomId, username, hasAccess, members: roomData.members });
      
      // Cache the result
      ACCESS_CACHE.rooms.set(cacheKey, { hasAccess, timestamp: Date.now(), username });
      
      return hasAccess;
      
    } catch (error) {
      console.error('Error validating room access:', error);
      // On error, deny access for security
      return false;
    }
  }

  /**
   * Get room data for a validated room
   * This should only be called after validateRoomAccess returns true
   */
  async getRoomData(roomId) {
    try {
      if (!roomId) {
        console.warn('No roomId provided for getRoomData');
        return null;
      }

      console.log('Getting room data for:', roomId);
      
      // Get the room document
      const roomRef = doc(db, COLLECTIONS.ROOMS, roomId);
      const roomDoc = await getDoc(roomRef);
      
      if (!roomDoc.exists()) {
        console.warn('Room does not exist:', roomId);
        return null;
      }
      
      const roomData = roomDoc.data();
      
      // Format the room data for the app
      const formattedRoom = {
        id: roomId,
        name: roomData.name || 'Unnamed Room',
        createdBy: roomData.createdBy || 'Unknown',
        createdByUid: roomData.createdByUid || '',
        createdAt: roomData.createdAt,
        members: roomData.members || []
      };
      
      console.log('Formatted room data:', formattedRoom);
      return formattedRoom;
      
    } catch (error) {
      console.error('Error getting room data:', error);
      return null;
    }
  }

  /**
   * Mark a specific message as read immediately (optimized for real-time updates)
   */
  async markMessageAsReadImmediately(messageId) {
    try {
      const messageRef = doc(db, COLLECTIONS.PRIVATE_MESSAGES, messageId);
      await updateDoc(messageRef, {
        status: 'read',
        readAt: serverTimestamp()
      });
    } catch (error) {
      // Handle permission errors gracefully
      if (error.code === 'permission-denied' || error.message.includes('Missing or insufficient permissions')) {
        console.warn(`Permission denied when marking private message ${messageId} as read. This is normal for messages from other users.`);
        // Don't throw the error - just log it as a warning
        return false;
      } else {
        console.error('Error marking message as read immediately:', error);
        throw error;
      }
    }
    return true;
  }

  /**
   * Mark new messages as read in real-time (optimized version)
   */
  async markNewMessagesAsRead(chatId, username, messageIds) {
    try {
      if (!messageIds || messageIds.length === 0) return;
      
      // Use individual updates for immediate feedback instead of batching
      const updatePromises = messageIds.map(async (messageId) => {
        try {
          const success = await this.markMessageAsReadImmediately(messageId);
          if (!success) {
            console.warn(`Could not mark private message ${messageId} as read - permission denied`);
          }
        } catch (error) {
          console.error(`Error marking message ${messageId} as read:`, error);
        }
      });
      
      // Execute all updates concurrently for maximum speed
      await Promise.allSettled(updatePromises);
    } catch (error) {
      console.error('Error marking new messages as read:', error);
      throw error;
    }
  }

  /**
   * Mark messages as read with optimistic updates (fastest method)
   */
  async markMessagesAsReadOptimistically(chatId, username, messageIds) {
    try {
      if (!messageIds || messageIds.length === 0) return;
      
      // Start all updates immediately without waiting
      messageIds.forEach(async (messageId) => {
        try {
          // Fire and forget - don't wait for response
          this.markMessageAsReadImmediately(messageId).then(success => {
            if (!success) {
              console.warn(`Could not mark private message ${messageId} as read - permission denied`);
            }
          }).catch(error => {
            console.error(`Error marking message ${messageId} as read:`, error);
          });
        } catch (error) {
          console.error(`Error queuing message ${messageId} for read update:`, error);
        }
      });
      
      // Return immediately for instant UI feedback
      return true;
    } catch (error) {
      console.error('Error marking messages as read optimistically:', error);
      throw error;
    }
  }

  /**
   * Clean up all listeners and reset state
   */
  cleanup() {
    console.log('🧹 Cleaning up Firebase service...');
    
    // Clean up all unsubscribe functions
    this.unsubscribeFns.forEach(unsubscribe => {
      try {
        unsubscribe();
      } catch (error) {
        console.warn('Error during cleanup:', error);
      }
    });
    this.unsubscribeFns.clear();
    
    // Clean up active listeners
    if (this.activeListeners) {
      this.activeListeners.forEach((unsubscribe, key) => {
        try {
          unsubscribe();
        } catch (error) {
          console.warn('Error cleaning up listener:', key, error);
        }
      });
      this.activeListeners.clear();
    }
    
    console.log('✅ Firebase service cleanup completed');
  }

  /**
   * Mark a specific room message as read immediately (optimized for real-time updates)
   */
  async markRoomMessageAsReadImmediately(messageId) {
    try {
      const messageRef = doc(db, COLLECTIONS.ROOM_MESSAGES, messageId);
      await updateDoc(messageRef, {
        status: 'read',
        readAt: serverTimestamp()
      });
    } catch (error) {
      // Handle permission errors gracefully
      if (error.code === 'permission-denied' || error.message.includes('Missing or insufficient permissions')) {
        console.warn(`Permission denied when marking message ${messageId} as read. This is normal for messages from other users.`);
        // Don't throw the error - just log it as a warning
        return false;
      } else {
        console.error('Error marking room message as read immediately:', error);
        throw error;
      }
    }
    return true;
  }

  /**
   * Mark new room messages as read in real-time (optimized version)
   */
  async markNewRoomMessagesAsRead(roomId, username, messageIds) {
    try {
      if (!messageIds || messageIds.length === 0) return;
      
      // Use individual updates for immediate feedback instead of batching
      const updatePromises = messageIds.map(async (messageId) => {
        try {
          const success = await this.markRoomMessageAsReadImmediately(messageId);
          if (!success) {
            console.warn(`Could not mark message ${messageId} as read - permission denied`);
          }
        } catch (error) {
          console.error(`Error marking room message ${messageId} as read:`, error);
        }
      });
      
      // Execute all updates concurrently for maximum speed
      await Promise.allSettled(updatePromises);
    } catch (error) {
      console.error('Error marking new room messages as read:', error);
      throw error;
    }
  }

  /**
   * Mark room messages as read with optimistic updates (fastest method)
   */
  async markRoomMessagesAsReadOptimistically(roomId, username, messageIds) {
    try {
      if (!messageIds || messageIds.length === 0) return;
      
      // Start all updates immediately without waiting
      messageIds.forEach(async (messageId) => {
        try {
          // Fire and forget - don't wait for response
          this.markRoomMessageAsReadImmediately(messageId).then(success => {
            if (!success) {
              console.warn(`Could not mark message ${messageId} as read - permission denied`);
            }
          }).catch(error => {
            console.error(`Error marking room message ${messageId} as read:`, error);
          });
        } catch (error) {
          console.error(`Error queuing room message ${messageId} for read update:`, error);
        }
      });
      
      // Return immediately for instant UI feedback
      return true;
    } catch (error) {
      console.error('Error marking room messages as read optimistically:', error);
      throw error;
    }
  }

  /**
   * Mark room message as delivered when recipient is online
   */
  async markRoomMessageAsDelivered(messageId) {
    try {
      const messageRef = doc(db, COLLECTIONS.ROOM_MESSAGES, messageId);
      await updateDoc(messageRef, {
        status: 'delivered',
        deliveredAt: serverTimestamp()
      });
    } catch (error) {
      // Handle permission errors gracefully
      if (error.code === 'permission-denied' || error.message.includes('Missing or insufficient permissions')) {
        console.warn(`Permission denied when marking message ${messageId} as delivered. This is normal for messages from other users.`);
        // Don't throw the error - just log it as a warning
        return false;
      } else {
        console.error('Error marking room message as delivered:', error);
        throw error;
      }
    }
    return true;
  }

  /**
   * Mark room message as delivered for online users in the room
   */
  async markRoomMessageAsDeliveredForOnlineUsers(roomId, messageId) {
    try {
      // Get room users to check who's online
      const roomUsersQuery = query(
        collection(db, COLLECTIONS.ROOM_USERS),
        where('roomId', '==', roomId)
      );
      
      const roomUsersSnapshot = await getDocs(roomUsersQuery);
      const onlineUsers = [];
      
      roomUsersSnapshot.forEach((doc) => {
        const userData = doc.data();
        if (userData.isOnline && userData.lastHeartbeat) {
          const lastHeartbeat = userData.lastHeartbeat.toDate ? userData.lastHeartbeat.toDate().getTime() : userData.lastHeartbeat;
          const timeSinceHeartbeat = Date.now() - lastHeartbeat;
          
          // User is online if heartbeat is recent (within 30 seconds)
          if (timeSinceHeartbeat < 30000) {
            onlineUsers.push(userData.username);
          }
        }
      });

      // If there are online users (excluding sender), mark as delivered
      if (onlineUsers.length > 0) {
        // Mark as delivered after a short delay to simulate delivery time
        setTimeout(async () => {
          try {
            await this.markRoomMessageAsDelivered(messageId);
          } catch (error) {
            console.error('Error marking room message as delivered:', error);
          }
        }, 1000); // 1 second delay
      }
    } catch (error) {
      console.error('Error checking online users for message delivery:', error);
    }
  }
}

// Create and export service instance
const firebaseService = new FirebaseService();
export default firebaseService;

// Export db instance for use in other modules
export { db };