# Universal Authentication System

## Overview

The Universal Authentication System provides consistent login/logout functionality across all pages in the PRM project. It replaces individual page-specific authentication with a centralized, cross-tab synchronized system.

## Features

✅ **Universal Login/Logout** - Single authentication system for all pages  
✅ **Cross-Tab Synchronization** - Login/logout syncs across browser tabs  
✅ **Session Management** - 6-hour auto-expiry with manual logout  
✅ **Persistent Sessions** - Sessions survive page refreshes and navigation  
✅ **View/Edit Modes** - Automatic UI updates based on authentication status  
✅ **Modern UI** - Gradient buttons and professional modal design  
✅ **Backward Compatibility** - Works with existing page-specific code  

## Architecture

### Core Components

1. **`js/universal-auth.js`** - Authentication logic and session management
2. **`js/universal-ui.js`** - UI components and page integration
3. **Page Integration** - Each page includes both scripts

### Authentication Flow

```
Page Load → Check Existing Session → Update UI → Listen for Changes
     ↓
User Clicks Login → Show Modal → Validate Credentials → Update All Pages
     ↓
Session Active → Enable Admin Features → Auto-expire After 6 Hours
     ↓
User Clicks Logout → Clear Session → Update All Pages → Show View Mode
```

## Implementation

### 1. Page Integration

Add these scripts to every HTML page:

```html
<script src="js/universal-auth.js"></script>
<script src="js/universal-ui.js"></script>
```

### 2. Authentication State

The system provides global access to authentication status:

```javascript
// Check if user is authenticated
if (window.isAuthenticated()) {
    // Show admin features
}

// Get user data
const userData = window.getUserData();
console.log(userData.username, userData.role);

// Show login modal
window.showAuthModal();

// Logout user
window.logout();
```

### 3. Page-Specific Integration

Pages can listen for authentication changes:

```javascript
document.addEventListener('universalAuthChange', (e) => {
    const { isAuthenticated, userData } = e.detail;
    
    if (isAuthenticated) {
        // Enable admin features
        showAdminButtons();
    } else {
        // Show view-only mode
        hideAdminButtons();
    }
});
```

## UI Components

### Authentication Buttons

The system automatically injects authentication buttons into page headers:

- **🔐 Admin Login** - Shows when not authenticated
- **🚪 Logout** - Shows when authenticated  
- **👤 Admin** - Shows current user status

### Authentication Modal

Professional modal with:
- Gradient design and animations
- Keyboard navigation (Tab, Enter)
- Error handling and validation
- Demo credentials display

### Status Indicators

Automatic status updates on all pages:
- **✅ Admin Mode** - Full features available
- **👀 View Mode** - Read-only access with login prompt

## Session Management

### Session Duration
- **6 hours** automatic expiry
- **Cross-tab sync** - Login/logout affects all tabs
- **Persistent storage** - Survives page refreshes

### Session Storage
```javascript
// Stored in localStorage as 'prm_auth_session'
{
    sessionStart: timestamp,
    userData: { username, role, loginTime },
    timestamp: currentTime
}
```

### Auto-Validation
- Checks session every minute
- Automatic logout on expiry
- Cross-tab synchronization via storage events

## Page-Specific Behavior

### All Members Page (`all-members.html`)
- **Authenticated**: Show Create/Edit/Delete buttons
- **Unauthenticated**: View-only mode, hide action buttons
- **Integration**: Updates table rendering and CRUD operations

### Task Tracking Page (`task-tracking.html`)
- **Authenticated**: Enable task creation, editing, import/export
- **Unauthenticated**: View tasks and analytics only
- **Integration**: Updates UI state and task management features

### Recruitment Page (`recruitment.html`)
- **Authenticated**: Enable status updates and management
- **Unauthenticated**: View candidate information only
- **Integration**: Disable status change controls

### Other Pages
- **Core Team**: View-only functionality
- **Waiting Room**: Display functionality
- **Join Us**: Public access form
- **Dashboard**: Analytics and overview

## Credentials

### Demo Credentials
- **Username**: `admin`
- **Password**: `admin123`

### Security Features
- Credential validation
- Session timeout
- Cross-tab logout
- Secure session storage

## Migration from Legacy Auth

### Before (Page-Specific)
```javascript
// Each page had its own auth system
const authState = { isAuthenticated: false };
function showAuthModal() { /* page-specific */ }
function handleLogin() { /* page-specific */ }
```

### After (Universal)
```javascript
// Global authentication system
if (window.isAuthenticated()) { /* universal */ }
window.showAuthModal(); // universal modal
window.logout(); // universal logout
```

### Compatibility
- Legacy `authState` objects are updated automatically
- Existing functions are redirected to universal system
- No breaking changes to existing functionality

## Troubleshooting

### Common Issues

1. **Buttons Not Showing**
   - Check if scripts are loaded in correct order
   - Verify page has proper header structure

2. **Session Not Persisting**
   - Check localStorage permissions
   - Verify cross-tab functionality

3. **UI Not Updating**
   - Check for JavaScript errors in console
   - Verify event listeners are properly attached

### Debug Information

Enable debug logging:
```javascript
// Check authentication status
console.log('Auth Status:', window.isAuthenticated());
console.log('User Data:', window.getUserData());
console.log('Session Storage:', localStorage.getItem('prm_auth_session'));
```

## Future Enhancements

### Planned Features
- **Role-based permissions** (Admin, Coordinator, Member)
- **Multi-user support** with different access levels
- **Password reset functionality**
- **Session activity tracking**
- **Advanced security features**

### Integration Opportunities
- **Supabase Auth** integration for production
- **OAuth providers** (Google, Facebook)
- **Two-factor authentication**
- **Audit logging** for admin actions

## API Reference

### Global Functions

```javascript
// Authentication
window.isAuthenticated() → boolean
window.getUserData() → object | null
window.showAuthModal() → void
window.logout() → void

// Events
document.addEventListener('universalAuthChange', handler)
```

### UniversalAuthSystem Class

```javascript
// Core methods
universalAuthSystem.handleLogin()
universalAuthSystem.logout()
universalAuthSystem.validateSession()
universalAuthSystem.showMessage(message, type)
```

### UniversalUI Class

```javascript
// UI management
universalUI.updateUIBasedOnAuth(isAuthenticated, userData)
universalUI.notifyPageOfAuthChange(isAuthenticated, userData)
```

## Conclusion

The Universal Authentication System provides a robust, user-friendly authentication experience across the entire PRM project. It maintains backward compatibility while offering modern features like cross-tab synchronization and persistent sessions.

The system is designed to be:
- **Easy to integrate** - Just include two script files
- **Backward compatible** - Works with existing code
- **User-friendly** - Professional UI and smooth experience
- **Maintainable** - Centralized logic and consistent behavior

For support or questions, refer to the implementation files or check the browser console for debug information.