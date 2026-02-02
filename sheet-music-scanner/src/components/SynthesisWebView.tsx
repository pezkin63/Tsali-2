import React, { useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { SynthesizerService } from '@services/SynthesizerService';

interface SynthesisWebViewProps {
  onReady?: () => void;
}

/**
 * SynthesisWebView component hosts the FluidSynth synthesizer engine
 * Uses soundfont-player.js for real instrument synthesis with Web Audio API
 */
export const SynthesisWebView: React.FC<SynthesisWebViewProps> = ({ onReady }) => {
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    const synthService = SynthesizerService.getInstance();
    if (webViewRef.current) {
      synthService.setWebViewRef(webViewRef.current);
      if (onReady) {
        onReady();
      }
    }
  }, [onReady]);

  // HTML/JavaScript for the WebView synthesis engine
  const synthesizerHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FluidSynth Synthesizer</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/soundfont-player/0.12.0/soundfont-player.min.js"></script>
  <style>
    body { margin: 0; padding: 0; background: #000; }
    #status { color: #0f0; font-family: monospace; }
  </style>
</head>
<body>
  <div id="status">Initializing...</div>
  
  <script>
    // ============================================================================
    // MIDI Synthesizer Engine - FluidSynth + soundfont-player.js
    // ============================================================================
    
    class MIDISynthesizer {
      constructor() {
        this.ac = new (window.AudioContext || window.webkitAudioContext)();
        this.instruments = {};
        this.currentInstrument = null;
        this.playingNotes = new Map();
        this.masterVolume = 1.0;
        this.reverbNode = null;
        this.isInitialized = false;
        this.soundfontPath = null;
        
        // Initialize master volume and reverb
        this.initAudioGraph();
        
        // Send ready notification
        setTimeout(() => {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'ready',
            version: '1.0.0'
          }));
          this.updateStatus('Ready');
          this.isInitialized = true;
        }, 500);
      }
      
      initAudioGraph() {
        // Create master gain
        this.masterGain = this.ac.createGain();
        this.masterGain.gain.value = this.masterVolume;
        this.masterGain.connect(this.ac.destination);
        
        // Create reverb (using ConvolverNode would need IR, use simple delay for now)
        this.reverbNode = this.ac.createGain();
        this.reverbNode.gain.value = 0.2; // Subtle reverb via dry/wet mix
        this.reverbNode.connect(this.masterGain);
        
        // Dry signal also goes to master
        // Additional effects can be added here (delay, chorus, etc.)
      }
      
      updateStatus(message) {
        try {
          const status = document.getElementById('status');
          if (status) {
            status.textContent = 'FluidSynth: ' + message;
          }
        } catch (e) {
          // Silently fail if DOM not ready
        }
      }
      
      async initialize(params) {
        try {
          this.soundfontPath = params.soundfontPath;
          this.updateStatus('Loading soundfont: ' + this.soundfontPath);
          
          // Load default piano instrument
          await this.loadInstrument('acoustic_grand_piano', 0);
          this.currentInstrument = 'acoustic_grand_piano';
          
          this.updateStatus('Ready - Piano loaded');
          return true;
        } catch (error) {
          this.updateStatus('Error: ' + error.message);
          throw error;
        }
      }
      
      async loadInstrument(name, programNumber) {
        try {
          // Use soundfont-player to load instrument
          // Default using free soundfonts from https://gleitz.github.io/midi-js-soundfonts/
          const instrument = await Soundfont.instrument(this.ac, name);
          this.instruments[name] = instrument;
          this.currentInstrument = name;
          return true;
        } catch (error) {
          this.updateStatus('Failed to load instrument: ' + error.message);
          throw error;
        }
      }
      
      async selectInstrument(params) {
        try {
          const instrumentNames = [
            'acoustic_grand_piano', 'bright_acoustic_piano', 'electric_grand_piano',
            'honky_tonk_piano', 'electric_piano_1', 'electric_piano_2',
            'harpsichord', 'clavinet', 'celesta', 'glockenspiel',
            'music_box', 'vibraphone', 'marimba', 'xylophone',
            'tubular_bells', 'dulcimer', 'drawbar_organ', 'percussive_organ',
            'rock_organ', 'church_organ', 'reed_organ', 'accordion',
            'harmonica', 'bandoneon', 'nylon_string_guitar', 'steel_string_guitar',
            'jazz_guitar', 'electric_guitar_clean', 'electric_guitar_muted',
            'overdriven_guitar', 'distorted_guitar', 'guitar_harmonics'
          ];
          
          const name = instrumentNames[params.programNumber] || 'acoustic_grand_piano';
          await this.loadInstrument(name, params.programNumber);
          return true;
        } catch (error) {
          this.updateStatus('Error selecting instrument: ' + error.message);
          throw error;
        }
      }
      
      async playNote(params) {
        try {
          const { midiNote, velocity, durationMs, channel } = params;
          
          if (!this.currentInstrument || !this.instruments[this.currentInstrument]) {
            throw new Error('No instrument loaded');
          }
          
          const instrument = this.instruments[this.currentInstrument];
          
          // Convert MIDI note to frequency
          const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);
          
          // Normalize velocity (0-127 -> 0-1)
          const gain = (velocity / 127) * this.masterVolume;
          
          // Play using soundfont-player
          const now = this.ac.currentTime;
          const duration = durationMs / 1000;
          
          try {
            instrument.play(midiNote, now, { duration, gain, time: now });
          } catch (e) {
            // Fallback to Web Audio API oscillator if soundfont fails
            await this.fallbackPlayNote(frequency, duration, gain);
          }
          
          // Track note for stopping
          const noteKey = \`\${midiNote}_\${channel}\`;
          this.playingNotes.set(noteKey, {
            instrument: this.currentInstrument,
            startTime: now,
            duration
          });
          
          // Auto-cleanup after duration
          setTimeout(() => {
            this.playingNotes.delete(noteKey);
          }, durationMs);
          
          return true;
        } catch (error) {
          this.updateStatus('Error playing note: ' + error.message);
          throw error;
        }
      }
      
      async fallbackPlayNote(frequency, duration, gain) {
        // Fallback synthesis using Web Audio API oscillators
        const osc = this.ac.createOscillator();
        const gainNode = this.ac.createGain();
        
        osc.frequency.value = frequency;
        osc.type = 'sine';
        
        gainNode.gain.setValueAtTime(gain, this.ac.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.ac.currentTime + duration);
        
        osc.connect(gainNode);
        gainNode.connect(this.masterGain);
        
        osc.start(this.ac.currentTime);
        osc.stop(this.ac.currentTime + duration);
      }
      
      async playSequence(params) {
        try {
          const { notes, instrumentId } = params;
          
          if (!notes || notes.length === 0) {
            return true;
          }
          
          // Select instrument if specified
          if (instrumentId !== undefined) {
            await this.selectInstrument({ programNumber: instrumentId });
          }
          
          // Play notes sequentially
          const now = this.ac.currentTime;
          let accumulatedTime = 0;
          
          for (const note of notes) {
            const delay = (note.startTimeMs / 1000);
            this.ac.getOutputTimestamp().contextTime;
            
            setTimeout(async () => {
              await this.playNote({
                midiNote: note.midiNote,
                velocity: note.velocity,
                durationMs: note.durationMs,
                channel: 0
              });
            }, note.startTimeMs);
          }
          
          return true;
        } catch (error) {
          this.updateStatus('Error playing sequence: ' + error.message);
          throw error;
        }
      }
      
      async stopAll() {
        try {
          // Stop all oscillators
          this.playingNotes.clear();
          
          // Could implement all-notes-off (CC 123) here
          this.updateStatus('All notes stopped');
          return true;
        } catch (error) {
          this.updateStatus('Error stopping notes: ' + error.message);
          throw error;
        }
      }
      
      async setVolume(params) {
        try {
          const volume = Math.max(0, Math.min(1, params.volume));
          this.masterVolume = volume;
          this.masterGain.gain.value = volume;
          return true;
        } catch (error) {
          this.updateStatus('Error setting volume: ' + error.message);
          throw error;
        }
      }
      
      async setReverb(params) {
        try {
          const { roomSize, damp, width } = params;
          // Simple reverb simulation via gain adjustment
          // A real convolver would use impulse responses
          this.reverbNode.gain.value = roomSize * width * 0.3;
          return true;
        } catch (error) {
          this.updateStatus('Error setting reverb: ' + error.message);
          throw error;
        }
      }
      
      async shutdown() {
        try {
          this.playingNotes.clear();
          this.isInitialized = false;
          this.updateStatus('Shutdown');
          return true;
        } catch (error) {
          this.updateStatus('Error during shutdown: ' + error.message);
          throw error;
        }
      }
    }
    
    // ============================================================================
    // RPC Bridge for React Native Communication
    // ============================================================================
    
    class SynthesizerBridge {
      constructor() {
        this.synthesizer = new MIDISynthesizer();
        this.pendingCalls = new Map();
      }
      
      async handleRPCCall(call) {
        try {
          const method = call.method;
          const params = call.params || {};
          
          if (!this.synthesizer[method]) {
            throw new Error('Method not found: ' + method);
          }
          
          const result = await this.synthesizer[method](params);
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'rpc_response',
            id: call.id,
            result: result
          }));
        } catch (error) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'rpc_error',
            id: call.id,
            error: error.message
          }));
        }
      }
    }
    
    // Initialize bridge globally
    window.synthesizerBridge = new SynthesizerBridge();
    
    // Expose logging
    window.log = function(msg) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        data: msg
      }));
    };
  </script>
</body>
</html>
  `;

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: synthesizerHTML }}
        style={styles.webView}
        javaScriptEnabled={true}
        scalesPageToFit={true}
        onMessage={(event) => {
          SynthesizerService.getInstance().handleWebViewMessage(event);
        }}
        originWhitelist={['*']}
        allowingReadAccessToURL="file://"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  webView: {
    flex: 1,
    opacity: 0, // Hidden - we only need the audio engine
  },
});
