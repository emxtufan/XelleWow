"""Xellé sound: original music and interface sounds, synthesised here.

Replaces the inherited audio with new material in the same role and mood
(measured on the originals): a quiet, seamless E-flat major loop of soft pads
and a felt-piano arpeggio for the experience, a darker and lower variant for
the audio gallery, and three soft bell tones for the interface sprite (same
offsets as the sprite map in the bundle: 0, 5.1 and 10.2 s, under 4.85 s each).

  python scripts/build_xelle_audio.py

Writes public/audio/global/mainTheme.mp3, podcastTheme.mp3 and sprites.mp3,
and one instrumental per product of public/xelle/galerie/galerie.json (needs
ffmpeg with libmp3lame). Deterministic: the same files every run. Once the
real spoken presentations exist, put them in public/xelle/galerie/ and stop
generating the gallery pieces here.
"""
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import soundfile
from scipy.signal import fftconvolve

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "audio" / "global"
RATE = 48000
BAR = 60 / 90 * 4                  # 90 bpm, four beats
CHORD_BARS = 3
# E-flat major: I(add9) - vi7 - IVmaj7 - Vsus, twice, the second time resolving through ii.
PROGRESSION = [
    ("Eb2", ["Bb2", "Eb3", "G3", "F4"]),
    ("C2", ["G2", "Eb3", "Bb3", "D4"]),
    ("Ab1", ["Ab2", "Eb3", "G3", "C4"]),
    ("Bb1", ["F2", "Bb2", "Eb3", "F3"]),
    ("Eb2", ["Bb2", "Eb3", "G3", "Bb3"]),
    ("G1", ["G2", "D3", "Bb3", "D4"]),
    ("Ab1", ["Ab2", "C3", "Eb3", "G3"]),
    ("F1", ["F2", "C3", "Eb3", "Ab3"]),
]
NAMES = {"C": 0, "Db": 1, "D": 2, "Eb": 3, "E": 4, "F": 5, "Gb": 6, "G": 7, "Ab": 8, "A": 9, "Bb": 10, "B": 11}


def hz(note):
    name, octave = note[:-1], int(note[-1])
    return 440.0 * 2 ** ((NAMES[name] + 12 * (octave + 1) - 69) / 12)


def pad_voice(freq, length, rng, brightness):
    """Soft, slowly moving pad: three detuned voices of a rolled-off harmonic tone."""
    t = np.arange(length) / RATE
    out = np.zeros(length)
    for cents in (-7, 0, 6):
        f = freq * 2 ** (cents / 1200)
        phase = rng.uniform(0, 2 * np.pi)
        vibrato = 0.0015 * np.sin(2 * np.pi * rng.uniform(0.08, 0.15) * t + phase)
        for k in range(1, 9):
            amp = (1 / k ** 1.8) * brightness ** (k - 1)
            out += amp * np.sin(2 * np.pi * f * k * t * (1 + vibrato) + phase * k)
    return out / 3


def piano(freq, velocity, seconds=3.2):
    """Felt piano: slightly stretched partials, the higher ones dying sooner."""
    t = np.arange(int(seconds * RATE)) / RATE
    out = np.zeros_like(t)
    for n in range(1, 8):
        f = freq * n * np.sqrt(1 + 0.0004 * n * n)
        if f > 9000:
            break
        out += (1 / n ** 1.4) * np.exp(-t * (1.1 + 0.9 * n)) * np.sin(2 * np.pi * f * t)
    attack = np.minimum(1, t / 0.006)
    return out * attack * velocity


def bell(notes, seconds=4.6, rate=44100):
    """Soft glass bell: inharmonic partials, a breath of air at the strike."""
    t = np.arange(int(seconds * rate)) / rate
    out = np.zeros_like(t)
    for i, note in enumerate(notes):
        f = hz(note)
        for ratio, amp, decay in ((1, 1, 1.4), (2.76, 0.35, 2.6), (5.4, 0.12, 4.5), (8.93, 0.04, 7)):
            out += (0.8 if i else 1) * amp * np.exp(-t * decay) * np.sin(2 * np.pi * f * ratio * t + i)
    noise = np.random.default_rng(len(notes)).standard_normal(t.size)
    air = np.convolve(noise, np.ones(8) / 8, mode="same") * np.exp(-t * 60) * 0.05
    out = (out + air) * np.minimum(1, t / 0.004)
    fade = np.ones_like(t)
    fade[-int(0.3 * rate):] = np.linspace(1, 0, int(0.3 * rate))
    return out * fade


