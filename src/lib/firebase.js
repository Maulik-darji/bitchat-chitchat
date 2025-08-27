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
  PRIVATE_MESSAGES: 'privateMessages'
};

// Spam protection configuration
const SPAM_CONFIG = {
  MAX_MESSAGES: 10, // Increased from 5
  RAPID_THRESHOLD: 5, // Increased from 3
  RAPID_TIME_WINDOW: 15000, // Increased from 10 seconds to 15 seconds
  MIN_INTERVAL: 1000, // Reduced from 2 seconds to 1 second
  COOLDOWN_PERIOD: 15000 // Reduced from 30 seconds to 15 seconds
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
        lastSeen: serverTimestamp()
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
        lastSeen: serverTimestamp()
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
      // Ensure we have an authenticated user
      let current = auth.currentUser;
      if (!current) {
        console.log('No authenticated user, attempting to initialize Firebase');
        await this.initialize();
        current = auth.currentUser;
        if (!current) throw new Error('Failed to authenticate user');
      }

      const messageRef = doc(collection(db, COLLECTIONS.ROOM_MESSAGES));
      const messageData = {
        id: messageRef.id,
        roomId,
        uid: current.uid, // CRITICAL: Link to Auth UID
        username,
        message,
        timestamp: serverTimestamp()
      };
      
      console.log('Attempting to send room message with data:', messageData);
      await setDoc(messageRef, messageData);
      console.log('Room message sent successfully');
      return messageRef.id;
    } catch (error) {
      console.error('Error sending room message:', error);
      
      // If it's a permission error, try to re-authenticate
      if (error.code === 'permission-denied' || error.message.includes('permissions')) {
        try {
          console.log('Permission denied, attempting to re-authenticate');
          await signInAnonymously(auth);
          const retryCurrent = auth.currentUser;
          if (retryCurrent) {
            // Retry sending the message
            const messageRef = doc(collection(db, COLLECTIONS.ROOM_MESSAGES));
            await setDoc(messageRef, {
              id: messageRef.id,
              roomId,
              uid: retryCurrent.uid,
              username,
              message,
              timestamp: serverTimestamp()
            });
            return messageRef.id;
          }
        } catch (reauthError) {
          console.error('Re-authentication failed:', reauthError);
        }
      }
      
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
      
      console.log('User left room successfully');
      return true;
    } catch (error) {
            console.error('Error leaving room:', error);
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

      // If accepted, create private chat
      if (response === 'accepted') {
        const inviteDoc = await getDoc(inviteRef);
        const inviteData = inviteDoc.data();
        await this.createPrivateChat(inviteData.fromUsername, inviteData.toUsername);
      }

      return true;
    } catch (error) {
      console.error('Error responding to invite:', error);
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
      const sortedUsers = [user1, user2].sort();
      const chatId = `${sortedUsers[0]}_${sortedUsers[1]}`;

      console.log('Creating private chat:', { chatId, user1, user2 });

      // Check if chat already exists
      const existingChat = await getDoc(doc(db, COLLECTIONS.PRIVATE_CHATS, chatId));
      if (existingChat.exists()) {
        console.log('Private chat already exists:', chatId);
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

      const chatRef = doc(db, COLLECTIONS.PRIVATE_CHATS, chatId);
      await setDoc(chatRef, {
        id: chatId,
        participants: [user1, user2],
        participantUids: [user1Uid, user2Uid], // Store UIDs for proper cleanup
        createdAt: serverTimestamp(),
        lastMessageAt: serverTimestamp()
      });

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
  async sendPrivateMessage(chatId, username, message) {
    try {
      const current = auth.currentUser;
      if (!current) throw new Error('No authenticated user');

      console.log('Sending private message:', { chatId, username, message, uid: current.uid });

      const messageRef = doc(collection(db, COLLECTIONS.PRIVATE_MESSAGES));
      await setDoc(messageRef, {
        id: messageRef.id,
        chatId,
        uid: current.uid,
        username,
        message,
        timestamp: serverTimestamp()
      });

      console.log('Private message sent successfully:', messageRef.id);

      // Update last message timestamp
      const chatRef = doc(db, COLLECTIONS.PRIVATE_CHATS, chatId);
      await updateDoc(chatRef, {
        lastMessageAt: serverTimestamp()
      });

      return messageRef.id;
    } catch (error) {
      console.error('Error sending private message:', error);
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
          chats.push({ id: doc.id, ...doc.data() });
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

      console.log('Removing user from private chat:', { chatId, usernameToRemove });

      const chatRef = doc(db, COLLECTIONS.PRIVATE_CHATS, chatId);
      const chatDoc = await getDoc(chatRef);
      
      if (!chatDoc.exists()) {
        throw new Error('Chat not found');
      }

      const chatData = chatDoc.data();
      const updatedParticipants = chatData.participants.filter(
        participant => participant !== usernameToRemove
      );

      if (updatedParticipants.length === 0) {
        // If no participants left, delete the chat and all messages
        await deleteDoc(chatRef);
        
        // Delete all messages in this chat
        const messagesQuery = query(
          collection(db, COLLECTIONS.PRIVATE_MESSAGES),
          where('chatId', '==', chatId)
        );
        const messagesSnapshot = await getDocs(messagesQuery);
        const deletePromises = messagesSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
        
        console.log('Chat and messages deleted as no participants remain');
      } else {
        // Update participants list
        await updateDoc(chatRef, {
          participants: updatedParticipants
        });
        console.log('User removed from chat');
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
            console.log(`  - Exact match: ${isOwnRoom}`);
            console.log(`  - Trimmed match: ${isOwnRoomTrimmed}`);
            console.log(`  - Case-insensitive match: ${isOwnRoomCaseInsensitive}`);
            
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
    
    console.log('Spam check for user:', username, 'User data:', userData);
    
    // Check if user is blocked
    if (userData.isBlocked && now < userData.blockUntil) {
      const cooldown = Math.ceil((userData.blockUntil - now) / 1000);
      console.log('User is blocked, cooldown remaining:', cooldown, 'seconds');
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
       
              // First, clean up Firestore data while we still have authentication
       try {
         await this.cleanupUserData(currentUser.uid);
         console.log('Firestore data cleaned up successfully');
       } catch (cleanupError) {
         console.log('Firestore cleanup failed:', cleanupError);
       }
       
       // Then try to delete the Firebase Authentication user
       try {
         await currentUser.delete();
         console.log('User account deleted successfully');
       } catch (deleteError) {
         console.log('Could not delete auth user (token may be expired), but Firestore data was cleaned up');
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
}

// Create and export service instance
const firebaseService = new FirebaseService();
export default firebaseService;