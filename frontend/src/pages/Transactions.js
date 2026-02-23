import React, { useState, useEffect } from 'react';
import TransactionTableEnhanced from '../components/transactions/TransactionTable';
import FilterBar from '../components/transactions/FilterBar';
import SearchBar from '../components/transactions/SearchBar';
import PaginationComponent from '../components/transactions/PaginationComponent';
import TransactionDetailModal from '../components/transactions/TransactionDetailModal';
import BulkActionsBar from '../components/transactions/BulkActionsBar';
import ExportButton from '../components/transactions/ExportButton';
import './Transactions.css';
import PageLoader from '../components/common/PageLoader';

// Dummy data untuk testing
const generateDummyData = () => {
  const statuses = ['Fraud', 'Legit'];
  const locations = ['Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Semarang', 'Makassar', 'Palembang'];
  const users = ['John Doe', 'Jane Smith', 'Ahmad Rizki', 'Siti Nurhaliza', 'Budi Santoso', 'Dewi Lestari'];
  
  const data = [];
  for (let i = 1; i <= 100; i++) {
    const randomDate = new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
    data.push({
      id: `TRX${String(i).padStart(5, '0')}`,
      user: users[Math.floor(Math.random() * users.length)],
      amount: Math.floor(Math.random() * 10000000) + 50000,
      time: randomDate.toISOString(),
      location: locations[Math.floor(Math.random() * locations.length)],
      status: Math.random() > 0.7 ? 'Fraud' : 'Legit'
    });
  }
  return data.sort((a, b) => new Date(b.time) - new Date(a.time));
};

