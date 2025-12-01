export const MAX_LINE_LENGTH = 120;
export const CODON_SIZE = 3; // Should never change
export const CODONS_PER_LINE = MAX_LINE_LENGTH / (CODON_SIZE + 1);

export const MIN_IDENTITY = 0.67;
export const MIN_SIGNIFICANT_LENGTH_GROUP = 0.15;
export const SEGMENT_WINDOW_LENGTH = 66;
export const AA_SEGMENT_WINDOW_LENGTH = SEGMENT_WINDOW_LENGTH / CODON_SIZE;
export const MIN_SEQUENCE_OVERLAP_PCT = 0.5;