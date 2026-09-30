import { spawn } from 'node:child_process';
import http from 'node:http';
import { WebSocket } from 'ws';

async function checkConsole() {
  console.log('Launching headless Chrome to inspect console errors...');
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

  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  ws.send(JSON.stringify({ id: 1, method: 'Console.enable' }));
  ws.send(JSON.stringify({ id: 2, method: 'Runtime.enable' }));
  ws.send(JSON.stringify({ id: 3, method: 'Page.enable' }));

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.method === 'Runtime.exceptionThrown') {
      console.log('\n[BROWSER EXCEPTION]', JSON.stringify(msg.params.exceptionDetails, null, 2));
    } else if (msg.method === 'Console.messageAdded') {
      console.log('\n[CONSOLE LOG]', msg.params.message.level, msg.params.message.text);
    }
  });

  await new Promise(r => setTimeout(r, 2000));

  // Evaluate document.getElementById('root').innerHTML
  ws.send(JSON.stringify({
    id: 10,
    method: 'Runtime.evaluate',
    params: { expression: 'document.getElementById("root").innerHTML' }
  }));

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.id === 10) {
      console.log('\n[ROOT INNER HTML length]:', (msg.result?.result?.value || '').length);
      console.log('[ROOT INNER HTML preview]:', (msg.result?.result?.value || '').slice(0, 300));
    }
  });

  await new Promise(r => setTimeout(r, 1000));

  ws.close();
  proc.kill();
}

checkConsole().catch(err => {
  console.error('Error running checkConsole:', err);
  process.exit(1);
});
