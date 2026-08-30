// One-off script: synthesizes a short beep WAV for the native alert sound.
// Run with: node scripts/generate-beep.js
const fs = require('fs');
const path = require('path');

const sampleRate = 44100;
const durationSec = 0.18;
const freqHz = 880;
const numSamples = Math.floor(sampleRate * durationSec);

const dataSize = numSamples * 2; // 16-bit mono
const buffer = Buffer.alloc(44 + dataSize);

buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + dataSize, 4);
buffer.write('WAVE', 8);
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20); // PCM
buffer.writeUInt16LE(1, 22); // mono
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate
buffer.writeUInt16LE(2, 32); // block align
buffer.writeUInt16LE(16, 34); // bits per sample
buffer.write('data', 36);
buffer.writeUInt32LE(dataSize, 40);

for (let i = 0; i < numSamples; i++) {
  const t = i / sampleRate;
  const envelope = Math.min(1, (numSamples - i) / (sampleRate * 0.05)); // quick fade-out
  const sample = Math.sin(2 * Math.PI * freqHz * t) * envelope * 0.5;
  buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
}

const outPath = path.join(__dirname, '..', 'assets', 'alert-beep.wav');
fs.writeFileSync(outPath, buffer);
console.log('Written', outPath);
