// Tools for generating sound from pure maths. Each function fills an AudioBuffer with
// samples, so every noise in the game is original, and none has to be downloaded.

export function createNoiseSamples(length: number, seed = 1): Float32Array {
  const out = new Float32Array(length);
  let state = seed >>> 0 || 1;
  for (let i = 0; i < length; i++) {
    // A fast xorshift generator. It only has to sound random, not be statistically good.
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    out[i] = ((state >>> 0) / 4294967296) * 2 - 1;
  }
  return out;
}

/** A one-pole low-pass filter over a sample array, from a cutoff that can vary in time. */
export function lowpass(samples: Float32Array, cutoff: (t: number) => number, sampleRate: number): Float32Array {
  const out = new Float32Array(samples.length);
  let y = 0;
  for (let i = 0; i < samples.length; i++) {
    const hz = cutoff(i / sampleRate);
    const a = 1 - Math.exp((-2 * Math.PI * hz) / sampleRate);
    y += a * (samples[i] - y);
    out[i] = y;
  }
  return out;
}

export function bandpass(samples: Float32Array, centre: number, q: number, sampleRate: number): Float32Array {
  // A standard two-pole resonant filter.
  const out = new Float32Array(samples.length);
  const w = (2 * Math.PI * centre) / sampleRate;
  const alpha = Math.sin(w) / (2 * q);
  const a0 = 1 + alpha;
  const b0 = alpha / a0;
  const a1 = (-2 * Math.cos(w)) / a0;
  const a2 = (1 - alpha) / a0;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i];
    const y = b0 * x - b0 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    out[i] = y;
  }
  return out;
}

/** Stretches a function of time into a buffer. */
export function render(ctx: BaseAudioContext, seconds: number, fn: (t: number, i: number) => number, channels = 1): AudioBuffer {
  const length = Math.ceil(seconds * ctx.sampleRate);
  const buffer = ctx.createBuffer(channels, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = fn(i / ctx.sampleRate, i);
  if (channels === 2) buffer.copyToChannel(data, 1);
  return buffer;
}

export function fromSamples(ctx: BaseAudioContext, samples: Float32Array, gain = 1): AudioBuffer {
  const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) data[i] = samples[i] * gain;
  return buffer;
}

/** Fast attack, exponential decay: the envelope of nearly every knock, click and thud. */
export function decay(t: number, attack: number, time: number): number {
  return t < attack ? t / attack : Math.exp(-(t - attack) / time);
}

/**
 * A loop made from noise, with a crossfade across its ends so the seam is inaudible.
 * Filtering happens first, as a filter's start and end wouldn't otherwise match up.
 */
export function makeNoiseLoop(ctx: BaseAudioContext, seconds: number, cutoff: number, seed: number, gain = 1): AudioBuffer {
  const length = Math.floor(seconds * ctx.sampleRate);
  const fade = Math.floor(ctx.sampleRate * 0.4);
  const raw = createNoiseSamples(length + fade, seed);
  const filtered = lowpass(raw, () => cutoff, ctx.sampleRate);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    if (i < fade) {
      const t = i / fade;
      out[i] = filtered[i] * Math.sqrt(t) + filtered[i + length] * Math.sqrt(1 - t);
    } else {
      out[i] = filtered[i];
    }
  }
  return fromSamples(ctx, out, gain);
}

/** A synthetic room response. Length and colour are what make a space sound like itself. */
export function makeImpulse(ctx: BaseAudioContext, seconds: number, brightness: number, seed: number): AudioBuffer {
  const length = Math.floor(seconds * ctx.sampleRate);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const noise = createNoiseSamples(length, seed + channel * 977);
    const filtered = lowpass(noise, (t) => brightness * Math.exp(-t * 1.5) + 180, ctx.sampleRate);
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const t = i / ctx.sampleRate;
      data[i] = filtered[i] * Math.pow(1 - t / seconds, 2) * Math.exp((-3 * t) / seconds);
    }
  }
  return buffer;
}
