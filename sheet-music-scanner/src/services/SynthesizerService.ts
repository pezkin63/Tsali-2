import { WebView } from 'react-native-webview';

/**
 * MIDI Note Number (0-127)
 * Middle C = 60
 */
export type MIDINote = number;

/**
 * Represents a single note event to be synthesized
 */
export interface NoteEvent {
  midiNote: MIDINote;
  velocity: number; // 0-127
  durationMs: number;
  startTimeMs: number;
}

/**
 * Represents a sequence of notes to play
 */
export interface MusicSequence {
  notes: NoteEvent[];
  tempoMs: number; // Milliseconds per beat
  instrumentId: number; // FluidSynth instrument number
}

/**
 * RPC call structure for WebView communication
 */
interface RPCCall {
  id: string;
  method: string;
  params?: any;
}

/**
 * RPC response structure
 */
interface RPCResponse {
  id: string;
  result?: any;
  error?: string;
}

/**
 * SynthesizerService manages communication with the FluidSynth WebView engine
 * Handles RPC-style message passing for audio synthesis control
 */
export class SynthesizerService {
  private static instance: SynthesizerService;
  private webViewRef: WebView | null = null;
  private messageId = 0;
  private pendingCalls: Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }> = new Map();
  private readonly RPC_TIMEOUT = 5000; // 5 seconds
  private isReady = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): SynthesizerService {
    if (!SynthesizerService.instance) {
      SynthesizerService.instance = new SynthesizerService();
    }
    return SynthesizerService.instance;
  }

  /**
   * Register the WebView reference for message passing
   */
  setWebViewRef(webViewRef: WebView): void {
    this.webViewRef = webViewRef;
    console.log('[SynthesizerService] WebView reference set');
  }

  /**
   * Handle messages from the WebView
   * @param event WebView message event
   */
  handleWebViewMessage(event: any): void {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      
      if (message.type === 'rpc_response') {
        this.handleRPCResponse(message as RPCResponse);
      } else if (message.type === 'rpc_error') {
        this.handleRPCError(message);
      } else if (message.type === 'ready') {
        this.handleReady(message);
      } else if (message.type === 'log') {
        console.log('[FluidSynth WebView]', message.data);
      }
    } catch (error) {
      console.error('[SynthesizerService] Failed to parse WebView message:', error);
    }
  }

  /**
   * Handle ready message from WebView
   */
  private handleReady(message: any): void {
    this.isReady = true;
    console.log('[SynthesizerService] WebView synthesizer ready, version:', message.version);
  }

  /**
   * Handle RPC response from WebView
   */
  private handleRPCResponse(response: RPCResponse): void {
    const pending = this.pendingCalls.get(response.id);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingCalls.delete(response.id);
      pending.resolve(response.result);
    }
  }

  /**
   * Handle RPC error from WebView
   */
  private handleRPCError(message: any): void {
    const pending = this.pendingCalls.get(message.id);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingCalls.delete(message.id);
      pending.reject(new Error(`WebView error: ${message.error}`));
    }
  }

  /**
   * Send an RPC call to the WebView and wait for response
   */
  private async sendRPCCall(method: string, params?: any): Promise<any> {
    if (!this.webViewRef) {
      throw new Error('WebView reference not set');
    }

    if (!this.isReady) {
      throw new Error('Synthesizer not ready');
    }

    const callId = `call_${++this.messageId}`;
    const rpcCall: RPCCall = {
      id: callId,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingCalls.delete(callId);
        reject(new Error(`RPC call timeout: ${method}`));
      }, this.RPC_TIMEOUT);

      this.pendingCalls.set(callId, { resolve, reject, timeout });

      try {
        this.webViewRef?.injectJavaScript(`
          window.synthesizerBridge?.handleRPCCall(${JSON.stringify(rpcCall)});
        `);
      } catch (error) {
        clearTimeout(timeout);
        this.pendingCalls.delete(callId);
        reject(error);
      }
    });
  }

  /**
   * Check if synthesizer is ready
   */
  isAvailable(): boolean {
    return this.isReady && this.webViewRef !== null;
  }

  /**
   * Initialize the synthesizer with a soundfont file
   */
  async initialize(soundfontPath: string): Promise<boolean> {
    try {
      const result = await this.sendRPCCall('initialize', { soundfontPath });
      console.log('[SynthesizerService] Initialized with soundfont:', soundfontPath);
      return result;
    } catch (error) {
      console.error('[SynthesizerService] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Load a soundfont file
   */
  async loadSoundfont(soundfontPath: string): Promise<boolean> {
    try {
      const result = await this.sendRPCCall('loadSoundfont', { soundfontPath });
      return result;
    } catch (error) {
      console.error('[SynthesizerService] Failed to load soundfont:', error);
      return false;
    }
  }

  /**
   * Select an instrument by program number
   */
  async selectInstrument(channel: number, programNumber: number): Promise<boolean> {
    try {
      const result = await this.sendRPCCall('selectInstrument', {
        channel,
        programNumber,
      });
      return result;
    } catch (error) {
      console.error('[SynthesizerService] Failed to select instrument:', error);
      return false;
    }
  }

  /**
   * Play a single note
   */
  async playNote(
    midiNote: MIDINote,
    velocity: number = 100,
    durationMs: number = 500,
    channel: number = 0
  ): Promise<boolean> {
    try {
      const result = await this.sendRPCCall('playNote', {
        midiNote,
        velocity,
        durationMs,
        channel,
      });
      return result;
    } catch (error) {
      console.error('[SynthesizerService] Failed to play note:', error);
      return false;
    }
  }

  /**
   * Play a sequence of notes
   */
  async playSequence(sequence: MusicSequence): Promise<boolean> {
    try {
      const result = await this.sendRPCCall('playSequence', sequence);
      return result;
    } catch (error) {
      console.error('[SynthesizerService] Failed to play sequence:', error);
      return false;
    }
  }

  /**
   * Stop all playing notes
   */
  async stopAll(): Promise<boolean> {
    try {
      const result = await this.sendRPCCall('stopAll', {});
      return result;
    } catch (error) {
      console.error('[SynthesizerService] Failed to stop all:', error);
      return false;
    }
  }

  /**
   * Set volume (0-1)
   */
  async setVolume(volume: number): Promise<boolean> {
    try {
      const volume_clamped = Math.max(0, Math.min(1, volume));
      const result = await this.sendRPCCall('setVolume', { volume: volume_clamped });
      return result;
    } catch (error) {
      console.error('[SynthesizerService] Failed to set volume:', error);
      return false;
    }
  }

  /**
   * Set reverb parameters
   */
  async setReverb(roomSize: number, damp: number, width: number): Promise<boolean> {
    try {
      const result = await this.sendRPCCall('setReverb', {
        roomSize: Math.max(0, Math.min(1, roomSize)),
        damp: Math.max(0, Math.min(1, damp)),
        width: Math.max(0, Math.min(1, width)),
      });
      return result;
    } catch (error) {
      console.error('[SynthesizerService] Failed to set reverb:', error);
      return false;
    }
  }

  /**
   * Cleanup and release resources
   */
  async shutdown(): Promise<void> {
    try {
      await this.sendRPCCall('shutdown', {});
      this.isReady = false;
      this.webViewRef = null;
      this.pendingCalls.clear();
      console.log('[SynthesizerService] Shutdown complete');
    } catch (error) {
      console.error('[SynthesizerService] Shutdown error:', error);
      this.isReady = false;
      this.webViewRef = null;
      this.pendingCalls.clear();
    }
  }
}
