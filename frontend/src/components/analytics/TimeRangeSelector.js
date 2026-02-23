import React from 'react';

const TimeRangeSelector = ({ selectedRange, onRangeChange }) => {
  const ranges = [
    { value: 'week', label: '7 Hari', icon: 'calendar-week' },
    { value: 'month', label: '30 Hari', icon: 'calendar-month' },
    { value: 'year', label: '1 Tahun', icon: 'calendar-range' }
  ];

  return (
    <div className="time-range-selector">
      <div className="btn-group" role="group">
        {ranges.map(range => (
          <button
            key={range.value}
            type="button"
            className={`btn btn-outline-danger ${selectedRange === range.value ? 'active' : ''}`}
            onClick={() => onRangeChange(range.value)}
          >
            <i className={`bi bi-${range.icon} me-1`}></i>
            {range.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TimeRangeSelector;