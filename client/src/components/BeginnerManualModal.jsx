import React from 'react';

export default function BeginnerManualModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 200,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(3px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      overflowY: 'auto'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '820px',
        maxHeight: '90vh',
        backgroundColor: '#12161f',
        border: '1px solid #38bdf8',
        borderRadius: '8px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.7)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: '#e2e8f0',
        fontFamily: 'Inter, -apple-system, sans-serif'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 24px',
          backgroundColor: '#181f2c',
          borderBottom: '1px solid #2d3748',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '22px' }}>📖</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, letterSpacing: '0.02em', color: '#ffffff' }}>
                TRADING RULES & AUTOMATION MANUAL
              </h2>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                A quick, plain-English guide to setting up automated strategies without code
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 16px',
              fontSize: '12px',
              fontWeight: 700,
              backgroundColor: '#334155',
              border: '1px solid #94a3b8',
              color: '#ffffff',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.4)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#475569';
              e.currentTarget.style.borderColor = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#334155';
              e.currentTarget.style.borderColor = '#94a3b8';
            }}
          >
            <span style={{ fontWeight: 900 }}>✕</span>
            <span>CLOSE</span>
          </button>
        </div>

        {/* Content Body */}
        <div style={{
          padding: '24px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          lineHeight: 1.5,
          fontSize: '13px'
        }}>
          {/* Section 1: The Big Picture */}
          <section style={{
            backgroundColor: 'rgba(56, 189, 248, 0.06)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '6px',
            padding: '16px'
          }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 700, color: '#38bdf8' }}>
              💡 What is Automation? (The Big Idea)
            </h3>
            <p style={{ margin: 0, color: '#cbd5e1' }}>
              Think of rules like setting <strong>smart alarms</strong>. Instead of staring at the chart every second and clicking Buy or Sell manually, you create simple rules:
            </p>
            <div style={{
              margin: '10px 0',
              padding: '10px 14px',
              backgroundColor: '#0b0f17',
              borderRadius: '4px',
              fontFamily: 'monospace',
              fontSize: '13px',
              color: '#4ade80',
              borderLeft: '3px solid #38bdf8'
            }}>
              IF [something happens in the market] (AND [optional condition]) THEN [take an action]
            </div>
            <p style={{ margin: 0, color: '#cbd5e1' }}>
              On every tick of the clock, the server checks your rules in order from 1 to 5. When a rule's conditions are true, it executes your trade immediately!
            </p>
          </section>

          {/* Section 2: What Each Indicator Means */}
          <section>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>
              📊 Market Indicators (What the dropdowns mean)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '10px' }}>
              <div style={cardStyle}>
                <div style={titleStyle}><span style={{ color: '#f59e0b' }}>price</span>: Current Price</div>
                <div style={descStyle}>The live price of Bitcoin right now. When it rises or drops, it triggers comparisons against averages or numbers.</div>
              </div>

              <div style={cardStyle}>
                <div style={titleStyle}><span style={{ color: '#38bdf8' }}>sma(N)</span>: Simple Moving Average</div>
                <div style={descStyle}>The average price over the last N ticks (e.g. 20 ticks). It acts as the <strong>baseline trend</strong>. Price above SMA = upward trend; price below SMA = downward trend.</div>
              </div>

              <div style={cardStyle}>
                <div style={titleStyle}><span style={{ color: '#818cf8' }}>ema(N)</span>: Exponential Moving Average</div>
                <div style={descStyle}>Like the SMA, but reacts much <strong>faster</strong> to sudden price spikes. Perfect for catching quick breakouts.</div>
              </div>

              <div style={cardStyle}>
                <div style={titleStyle}><span style={{ color: '#ec4899' }}>rsi(14)</span>: Oversold / Overbought Meter (0–100)</div>
                <div style={descStyle}>
                  • <strong>Below 30</strong> = Heavily discounted / oversold. Great chance to buy the dip!<br/>
                  • <strong>Above 70</strong> = Overheated / overbought. Great time to take profit or exit!
                </div>
              </div>

              <div style={cardStyle}>
                <div style={titleStyle}><span style={{ color: '#a78bfa' }}>percent change over N ticks</span></div>
                <div style={descStyle}>Measures the speed and momentum of recent price movement (e.g. +2% or -3% in the last 10 ticks).</div>
              </div>

              <div style={cardStyle}>
                <div style={titleStyle}><span style={{ color: '#34d399' }}>my position</span>: Your Trade Status</div>
                <div style={descStyle}>
                  • <strong>none</strong>: You are 100% in cash (no active trade).<br/>
                  • <strong>long</strong>: You have an open trade betting price goes UP.<br/>
                  • <strong>short</strong>: You have an open trade betting price goes DOWN.
                </div>
              </div>

              <div style={cardStyle}>
                <div style={titleStyle}><span style={{ color: '#fbbf24' }}>my PnL percent</span>: Active Profit/Loss %</div>
                <div style={descStyle}>Your current gain or loss percentage on the active position (e.g. +12% profit or -4% loss).</div>
              </div>

              <div style={cardStyle}>
                <div style={titleStyle}><span style={{ color: '#94a3b8' }}>seconds left in round</span></div>
                <div style={descStyle}>Clock countdown for the round. Useful for rules like: <em>IF seconds left is below 10 THEN close position</em> to lock in cash.</div>
              </div>
            </div>
          </section>

          {/* Section 3: Comparisons Explained */}
          <section>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>
              ⚖️ Comparisons (How conditions trigger)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '10px' }}>
              <div style={cardStyle}>
                <div style={titleStyle}>⚡ crosses above / crosses below</div>
                <div style={descStyle}>
                  Fires <strong>only at the exact moment</strong> the line cuts across the target. For example, when price jumps from below sma(20) to above it. This prevents the rule from firing over and over.
                </div>
              </div>

              <div style={cardStyle}>
                <div style={titleStyle}>📈 is above / is below</div>
                <div style={descStyle}>
                  Remains true as long as the value is higher or lower (e.g., <em>rsi is below 30</em> or <em>my PnL is above 10</em>).
                </div>
              </div>

              <div style={cardStyle}>
                <div style={titleStyle}>🎯 equals</div>
                <div style={descStyle}>
                  An exact match. Most commonly used for checking: <strong>my position equals none</strong>.
                </div>
              </div>
            </div>
          </section>

          {/* Section 4: Golden Rules for Beginners */}
          <section style={{
            backgroundColor: 'rgba(234, 179, 8, 0.08)',
            border: '1px solid rgba(234, 179, 8, 0.28)',
            borderRadius: '6px',
            padding: '16px'
          }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 700, color: '#eab308' }}>
              ⭐ 4 Golden Rules for Beginners
            </h3>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>
                <strong>1. Always add "AND my position is none" when opening a trade!</strong><br/>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  If you don't check this, your rule might try to open a new trade repeatedly while you already have one open.
                </span>
              </li>
              <li>
                <strong>2. Anti-Spam Cooldown is automatic (10 ticks):</strong><br/>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  After any rule executes an action, it automatically pauses for 10 ticks so it won't spam trades or drain your cash.
                </span>
              </li>
              <li>
                <strong>3. Use Stop Loss (SL) & Take Profit (TP) to protect your funds:</strong><br/>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  You can set SL % and TP % right on your open order, or create an exit rule like <em>IF my PnL percent is below -5 THEN close position</em>.
                </span>
              </li>
              <li>
                <strong>4. Master Killswitch:</strong><br/>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  You can toggle <strong>Automation: ON / OFF</strong> at any time in the top bar to pause or resume your bot instantly mid-round.
                </span>
              </li>
            </ul>
          </section>

          {/* Section 5: Starter Templates */}
          <section>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>
              🚀 One-Click Starter Templates (Top Bar)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
              <div style={{ ...cardStyle, borderLeft: '3px solid #38bdf8' }}>
                <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: '4px' }}>+ MA Cross</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Opens LONG when price breaks above sma(20), and closes when price drops below it. Classic trend-following!
                </div>
              </div>

              <div style={{ ...cardStyle, borderLeft: '3px solid #10b981' }}>
                <div style={{ fontWeight: 700, color: '#10b981', marginBottom: '4px' }}>+ RSI Dip Buy</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Buys deep dips when RSI drops below 30, and takes profit when RSI rebounds above 65.
                </div>
              </div>

              <div style={{ ...cardStyle, borderLeft: '3px solid #ef4444' }}>
                <div style={{ fontWeight: 700, color: '#ef4444', marginBottom: '4px' }}>+ SL & TP Guard</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Safety rules that automatically close your position if profit hits +10% or if loss exceeds -5%.
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 24px',
          backgroundColor: '#181f2c',
          borderTop: '1px solid #2d3748',
          display: 'flex',
          justifyContent: 'flex-end',
          flexShrink: 0
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 20px',
              fontSize: '13px',
              fontWeight: 700,
              backgroundColor: '#38bdf8',
              border: 'none',
              color: '#090b0e',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Got it, Let's Trade!
          </button>
        </div>
      </div>
    </div>
  );
}

const cardStyle = {
  backgroundColor: '#181e2b',
  border: '1px solid #2d3748',
  borderRadius: '6px',
  padding: '12px'
};

const titleStyle = {
  fontWeight: 700,
  fontSize: '13px',
  color: '#f1f5f9',
  marginBottom: '4px'
};

const descStyle = {
  fontSize: '12px',
  color: '#94a3b8',
  lineHeight: 1.45
};
