import React, { memo, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

// Virtualized list component for handling large datasets efficiently
const VirtualizedList = memo(({ 
  items, 
  renderItem, 
  itemHeight = 120, 
  className = '',
  onLoadMore,
  hasMore,
  loading 
}) => {
  const itemCount = useMemo(() => {
    return hasMore ? items.length + 1 : items.length;
  }, [items.length, hasMore]);

  const Row = memo(({ index, style }) => {
    const isLoaderRow = index === items.length;
    
    if (isLoaderRow) {
      return (
        <div style={style} className="flex items-center justify-center p-4">
          {loading ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span>Loading more...</span>
            </div>
          ) : (
            <button 
              onClick={onLoadMore}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Load More
            </button>
          )}
        </div>
      );
    }

    const item = items[index];
    return (
      <div style={style}>
        {renderItem(item, index)}
      </div>
    );
  });

  Row.displayName = 'VirtualizedRow';

  return (
    <div className={`h-full ${className}`}>
      <AutoSizer>
        {({ height, width }) => (
          <List
            height={height}
            width={width}
            itemCount={itemCount}
            itemSize={itemHeight}
            onItemsRendered={({ visibleStopIndex }) => {
              // Trigger load more when near the end
              if (
                hasMore && 
                !loading && 
                visibleStopIndex >= items.length - 5 &&
                onLoadMore
              ) {
                onLoadMore();
              }
            }}
          >
            {Row}
          </List>
        )}
      </AutoSizer>
    </div>
  );
});

VirtualizedList.displayName = 'VirtualizedList';

export default VirtualizedList;
