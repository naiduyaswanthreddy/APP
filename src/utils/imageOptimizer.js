// Image optimization utilities
export class ImageOptimizer {
  constructor() {
    this.compressionQuality = 0.8;
    this.maxWidth = 1920;
    this.maxHeight = 1080;
    this.thumbnailSize = 300;
  }

  // Compress image file
  async compressImage(file, options = {}) {
    const {
      quality = this.compressionQuality,
      maxWidth = this.maxWidth,
      maxHeight = this.maxHeight,
      format = 'image/jpeg'
    } = options;

    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = this.calculateDimensions(
          img.width, 
          img.height, 
          maxWidth, 
          maxHeight
        );

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(resolve, format, quality);
      };

      img.src = URL.createObjectURL(file);
    });
  }

  // Generate thumbnail
  async generateThumbnail(file, size = this.thumbnailSize) {
    return this.compressImage(file, {
      maxWidth: size,
      maxHeight: size,
      quality: 0.7
    });
  }

  // Calculate optimal dimensions
  calculateDimensions(originalWidth, originalHeight, maxWidth, maxHeight) {
    let width = originalWidth;
    let height = originalHeight;

    // Scale down if necessary
    if (width > maxWidth) {
      height = (height * maxWidth) / width;
      width = maxWidth;
    }

    if (height > maxHeight) {
      width = (width * maxHeight) / height;
      height = maxHeight;
    }

    return { width: Math.round(width), height: Math.round(height) };
  }

  // Convert to WebP if supported
  async convertToWebP(file) {
    if (!this.supportsWebP()) {
      return file;
    }

    return this.compressImage(file, { format: 'image/webp' });
  }

  // Check WebP support
  supportsWebP() {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }

  // Lazy loading implementation
  setupLazyLoading() {
    if (!('IntersectionObserver' in window)) {
      // Fallback for older browsers
      return this.fallbackLazyLoading();
    }

    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          this.loadImage(img);
          observer.unobserve(img);
        }
      });
    }, {
      rootMargin: '50px 0px',
      threshold: 0.01
    });

    // Observe all lazy images
    document.querySelectorAll('img[data-src]').forEach(img => {
      imageObserver.observe(img);
    });

    return imageObserver;
  }

  // Load image with error handling
  loadImage(img) {
    const src = img.dataset.src;
    if (!src) return;

    // Create a new image to preload
    const imageLoader = new Image();
    
    imageLoader.onload = () => {
      img.src = src;
      img.classList.remove('lazy-loading');
      img.classList.add('lazy-loaded');
    };

    imageLoader.onerror = () => {
      img.src = '/placeholder-image.jpg'; // Fallback image
      img.classList.remove('lazy-loading');
      img.classList.add('lazy-error');
    };

    img.classList.add('lazy-loading');
    imageLoader.src = src;
  }

  // Fallback for browsers without IntersectionObserver
  fallbackLazyLoading() {
    const lazyImages = document.querySelectorAll('img[data-src]');
    
    const loadImagesInViewport = () => {
      lazyImages.forEach(img => {
        if (this.isInViewport(img)) {
          this.loadImage(img);
        }
      });
    };

    // Load images on scroll and resize
    window.addEventListener('scroll', loadImagesInViewport);
    window.addEventListener('resize', loadImagesInViewport);
    
    // Initial load
    loadImagesInViewport();

    return {
      disconnect: () => {
        window.removeEventListener('scroll', loadImagesInViewport);
        window.removeEventListener('resize', loadImagesInViewport);
      }
    };
  }

  // Check if element is in viewport
  isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  // Progressive image loading
  createProgressiveImage(src, placeholder = '') {
    const img = document.createElement('img');
    img.className = 'progressive-image';
    
    if (placeholder) {
      img.src = placeholder;
      img.classList.add('placeholder');
    }

    const fullImage = new Image();
    fullImage.onload = () => {
      img.src = src;
      img.classList.remove('placeholder');
      img.classList.add('loaded');
    };
    
    fullImage.src = src;
    return img;
  }
}

// React hook for image optimization
import { useState, useEffect, useCallback } from 'react';

export const useImageOptimization = () => {
  const [optimizer] = useState(() => new ImageOptimizer());

  const compressImage = useCallback(async (file, options) => {
    return optimizer.compressImage(file, options);
  }, [optimizer]);

  const generateThumbnail = useCallback(async (file, size) => {
    return optimizer.generateThumbnail(file, size);
  }, [optimizer]);

  useEffect(() => {
    const observer = optimizer.setupLazyLoading();
    return () => observer?.disconnect();
  }, [optimizer]);

  return {
    compressImage,
    generateThumbnail,
    supportsWebP: optimizer.supportsWebP()
  };
};

// React component for optimized images
import React, { useState, useRef, useEffect } from 'react';

export const OptimizedImage = ({ 
  src, 
  alt, 
  className = '', 
  placeholder = '',
  lazy = true,
  ...props 
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef();

  useEffect(() => {
    if (!lazy || !imgRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const img = imgRef.current;
          img.src = src;
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, [src, lazy]);

  const handleLoad = () => setLoaded(true);
  const handleError = () => setError(true);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <img
        ref={imgRef}
        src={lazy ? placeholder : src}
        alt={alt}
        className={`transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0'
        } ${error ? 'hidden' : ''}`}
        onLoad={handleLoad}
        onError={handleError}
        {...props}
      />
      
      {!loaded && !error && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
          </svg>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <span className="text-gray-500 text-sm">Failed to load image</span>
        </div>
      )}
    </div>
  );
};
