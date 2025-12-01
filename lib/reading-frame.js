// Reading frame utilities for maintaining proper codon alignment
//
// IMPORTANT: NCBI mRNA sequences (e.g., NM_*) are full transcripts that:
//   - Start at the 5' end of the mRNA (NOT at a codon boundary)
//   - Include 5' UTR before the coding sequence (CDS)
//   - Have the CDS starting at an ATG start codon somewhere in the sequence
//   - Include 3' UTR after the stop codon
//
// This means:
//   1. Sequences don't start at codon boundaries
//   2. Nucleotide alignments may not preserve reading frames
//   3. We must try all reading frame combinations to find the correct protein alignment

import { translateDNA } from "./translation.js";
import { compareSequenceRegions } from "./comparison.js";
import { CODON_SIZE, AA_SEGMENT_WINDOW_LENGTH } from "./constants.js";

// Find the position of the first start codon (ATG) in a sequence
// Note: This finds the first ATG, which may or may not be the actual CDS start
// For more accuracy, CDS annotations would need to be parsed from GenBank format
const findStartCodon = (seq) => {
  const index = seq.indexOf("ATG");
  return index >= 0 ? index : null;
};

// Try all 9 possible reading frame combinations and return the best one
// This ensures we're comparing proteins in the correct frame
const findBestReadingFrame = (seq1, seq2, offset1, offset2, length) => {
  let bestFrame1 = 0;
  let bestFrame2 = 0;
  let bestIdentity = 0;
  let bestAA1 = "";
  let bestAA2 = "";
  
  // Try all 3 reading frames for each sequence
  for (let frame1 = 0; frame1 < CODON_SIZE; frame1++) {
    for (let frame2 = 0; frame2 < CODON_SIZE; frame2++) {
      // Extract aligned region with frame offset
      const start1 = offset1 + frame1;
      const start2 = offset2 + frame2;
      const adjustedLen = Math.min(length - frame1, length - frame2);
      
      if (adjustedLen < AA_SEGMENT_WINDOW_LENGTH) continue;
      
      const region1 = seq1.slice(start1, start1 + adjustedLen);
      const region2 = seq2.slice(start2, start2 + adjustedLen);
      
      // Translate both regions
      const aa1 = translateDNA(region1);
      const aa2 = translateDNA(region2);
      
      // Calculate amino acid identity
      const minLen = Math.min(aa1.length, aa2.length);
      const { identity } = compareSequenceRegions(aa1, aa2, minLen);
      
      // Keep track of best frame combination
      if (identity > bestIdentity) {
        bestIdentity = identity;
        bestFrame1 = frame1;
        bestFrame2 = frame2;
        bestAA1 = aa1;
        bestAA2 = aa2;
      }
    }
  }
  
  return {
    frame1: bestFrame1,
    frame2: bestFrame2,
    identity: bestIdentity,
    aa1: bestAA1,
    aa2: bestAA2,
    adjustedOffset1: offset1 + bestFrame1,
    adjustedOffset2: offset2 + bestFrame2
  };
};

// Adjust alignment to maintain reading frame based on start codons
export const adjustForReadingFrame = (seq1, seq2, nucResult) => {
  console.log(`\n📍 Reading Frame Detection:`);
  console.log(`   Note: mRNA sequences include 5' UTR, so they don't start at codon boundaries`);
  
  // First, try to find start codons in both sequences
  const start1 = findStartCodon(seq1);
  const start2 = findStartCodon(seq2);
  
  // If both sequences have start codons, we can use them to determine the frame
  if (start1 !== null && start2 !== null) {
    console.log(`   Found start codons: seq1 at position ${start1}, seq2 at position ${start2}`);
    
    // Calculate which reading frame each aligned region is in
    const frame1 = ((nucResult.offset1 - start1) % CODON_SIZE + CODON_SIZE) % CODON_SIZE;
    const frame2 = ((nucResult.offset2 - start2) % CODON_SIZE + CODON_SIZE) % CODON_SIZE;
    
    console.log(`   Alignment offset: seq1[${nucResult.offset1}], seq2[${nucResult.offset2}]`);
    console.log(`   Inferred frames relative to CDS: seq1 +${frame1}, seq2 +${frame2}`);
    
    // If frames don't match, we need to adjust
    if (frame1 !== frame2) {
      console.log(`   ⚠️  Nucleotide alignment broke the reading frame!`);
      console.log(`   Searching all 9 frame combinations for best protein alignment...`);
    }
  } else {
    console.log(`   Start codon not found in one or both sequences`);
    console.log(`   Trying all 9 reading frame combinations...`);
  }
  
  // Try all reading frame combinations to find the best one
  const bestFrame = findBestReadingFrame(
    seq1,
    seq2,
    nucResult.offset1,
    nucResult.offset2,
    nucResult.length
  );
  
  console.log(`   ✓ Best protein alignment: seq1 +${bestFrame.frame1}, seq2 +${bestFrame.frame2}`);
  
  return bestFrame;
};
