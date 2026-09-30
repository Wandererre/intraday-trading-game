import React, { useState } from 'react';
import PositionsTab from './PositionsTab';
import TradeFeedTab from './TradeFeedTab';
import LeaderboardTab from './LeaderboardTab';

export default function Tabs({
  leaderboard = [],
  feed = [],
  gameState = 'LOBBY',
  currentUserId = null,
  onClosePosition,
  limitOrders = [],
  onCancelLimitOrder,
  currentPrice = 0
}) {
  const [activeTab, setActiveTab] = useState('positions');

  // Count total open positions across all players
  let totalOpenPositions = 0;
  leaderboard.forEach(p => {
    if (p.positions) totalOpenPositions += p.positions.length;
    else if (p.position) totalOpenPositions += 1;
  });

  return (
    <div className="card" style={{ marginTop: '14px' }}>
      <div className="tab-list">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'positions' ? 'active' : ''}`}
          onClick={() => setActiveTab('positions')}
        >
          Positions {totalOpenPositions > 0 && `(${totalOpenPositions})`}{limitOrders.length > 0 && ` · ${limitOrders.length} Limit`}
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'feed' ? 'active' : ''}`}
          onClick={() => setActiveTab('feed')}
        >
          Trade Feed {feed.length > 0 && `(${feed.length})`}
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('leaderboard')}
        >
          Leaderboard ({leaderboard.length})
        </button>
      </div>

      <div>
        {activeTab === 'positions' && (
          <PositionsTab
            leaderboard={leaderboard}
            currentUserId={currentUserId}
            onClosePosition={onClosePosition}
            limitOrders={limitOrders}
            onCancelLimitOrder={onCancelLimitOrder}
            currentPrice={currentPrice}
          />
        )}
        {activeTab === 'feed' && (
          <TradeFeedTab feed={feed} />
        )}
        {activeTab === 'leaderboard' && (
          <LeaderboardTab leaderboard={leaderboard} currentUserId={currentUserId} />
        )}
      </div>
    </div>
  );
}
