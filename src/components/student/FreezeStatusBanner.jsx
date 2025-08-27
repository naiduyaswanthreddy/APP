import React from 'react';
import { AlertTriangle, Clock, X } from 'lucide-react';
import { useFreezeStatus } from '../../hooks/useFreezeStatus';

const FreezeStatusBanner = () => {
  const { freezeStatus, isFrozen, loading } = useFreezeStatus();

  if (loading || !isFrozen) {
    return null;
  }

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  const isTemporary = freezeStatus.until && new Date(freezeStatus.until.toDate ? freezeStatus.until.toDate() : freezeStatus.until) > new Date();

  return (
    <div className="sticky top-0 z-50 bg-red-600 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="font-semibold">Account Frozen</span>
                {isTemporary && (
                  <div className="flex items-center space-x-1 text-red-200">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm">Temporary</span>
                  </div>
                )}
              </div>
              <div className="text-sm text-red-100 mt-1">
                <span className="font-medium">Reason:</span> {freezeStatus.reason}
                {freezeStatus.category && freezeStatus.category !== 'other' && (
                  <span className="ml-2">
                    <span className="font-medium">Category:</span> {freezeStatus.category}
                  </span>
                )}
              </div>
              <div className="text-xs text-red-200 mt-1">
                <span>Effective from: {formatDate(freezeStatus.from)}</span>
                {freezeStatus.until && (
                  <span className="ml-4">
                    Until: {formatDate(freezeStatus.until)}
                  </span>
                )}
              </div>
              {freezeStatus.notes && (
                <div className="text-sm text-red-100 mt-1">
                  <span className="font-medium">Notes:</span> {freezeStatus.notes}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-sm text-red-100">
              Contact Placement Team for assistance
            </div>
          </div>
        </div>
        
        <div className="mt-2 text-sm text-red-200">
          You cannot apply for jobs while your account is frozen. Please resolve the issue mentioned above.
        </div>
      </div>
    </div>
  );
};

export default FreezeStatusBanner;
