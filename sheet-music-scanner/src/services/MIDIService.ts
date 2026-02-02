import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

interface PlaybackInfo {
  isPlaying: boolean;
  currentPosition: number;
  duration: number;
  speed: number;
}

interface PlaybackStatusCallback {
  (info: PlaybackInfo): void;
}

export class MIDIService {
  private sound: Audio.Sound | null = null;
  private isPlaying = false;
  private currentPosition = 0;
  private duration = 0;
  private speed = 1;
  private statusCallbacks: Set<PlaybackStatusCallback> = new Set();
  private audioInitialized = false;
  
  // Singleton instance
  private static instance: MIDIService;

  private constructor() {
    this.initializeAudio();
  }

  /**
   * Initialize audio mode for playback
   */
  private async initializeAudio(): Promise<void> {
    try {
      if (this.audioInitialized) return;
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      this.audioInitialized = true;
      console.log('Audio mode initialized');
    } catch (error) {
      console.error('Failed to initialize audio mode:', error);
    }
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): MIDIService {
    if (!MIDIService.instance) {
      MIDIService.instance = new MIDIService();
    }
    return MIDIService.instance;
  }

  /**
   * Load MIDI from base64 encoded data
   * Note: Mobile platforms don't natively support MIDI playback via Sound API
   * This creates a simple audio representation for testing
   */
  async loadMIDI(base64MIDIData: string): Promise<void> {
    try {
      // Cleanup previous sound if any
      await this.cleanup();

      // For now, create a placeholder audio file since native MIDI isn't supported
      // In production, you would convert MIDI to MP3/WAV using a backend service
      // or use a library like Tone.js via WebView
      
      // Create a simple silent audio to represent MIDI (as placeholder)
      const silentAudioBase64 = this.generateSilentAudio(3000); // 3 second placeholder
      
      const cacheDir = FileSystem.cacheDirectory || '';
      const filename = `temp_${Date.now()}.wav`;
      const tempPath = `${cacheDir}${filename}`;
      
      console.log(`Loading MIDI: Creating temp file at ${tempPath}`);
      
      await FileSystem.writeAsStringAsync(tempPath, silentAudioBase64, {
        encoding: 'base64' as any,
      });

      console.log(`MIDI file written, loading with expo-av...`);

      // cacheDirectory already returns a full path, don't add file://
      // Just use the path directly
      console.log(`Loading from path: ${tempPath}`);

      // Load audio with expo-av (don't autoplay, let caller decide)
      const { sound } = await Audio.Sound.createAsync(
        { uri: tempPath },
        { shouldPlay: false, progressUpdateIntervalMillis: 500 }
      );
      
      this.sound = sound;

      // Get duration
      const status = await sound.getStatusAsync();
      console.log('Audio status:', JSON.stringify(status, null, 2));
      
      if ((status as any).isLoaded) {
        this.duration = (status as any).durationMillis || 3000;
        console.log(`Audio loaded successfully. Duration: ${this.duration}ms`);
      } else {
        console.warn('Audio not loaded after creation, duration may not be available');
        this.duration = 3000; // Default to 3 seconds
      }

      // Setup position tracking listener
      this.setupPlaybackListener();
      
      // Notify listeners of initial load with duration
      this.notifyStatusChange();
    } catch (error) {
      console.error('MIDI loading failed:', error);
      throw error;
    }
  }

  /**
   * Setup listener for playback status updates
   */
  private setupPlaybackListener(): void {
    if (!this.sound) return;

    // Use setOnPlaybackStatusUpdate instead of addPlaybackStatusUpdate
    this.sound.setOnPlaybackStatusUpdate((status: any) => {
      console.log('Playback status update:', {
        positionMillis: status.positionMillis,
        isPlaying: status.isPlaying,
        isLoaded: status.isLoaded,
      });
      
      if (status.isLoaded) {
        this.currentPosition = status.positionMillis || 0;
        this.isPlaying = status.isPlaying || false;

        // Notify all subscribers
        this.notifyStatusChange();
      }
    });
  }

