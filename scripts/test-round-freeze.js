import { spawn } from 'node:child_process';
import http from 'node:http';
import { WebSocket } from 'ws';

async function testRoundRun() {
  console.log('1. Starting headless Chrome on port 9222...');
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-sandbox',
    'http://localhost:3000'
  ]);

  await new Promise(r => setTimeout(r, 1500));

  // Get WebSocket debugger URL from http://127.0.0.1:9222/json
  const tabs = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  const pageTab = tabs.find(t => t.type === 'page');
  if (!pageTab || !pageTab.webSocketDebuggerUrl) {
    console.error('No page tab found in Chrome:', tabs);
    proc.kill();
    return;
  }

  const cdp = new WebSocket(pageTab.webSocketDebuggerUrl);
  await new Promise(r => cdp.on('open', r));

  let exceptions = [];
  let consoleLogs = [];

  cdp.send(JSON.stringify({ id: 1, method: 'Console.enable' }));
  cdp.send(JSON.stringify({ id: 2, method: 'Runtime.enable' }));
  cdp.send(JSON.stringify({ id: 3, method: 'Page.enable' }));

  cdp.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.method === 'Runtime.exceptionThrown') {
      console.error('\n[BROWSER EXCEPTION]', JSON.stringify(msg.params.exceptionDetails, null, 2));
      exceptions.push(msg.params.exceptionDetails);
    } else if (msg.method === 'Console.messageAdded') {
      if (msg.params.message.level === 'error') {
        console.error('\n[CONSOLE ERROR]', msg.params.message.text);
      }
      consoleLogs.push(msg.params.message.text);
    }
  });

  console.log('2. Connected to Chrome CDP. Creating Room from headless browser...');

  // Click create room or fill input
  const evalScript = async (expression) => {
    return new Promise((resolve) => {
      const id = Math.floor(Math.random() * 100000);
      const handler = (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.id === id) {
          cdp.off('message', handler);
          resolve(msg.result);
        }
      };
      cdp.on('message', handler);
      cdp.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, awaitPromise: true } }));
    });
  };

  await evalScript(`
    (async () => {
      const input = document.querySelector('input[placeholder="Enter your handle (e.g. Satoshi)"]');
      if (input) {
        input.value = "Tester";
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      await new Promise(r => setTimeout(r, 200));
      const createBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('CREATE ARENA'));
      if (createBtn) createBtn.click();
    })()
  `);

  await new Promise(r => setTimeout(r, 1000));

  console.log('3. Starting Game...');
  await evalScript(`
    (() => {
      const startBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('START ARENA MATCH'));
      if (startBtn) startBtn.click();
    })()
  `);

  console.log('4. Game started! Monitoring for 20 seconds, placing trades, limit orders...');

  // Place a trade
  await new Promise(r => setTimeout(r, 2000));
  await evalScript(`
    (() => {
      const buyBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('BUY LONG'));
      if (buyBtn) buyBtn.click();
    })()
  `);

  // Switch to Limit tab and place a limit order
  await new Promise(r => setTimeout(r, 2000));
  await evalScript(`
    (() => {
      const limitTab = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'LIMIT');
      if (limitTab) limitTab.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 500));
  await evalScript(`
    (() => {
      const placeLimitBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('PLACE LONG LIMIT'));
      if (placeLimitBtn) placeLimitBtn.click();
    })()
  `);

  // Open TP/SL modal from My Positions
  await new Promise(r => setTimeout(r, 2000));
  await evalScript(`
    (() => {
      const tpslBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('TP/SL'));
      if (tpslBtn) tpslBtn.click();
    })()
  `);

  // Monitor for any errors
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const timeText = await evalScript(`document.querySelector('.tabular-nums')?.textContent`);
    process.stdout.write(`Tick ${i+1}... `);
    if (exceptions.length > 0) {
      console.error('\nFound exceptions during run!');
      break;
    }
  }

  console.log('\nExceptions caught:', exceptions.length);
  cdp.close();
  proc.kill();

  if (exceptions.length > 0) {
    process.exit(1);
  }
}

testRoundRun().catch(err => {
  console.error(err);
  process.exit(1);
});