def reverb(signal, seconds, decay, seed):
    """Stereo hall: exponentially decaying, softened noise per channel."""
    rng = np.random.default_rng(seed)
    t = np.arange(int(seconds * RATE)) / RATE
    channels = []
    for _ in range(2):
        ir = rng.standard_normal(t.size) * np.exp(-t / decay)
        ir = np.convolve(ir, np.ones(24) / 24, mode="same")
        ir[0] += 2.0
        channels.append(ir / np.sqrt(np.sum(ir ** 2)))
    return np.stack([fftconvolve(signal[:, c], channels[c])[: signal.shape[0] + t.size] for c in range(2)], axis=1)


def loop(signal, length):
    """Fold everything past the loop end back onto its start: a seamless loop."""
    out = signal[:length].copy()
    tail = signal[length:]
    while tail.shape[0]:
        n = min(length, tail.shape[0])
        out[:n] += tail[:n]
        tail = tail[n:]
    return out


def theme(dark, progression=PROGRESSION, bar=BAR, chord_bars=CHORD_BARS, seed=None, rest=0.28, touch=1.0, looped=True):
    """Pads, bass, an airy octave and a felt piano over a chord progression.
    dark: the gallery's lower variant (slow piano pulses instead of eighths).
    looped: fold the reverb tail onto the start; otherwise let it ring out."""
    rng = np.random.default_rng(seed if seed is not None else (7 if dark else 3))
    chord_len = int(bar * chord_bars * RATE)
    length = chord_len * len(progression)
    tail = int(6 * RATE)
    mix = np.zeros((length + tail, 2))
    fade = int(2.2 * RATE)
    for index, (root, voicing) in enumerate(progression):
        start = index * chord_len
        span = chord_len + fade
        env = np.ones(span)
        env[:fade] = np.sin(np.linspace(0, np.pi / 2, fade)) ** 2
        env[-fade:] = np.cos(np.linspace(0, np.pi / 2, fade)) ** 2
        for i, note in enumerate(voicing):
            voice = pad_voice(hz(note), span, rng, 0.55 if dark else 0.72) * env * (0.16 if dark else 0.13)
            pan = (i / max(1, len(voicing) - 1) - 0.5) * 0.6
            mix[start:start + span, 0] += voice * (1 - pan)
            mix[start:start + span, 1] += voice * (1 + pan)
        # An airy octave above the pad, as the strings' shimmer in the original.
        for i, note in enumerate(voicing[1:]):
            air = pad_voice(hz(note) * 2, span, rng, 0.35) * env * (0.025 if dark else 0.045)
            mix[start:start + span, i % 2] += air
        bass = np.sin(2 * np.pi * hz(root) * np.arange(span) / RATE) * env * (0.15 if dark else 0.09)
        mix[start:start + span] += bass[:, None]
        # The piano: eighth notes walking the chord (gallery: slow low pulses).
        tones = sorted({hz(n) * (1 if dark else 2) for n in voicing})
        steps = chord_bars * (4 if dark else 8)
        for step in range(steps):
            if dark and step % 2:
                continue
            if not dark and rng.random() < rest:
                continue
            note = tones[[0, 1, 2, 3, 2, 1][step % 6] % len(tones)]
            velocity = touch * (0.12 if dark else 0.16) * rng.uniform(0.7, 1.0) * (1.25 if step % 8 == 0 else 1)
            tone = piano(note, velocity)
            at = start + int(step * bar / (4 if dark else 8) * RATE)
            pan = rng.uniform(-0.35, 0.35)
            end = min(at + tone.size, mix.shape[0])
            mix[at:end, 0] += tone[: end - at] * (1 - pan)
            mix[at:end, 1] += tone[: end - at] * (1 + pan)
    wet = reverb(mix, 3.5, 1.1 if dark else 0.9, 11 if dark else 5)
    mixed = 0.55 * np.pad(mix, ((0, wet.shape[0] - mix.shape[0]), (0, 0))) + 0.75 * wet
    if looped:
        return loop(mixed, length)
    out = mixed[:length + int(4 * RATE)]
    ends = np.ones(out.shape[0])
    ends[:int(0.4 * RATE)] = np.linspace(0, 1, int(0.4 * RATE))
    ends[-int(4 * RATE):] = np.cos(np.linspace(0, np.pi / 2, int(4 * RATE))) ** 2
    return out * ends[:, None]


