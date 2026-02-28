export interface NoteDraft {
  id: string;
  plaintext: string;
  updatedAt: string;
}

export function createNoteDraft(plaintext: string): NoteDraft {
  const trimmed = plaintext.trim();

  if (!trimmed) {
    throw new Error('Note cannot be empty');
  }

  return {
    id: `note_${Date.now()}`,
    plaintext: trimmed,
    updatedAt: new Date().toISOString(),
  };
}

export function bucketNoteLength(length: number): '1_50' | '51_140' | '141_280' | '281_plus' {
  if (length <= 50) {
    return '1_50';
  }
  if (length <= 140) {
    return '51_140';
  }
  if (length <= 280) {
    return '141_280';
  }
  return '281_plus';
}
