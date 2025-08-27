// Firebase query optimization utilities
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter, 
  getDocs,
  doc,
  getDoc,
  writeBatch,
  enableNetwork,
  disableNetwork
} from 'firebase/firestore';
import { db } from '../firebase';
import { cacheManager } from './performanceOptimizer';

class FirebaseOptimizer {
  constructor() {
    this.batchSize = 500;
    this.queryCache = new Map();
    this.indexHints = new Map();
  }

  // Optimized batch operations
  async batchWrite(operations) {
    const batches = [];
    let currentBatch = writeBatch(db);
    let operationCount = 0;

    for (const operation of operations) {
      const { type, ref, data } = operation;
      
      switch (type) {
        case 'set':
          currentBatch.set(ref, data);
          break;
        case 'update':
          currentBatch.update(ref, data);
          break;
        case 'delete':
          currentBatch.delete(ref);
          break;
      }

      operationCount++;

      // Firestore batch limit is 500 operations
      if (operationCount === this.batchSize) {
        batches.push(currentBatch);
        currentBatch = writeBatch(db);
        operationCount = 0;
      }
    }

    // Add the last batch if it has operations
    if (operationCount > 0) {
      batches.push(currentBatch);
    }

    // Execute all batches
    const results = await Promise.all(batches.map(batch => batch.commit()));
    return results;
  }

  // Optimized pagination with cursor-based approach
  async paginatedQuery(collectionName, queryConstraints = [], pageSize = 20, lastDoc = null) {
    const cacheKey = `paginated_${collectionName}_${JSON.stringify(queryConstraints)}_${pageSize}_${lastDoc?.id || 'first'}`;
    
    // Check cache first
    const cached = cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    let q = collection(db, collectionName);

    // Apply query constraints
    queryConstraints.forEach(constraint => {
      if (constraint.type === 'where') {
        q = query(q, where(constraint.field, constraint.operator, constraint.value));
      } else if (constraint.type === 'orderBy') {
        q = query(q, orderBy(constraint.field, constraint.direction));
      }
    });

    // Add pagination
    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }
    q = query(q, limit(pageSize));

    const snapshot = await getDocs(q);
    const docs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const result = {
      docs,
      lastDoc: snapshot.docs[snapshot.docs.length - 1],
      hasMore: snapshot.docs.length === pageSize
    };

