# Deploy Firebase Cloud Functions for Automatic Cleanup

## Prerequisites

1. **Firebase CLI installed:**
   ```bash
   npm install -g firebase-tools
   ```

2. **Logged into Firebase:**
   ```bash
   firebase login
   ```

## Deployment Steps

### 1. Navigate to Functions Directory
```bash
cd functions
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Deploy Cloud Functions
```bash
firebase deploy --only functions
```

## What This Deploys

### `cleanupAuthUserData`
- **Trigger**: When a user is deleted from Firebase Authentication
- **Action**: Automatically deletes all related Firestore data
- **Collections cleaned**: users, public_chats, room_messages, room_users, rooms

### `cleanupUserData`
- **Trigger**: When a user document is deleted from Firestore
- **Action**: Cleans up all related data for that username
- **Collections cleaned**: public_chats, room_messages, room_users, rooms

### `periodicCleanup`
- **Trigger**: Every hour
- **Action**: Scans for and removes any orphaned data
- **Collections cleaned**: All collections with orphaned references

## How It Works

1. **User deleted from Authentication** → `cleanupAuthUserData` triggers
2. **User document deleted from Firestore** → `cleanupUserData` triggers  
3. **Hourly cleanup** → `periodicCleanup` runs to catch any missed data

## Verification

After deployment, check the Firebase Console:
1. Go to **Functions** tab
2. Verify all three functions are deployed and active
3. Check **Logs** tab to see cleanup operations

## Testing

1. **Delete a user from Authentication** in Firebase Console
2. **Check Firestore** - all related data should be automatically removed
3. **Check Function logs** - should show cleanup operations

## Troubleshooting

- **Function not deploying**: Check Node.js version (requires 18+)
- **Permission errors**: Ensure you're logged in with correct Firebase account
- **Dependency issues**: Delete `node_modules` and run `npm install` again
