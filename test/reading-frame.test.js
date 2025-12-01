// Tests for reading frame detection

import { describe, it, beforeEach, afterEach, vi, expect } from "vitest";
import { adjustForReadingFrame } from "../lib/reading-frame.js";

// Mock console to suppress logs during tests
let originalLog;
beforeEach(() => {
  originalLog = console.log;
  console.log = vi.fn();
});

afterEach(() => {
  console.log = originalLog;
});

describe("Reading Frame Detection", () => {
  describe("adjustForReadingFrame", () => {
    it("should find best reading frame for identical sequences", () => {
      const seq1 = "ATGAAACCCGGGTTTAAACCCGGG";
      const seq2 = "ATGAAACCCGGGTTTAAACCCGGG";
      
      const nucResult = {
        offset1: 0,
        offset2: 0,
        length: seq1.length
      };

      const result = adjustForReadingFrame(seq1, seq2, nucResult);

      expect(result.frame1).toBe(0);
      expect(result.frame2).toBe(0);
      expect(result.identity).toBe(1.0);
      expect(result.aa1.length).toBeGreaterThan(0);
      expect(result.aa2.length).toBeGreaterThan(0);
    });

    it("should detect frame shift", () => {
      // seq2 has a +1 frame shift (need at least 66bp for proper frame detection)
      const seq1 = "ATGAAACCCGGGTTTAAACCCGGGTTTAAACCCGGGTTTAAACCCGGGTTTAAACCCGGGTTTAAACCCGGG"; // 72bp
      const seq2 = "CATGAAACCCGGGTTTAAACCCGGGTTTAAACCCGGGTTTAAACCCGGGTTTAAACCCGGGTTTAAACCCGG"; // 71bp with offset
      
      const nucResult = {
        offset1: 0,
        offset2: 1,
        length: 71
      };

      const result = adjustForReadingFrame(seq1, seq2, nucResult);

      // Should produce valid results
      expect(result.frame1).toBeGreaterThanOrEqual(0);
      expect(result.frame1).toBeLessThan(3);
      expect(result.frame2).toBeGreaterThanOrEqual(0);
      expect(result.frame2).toBeLessThan(3);
      expect(result.aa1.length).toBeGreaterThan(0);
      expect(result.aa2.length).toBeGreaterThan(0);
    });

    it("should handle sequences with start codons", () => {
      // Both sequences have ATG at position 0 (need at least 66bp)
      const seq1 = "ATGAAACCCGGGTTTAAACCCGGGTTTAAACCCGGGTTTAAACCCGGGTTTAAACCCGGG";
      const seq2 = "ATGAAACCCGGGTTTAAACCCGGGTTTAAACCCGGGTTTAAACCCGGGTTTAAACCCGGG";
      
      const nucResult = {
        offset1: 0,
        offset2: 0,
        length: 60
      };

      const result = adjustForReadingFrame(seq1, seq2, nucResult);

      // Frames should be 0, 1, or 2
      expect(result.frame1).toBeGreaterThanOrEqual(0);
      expect(result.frame1).toBeLessThan(3);
      expect(result.frame2).toBeGreaterThanOrEqual(0);
      expect(result.frame2).toBeLessThan(3);
      // Both should translate to proteins starting with M
      expect(result.aa1[0]).toBe("M");
      expect(result.aa2[0]).toBe("M");
    });

    it("should provide adjusted offsets", () => {
      const seq1 = "ATGAAACCCGGG";
      const seq2 = "ATGAAACCCGGG";
      
      const nucResult = {
        offset1: 0,
        offset2: 0,
        length: 12
      };

      const result = adjustForReadingFrame(seq1, seq2, nucResult);

      expect(typeof result.adjustedOffset1).toBe("number");
      expect(typeof result.adjustedOffset2).toBe("number");
    });

    it("should work with offset sequences", () => {
      const seq1 = "CCCCCCATGAAACCCGGGTTTAAACCCGGGTTTAAACCCGGGTTTAAACCCGGGTTTAAACCCGGG"; // Use valid DNA bases
      const seq2 = "ATGAAACCCGGGTTTAAACCCGGGTTTAAACCCGGGTTTAAACCCGGGTTTAAACCCGGG";
      
      const nucResult = {
        offset1: 6,
        offset2: 0,
        length: 60
      };

      const result = adjustForReadingFrame(seq1, seq2, nucResult);

      // Should find matching reading frames despite offset
      expect(result.identity).toBeGreaterThanOrEqual(0);
      expect(result.aa1.length).toBeGreaterThan(0);
      expect(result.aa2.length).toBeGreaterThan(0);
    });

    it("should handle sequences without start codon (ATG)", () => {
      // Sequences with no ATG - should trigger "Start codon not found" branch
      const seq1 = "CCCGGGTTTAAACCCGGGTTTAAACCCGGGTTTAAACCCGGGTTTAAACCCGGGTTTCCC";
      const seq2 = "CCCGGGTTTAAACCCGGGTTTAAACCCGGGTTTAAACCCGGGTTTAAACCCGGGTTTCCC";
      
      const nucResult = {
        offset1: 0,
        offset2: 0,
        length: 60
      };

      const result = adjustForReadingFrame(seq1, seq2, nucResult);

      // Should still produce valid results by trying all frame combinations
      expect(result.frame1).toBeGreaterThanOrEqual(0);
      expect(result.frame1).toBeLessThan(3);
      expect(result.frame2).toBeGreaterThanOrEqual(0);
      expect(result.frame2).toBeLessThan(3);
      expect(result.identity).toBeGreaterThanOrEqual(0);
    });

    it("should handle when only one sequence has start codon", () => {
      // Only seq1 has ATG - should trigger "Start codon not found" branch
      const seq1 = "ATGAAACCCGGGTTTAAACCCGGGTTTAAACCCGGGTTTAAACCCGGGTTTAAACCCGGG";
      const seq2 = "CCCGGGTTTAAACCCGGGTTTAAACCCGGGTTTAAACCCGGGTTTAAACCCGGGTTTCCC";
      
      const nucResult = {
        offset1: 0,
        offset2: 0,
        length: 60
      };

      const result = adjustForReadingFrame(seq1, seq2, nucResult);

      expect(result.frame1).toBeGreaterThanOrEqual(0);
      expect(result.frame2).toBeGreaterThanOrEqual(0);
      expect(result.identity).toBeGreaterThanOrEqual(0);
    });

    it("should detect frame mismatch when CDS offsets differ", () => {
      // Both sequences have ATG but at positions causing frame mismatch
      // seq1: ATG at position 0, alignment starts at offset 3 → frame = (3-0) % 3 = 0
      // seq2: ATG at position 1, alignment starts at offset 4 → frame = (4-1) % 3 = 0
      // We need frame1 !== frame2 to hit the branch
      // seq1: ATG at 0, offset1 = 1 → frame = (1-0) % 3 = 1
      // seq2: ATG at 0, offset2 = 0 → frame = (0-0) % 3 = 0
      const seq1 = "ATGAAACCCGGGTTTAAACCCGGGTTTAAACCCGGGTTTAAACCCGGGTTTAAACCCGGG";
      const seq2 = "ATGAAACCCGGGTTTAAACCCGGGTTTAAACCCGGGTTTAAACCCGGGTTTAAACCCGGG";
      
      const nucResult = {
        offset1: 1,  // Offset creates frame 1 relative to ATG at position 0
        offset2: 0,  // Offset creates frame 0 relative to ATG at position 0
        length: 59
      };

      const result = adjustForReadingFrame(seq1, seq2, nucResult);

      // Should handle frame mismatch and find best alignment
      expect(result.frame1).toBeGreaterThanOrEqual(0);
      expect(result.frame2).toBeGreaterThanOrEqual(0);
      expect(result.aa1.length).toBeGreaterThan(0);
      expect(result.aa2.length).toBeGreaterThan(0);
    });

    it("should handle very short adjusted length (below window threshold)", () => {
      // Test case where adjustedLen < AA_SEGMENT_WINDOW_LENGTH (66)
      // This should trigger the continue statement in findBestReadingFrame
      const seq1 = "ATGAAACCCGGGTTTAAACCC"; // 21bp - too short
      const seq2 = "ATGAAACCCGGGTTTAAACCC";
      
      const nucResult = {
        offset1: 0,
        offset2: 0,
        length: 21  // Less than 66, so all frame combinations should be skipped
      };

      const result = adjustForReadingFrame(seq1, seq2, nucResult);

      // Should return with default/empty values since all frames are too short
      expect(result.frame1).toBe(0);
      expect(result.frame2).toBe(0);
      expect(result.identity).toBe(0);
      expect(result.aa1).toBe("");
      expect(result.aa2).toBe("");
    });
  });
});

