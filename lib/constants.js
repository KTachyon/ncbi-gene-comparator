export const MAX_LINE_LENGTH = 120;
export const CODONS_PER_LINE = MAX_LINE_LENGTH / 4; // 3nb + 1 space

// Comparison algorithm constants
export const SEGMENT_WINDOW_LENGTH = 66;
export const MIN_IDENTITY = 0.67;
export const MIN_SIGNIFICANT_LENGTH_GROUP = 0.15;
export const MIN_SEQUENCE_OVERLAP_PCT = 0.5;
export const CODON_SIZE = 3;
export const AA_SEGMENT_WINDOW_LENGTH = SEGMENT_WINDOW_LENGTH / CODON_SIZE;
