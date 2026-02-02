# Quick Start: Using the FluidSynth Synthesizer

## 1. Basic Note Playback

```typescript
import { SynthesizerService } from '@services/SynthesizerService';

const synth = SynthesizerService.getInstance();

// Play middle C (MIDI note 60) for 500ms at full volume
await synth.playNote(60, 127, 500, 0);
```

## 2. Play a Sequence

```typescript
import { MusicEventConverter } from '@services/MusicEventConverter';
import { SynthesizerService } from '@services/SynthesizerService';

// Create notes in sheet music format
const notes = [
  { noteName: NoteName.C, octave: 4, noteType: NoteType.QUARTER },
  { noteName: NoteName.D, octave: 4, noteType: NoteType.QUARTER },
  { noteName: NoteName.E, octave: 4, noteType: NoteType.QUARTER },
  { noteName: NoteName.F, octave: 4, noteType: NoteType.QUARTER },
];

// Convert to MIDI sequence
const sequence = MusicEventConverter.createSequence(
  notes,
  {
    tempoBeatsPerMinute: 120,
    timeSignatureNumerator: 4,
    timeSignatureDenominator: 4,
  },
  0, // piano
  90 // velocity
);

// Play the sequence
const synth = SynthesizerService.getInstance();
await synth.playSequence(sequence);
```

## 3. Change Instruments

```typescript
const synth = SynthesizerService.getInstance();

// Select a different instrument (0 = piano, see list below)
await synth.selectInstrument(0, 33); // Acoustic bass

// Then play notes with the new instrument
await synth.playNote(36, 100, 500, 0); // Low C on bass
```

## 4. Control Volume

```typescript
const synth = SynthesizerService.getInstance();

// Set volume (0.0 = silent, 1.0 = full volume)
await synth.setVolume(0.7); // 70% volume
```

## 5. Add Reverb

```typescript
const synth = SynthesizerService.getInstance();

// Set reverb parameters (0.0 - 1.0)
await synth.setReverb(
  0.7,  // roomSize (bigger rooms = more reverb)
  0.6,  // damp (how much high frequencies are absorbed)
  0.5   // width (stereo spread)
);
```

## 6. Stop All Sound

```typescript
const synth = SynthesizerService.getInstance();
await synth.stopAll();
```

## Instrument Program Numbers

```
0-7     Piano family
8-15    Chromatic Percussion
16-23   Organ
24-31   Guitar
32-39   Bass
40-47   Strings
48-55   Ensemble
56-63   Brass
64-71   Reed
72-79   Pipe
80-87   Synth Lead
88-95   Synth Pad
96-103  Synth Effects
104-111 Ethnic
112-119 Percussive
120-127 Sound effects
```

## Common Instrument Numbers

```
Program 0   - Acoustic Grand Piano
Program 24  - Acoustic Guitar (nylon)
Program 33  - Acoustic Bass
Program 40  - Violin
Program 48  - String Ensemble
Program 56  - Trumpet
Program 64  - Soprano Saxophone
Program 71  - Clarinet
Program 81  - Lead 1 (square)
```

## MIDI Note Numbers

```
C0 = 12,  C1 = 24,  C2 = 36,  C3 = 48,
C4 = 60 (Middle C)
C5 = 72,  C6 = 84,  C7 = 96,  C8 = 108
```

## Sheet Music Conversion

```typescript
import { NoteName, NoteType, Accidental } from '@services/MusicEventConverter';

// Define notes in musical notation
const notes = [
  {
    noteName: NoteName.D,
    octave: 4,
    accidental: Accidental.SHARP,
    noteType: NoteType.HALF, // 2 beats
    dotted: true, // Adds 1.5x duration
  },
  {
    noteName: NoteName.G,
    octave: 4,
    noteType: NoteType.QUARTER,
  },
];

// Convert to timing
const timing = {
  tempoBeatsPerMinute: 120,
  timeSignatureNumerator: 4,
  timeSignatureDenominator: 4,
};

// Get sequence ready to play
const sequence = MusicEventConverter.createSequence(notes, timing, 0, 90);
```

## Error Handling

```typescript
const synth = SynthesizerService.getInstance();

try {
  if (!synth.isAvailable()) {
    console.error('Synthesizer not ready yet');
    return;
  }
  await synth.playSequence(sequence);
} catch (error) {
  console.error('Playback error:', error);
}
```

## Integration with ViewerScreen

```typescript
// In togglePlayback():
const togglePlayback = async () => {
  try {
    if (!item?.musicData) {
      Alert.alert('No Data', 'No music data available');
      return;
    }

    const midiService = MIDIService.getInstance();

    if (isPlaying) {
      await midiService.pause();
      setIsPlaying(false);
    } else {
      // Convert and play with new synthesizer
      const sequence = MusicEventConverter.createSequence(
        item.musicData.notes,
        {
          tempoBeatsPerMinute: item.musicData.tempo || 120,
          timeSignatureNumerator: 4,
          timeSignatureDenominator: 4,
        },
        0, // instrument
        90 // velocity
      );

      // Play using synthesizer
      const synth = SynthesizerService.getInstance();
      if (synth.isAvailable()) {
        await synth.playSequence(sequence);
        setIsPlaying(true);
      }
    }
  } catch (error) {
    console.error('Playback error:', error);
    Alert.alert('Error', 'Failed to start playback');
    setIsPlaying(false);
  }
};
```

## Debugging

Check if synthesizer is ready:
```typescript
const synth = SynthesizerService.getInstance();
console.log('Synthesizer available:', synth.isAvailable());
```

Listen for WebView messages (in React Native debugger):
```
[FluidSynth WebView] Ready
[FluidSynth WebView] Loading soundfont: [path]
[FluidSynth WebView] Ready - Piano loaded
```

## Performance Tips

1. **Pre-convert sequences** - Convert music data once, reuse sequences
2. **Limit polyphony** - Avoid playing 100+ notes simultaneously
3. **Use simpler instruments** - Basic piano is fastest
4. **Cache sequences** - Store converted sequences in state
5. **Test on device** - WebView performance varies by device

## Next: Connect Your Data

Replace `item.musicData.notes` with your OCR-generated sheet music data structure, ensuring it matches:

```typescript
interface SheetMusicNote {
  noteName: NoteName;  // C, D, E, F, G, A, B
  octave: number;      // 0-8
  accidental?: Accidental;  // SHARP, FLAT, NATURAL
  noteType: NoteType;   // QUARTER, HALF, EIGHTH, etc.
  dotted?: boolean;     // For dotted notes
}
```

And you're ready to produce professional-quality audio! 🎵
