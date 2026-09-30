import { TradingEngine } from '../server/engine/engine.js';
import { getRoundCandleSegment } from '../server/data-loader.js';
import { SIDES, ORDER_TYPES } from '../server/engine/types.js';

async function testFullRound() {
  console.log('Testing full round across all 5 regimes and all 180 ticks...');

  for (let roundIndex = 0; roundIndex < 3; roundIndex++) {
    console.log(`\n--- Testing Round ${roundIndex} ---`);
    const segment = getRoundCandleSegment(roundIndex, 180, 'seed_test_' + roundIndex, 15);
    console.log(`Regime: ${segment.regimeName}, ticks count: ${segment.ticks.length}`);

    const engine = new TradingEngine({ startingBalance: 10000 });
    const p1 = engine.addPlayer({ id: 'p1', nickname: 'Alice' });
    const p2 = engine.addPlayer({ id: 'p2', nickname: 'Bob' });
    const p3 = engine.addPlayer({ id: 'p3', nickname: 'Charlie' });

    engine.initRound(roundIndex, segment.ticks, segment.ticks.length);

    for (let t = 0; t < segment.ticks.length; t++) {
      const timeLeft = segment.ticks.length - t;

      // Random trades and limit orders around tick 120-135 (52s left)
      if (t === 10) {
        engine.openPosition('p1', SIDES.LONG, 25, 10, 'manual', 2500, 5, 10);
      }
      if (t === 50) {
        engine.placeLimitOrder('p2', SIDES.LONG, segment.ticks[t].close * 0.98, 2000, null, 10, 5, 15);
      }
      if (t === 100) {
        engine.openPosition('p3', SIDES.SHORT, 50, 20, 'manual', 5000, 8, 20);
      }
      if (t === 125) {
        // Exactly near 52s left!
        console.log(`At tick ${t} (${timeLeft}s left), testing operations...`);
        engine.updatePositionTpSl('p1', engine.players.get('p1').positions[0]?.id, 4, 12);
        engine.placeLimitOrder('p1', SIDES.SHORT, segment.ticks[t].close * 1.02, 1000, null, 5, 3, 10);
      }

      try {
        const res = engine.stepTick([]);
        if (!res && t < segment.ticks.length - 1) {
          console.error(`ERROR: stepTick returned null prematurely at tick ${t} (timeLeft: ${timeLeft})!`);
          process.exit(1);
        }
      } catch (err) {
        console.error(`EXCEPTION in stepTick at tick ${t} (${timeLeft}s left):`, err);
        process.exit(1);
      }
    }
    console.log(`Round ${roundIndex} completed successfully without crashing!`);
  }

  console.log('\nAll 3 rounds tested across all 180 ticks without any crash!');
}

testFullRound().catch(err => {
  console.error(err);
  process.exit(1);
});
