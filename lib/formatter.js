// Output formatting utilities

import { CODON_SIZE, CODONS_PER_LINE } from "./constants.js";

// Format sequence in groups of 3 with line wrapping, highlight mismatches
const formatSequence = (seq, groupSize = CODON_SIZE, groupsPerLine = CODONS_PER_LINE) => {
  const groups = [];
  for (let i = 0; i < seq.length; i += groupSize) {
    const group = seq.slice(i, i + groupSize);
    // Highlight mismatches (?) with inverted colors
    const highlighted = group.split('').map(char => {
      if (char === '?') {
        return `\x1b[7m${char}\x1b[0m`; // ANSI reverse video
      }
      return char;
    }).join('');
    groups.push(highlighted);
  }
  
  const lines = [];
  for (let i = 0; i < groups.length; i += groupsPerLine) {
    lines.push(groups.slice(i, i + groupsPerLine).join(" "));
  }
  
  return lines.join("\n");
};

// Print comparison results in a formatted way
export const printComparison = (label, result) => {
  console.log(`\n=== ${label} comparison ===`);
  
  // Show reading frame info for amino acid comparisons
  if (result.frame1 !== undefined && result.frame2 !== undefined) {
    console.log(`Reading frames: seq1 +${result.frame1}, seq2 +${result.frame2}`);
  }
  
  // Show conserved blocks if they exist
  if (result.conservedBlocks && result.conservedBlocks.length > 0) {
    result.conservedBlocks.forEach((block, idx) => {
      const blockMismatches = (block.sequence.match(/\?/g) || []).length;
      const blockIdentity = 1 - blockMismatches / block.length;
      const unit = label.includes("acid") ? "AA" : "bp";
      console.log(`\nBlock ${idx + 1} [${block.start}:${block.end}] - ${block.length} ${unit}, ${(100 * blockIdentity).toFixed(1)}% identity:`);
      console.log(formatSequence(block.sequence));
    });
  } else {
    console.log("\nNo well-conserved blocks found (sequences may be too divergent).");
    console.log("\nFull alignment mask (matches shown, ? for mismatches):");
    console.log(formatSequence(result.mask));
  }
};
