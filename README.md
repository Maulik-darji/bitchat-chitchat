# Anonymous Chat Application

A complete anonymous chatting website built with React and Firebase, featuring public chat, private rooms, and automatic data cleanup.

## Features

- **Anonymous Chat**: Users can chat without revealing their identity
- **Public Chat**: Open conversation area for all users
- **Private Rooms**: Create or join private chat rooms
- **Real-time Updates**: Live chat with instant message delivery
- **Automatic Cleanup**: Orphaned data is automatically removed when users are deleted
- **Professional UI**: Clean, modern interface with dark theme
- **Responsive Design**: Works on all screen sizes

## Tech Stack

- **Frontend**: React (Create React App)
- **Backend**: Firebase (Firestore, Authentication, Functions)
- **Styling**: Tailwind CSS
- **Real-time**: Firebase Firestore listeners
- **Deployment**: Firebase Hosting

## Automatic Data Cleanup

The application includes an **automatic cleanup system** that ensures data integrity:

### How It Works

1. **Real-time Cleanup**: When a user account is deleted, all their data is automatically removed
2. **Cloud Functions**: Firebase Cloud Functions handle the cleanup process
3. **Periodic Cleanup**: Hourly cleanup runs to catch any remaining orphaned data
4. **Data Integrity**: Ensures deleted users' messages don't remain in the chat

### What Gets Cleaned Up

- Public chat messages from deleted users
- Private room messages from deleted users
- Room memberships from deleted users
- Rooms created by deleted users

## Setup Instructions

### 1. Firebase Project Setup

1. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Firestore Database
3. Enable Anonymous Authentication
4. Set up Firebase Functions

### 2. Install Dependencies

```bash
npm install
cd functions
npm install
```

### 3. Configure Firebase (Environment Variables)

Create a local `.env.local` file (git-ignored) with your Firebase credentials:

```
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_auth_domain
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_storage_bucket
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
REACT_APP_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

The app reads these in `src/lib/firebase.js`. Do not commit `.env*` files.

### 4. Deploy Cloud Functions

```bash
firebase login
firebase use --add
firebase deploy --only functions
```

### 5. Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

### 6. Start Development Server

```bash
npm start
```

## Deployment

### Deploy to Firebase Hosting

```bash
npm run build
firebase deploy --only hosting
```

### Deploy Everything

```bash
firebase deploy
```

## Security Rules

The application uses Firebase Security Rules to ensure:
- Anonymous users can read and write to public chat
- Users can only edit/delete their own messages
- Private room access is controlled
- Data integrity is maintained

## File Structure

```
├── src/
│   ├── components/          # React components
│   ├── lib/                # Firebase configuration
│   └── App.js              # Main application
├── functions/               # Firebase Cloud Functions
├── firestore.rules         # Firestore security rules
├── firebase.json           # Firebase configuration
└── README.md               # This file
```

## Features for Normal Users

- **Simple Interface**: Clean, intuitive design
- **Real-time Chat**: Instant message delivery
- **Message Editing**: Edit your own messages
- **Private Rooms**: Create and join private conversations
- **Automatic Updates**: No manual cleanup needed

## Admin Features

- **Automatic Cleanup**: Cloud Functions handle data cleanup
- **Data Integrity**: Ensures consistent database state
- **Monitoring**: Cloud Function logs for debugging

## Support

For issues or questions:
1. Check the Firebase Console for Cloud Function logs
2. Verify Firestore rules are properly deployed
3. Ensure all dependencies are installed

## License

This project is open source and available under the MIT License.
