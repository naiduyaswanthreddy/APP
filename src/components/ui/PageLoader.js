import React from 'react';
import Loader from '../../loading';

const PageLoader = ({ fullScreen = true }) => {
  return (
    <div
      className={`${fullScreen ? 'fixed' : 'absolute'} inset-0 w-full 
      bg-gray-800 bg-opacity-30 backdrop-blur-sm flex items-center justify-center z-50`}
    >
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full flex justify-center">
        <Loader />
      </div>
    </div>
  );
};

export default PageLoader;
