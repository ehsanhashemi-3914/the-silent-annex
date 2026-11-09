// One-off 2D artwork drawn with the Canvas API: signs, posters, the lobby mural,
// clock faces and CRT screens. All of it is original and generated at load time.

import * as THREE from 'three';
import { createRng } from './Noise';

const SERIF = '"Cormorant Garamond", Georgia, serif';
const SANS = '"Barlow Condensed", "Arial Narrow", sans-serif';
const MONO = '"Courier Prime", "Courier New", monospace';
const TERMINAL = '"VT323", "Courier New", monospace';

function makeCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext('2d') as CanvasRenderingContext2D };
}

function toTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Scuffs a surface with soft specks and streaks, so flat artwork looks aged. */
function ageSurface(ctx: CanvasRenderingContext2D, width: number, height: number, seed: number, amount = 1): void {
  const rng = createRng(seed);
  for (let i = 0; i < 90 * amount; i++) {
    ctx.fillStyle = rng() > 0.5 ? `rgba(0,0,0,${rng() * 0.12})` : `rgba(255,255,240,${rng() * 0.05})`;
    const r = rng() * width * 0.05;
    ctx.beginPath();
    ctx.ellipse(rng() * width, rng() * height, r, r * (0.3 + rng()), rng() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const edge = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.3, width / 2, height / 2, Math.max(width, height) * 0.72);
  edge.addColorStop(0, 'rgba(0,0,0,0)');
  edge.addColorStop(1, `rgba(20,14,6,${0.34 * amount})`);
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, width, height);
}

export function signTexture(text: string, aspect: number, color: string, background: string): THREE.CanvasTexture {
  const height = 128;
  const width = Math.min(1024, Math.round(height * aspect));
  const { canvas, ctx } = makeCanvas(width, height);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, width - 12, height - 12);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let fontSize = 76;
  ctx.font = `600 ${fontSize}px ${SANS}`;
  while (ctx.measureText(text).width > width - 36 && fontSize > 14) {
    fontSize -= 2;
    ctx.font = `600 ${fontSize}px ${SANS}`;
  }
  ctx.fillText(text, width / 2, height / 2 + 4);
  ageSurface(ctx, width, height, text.length * 37 + 3, 0.7);
  return toTexture(canvas);
}

export function posterTexture(title: string, seed = 5): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(512, 700);
  ctx.fillStyle = '#b7ae95';
  ctx.fillRect(0, 0, 512, 700);
  ctx.fillStyle = '#1e1b16';
  ctx.fillRect(28, 28, 456, 90);
  ctx.fillStyle = '#d6cdb2';
  ctx.font = `600 42px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 256, 74);
  ctx.fillStyle = '#2b2720';
  ctx.textAlign = 'left';
  ctx.font = `26px ${MONO}`;
  const lines = ['SERIES / TEST No. / TIME', '', 'A  Acoustic', 'B  Bioacoustic', 'G  Geophonic', 'S  Structural', '', 'Time of recording:', 'use the time the', 'recording STOPPED.', '', 'e.g.  S / 07 / 1430'];
  lines.forEach((line, i) => ctx.fillText(line, 44, 170 + i * 40));
  ageSurface(ctx, 512, 700, seed, 1.1);
  return toTexture(canvas);
}

export function noticeboardTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(1024, 640);
  ctx.fillStyle = '#5a4630';
  ctx.fillRect(0, 0, 1024, 640);
  const rng = createRng(77);
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = rng() > 0.5 ? 'rgba(30,20,10,0.32)' : 'rgba(150,120,80,0.16)';
    ctx.fillRect(rng() * 1024, rng() * 640, 2 + rng() * 3, 2 + rng() * 3);
  }
  const notes = [
    { x: 110, y: 120, w: 240, h: 320, title: 'PROTOCOL H', lines: 7, tint: '#cfc6ac', r: -0.03 },
    { x: 410, y: 90, w: 230, h: 300, title: 'BULLETIN 212', lines: 8, tint: '#bfb79d', r: 0.02 },
    { x: 700, y: 110, w: 190, h: 140, title: 'ROAD', lines: 3, tint: '#c8b57c', r: 0.05 },
    { x: 710, y: 310, w: 220, h: 180, title: 'CANTEEN', lines: 4, tint: '#c3bca6', r: -0.05 },
    { x: 420, y: 440, w: 170, h: 130, title: 'LOST: HEADSETS', lines: 2, tint: '#b6ad92', r: 0.03 },
  ];
  for (const note of notes) {
    ctx.save();
    ctx.translate(note.x + note.w / 2, note.y + note.h / 2);
    ctx.rotate(note.r);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(-note.w / 2 + 5, -note.h / 2 + 7, note.w, note.h);
    ctx.fillStyle = note.tint;
    ctx.fillRect(-note.w / 2, -note.h / 2, note.w, note.h);
    ctx.fillStyle = '#25211a';
    ctx.font = `600 ${Math.min(30, note.w / 7)}px ${SANS}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(note.title, -note.w / 2 + 14, -note.h / 2 + 14);
    for (let l = 0; l < note.lines; l++) {
      ctx.fillStyle = 'rgba(30,26,20,0.65)';
      const y = -note.h / 2 + 56 + l * 26;
      ctx.fillRect(-note.w / 2 + 14, y, (note.w - 40) * (0.6 + rng() * 0.4), 5);
    }
    ctx.fillStyle = '#7b1e16';
    ctx.beginPath();
    ctx.arc(0, -note.h / 2 + 6, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  return toTexture(canvas);
}

