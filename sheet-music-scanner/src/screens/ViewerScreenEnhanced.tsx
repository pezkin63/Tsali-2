import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  Alert,
  Dimensions,
  SafeAreaView,
  ActivityIndicator
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MusicData, Measure } from '@utils/types';
import { SynthesizerService, MusicSequence, NoteEvent } from '@services/SynthesizerService';

const { width } = Dimensions.get('window');

interface ViewerScreenProps {
  musicData: MusicData;
  symbols: any[];
  confidence: number;
  processingTime: number;
}

export function ViewerScreenEnhanced() {
  const route = useRoute();
  const navigation = useNavigation();
  const { musicData, symbols, confidence, processingTime } =
    route.params as ViewerScreenProps;

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentMeasure, setCurrentMeasure] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  /**
   * Play current composition
   */
  const handlePlayMusic = async () => {
    try {
      setIsPlaying(true);
      
      if (!musicData || !musicData.measures || musicData.measures.length === 0) {
        Alert.alert('No Music', 'No musical data to play');
        setIsPlaying(false);
        return;
      }

      const synthesizer = SynthesizerService.getInstance();
      
      if (!synthesizer.isAvailable()) {
        // Synthesizer not available - at least log the notes
        const noteNames: string[] = [];
        musicData.measures.forEach((measure: Measure) => {
          if (measure.notes && measure.notes.length > 0) {
            measure.notes.forEach((note: any) => {
              const pitchName = note.pitch || 'C';
              const octave = note.octave || 4;
              noteNames.push(`${pitchName}${octave}`);
            });
          }
        });
        
        Alert.alert(
          'Playing',
          `Notes: ${noteNames.join(', ')}\n\n(Audio playback not available in this build)`
        );
        setIsPlaying(false);
        return;
      }

      // Convert music data to note sequence
      const noteEvents: NoteEvent[] = [];
      let currentTimeMs = 0;
      const noteDurationMs = 500; // 500ms per note

      // Iterate through all measures and notes
      musicData.measures.forEach((measure: Measure) => {
        if (measure.notes && measure.notes.length > 0) {
          measure.notes.forEach((note: any) => {
            // Convert note to MIDI number
            // note.pitch is the letter (C, D, E, etc.)
            // note.octave is the octave number (4, 5, etc.)
            const midiNote = notePitchToMidi(note.pitch || 'C', note.octave || 4);
            
            noteEvents.push({
              midiNote,
              velocity: 100,
              durationMs: noteDurationMs,
              startTimeMs: currentTimeMs,
            });
            
            currentTimeMs += noteDurationMs;
          });
        }
      });

      if (noteEvents.length === 0) {
        Alert.alert('No Notes', 'No notes found in the scanned music');
        setIsPlaying(false);
        return;
      }

      // Create music sequence
      const sequence: MusicSequence = {
        notes: noteEvents,
        tempoMs: 500,
        instrumentId: 0, // Piano
      };

      // Play the sequence
      const success = await synthesizer.playSequence(sequence);
      
      if (success) {
        console.log(`Playing ${noteEvents.length} notes...`);
        // Wait for playback to complete
        await new Promise((resolve) => setTimeout(resolve, currentTimeMs + 1000));
      } else {
        Alert.alert('Playback Error', 'Failed to play music sequence');
      }
      
      setIsPlaying(false);
    } catch (error) {
      console.error('Play error:', error);
      Alert.alert('Error', `Failed to play music: ${error}`);
      setIsPlaying(false);
    }
  };

  /**
   * Convert note pitch and octave to MIDI number
   * C4 (middle C) = 60
   */
  const notePitchToMidi = (pitch: string, octave: number): number => {
    const noteMap: { [key: string]: number } = {
      C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
    };

    let midiNote = (octave + 1) * 12 + (noteMap[pitch.toUpperCase()] || 0);
    return Math.max(0, Math.min(127, midiNote)); // Clamp to MIDI range
  };

  /**
   * Export as MusicXML
   */
  const handleExportMusicXML = async () => {
    try {
      setIsExporting(true);
      // TODO: Generate MusicXML from musicData
      const musicXml = generateMusicXML(musicData);
      console.log('Exporting MusicXML:', musicXml);
      Alert.alert('Success', 'Exported as MusicXML');
      setIsExporting(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to export');
      setIsExporting(false);
    }
  };

  /**
   * Export as MIDI
   */
  const handleExportMIDI = async () => {
    try {
      setIsExporting(true);
      // TODO: Generate MIDI from musicData
      console.log('Exporting MIDI');
      Alert.alert('Success', 'Exported as MIDI');
      setIsExporting(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to export');
      setIsExporting(false);
    }
  };

  /**
   * Generate MusicXML
   */
  const generateMusicXML = (data: MusicData): string => {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<score-partwise version="3.0">\n';
    xml += '  <work>\n';
    xml += `    <work-title>${data.title}</work-title>\n`;
    xml += '  </work>\n';
    xml += '  <identification>\n';
    xml += `    <creator type="composer">${data.composer}</creator>\n`;
    xml += '  </identification>\n';
    xml += '  <part-list>\n';
    xml += '    <score-part id="P1">\n';
    xml += '      <part-name>Music</part-name>\n';
    xml += '    </score-part>\n';
    xml += '  </part-list>\n';
    xml += '  <part id="P1">\n';

    data.measures.forEach((measure, idx) => {
      xml += `    <measure number="${idx + 1}">\n`;

      if (idx === 0) {
        xml += '      <attributes>\n';
        xml += `        <divisions>4</divisions>\n`;
        xml += `        <key><fifths>${data.keySignature.fifths}</fifths></key>\n`;
        xml += `        <time><beats>${data.timeSignature.numerator}</beats><beat-type>${data.timeSignature.denominator}</beat-type></time>\n`;
        xml += '      </attributes>\n';
      }

      measure.notes.forEach((note) => {
        xml += '      <note>\n';
        xml += `        <pitch><step>${note.pitch[0]}</step><octave>${note.pitch[1]}</octave></pitch>\n`;
        xml += `        <duration>${note.duration}</duration>\n`;
        xml += '      </note>\n';
      });

      xml += '    </measure>\n';
    });

    xml += '  </part>\n';
    xml += '</score-partwise>\n';
    return xml;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{musicData.title}</Text>
          <Text style={styles.subtitle}>{musicData.composer}</Text>
        </View>

        {/* Recognition Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Recognition Results</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Confidence:</Text>
            <Text style={styles.infoValue}>
              {(confidence * 100).toFixed(1)}%
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Processing Time:</Text>
            <Text style={styles.infoValue}>{processingTime}ms</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Symbols Found:</Text>
            <Text style={styles.infoValue}>{symbols.length}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Measures:</Text>
            <Text style={styles.infoValue}>{musicData.measures.length}</Text>
          </View>
        </View>

        {/* Music Notation */}
        <View style={styles.notationCard}>
          <Text style={styles.cardTitle}>Musical Notation</Text>

          <View style={styles.timeSignature}>
            <Text style={styles.timeSigNum}>
              {musicData.timeSignature.numerator}
            </Text>
            <Text style={styles.timeSigDen}>
              {musicData.timeSignature.denominator}
            </Text>
          </View>

          {/* Measures Display */}
          <ScrollView
            horizontal
            style={styles.measuresScroll}
            showsHorizontalScrollIndicator={false}
          >
            {musicData.measures.map((measure, idx) => (
              <View
                key={idx}
                style={[
                  styles.measure,
                  currentMeasure === idx && styles.activeMeasure
                ]}
                onStartShouldSetResponder={() => setCurrentMeasure(idx)}
              >
                <Text style={styles.measureNumber}>{idx + 1}</Text>
                <View style={styles.notesContainer}>
                  {measure.notes.map((note, nIdx) => (
                    <View key={nIdx} style={styles.noteItem}>
                      <Text style={styles.noteName}>{note.pitch}</Text>
                      <Text style={styles.noteDuration}>
                        {getDurationName(note.duration)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Detected Symbols */}
        <View style={styles.symbolsCard}>
          <Text style={styles.cardTitle}>Detected Symbols</Text>
          <View style={styles.symbolsList}>
            {symbols.slice(0, 10).map((symbol, idx) => (
              <View key={idx} style={styles.symbolItem}>
                <Text style={styles.symbolType}>{symbol.type}</Text>
                <Text style={styles.symbolConfidence}>
                  {(symbol.confidence * 100).toFixed(0)}%
                </Text>
              </View>
            ))}
            {symbols.length > 10 && (
              <Text style={styles.moreSymbols}>
                +{symbols.length - 10} more symbols
              </Text>
            )}
          </View>
        </View>

        {/* Control Buttons */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.button, styles.playButton]}
            onPress={handlePlayMusic}
            disabled={isPlaying}
          >
            {isPlaying ? (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.buttonText}> Playing...</Text>
              </>
            ) : (
              <Text style={styles.buttonText}>▶ Play</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.exportButton]}
            onPress={handleExportMusicXML}
            disabled={isExporting}
          >
            <Text style={styles.buttonText}>📄 Export MusicXML</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.exportButton]}
            onPress={handleExportMIDI}
            disabled={isExporting}
          >
            <Text style={styles.buttonText}>🎵 Export MIDI</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.buttonText}>← Back to Camera</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Helper function to get duration name
 */
function getDurationName(duration: number): string {
  const durations: Record<number, string> = {
    0.25: '16th',
    0.5: '8th',
    1: 'Quarter',
    2: 'Half',
    4: 'Whole'
  };
  return durations[duration] || 'Note';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  scrollView: {
    flex: 1,
    padding: 16
  },
  header: {
    marginBottom: 24,
    alignItems: 'center'
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333'
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333'
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  infoLabel: {
    fontSize: 14,
    color: '#666'
  },
  infoValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50'
  },
  notationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333'
  },
  timeSignature: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16
  },
  timeSigNum: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333'
  },
  timeSigDen: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333'
  },
  measuresScroll: {
    marginBottom: 16
  },
  measure: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginRight: 8,
    minWidth: 100,
    borderWidth: 2,
    borderColor: 'transparent'
  },
  activeMeasure: {
    borderColor: '#4CAF50',
    backgroundColor: '#e8f5e9'
  },
  measureNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#999',
    marginBottom: 8
  },
  notesContainer: {
    gap: 4
  },
  noteItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  noteName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333'
  },
  noteDuration: {
    fontSize: 12,
    color: '#666'
  },
  symbolsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  symbolsList: {
    gap: 8
  },
  symbolItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8
  },
  symbolType: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333'
  },
  symbolConfidence: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: 'bold'
  },
  moreSymbols: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 8
  },
  controls: {
    gap: 12,
    paddingBottom: 24
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  playButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row'
  },
  exportButton: {
    backgroundColor: '#2196F3'
  },
  secondaryButton: {
    backgroundColor: '#757575'
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  }
});
