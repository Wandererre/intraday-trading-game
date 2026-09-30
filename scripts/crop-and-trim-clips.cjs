const { spawnSync } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const fs = require('path');
const nodeFs = require('fs');

const memesDir = 'client/public/memes';
const backupDir = 'client/public/memes/raw_backup';

if (!nodeFs.existsSync(backupDir)) {
  nodeFs.mkdirSync(backupDir, { recursive: true });
}

// 1. Backup originals
const files = ['top_profit.mp4', 'last_standing.mp4', 'best_trade.mp4', 'biggest_loss.mp4'];
for (const f of files) {
  const src = `${memesDir}/${f}`;
  const dest = `${backupDir}/${f}`;
  if (nodeFs.existsSync(src) && !nodeFs.existsSync(dest)) {
    nodeFs.copyFileSync(src, dest);
    console.log(`Backed up ${f} to ${backupDir}`);
  }
}

// 2. Process clips
// a. top_profit.mp4: crop 720:404:0:438
console.log('Processing top_profit.mp4...');
spawnSync(ffmpeg, [
  '-i', `${backupDir}/top_profit.mp4`,
  '-vf', 'crop=720:404:0:438',
  '-c:a', 'copy',
  '-c:v', 'libx264',
  '-crf', '18',
  '-preset', 'fast',
  '-y',
  `${memesDir}/top_profit.mp4`
]);

// b. last_standing.mp4: full frame or slight cleanup
console.log('Processing last_standing.mp4...');
spawnSync(ffmpeg, [
  '-i', `${backupDir}/last_standing.mp4`,
  '-c:a', 'copy',
  '-c:v', 'libx264',
  '-crf', '18',
  '-preset', 'fast',
  '-y',
  `${memesDir}/last_standing.mp4`
]);

// c. best_trade.mp4: trim to 10s and crop 640:296:0:32
console.log('Processing best_trade.mp4 (trimmed to 10s, cropped)...');
spawnSync(ffmpeg, [
  '-ss', '0',
  '-i', `${backupDir}/best_trade.mp4`,
  '-t', '10',
  '-vf', 'crop=640:296:0:32',
  '-c:a', 'aac',
  '-c:v', 'libx264',
  '-crf', '18',
  '-preset', 'fast',
  '-y',
  `${memesDir}/best_trade.mp4`
]);

// d. biggest_loss.mp4: crop 250:272:60:184 (rounded to even dimensions: 250:272)
console.log('Processing biggest_loss.mp4 (cropped black bars)...');
spawnSync(ffmpeg, [
  '-i', `${backupDir}/biggest_loss.mp4`,
  '-vf', 'crop=250:272:60:184',
  '-c:a', 'aac',
  '-c:v', 'libx264',
  '-crf', '18',
  '-preset', 'fast',
  '-y',
  `${memesDir}/biggest_loss.mp4`
]);

console.log('Finished processing all clips!');
