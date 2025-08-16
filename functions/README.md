# Firebase Cloud Functions - Push Notifications

This directory contains Firebase Cloud Functions for managing push notifications in the Placement Portal application.

## Features

- **FCM Token Management**: Save and manage FCM tokens for students and admins
- **Targeted Notifications**: Send push notifications to specific users or groups
- **Job Notifications**: Send notifications to eligible students based on criteria
- **Admin Notifications**: Send notifications to all admin users
- **Token Cleanup**: Handle FCM token cleanup when users disable notifications

## Functions

### 1. `saveFCMToken`
- **Purpose**: Save FCM token for a student
- **Parameters**: `fcmToken`, `enabled`
- **Usage**: Called when a student enables push notifications

### 2. `sendJobNotificationToEligibleStudents`
- **Purpose**: Send job-related notifications to eligible students
- **Parameters**: `jobId`, `title`, `message`, `criteria`
- **Criteria**: department, batch, minCGPA
- **Usage**: Send notifications for new job postings or updates

### 3. `sendNotificationToAdmins`
- **Purpose**: Send notifications to all admin users
- **Parameters**: `title`, `message`, `type`
- **Usage**: Send system-wide announcements or alerts

### 4. `sendNotificationToSpecificUsers`
- **Purpose**: Send notifications to specific users by ID
- **Parameters**: `userIds`, `title`, `message`, `type`, `userType`
- **Usage**: Send personalized notifications to selected users

### 5. `cleanupFCMToken`
- **Purpose**: Handle FCM token cleanup and notification settings
- **Parameters**: `enabled`
- **Usage**: Called when users toggle push notification settings

## Setup Instructions

### Prerequisites
- Node.js 18 or higher
- Firebase CLI installed globally
- Firebase project configured

### Installation
1. Navigate to the functions directory:
   ```bash
   cd functions
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Deploy functions:
   ```bash
   npm run deploy
   ```

### Environment Variables
Make sure your Firebase project has the following services enabled:
- Firestore Database
- Cloud Functions
- Cloud Messaging (FCM)

### VAPID Key
For web push notifications, you'll need to:
1. Generate a VAPID key pair
2. Add the public key to your environment variables as `REACT_APP_VAPID_KEY`
3. Add the private key to your Firebase project settings

## Usage Examples

### Frontend Integration

```javascript
import { saveFCMTokenToDatabase, updatePushNotificationSettings } from '../firebase';

// Enable push notifications
const token = await enablePushNotifications();
await saveFCMTokenToDatabase(token, true);

// Disable push notifications
await updatePushNotificationSettings(false);
```

### Admin Usage

```javascript
import { sendJobNotificationToEligibleStudents } from '../firebase';

// Send job notification to eligible students
await sendJobNotificationToEligibleStudents({
  jobId: 'job123',
  title: 'New Job Opportunity',
  message: 'A new software engineering position is available',
  criteria: {
    department: 'Computer Science',
    minCGPA: 7.5
  }
});
```

## Security Rules

The functions include authentication checks:
- All functions require user authentication
- Admin functions can be enhanced with role-based access control
- FCM tokens are stored securely in Firestore

## Monitoring

Functions log important events:
- Success/failure counts for notifications
- Token management operations
- Error handling and debugging information

## Troubleshooting

### Common Issues
1. **FCM Token Generation Failed**: Check browser notification permissions
2. **Function Deployment Failed**: Verify Node.js version and Firebase CLI
3. **Notifications Not Received**: Check FCM token validity and user settings

### Debug Mode
Enable debug logging by setting environment variables in Firebase Console:
- `DEBUG=true` for detailed function logs
- `FCM_DEBUG=true` for FCM-specific logging

## Support

For issues or questions:
1. Check Firebase Console logs
2. Verify function deployment status
3. Test with Firebase emulators locally



