// The sound effect catalogue. Each entry builds its sound once, on first use, and caches it.

import type { SurfaceId } from '../world/LevelDefinition';
import { bandpass, createNoiseSamples, decay, fromSamples, lowpass, render } from './Synth';

type Builder = (ctx: BaseAudioContext) => AudioBuffer;

const TWO_PI = Math.PI * 2;

/** A short percussive noise burst, the raw material for clicks and thumps. */
function burst(seconds: number, cutoff: number, decayTime: number, seed: number, gain = 1): Builder {
  return (ctx) => {
    const noise = createNoiseSamples(Math.ceil(seconds * ctx.sampleRate), seed);
    const filtered = lowpass(noise, () => cutoff, ctx.sampleRate);
    for (let i = 0; i < filtered.length; i++) filtered[i] *= decay(i / ctx.sampleRate, 0.002, decayTime);
    return fromSamples(ctx, filtered, gain);
  };
}

/** A pitched, resonant metal or glass ping: a few sine partials dying away. */
function ping(seconds: number, partials: [number, number, number][]): Builder {
  return (ctx) =>
    render(ctx, seconds, (t) => {
      let sum = 0;
      for (const [frequency, amplitude, decayTime] of partials) {
        sum += Math.sin(TWO_PI * frequency * t) * amplitude * Math.exp(-t / decayTime);
      }
      return sum;
    });
}

function footstep(surface: SurfaceId, seed: number): Builder {
  // Each surface gets its own weight (thud) and texture (scuff).
  const profile: Record<SurfaceId, { thud: number; thudGain: number; cutoff: number; time: number; noiseGain: number; ring?: number }> = {
    concrete: { thud: 88, thudGain: 0.5, cutoff: 1700, time: 0.03, noiseGain: 0.5 },
    tile: { thud: 120, thudGain: 0.34, cutoff: 3600, time: 0.024, noiseGain: 0.55, ring: 1700 },
    metal: { thud: 110, thudGain: 0.34, cutoff: 3000, time: 0.05, noiseGain: 0.34, ring: 820 },
    carpet: { thud: 72, thudGain: 0.45, cutoff: 560, time: 0.05, noiseGain: 0.24 },
    snow: { thud: 62, thudGain: 0.3, cutoff: 2700, time: 0.12, noiseGain: 0.5 },
    foam: { thud: 60, thudGain: 0.16, cutoff: 500, time: 0.02, noiseGain: 0.04 },
    grate: { thud: 96, thudGain: 0.3, cutoff: 2600, time: 0.05, noiseGain: 0.3, ring: 1200 },
  };
  const p = profile[surface];
  return (ctx) => {
    const seconds = Math.max(0.2, p.time * 6);
    const length = Math.ceil(seconds * ctx.sampleRate);
    const noise = lowpass(createNoiseSamples(length, seed), () => p.cutoff, ctx.sampleRate);
    const out = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      const t = i / ctx.sampleRate;
      const thud = Math.sin(TWO_PI * p.thud * t * (1 - t * 2)) * Math.exp(-t / 0.035) * p.thudGain;
      const scuff = noise[i] * decay(t, 0.003, p.time) * p.noiseGain;
      const ring = p.ring ? Math.sin(TWO_PI * p.ring * t) * Math.exp(-t / 0.018) * 0.1 : 0;
      out[i] = thud + scuff + ring;
    }
    return fromSamples(ctx, out);
  };
}

