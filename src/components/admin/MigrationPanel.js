import React, { useState } from 'react';
import { runCompleteMigration, verifyMigration } from '../../utils/dataMigration';
import { toast } from 'react-toastify';
import { Database, CheckCircle, AlertTriangle, Play, RefreshCw } from 'lucide-react';

const MigrationPanel = () => {
  const [migrationStatus, setMigrationStatus] = useState('idle'); // idle, running, completed, error
  const [migrationResults, setMigrationResults] = useState(null);
  const [verificationResults, setVerificationResults] = useState(null);

  const handleRunMigration = async () => {
    setMigrationStatus('running');
    setMigrationResults(null);
    setVerificationResults(null);
    
    try {
      toast.info('Starting salary data migration...');
      
      const results = await runCompleteMigration();
      
      setMigrationResults(results);
      
      if (results.success) {
        setMigrationStatus('completed');
        toast.success('Migration completed successfully!');
      } else {
        setMigrationStatus('error');
        toast.error('Migration failed: ' + results.message);
      }
      
    } catch (error) {
      console.error('Migration error:', error);
      setMigrationStatus('error');
      toast.error('Migration failed: ' + error.message);
    }
  };

  const handleVerifyOnly = async () => {
    try {
      toast.info('Verifying salary data consistency...');
      
      const results = await verifyMigration(50);
      setVerificationResults(results);
      
      if (results.success) {
        toast.success('Verification passed - data is consistent!');
      } else {
        toast.warning(`Verification found ${results.issuesFound} issues`);
      }
      
    } catch (error) {
      console.error('Verification error:', error);
      toast.error('Verification failed: ' + error.message);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center mb-4">
        <Database className="h-6 w-6 text-blue-600 mr-2" />
        <h2 className="text-lg font-medium text-gray-900">Salary Data Migration</h2>
      </div>
      
      <div className="mb-6">
        <p className="text-sm text-gray-600 mb-4">
          This tool fixes salary/stipend data inconsistencies between job and application collections. 
          It ensures all applications have complete and accurate compensation data from the job collection.
        </p>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-yellow-400 mr-2 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800">Important</h3>
              <p className="text-sm text-yellow-700 mt-1">
                This operation will update existing application records. It's recommended to run verification first to check current data status.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <button
          onClick={handleVerifyOnly}
          disabled={migrationStatus === 'running'}
          className="flex items-center justify-center px-4 py-2 border border-blue-300 text-blue-700 rounded-md hover:bg-blue-50 disabled:opacity-50"
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Verify Data Only
        </button>
        
        <button
          onClick={handleRunMigration}
          disabled={migrationStatus === 'running'}
          className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {migrationStatus === 'running' ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          {migrationStatus === 'running' ? 'Running Migration...' : 'Run Complete Migration'}
        </button>
      </div>

      {/* Migration Status */}
      {migrationStatus !== 'idle' && (
        <div className="mb-6">
          <div className={`p-4 rounded-md ${
            migrationStatus === 'completed' ? 'bg-green-50 border border-green-200' :
            migrationStatus === 'error' ? 'bg-red-50 border border-red-200' :
            'bg-blue-50 border border-blue-200'
          }`}>
            <div className="flex items-center">
              {migrationStatus === 'completed' && <CheckCircle className="h-5 w-5 text-green-400 mr-2" />}
              {migrationStatus === 'error' && <AlertTriangle className="h-5 w-5 text-red-400 mr-2" />}
              {migrationStatus === 'running' && <RefreshCw className="h-5 w-5 text-blue-400 mr-2 animate-spin" />}
              
              <span className={`font-medium ${
                migrationStatus === 'completed' ? 'text-green-800' :
                migrationStatus === 'error' ? 'text-red-800' :
                'text-blue-800'
              }`}>
                {migrationStatus === 'completed' ? 'Migration Completed' :
                 migrationStatus === 'error' ? 'Migration Failed' :
                 'Migration Running...'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Migration Results */}
      {migrationResults && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Migration Results</h3>
          <div className="bg-gray-50 rounded-md p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Applications Migrated</p>
                <p className="text-lg font-semibold text-gray-900">
                  {migrationResults.migration?.migratedCount || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Errors Encountered</p>
                <p className="text-lg font-semibold text-gray-900">
                  {migrationResults.migration?.errorCount || 0}
                </p>
              </div>
            </div>
            
            {migrationResults.verification && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-900 mb-2">Verification Results</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Verified Applications</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {migrationResults.verification.verifiedCount}/{migrationResults.verification.totalChecked}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Issues Found</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {migrationResults.verification.issuesFound}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Verification Only Results */}
      {verificationResults && !migrationResults && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Verification Results</h3>
          <div className="bg-gray-50 rounded-md p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Applications Checked</p>
                <p className="text-lg font-semibold text-gray-900">
                  {verificationResults.totalChecked}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Issues Found</p>
                <p className={`text-lg font-semibold ${
                  verificationResults.issuesFound === 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {verificationResults.issuesFound}
                </p>
              </div>
            </div>
            
            <div className="mt-3">
              <p className={`text-sm ${
                verificationResults.success ? 'text-green-600' : 'text-red-600'
              }`}>
                {verificationResults.success 
                  ? '✅ All checked applications have consistent salary data'
                  : '⚠️ Some applications have inconsistent salary data - migration recommended'
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="text-xs text-gray-500">
        <p className="mb-1">
          <strong>Verify Data Only:</strong> Checks a sample of applications for salary data consistency without making changes.
        </p>
        <p>
          <strong>Run Complete Migration:</strong> Updates all applications with correct salary data from job collection and verifies the results.
        </p>
      </div>
    </div>
  );
};

export default MigrationPanel;
