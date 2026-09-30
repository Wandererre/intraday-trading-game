# ⚡ INTRADAY.ARENA

> Real-time multiplayer intraday trading battle game with sub-second WebSocket order execution, Polymarket/Kalshi-style order panel, live candlestick charts, leverage, limit orders, liquidations, and predatory loan banking.

---

## 🎮 Features

- **True Real-time Multiplayer**: Powered by low-latency Node.js WebSockets. All traders compete on the exact same live crypto market candles.
- **Polymarket & Kalshi Market Order UI**:
  - `⚡ MARKET ORDER`: Instant fill at best market price.
  - `🎯 LIMIT ORDER`: Set your target entry price; fills automatically when market touches or crosses your limit price.
  - Big outcome cards: `▲ BUY LONG` (Green) & `▼ BUY SHORT` (Red).
  - Quick dollar presets (`+$50`, `+$100`, `+$250`, `+$500`) and percentage chips (`25%`, `50%`, `75%`, `MAX`).
  - Leverage multipliers from `1x` to `20x` with live liquidation price warnings.
- **Degenerate Loan Bank**:
  - Running low on cash? Borrow emergency funds with predatory per-second interest scaling.
  - One-click `Repay All` to clear debt.
- **Championship Multi-Round System**:
  - Configurable 3-round matches (1 to 5 mins per round).
  - Each round starts with fresh $10,000 cash balance.
  - Cumulative score tracking across rounds.
  - Final Championship Podiums & interactive replay equity curves comparing all traders.
- **Host Controls**:
  - Live host lobby with round duration and leverage settings.
  - In-game host buttons to restart match keeping everyone connected or end game early.

---

## 🚀 Quick Start (Local)

1. **Clone & Install**:
   ```bash
   git clone https://github.com/wandererre/intraday-trading-game.git
   cd intraday-trading-game
   npm install
   ```

2. **Run Server**:
   ```bash
   npm start
   ```

3. **Play**:
   - Open [http://localhost:3000](http://localhost:3000) in your browser.
   - Enter your nickname to join the lobby!
   - Friends on the same local network can connect to your local IP (e.g. `http://192.168.x.x:3000`).

---

## 🌐 Free 1-Click Cloud Hosting (Render / Railway / Fly.io)

### Deploy to Render (Free Web Service)
1. Go to [Render.com](https://render.com) and click **New +** -> **Web Service**.
2. Connect your GitHub repo `wandererre/intraday-trading-game`.
3. Set the following:
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
4. Click **Deploy Web Service**. You'll get a public HTTPS/WSS URL (e.g. `https://intraday-arena.onrender.com`) to share with friends anywhere in the world!

---

## 🧪 Testing

Run the comprehensive unit test suite:
```bash
npm test
```

Run the multi-client WebSocket E2E test:
```bash
node scripts/test-e2e.js
```
