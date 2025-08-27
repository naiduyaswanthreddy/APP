// Lazy Loading Components for Performance Optimization
import { lazy, Suspense } from 'react';
import Loader from '../loading';

// Lazy load admin components
export const LazyAdminDashboard = lazy(() => 
  import('./admin/useAnalyticsData').then(module => ({ default: module.default }))
);

export const LazyJobPost = lazy(() => 
  import('./admin/JobPost')
);

export const LazyCompanies = lazy(() => 
  import('./admin/Companies')
);

export const LazyCompaniesNew = lazy(() => 
  import('./admin/CompaniesNew')
);

export const LazyCompaniesFixed = lazy(() => 
  import('./admin/CompaniesFixed')
);

// Lazy load student components
export const LazyStudentProfile = lazy(() => 
  import('./student/ProfileAcademics')
);

export const LazyResumeBuilder = lazy(() => 
  import('./student/Resume maker/src/App')
);

export const LazyJobCards = lazy(() => 
  import('./student/JobCards')
);

export const LazyJobDetails = lazy(() => 
  import('./student/JobDetails')
);

// Higher-order component for lazy loading with error boundary
export const withLazyLoading = (LazyComponent, fallback = <Loader />) => {
  return function LazyLoadedComponent(props) {
    return (
      <Suspense fallback={fallback}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
};

// Code splitting utility for route-based loading
export const createLazyRoute = (importFunction, fallback = <Loader />) => {
  const LazyComponent = lazy(importFunction);
  
  return function LazyRoute(props) {
    return (
      <Suspense fallback={fallback}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
};

// Preload components for better UX
export const preloadComponent = (importFunction) => {
  const componentImport = importFunction();
  return componentImport;
};

// Intersection Observer for lazy loading on scroll
export const useLazyLoadOnScroll = (ref, threshold = 0.1) => {
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    
    if (ref.current) {
      observer.observe(ref.current);
    }
    
    return () => observer.disconnect();
  }, [ref, threshold]);
  
  return isVisible;
};
