// Sequence validation and normalization utilities

// Normalize sequence (uppercase, remove spaces)
export const normalizeSeq = (seq) => seq.toUpperCase().replace(/\s+/g, "");

// Validate DNA sequences (only exact bases allowed, no IUPAC ambiguity codes)
// IUPAC codes like N, R, Y, etc. should only appear in comparison OUTPUT
export const validateDNA = (seq) => {
  if (!/^[ACGT-]+$/.test(seq)) {
    throw new Error(`Invalid DNA sequence: "${seq}". Only exact bases (A, C, G, T) and gaps (-) allowed.`);
  }
};
