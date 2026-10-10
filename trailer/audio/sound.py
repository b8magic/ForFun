"""Corduroy — trailer score & sound design.

Everything is synthesized from scratch with numpy (no samples, no beach
recordings). Cue times come from the film's own timeline (cues.json), so
pressure, accumulation, release and dissipation land on the same frames as
the picture.

    python3 audio/sound.py  ->  out/score.wav (48 kHz, 24-bit stereo)
"""
import json, os, sys, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
C = json.load(open(os.path.join(HERE, 'cues.json')))
T = C['T']
SR = 48000
DUR = C['DURATION'] + 0.0
N = int(DUR * SR)
rng = np.random.default_rng(1010)

L = np.zeros(N)
R = np.zeros(N)
VERB_L = np.zeros(N)
VERB_R = np.zeros(N)

def tt(n):
    return np.arange(n) / SR

def place(sig, at, pan=0.0, gain=1.0, verb=0.0):
    """Add mono or stereo signal at time `at` (s) with constant-power pan."""
    i0 = int(round(at * SR))
    if sig.ndim == 1:
        a = (pan + 1) * np.pi / 4
        sl, sr = sig * np.cos(a), sig * np.sin(a)
    else:
        sl, sr = sig[0], sig[1]
    if i0 < 0:
        sl, sr = sl[-i0:], sr[-i0:]
        i0 = 0
    n = min(len(sl), N - i0)
    if n <= 0:
        return
    L[i0:i0 + n] += sl[:n] * gain
    R[i0:i0 + n] += sr[:n] * gain
    if verb:
        VERB_L[i0:i0 + n] += sl[:n] * gain * verb
        VERB_R[i0:i0 + n] += sr[:n] * gain * verb

def note(name):
    names = {'C': -9, 'C#': -8, 'D': -7, 'D#': -6, 'E': -5, 'F': -4, 'F#': -3, 'G': -2, 'G#': -1, 'A': 0, 'A#': 1, 'B': 2}
    n, o = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((names[n] + (o - 4) * 12) / 12)

def adsr(n, a=0.005, d=0.1, s=0.0, r=0.2, curve=4.0):
    t = tt(n)
    e = np.where(t < a, t / max(a, 1e-6), 1.0)
    dec = np.exp(-curve * np.clip(t - a, 0, None) / max(d, 1e-6))
    e = e * (s + (1 - s) * dec)
    rel_start = n / SR - r
    e *= np.clip(1 - (t - rel_start) / max(r, 1e-6), 0, 1) ** 2
    return e

def fft_filter(x, lo=0.0, hi=SR / 2, slope=1.0):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.ones_like(f)
    if lo > 0:
        m *= 1 / (1 + (lo / np.maximum(f, 1)) ** (2 * slope))
    if hi < SR / 2:
        m *= 1 / (1 + (f / hi) ** (2 * slope))
    return np.fft.irfft(X * m, len(x))

def stft_shape(x, gain_fn, nfft=2048, hop=512):
    """Time-varying spectral shaping: gain_fn(times[:,None], freqs[None,:])."""
    win = np.hanning(nfft)
    pad = np.concatenate([np.zeros(nfft), x, np.zeros(nfft)])
    frames = 1 + (len(pad) - nfft) // hop
    idx = np.arange(nfft)[None, :] + hop * np.arange(frames)[:, None]
    F = np.fft.rfft(pad[idx] * win, axis=1)
    times = (np.arange(frames) * hop + nfft / 2 - nfft) / SR
    freqs = np.fft.rfftfreq(nfft, 1 / SR)
    F *= gain_fn(times[:, None], freqs[None, :])
    y = np.fft.irfft(F, nfft, axis=1) * win
    out = np.zeros(len(pad))
    for k in range(frames):
        out[k * hop:k * hop + nfft] += y[k]
    norm = np.zeros(len(pad))
    for k in range(frames):
        norm[k * hop:k * hop + nfft] += win ** 2
    out /= np.maximum(norm, 1e-3)
    return out[nfft:nfft + len(x)]

def bandbell(f, fc, bw):
    return np.exp(-0.5 * (np.log2(np.maximum(f, 1) / fc) / bw) ** 2)

def smoothstep(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)

def win(t, a, b):
    return np.clip((t - a) / (b - a), 0, 1)

# ── sound atoms ───────────────────────────────────────────────────────────
def tick(freq=3000, dur=0.03, q=40.0):
    n = int(dur * SR)
    t = tt(n)
    return np.sin(2 * np.pi * freq * t) * np.exp(-t * q * 10) * 0.8 + rng.standard_normal(n) * np.exp(-t * 900) * 0.3