  /**
   * Notify all registered callbacks of status changes
   */
  private notifyStatusChange(): void {
    const info: PlaybackInfo = {
      isPlaying: this.isPlaying,
      currentPosition: this.currentPosition,
      duration: this.duration,
      speed: this.speed,
    };

    console.log('Notifying subscribers of status change:', info);

    this.statusCallbacks.forEach((callback) => {
      try {
        callback(info);
      } catch (error) {
        console.error('Error in playback callback:', error);
      }
    });
  }

  /**
   * Play the loaded MIDI
   */
  async play(): Promise<void> {
    if (!this.sound) {
      console.error('Play failed: No sound loaded');
      throw new Error('No MIDI loaded');
    }
    try {
      console.log('Starting playback...');
      const playStatus = await this.sound.playAsync();
      console.log('Playback started:', playStatus);
      this.isPlaying = true;
      this.notifyStatusChange();
    } catch (error) {
      console.error('Play error:', error);
      throw error;
    }
  }

  /**
   * Pause playback
   */
  async pause(): Promise<void> {
    if (!this.sound) throw new Error('No MIDI loaded');
    try {
      await this.sound.pauseAsync();
      this.isPlaying = false;
      this.notifyStatusChange();
    } catch (error) {
      console.error('Pause error:', error);
      throw error;
    }
  }

  /**
   * Resume playback
   */
  async resume(): Promise<void> {
    if (!this.sound) throw new Error('No MIDI loaded');
    try {
      await this.sound.playAsync();
      this.isPlaying = true;
      this.notifyStatusChange();
    } catch (error) {
      console.error('Resume error:', error);
      throw error;
    }
  }

  /**
   * Stop playback and reset position
   */
  async stop(): Promise<void> {
    if (!this.sound) throw new Error('No MIDI loaded');
    try {
      await this.sound.stopAsync();
      await this.sound.setPositionAsync(0);
      this.isPlaying = false;
      this.currentPosition = 0;
      this.notifyStatusChange();
    } catch (error) {
      console.error('Stop error:', error);
      throw error;
    }
  }

  /**
   * Seek to specific position in milliseconds
   */
  async seek(positionMs: number): Promise<void> {
    if (!this.sound) throw new Error('No MIDI loaded');
    try {
      const clampedPosition = Math.max(0, Math.min(positionMs, this.duration));
      await this.sound.setPositionAsync(clampedPosition);
      this.currentPosition = clampedPosition;
      this.notifyStatusChange();
    } catch (error) {
      console.error('Seek error:', error);
      throw error;
    }
  }

  /**
   * Set playback speed
   */
  async setPlaybackSpeed(speed: number): Promise<void> {
    if (!this.sound) throw new Error('No MIDI loaded');
    try {
      // Clamp speed between 0.5 and 2.0
      const clampedSpeed = Math.max(0.5, Math.min(2.0, speed));
      await this.sound.setRateAsync(clampedSpeed, true);
      this.speed = clampedSpeed;
      this.notifyStatusChange();
    } catch (error) {
      console.error('Speed error:', error);
      throw error;
    }
  }

  /**
   * Get current playback info
   */
  getPlaybackInfo(): PlaybackInfo {
    return {
      isPlaying: this.isPlaying,
      currentPosition: this.currentPosition,
      duration: this.duration,
      speed: this.speed,
    };
  }

