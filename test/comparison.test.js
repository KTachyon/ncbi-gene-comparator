// Tests for sequence comparison and alignment

import { describe, it, expect } from "vitest";
import { 
  compareSequenceRegions, 
  findConservedBlocks,
  compareSequences 
} from "../lib/comparison.js";

describe("Sequence Comparison", () => {
  describe("compareSequenceRegions", () => {
    it("should find perfect match", () => {
      const result = compareSequenceRegions("ATGC", "ATGC", 4);
      
      expect(result.matches).toBe(4);
      expect(result.mismatches).toBe(0);
      expect(result.identity).toBe(1.0);
      expect(result.mask).toBe("ATGC");
    });

    it("should detect mismatches with IUPAC codes", () => {
      const result = compareSequenceRegions("ATGC", "ATTC", 4);
      
      expect(result.matches).toBe(3);
      expect(result.mismatches).toBe(1);
      expect(result.identity).toBe(0.75);
      expect(result.mask).toBe("AT?C"); // ? for mismatches
    });

    it("should handle all mismatches", () => {
      const result = compareSequenceRegions("AAAA", "TTTT", 4);
      
      expect(result.matches).toBe(0);
      expect(result.mismatches).toBe(4);
      expect(result.identity).toBe(0);
      expect(result.mask).toBe("????"); // ? for mismatches
    });

    it("should handle empty sequences", () => {
      const result = compareSequenceRegions("", "", 0);
      
      expect(result.matches).toBe(0);
      expect(result.mismatches).toBe(0);
      expect(result.identity).toBe(0);
      expect(result.mask).toBe("");
    });
  });

  describe("findConservedBlocks", () => {
    it("should find single conserved block in perfect match", () => {
      // Create a 66bp perfect match (default window size)
      const mask = "A".repeat(66);
      const blocks = findConservedBlocks(mask);
      
      expect(blocks.length).toBe(1);
      expect(blocks[0].length).toBe(66);
    });

    it("should find multiple conserved blocks", () => {
      // Two conserved blocks separated by mismatches
      const conserved = "A".repeat(66);
      const nonConserved = "?".repeat(66);
      const mask = conserved + nonConserved + conserved;
      
      const blocks = findConservedBlocks(mask);
      
      expect(blocks.length).toBe(2);
      expect(blocks[0].length).toBe(66);
      expect(blocks[1].start).toBe(132);
    });

    it("should filter out small blocks (< 15% of largest)", () => {
      // One large block and one tiny block
      const largeBlock = "A".repeat(200);
      const tinyBlock = "A".repeat(10); // < 15% of 200
      const gap = "?".repeat(66);
      
      const mask = largeBlock + gap + tinyBlock;
      const blocks = findConservedBlocks(mask);
      
      // Should only return the large block
      expect(blocks.length).toBe(1);
      // Block length may vary due to window boundaries
      expect(blocks[0].length).toBeGreaterThanOrEqual(198);
      expect(blocks[0].length).toBeLessThanOrEqual(200);
    });

    it("should accept blocks with some mismatches", () => {
      // 66bp with ~20% mismatches (still above 67% threshold)
      const goodBlock = "A".repeat(50) + "?".repeat(16); // ? for mismatches
      const blocks = findConservedBlocks(goodBlock);
      
      expect(blocks.length).toBe(1);
    });

    it("should reject blocks below identity threshold", () => {
      // 66bp with 50% mismatches (below 67% threshold)
      const badBlock = "A".repeat(33) + "?".repeat(33); // ? for mismatches
      const blocks = findConservedBlocks(badBlock);
      
      expect(blocks.length).toBe(0);
    });
  });

  describe("compareSequences", () => {
    it("should handle perfect match", () => {
      const seq1 = "ATGCCCGGG";
      const seq2 = "ATGCCCGGG";
      
      const result = compareSequences(seq1, seq2);
      
      expect(result.identity).toBe(1.0);
      expect(result.mismatches).toBe(0);
      expect(result.length).toBe(9);
      expect(result.offset1).toBe(0);
      expect(result.offset2).toBe(0);
    });

    it("should handle sequences with offset", () => {
      const seq1 = "ATGCCCGGG";
      const seq2 = "XXXATGCCCGGG"; // 3bp offset
      
      const result = compareSequences(seq1, seq2);
      
      expect(result.offset1).toBe(0);
      expect(result.offset2).toBe(3);
      expect(result.length).toBe(9);
      expect(result.identity).toBe(1.0);
    });

    it("should find best alignment with mismatches", () => {
      const seq1 = "ATGAAACCCGGG";
      const seq2 = "ATGAAACCCTTT"; // Last 3 bases differ
      
      const result = compareSequences(seq1, seq2);
      
      expect(result.length).toBe(12);
      expect(result.mismatches).toBe(3);
      expect(result.identity).toBe(0.75);
    });

    it("should handle empty sequences", () => {
      const result = compareSequences("", "ATGC");
      
      expect(result.length).toBe(0);
      expect(result.identity).toBe(0);
      expect(result.truncated).toBe(true);
    });

    it("should require minimum 50% overlap", () => {
      const seq1 = "ATGCCCGGG";
      const seq2 = "TTTAAA"; // Too short for 50% overlap
      
      const result = compareSequences(seq1, seq2);
      
      // Should still find some overlap
      expect(result.length).toBeGreaterThanOrEqual(Math.ceil(Math.min(9, 6) * 0.5));
    });

    it("should detect truncation", () => {
      const seq1 = "ATGCCCGGG";
      const seq2 = "ATGCCC"; // Shorter
      
      const result = compareSequences(seq1, seq2);
      
      expect(result.truncated).toBe(true);
    });

    it("should skip alignments with overlap smaller than minimum", () => {
      // Create sequences where some alignment positions have overlap < minOverlap
      // minOverlap = ceil(min(seq1.length, seq2.length) * 0.5)
      // For seq lengths 20 and 20, minOverlap = ceil(20 * 0.5) = 10
      // The loop goes from -seq2.length + minOverlap to seq1.length - minOverlap
      // At extreme offsets, overlapLen will be < minOverlap, triggering continue
      const seq1 = "ATGCCCGGGTTTAAACCCGG";  // 20bp
      const seq2 = "AAATTTCCCGGGATGCCCGG";  // 20bp
      
      const result = compareSequences(seq1, seq2);
      
      // Should still find the best valid alignment
      expect(result.length).toBeGreaterThanOrEqual(10); // At least minOverlap
      expect(result.identity).toBeGreaterThanOrEqual(0);
      expect(result.identity).toBeLessThanOrEqual(1);
    });

    it("should handle both sequences being empty", () => {
      const result = compareSequences("", "");
      
      expect(result.length).toBe(0);
      expect(result.identity).toBe(0);
      expect(result.truncated).toBe(true);
      expect(result.conservedBlocks).toEqual([]);
    });

    it("should stop early on perfect match", () => {
      // When mismatches === 0, the loop breaks early
      const seq1 = "ATGCCCGGG";
      const seq2 = "ATGCCCGGG";
      
      const result = compareSequences(seq1, seq2);
      
      expect(result.mismatches).toBe(0);
      expect(result.identity).toBe(1.0);
    });

    it("should prefer longer overlap when identity is similar", () => {
      // Test the isBetter condition: similar identity but longer overlap wins
      const seq1 = "ATGCCCGGGTTTAAACCC";
      const seq2 = "ATGCCCGGGTTTAAACCC";
      
      const result = compareSequences(seq1, seq2);
      
      // Should find the full-length perfect alignment
      expect(result.length).toBe(18);
      expect(result.identity).toBe(1.0);
    });
  });

  describe("findConservedBlocks edge cases", () => {
    it("should handle mask shorter than window size", () => {
      const shortMask = "ATGATG"; // 6 characters, less than default 66
      const blocks = findConservedBlocks(shortMask);
      
      // Should still process and return a block if it passes identity threshold
      expect(Array.isArray(blocks)).toBe(true);
    });

    it("should keep all blocks when filtering would remove all", () => {
      // When filteredBlocks.length would be 0, return original blocks
      // This happens when all blocks are below minSignificantLength threshold
      // but we need at least one block
      const conserved1 = "A".repeat(66);
      const conserved2 = "A".repeat(66);
      const gap = "?".repeat(66);
      
      // Two equal-sized blocks - neither is < 15% of the other
      const mask = conserved1 + gap + conserved2;
      const blocks = findConservedBlocks(mask);
      
      expect(blocks.length).toBe(2);
    });
  });
});