def pluck(freq, dur=0.6, bright=1.0):
    n = int(dur * SR)
    t = tt(n)
    s = (np.sin(2 * np.pi * freq * t) + 0.35 * bright * np.sin(2 * np.pi * 2.01 * freq * t) * np.exp(-t * 9)
         + 0.12 * bright * np.sin(2 * np.pi * 3.98 * freq * t) * np.exp(-t * 16))
    return s * np.exp(-t * 6.5) * np.clip(t / 0.002, 0, 1)

def bell(freq, dur=2.5, index=2.2, ratio=3.5):
    n = int(dur * SR)
    t = tt(n)
    ie = index * np.exp(-t * 2.4)
    s = np.sin(2 * np.pi * freq * t + ie * np.sin(2 * np.pi * freq * ratio * t))
    return s * np.exp(-t * 1.6) * np.clip(t / 0.003, 0, 1)

def drop(freq, dur=0.5):
    """A synthetic droplet: fast upward glide into a ringing body."""
    n = int(dur * SR)
    t = tt(n)
    glide = freq * (0.55 + 0.45 * (1 - np.exp(-t * 90)))
    ph = 2 * np.pi * np.cumsum(glide) / SR
    body = np.sin(ph) * np.exp(-t * 9) + 0.25 * np.sin(2 * ph) * np.exp(-t * 18)
    return body * np.clip(t / 0.0015, 0, 1)

def thump(f0=90, f1=40, dur=0.5, k=9):
    n = int(dur * SR)
    t = tt(n)
    f = f1 + (f0 - f1) * np.exp(-t * k)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6) * np.clip(t / 0.003, 0, 1)

def pad(freqs, dur, attack=0.6, release=0.8, cutoff=1800, detune=0.004):
    n = int(dur * SR)
    t = tt(n)
    s = np.zeros(n)
    for f in freqs:
        for d in (-detune, 0, detune):
            ph = rng.random() * 2 * np.pi
            # band-limited-ish saw from a few partials
            for k in range(1, 9):
                if f * k * (1 + d) > cutoff * 2.5:
                    break
                s += np.sin(2 * np.pi * f * k * (1 + d) * t + ph * k) / k * (1 / (1 + (f * k / cutoff) ** 2))
    s /= max(1, len(freqs) * 3)
    env = np.clip(t / attack, 0, 1) ** 2 * np.clip((dur - t) / release, 0, 1) ** 2
    return s * env

def noise(n):
    return rng.standard_normal(n)

def whoosh(dur, f0, f1, bw=0.6, curve=None):
    n = int(dur * SR)
    x = noise(n)
    def g(ti, fr):
        k = np.clip(ti / dur, 0, 1)
        fc = f0 * (f1 / f0) ** (k if curve is None else curve(k))
        amp = np.sin(np.pi * k) ** 1.5
        return bandbell(fr, fc, bw) * amp
    return stft_shape(x, g)

# ── score ─────────────────────────────────────────────────────────────────
D2, A2, D3, Fs3, A3, Cs4, D4, E4, Fs4, A4 = map(note, ['D2', 'A2', 'D3', 'F#3', 'A3', 'C#4', 'D4', 'E4', 'F#4', 'A4'])

# 1) sub drone + ocean-bed texture, breathing with the visual swell
t_all = tt(N)
sub_env = (smoothstep(win(t_all, 0.2, 2.0)) * 0.55 + 0.35 * smoothstep(win(t_all, 4.2, 7.0))) * (1 - smoothstep(win(t_all, 7.1, 7.3)))
sub_env = sub_env + smoothstep(win(t_all, 9.4, 10.6)) * 0.4 * (1 - smoothstep(win(t_all, 12.5, 14.2)))
sub = (np.sin(2 * np.pi * 36.7 * t_all) + 0.4 * np.sin(2 * np.pi * 73.4 * t_all + 0.3)) * sub_env * (0.85 + 0.15 * np.sin(2 * np.pi * 0.25 * t_all))
place(sub, 0, 0, 0.32)

bed = noise(N)
def bed_gain(ti, fr):
    swell = np.exp(-0.5 * ((ti - 2.0) / 0.45) ** 2)
    lvl = smoothstep(np.clip((ti - 0.4) / 1.4, 0, 1)) * (0.25 + 0.75 * swell) * (1 - smoothstep(np.clip((ti - 3.0) / 1.2, 0, 1)) * 0.75)
    lvl = lvl * (1 - smoothstep(np.clip((ti - 7.15) / 0.12, 0, 1)) * 0.9)
    fc = 380 + 900 * swell + 200 * np.sin(ti * 0.9)
    return bandbell(fr, fc, 1.1) * lvl