const Transactions = () => {
  const [loading, setLoading] = useState(true);

  const [allTransactions] = useState(generateDummyData());
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  // Selection state
  const [selectedTransactions, setSelectedTransactions] = useState([]);
  
  // Modal state
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filter states
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    amountMin: '',
    amountMax: '',
    status: 'all',
    searchQuery: ''
  });

  // Apply filters
  useEffect(() => {
    let filtered = [...allTransactions];

    // Filter by date range
    if (filters.dateFrom) {
      filtered = filtered.filter(t => new Date(t.time) >= new Date(filters.dateFrom));
    }
    if (filters.dateTo) {
      filtered = filtered.filter(t => new Date(t.time) <= new Date(filters.dateTo));
    }

    // Filter by amount range
    if (filters.amountMin) {
      filtered = filtered.filter(t => t.amount >= parseFloat(filters.amountMin));
    }
    if (filters.amountMax) {
      filtered = filtered.filter(t => t.amount <= parseFloat(filters.amountMax));
    }

    // Filter by status
    if (filters.status !== 'all') {
      filtered = filtered.filter(t => t.status === filters.status);
    }

    // Filter by search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.id.toLowerCase().includes(query) ||
        t.user.toLowerCase().includes(query) ||
        t.location.toLowerCase().includes(query)
      );
    }

    setFilteredTransactions(filtered);
    setCurrentPage(1); // Reset to first page when filters change
    setSelectedTransactions([]); // Clear selection when filters change
    setLoading(false);
  }, [filters, allTransactions]);

  if (loading) return <PageLoader message="Memuat data transaksi..." />;

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTransactions = filteredTransactions.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);

  // Handlers
  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleSearchChange = (searchQuery) => {
    setFilters(prev => ({ ...prev, searchQuery }));
  };

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const handleResetFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      amountMin: '',
      amountMax: '',
      status: 'all',
      searchQuery: ''
    });
  };

  // Selection handlers
  const handleSelectTransaction = (transactionId, isSelected) => {
    if (isSelected) {
      setSelectedTransactions(prev => [...prev, transactionId]);
    } else {
      setSelectedTransactions(prev => prev.filter(id => id !== transactionId));
    }
  };

  const handleSelectAll = (isSelected) => {
    if (isSelected) {
      const allIds = currentTransactions.map(t => t.id);
      setSelectedTransactions(allIds);
    } else {
      setSelectedTransactions([]);
    }
  };

  const handleClearSelection = () => {
    setSelectedTransactions([]);
  };

  // Transaction action handlers
  const handleViewDetails = (transaction) => {
    setSelectedTransaction(transaction);
    setIsModalOpen(true);
  };

  const handleApprove = (transaction) => {
    console.log('Approve:', transaction);
    alert(`Transaction ${transaction.id} approved!`);
  };

  const handleReject = (transaction) => {
    console.log('Reject:', transaction);
    alert(`Transaction ${transaction.id} rejected!`);
  };

  const handleFlag = (transaction) => {
    console.log('Flag:', transaction);
    alert(`Transaction ${transaction.id} flagged for review!`);
  };

  // Bulk action handlers
  const handleBulkApprove = () => {
    console.log('Bulk approve:', selectedTransactions);
    alert(`${selectedTransactions.length} transactions approved!`);
    setSelectedTransactions([]);
  };

  const handleBulkReject = () => {
    console.log('Bulk reject:', selectedTransactions);
    alert(`${selectedTransactions.length} transactions rejected!`);
    setSelectedTransactions([]);
  };

  const handleBulkFlag = () => {
    console.log('Bulk flag:', selectedTransactions);
    alert(`${selectedTransactions.length} transactions flagged!`);
    setSelectedTransactions([]);
  };

  return (
    <div className="transactions-page">
      <div className="container-fluid py-4">
        {/* Header with Export Button */}
        <div className="page-header mb-4">
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <h1 className="page-title">
                <i className="bi bi-receipt"></i> Transactions
              </h1>
              <p className="page-subtitle">Monitor dan analisa semua transaksi</p>
            </div>
            <ExportButton 
              data={filteredTransactions} 
              filename="transactions"
            />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="row mb-4">
          <div className="col-md-3 mb-3">
            <div className="stat-card">
              <div className="stat-icon bg-primary">
                <i className="bi bi-list-ul"></i>
              </div>
              <div className="stat-content">
                <div className="stat-value">{allTransactions.length}</div>
                <div className="stat-label">Total Transaksi</div>
              </div>
            </div>
          </div>
          <div className="col-md-3 mb-3">
            <div className="stat-card">
              <div className="stat-icon bg-success">
                <i className="bi bi-check-circle"></i>
              </div>
              <div className="stat-content">
                <div className="stat-value">
                  {allTransactions.filter(t => t.status === 'Legit').length}
                </div>
                <div className="stat-label">Legit</div>
              </div>
            </div>
          </div>
          <div className="col-md-3 mb-3">
            <div className="stat-card">
              <div className="stat-icon bg-danger">
                <i className="bi bi-exclamation-triangle"></i>
              </div>
              <div className="stat-content">
                <div className="stat-value">
                  {allTransactions.filter(t => t.status === 'Fraud').length}
                </div>
                <div className="stat-label">Fraud</div>
              </div>
            </div>
          </div>
          <div className="col-md-3 mb-3">
            <div className="stat-card">
              <div className="stat-icon bg-info">
                <i className="bi bi-filter"></i>
              </div>
              <div className="stat-content">
                <div className="stat-value">{filteredTransactions.length}</div>
                <div className="stat-label">Hasil Filter</div>
              </div>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <SearchBar 
          searchQuery={filters.searchQuery}
          onSearchChange={handleSearchChange}
        />

        {/* Filter Bar */}
        <FilterBar 
          filters={filters}
          onFilterChange={handleFilterChange}
          onResetFilters={handleResetFilters}
        />

        {/* Transaction Table */}
        <div className="card table-card">
          <TransactionTableEnhanced 
            transactions={currentTransactions}
            selectedTransactions={selectedTransactions}
            onSelectTransaction={handleSelectTransaction}
            onSelectAll={handleSelectAll}
            onViewDetails={handleViewDetails}
            onApprove={handleApprove}
            onReject={handleReject}
            onFlag={handleFlag}
          />
          
          {/* Pagination — always visible */}
          <div className="card-footer">
            <div className="d-flex justify-content-between align-items-center">
              <div className="pagination-info">
                {filteredTransactions.length === 0
                  ? 'Tidak ada transaksi ditemukan'
                  : `Menampilkan ${indexOfFirstItem + 1} - ${Math.min(indexOfLastItem, filteredTransactions.length)} dari ${filteredTransactions.length} transaksi`
                }
              </div>
              <PaginationComponent
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          </div>
        </div>

        {filteredTransactions.length === 0 && (
          <div className="card table-card">
            <div className="card-body text-center py-5">
              <i className="bi bi-inbox" style={{ fontSize: '4rem', color: '#d4d4d4' }}></i>
              <h4 className="mt-3">Tidak ada transaksi ditemukan</h4>
              <p className="text-muted">Coba ubah filter atau kriteria pencarian</p>
              <button className="btn btn-primary mt-2" onClick={handleResetFilters}>
                Reset Filter
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transaction Detail Modal */}
      <TransactionDetailModal
        transaction={selectedTransaction}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectedTransactions.length}
        onApprove={handleBulkApprove}
        onReject={handleBulkReject}
        onFlag={handleBulkFlag}
        onClearSelection={handleClearSelection}
      />
    </div>
  );
};

export default Transactions;