import { NoteEvent, MusicSequence, MIDINote } from './SynthesizerService';

/**
 * Musical notation types
 */
export enum NoteType {
  WHOLE = 1,        // 4 beats
  HALF = 2,         // 2 beats
  QUARTER = 4,      // 1 beat
  EIGHTH = 8,       // 0.5 beats
  SIXTEENTH = 16,   // 0.25 beats
  THIRTY_SECOND = 32, // 0.125 beats
}

/**
 * Note names in a scale (C to B)
 */
export enum NoteName {
  C = 0,
  D = 2,
  E = 4,
  F = 5,
  G = 7,
  A = 9,
  B = 11,
}

/**
 * Accidental modifiers
 */
export enum Accidental {
  NATURAL = 0,
  SHARP = 1,
  FLAT = -1,
  DOUBLE_SHARP = 2,
  DOUBLE_FLAT = -2,
}

/**
 * Represents a single note in sheet music notation
 */
export interface SheetMusicNote {
  noteName: NoteName;
  octave: number; // 0-8 (Octave 4 is middle C)
  accidental?: Accidental;
  noteType: NoteType; // Duration type
  dotted?: boolean; // If dotted, adds 1.5x duration
  tupleName?: 'triplet' | 'duplet' | 'quadruplet'; // Tuplet subdivisions
  restDuration?: number; // If this is a rest, specify duration in beats
}

/**
 * Represents timing information for playback
 */
export interface TimingInfo {
  tempoBeatsPerMinute: number; // Tempo in BPM
  timeSignatureNumerator: number; // e.g., 4 in 4/4
  timeSignatureDenominator: number; // e.g., 4 in 4/4
}

/**
 * Staff line to note mapping for treble clef
 * Lines from bottom to top: E, G, B, D, F
 * Spaces from bottom to top: F, A, C, E
 */
const TREBLE_CLEF_MAPPING = {
  lines: [
    { line: 0, noteName: NoteName.E, octave: 4 }, // Bottom line
    { line: 1, noteName: NoteName.G, octave: 4 },
    { line: 2, noteName: NoteName.B, octave: 4 },
    { line: 3, noteName: NoteName.D, octave: 5 },
    { line: 4, noteName: NoteName.F, octave: 5 }, // Top line
  ],
  spaces: [
    { space: 0, noteName: NoteName.F, octave: 4 }, // Bottom space
    { space: 1, noteName: NoteName.A, octave: 4 },
    { space: 2, noteName: NoteName.C, octave: 5 },
    { space: 3, noteName: NoteName.E, octave: 5 }, // Top space
  ],
};

/**
 * MusicEventConverter converts sheet music notation to MIDI events
 */
export class MusicEventConverter {
  /**
   * Convert a sheet music note to MIDI note number
   * Middle C (C4) = MIDI note 60
   */
  static sheetMusicNoteToMIDI(note: SheetMusicNote): MIDINote {
    const baseNote = note.noteName + (note.accidental ?? Accidental.NATURAL);
    const octaveOffset = note.octave * 12;
    const midiNote = baseNote + octaveOffset + 12; // +12 to start from C0
    
    // Clamp to valid MIDI range (0-127)
    return Math.max(0, Math.min(127, midiNote));
  }

  /**
   * Convert a note name to MIDI note number
   */
  static noteNameToMIDI(noteName: NoteName, octave: number, accidental: Accidental = Accidental.NATURAL): MIDINote {
    const baseNote = noteName + accidental;
    const midiNote = baseNote + (octave * 12) + 12;
    return Math.max(0, Math.min(127, midiNote));
  }

  /**
   * Calculate duration in milliseconds from note type and tempo
   */
  static calculateDuration(
    noteType: NoteType,
    tempoBeatsPerMinute: number,
    dotted: boolean = false,
    tupleName?: 'triplet' | 'duplet' | 'quadruplet'
  ): number {
    // One beat = one quarter note = 4 / timeSignatureDenominator
    const beatsPerMinute = tempoBeatsPerMinute;
    const beatDurationMs = 60000 / beatsPerMinute; // ms per beat
    
    // Calculate beats for this note
    let beats = 4 / noteType; // Quarter note = 1 beat
    
    // Handle tuplets
    if (tupleName === 'triplet') {
      beats = (beats * 2) / 3; // Triplet = 2/3 of normal duration
    } else if (tupleName === 'duplet') {
      beats = (beats * 3) / 2; // Duplet = 3/2 of normal duration
    } else if (tupleName === 'quadruplet') {
      beats = (beats * 4) / 5; // Quadruplet = 4/5 of normal duration
    }
    
    // Handle dotted notes (add 1.5x duration)
    if (dotted) {
      beats = beats * 1.5;
    }
    
    return Math.round(beats * beatDurationMs);
  }