const CATALOGUE: Record<string, Builder> = {
  // Interface
  'ui:hover': ping(0.06, [[1400, 0.05, 0.012]]),
  'ui:select': ping(0.14, [
    [720, 0.14, 0.03],
    [1080, 0.06, 0.04],
  ]),
  'ui:back': ping(0.14, [[420, 0.14, 0.04]]),
  'ui:open': burst(0.14, 2600, 0.03, 91, 0.4),
  'ui:error': (ctx) => render(ctx, 0.26, (t) => Math.sign(Math.sin(TWO_PI * 96 * t)) * 0.11 * decay(t, 0.005, 0.1)),
  'ui:save': ping(0.8, [
    [523, 0.09, 0.25],
    [392, 0.07, 0.34],
  ]),
  note: ping(0.7, [
    [262, 0.09, 0.22],
    [524, 0.05, 0.12],
  ]),

  // Doors
  'door:open': (ctx) => {
    const seconds = 1;
    const noise = lowpass(createNoiseSamples(Math.ceil(seconds * ctx.sampleRate), 11), () => 1400, ctx.sampleRate);
    return render(ctx, seconds, (t, i) => {
      const latch = t < 0.05 ? noise[i] * decay(t, 0.001, 0.012) * 1.1 : 0;
      const creak = Math.sin(TWO_PI * (300 + Math.sin(t * 28) * 60) * t) * 0.04 * Math.exp(-((t - 0.45) ** 2) / 0.05);
      const movement = noise[i] * 0.08 * Math.exp(-((t - 0.4) ** 2) / 0.08);
      return latch + creak + movement;
    });
  },
  'door:heavy': (ctx) => {
    const seconds = 1.6;
    const noise = lowpass(createNoiseSamples(Math.ceil(seconds * ctx.sampleRate), 12), () => 620, ctx.sampleRate);
    return render(ctx, seconds, (t, i) => {
      const clunk = Math.sin(TWO_PI * 62 * t) * Math.exp(-t / 0.08) * 0.8;
      const slide = noise[i] * 0.34 * Math.sin(Math.min(1, t / 1.5) * Math.PI);
      return clunk + slide;
    });
  },
  'door:locked': (ctx) => {
    const seconds = 0.34;
    const noise = lowpass(createNoiseSamples(Math.ceil(seconds * ctx.sampleRate), 13), () => 2800, ctx.sampleRate);
    return render(ctx, seconds, (t, i) => noise[i] * (decay(t, 0.001, 0.016) + decay(Math.max(0, t - 0.13), 0.001, 0.02) * (t > 0.13 ? 0.9 : 0)) * 0.8);
  },
  'door:slam': (ctx) => {
    const seconds = 1.4;
    const noise = lowpass(createNoiseSamples(Math.ceil(seconds * ctx.sampleRate), 14), (t) => 1800 * Math.exp(-t * 7) + 90, ctx.sampleRate);
    return render(ctx, seconds, (t, i) => (noise[i] * 1 + Math.sin(TWO_PI * 48 * t) * 0.5) * Math.exp(-t / 0.2));
  },
  'door:blast': (ctx) => {
    const seconds = 6;
    const noise = lowpass(createNoiseSamples(Math.ceil(seconds * ctx.sampleRate), 15), () => 380, ctx.sampleRate);
    return render(ctx, seconds, (t, i) => {
      const bolts = [0.05, 0.28, 0.46, 0.7, 0.86].reduce((sum, at) => sum + (t > at ? Math.sin(TWO_PI * 78 * (t - at)) * Math.exp(-(t - at) / 0.05) : 0), 0);
      const grind = noise[i] * 0.55 * Math.min(1, t / 0.9) * Math.min(1, (seconds - t) / 0.6);
      const motor = Math.sin(TWO_PI * 54 * t) * 0.1 * Math.min(1, t) * Math.min(1, (seconds - t) / 0.6);
      return bolts * 0.7 + grind + motor;
    });
  },

  // Machinery
  'relay:clunk': (ctx) => {
    const seconds = 0.5;
    const noise = lowpass(createNoiseSamples(Math.ceil(seconds * ctx.sampleRate), 21), () => 2200, ctx.sampleRate);
    return render(ctx, seconds, (t, i) => noise[i] * decay(t, 0.001, 0.016) + Math.sin(TWO_PI * 96 * t) * Math.exp(-t / 0.06) * 0.6);
  },
  'switch:toggle': burst(0.09, 5200, 0.009, 22, 0.8),
  'lever:pull': (ctx) => {
    const seconds = 0.8;
    const noise = lowpass(createNoiseSamples(Math.ceil(seconds * ctx.sampleRate), 23), () => 1600, ctx.sampleRate);
    return render(ctx, seconds, (t, i) => noise[i] * 0.2 * Math.exp(-((t - 0.2) ** 2) / 0.02) + (t > 0.32 ? Math.sin(TWO_PI * 88 * (t - 0.32)) * Math.exp(-(t - 0.32) / 0.07) : 0));
  },
  'lever:ok': (ctx) => {
    const seconds = 2.2;
    const noise = lowpass(createNoiseSamples(Math.ceil(seconds * ctx.sampleRate), 24), () => 420, ctx.sampleRate);
    return render(ctx, seconds, (t, i) => noise[i] * 0.5 * Math.sin((Math.min(t, 2) / 2) * Math.PI) + Math.sin(TWO_PI * 68 * t) * Math.exp(-t / 0.3) * 0.6);
  },
  'keypad:beep': ping(0.09, [[1240, 0.13, 0.03]]),
  'keypad:ok': ping(0.5, [
    [988, 0.11, 0.09],
    [1319, 0.1, 0.16],
  ]),
  'keypad:bad': (ctx) => render(ctx, 0.36, (t) => Math.sign(Math.sin(TWO_PI * 180 * t)) * 0.08 * (t < 0.14 || t > 0.2 ? 1 : 0) * Math.min(1, (0.36 - t) * 20)),
  'safe:open': (ctx) => {
    const seconds = 1.5;
    const noise = lowpass(createNoiseSamples(Math.ceil(seconds * ctx.sampleRate), 25), () => 1100, ctx.sampleRate);
    return render(ctx, seconds, (t, i) => {
      const tumblers = [0, 0.14, 0.3].reduce((sum, at) => sum + (t >= at ? noise[i] * Math.exp(-(t - at) / 0.015) : 0), 0);
      const swing = Math.sin(TWO_PI * (180 + t * 40) * t) * 0.06 * Math.exp(-((t - 0.9) ** 2) / 0.1);
      return tumblers * 0.9 + swing;
    });
  },
  spark: (ctx) => {
    const seconds = 0.7;
    const noise = createNoiseSamples(Math.ceil(seconds * ctx.sampleRate), 26);
    return render(ctx, seconds, (t, i) => {
      const gate = Math.sin(t * 310) * Math.sin(t * 97) > 0.1 ? 1 : 0;
      const buzz = Math.sign(Math.sin(TWO_PI * 100 * t)) * 0.25;
      return (noise[i] * 0.55 + buzz) * gate * Math.exp(-t / 0.2);
    });
  },
  'power:restore': (ctx) => {
    const seconds = 3.6;
    return render(ctx, seconds, (t) => {
      const rising = Math.min(1, t / 1.6);
      const hum = Math.sin(TWO_PI * (30 + rising * 20) * t) * 0.32 + Math.sin(TWO_PI * (60 + rising * 40) * t) * 0.16;
      const clunk = Math.sin(TWO_PI * 70 * t) * Math.exp(-t / 0.08) * 0.8;
      return hum * Math.min(1, t * 2) * Math.min(1, (seconds - t) / 0.9) + clunk;
    });
  },
  'annex:release': (ctx) => {
    const seconds = 3.2;
    const noise = lowpass(createNoiseSamples(Math.ceil(seconds * ctx.sampleRate), 27), () => 260, ctx.sampleRate);
    return render(ctx, seconds, (t, i) => {
      const bolts = [0.1, 0.2, 0.32, 0.46, 0.54, 0.66, 0.8].reduce((sum, at) => sum + (t > at ? Math.exp(-(t - at) / 0.03) * Math.sin(TWO_PI * 70 * (t - at)) : 0), 0);
      return bolts * 0.75 + noise[i] * 0.9 * Math.exp(-t / 1.3);
    });
  },
  'signal:cut': (ctx) => {
    const seconds = 2.2;
    return render(ctx, seconds, (t) => {
      const hum = Math.sin(TWO_PI * Math.max(8, 60 - t * 40) * t) * 0.36 * Math.exp(-t / 0.7);
      return hum + (t < 0.03 ? Math.sin(TWO_PI * 160 * t) * 0.6 : 0);
    });
  },
  valve: (ctx) => {
    const seconds = 2.3;
    const noise = bandpass(createNoiseSamples(Math.ceil(seconds * ctx.sampleRate), 28), 700, 2, ctx.sampleRate);
    return render(ctx, seconds, (t, i) => {
      const squeal = Math.sin(TWO_PI * (340 + t * 90) * t) * 0.04 * Math.exp(-((t - 0.6) ** 2) / 0.3);
      const water = noise[i] * 0.5 * Math.min(1, Math.max(0, t - 0.7) * 1.4) * Math.min(1, (seconds - t) * 2);
      return squeal + water;
    });
  },
  bolt: burst(0.26, 1800, 0.05, 29, 1),
  paper: (ctx) => {
    const seconds = 0.3;
    const noise = bandpass(createNoiseSamples(Math.ceil(seconds * ctx.sampleRate), 30), 3600, 0.8, ctx.sampleRate);
    return render(ctx, seconds, (t, i) => noise[i] * Math.sin(Math.min(1, t / seconds) * Math.PI) * (0.65 + Math.sin(t * 70) * 0.35));
  },
  pickup: (ctx) => {
    const seconds = 0.26;
    const noise = lowpass(createNoiseSamples(Math.ceil(seconds * ctx.sampleRate), 31), () => 3000, ctx.sampleRate);
    return render(ctx, seconds, (t, i) => noise[i] * decay(t, 0.002, 0.03) * 0.6 + Math.sin(TWO_PI * 1400 * t) * Math.exp(-t / 0.03) * 0.05);
  },
  flashlight: burst(0.05, 4800, 0.006, 32, 0.8),
  battery: (ctx) => {
    const seconds = 0.4;
    const noise = lowpass(createNoiseSamples(Math.ceil(seconds * ctx.sampleRate), 33), () => 2600, ctx.sampleRate);
    return render(ctx, seconds, (t, i) => noise[i] * (decay(t, 0.001, 0.016) + (t > 0.2 ? Math.exp(-(t - 0.2) / 0.016) : 0)) * 0.8);
  },
  'post:thunk': (ctx) => {
    const seconds = 1.1;
    const noise = lowpass(createNoiseSamples(Math.ceil(seconds * ctx.sampleRate), 34), (t) => 2000 * Math.exp(-t * 3) + 100, ctx.sampleRate);
    return render(ctx, seconds, (t, i) => noise[i] * 0.6 * Math.exp(-t / 0.45) + Math.sin(TWO_PI * 90 * t) * Math.exp(-t / 0.08) * 0.8);
  },
  'phone:ring': (ctx) => {
    const seconds = 2.2;
    return render(ctx, seconds, (t) => {
      const gate = t < 1.6 && Math.sin(t * TWO_PI * 22) > 0 ? 1 : 0;
      return (Math.sin(TWO_PI * 1040 * t) + Math.sin(TWO_PI * 1280 * t)) * 0.08 * gate;
    });
  },
  'phone:lift': burst(0.2, 1900, 0.03, 35, 0.7),

  // Distant sounds of the building
  'distant:pipe': ping(1.8, [
    [190, 0.34, 0.5],
    [410, 0.14, 0.26],
    [764, 0.05, 0.13],
  ]),
  'distant:door': burst(0.9, 500, 0.22, 41, 1.2),
  'distant:settle': (ctx) => {
    const seconds = 2.6;
    const noise = lowpass(createNoiseSamples(Math.ceil(seconds * ctx.sampleRate), 42), () => 300, ctx.sampleRate);
    return render(ctx, seconds, (t, i) => noise[i] * 1.4 * Math.exp(-((t - 1) ** 2) / 0.32) + Math.sin(TWO_PI * 42 * t) * 0.32 * Math.exp(-((t - 0.9) ** 2) / 0.18));
  },
  'distant:drip': ping(0.6, [
    [1450, 0.2, 0.05],
    [2200, 0.08, 0.03],
  ]),
  'distant:wind': (ctx) => {
    const seconds = 4.5;
    const noise = bandpass(createNoiseSamples(Math.ceil(seconds * ctx.sampleRate), 43), 640, 1.4, ctx.sampleRate);
    return render(ctx, seconds, (t, i) => noise[i] * 1.2 * Math.sin((t / seconds) * Math.PI) ** 2);
  },
  'distant:steps': (ctx) => {
    const seconds = 3.6;
    const noise = lowpass(createNoiseSamples(Math.ceil(seconds * ctx.sampleRate), 44), () => 650, ctx.sampleRate);
    return render(ctx, seconds, (t, i) => [0.2, 1, 1.82, 2.6].reduce((sum, at) => sum + (t > at ? Math.exp(-(t - at) / 0.04) * (noise[i] + Math.sin(TWO_PI * 72 * (t - at))) : 0), 0) * 0.65);
  },
  'radio:burst': (ctx) => {
    const seconds = 1.5;
    const noise = bandpass(createNoiseSamples(Math.ceil(seconds * ctx.sampleRate), 45), 1700, 0.7, ctx.sampleRate);
    return render(ctx, seconds, (t, i) => {
      const tone = Math.sin(TWO_PI * 720 * t) * 0.08;
      const gate = 0.5 + 0.5 * Math.sin(t * 32) * Math.sin(t * 9);
      return (noise[i] * 0.46 * gate + tone) * Math.min(1, t * 10) * Math.min(1, (seconds - t) * 6);
    });
  },
  'radio:whisper': (ctx) => {
    // Syllables of filtered noise with no words in them, at the very edge of being speech.
    const seconds = 2.8;
    const noise = createNoiseSamples(Math.ceil(seconds * ctx.sampleRate), 46);
    const formantA = bandpass(noise, 650, 4, ctx.sampleRate);
    const formantB = bandpass(noise, 1500, 5, ctx.sampleRate);
    return render(ctx, seconds, (t, i) => {
      const syllable = Math.max(0, Math.sin(t * 15 + Math.sin(t * 3.1) * 2.2));
      return (formantA[i] * 1.4 + formantB[i] * 0.8) * syllable * Math.sin((t / seconds) * Math.PI);
    });
  },

  // Fear
  'stinger:low': (ctx) => {
    const seconds = 3.4;
    return render(ctx, seconds, (t) => {
      const cluster = [55, 58.3, 82.4, 87.3, 116.5].reduce((sum, f) => sum + Math.sin(TWO_PI * f * t + Math.sin(t * f * 0.02)), 0);
      return (cluster / 5) * 0.8 * decay(t, 0.03, 1.1);
    });
  },
  heartbeat: (ctx) => {
    const seconds = 0.8;
    const beat = (t: number) => (t > 0 ? Math.sin(TWO_PI * 52 * t) * Math.exp(-t / 0.05) : 0);
    return render(ctx, seconds, (t) => beat(t) + beat(t - 0.22) * 0.65);
  },
  tinnitus: (ctx) => render(ctx, 3, (t) => Math.sin(TWO_PI * 6800 * t) * 0.022 * Math.min(1, t) * Math.min(1, 3 - t) + Math.sin(TWO_PI * 6807 * t) * 0.012),
  'caught:static': (ctx) => {
    const seconds = 2.4;
    const noise = createNoiseSamples(Math.ceil(seconds * ctx.sampleRate), 51);
    return render(ctx, seconds, (t, i) => noise[i] * 0.7 * Math.min(1, t * 6) * Math.min(1, (seconds - t) * 1.2));
  },
  'lift:move': (ctx) => {
    const seconds = 4.4;
    const noise = lowpass(createNoiseSamples(Math.ceil(seconds * ctx.sampleRate), 52), () => 240, ctx.sampleRate);
    return render(ctx, seconds, (t, i) => {
      const envelope = Math.min(1, t / 0.7) * Math.min(1, (seconds - t) / 0.7);
      const clank = Math.sin(TWO_PI * 120 * t) * Math.exp(-((t % 1.15) / 0.05)) * 0.1;
      return (noise[i] * 0.9 + Math.sin(TWO_PI * 46 * t) * 0.2 + clank) * envelope;
    });
  },
  'stairs:climb': (ctx) => {
    const seconds = 3;
    const noise = lowpass(createNoiseSamples(Math.ceil(seconds * ctx.sampleRate), 53), () => 1500, ctx.sampleRate);
    return render(ctx, seconds, (t, i) => {
      const step = t % 0.42;
      const footfall = Math.exp(-step / 0.05);
      return (noise[i] * 0.34 + Math.sin(TWO_PI * 90 * step) * 0.34) * footfall * Math.min(1, (seconds - t) / 0.5);
    });
  },
};

for (const surface of ['concrete', 'tile', 'metal', 'carpet', 'snow', 'foam', 'grate'] as SurfaceId[]) {
  for (let variation = 0; variation < 4; variation++) {
    CATALOGUE[`step:${surface}:${variation}`] = footstep(surface, 100 + variation * 19 + surface.length * 3);
  }
}

export class SoundBank {
  /** Every sound the game can play, so that they can all be checked automatically. */
  static readonly names = Object.keys(CATALOGUE);

  private cache = new Map<string, AudioBuffer>();

  constructor(private ctx: BaseAudioContext) {}

  get(name: string): AudioBuffer | null {
    const cached = this.cache.get(name);
    if (cached) return cached;
    const builder = CATALOGUE[name];
    if (!builder) return null;
    const buffer = builder(this.ctx);
    this.cache.set(name, buffer);
    return buffer;
  }

  has(name: string): boolean {
    return name in CATALOGUE;
  }

  clear(): void {
    this.cache.clear();
  }
}
