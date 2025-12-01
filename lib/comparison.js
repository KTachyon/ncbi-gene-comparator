// Sequence comparison and alignment utilities

import {
  SEGMENT_WINDOW_LENGTH,
  MIN_IDENTITY,
  MIN_SIGNIFICANT_LENGTH_GROUP,
  MIN_SEQUENCE_OVERLAP_PCT
} from "./constants.js";

// Compare two sequences character-by-character
// Returns { matches, mismatches, identity, mask }
export const compareSequenceRegions = (seq1, seq2, length) => {
  let mismatches = 0;
  let mask = "";
  
  for (let i = 0; i < length; i++) {
    if (seq1[i] === seq2[i]) {
      mask += seq1[i];
    } else {
      mask += "?";
      mismatches++;
    }
  }
  
  return {
    matches: length - mismatches,
    mismatches,
    identity: length > 0 ? (1 - mismatches / length) : 0,
    mask
  };
};

// Filter out poorly aligned regions and keep only conserved blocks
export const findConservedBlocks = (mask, windowSize = SEGMENT_WINDOW_LENGTH, minIdentity = MIN_IDENTITY) => {
  const blocks = [];
  let currentBlock = "";
  let blockStart = 0;
  let inBlock = false;
  
  // Helper to save current block
  const saveBlock = () => {
    if (currentBlock.length > 0) {
      blocks.push({
        start: blockStart,
        end: blockStart + currentBlock.length,
        sequence: currentBlock,
        length: currentBlock.length
      });
      currentBlock = "";
      inBlock = false;
    }
  };
  
  for (let i = 0; i < mask.length; i += windowSize) {
    const window = mask.slice(i, i + windowSize);
    const mismatches = (window.match(/\?/g) || []).length;
    const identity = 1 - mismatches / window.length;
    
    if (identity >= minIdentity) {
      if (!inBlock) {
        blockStart = i;
        inBlock = true;
      }
      currentBlock += window;
    } else {
      saveBlock();
    }
  }
  
  // Save final block if exists
  saveBlock();
  
  // Filter out small blocks that are less than 15% the size of the largest block
  // This removes noise and artifacts, keeping only substantial conserved regions
  if (blocks.length > 1) {
    const maxLength = Math.max(...blocks.map(b => b.length));
    const minSignificantLength = maxLength * MIN_SIGNIFICANT_LENGTH_GROUP;
    
    const filteredBlocks = blocks.filter(b => b.length >= minSignificantLength);
    
    // Only apply filter if we still have at least one block
    if (filteredBlocks.length > 0) {
      return filteredBlocks;
    }
  }
  
  return blocks;
};

// Compare two sequences (string) character by character
// Finds best alignment allowing both sequences to have offsets
// Requires at least 50% overlap of the shorter sequence
export const compareSequences = (seq1, seq2) => {
  if (seq1.length === 0 || seq2.length === 0) {
    return {
      mask: "",
      mismatches: 0,
      length: 0,
      identity: 0,
      truncated: true,
      offset1: 0,
      offset2: 0,
      conservedBlocks: []
    };
  }
  
  const minOverlap = Math.ceil(Math.min(seq1.length, seq2.length) * MIN_SEQUENCE_OVERLAP_PCT);
  
  let bestOffset1 = 0;
  let bestOffset2 = 0;
  let bestIdentity = 0;
  let bestMask = "";
  let bestOverlapLen = 0;
  let bestMismatches = Infinity;
  
  // Try all possible alignments
  // offset represents the starting position of seq2 relative to seq1
  // Negative offset: seq2 starts before seq1
  // Positive offset: seq2 starts after seq1
  
  for (let offset = -seq2.length + minOverlap; offset <= seq1.length - minOverlap; offset++) {
    // Calculate overlap region
    const start1 = Math.max(0, offset);
    const start2 = Math.max(0, -offset);
    const overlapLen = Math.min(seq1.length - start1, seq2.length - start2);
    
    // Skip if overlap is too small
    if (overlapLen < minOverlap) {
      continue;
    }
    
    // Compare the overlapping regions
    const comparison = compareSequenceRegions(
      seq1.slice(start1, start1 + overlapLen),
      seq2.slice(start2, start2 + overlapLen),
      overlapLen
    );
    const { mismatches, identity, mask } = comparison;
    
    // Keep track of best alignment
    // Prioritize: 1) Better identity, 2) Longer overlap, 3) Fewer mismatches
    const isBetter = 
      identity > bestIdentity + 0.01 || // Significantly better identity
      (Math.abs(identity - bestIdentity) < 0.01 && overlapLen > bestOverlapLen); // Similar identity but longer
    
    if (isBetter) {
      bestIdentity = identity;
      bestMismatches = mismatches;
      bestMask = mask;
      bestOffset1 = start1;
      bestOffset2 = start2;
      bestOverlapLen = overlapLen;
    }
    
    // Perfect match found, no need to continue
    if (mismatches === 0) {
      break;
    }
  }

  // Filter to find conserved blocks
  const conservedBlocks = findConservedBlocks(bestMask);

  return {
    mask: bestMask,
    mismatches: bestMismatches,
    length: bestOverlapLen,
    identity: bestIdentity,
    truncated: seq1.length !== seq2.length || bestOffset1 !== 0 || bestOffset2 !== 0,
    offset1: bestOffset1,
    offset2: bestOffset2,
    conservedBlocks: conservedBlocks
  };
};