bedL = stft_shape(bed, bed_gain)
bedR = stft_shape(noise(N), bed_gain)
place(np.vstack([bedL, bedR]), 0, gain=0.10)

# 2) the first line: a thin glass tone drawing outward
n = int(0.9 * SR); t = tt(n)
glass = np.sin(2 * np.pi * (2350 + 180 * t) * t) * np.clip(t / 0.25, 0, 1) * np.exp(-t * 3.5)
place(glass, T['lineDraw'][0], 0, 0.08, verb=0.6)
place(tick(5200, 0.03), T['lineDraw'][0], 0, 0.15, verb=0.4)

# 3) lines dealt from the horizon: granular ticks, accelerating then easing
for i in range(70):
    u = i / 69
    at = T['unfoldField'][0] + (u ** 0.7) * (T['unfoldField'][1] - T['unfoldField'][0])
    place(tick(2400 + 2600 * rng.random(), 0.02, 60), at, pan=rng.uniform(-0.8, 0.8), gain=0.05 * (1 - u * 0.6), verb=0.3)

# 4) the sun: warm Dmaj9 pad blooming
place(pad([D3, A3, Cs4, E4, Fs4], 3.2, attack=1.0, release=1.2, cutoff=1400), T['sunRise'][0], 0, 0.22, verb=0.5)
place(bell(note('A5'), 3.0, 1.2), T['sunRise'][0] + 0.15, 0.2, 0.05, verb=0.8)

# 5) camera cranes up and over
place(whoosh(1.15, 180, 2400, 0.7), T['tilt'][0] - 0.05, 0, 0.18, verb=0.3)

# 6) the identity disc closes: soft thump + glass bell
place(thump(120, 45, 0.6), T['disc'][1] - 0.04, 0, 0.5)
place(bell(note('D5'), 2.4, 1.6, 2.0), T['disc'][1] - 0.04, 0, 0.09, verb=0.7)
place(whoosh(0.6, 3000, 600, 0.8), T['word'][0] - 0.1, 0, 0.07)

# 7) identity flick: five plucks ascending, the last one home
for i, (at, nm) in enumerate(zip(T['flickSteps'], ['D6', 'F#6', 'A6', 'C#7', 'D6'])):
    place(pluck(note(nm), 0.4), at, pan=(-0.3 + i * 0.15), gain=0.13, verb=0.35)
    place(tick(6000, 0.015), at, 0, 0.06)

# 8) dock + calendar unfold
place(whoosh(0.8, 1800, 300, 0.7), T['dock'][0], 0, 0.1)
for r, nm in enumerate(['D3', 'A3', 'D4', 'F#4', 'A4']):
    place(pluck(note(nm), 1.2, 0.6), T['unfold'][0] + 0.07 * r + 0.25, pan=-0.4 + r * 0.2, gain=0.14, verb=0.5)
place(pad([D3, Fs3, A3, E4], 4.2, attack=1.2, release=1.0, cutoff=1100), T['unfold'][0], 0, 0.16, verb=0.4)
for k in range(35):
    r, c = divmod(k, 7)
    place(tick(3500 + 300 * c, 0.012, 80), 4.72 + 0.026 * c + 0.05 * r, pan=-0.7 + c * 0.23, gain=0.025)

# 9) date taps: droplets climbing D5 F#5 A5 D6, each with a crest swell under it
for k, (at, nm) in enumerate(zip(T['taps'], ['D5', 'F#5', 'A5', 'D6'])):
    pan = [0.45, -0.55, -0.3, 0.45][k]
    place(drop(note(nm), 0.6), at - 0.01, pan, 0.2, verb=0.55)
    place(thump(95, 55, 0.35, 12), at, pan * 0.3, 0.32)
    place(whoosh(0.7, 300, 900, 0.9), at - 0.02, pan * 0.5, 0.05)

# energy accumulating: a pulse that quickens and a drone that bends upward
n = int((T['saveTap'] - 5.3) * SR); t = tt(n)
rate = 1.6 + 2.6 * (t / t[-1]) ** 2
pulse = np.sin(2 * np.pi * np.cumsum(rate) / SR) ** 8
riser = np.sin(2 * np.pi * np.cumsum(73.4 * (1 + 0.06 * (t / t[-1]) ** 2)) / SR)
acc = (pulse * np.sin(2 * np.pi * 55 * t) * 0.6 + riser * 0.25) * smoothstep(t / t[-1]) * 0.9
place(acc, 5.3, 0, 0.22)

