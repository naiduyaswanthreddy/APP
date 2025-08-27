import { useState, useEffect, useCallback } from 'react';
import { collection, query, getDocs, limit, startAfter, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase';

// Custom hook for optimized Firebase queries with caching and pagination
export const useFirebaseQuery = (collectionName, queryConfig = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState(null);

  const {
    pageSize = 20,
    orderByField = 'createdAt',
    orderDirection = 'desc',
    whereConditions = [],
    enableCache = true,
    cacheKey = `${collectionName}_${JSON.stringify(queryConfig)}`
  } = queryConfig;

  // Cache implementation
  const getCachedData = useCallback(() => {
    if (!enableCache) return null;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { data: cachedData, timestamp } = JSON.parse(cached);
      // Cache valid for 5 minutes
      if (Date.now() - timestamp < 5 * 60 * 1000) {
        return cachedData;
      }
    }
    return null;
  }, [cacheKey, enableCache]);

  const setCachedData = useCallback((data) => {
    if (!enableCache) return;
    localStorage.setItem(cacheKey, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  }, [cacheKey, enableCache]);

  const fetchData = useCallback(async (isLoadMore = false) => {
    try {
      setLoading(true);
      setError(null);

      // Check cache for initial load
      if (!isLoadMore) {
        const cachedData = getCachedData();
        if (cachedData) {
          setData(cachedData);
          setLoading(false);
          return;
        }
      }

      let q = collection(db, collectionName);

      // Apply where conditions
      whereConditions.forEach(condition => {
        q = query(q, where(condition.field, condition.operator, condition.value));
      });

      // Apply ordering
      q = query(q, orderBy(orderByField, orderDirection));

      // Apply pagination
      if (isLoadMore && lastDoc) {
        q = query(q, startAfter(lastDoc));
      }
      q = query(q, limit(pageSize));

      const querySnapshot = await getDocs(q);
      const newData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      if (isLoadMore) {
        setData(prev => [...prev, ...newData]);
      } else {
        setData(newData);
        setCachedData(newData);
      }

      // Update pagination state
      setHasMore(querySnapshot.docs.length === pageSize);
      setLastDoc(querySnapshot.docs[querySnapshot.docs.length - 1] || null);

    } catch (err) {
      console.error(`Error fetching ${collectionName}:`, err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [collectionName, pageSize, orderByField, orderDirection, whereConditions, lastDoc, getCachedData, setCachedData]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchData(true);
    }
  }, [loading, hasMore, fetchData]);

  const refresh = useCallback(() => {
    setLastDoc(null);
    setHasMore(true);
    if (enableCache) {
      localStorage.removeItem(cacheKey);
    }
    fetchData(false);
  }, [fetchData, enableCache, cacheKey]);

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    hasMore,
    loadMore,
    refresh
  };
};

// Hook for real-time queries with optimizations
export const useRealtimeQuery = (collectionName, queryConfig = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const {
    orderByField = 'createdAt',
    orderDirection = 'desc',
    whereConditions = [],
    limitCount = 50
  } = queryConfig;

  useEffect(() => {
    let q = collection(db, collectionName);

    // Apply where conditions
    whereConditions.forEach(condition => {
      q = query(q, where(condition.field, condition.operator, condition.value));
    });

    // Apply ordering and limit
    q = query(q, orderBy(orderByField, orderDirection), limit(limitCount));

    const unsubscribe = onSnapshot(q, 
      (querySnapshot) => {
        const newData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setData(newData);
        setLoading(false);
      },
      (err) => {
        console.error(`Error in realtime query for ${collectionName}:`, err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [collectionName, orderByField, orderDirection, whereConditions, limitCount]);

  return { data, loading, error };
};
