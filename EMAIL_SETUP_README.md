# Email Notification System Setup Guide

## Overview
This guide will help you set up the email notification system for the placement portal. The system supports multiple email providers and includes comprehensive email templates for various notification types.

## Features
- **Multiple Email Providers**: SendGrid, Gmail, AWS SES, Mailgun
- **Beautiful Email Templates**: Professional HTML templates for all notification types
- **Email Tracking**: Monitor email delivery status and retry failed emails
- **Batch Sending**: Send notifications to multiple recipients efficiently
- **Admin Dashboard**: Manage and monitor all email activities

## Email Templates Available
1. **Job Application** - Confirmation when students apply for jobs
2. **Status Update** - Application status changes (shortlisted, rejected, etc.)
3. **Interview** - Interview scheduling notifications
4. **Selection** - Congratulations for job selection
5. **Announcement** - General announcements and updates
6. **Deadline Reminder** - Job application deadline reminders

## Setup Instructions

### Step 1: Choose Email Provider

#### Option A: SendGrid (Recommended for Production)
1. Sign up for a SendGrid account at [sendgrid.com](https://sendgrid.com)
2. Create an API key with full access to "Mail Send"
3. Verify your sender domain or use a single sender verification
4. Add to your environment variables:
```bash
REACT_APP_SENDGRID_API_KEY=your_sendgrid_api_key
REACT_APP_FROM_EMAIL=noreply@yourdomain.com
REACT_APP_FROM_NAME=T&P Cell
```

#### Option B: Gmail (For Development/Testing)
1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password for the application
3. Add to your environment variables:
```bash
REACT_APP_GMAIL_USER=your_gmail@gmail.com
REACT_APP_GMAIL_APP_PASSWORD=your_gmail_app_password
REACT_APP_FROM_EMAIL=your_gmail@gmail.com
REACT_APP_FROM_NAME=T&P Cell
```

#### Option C: AWS SES
1. Set up AWS SES in your AWS account
2. Verify your domain or email address
3. Create IAM user with SES permissions
4. Add to your environment variables:
```bash
REACT_APP_AWS_SES_ACCESS_KEY=your_aws_access_key
REACT_APP_AWS_SES_SECRET_KEY=your_aws_secret_key
REACT_APP_AWS_SES_REGION=your_aws_region
```

#### Option D: Mailgun
1. Sign up for Mailgun account
2. Verify your domain
3. Get your API key
4. Add to your environment variables:
```bash
REACT_APP_MAILGUN_API_KEY=your_mailgun_api_key
REACT_APP_MAILGUN_DOMAIN=your_mailgun_domain
REACT_APP_FROM_EMAIL=noreply@yourdomain.com
REACT_APP_FROM_NAME=T&P Cell
```

### Step 2: Install Dependencies

```bash
# Install email-related packages
npm install @sendgrid/mail nodemailer

# Install virtualization packages for performance
npm install react-window react-virtualized-auto-sizer
```

### Step 3: Deploy Cloud Functions

```bash
# Navigate to functions directory
cd functions

# Install dependencies
npm install

# Deploy functions
firebase deploy --only functions
```

### Step 4: Configure Firebase

1. Set Firebase configuration values:
```bash
firebase functions:config:set sendgrid.api_key="your_sendgrid_api_key"
firebase functions:config:set sendgrid.from_email="noreply@yourdomain.com"
firebase functions:config:set sendgrid.from_name="T&P Cell"
```

2. Deploy the updated configuration:
```bash
firebase deploy --only functions
```

### Step 5: Test Email System

1. **Test Individual Email**:
   - Go to Admin Dashboard
   - Open Email Manager
   - Try sending a test email

2. **Test Notification Flow**:
   - Create a job posting
   - Apply as a student
   - Check if email notifications are sent

## Email Templates Customization

### Template Structure
Each email template includes:
- **Header**: Company branding and notification type
- **Content**: Personalized message with relevant information
- **Action Buttons**: Links to relevant pages
- **Footer**: Company contact information

### Customizing Templates
Edit `src/utils/emailHelpers.js` to modify:
- Email subjects
- HTML content
- Styling and colors
- Action button links

### Adding New Templates
1. Add template to `emailTemplates` object
2. Create corresponding Cloud Function logic
3. Update notification helpers
4. Test with sample data

## Performance Optimizations

### Virtualized Lists
- Large data sets are rendered efficiently using `react-window`
- Only visible rows are rendered in memory
- Smooth scrolling for thousands of records

### Caching Strategy
- Firestore queries are cached locally
- Real-time listeners update cache automatically
- Reduces Firebase read costs

### Batch Operations
- Multiple emails sent in batches
- Reduces API calls and improves performance
- Progress tracking for large batches

## Monitoring and Analytics

### Email Logs
- Track all email delivery attempts
- Monitor success/failure rates
- Retry failed emails automatically

### Dashboard Statistics
- Real-time email delivery stats
- Performance metrics
- User engagement tracking

### Error Handling
- Comprehensive error logging
- Automatic retry mechanisms
- Admin notifications for failures

## Security Considerations

### API Key Protection
- Store sensitive keys in environment variables
- Use Firebase Functions for server-side operations
- Never expose keys in client-side code

### Rate Limiting
- Implement rate limiting for email sending
- Prevent spam and abuse
- Monitor sending patterns

### Data Privacy
- Only send emails to verified recipients
- Respect user preferences
- Comply with email regulations (CAN-SPAM, GDPR)

## Troubleshooting

### Common Issues

1. **Emails Not Sending**:
   - Check API key configuration
   - Verify sender email verification
   - Check Firebase Functions logs

2. **Authentication Errors**:
   - Verify Firebase configuration
   - Check user authentication status
   - Ensure proper permissions

3. **Template Rendering Issues**:
   - Check HTML syntax
   - Verify data structure
   - Test with sample data

### Debug Mode
Enable debug logging:
```javascript
// In emailHelpers.js
console.log('Email data:', emailData);
console.log('Template:', template);
```

### Testing
Use test email addresses:
- Gmail: Add `+test` to your email (e.g., `youremail+test@gmail.com`)
- SendGrid: Use their email testing tools
- AWS SES: Use sandbox mode for testing

## Best Practices

### Email Content
- Keep subjects under 50 characters
- Use clear, actionable language
- Include relevant links and CTAs
- Test on multiple email clients

### Performance
- Send emails in batches
- Use async/await for operations
- Implement proper error handling
- Monitor delivery rates

### User Experience
- Respect notification preferences
- Provide clear unsubscribe options
- Use consistent branding
- Optimize for mobile devices

## Support and Maintenance

### Regular Maintenance
- Monitor email delivery rates
- Update templates as needed
- Review and optimize performance
- Keep dependencies updated

### Updates and Upgrades
- Follow email provider updates
- Monitor Firebase Functions changes
- Test new features thoroughly
- Maintain backward compatibility

## Conclusion

The email notification system provides a robust, scalable solution for keeping users informed about important events in the placement portal. With proper setup and monitoring, it will significantly improve user engagement and communication efficiency.

For additional support or questions, refer to the Firebase documentation and your chosen email provider's support resources.