/** The lobby mural: an abstract 1960s mountain relief with sound radiating through rock. */
export function muralTexture(): THREE.CanvasTexture {
  const width = 1536;
  const height = 560;
  const { canvas, ctx } = makeCanvas(width, height);
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#26332f');
  sky.addColorStop(1, '#6d7a64');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const rng = createRng(1961);
  const layers = [
    { base: 0.42, amp: 0.2, color: '#4f5e56' },
    { base: 0.54, amp: 0.2, color: '#3d4a45' },
    { base: 0.68, amp: 0.15, color: '#2c3733' },
    { base: 0.82, amp: 0.08, color: '#1f2826' },
  ];
  for (const layer of layers) {
    const peaks = Array.from({ length: 12 }, (_, i) => ({ x: (i / 11) * width, y: layer.base + (rng() - 0.5) * layer.amp }));
    ctx.fillStyle = layer.color;
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (const peak of peaks) ctx.lineTo(peak.x, peak.y * height);
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
  }

  // Sound rings spreading through the mountain, from a point deep inside it.
  ctx.strokeStyle = 'rgba(214,173,92,0.62)';
  for (let i = 1; i <= 11; i++) {
    ctx.lineWidth = 7 - i * 0.45;
    ctx.beginPath();
    ctx.ellipse(width / 2, height * 0.98, i * 90, i * 54, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#d6ad5c';
  ctx.beginPath();
  ctx.arc(width / 2, height * 0.96, 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(232,218,180,0.92)';
  ctx.font = `600 62px ${SERIF}`;
  ctx.textAlign = 'center';
  ctx.fillText('HOLLIN RIDGE INSTITUTE', width / 2, 84);
  ctx.font = `italic 34px ${SERIF}`;
  ctx.fillText('That which is heard is kept', width / 2, 128);
  ageSurface(ctx, width, height, 1961, 1.4);
  return toTexture(canvas);
}

export function plaqueTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(512, 320);
  const metal = ctx.createLinearGradient(0, 0, 512, 320);
  metal.addColorStop(0, '#7a5f2c');
  metal.addColorStop(0.5, '#a78544');
  metal.addColorStop(1, '#6b5226');
  ctx.fillStyle = metal;
  ctx.fillRect(0, 0, 512, 320);
  ctx.strokeStyle = 'rgba(30,20,6,0.8)';
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, 484, 292);
  ctx.fillStyle = '#21180a';
  ctx.textAlign = 'center';
  ctx.font = `600 34px ${SERIF}`;
  ctx.fillText('HOLLIN RIDGE INSTITUTE', 256, 74);
  ctx.fillText('OF ACOUSTIC SCIENCE', 256, 114);
  ctx.font = `italic 28px ${SERIF}`;
  ctx.fillText('"That which is heard is kept."', 256, 170);
  ctx.font = `600 54px ${SERIF}`;
  ctx.fillText('1961', 256, 244);
  ctx.font = `22px ${SERIF}`;
  ctx.fillText('first opened its doors', 256, 278);
  ageSurface(ctx, 512, 320, 44, 0.8);
  return toTexture(canvas);
}

export function clockFaceTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(256, 256);
  ctx.fillStyle = '#c9c4b0';
  ctx.beginPath();
  ctx.arc(128, 128, 126, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1b1a18';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 28px ${SANS}`;
  for (let hour = 1; hour <= 12; hour++) {
    const angle = (hour / 12) * Math.PI * 2 - Math.PI / 2;
    ctx.fillText(String(hour), 128 + Math.cos(angle) * 98, 128 + Math.sin(angle) * 98);
  }
  for (let tick = 0; tick < 60; tick++) {
    const angle = (tick / 60) * Math.PI * 2;
    const long = tick % 5 === 0;
    ctx.lineWidth = long ? 3 : 1;
    ctx.strokeStyle = '#1b1a18';
    ctx.beginPath();
    ctx.moveTo(128 + Math.cos(angle) * (long ? 110 : 116), 128 + Math.sin(angle) * (long ? 110 : 116));
    ctx.lineTo(128 + Math.cos(angle) * 122, 128 + Math.sin(angle) * 122);
    ctx.stroke();
  }
  ageSurface(ctx, 256, 256, 9, 1);
  return toTexture(canvas);
}

export function screenTexture(kind: 'terminal' | 'scope' | 'status', seed = 1): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(256, 192);
  ctx.fillStyle = '#04100a';
  ctx.fillRect(0, 0, 256, 192);
  const rng = createRng(seed);
  if (kind === 'scope') {
    ctx.strokeStyle = 'rgba(70,240,150,0.18)';
    for (let i = 0; i <= 8; i++) {
      ctx.beginPath();
      ctx.moveTo((i / 8) * 256, 0);
      ctx.lineTo((i / 8) * 256, 192);
      ctx.moveTo(0, (i / 8) * 192);
      ctx.lineTo(256, (i / 8) * 192);
      ctx.stroke();
    }
    ctx.strokeStyle = '#6dffb0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < 256; x += 2) {
      const y = 96 + Math.sin(x * 0.07 + seed) * 26 * Math.sin(x * 0.014) + (rng() - 0.5) * 8;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  } else {
    ctx.fillStyle = '#62f0a0';
    ctx.font = `20px ${TERMINAL}`;
    ctx.textBaseline = 'top';
    const lines =
      kind === 'status'
        ? ['SYS 15-10-86 03:17', 'SEAL   DISENGAGED', 'GAIN   MAX', 'CARRIER 2.4 MHZ', '', '> _']
        : ['HOLLIN RIDGE NET', 'AUX POWER', '----------------', 'STAFF ON SITE: 41', 'STAFF OUT:     0', '', '> _'];
    lines.forEach((line, i) => ctx.fillText(line, 12, 14 + i * 24));
  }
  for (let y = 0; y < 192; y += 3) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(0, y, 256, 1);
  }
  return toTexture(canvas);
}

