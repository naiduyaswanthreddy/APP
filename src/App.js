import React, { useEffect, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AuthHandler from "./AuthHandler";
import Loader from './loading';
// Import new components


function App() {
  // Add this effect to check for company role on app load
  useEffect(() => {
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
  }, []);

  return (
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
  );
}

export default App;

