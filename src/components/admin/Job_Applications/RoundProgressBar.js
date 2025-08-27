import React from 'react';

const RoundProgressBar = ({ 
  rounds, 
  currentRoundIndex, 
  onRoundClick, 
  applicantCounts = {} 
}) => {
  const hasFinalSelections = (applicantCounts.selected || 0) > 0;
  const getStepStatus = (index) => {
    if (index < currentRoundIndex) return 'completed';
    if (index === currentRoundIndex) return 'active';
    return 'pending';
  };

  const getStepIcon = (status, index) => {
    switch (status) {
      case 'completed':
        return (
          <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center text-white shadow-lg transform transition-all duration-300 hover:scale-110">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        );
      case 'active':
        return (
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg ring-4 ring-blue-200 animate-pulse">
            {index + 1}
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 bg-gradient-to-r from-gray-300 to-gray-400 rounded-full flex items-center justify-center text-gray-600 font-bold shadow-md">
            {index + 1}
          </div>
        );
    }
  };

  const getConnectorClass = (index) => {
    const status = getStepStatus(index);
    if (status === 'completed') return 'bg-gradient-to-r from-green-500 to-green-600';
    if (status === 'active') return 'bg-gradient-to-r from-blue-500 to-blue-600';
    return 'bg-gray-300';
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 mb-8 backdrop-blur-sm bg-opacity-95">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          Recruitment Pipeline
        </h3>
        <div className="text-sm text-gray-500 bg-gray-50 px-3 py-1 rounded-full">
          Round {currentRoundIndex + 1} of {rounds.length}
        </div>
      </div>
      
      <div className="relative">
        <div className="flex items-center justify-between">
          {rounds.map((round, index) => {
            const status = getStepStatus(index);
            const roundName = round.name || round.roundName || `Round ${index + 1}`;
            const applicantCount = applicantCounts[index] || 0;
            
            return (
              <div key={index} className="flex flex-col items-center relative flex-1">
                {/* Connector Line */}
                {index < rounds.length - 1 && (
                  <div className="absolute top-5 left-1/2 w-full h-1 -translate-y-1/2 z-0">
                    <div className={`h-full rounded-full transition-all duration-500 ${getConnectorClass(index)}`} />
                  </div>
                )}
                
                {/* Step Circle */}
                <button
                  onClick={() => onRoundClick(index)}
                  className="relative z-10 transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-4 focus:ring-blue-200 rounded-full"
                >
                  {getStepIcon(status, index)}
                </button>
                
                {/* Step Label */}
                <div className="mt-4 text-center max-w-24">
                  <p className={`text-sm font-semibold transition-colors duration-300 ${
                    status === 'active' ? 'text-blue-600' : 
                    status === 'completed' ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    {roundName}
                  </p>
                  <div className={`mt-1 px-2 py-1 rounded-full text-xs font-medium transition-colors duration-300 ${
                    status === 'active' ? 'bg-blue-100 text-blue-700' :
                    status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {applicantCount} 👥
                  </div>
                </div>
              </div>
            );
          })}
          
          {/* Final Selection Step */}
          <div className="flex flex-col items-center relative flex-1">
            {/* Connector Line */}
            <div className="absolute top-5 right-1/2 w-full h-1 -translate-y-1/2 z-0">
              <div className={`h-full rounded-full transition-all duration-500 ${
                hasFinalSelections ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-gray-300'
              }`} />
            </div>
            
            {/* Final Step Circle */}
            <div className="relative z-10">
              {hasFinalSelections ? (
                <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center text-white shadow-lg">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              ) : (
                <div className="w-10 h-10 bg-gradient-to-r from-gray-300 to-gray-400 rounded-full flex items-center justify-center text-gray-600 shadow-md">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
            
            {/* Final Step Label */}
            <div className="mt-4 text-center">
              <p className={`text-sm font-semibold transition-colors duration-300 ${
                hasFinalSelections ? 'text-green-600' : 'text-gray-500'
              }`}>
                Final Selection
              </p>
              <div className={`mt-1 px-2 py-1 rounded-full text-xs font-medium transition-colors duration-300 ${
                hasFinalSelections ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {applicantCounts.selected || 0} ✨
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoundProgressBar;