  /**
   * Convert a single sheet music note to a MIDI note event
   */
  static noteToEvent(
    note: SheetMusicNote,
    startTimeMs: number,
    tempoBeatsPerMinute: number,
    velocity: number = 80
  ): NoteEvent | null {
    // Handle rests
    if (note.restDuration !== undefined) {
      return null; // Rests don't produce sound events
    }

    const midiNote = this.sheetMusicNoteToMIDI(note);
    const durationMs = this.calculateDuration(
      note.noteType,
      tempoBeatsPerMinute,
      note.dotted,
      note.tupleName
    );

    return {
      midiNote,
      velocity: Math.max(1, Math.min(127, velocity)),
      durationMs,
      startTimeMs,
    };
  }

  /**
   * Convert a sequence of sheet music notes to MIDI events with proper timing
   */
  static notesSequenceToEvents(
    notes: SheetMusicNote[],
    timing: TimingInfo,
    baseVelocity: number = 80
  ): NoteEvent[] {
    const events: NoteEvent[] = [];
    let currentTimeMs = 0;

    for (const note of notes) {
      if (note.restDuration !== undefined) {
        // Rest: advance time by rest duration in beats
        const beatDurationMs = 60000 / timing.tempoBeatsPerMinute;
        currentTimeMs += note.restDuration * beatDurationMs;
      } else {
        // Note: create event and advance time
        const event = this.noteToEvent(note, currentTimeMs, timing.tempoBeatsPerMinute, baseVelocity);
        if (event) {
          events.push(event);
          currentTimeMs += event.durationMs;
        }
      }
    }

    return events;
  }

  /**
   * Create a music sequence from notes for playback
   */
  static createSequence(
    notes: SheetMusicNote[],
    timing: TimingInfo,
    instrumentId: number = 0,
    baseVelocity: number = 80
  ): MusicSequence {
    const noteEvents = this.notesSequenceToEvents(notes, timing, baseVelocity);
    const beatDurationMs = 60000 / timing.tempoBeatsPerMinute;

    return {
      notes: noteEvents,
      tempoMs: beatDurationMs,
      instrumentId,
    };
  }

  /**
   * Get treble clef note from staff position
   * @param position Staff position (-2 to 6 for standard 5-line staff)
   * -2 = space below staff
   * -1 = bottom line
   * 0 = space
   * 1 = line
   * etc.
   */
  static staffPositionToNote(position: number, accidental: Accidental = Accidental.NATURAL): SheetMusicNote {
    // Calculate which line or space
    if (position % 2 === 1) {
      // It's a line
      const lineIndex = Math.floor(position / 2);
      if (lineIndex >= 0 && lineIndex < TREBLE_CLEF_MAPPING.lines.length) {
        const lineNote = TREBLE_CLEF_MAPPING.lines[lineIndex];
        return {
          noteName: lineNote.noteName,
          octave: lineNote.octave,
          accidental,
          noteType: NoteType.QUARTER,
        };
      }
    } else {
      // It's a space
      const spaceIndex = Math.floor(position / 2);
      if (spaceIndex >= 0 && spaceIndex < TREBLE_CLEF_MAPPING.spaces.length) {
        const spaceNote = TREBLE_CLEF_MAPPING.spaces[spaceIndex];
        return {
          noteName: spaceNote.noteName,
          octave: spaceNote.octave,
          accidental,
          noteType: NoteType.QUARTER,
        };
      }
    }

    // Fallback to middle C
    return {
      noteName: NoteName.C,
      octave: 4,
      accidental: Accidental.NATURAL,
      noteType: NoteType.QUARTER,
    };
  }

  /**
   * Create a simple test sequence (C major scale)
   */
  static createTestSequence(): MusicSequence {
    const notes: SheetMusicNote[] = [
      { noteName: NoteName.C, octave: 4, noteType: NoteType.QUARTER },
      { noteName: NoteName.D, octave: 4, noteType: NoteType.QUARTER },
      { noteName: NoteName.E, octave: 4, noteType: NoteType.QUARTER },
      { noteName: NoteName.F, octave: 4, noteType: NoteType.QUARTER },
      { noteName: NoteName.G, octave: 4, noteType: NoteType.QUARTER },
      { noteName: NoteName.A, octave: 4, noteType: NoteType.QUARTER },
      { noteName: NoteName.B, octave: 4, noteType: NoteType.QUARTER },
      { noteName: NoteName.C, octave: 5, noteType: NoteType.QUARTER },
    ];

    const timing: TimingInfo = {
      tempoBeatsPerMinute: 120,
      timeSignatureNumerator: 4,
      timeSignatureDenominator: 4,
    };

    return this.createSequence(notes, timing, 0, 90);
  }
}
