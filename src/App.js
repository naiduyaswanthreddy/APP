import React, { useEffect, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AuthHandler from "./AuthHandler";
import Loader from './loading';
import { ThemeProvider } from './context/ThemeContext';
import { GlobalErrorBoundary } from './utils/errorHandler';
import { performanceMonitor } from './utils/performanceMonitor';
import { initializeFCM, setupForegroundMessageListener } from './utils/fcmHelpers';
// Import new components


function App() {
  // Add this effect to check for company role on app load
  useEffect(() => {
    // Initialize performance monitoring
    performanceMonitor.init();
    
    // Initialize Firebase Cloud Messaging
    const initializePushNotifications = async () => {
      try {
        console.log('Initializing FCM...');
        const fcmInitialized = initializeFCM();
        
        if (fcmInitialized) {
          console.log('FCM initialized successfully');
          
          // Set up foreground message listener
          const unsubscribe = setupForegroundMessageListener((payload) => {
            console.log('Foreground message received:', payload);
            
            // Show browser notification if app is in focus
            if (document.visibilityState === 'visible' && 'Notification' in window && Notification.permission === 'granted') {
              const notification = new Notification(
                payload.notification?.title || 'New Notification',
                {
                  body: payload.notification?.body || '',
                  icon: payload.notification?.icon || '/logo192.png',
                  badge: '/favicon.ico',
                  tag: payload.data?.notificationId || 'default',
                  data: payload.data || {},
                  requireInteraction: false
                }
              );

              // Handle notification click
              notification.onclick = () => {
                window.focus();
                if (payload.data?.actionLink) {
                  window.location.href = payload.data.actionLink;
                }
                notification.close();
              };

              // Auto close after 5 seconds
              setTimeout(() => notification.close(), 5000);
            }
          });
          
          // Store unsubscribe function for cleanup
          window.fcmUnsubscribe = unsubscribe;
        } else {
          console.log('FCM not supported on this device/browser');
        }
      } catch (error) {
        console.error('Error initializing FCM:', error);
      }
    };

    // Initialize FCM after a short delay to ensure DOM is ready
    setTimeout(initializePushNotifications, 1000);
    
    // Check if we're at the root or login page
    const isRootOrLogin = ["/", "/login"].includes(window.location.pathname);
    
    if (isRootOrLogin) {
      // Check if userRole is company
      const userRole = localStorage.getItem("userRole");
      if (userRole === "company") {
        // Clear the userRole to prevent redirect loops
        localStorage.removeItem("userRole");
        // Force reload to ensure clean state
        window.location.reload();
      }
    }

    // Cleanup on unmount
    return () => {
      performanceMonitor.cleanup();
      // Cleanup FCM listener
      if (window.fcmUnsubscribe) {
        window.fcmUnsubscribe();
      }
    };
  }, []);

  return (
    <GlobalErrorBoundary>
      <ThemeProvider>
        <Router>
          <Routes>
            {/* Add explicit root path redirect to login */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            
            {/* Company specific routes with exact paths */}
           
            
            {/* AuthHandler for all other routes */}
            <Route path="/*" element={
              <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center"><Loader /></div>}>
                <AuthHandler />
              </Suspense>
            } />
          </Routes>
        </Router>
      </ThemeProvider>
    </GlobalErrorBoundary>
  );
}

export default App;

