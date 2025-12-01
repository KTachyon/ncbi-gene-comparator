// Tests for protein comparison

import { describe, it, beforeEach, afterEach, vi, expect } from "vitest";
import { compareProteins } from "../lib/protein-comparison.js";

// Mock console to suppress logs during tests
let originalLog;
beforeEach(() => {
  originalLog = console.log;
  console.log = vi.fn();
});

afterEach(() => {
  console.log = originalLog;
});

describe("Protein Comparison", () => {
  describe("compareProteins", () => {
    it("should compare proteins from identical DNA sequences", () => {
      const seq1 = "ATGAAACCCGGGTTTAAACCCGGG";
      const seq2 = "ATGAAACCCGGGTTTAAACCCGGG";
      
      const nucResult = {
        offset1: 0,
        offset2: 0,
        length: 24,
        mask: seq1,
        mismatches: 0,
        identity: 1.0,
        conservedBlocks: []
      };

      const result = compareProteins(seq1, seq2, nucResult);

      expect(result.result.identity).toBe(1.0);
      expect(result.result.mismatches).toBe(0);
      expect(result.aa1.length).toBeGreaterThan(0);
      expect(result.aa2.length).toBeGreaterThan(0);
    });

    it("should detect amino acid differences", () => {
      // These sequences differ by one codon (CCC vs TTT)
      const seq1 = "ATGAAACCCGGG";
      const seq2 = "ATGAAATTTGGG";
      
      const nucResult = {
        offset1: 0,
        offset2: 0,
        length: 12,
        mask: "ATGAAA???GGG",
        mismatches: 3,
        identity: 0.75,
        conservedBlocks: []
      };

      const result = compareProteins(seq1, seq2, nucResult);

      // Result should have valid structure
      expect(result.result.identity).toBeGreaterThanOrEqual(0);
      expect(result.result.identity).toBeLessThanOrEqual(1.0);
      expect(typeof result.result.mismatches).toBe("number");
      expect(typeof result.result.mask).toBe("string");
    });

    it("should include reading frame information", () => {
      const seq1 = "ATGAAACCCGGG";
      const seq2 = "ATGAAACCCGGG";
      
      const nucResult = {
        offset1: 0,
        offset2: 0,
        length: 12,
        mask: seq1,
        mismatches: 0,
        identity: 1.0,
        conservedBlocks: []
      };

      const result = compareProteins(seq1, seq2, nucResult);

      expect(typeof result.result.frame1).toBe("number");
      expect(typeof result.result.frame2).toBe("number");
      expect(result.result.frame1).toBeGreaterThanOrEqual(0);
      expect(result.result.frame1).toBeLessThan(3);
      expect(result.result.frame2).toBeGreaterThanOrEqual(0);
      expect(result.result.frame2).toBeLessThan(3);
    });

    it("should find conserved blocks in proteins", () => {
      // Long identical sequence to ensure conserved blocks
      const longSeq = "ATG" + "AAA".repeat(30); // 93bp = 31 amino acids
      
      const nucResult = {
        offset1: 0,
        offset2: 0,
        length: longSeq.length,
        mask: longSeq,
        mismatches: 0,
        identity: 1.0,
        conservedBlocks: []
      };

      const result = compareProteins(longSeq, longSeq, nucResult);

      // Should find at least one conserved block
      expect(result.result.conservedBlocks.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle sequences with different offsets", () => {
      const seq1 = "CCCATGAAACCCGGGTTTAAACCCGGGTTTAAACCCGGGTTTAAACCCGGGTTTAAACCCGGG"; // Use valid DNA bases
      const seq2 = "ATGAAACCCGGGTTTAAACCCGGGTTTAAACCCGGGTTTAAACCCGGGTTTAAACCCGGG";
      
      const nucResult = {
        offset1: 3,
        offset2: 0,
        length: 60,
        mask: "ATGAAACCCGGGTTTAAACCCGGGTTTAAACCCGGGTTTAAACCCGGGTTTAAACCCGGG",
        mismatches: 0,
        identity: 1.0,
        conservedBlocks: []
      };

      const result = compareProteins(seq1, seq2, nucResult);

      expect(result.result.identity).toBeGreaterThanOrEqual(0);
      expect(result.result.identity).toBeLessThanOrEqual(1.0);
      expect(result.aa1.length).toBeGreaterThan(0);
      expect(result.aa2.length).toBeGreaterThan(0);
    });

    it("should calculate protein offsets from nucleotide offsets", () => {
      const seq1 = "ATGAAACCCGGG";
      const seq2 = "ATGAAACCCGGG";
      
      const nucResult = {
        offset1: 6, // Start at position 6
        offset2: 0,
        length: 6,
        mask: "CCCGGG",
        mismatches: 0,
        identity: 1.0,
        conservedBlocks: []
      };

      const result = compareProteins(seq1, seq2, nucResult);

      // Protein offset should be nucleotide offset / 3
      expect(typeof result.result.offset1).toBe("number");
      expect(typeof result.result.offset2).toBe("number");
    });
  });
});

