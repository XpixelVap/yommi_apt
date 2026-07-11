import React from 'react';

export const Skeleton = ({ className }: { className?: string }) => {
  return (
    <div className={`animate-pulse bg-gray-200 rounded-md ${className}`}></div>
  );
};

export const RestaurantCardSkeleton = () => {
  return (
    <div className="bg-white rounded-[16px] shadow-sm overflow-hidden border border-gray-100 h-full flex flex-col">
      <Skeleton className="h-48 w-full rounded-none" />
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-2">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-6 w-12" />
        </div>
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-2/3 mb-4" />
        <div className="mt-auto pt-3 border-t border-gray-50 flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-20 rounded-lg" />
        </div>
      </div>
    </div>
  );
};

export const ProductCardSkeleton = () => {
  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex gap-4">
      <div className="flex-1 flex flex-col justify-between">
        <div>
          <Skeleton className="h-5 w-3/4 mb-2" />
          <Skeleton className="h-4 w-full mb-1" />
          <Skeleton className="h-4 w-5/6 mb-3" />
        </div>
        <Skeleton className="h-6 w-20" />
      </div>
      <Skeleton className="w-28 h-28 rounded-xl shrink-0" />
    </div>
  );
};
