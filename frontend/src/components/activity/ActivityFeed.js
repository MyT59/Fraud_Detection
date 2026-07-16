import React from "react";
import ActivityFeedItem from "./ActivityFeedItem";

const ActivityFeed = ({ activities, onLoadMore, hasMore }) => {
  if (activities.length === 0) {
    return (
      <div className="timeline-empty">
        <i className="bi bi-inbox" />
        <strong>Tidak ada aktivitas sesuai filter</strong>
        <p>Ubah filter, periode waktu, atau keyword pencarian.</p>
      </div>
    );
  }

  return (
    <>
      <div className="timeline-feed-list">
        {activities.map((activity, index) => (
          <ActivityFeedItem
            key={activity.id}
            activity={activity}
            isLast={index === activities.length - 1 && !hasMore}
          />
        ))}
      </div>

      {hasMore && (
        <div className="timeline-load-more">
          <button className="btn-load-more-full" onClick={onLoadMore}>
            <i className="bi bi-arrow-down-circle" />
            Load More Activities
          </button>
        </div>
      )}
    </>
  );
};

export default ActivityFeed;
