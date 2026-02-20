# MFA Quick Start Guide

## 🚀 Getting Started with MFA in Users Module

### For Administrators

#### 1. Enable MFA for a User (3 Easy Steps)

```
Step 1: Open User Management
   Main Menu → Users → Click "Edit" on any user

Step 2: Access MFA Settings
   Click the "MFA Security" tab in the dialog

Step 3: Enable MFA
   Click "Enable MFA" button
   → Enter your admin password
   → Show QR code to user (or share secret key)
   → User scans with authenticator app
   → User enters 6-digit code
   → Save the 10 backup codes shown
   ✅ Done!
```

#### 2. Disable MFA (If Needed)

```
   Edit User → MFA Security tab → "Disable MFA"
   → Confirm → Enter admin password → ✅ Done!
```

#### 3. Regenerate Backup Codes

```
   Edit User → MFA Security tab → "Regenerate Backup Codes"
   → Confirm → Enter admin password → Save new codes → ✅ Done!
```

## 📱 Compatible Authenticator Apps

Users can use any TOTP authenticator app:
- ✅ Google Authenticator (iOS/Android)
- ✅ Microsoft Authenticator (iOS/Android)
- ✅ Authy (iOS/Android/Desktop)
- ✅ 1Password
- ✅ LastPass Authenticator
- ✅ Any RFC 6238 TOTP app

## 🔑 Backup Codes

**IMPORTANT**: Always save backup codes!
- 10 codes provided during enrollment
- Each code can only be used once
- Keep them in a secure location
- Can regenerate if lost (admin only)

## 🎨 What You'll See

### MFA Security Tab

```
┌─────────────────────────────────────────────────┐
│  👤 Basic Information | 🔐 MFA Security         │
├─────────────────────────────────────────────────┤
│                                                 │
│  🔒 Multi-Factor Authentication (MFA)          │
│                                                 │
│  Status: [✅ Enabled] or [❌ Disabled]          │
│                                                 │
│  Description: Optional security enhancement    │
│                                                 │
│  Actions:                                       │
│   [Enable MFA] or [Disable MFA]                │
│   [Regenerate Backup Codes]  [🔄 Refresh]      │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Enrollment Wizard

```
Step 1: Verify Admin Password
  ┌─────────────────────────────────┐
  │ Enter your admin password       │
  │ [________________]              │
  │                    [Next →]     │
  └─────────────────────────────────┘

Step 2: Scan QR Code
  ┌─────────────────────────────────┐
  │     ┌─────────┐                 │
  │     │  QR     │                 │
  │     │  Code   │                 │
  │     └─────────┘                 │
  │                                 │
  │ Manual key: JBSWY3DPEHPK3PXP    │
  │  [← Back]          [Next →]     │
  └─────────────────────────────────┘

Step 3: Verify Code
  ┌─────────────────────────────────┐
  │ Enter 6-digit code:             │
  │     [ 1 2 3 4 5 6 ]             │
  │  [← Back]   [Complete Setup ✓]  │
  └─────────────────────────────────┘

Success: Backup Codes
  ┌─────────────────────────────────┐
  │ ⚠️ Save these codes!            │
  │                                 │
  │  ABCD-1234    EFGH-5678         │
  │  IJKL-9012    MNOP-3456         │
  │  ... (10 total)                 │
  │                                 │
  │ [Copy] [Download] [Print]       │
  └─────────────────────────────────┘
```

## 🛠️ Technical Details

### Files Involved

```
backend-ui/src/
├── services/
│   └── mfaApi.js                    # MFA API calls
├── components/users/
│   ├── UserForm.js                  # Updated with tabs
│   ├── MfaManagement.js             # Main component
│   ├── MfaEnrollmentDialog.js       # Enrollment wizard
│   └── MfaBackupCodesDialog.js      # Codes display
└── config/
    └── apiConfig.js                 # MFA endpoints
```

### API Endpoints

```
GET    /api/mfa/status?user_id={id}
POST   /api/mfa/enroll
POST   /api/mfa/verify-enrollment
POST   /api/mfa/disable
POST   /api/mfa/regenerate-backup-codes
```

## ⚠️ Important Notes

1. **MFA is Optional** - Not required for users
2. **Admin Control** - Only admins can enable/disable MFA for users
3. **Password Required** - Admin password needed for all MFA operations
4. **One-Time Display** - Backup codes shown only once
5. **Confirmation Required** - Disable/regenerate require confirmation

## 🔒 Security Best Practices

✅ **DO**:
- Save backup codes securely
- Enable MFA for admin accounts first
- Share QR codes through secure channels
- Regenerate codes if compromised
- Keep authenticator app updated

❌ **DON'T**:
- Share backup codes in plain text emails
- Take screenshots of QR codes
- Store codes in unsecured locations
- Skip saving backup codes
- Disable MFA without good reason

## 🐛 Troubleshooting

### Problem: QR Code Not Scanning
**Solution**: Use the manual key instead. Copy and paste it into your authenticator app.

### Problem: Code Invalid
**Solutions**:
- Wait for next code (they expire every 30 seconds)
- Check your device's time is synchronized
- Verify you're entering 6 digits
- Try using a backup code instead

### Problem: Admin Password Rejected
**Solutions**:
- Verify you're logged in as admin
- Check password is correct
- Try logging out and back in

### Problem: Can't Disable MFA
**Solution**: This requires admin privileges and password confirmation. Contact a system administrator.

## 📚 Additional Resources

- **Complete Documentation**: `MFA_FRONTEND_IMPLEMENTATION.md`
- **Summary**: `MFA_FRONTEND_SUMMARY.md`
- **Backend Docs**: `SECURITY_PHASE_3_COMPLETE_SUMMARY.md`

## 🎯 Common Scenarios

### Scenario 1: New User Setup
```
1. Create user (Basic Information tab)
2. Save user
3. Edit user
4. Go to MFA Security tab
5. Enable MFA
6. Share QR code and backup codes with user
```

### Scenario 2: User Lost Phone
```
1. User tries backup code first
2. If no backup codes, admin must:
   - Edit user
   - Disable MFA temporarily
   - User can log in
   - Re-enable MFA with new device
```

### Scenario 3: User Lost Backup Codes
```
1. Admin edits user
2. Goes to MFA Security tab
3. Clicks "Regenerate Backup Codes"
4. Shares new codes securely with user
```

## ✨ Features Overview

| Feature | Status | Description |
|---------|--------|-------------|
| View MFA Status | ✅ | See if MFA is enabled |
| Enable MFA | ✅ | Admin enables for user |
| QR Code Display | ✅ | Visual + manual key |
| TOTP Verification | ✅ | 6-digit code check |
| Backup Codes | ✅ | 10 codes generated |
| Disable MFA | ✅ | Admin can disable |
| Regenerate Codes | ✅ | Generate new codes |
| Copy Codes | ✅ | One-click copy |
| Download Codes | ✅ | Save as text file |
| Print Codes | ✅ | Formatted print view |

## 🎉 Success!

You're now ready to use MFA in the Portfolio Suite!

**Key Takeaways**:
- MFA is **optional** but recommended for security
- Admins manage MFA through the **Users Module**
- **Two tabs**: Basic Information and MFA Security
- **Three steps** to enable MFA
- Always **save backup codes**

---

**Need Help?** Check the comprehensive documentation or contact support.

**Status**: ✅ Ready to Use!