# 10) SAVE — click, then the water draws back (inhale) and the face rises
place(tick(2600, 0.04, 30), T['saveTap'], 0.3, 0.3)
place(thump(160, 60, 0.3, 14), T['saveTap'], 0, 0.35)
dur = T['impact'] - T['drawback'][0]
n = int(dur * SR); t = tt(n)
def inhale_gain(ti, fr):
    k = np.clip(ti / dur, 0, 1)
    fc = 250 * (40 ** (k ** 1.6))
    lvl = (k ** 1.8) * (1 - smoothstep(np.clip((ti - (dur - 0.12)) / 0.06, 0, 1)))
    return (bandbell(fr, fc, 1.0) + 0.3 * bandbell(fr, fc * 2.7, 0.5)) * lvl
inh = np.vstack([stft_shape(noise(n), inhale_gain), stft_shape(noise(n), inhale_gain)])
place(inh, T['drawback'][0], gain=0.5)
# Shepard-ish riser through the rise, curl and tube
f = 110 * 2 ** (3.2 * (t / dur) ** 1.4)
ris = (np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.5 * np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR)) * (t / dur) ** 2
ris *= 1 - smoothstep((t - (dur - 0.11)) / 0.05)
place(ris, T['drawback'][0], 0, 0.1)

# the lip throws: spray crackle
n = int(0.9 * SR)
cr = np.zeros(n)
for _ in range(500):
    i = int(rng.random() ** 0.7 * (n - 300))
    cr[i:i + 200] += rng.standard_normal(200) * np.exp(-np.arange(200) / 25) * rng.random()
place(fft_filter(cr, 2500), T['curl'][0] + 0.15, 0.5, 0.05, verb=0.3)

# inside the barrel: comb-filtered roar sweeping, dates flashing past
dur_t = T['impact'] - T['tube'][0] - 0.08
n = int(dur_t * SR); t = tt(n)
def tube_gain(ti, fr):
    k = np.clip(ti / dur_t, 0, 1)
    comb = 0.5 + 0.5 * np.cos(2 * np.pi * fr / (90 + 500 * k))
    return (0.3 + 0.7 * comb) * bandbell(fr, 400 + 3000 * k ** 1.5, 1.4) * (0.2 + 0.8 * k)
place(np.vstack([stft_shape(noise(n), tube_gain), stft_shape(noise(n), tube_gain)]), T['tube'][0], gain=0.32)
for i in range(4):
    at = T['tube'][0] + 0.3 + i * 0.09 + 0.17
    place(whoosh(0.22, 4000, 400, 0.5), at - 0.11, pan=[-0.7, 0.7, -0.5, 0.6][i], gain=0.25)

# 11) IMPACT — sub drop, white-noise burst, long white-water crash, bells
n = int(2.6 * SR); t = tt(n)
f = 28 + 52 * np.exp(-t * 2.2)
drop_sub = np.tanh(2.2 * np.sin(2 * np.pi * np.cumsum(f) / SR)) * np.exp(-t * 1.25)
place(drop_sub, T['impact'], 0, 0.75)
burst = noise(n) * np.exp(-t * 3.0)
place(np.vstack([fft_filter(burst, 40, 9000), fft_filter(noise(n) * np.exp(-t * 3.0), 40, 9000)]), T['impact'], gain=0.42, verb=0.6)
n2 = int(3.4 * SR); t2 = tt(n2)
crash = fft_filter(noise(n2), 1800) * (np.exp(-t2 * 1.9) * 0.8 + 0.07 * np.exp(-t2 * 1.1))
place(np.vstack([crash, fft_filter(noise(n2), 1800) * (np.exp(-t2 * 1.9) * 0.8 + 0.07 * np.exp(-t2 * 1.1))]), T['impact'] + 0.005, gain=0.16, verb=0.5)
for nm, pan in [('D5', -0.4), ('A5', 0.4), ('F#6', -0.2), ('C#6', 0.25), ('E6', 0)]:
    place(bell(note(nm), 3.6, 2.6, 3.01), T['impact'] + 0.02, pan, 0.06, verb=0.9)

# 12) white water settling: fizz thinning out, then the dots land
n = int(1.4 * SR)
fz = np.zeros(n)
for _ in range(900):
    i = int((rng.random() ** 2.2) * (n - 120))
    fz[i:i + 100] += rng.standard_normal(100) * np.exp(-np.arange(100) / 12) * (0.4 + rng.random())
place(fft_filter(fz, 3000), T['impact'] + 0.05, 0.0, 0.05, verb=0.3)
for k, nm in enumerate(['D6', 'A5', 'F#5', 'D5']):
    at = T['land'][0] + 0.12 + k * 0.09
    place(drop(note(nm), 0.5), at, pan=-0.6 + k * 0.35, gain=0.16, verb=0.6)
    place(tick(4200, 0.02), at, -0.6 + k * 0.35, 0.05)

