# Simple Firestore Rules for Testing

If the chats are disappearing, try these simplified rules in your Firebase Console:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow all authenticated users to read and write
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Steps:
1. Go to Firebase Console → Firestore Database → Rules
2. Replace the current rules with the simple version above
3. Click "Publish"

This will allow all authenticated users to read and write to all collections, which should fix the disappearing chats issue.

## Note:
This is for testing only. Once everything works, you can implement proper security rules.
