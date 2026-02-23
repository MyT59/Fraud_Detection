import React from 'react';
import ActivityFeedItem from './ActivityFeedItem';

const ActivityFeed = ({ activities, onLoadMore, hasMore }) => {
  if (activities.length === 0) {
    return (
      <div className="timeline-feed-card">
        <div className="timeline-empty">
          <i className="bi bi-inbox"></i>
          <p>No activities found matching your filters.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="timeline-feed-card">
      <div className="feed-header">
        <h3 className="feed-header-title">Activity Feed</h3>
        <span className="feed-count-badge">{activities.length} events</span>
      </div>

      {activities.map((activity, index) => (
        <ActivityFeedItem
          key={activity.id}
          activity={activity}
          isLast={index === activities.length - 1 && !hasMore}
        />
      ))}

      {hasMore && (
        <div className="timeline-load-more">
          <button className="btn-load-more-full" onClick={onLoadMore}>
            <i className="bi bi-arrow-down-circle"></i>
            Load More Activities
          </button>
        </div>
      )}
    </div>
  );
};

export default ActivityFeed;