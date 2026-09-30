const { execSync } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const fs = require('fs');

const files = ['top_profit.mp4', 'last_standing.mp4', 'best_trade.mp4', 'biggest_loss.mp4'];
for (const f of files) {
  const p = 'client/public/memes/' + f;
  if (!fs.existsSync(p)) continue;
  try {
    execSync(`"${ffmpeg}" -i "${p}"`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (err) {
    const lines = (err.stderr || '').split('\n').filter(l => l.includes('Duration') || l.includes('Video:'));
    console.log(`=== ${f} ===\n${lines.join('\n')}\n`);
  }
}
