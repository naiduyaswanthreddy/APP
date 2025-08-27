import React, { useState } from 'react';

const RoundActionPanel = ({ 
  currentRound,
  selectedApplications,
  filteredApplications,
  onBulkAction,
  onSelectAll,
  onClearSelection,
  isLoading = false,
  isFinalRound = false
}) => {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [actionType, setActionType] = useState('');

  const handleActionClick = (action) => {
    setActionType(action);
    setShowConfirmDialog(true);
  };

  const confirmAction = () => {
    onBulkAction(actionType);
    setShowConfirmDialog(false);
    setActionType('');
  };

  const selectedCount = selectedApplications.length;
  const totalCount = filteredApplications.length;
  const unselectedCount = totalCount - selectedCount;
  const progressPercentage = totalCount > 0 ? (selectedCount / totalCount) * 100 : 0;

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 mb-8 backdrop-blur-sm bg-opacity-95 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500"></div>
      </div>
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
              </div>
              {currentRound} Actions
            </h3>
            <p className="text-gray-600 mt-1">
              {selectedCount} of {totalCount} applicants selected
            </p>
          </div>
          
          {/* Selection Controls */}
          <div className="flex gap-3">
            <button
              onClick={onSelectAll}
              className="px-4 py-2 text-sm bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 rounded-xl hover:from-gray-200 hover:to-gray-300 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
            >
              Select All ({totalCount})
            </button>
            <button
              onClick={onClearSelection}
              className="px-4 py-2 text-sm bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 rounded-xl hover:from-gray-200 hover:to-gray-300 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
            >
              Clear Selection
            </button>
          </div>
        </div>

        {/* Enhanced Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span className="font-medium">Selection Progress</span>
            <span className="font-bold">{selectedCount}/{totalCount} ({Math.round(progressPercentage)}%)</span>
          </div>
          <div className="relative w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-full rounded-full transition-all duration-500 ease-out relative overflow-hidden"
              style={{ width: `${progressPercentage}%` }}
            >
              <div className="absolute inset-0 bg-white opacity-30 animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Action Buttons Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Primary Action - Shortlist/Select */}
          <button
            onClick={() => handleActionClick(isFinalRound ? 'select' : 'shortlist')}
            disabled={selectedCount === 0 || isLoading}
            className={`group relative overflow-hidden flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-semibold transition-all duration-300 transform ${
              selectedCount > 0 && !isLoading
                ? 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
            <svg className="w-5 h-5 relative z-10" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span className="relative z-10">
              {isFinalRound ? `Select ${selectedCount}` : `Shortlist ${selectedCount}`}
            </span>
          </button>

          {/* Waitlist Action */}
          <button
            onClick={() => handleActionClick('waitlist')}
            disabled={selectedCount === 0 || isLoading}
            className={`group relative overflow-hidden flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-semibold transition-all duration-300 transform ${
              selectedCount > 0 && !isLoading
                ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white hover:from-yellow-600 hover:to-yellow-700 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
            <svg className="w-5 h-5 relative z-10" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            <span className="relative z-10">Waitlist {selectedCount}</span>
          </button>

          {/* Reject Action */}
          <button
            onClick={() => handleActionClick('reject')}
            disabled={selectedCount === 0 || isLoading}
            className={`group relative overflow-hidden flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-semibold transition-all duration-300 transform ${
              selectedCount > 0 && !isLoading
                ? 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
            <svg className="w-5 h-5 relative z-10" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            <span className="relative z-10">Reject {selectedCount}</span>
          </button>

          

          {/* Bulk Action - Reject Remaining */}
          <button
            onClick={() => handleActionClick('reject-remaining')}
            disabled={selectedCount === 0 || unselectedCount === 0 || isLoading}
            className={`group relative overflow-hidden flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-semibold transition-all duration-300 transform ${
              selectedCount > 0 && unselectedCount > 0 && !isLoading
                ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
            <svg className="w-5 h-5 relative z-10" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clipRule="evenodd" />
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="relative z-10">Reject Others ({unselectedCount})</span>
          </button>
        </div>

        {/* Enhanced Quick Stats */}
        <div className="grid grid-cols-3 gap-6 text-center">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 border border-blue-200 transform transition-all duration-300 hover:scale-105">
            <div className="text-3xl font-bold text-blue-600 mb-2">{selectedCount}</div>
            <div className="text-sm font-medium text-blue-500 flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              To Shortlist
            </div>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-6 border border-orange-200 transform transition-all duration-300 hover:scale-105">
            <div className="text-3xl font-bold text-orange-600 mb-2">{unselectedCount}</div>
            <div className="text-sm font-medium text-orange-500 flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              To Reject
            </div>
          </div>
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6 border border-gray-200 transform transition-all duration-300 hover:scale-105">
            <div className="text-3xl font-bold text-gray-600 mb-2">{totalCount}</div>
            <div className="text-sm font-medium text-gray-500 flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" clipRule="evenodd" />
              </svg>
              Total Applicants
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl transform transition-all duration-300 scale-100">
            <div className="text-center mb-6">
              <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${
                actionType === 'reject' || actionType === 'reject-remaining' 
                  ? 'bg-red-100' : 'bg-green-100'
              }`}>
                <svg className={`w-8 h-8 ${
                  actionType === 'reject' || actionType === 'reject-remaining' 
                    ? 'text-red-500' : 'text-green-500'
                }`} fill="currentColor" viewBox="0 0 20 20">
                  {actionType === 'reject' || actionType === 'reject-remaining' ? (
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  ) : (
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  )}
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                Confirm Action
              </h3>
            </div>
            
            <p className="text-gray-600 mb-8 text-center leading-relaxed">
              {actionType === 'shortlist' && `Shortlist ${selectedCount} selected applicants and automatically reject ${unselectedCount} others?`}
              {actionType === 'reject' && `Reject ${selectedCount} selected applicants?`}
              {actionType === 'reject-remaining' && `Reject ${unselectedCount} unselected applicants?`}
            </p>
            
            <div className="flex gap-4">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="flex-1 px-6 py-3 text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all duration-200 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction}
                className={`flex-1 px-6 py-3 text-white rounded-xl transition-all duration-200 font-medium ${
                  actionType === 'reject' || actionType === 'reject-remaining'
                    ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
                    : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-90 backdrop-blur-sm flex items-center justify-center rounded-2xl z-40">
          <div className="flex flex-col items-center gap-4 text-blue-600">
            <div className="relative">
              <svg className="animate-spin w-12 h-12" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <div className="text-lg font-semibold">Processing...</div>
            <div className="text-sm text-gray-500">This may take a few moments</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoundActionPanel;