# 13) history expands: wide pad, counter ticks decelerating, swell through time
place(pad([D2, A2, D3, E4, Fs4, A4], 5.2, attack=1.4, release=1.8, cutoff=1600), T['settle'][0] + 0.6, 0, 0.2, verb=0.6)
place(whoosh(1.2, 150, 1200, 0.9), T['zoomOut'][0], 0, 0.12, verb=0.3)
cnt0, cnt1 = T['counter']
for i in range(46):
    u = i / 45
    at = cnt0 + (1 - (1 - u) ** (1 / 5)) * (cnt1 - cnt0)
    place(tick(3000 + 900 * rng.random(), 0.012, 90), at, rng.uniform(-0.3, 0.3), 0.035)
n = int((T['pulse'][1] - T['pulse'][0]) * SR); t = tt(n)
def pulse_gain(ti, fr):
    k = np.clip(ti / (n / SR), 0, 1)
    return bandbell(fr, 120 + 900 * (1 - k), 1.0) * np.sin(np.pi * k) ** 2
place(stft_shape(noise(n), pulse_gain), T['pulse'][0], 0, 0.22)
place(thump(70, 38, 1.0, 4), T['pulse'][0] + 0.35, 0, 0.3)

# 14) calm: stripes form (rising arpeggio), the period lands, the line types
arp = ['D5', 'F#5', 'A5', 'C#6', 'D6', 'E6', 'F#6', 'A6']
for i, nm in enumerate(arp):
    place(pluck(note(nm), 0.5, 0.5), T['logo'][0] + 0.35 + i * 0.07, pan=-0.5 + i * 0.14, gain=0.06, verb=0.6)
place(bell(note('D6'), 3.2, 1.4, 2.0), T['period'], 0.25, 0.14, verb=0.9)
place(thump(110, 50, 0.6, 10), T['period'], 0.2, 0.45)
place(pad([D3, A3, Fs4, E4], 2.4, attack=0.4, release=1.4, cutoff=1300), T['period'] - 0.05, 0, 0.14, verb=0.6)
txt = 'LOG THE SESSION. KEEP THE SWELL.'
for i in range(len(txt)):
    if txt[i] == ' ':
        continue
    at = T['tagline'][0] + (1 - (1 - (i + 1) / len(txt)) ** 1.0) ** (1 / 3) * (T['tagline'][1] - T['tagline'][0]) * 0.98
    place(tick(4500 + 400 * rng.random(), 0.01, 120), at, 0, 0.02)

# ── reverb (FFT convolution with a decaying stereo noise tail) ───────────
ir_n = int(2.8 * SR)
ti = tt(ir_n)
irL = rng.standard_normal(ir_n) * np.exp(-ti * 2.3)
irR = rng.standard_normal(ir_n) * np.exp(-ti * 2.3)
irL = fft_filter(irL, 200, 7000); irR = fft_filter(irR, 200, 7000)
irL /= np.sqrt(np.sum(irL ** 2)); irR /= np.sqrt(np.sum(irR ** 2))
def conv(x, h):
    m = len(x) + len(h)
    nf = 1 << (m - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, nf) * np.fft.rfft(h, nf), nf)[:len(x)]
L += conv(VERB_L, irL) * 0.55
R += conv(VERB_R, irR) * 0.55

# ── master: gentle glue, soft clip, fade, normalise ──────────────────────
mix = np.vstack([L, R])
mix = np.tanh(mix * 1.15) / np.tanh(1.15)
fade = np.clip((DUR - t_all) / 0.5, 0, 1) ** 2
mix *= fade
mix *= 10 ** (-1.0 / 20) / np.max(np.abs(mix))
out = os.path.join(HERE, '..', 'out', 'score.wav')
os.makedirs(os.path.dirname(out), exist_ok=True)
pcm = (np.clip(mix.T, -1, 1) * (2 ** 23 - 1)).astype(np.int32)
b = np.zeros((pcm.shape[0], 2, 3), dtype=np.uint8)
for ch in range(2):
    v = pcm[:, ch].astype(np.int64) & 0xFFFFFF
    b[:, ch, 0] = v & 0xFF; b[:, ch, 1] = (v >> 8) & 0xFF; b[:, ch, 2] = (v >> 16) & 0xFF
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(3); w.setframerate(SR)
    w.writeframes(b.tobytes())
print('wrote', os.path.normpath(out), f'{DUR:.2f}s')