/** Soft spot used as a stain decal: dark in the middle, transparent at the edge. */
export function stainTexture(seed = 3): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(256, 256);
  const rng = createRng(seed);
  ctx.clearRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) {
    const x = 128 + (rng() - 0.5) * 150;
    const length = 40 + rng() * 170;
    const radius = 8 + rng() * 34;
    const gradient = ctx.createRadialGradient(x, 60, 0, x, 60, radius);
    const alpha = 0.03 + rng() * 0.05;
    gradient.addColorStop(0, `rgba(18,14,10,${alpha})`);
    gradient.addColorStop(1, 'rgba(18,14,10,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, 20, radius * 2, length);
  }
  return toTexture(canvas);
}

/** A cookie for the torch: an uneven pool, brighter hotspot and a faint outer ring. */
export function flashlightCookie(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(256, 256);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 256, 256);
  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 126);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.22, '#e8e8e8');
  gradient.addColorStop(0.5, '#7c7c7c');
  gradient.addColorStop(0.72, '#474747');
  gradient.addColorStop(0.86, '#5c5c5c');
  gradient.addColorStop(0.93, '#2a2a2a');
  gradient.addColorStop(1, '#000000');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  const rng = createRng(17);
  ctx.globalCompositeOperation = 'multiply';
  for (let i = 0; i < 30; i++) {
    const r = 20 + rng() * 50;
    const x = rng() * 256;
    const y = rng() * 256;
    const blot = ctx.createRadialGradient(x, y, 0, x, y, r);
    blot.addColorStop(0, `rgba(170,170,170,${0.3 + rng() * 0.3})`);
    blot.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = blot;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return toTexture(canvas);
}
