// Tests for output formatting

import { describe, it, beforeEach, afterEach, vi, expect } from "vitest";
import { printComparison } from "../lib/formatter.js";

// Mock console to suppress logs during tests
let originalLog;
beforeEach(() => {
  originalLog = console.log;
  console.log = vi.fn();
});

afterEach(() => {
  console.log = originalLog;
});

describe("Formatter", () => {
  describe("printComparison", () => {
    it("should display nucleotide comparison without errors", () => {
      const result = {
        mask: "ATGATGATG",
        length: 9,
        identity: 1.0,
        mismatches: 0,
        offset1: 0,
        offset2: 0,
        conservedBlocks: [
          {
            start: 0,
            end: 9,
            sequence: "ATGATGATG",
            length: 9
          }
        ]
      };

      // Should not throw
      expect(() => {
        printComparison("Nucleotide", result);
      }).not.toThrow();
    });

    it("should display amino acid comparison with frames", () => {
      const result = {
        mask: "MKP",
        length: 3,
        identity: 1.0,
        mismatches: 0,
        offset1: 0,
        offset2: 0,
        frame1: 0,
        frame2: 0,
        conservedBlocks: [
          {
            start: 0,
            end: 3,
            sequence: "MKP",
            length: 3
          }
        ]
      };

      // Should not throw
      expect(() => {
        printComparison("Amino acid", result);
      }).not.toThrow();
    });

    it("should handle empty conserved blocks", () => {
      const result = {
        mask: "???",
        length: 3,
        identity: 0,
        mismatches: 3,
        offset1: 0,
        offset2: 0,
        conservedBlocks: []
      };

      // Should not throw
      expect(() => {
        printComparison("Nucleotide", result);
      }).not.toThrow();
    });

    it("should handle multiple conserved blocks", () => {
      const result = {
        mask: "ATG???CCC",
        length: 9,
        identity: 0.67,
        mismatches: 3,
        offset1: 0,
        offset2: 0,
        conservedBlocks: [
          { start: 0, end: 3, sequence: "ATG", length: 3 },
          { start: 6, end: 9, sequence: "CCC", length: 3 }
        ]
      };

      // Should not throw
      expect(() => {
        printComparison("Nucleotide", result);
      }).not.toThrow();
    });
  });
});
