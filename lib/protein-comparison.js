// Protein (amino acid) comparison utilities

import { adjustForReadingFrame } from "./reading-frame.js";
import { findConservedBlocks, compareSequenceRegions } from "./comparison.js";
import { AA_SEGMENT_WINDOW_LENGTH, CODON_SIZE } from "./constants.js";

// Compare amino acid sequences based on nucleotide alignment
// Detects conserved blocks directly on the amino acid sequence
// Automatically finds the best reading frame for comparison
export const compareProteins = (seq1, seq2, nucResult) => {
  // Find the best reading frame combination
  const { frame1, frame2, adjustedOffset1, adjustedOffset2, aa1, aa2 } = adjustForReadingFrame(seq1, seq2, nucResult);
  
  // Compare amino acids directly (same alignment as nucleotides)
  const length = Math.min(aa1.length, aa2.length);
  const { mask, mismatches, identity } = compareSequenceRegions(aa1, aa2, length);
  
  // Find conserved blocks directly on the amino acid sequence
  // Use smaller window size (20 AA instead of 60 bp) since proteins are 3x shorter
  const conservedBlocks = findConservedBlocks(mask, AA_SEGMENT_WINDOW_LENGTH);
  
  return {
    aa1,
    aa2,
    result: {
      mask,
      mismatches,
      length,
      identity,
      truncated: aa1.length !== aa2.length,
      offset1: Math.floor(adjustedOffset1 / CODON_SIZE),
      offset2: Math.floor(adjustedOffset2 / CODON_SIZE),
      frame1,
      frame2,
      conservedBlocks
    }
  };
};