    // Cache the result
    cacheManager.set(cacheKey, result, 300000); // 5 minutes cache
    return result;
  }

  // Optimized multi-document fetch
  async getMultipleDocuments(collectionName, docIds) {
    const cacheKey = `multi_docs_${collectionName}_${docIds.sort().join('_')}`;
    const cached = cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Split into batches of 10 (Firestore limit for 'in' queries)
    const batches = [];
    for (let i = 0; i < docIds.length; i += 10) {
      batches.push(docIds.slice(i, i + 10));
    }

    const allDocs = [];
    for (const batch of batches) {
      const q = query(
        collection(db, collectionName),
        where('__name__', 'in', batch.map(id => doc(db, collectionName, id)))
      );
      const snapshot = await getDocs(q);
      allDocs.push(...snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }

    cacheManager.set(cacheKey, allDocs, 300000);
    return allDocs;
  }

  // Optimized search with composite indexes
  async searchWithFilters(collectionName, filters, searchTerm = '') {
    const cacheKey = `search_${collectionName}_${JSON.stringify(filters)}_${searchTerm}`;
    const cached = cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    let q = collection(db, collectionName);

    // Apply filters in optimal order (equality first, then range, then orderBy)
    const equalityFilters = filters.filter(f => f.operator === '==');
    const rangeFilters = filters.filter(f => ['>', '>=', '<', '<='].includes(f.operator));
    const arrayFilters = filters.filter(f => ['array-contains', 'array-contains-any', 'in'].includes(f.operator));

    // Apply equality filters first
    equalityFilters.forEach(filter => {
      q = query(q, where(filter.field, filter.operator, filter.value));
    });

    // Apply array filters
    arrayFilters.forEach(filter => {
      q = query(q, where(filter.field, filter.operator, filter.value));
    });

    // Apply range filters (only one range filter per query in Firestore)
    if (rangeFilters.length > 0) {
      const rangeFilter = rangeFilters[0];
      q = query(q, where(rangeFilter.field, rangeFilter.operator, rangeFilter.value));
    }

    // Add ordering and limit
    q = query(q, orderBy('createdAt', 'desc'), limit(100));

    const snapshot = await getDocs(q);
    let docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Client-side filtering for additional range filters and search term
    if (rangeFilters.length > 1) {
      rangeFilters.slice(1).forEach(filter => {
        docs = docs.filter(doc => {
          const value = doc[filter.field];
          switch (filter.operator) {
            case '>': return value > filter.value;
            case '>=': return value >= filter.value;
            case '<': return value < filter.value;
            case '<=': return value <= filter.value;
            default: return true;
          }
        });
      });
    }

    // Client-side text search
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      docs = docs.filter(doc => {
        return Object.values(doc).some(value => 
          typeof value === 'string' && value.toLowerCase().includes(searchLower)
        );
      });
    }

    cacheManager.set(cacheKey, docs, 300000);
    return docs;
  }

  // Connection management
  async enableOfflineSupport() {
    try {
      await enableNetwork(db);
      console.log('Firebase offline support enabled');
    } catch (error) {
      console.error('Failed to enable offline support:', error);
    }
  }

  async disableOfflineSupport() {
    try {
      await disableNetwork(db);
      console.log('Firebase offline support disabled');
    } catch (error) {
      console.error('Failed to disable offline support:', error);
    }
  }

  // Query optimization suggestions
  suggestIndexes(collectionName, queryConstraints) {
    const suggestions = [];
    const whereFields = [];
    const orderByFields = [];

    queryConstraints.forEach(constraint => {
      if (constraint.type === 'where') {
        whereFields.push(constraint.field);
      } else if (constraint.type === 'orderBy') {
        orderByFields.push(constraint.field);
      }
    });

    // Suggest composite index
    if (whereFields.length > 1 || (whereFields.length > 0 && orderByFields.length > 0)) {
      const indexFields = [...whereFields, ...orderByFields];
      suggestions.push({
        collection: collectionName,
        fields: indexFields,
        type: 'composite'
      });
    }

    // Suggest single field indexes
    [...whereFields, ...orderByFields].forEach(field => {
      suggestions.push({
        collection: collectionName,
        fields: [field],
        type: 'single'
      });
    });

    return suggestions;
  }

  // Performance monitoring for queries
  async monitoredQuery(queryFunction, queryName) {
    const startTime = performance.now();
    
    try {
      const result = await queryFunction();
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Log slow queries
      if (duration > 1000) {
        console.warn(`Slow query detected: ${queryName} took ${duration.toFixed(2)}ms`);
      }

      // Store query performance data
      const perfData = JSON.parse(localStorage.getItem('query_performance') || '{}');
      if (!perfData[queryName]) {
        perfData[queryName] = [];
      }
      perfData[queryName].push({
        duration,
        timestamp: Date.now(),
        resultCount: Array.isArray(result) ? result.length : 1
      });

      // Keep only last 10 measurements per query
      if (perfData[queryName].length > 10) {
        perfData[queryName] = perfData[queryName].slice(-10);
      }

      localStorage.setItem('query_performance', JSON.stringify(perfData));
      return result;
    } catch (error) {
      const endTime = performance.now();
      console.error(`Query failed: ${queryName} after ${(endTime - startTime).toFixed(2)}ms`, error);
      throw error;
    }
  }

  // Bulk data migration utility
  async migrateData(sourceCollection, targetCollection, transformFunction, batchSize = 100) {
    let lastDoc = null;
    let processedCount = 0;

    while (true) {
      let q = query(collection(db, sourceCollection), limit(batchSize));
      if (lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const snapshot = await getDocs(q);
      if (snapshot.empty) break;

      const batch = writeBatch(db);
      
      snapshot.docs.forEach(docSnap => {
        const sourceData = docSnap.data();
        const transformedData = transformFunction(sourceData);
        const targetRef = doc(db, targetCollection, docSnap.id);
        batch.set(targetRef, transformedData);
      });

      await batch.commit();
      processedCount += snapshot.docs.length;
      lastDoc = snapshot.docs[snapshot.docs.length - 1];

      console.log(`Migrated ${processedCount} documents...`);

      if (snapshot.docs.length < batchSize) break;
    }

    console.log(`Migration complete. Processed ${processedCount} documents.`);
    return processedCount;
  }
}

// Create singleton instance
export const firebaseOptimizer = new FirebaseOptimizer();

// Convenience functions
export const paginatedQuery = (collectionName, queryConstraints, pageSize, lastDoc) =>
  firebaseOptimizer.paginatedQuery(collectionName, queryConstraints, pageSize, lastDoc);

export const batchWrite = (operations) =>
  firebaseOptimizer.batchWrite(operations);

export const searchWithFilters = (collectionName, filters, searchTerm) =>
  firebaseOptimizer.searchWithFilters(collectionName, filters, searchTerm);

export const monitoredQuery = (queryFunction, queryName) =>
  firebaseOptimizer.monitoredQuery(queryFunction, queryName);
