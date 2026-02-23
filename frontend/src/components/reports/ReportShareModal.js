import React, { useState } from 'react';
import './ReportShareModal.css';

const ReportShareModal = ({ report, isOpen, onClose, onShare }) => {
  const [shareMethod, setShareMethod] = useState('email'); // email, link
  const [emailData, setEmailData] = useState({
    recipients: '',
    subject: `Fraud Detection Report: ${report?.type || 'Report'}`,
    message: '',
    includeAttachment: true
  });
  const [linkData, setLinkData] = useState({
    expiresIn: '7',
    password: '',
    allowDownload: true
  });
  const [generatedLink, setGeneratedLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  if (!isOpen || !report) return null;

  const handleEmailChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEmailData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleLinkChange = (e) => {
    const { name, value, type, checked } = e.target;
    setLinkData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleShareByEmail = () => {
    // Validate
    if (!emailData.recipients) {
      alert('Please enter at least one recipient email');
      return;
    }

    onShare?.({
      method: 'email',
      data: emailData,
      reportId: report.id
    });

    alert('Report sent successfully!');
    onClose();
  };

  const handleGenerateLink = () => {
    // Generate dummy link
    const randomId = Math.random().toString(36).substring(7);
    const link = `https://fraud-detection.app/reports/share/${randomId}`;
    setGeneratedLink(link);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <>
      {/* Backdrop — lighter & blurred */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(12,12,14,0.30)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          zIndex: 1050,
        }}
      />

      {/* Modal — perfectly centered */}
      <div
        tabIndex="-1"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1055,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{ pointerEvents: 'all', width: '100%', maxWidth: '580px', margin: 0 }}
          className="modal-dialog modal-dialog-centered modal-lg"
        >
          <div className="modal-content share-modal-content">
            {/* Header */}
            <div className="modal-header">
              <h5 className="modal-title">
                <i className="bi bi-share text-danger me-2"></i>
                Share Report
              </h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>

            {/* Body */}
            <div className="modal-body">
              {/* Report Info */}
              <div className="report-info-banner mb-4">
                <div className="info-icon">
                  <i className="bi bi-file-earmark-text"></i>
                </div>
                <div>
                  <h6 className="mb-1">{report.type}</h6>
                  <small className="text-muted">
                    Report ID: {report.id} • {report.format} • {report.size}
                  </small>
                </div>
              </div>

              {/* Share Method Tabs */}
              <div className="share-methods mb-4">
                <button
                  className={`method-tab ${shareMethod === 'email' ? 'active' : ''}`}
                  onClick={() => setShareMethod('email')}
                >
                  <i className="bi bi-envelope"></i>
                  <span>Email</span>
                </button>
                <button
                  className={`method-tab ${shareMethod === 'link' ? 'active' : ''}`}
                  onClick={() => setShareMethod('link')}
                >
                  <i className="bi bi-link-45deg"></i>
                  <span>Share Link</span>
                </button>
              </div>

              {/* Email Method */}
              {shareMethod === 'email' && (
                <div className="share-content">
                  <div className="mb-3">
                    <label className="form-label">
                      <i className="bi bi-people me-1"></i>
                      Recipients (comma separated)
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      name="recipients"
                      value={emailData.recipients}
                      onChange={handleEmailChange}
                      placeholder="email1@example.com, email2@example.com"
                    />
                    <small className="form-text text-muted">
                      Separate multiple email addresses with commas
                    </small>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">
                      <i className="bi bi-envelope me-1"></i>
                      Subject
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      name="subject"
                      value={emailData.subject}
                      onChange={handleEmailChange}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">
                      <i className="bi bi-chat-text me-1"></i>
                      Message (Optional)
                    </label>
                    <textarea
                      className="form-control"
                      name="message"
                      value={emailData.message}
                      onChange={handleEmailChange}
                      rows="4"
                      placeholder="Add a personal message..."
                    ></textarea>
                  </div>

                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      name="includeAttachment"
                      id="includeAttachment"
                      checked={emailData.includeAttachment}
                      onChange={handleEmailChange}
                    />
                    <label className="form-check-label" htmlFor="includeAttachment">
                      Include report as attachment ({report.format})
                    </label>
                  </div>

                  <div className="alert alert-info mt-3 mb-0">
                    <i className="bi bi-info-circle me-2"></i>
                    Recipients will receive an email with the report attached or a secure download link.
                  </div>
                </div>
              )}

              {/* Link Method */}
              {shareMethod === 'link' && (
                <div className="share-content">
                  {!generatedLink ? (
                    <>
                      <div className="mb-3">
                        <label className="form-label">
                          <i className="bi bi-clock me-1"></i>
                          Link Expires In
                        </label>
                        <select
                          className="form-select"
                          name="expiresIn"
                          value={linkData.expiresIn}
                          onChange={handleLinkChange}
                        >
                          <option value="1">1 Day</option>
                          <option value="3">3 Days</option>
                          <option value="7">7 Days</option>
                          <option value="30">30 Days</option>
                          <option value="never">Never</option>
                        </select>
                      </div>

                      <div className="mb-3">
                        <label className="form-label">
                          <i className="bi bi-lock me-1"></i>
                          Password Protection (Optional)
                        </label>
                        <input
                          type="password"
                          className="form-control"
                          name="password"
                          value={linkData.password}
                          onChange={handleLinkChange}
                          placeholder="Enter password"
                        />
                        <small className="form-text text-muted">
                          Leave empty for no password protection
                        </small>
                      </div>

                      <div className="form-check mb-3">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          name="allowDownload"
                          id="allowDownload"
                          checked={linkData.allowDownload}
                          onChange={handleLinkChange}
                        />
                        <label className="form-check-label" htmlFor="allowDownload">
                          Allow recipients to download the report
                        </label>
                      </div>

                      <button
                        className="btn btn-danger w-100"
                        onClick={handleGenerateLink}
                      >
                        <i className="bi bi-link-45deg me-2"></i>
                        Generate Share Link
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="link-generated">
                        <div className="success-icon">
                          <i className="bi bi-check-circle-fill"></i>
                        </div>
                        <h6>Link Generated Successfully!</h6>
                        <p className="text-muted">Share this link with anyone you want to give access to</p>
                        
                        <div className="link-box">
                          <input
                            type="text"
                            className="form-control"
                            value={generatedLink}
                            readOnly
                          />
                          <button
                            className="btn btn-outline-danger"
                            onClick={handleCopyLink}
                          >
                            <i className={`bi bi-${linkCopied ? 'check' : 'clipboard'}`}></i>
                            {linkCopied ? 'Copied!' : 'Copy'}
                          </button>
                        </div>

                        <div className="link-info mt-3">
                          <div className="info-item">
                            <i className="bi bi-clock"></i>
                            <span>Expires in: {linkData.expiresIn === 'never' ? 'Never' : `${linkData.expiresIn} days`}</span>
                          </div>
                          <div className="info-item">
                            <i className="bi bi-lock"></i>
                            <span>{linkData.password ? 'Password protected' : 'No password'}</span>
                          </div>
                          <div className="info-item">
                            <i className="bi bi-download"></i>
                            <span>{linkData.allowDownload ? 'Download allowed' : 'View only'}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        className="btn btn-outline-secondary w-100 mt-3"
                        onClick={() => setGeneratedLink('')}
                      >
                        <i className="bi bi-arrow-left me-2"></i>
                        Generate New Link
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
                Close
              </button>
              {shareMethod === 'email' && (
                <button type="button" className="btn btn-danger" onClick={handleShareByEmail}>
                  <i className="bi bi-send me-2"></i>
                  Send Email
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ReportShareModal;