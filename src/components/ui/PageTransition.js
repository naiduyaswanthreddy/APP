import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Page transition wrapper component
export const PageTransition = ({ children, className = "" }) => {
  const [isVisible, setIsVisible] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Reset visibility on route change
    setIsVisible(false);
    
    // Small delay to allow for smooth transition
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 50);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  return (
    <div 
      className={`transition-all duration-300 ease-in-out ${
        isVisible 
          ? 'opacity-100 translate-y-0' 
          : 'opacity-0 translate-y-2'
      } ${className}`}
    >
      {children}
    </div>
  );
};

// Fade transition component
export const FadeTransition = ({ children, show = true, className = "" }) => (
  <div 
    className={`transition-opacity duration-300 ease-in-out ${
      show ? 'opacity-100' : 'opacity-0'
    } ${className}`}
  >
    {children}
  </div>
);

// Slide transition component
export const SlideTransition = ({ children, show = true, direction = 'up', className = "" }) => {
  const getTransform = () => {
    if (!show) {
      switch (direction) {
        case 'up': return 'translate-y-4';
        case 'down': return '-translate-y-4';
        case 'left': return 'translate-x-4';
        case 'right': return '-translate-x-4';
        default: return 'translate-y-4';
      }
    }
    return 'translate-y-0 translate-x-0';
  };

  return (
    <div 
      className={`transition-all duration-300 ease-in-out ${
        show ? 'opacity-100' : 'opacity-0'
      } ${getTransform()} ${className}`}
    >
      {children}
    </div>
  );
};

// Content loader with transition
export const ContentLoader = ({ 
  loading, 
  skeleton, 
  children, 
  minHeight = "200px",
  className = "" 
}) => {
  const [showContent, setShowContent] = useState(!loading);

  useEffect(() => {
    if (!loading) {
      // Small delay to ensure smooth transition from skeleton to content
      const timer = setTimeout(() => {
        setShowContent(true);
      }, 150);
      return () => clearTimeout(timer);
    } else {
      setShowContent(false);
    }
  }, [loading]);

  return (
    <div className={`relative ${className}`} style={{ minHeight }}>
      {/* Skeleton Loader */}
      <div 
        className={`absolute inset-0 transition-opacity duration-300 ease-in-out ${
          loading ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {skeleton}
      </div>
      
      {/* Actual Content */}
      <div 
        className={`transition-all duration-300 ease-in-out ${
          showContent 
            ? 'opacity-100 translate-y-0' 
            : 'opacity-0 translate-y-2'
        }`}
      >
        {!loading && children}
      </div>
    </div>
  );
};

// Staggered animation for lists
export const StaggeredList = ({ children, staggerDelay = 100, className = "" }) => {
  const [visibleItems, setVisibleItems] = useState(new Set());

  useEffect(() => {
    const items = React.Children.toArray(children);
    items.forEach((_, index) => {
      setTimeout(() => {
        setVisibleItems(prev => new Set([...prev, index]));
      }, index * staggerDelay);
    });

    return () => setVisibleItems(new Set());
  }, [children, staggerDelay]);

  return (
    <div className={className}>
      {React.Children.map(children, (child, index) => (
        <div
          key={index}
          className={`transition-all duration-500 ease-out ${
            visibleItems.has(index)
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-4'
          }`}
        >
          {child}
        </div>
      ))}
    </div>
  );
};

export default {
  PageTransition,
  FadeTransition,
  SlideTransition,
  ContentLoader,
  StaggeredList
};