# Audio gallery: one short instrumental per product, in keys that sit with the
# gallery theme. Each scent has its own chords; the product kind sets the touch.
# They stand in until the real spoken presentations replace them (same names).
EB, CM9 = ("Eb2", ["Bb2", "Eb3", "G3", "F4"]), ("C2", ["G2", "Eb3", "Bb3", "D4"])
ABMAJ7, BBSUS = ("Ab1", ["Ab2", "Eb3", "G3", "C4"]), ("Bb1", ["F2", "Bb2", "Eb3", "F3"])
EBMAJ7, BB_D = ("Eb2", ["Bb2", "Eb3", "G3", "D4"]), ("D2", ["F2", "Bb2", "D3", "F3"])
BB, FM7 = ("Bb1", ["F2", "Bb2", "D3", "F3"]), ("F1", ["F2", "C3", "Eb3", "Ab3"])
GM7, AB = ("G1", ["G2", "D3", "Bb3", "F3"]), ("Ab1", ["Ab2", "Eb3", "Ab3", "C4"])
SCENTS = {
    "spiced-peach-negroni": ([CM9, ABMAJ7, EBMAJ7, BBSUS], 84),
    "pornstar-martini": ([EB, BB_D, ABMAJ7, BB], 96),
    "prosecco-di-cherry": ([AB, EB, FM7, BBSUS], 100),
    "maracuja-mojito": ([EB, FM7, GM7, ABMAJ7], 92),
}
KINDS = {"": (False, 0.28, 1.0), "-body-cream": (True, 0.0, 0.9), "-body-wash": (False, 0.5, 0.85), "-set": (False, 0.15, 1.15)}
GALLERY = ROOT / "public" / "xelle" / "galerie"


def gallery_piece(scent, kind, seed):
    chords, bpm = SCENTS[scent]
    dark, rest, touch = KINDS[kind]
    bar = 60 / bpm * 4
    # Two bars a chord, the progression twice: about 42 s, as the placeholders.
    progression = (chords * 8)[:max(8, round(42 / (2 * bar)))]
    return theme(dark, progression, bar, 2, seed, rest, touch, looped=False)


def level(signal, rms_db, peak_db):
    """Same loudness as the material it replaces (mean RMS of 2048-sample
    frames, as measured on the originals), with the peak under a ceiling."""
    mono = signal.mean(axis=1) if signal.ndim > 1 else signal
    frames = mono[: mono.size // 2048 * 2048].reshape(-1, 2048)
    rms = np.mean(np.sqrt(np.mean(frames ** 2, axis=1)))
    signal = signal * 10 ** (rms_db / 20) / rms
    peak = np.max(np.abs(signal))
    ceiling = 10 ** (peak_db / 20)
    if peak > ceiling:
        signal = np.tanh(signal / ceiling) * ceiling
    return signal


def encode(signal, rate, path, bitrate):
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "sound.wav"
        soundfile.write(wav, signal, rate, subtype="PCM_16")
        subprocess.run([shutil.which("ffmpeg") or "ffmpeg", "-y", "-loglevel", "error", "-i", str(wav),
                        "-codec:a", "libmp3lame", "-b:a", bitrate, str(path)], check=True)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    encode(level(theme(False), -35, -16), RATE, OUT / "mainTheme.mp3", "96k")
    encode(level(theme(True), -34, -16), RATE, OUT / "podcastTheme.mp3", "96k")
    sprite_rate = 44100
    sprite = np.zeros(int(15.3 * sprite_rate))
    for offset, notes in ((0.0, ["Bb4", "Eb5"]), (5.1, ["G4", "D5"]), (10.2, ["Eb4", "Bb4"])):
        tone = bell(notes, rate=sprite_rate)
        at = int(offset * sprite_rate)
        sprite[at:at + tone.size] += tone
    encode(level(sprite, -48, -22), sprite_rate, OUT / "sprites.mp3", "96k")
    for name in ("mainTheme.mp3", "podcastTheme.mp3", "sprites.mp3"):
        print(name, (OUT / name).stat().st_size, "bytes")
    entries = json.loads((GALLERY / "galerie.json").read_text(encoding="utf-8"))["products"]
    for seed, entry in enumerate(entries):
        name = Path(entry["audio"]).stem
        scent = next(key for key in SCENTS if name.startswith(key))
        encode(level(gallery_piece(scent, name[len(scent):], 100 + seed), -30, -12), RATE, GALLERY / entry["audio"], "96k")
        print(entry["audio"], (GALLERY / entry["audio"]).stat().st_size, "bytes")


if __name__ == "__main__":
    main()
