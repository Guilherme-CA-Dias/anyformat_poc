import React from 'react';

const IntegrationsSection = ({ 
  integrations, 
  openIntegrationModal 
}) => {
  return (
    <div className="integrations-section">
      <h2>Available Integrations</h2>
      {integrations.length === 0 ? (
        <div className="no-integrations">No integrations available</div>
      ) : (
        <div className="integrations-grid">
          {integrations.map((integration) => (
            <div key={integration.id} className="integration-item">
              <button
                onClick={() => openIntegrationModal(integration)}
                className="integration-button"
                aria-label={`Open integration modal for ${integration.name}`}
              >
                <img
                  src={integration.logoUri}
                  alt={integration.name || "Integration Logo"}
                  className="integration-logo"
                />
              </button>

              {integration.connection?.disconnected === false && (
                <div className="connection-status">
                  Connected
                </div>
              )}

              <div className="integration-name">
                {integration.name || "Unknown Integration"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default IntegrationsSection; 