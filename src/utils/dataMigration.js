import { collection, getDocs, doc, getDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Data Migration Script to Fix Salary/Stipend Inconsistencies
 * This script updates existing applications to have correct salary/stipend data from job collection
 */

export const migrateSalaryData = async () => {
  console.log('Starting salary data migration...');
  
  try {
    // Get all applications
    const applicationsRef = collection(db, 'applications');
    const applicationsSnapshot = await getDocs(applicationsRef);
    
    let migratedCount = 0;
    let errorCount = 0;
    const batchSize = 500; // Firestore batch limit
    let batch = writeBatch(db);
    let operationCount = 0;
    
    console.log(`Found ${applicationsSnapshot.size} applications to process`);
    
    for (const appDoc of applicationsSnapshot.docs) {
      try {
        const appData = appDoc.data();
        const jobId = appData.jobId || appData.job_id;
        
        if (!jobId) {
          console.warn(`Application ${appDoc.id} has no jobId, skipping`);
          continue;
        }
        
        // Get job data
        const jobRef = doc(db, 'jobs', jobId);
        const jobDoc = await getDoc(jobRef);
        
        if (!jobDoc.exists()) {
          console.warn(`Job ${jobId} not found for application ${appDoc.id}, skipping`);
          continue;
        }
        
        const jobData = jobDoc.data();
        
        // Prepare updated job data with complete salary information
        const updatedJobData = {
          position: jobData.position || '',
          company: jobData.company || '',
          location: jobData.location || '',
          // Complete salary/compensation data from job collection
          ctc: jobData.ctc || '',
          minCtc: jobData.minCtc || '',
          maxCtc: jobData.maxCtc || '',
          salary: jobData.salary || '',
          minSalary: jobData.minSalary || '',
          maxSalary: jobData.maxSalary || '',
          basePay: jobData.basePay || '',
          variablePay: jobData.variablePay || '',
          bonuses: jobData.bonuses || '',
          compensationType: jobData.compensationType || '',
          ctcUnit: jobData.ctcUnit || '',
          salaryUnit: jobData.salaryUnit || '',
          // Additional job details for consistency
          jobTypes: jobData.jobTypes || '',
          workMode: jobData.workMode || '',
          internshipDuration: jobData.internshipDuration || '',
          internshipDurationUnit: jobData.internshipDurationUnit || ''
        };
        
        // Update application with correct job data
        const appRef = doc(db, 'applications', appDoc.id);
        batch.update(appRef, {
          job: updatedJobData,
          updatedAt: new Date(),
          migratedAt: new Date()
        });
        
        operationCount++;
        migratedCount++;
        
        // Commit batch when it reaches the limit
        if (operationCount >= batchSize) {
          await batch.commit();
          console.log(`Committed batch of ${operationCount} operations`);
          batch = writeBatch(db);
          operationCount = 0;
        }
        
      } catch (error) {
        console.error(`Error processing application ${appDoc.id}:`, error);
        errorCount++;
      }
    }
    
    // Commit remaining operations
    if (operationCount > 0) {
      await batch.commit();
      console.log(`Committed final batch of ${operationCount} operations`);
    }
    
    console.log(`Migration completed successfully!`);
    console.log(`- Applications migrated: ${migratedCount}`);
    console.log(`- Errors encountered: ${errorCount}`);
    
    return {
      success: true,
      migratedCount,
      errorCount,
      message: `Successfully migrated ${migratedCount} applications with ${errorCount} errors`
    };
    
  } catch (error) {
    console.error('Migration failed:', error);
    return {
      success: false,
      error: error.message,
      message: 'Migration failed due to an error'
    };
  }
};

/**
 * Verify migration results by checking a sample of applications
 */
export const verifyMigration = async (sampleSize = 10) => {
  console.log('Verifying migration results...');
  
  try {
    const applicationsRef = collection(db, 'applications');
    const applicationsSnapshot = await getDocs(applicationsRef);
    
    const applications = applicationsSnapshot.docs.slice(0, sampleSize);
    let verifiedCount = 0;
    let issuesFound = 0;
    
    for (const appDoc of applications) {
      const appData = appDoc.data();
      const jobId = appData.jobId || appData.job_id;
      
      if (!jobId || !appData.job) {
        console.warn(`Application ${appDoc.id} missing job data`);
        issuesFound++;
        continue;
      }
      
      // Get original job data
      const jobRef = doc(db, 'jobs', jobId);
      const jobDoc = await getDoc(jobRef);
      
      if (!jobDoc.exists()) {
        console.warn(`Job ${jobId} not found`);
        issuesFound++;
        continue;
      }
      
      const jobData = jobDoc.data();
      const appJobData = appData.job;
      
      // Check if salary data matches
      const salaryFields = ['ctc', 'minCtc', 'maxCtc', 'salary', 'minSalary', 'maxSalary', 'basePay', 'variablePay', 'bonuses'];
      let fieldMatches = 0;
      
      for (const field of salaryFields) {
        if ((jobData[field] || '') === (appJobData[field] || '')) {
          fieldMatches++;
        }
      }
      
      if (fieldMatches === salaryFields.length) {
        verifiedCount++;
      } else {
        console.warn(`Application ${appDoc.id} has mismatched salary data`);
        issuesFound++;
      }
    }
    
    console.log(`Verification completed:`);
    console.log(`- Applications verified: ${verifiedCount}/${applications.length}`);
    console.log(`- Issues found: ${issuesFound}`);
    
    return {
      success: issuesFound === 0,
      verifiedCount,
      issuesFound,
      totalChecked: applications.length
    };
    
  } catch (error) {
    console.error('Verification failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Run the complete migration process
 */
export const runCompleteMigration = async () => {
  console.log('Starting complete salary data migration process...');
  
  // Step 1: Run migration
  const migrationResult = await migrateSalaryData();
  
  if (!migrationResult.success) {
    return migrationResult;
  }
  
  // Step 2: Wait a moment for data to settle
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Step 3: Verify migration
  const verificationResult = await verifyMigration(20);
  
  return {
    migration: migrationResult,
    verification: verificationResult,
    success: migrationResult.success && verificationResult.success,
    message: `Migration: ${migrationResult.message}. Verification: ${verificationResult.success ? 'Passed' : 'Failed'}`
  };
};
