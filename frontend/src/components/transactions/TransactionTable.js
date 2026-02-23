import React from 'react';
import TransactionActions from './TransactionActions';
import RiskScoreIndicator from './RiskScoreIndicator';

const TransactionTableEnhanced = ({ 
  transactions, 
  selectedTransactions,
  onSelectTransaction,
  onSelectAll,
  onViewDetails,
  onApprove,
  onReject,
  onFlag
}) => {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  };

  const getStatusBadge = (status) => {
    if (status === 'Fraud') {
      return <span className="badge bg-danger"><i className="bi bi-exclamation-circle me-1"></i>Fraud</span>;
    }
    return <span className="badge bg-success"><i className="bi bi-check-circle me-1"></i>Legit</span>;
  };

  const getRiskScore = (transaction) => {
    // Simulasi risk score berdasarkan status
    return transaction.status === 'Fraud' 
      ? Math.floor(Math.random() * 30) + 70 
      : Math.floor(Math.random() * 40) + 10;
  };

  const isAllSelected = transactions.length > 0 && 
    transactions.every(t => selectedTransactions.includes(t.id));

  const isSomeSelected = transactions.some(t => selectedTransactions.includes(t.id)) && 
    !isAllSelected;

  return (
    <div className="table-responsive">
      <table className="table table-hover transaction-table">
        <thead>
          <tr>
            <th style={{ width: '50px' }}>
              <input
                type="checkbox"
                className="form-check-input"
                checked={isAllSelected}
                ref={input => {
                  if (input) {
                    input.indeterminate = isSomeSelected;
                  }
                }}
                onChange={(e) => onSelectAll(e.target.checked)}
              />
            </th>
            <th>ID</th>
            <th>User</th>
            <th>Amount</th>
            <th>Time</th>
            <th>Location</th>
            <th>Risk</th>
            <th>Status</th>
            <th style={{ width: '150px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr 
              key={transaction.id}
              className={selectedTransactions.includes(transaction.id) ? 'table-active' : ''}
            >
              <td>
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={selectedTransactions.includes(transaction.id)}
                  onChange={(e) => onSelectTransaction(transaction.id, e.target.checked)}
                />
              </td>
              <td>
                <span className="transaction-id">{transaction.id}</span>
              </td>
              <td>
                <div className="user-cell">
                  <div className="user-avatar">
                    {transaction.user.charAt(0).toUpperCase()}
                  </div>
                  <span className="user-name">{transaction.user}</span>
                </div>
              </td>
              <td>
                <span className="amount">{formatCurrency(transaction.amount)}</span>
              </td>
              <td>
                <span className="time">{formatDateTime(transaction.time)}</span>
              </td>
              <td>
                <span className="location">
                  <i className="bi bi-geo-alt me-1"></i>
                  {transaction.location}
                </span>
              </td>
              <td>
                <RiskScoreIndicator 
                  score={getRiskScore(transaction)} 
                  size="small"
                  showLabel={false}
                />
              </td>
              <td>{getStatusBadge(transaction.status)}</td>
              <td>
                <TransactionActions
                  transaction={transaction}
                  onViewDetails={onViewDetails}
                  onApprove={onApprove}
                  onReject={onReject}
                  onFlag={onFlag}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TransactionTableEnhanced;