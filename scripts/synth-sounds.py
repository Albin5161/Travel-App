# Xplore's interaction sounds, synthesised here so there is nothing to license.
# Run: python3 scripts/synth-sounds.py, then on a Mac shrink each to AAC for the app:
#   for f in found saved together; do afconvert -f m4af -d aac -b 64000 $f.wav assets/sounds/$f.m4a; done
# A soft mallet-on-glass voice: a warm fundamental that rings, two quiet inharmonic partials that
# fade fast (the "tap"), a 6 ms attack so nothing clicks, and a small room made of two late echoes.
import math, struct, wave

RATE = 44100

def voice(freq, dur, amp=1.0, ring=0.55):
    n = int(RATE * dur)
    out = [0.0] * n
    for i in range(n):
        t = i / RATE
        attack = min(1.0, t / 0.006)
        body = math.sin(2 * math.pi * freq * t) * math.exp(-t / ring)
        tap = 0.22 * math.sin(2 * math.pi * freq * 2.76 * t) * math.exp(-t / 0.07)
        air = 0.07 * math.sin(2 * math.pi * freq * 5.4 * t) * math.exp(-t / 0.03)
        warm = 0.18 * math.sin(2 * math.pi * freq * 0.5 * t) * math.exp(-t / (ring * 0.8))
        out[i] = amp * attack * (body + tap + air + warm)
    return out

def mix(notes, total):
    buf = [0.0] * int(RATE * total)
    for start, freq, amp, ring in notes:
        s = int(RATE * start)
        v = voice(freq, total - start, amp, ring)
        for i, x in enumerate(v):
            if s + i < len(buf):
                buf[s + i] += x
    # A small room: two quiet echoes, a little darker than the note.
    room = buf[:]
    for delay, gain in ((0.031, 0.18), (0.057, 0.11)):
        d = int(RATE * delay)
        for i in range(d, len(buf)):
            room[i] += buf[i - d] * gain
    # Fade the tail to silence so the file never ends on a click.
    fade = int(RATE * 0.08)
    for i in range(fade):
        room[-1 - i] *= i / fade
    return room

def write(name, buf, peak_db=-16):
    peak = max(abs(x) for x in buf) or 1
    scale = (10 ** (peak_db / 20)) / peak
    with wave.open(name, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, x * scale)) * 32767)) for x in buf))

# Places found: two notes rising a fifth, E5 to B5, a light "there you go".
write('found.wav', mix([(0.0, 659.25, 0.9, 0.45), (0.09, 987.77, 0.75, 0.5)], 0.75))
# Saved: a gentle C major arpeggio, C5 E5 G5, over a soft C4: settled, done.
write('saved.wav', mix([(0.0, 261.63, 0.35, 0.7), (0.0, 523.25, 0.8, 0.55), (0.07, 659.25, 0.7, 0.55), (0.14, 783.99, 0.65, 0.6)], 0.95))
# Locked in, together: a D major chord blooming upward, a touch longer, for the group moment.
write('together.wav', mix([(0.0, 293.66, 0.35, 0.8), (0.0, 587.33, 0.7, 0.7), (0.045, 739.99, 0.6, 0.7), (0.09, 880.0, 0.55, 0.75), (0.135, 1174.66, 0.4, 0.7)], 1.2))
