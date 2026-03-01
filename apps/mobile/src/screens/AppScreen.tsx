import { bucketNoteLength } from '@vault/core';
import { trackEvent } from '@vault/telemetry';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { AuthSession } from '../services/auth';
import { requestOtp, verifyOtp } from '../services/auth';
import {
  clearSession,
  persistSession,
  restoreSession,
} from '../services/security';
import {
  addNote,
  deleteNote,
  listNotes,
  wipeNotesVault,
} from '../services/storage';
import type { NoteDraft } from '@vault/core';

function getErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Something went wrong.';
  }

  switch (error.message) {
    case 'INVALID_OTP':
      return 'The OTP is invalid.';
    case 'OTP_EXPIRED':
      return 'The OTP has expired. Request a new one.';
    case 'Network request failed':
      return 'The control-plane service is unavailable.';
    case 'SECURE_STORAGE_UNAVAILABLE':
      return 'Secure storage is unavailable on this device.';
    default:
      return 'Request failed. Please try again.';
  }
}

export function AppScreen() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [session, setSession] = useState<AuthSession | null>(null);
  const [notes, setNotes] = useState<NoteDraft[]>([]);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function restoreStoredSession() {
      try {
        const storedSession = await restoreSession();
        if (!isMounted) {
          return;
        }

        setSession(storedSession);
        await trackEvent('auth_session_restored', {
          restored: Boolean(storedSession),
        });
      } catch {
        if (isMounted) {
          setMessage('Unable to restore a previous session.');
        }
      } finally {
        if (isMounted) {
          setIsRestoring(false);
        }
      }
    }

    void restoreStoredSession();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadStoredNotes() {
      if (!session) {
        setNotes([]);
        return;
      }

      setIsLoadingNotes(true);

      try {
        const storedNotes = await listNotes();
        if (isMounted) {
          setNotes(storedNotes);
        }
      } catch (error) {
        if (isMounted) {
          setMessage(getErrorMessage(error));
        }
      } finally {
        if (isMounted) {
          setIsLoadingNotes(false);
        }
      }
    }

    void loadStoredNotes();

    return () => {
      isMounted = false;
    };
  }, [session]);

  async function handleRequestOtp() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setMessage('Enter an email address first.');
      return;
    }

    setIsRequestingOtp(true);
    setMessage(null);

    try {
      await requestOtp(normalizedEmail);
      await trackEvent('auth_otp_requested', {
        channel: 'email_otp',
      });
      setMessage('OTP requested. Check the control-plane console in development.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsRequestingOtp(false);
    }
  }

  async function handleVerifyOtp() {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedOtp = otp.trim();

    if (!normalizedEmail || normalizedOtp.length !== 6) {
      setMessage('Enter a valid email and 6-digit OTP.');
      return;
    }

    setIsVerifyingOtp(true);
    setMessage(null);

    try {
      const nextSession = await verifyOtp(normalizedEmail, normalizedOtp);
      await persistSession(nextSession);
      await trackEvent('auth_otp_verified', {
        success: true,
      });
      setSession(nextSession);
      setOtp('');
      setMessage('Signed in successfully.');
    } catch (error) {
      await trackEvent('auth_otp_verified', {
        success: false,
      });
      setMessage(getErrorMessage(error));
    } finally {
      setIsVerifyingOtp(false);
    }
  }

  async function handleAddNote() {
    if (!noteBody.trim()) {
      setMessage('Enter note text before saving.');
      return;
    }

    setIsSavingNote(true);
    setMessage(null);

    try {
      const nextNote = await addNote(noteBody);
      setNotes(previous => [nextNote, ...previous]);
      setNoteBody('');
      await trackEvent('note_created', {
        lengthBucket: bucketNoteLength(nextNote.plaintext.length),
      });
      setMessage('Note saved.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsSavingNote(false);
    }
  }

  async function handleDeleteNote(noteId: string) {
    try {
      const nextNotes = await deleteNote(noteId);
      setNotes(nextNotes);
      setMessage('Note deleted.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function handleLogout() {
    try {
      await clearSession();
      await wipeNotesVault();
      await trackEvent('auth_logged_out', {});
    } finally {
      setSession(null);
      setOtp('');
      setNoteBody('');
      setNotes([]);
      setMessage('Signed out and vault wiped.');
    }
  }

  if (isRestoring) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="small" color="#1f2937" />
        <Text style={styles.statusText}>Restoring session...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Vault Notes</Text>
      <Text style={styles.statusText}>
        Status: {session ? 'Logged in' : 'Logged out'}
      </Text>

      {session ? (
        <>
          <Text style={styles.helperText}>
            Hashed user id: {session.userIdHash.slice(0, 12)}...
          </Text>
          <TextInput
            multiline
            onChangeText={setNoteBody}
            placeholder="Write a private note"
            placeholderTextColor="#9ca3af"
            style={[styles.input, styles.noteInput]}
            textAlignVertical="top"
            value={noteBody}
          />
          <Pressable
            disabled={isSavingNote}
            onPress={handleAddNote}
            style={[styles.primaryButton, isSavingNote && styles.disabledButton]}
          >
            <Text style={styles.primaryButtonText}>
              {isSavingNote ? 'Saving...' : 'Add Note'}
            </Text>
          </Pressable>
          {isLoadingNotes ? (
            <ActivityIndicator size="small" color="#1f2937" />
          ) : notes.length === 0 ? (
            <Text style={styles.helperText}>No notes saved yet.</Text>
          ) : (
            <View style={styles.notesList}>
              {notes.map(note => (
                <View key={note.id} style={styles.noteCard}>
                  <Text style={styles.noteText}>{note.plaintext}</Text>
                  <Text style={styles.noteMeta}>{note.updatedAt}</Text>
                  <Pressable onPress={() => void handleDeleteNote(note.id)}>
                    <Text style={styles.deleteText}>Delete</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
          <Pressable style={styles.primaryButton} onPress={handleLogout}>
            <Text style={styles.primaryButtonText}>Logout</Text>
          </Pressable>
        </>
      ) : (
        <>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor="#9ca3af"
            style={styles.input}
            value={email}
          />
          <Pressable
            disabled={isRequestingOtp}
            onPress={handleRequestOtp}
            style={[styles.primaryButton, isRequestingOtp && styles.disabledButton]}
          >
            <Text style={styles.primaryButtonText}>
              {isRequestingOtp ? 'Requesting...' : 'Request OTP'}
            </Text>
          </Pressable>
          <TextInput
            autoCapitalize="none"
            keyboardType="number-pad"
            maxLength={6}
            onChangeText={setOtp}
            placeholder="OTP"
            placeholderTextColor="#9ca3af"
            style={styles.input}
            value={otp}
          />
          <Pressable
            disabled={isVerifyingOtp}
            onPress={handleVerifyOtp}
            style={[styles.primaryButton, isVerifyingOtp && styles.disabledButton]}
          >
            <Text style={styles.primaryButtonText}>
              {isVerifyingOtp ? 'Verifying...' : 'Verify OTP'}
            </Text>
          </Pressable>
        </>
      )}

      {message ? <Text style={styles.helperText}>{message}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: '#ffffff',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  statusText: {
    fontSize: 16,
    color: '#1f2937',
  },
  helperText: {
    color: '#4b5563',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#111827',
  },
  noteInput: {
    minHeight: 110,
  },
  notesList: {
    gap: 12,
  },
  noteCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    gap: 8,
    backgroundColor: '#f9fafb',
  },
  noteText: {
    color: '#111827',
  },
  noteMeta: {
    color: '#6b7280',
    fontSize: 12,
  },
  deleteText: {
    color: '#b91c1c',
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
});
