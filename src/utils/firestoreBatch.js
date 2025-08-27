/**
 * Utility functions for batched Firestore operations
 */
import { writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Split array into chunks of specified size
 * @param {Array} array - Array to chunk
 * @param {number} size - Chunk size
 * @returns {Array[]} - Array of chunks
 */
export const chunk = (array, size) => {
  if (!Array.isArray(array) || size <= 0) return [];
  
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

/**
 * Execute batched Firestore operations
 * @param {Array} operations - Array of operation objects
 * @param {number} batchSize - Maximum operations per batch (default 400)
 * @returns {Promise<Array>} - Array of batch results
 */
export const runBatches = async (operations, batchSize = 400) => {
  if (!Array.isArray(operations) || operations.length === 0) {
    return [];
  }

  const batches = chunk(operations, batchSize);
  const results = [];

  for (const batchOps of batches) {
    const batch = writeBatch(db);
    
    batchOps.forEach(operation => {
      const { type, ref, data } = operation;
      
      switch (type) {
        case 'set':
          batch.set(ref, data);
          break;
        case 'update':
          batch.update(ref, data);
          break;
        case 'delete':
          batch.delete(ref);
          break;
        default:
          console.warn(`Unknown batch operation type: ${type}`);
      }
    });

    try {
      await batch.commit();
      results.push({ success: true, count: batchOps.length });
    } catch (error) {
      console.error('Batch operation failed:', error);
      results.push({ success: false, error, count: batchOps.length });
    }
  }

  return results;
};

/**
 * Create batch operation object
 * @param {string} type - Operation type ('set', 'update', 'delete')
 * @param {string} collection - Collection name
 * @param {string} docId - Document ID
 * @param {Object} data - Data for set/update operations
 * @returns {Object} - Batch operation object
 */
export const createBatchOperation = (type, collection, docId, data = null) => {
  const ref = doc(db, collection, docId);
  return { type, ref, data };
};

/**
 * Execute operations with retry logic
 * @param {Array} operations - Array of operations
 * @param {number} maxRetries - Maximum retry attempts
 * @param {number} batchSize - Batch size
 * @returns {Promise<Object>} - Execution results
 */
export const runBatchesWithRetry = async (operations, maxRetries = 3, batchSize = 400) => {
  let attempt = 0;
  let remainingOps = [...operations];
  const successfulOps = [];
  const failedOps = [];

  while (attempt < maxRetries && remainingOps.length > 0) {
    attempt++;
    
    try {
      const results = await runBatches(remainingOps, batchSize);
      
      let processedCount = 0;
      const newFailedOps = [];
      
      results.forEach((result, index) => {
        const batchOps = remainingOps.slice(processedCount, processedCount + result.count);
        
        if (result.success) {
          successfulOps.push(...batchOps);
        } else {
          newFailedOps.push(...batchOps);
        }
        
        processedCount += result.count;
      });
      
      remainingOps = newFailedOps;
      
      if (remainingOps.length === 0) {
        break;
      }
      
      // Wait before retry
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
      
    } catch (error) {
      console.error(`Batch execution attempt ${attempt} failed:`, error);
      
      if (attempt === maxRetries) {
        failedOps.push(...remainingOps);
        break;
      }
    }
  }

  return {
    successful: successfulOps.length,
    failed: failedOps.length,
    successfulOps,
    failedOps,
    totalAttempts: attempt
  };
};