  /**
   * Subscribe to playback status updates
   */
  onStatusChange(callback: PlaybackStatusCallback): () => void {
    this.statusCallbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.statusCallbacks.delete(callback);
    };
  }

  /**
   * Get duration in milliseconds
   */
  getDuration(): number {
    return this.duration;
  }

  /**
   * Get current position in milliseconds
   */
  getCurrentPosition(): number {
    return this.currentPosition;
  }

  /**
   * Check if MIDI is currently playing
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Get current playback speed
   */
  getPlaybackSpeed(): number {
    return this.speed;
  }

  /**
   * Generate MIDI from MusicData with SATB support
   */
  async generateMIDIFromMusicData(
    musicData: any,
    satbSelection: { soprano: boolean; alto: boolean; tenor: boolean; bass: boolean }
  ): Promise<void> {
    try {
      // Generate WAV audio from music data notes
      const base64 = this.generateAudioFromMusicData(musicData, satbSelection);
      await this.loadMIDI(base64);
    } catch (error) {
      console.error('MIDI generation failed:', error);
      throw error;
    }
  }

  /**
   * Convert Uint8Array to Base64 string
   */
  private uint8ArrayToBase64(uint8: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < uint8.byteLength; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    return btoa(binary);
  }

  /**
   * Create a simple MIDI file from music data
   */
  private createMIDI(
    musicData: any,
    satbSelection: { soprano: boolean; alto: boolean; tenor: boolean; bass: boolean }
  ): Uint8Array {
    // MIDI file structure with header and tracks
    const header = this.createMIDIHeader();
    const track = this.createMIDITrack(musicData, satbSelection);
    
    // Combine header and track
    return this.concatenateUint8Arrays(header, track);
  }

  /**
   * Create MIDI header chunk
   */
  private createMIDIHeader(): Uint8Array {
    // MThd header: 4D 54 68 64 (MThd)
    // Length: 00 00 00 06
    // Format: 00 00 (type 0)
    // Tracks: 00 01 (1 track)
    // Division: 01 E0 (480 ticks per quarter note)
    return new Uint8Array([
      0x4d, 0x54, 0x68, 0x64, // "MThd"
      0x00, 0x00, 0x00, 0x06, // Header length
      0x00, 0x00, // Format type 0
      0x00, 0x01, // 1 track
      0x01, 0xe0, // 480 ticks per quarter note
    ]);
  }

  /**
   * Create MIDI track chunk
   */
  private createMIDITrack(
    musicData: any,
    satbSelection: { soprano: boolean; alto: boolean; tenor: boolean; bass: boolean }
  ): Uint8Array {
    const trackData: number[] = [];

    // Track header: MTrk
    trackData.push(0x4d, 0x54, 0x72, 0x6b); // "MTrk"

    // Placeholder for length (will be updated later)
    const lengthIndex = trackData.length;
    trackData.push(0x00, 0x00, 0x00, 0x00); // Placeholder

    // Set tempo (120 BPM)
    trackData.push(0x00); // Delta time
    trackData.push(0xff, 0x51, 0x03); // Meta event: Set Tempo
    trackData.push(0x07, 0xa1, 0x20); // 500000 microseconds per quarter note (120 BPM)

    // Voice channel map for SATB
    const voiceChannels: { [key: string]: number } = {
      soprano: 0, // Channel 1
      alto: 1,    // Channel 2
      tenor: 2,   // Channel 3
      bass: 3,    // Channel 4
    };

    // Note mapping from pitch names to MIDI numbers
    const noteMap: { [key: string]: number } = {
      C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11
    };

    // Add notes from measures
    if (musicData.measures && Array.isArray(musicData.measures)) {
      for (const measure of musicData.measures) {
        if (measure.notes && Array.isArray(measure.notes)) {
          for (const note of measure.notes) {
            const voice = note.voice || 'soprano';
            
            // Only include selected voices
            if (!satbSelection[voice as keyof typeof satbSelection]) {
              continue;
            }

            const channel = voiceChannels[voice];
            const midiNote = (note.octave + 1) * 12 + (noteMap[note.pitch] || 0);
            const duration = Math.round(note.duration * 480); // Convert to MIDI ticks

            // Note On: Delta time, status, note, velocity
            trackData.push(0x00); // Delta time
            trackData.push(0x90 + channel); // Note On, channel
            trackData.push(midiNote); // Note number
            trackData.push(100); // Velocity

            // Note Off: Delta time, status, note, velocity
            this.encodeVariableLength(trackData, duration);
            trackData.push(0x80 + channel); // Note Off, channel
            trackData.push(midiNote); // Note number
            trackData.push(0); // Velocity
          }
        }
      }
    }

    // End of track
    trackData.push(0x00); // Delta time
    trackData.push(0xff, 0x2f, 0x00); // Meta event: End of Track

    // Update track length
    const trackLength = trackData.length - 8; // Exclude header and length field
    trackData[lengthIndex] = (trackLength >> 24) & 0xff;
    trackData[lengthIndex + 1] = (trackLength >> 16) & 0xff;
    trackData[lengthIndex + 2] = (trackLength >> 8) & 0xff;
    trackData[lengthIndex + 3] = trackLength & 0xff;

    return new Uint8Array(trackData);
  }

  /**
   * Encode variable length quantity (VLQ) for MIDI
   */
  private encodeVariableLength(arr: number[], value: number): void {
    const bytes: number[] = [];
    bytes.unshift(value & 0x7f);
    value >>= 7;

    while (value > 0) {
      bytes.unshift((value & 0x7f) | 0x80);
      value >>= 7;
    }

    arr.push(...bytes);
  }

  /**
   * Concatenate two Uint8Arrays
   */
  private concatenateUint8Arrays(a: Uint8Array, b: Uint8Array): Uint8Array {
    const result = new Uint8Array(a.length + b.length);
    result.set(a);
    result.set(b, a.length);
    return result;
  }

  /**
   * Cleanup and unload MIDI
   */
  async cleanup(): Promise<void> {
    try {
      // Unload and cleanup sound
      if (this.sound) {
        await this.sound.unloadAsync();
        this.sound = null;
      }

      // Reset state
      this.isPlaying = false;
      this.currentPosition = 0;
      this.duration = 0;
      this.speed = 1;
      this.statusCallbacks.clear();
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  /**
   * Check if a MIDI file is currently loaded
   */
  isLoaded(): boolean {
    return this.sound !== null;
  }

  /**
   * Convert pitch name and octave to frequency in Hz
   */
  private pitchToFrequency(pitch: string, octave: number, accidental?: string): number {
    // Map pitch names to semitones from C
    const pitchMap: { [key: string]: number } = {
      C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11
    };
    
    let semitone = pitchMap[pitch] || 0;
    
    // Apply accidentals
    if (accidental === 'sharp') semitone += 1;
    if (accidental === 'flat') semitone -= 1;
    
    // C4 = 261.63 Hz (Middle C)
    // Each semitone up multiplies frequency by 2^(1/12)
    const c4Frequency = 261.63;
    const semitonesFromC4 = (octave - 4) * 12 + semitone;
    return c4Frequency * Math.pow(2, semitonesFromC4 / 12);
  }

  /**
   * Generate WAV audio from actual sheet music notes
   * Plays each selected voice's notes sequentially at their correct pitches
   */
  private generateAudioFromMusicData(
    musicData: any,
    satbSelection: { soprano: boolean; alto: boolean; tenor: boolean; bass: boolean }
  ): string {
    const sampleRate = 44100;
    const numChannels = 1;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const tempo = musicData.tempo || 120;
    const beatDurationMs = (60 / tempo) * 1000; // Duration of one quarter note in ms
    
    // Collect all notes in order from all selected voices
    const notesToPlay: Array<{
      frequency: number;
      durationMs: number;
      voice: string;
    }> = [];

    if (musicData.measures && Array.isArray(musicData.measures)) {
      for (const measure of musicData.measures) {
        if (measure.notes && Array.isArray(measure.notes)) {
          for (const note of measure.notes) {
            const voice = note.voice || 'soprano';
            
            // Only include selected voices
            if (!satbSelection[voice as keyof typeof satbSelection]) {
              continue;
            }

            // Calculate note duration in milliseconds
            // duration is in quarter notes (1 = quarter note, 0.5 = eighth note, etc.)
            const noteDurationMs = (note.duration || 1) * beatDurationMs;
            
            // Convert pitch to frequency
            const frequency = this.pitchToFrequency(
              note.pitch || 'C',
              note.octave || 4,
              note.accidental
            );

            notesToPlay.push({
              frequency,
              durationMs: noteDurationMs,
              voice
            });
          }
        }
      }
    }

    // If no notes, generate placeholder
    if (notesToPlay.length === 0) {
      console.warn('No notes found in music data, using placeholder');
      return this.generateSilentAudio(3000);
    }

    // Calculate total duration
    const totalDurationMs = notesToPlay.reduce((sum, note) => sum + note.durationMs, 0);
    const samples = Math.floor((sampleRate * totalDurationMs) / 1000);
    const dataSize = samples * blockAlign;
    const fileSize = 36 + dataSize;

    // WAV header
    const audioData = new ArrayBuffer(44 + dataSize);
    const view = new DataView(audioData);

    // Write RIFF header
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, fileSize, true);
    writeString(8, 'WAVE');

    // fmt sub-chunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);

    // data sub-chunk
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    // Generate audio samples for each note
    let sampleIndex = 0;
    const amplitude = 20000; // Slightly lower amplitude to prevent clipping with multiple voices
    const twoPi = 2 * Math.PI;

    for (const note of notesToPlay) {
      const noteSamples = Math.floor((sampleRate * note.durationMs) / 1000);
      
      // Add short attack/release envelope to avoid clicks
      const attackSamples = Math.floor(sampleRate * 0.005); // 5ms attack
      const releaseSamples = Math.floor(sampleRate * 0.01); // 10ms release
      const sustainSamples = Math.max(0, noteSamples - attackSamples - releaseSamples);

      for (let i = 0; i < noteSamples; i++) {
        let envelope = 1;

        // Attack phase
        if (i < attackSamples && attackSamples > 0) {
          envelope = i / attackSamples;
        }
        // Release phase
        else if (i >= noteSamples - releaseSamples && releaseSamples > 0) {
          envelope = (noteSamples - i) / releaseSamples;
        }

        // Generate sine wave sample
        const sampleValue = amplitude * envelope * Math.sin((twoPi * note.frequency * i) / sampleRate);
        
        // Write as 16-bit signed integer
        if (sampleIndex < samples) {
          view.setInt16(44 + sampleIndex * blockAlign, Math.round(sampleValue), true);
          sampleIndex++;
        }
      }
    }

    // Fill any remaining samples with silence (shouldn't happen if math is correct)
    while (sampleIndex < samples) {
      view.setInt16(44 + sampleIndex * blockAlign, 0, true);
      sampleIndex++;
    }

    // Convert to base64
    const bytes = new Uint8Array(audioData);
    let binaryString = '';
    for (let i = 0; i < bytes.length; i++) {
      binaryString += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binaryString);

    console.log(`Generated note-by-note WAV: ${totalDurationMs.toFixed(0)}ms, ${notesToPlay.length} notes, base64 size: ${base64.length}`);
    for (let i = 0; i < Math.min(5, notesToPlay.length); i++) {
      console.log(`  Note ${i + 1}: ${notesToPlay[i].frequency.toFixed(1)}Hz for ${notesToPlay[i].durationMs.toFixed(0)}ms`);
    }
    if (notesToPlay.length > 5) {
      console.log(`  ... and ${notesToPlay.length - 5} more notes`);
    }

    return base64;
  }

  /**
   * Generate a simple sine wave tone WAV file
   * This creates an audible test tone so users can hear playback working
   */
  private generateSilentAudio(durationMs: number): string {
    const sampleRate = 44100;
    const numChannels = 1;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    
    // Calculate samples as integer
    const samples = Math.floor((sampleRate * durationMs) / 1000);
    const dataSize = samples * blockAlign;
    const fileSize = 36 + dataSize;

    // WAV header
    const audioData = new ArrayBuffer(44 + dataSize);
    const view = new DataView(audioData);

    // Write RIFF header
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, fileSize, true); // File size - 8
    writeString(8, 'WAVE');

    // fmt sub-chunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
    view.setUint16(22, numChannels, true); // NumChannels
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
    view.setUint16(32, blockAlign, true); // BlockAlign
    view.setUint16(34, bitsPerSample, true); // BitsPerSample

    // data sub-chunk
    writeString(36, 'data');
    view.setUint32(40, dataSize, true); // Subchunk2Size

    // Generate a simple sine wave tone at 440Hz (A note)
    const frequency = 440; // Hz
    const amplitude = 32000; // Max amplitude for 16-bit audio
    const twoPi = 2 * Math.PI;
    
    for (let i = 0; i < samples; i++) {
      // Calculate sample value using sine wave
      const sampleValue = amplitude * Math.sin((twoPi * frequency * i) / sampleRate);
      // Write as 16-bit signed integer (little-endian)
      view.setInt16(44 + i * blockAlign, sampleValue, true);
    }

    // Convert to base64 (use loop instead of spreading to avoid stack overflow)
    const bytes = new Uint8Array(audioData);
    let binaryString = '';
    for (let i = 0; i < bytes.length; i++) {
      binaryString += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binaryString);
    console.log(`Generated tone WAV: ${durationMs}ms, 440Hz sine wave, base64 size: ${base64.length}`);
    return base64;
  }

  /**
   * Get human-readable time format
   */
  static formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}

export default MIDIService;
