import React from 'react';

// Base skeleton component with shimmer animation
const SkeletonBase = ({ className = "", children }) => (
  <div className={`animate-pulse ${className}`}>
    {children}
  </div>
);

// Shimmer effect for skeleton elements
const ShimmerBox = ({ className = "" }) => (
  <div className={`bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded ${className}`} />
);

// Job Cards Skeleton Loader
export const JobCardsSkeleton = ({ count = 6 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
    {Array.from({ length: count }).map((_, index) => (
      <SkeletonBase key={index} className="bg-white rounded-lg shadow-md p-6 border">
        <div className="flex justify-between items-start mb-4">
          <ShimmerBox className="h-6 w-32" />
          <ShimmerBox className="h-8 w-8 rounded-full" />
        </div>
        <ShimmerBox className="h-5 w-24 mb-2" />
        <ShimmerBox className="h-4 w-full mb-2" />
        <ShimmerBox className="h-4 w-3/4 mb-4" />
        
        <div className="flex flex-wrap gap-2 mb-4">
          <ShimmerBox className="h-6 w-16 rounded-full" />
          <ShimmerBox className="h-6 w-20 rounded-full" />
          <ShimmerBox className="h-6 w-14 rounded-full" />
        </div>
        
        <div className="flex justify-between items-center">
          <ShimmerBox className="h-4 w-20" />
          <ShimmerBox className="h-9 w-24 rounded" />
        </div>
      </SkeletonBase>
    ))}
  </div>
);

// Table Skeleton Loader (for applications, students, etc.)
export const TableSkeleton = ({ rows = 5, columns = 5 }) => (
  <div className="bg-white rounded-xl shadow-lg overflow-hidden">
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="bg-gray-50">
            {Array.from({ length: columns }).map((_, index) => (
              <th key={index} className="px-6 py-4">
                <SkeletonBase>
                  <ShimmerBox className="h-4 w-24" />
                </SkeletonBase>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-gray-50">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={colIndex} className="px-6 py-4">
                  <SkeletonBase>
                    <ShimmerBox className="h-4 w-full" />
                  </SkeletonBase>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// Profile/Details Page Skeleton
export const ProfileSkeleton = () => (
  <div className="max-w-4xl mx-auto p-6 space-y-6">
    <SkeletonBase className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center space-x-4 mb-6">
        <ShimmerBox className="h-20 w-20 rounded-full" />
        <div className="space-y-2">
          <ShimmerBox className="h-6 w-48" />
          <ShimmerBox className="h-4 w-32" />
          <ShimmerBox className="h-4 w-40" />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <ShimmerBox className="h-5 w-32" />
          <ShimmerBox className="h-10 w-full" />
          <ShimmerBox className="h-5 w-28" />
          <ShimmerBox className="h-10 w-full" />
        </div>
        <div className="space-y-4">
          <ShimmerBox className="h-5 w-36" />
          <ShimmerBox className="h-10 w-full" />
          <ShimmerBox className="h-5 w-24" />
          <ShimmerBox className="h-10 w-full" />
        </div>
      </div>
    </SkeletonBase>
    
    <SkeletonBase className="bg-white rounded-lg shadow-md p-6">
      <ShimmerBox className="h-6 w-40 mb-4" />
      <div className="space-y-3">
        <ShimmerBox className="h-4 w-full" />
        <ShimmerBox className="h-4 w-5/6" />
        <ShimmerBox className="h-4 w-4/5" />
      </div>
    </SkeletonBase>
  </div>
);

// Dashboard/Analytics Skeleton
export const DashboardSkeleton = () => (
  <div className="p-6 space-y-6">
    {/* Stats Cards */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: 4 }).map((_, index) => (
        <SkeletonBase key={index} className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <ShimmerBox className="h-4 w-20" />
              <ShimmerBox className="h-8 w-16" />
            </div>
            <ShimmerBox className="h-12 w-12 rounded-lg" />
          </div>
        </SkeletonBase>
      ))}
    </div>
    
    {/* Charts */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <SkeletonBase className="bg-white rounded-lg shadow-md p-6">
        <ShimmerBox className="h-6 w-32 mb-4" />
        <ShimmerBox className="h-64 w-full rounded" />
      </SkeletonBase>
      <SkeletonBase className="bg-white rounded-lg shadow-md p-6">
        <ShimmerBox className="h-6 w-28 mb-4" />
        <ShimmerBox className="h-64 w-full rounded" />
      </SkeletonBase>
    </div>
  </div>
);

// List Skeleton (for notifications, resources, etc.)
export const ListSkeleton = ({ items = 5 }) => (
  <div className="bg-white rounded-lg shadow-md divide-y divide-gray-200">
    {Array.from({ length: items }).map((_, index) => (
      <SkeletonBase key={index} className="p-4">
        <div className="flex items-center space-x-4">
          <ShimmerBox className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <ShimmerBox className="h-4 w-3/4" />
            <ShimmerBox className="h-3 w-1/2" />
          </div>
          <ShimmerBox className="h-8 w-20 rounded" />
        </div>
      </SkeletonBase>
    ))}
  </div>
);

// Form Skeleton
export const FormSkeleton = () => (
  <SkeletonBase className="bg-white rounded-lg shadow-md p-6 max-w-2xl mx-auto">
    <ShimmerBox className="h-8 w-48 mb-6" />
    <div className="space-y-6">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="space-y-2">
          <ShimmerBox className="h-4 w-32" />
          <ShimmerBox className="h-10 w-full rounded" />
        </div>
      ))}
      <div className="flex justify-end space-x-3 pt-4">
        <ShimmerBox className="h-10 w-20 rounded" />
        <ShimmerBox className="h-10 w-24 rounded" />
      </div>
    </div>
  </SkeletonBase>
);

// Gallery Skeleton
export const GallerySkeleton = ({ items = 12 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
    {Array.from({ length: items }).map((_, index) => (
      <SkeletonBase key={index} className="bg-white rounded-lg shadow-md overflow-hidden">
        <ShimmerBox className="h-48 w-full" />
        <div className="p-4">
          <ShimmerBox className="h-4 w-3/4 mb-2" />
          <ShimmerBox className="h-3 w-1/2" />
        </div>
      </SkeletonBase>
    ))}
  </div>
);

// Chat Skeleton
export const ChatSkeleton = () => (
  <div className="bg-white rounded-lg shadow-md h-96 flex flex-col">
    <SkeletonBase className="p-4 border-b">
      <ShimmerBox className="h-6 w-32" />
    </SkeletonBase>
    <div className="flex-1 p-4 space-y-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className={`flex ${index % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
          <SkeletonBase className={`max-w-xs ${index % 2 === 0 ? 'bg-gray-100' : 'bg-blue-100'} rounded-lg p-3`}>
            <ShimmerBox className="h-4 w-full mb-1" />
            <ShimmerBox className="h-4 w-2/3" />
          </SkeletonBase>
        </div>
      ))}
    </div>
    <SkeletonBase className="p-4 border-t">
      <ShimmerBox className="h-10 w-full rounded" />
    </SkeletonBase>
  </div>
);

export default {
  JobCardsSkeleton,
  TableSkeleton,
  ProfileSkeleton,
  DashboardSkeleton,
  ListSkeleton,
  FormSkeleton,
  GallerySkeleton,
  ChatSkeleton
};
