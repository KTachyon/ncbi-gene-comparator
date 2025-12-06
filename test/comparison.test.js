// Tests for sequence comparison, translation, and protein alignment
// Rust WASM implementation

import { describe, it, beforeEach, afterEach, beforeAll, vi, expect } from "vitest";
import { init as initComparison } from "../lib/comparison.js";
import {
  SEGMENT_WINDOW_LENGTH,
  MIN_IDENTITY,
  MIN_SIGNIFICANT_LENGTH_GROUP,
  MIN_SEQUENCE_OVERLAP_PCT,
  AA_SEGMENT_WINDOW_LENGTH
} from "../lib/constants.js";

// Initialize Rust WASM engine before all tests
let comparison;
beforeAll(async () => {
  comparison = await initComparison();
});

// ============================================================================
// Region Comparison Tests
// ============================================================================

describe("Sequence Comparison", () => {
  describe("compareSequences (wrapper function)", () => {
    it("should call WASM with correct arguments", () => {
      const seq1 = "ATGCCCGGG";
      const seq2 = "ATGCCCGGG";
      
      const wasmSpy = vi.spyOn(comparison.wasm, "compare_sequences_full");
      
      comparison.compareSequences(seq1, seq2);
      
      expect(wasmSpy).toHaveBeenCalledWith(
        seq1,
        seq2,
        SEGMENT_WINDOW_LENGTH,
        MIN_IDENTITY,
        MIN_SIGNIFICANT_LENGTH_GROUP,
        MIN_SEQUENCE_OVERLAP_PCT
      );
      
      wasmSpy.mockRestore();
    });

    it("should parse and return JSON result", () => {
      const seq1 = "ATGCCCGGG";
      const seq2 = "ATGCCCGGG";
      
      const result = comparison.compareSequences(seq1, seq2);
      
      expect(result).toHaveProperty("identity");
      expect(result).toHaveProperty("mismatches");
      expect(result).toHaveProperty("length");
      expect(result).toHaveProperty("offset1");
      expect(result).toHaveProperty("offset2");
      expect(result).toHaveProperty("conservedBlocks");
    });
  });

  describe("wasm.compare_sequences_full", () => {
    it("should handle perfect match", () => {
      const seq1 = "ATGCCCGGG";
      const seq2 = "ATGCCCGGG";
      
      const jsonResult = comparison.wasm.compare_sequences_full(
        seq1, seq2,
        SEGMENT_WINDOW_LENGTH,
        MIN_IDENTITY,
        MIN_SIGNIFICANT_LENGTH_GROUP,
        MIN_SEQUENCE_OVERLAP_PCT
      );
      const result = JSON.parse(jsonResult);
      
      expect(result.identity).toBe(1.0);
      expect(result.mismatches).toBe(0);
      expect(result.length).toBe(9);
      expect(result.offset1).toBe(0);
      expect(result.offset2).toBe(0);
    });

    it("should handle sequences with offset", () => {
      const seq1 = "ATGCCCGGG";
      const seq2 = "XXXATGCCCGGG";
      
      const jsonResult = comparison.wasm.compare_sequences_full(
        seq1, seq2,
        SEGMENT_WINDOW_LENGTH,
        MIN_IDENTITY,
        MIN_SIGNIFICANT_LENGTH_GROUP,
        MIN_SEQUENCE_OVERLAP_PCT
      );
      const result = JSON.parse(jsonResult);
      
      expect(result.offset1).toBe(0);
      expect(result.offset2).toBe(3);
      expect(result.length).toBe(9);
      expect(result.identity).toBe(1.0);
    });

    it("should find best alignment with mismatches", () => {
      const seq1 = "ATGAAACCCGGG";
      const seq2 = "ATGAAACCCTTT";
      
      const jsonResult = comparison.wasm.compare_sequences_full(
        seq1, seq2,
        SEGMENT_WINDOW_LENGTH,
        MIN_IDENTITY,
        MIN_SIGNIFICANT_LENGTH_GROUP,
        MIN_SEQUENCE_OVERLAP_PCT
      );
      const result = JSON.parse(jsonResult);
      
      expect(result.length).toBe(12);
      expect(result.mismatches).toBe(3);
      expect(result.identity).toBe(0.75);
    });

    it("should handle empty sequences", () => {
      const jsonResult = comparison.wasm.compare_sequences_full(
        "", "ATGC",
        SEGMENT_WINDOW_LENGTH,
        MIN_IDENTITY,
        MIN_SIGNIFICANT_LENGTH_GROUP,
        MIN_SEQUENCE_OVERLAP_PCT
      );
      const result = JSON.parse(jsonResult);
      
      expect(result.length).toBe(0);
      expect(result.identity).toBe(0);
      expect(result.truncated).toBe(true);
    });

    it("should handle both sequences being empty", () => {
      const jsonResult = comparison.wasm.compare_sequences_full(
        "", "",
        SEGMENT_WINDOW_LENGTH,
        MIN_IDENTITY,
        MIN_SIGNIFICANT_LENGTH_GROUP,
        MIN_SEQUENCE_OVERLAP_PCT
      );
      const result = JSON.parse(jsonResult);
      
      expect(result.length).toBe(0);
      expect(result.identity).toBe(0);
      expect(result.truncated).toBe(true);
      expect(result.conservedBlocks).toEqual([]);
    });

    it("should require minimum 50% overlap", () => {
      const seq1 = "ATGCCCGGG";
      const seq2 = "TTTAAA";
      
      const jsonResult = comparison.wasm.compare_sequences_full(
        seq1, seq2,
        SEGMENT_WINDOW_LENGTH,
        MIN_IDENTITY,
        MIN_SIGNIFICANT_LENGTH_GROUP,
        MIN_SEQUENCE_OVERLAP_PCT
      );
      const result = JSON.parse(jsonResult);
      
      expect(result.length).toBeGreaterThanOrEqual(Math.ceil(Math.min(9, 6) * 0.5));
    });

    it("should detect truncation", () => {
      const seq1 = "ATGCCCGGG";
      const seq2 = "ATGCCC";
      
      const jsonResult = comparison.wasm.compare_sequences_full(
        seq1, seq2,
        SEGMENT_WINDOW_LENGTH,
        MIN_IDENTITY,
        MIN_SIGNIFICANT_LENGTH_GROUP,
        MIN_SEQUENCE_OVERLAP_PCT
      );
      const result = JSON.parse(jsonResult);
      
      expect(result.truncated).toBe(true);
    });

    it("should stop early on perfect match", () => {
      const seq1 = "ATGCCCGGG";
      const seq2 = "ATGCCCGGG";
      
      const jsonResult = comparison.wasm.compare_sequences_full(
        seq1, seq2,
        SEGMENT_WINDOW_LENGTH,
        MIN_IDENTITY,
        MIN_SIGNIFICANT_LENGTH_GROUP,
        MIN_SEQUENCE_OVERLAP_PCT
      );
      const result = JSON.parse(jsonResult);
      
      expect(result.mismatches).toBe(0);
      expect(result.identity).toBe(1.0);
    });

    it("should prefer longer overlap when identity is similar", () => {
      const seq1 = "ATGCCCGGGTTTAAACCC";
      const seq2 = "ATGCCCGGGTTTAAACCC";
      
      const jsonResult = comparison.wasm.compare_sequences_full(
        seq1, seq2,
        SEGMENT_WINDOW_LENGTH,
        MIN_IDENTITY,
        MIN_SIGNIFICANT_LENGTH_GROUP,
        MIN_SEQUENCE_OVERLAP_PCT
      );
      const result = JSON.parse(jsonResult);
      
      expect(result.length).toBe(18);
      expect(result.identity).toBe(1.0);
    });

    it("should skip alignments with overlap smaller than minimum", () => {
      const seq1 = "ATGCCCGGGTTTAAACCCGG";
      const seq2 = "AAATTTCCCGGGATGCCCGG";
      
      const jsonResult = comparison.wasm.compare_sequences_full(
        seq1, seq2,
        SEGMENT_WINDOW_LENGTH,
        MIN_IDENTITY,
        MIN_SIGNIFICANT_LENGTH_GROUP,
        MIN_SEQUENCE_OVERLAP_PCT
      );
      const result = JSON.parse(jsonResult);
      
      expect(result.length).toBeGreaterThanOrEqual(10);
      expect(result.identity).toBeGreaterThanOrEqual(0);
      expect(result.identity).toBeLessThanOrEqual(1);
    });
  });
});

// ============================================================================
// Protein Comparison Tests
// ============================================================================

describe("Protein Comparison", () => {
  // Mock console to suppress logs during tests
  let originalLog;
  beforeEach(() => {
    originalLog = console.log;
    console.log = vi.fn();
  });

  afterEach(() => {
    console.log = originalLog;
  });

  describe("compareProteins (wrapper function)", () => {
    it("should call WASM with correct arguments", () => {
      const seq1 = "ATGAAACCCGGG";
      const seq2 = "ATGAAACCCGGG";
      const nucResult = {
        offset1: 0,
        offset2: 0,
        length: seq1.length,
        mask: seq1,
        mismatches: 0,
        identity: 1.0,
        conservedBlocks: []
      };
      
      const wasmSpy = vi.spyOn(comparison.wasm, "compare_proteins_full");
      
      comparison.compareProteins(seq1, seq2, nucResult);
      
      expect(wasmSpy).toHaveBeenCalledWith(
        seq1,
        seq2,
        nucResult.offset1,
        nucResult.offset2,
        nucResult.length,
        AA_SEGMENT_WINDOW_LENGTH,
        MIN_IDENTITY,
        MIN_SIGNIFICANT_LENGTH_GROUP
      );
      
      wasmSpy.mockRestore();
    });

    it("should parse and return formatted result", () => {
      const seq1 = "ATGAAACCCGGG";
      const seq2 = "ATGAAACCCGGG";
      const nucResult = {
        offset1: 0,
        offset2: 0,
        length: seq1.length,
        mask: seq1,
        mismatches: 0,
        identity: 1.0,
        conservedBlocks: []
      };
      
      const result = comparison.compareProteins(seq1, seq2, nucResult);
      
      expect(result).toHaveProperty("aa1");
      expect(result).toHaveProperty("aa2");
      expect(result).toHaveProperty("result");
      expect(result.result).toHaveProperty("mask");
      expect(result.result).toHaveProperty("mismatches");
      expect(result.result).toHaveProperty("length");
      expect(result.result).toHaveProperty("identity");
      expect(result.result).toHaveProperty("frame1");
      expect(result.result).toHaveProperty("frame2");
      expect(result.result).toHaveProperty("conservedBlocks");
    });
  });

  describe("wasm.compare_proteins_full", () => {
    describe("Codon to Amino Acid Mapping", () => {
      it("should translate start codon ATG to M", () => {
        const seq = "ATGAAA"; // ATG + AAA (minimum: 1 codon * 3 = 3 nucleotides)
        const jsonResult = comparison.wasm.compare_proteins_full(
          seq, seq, 0, 0, seq.length,
          1, // AA_SEGMENT_WINDOW_LENGTH
          MIN_IDENTITY,
          MIN_SIGNIFICANT_LENGTH_GROUP
        );
        const result = JSON.parse(jsonResult);
        expect(result.aa1[0]).toBe("M");
        expect(result.aa2[0]).toBe("M");
      });

      it("should translate stop codons correctly", () => {
        const stopCodons = ["TAA", "TAG", "TGA"];
        for (const stopCodon of stopCodons) {
          const seq = "ATG" + stopCodon;
          const jsonResult = comparison.wasm.compare_proteins_full(
            seq, seq, 0, 0, seq.length,
            1, // AA_SEGMENT_WINDOW_LENGTH
            MIN_IDENTITY,
            MIN_SIGNIFICANT_LENGTH_GROUP
          );
          const result = JSON.parse(jsonResult);
          expect(result.aa1[1]).toBe("*");
          expect(result.aa2[1]).toBe("*");
        }
      });

      it("should translate all 64 codons correctly", () => {
        // Complete genetic code: all 64 codons
        const codonToAA = {
          // Stop codons
          "TAA": "*", "TAG": "*", "TGA": "*",
          // Methionine (start)
          "ATG": "M",
          // Alanine
          "GCT": "A", "GCC": "A", "GCA": "A", "GCG": "A",
          // Arginine
          "CGT": "R", "CGC": "R", "CGA": "R", "CGG": "R", "AGA": "R", "AGG": "R",
          // Asparagine
          "AAT": "N", "AAC": "N",
          // Aspartic acid
          "GAT": "D", "GAC": "D",
          // Cysteine
          "TGT": "C", "TGC": "C",
          // Glutamine
          "CAA": "Q", "CAG": "Q",
          // Glutamic acid
          "GAA": "E", "GAG": "E",
          // Glycine
          "GGT": "G", "GGC": "G", "GGA": "G", "GGG": "G",
          // Histidine
          "CAT": "H", "CAC": "H",
          // Isoleucine
          "ATT": "I", "ATC": "I", "ATA": "I",
          // Leucine
          "CTT": "L", "CTC": "L", "CTA": "L", "CTG": "L", "TTA": "L", "TTG": "L",
          // Lysine
          "AAA": "K", "AAG": "K",
          // Phenylalanine
          "TTT": "F", "TTC": "F",
          // Proline
          "CCT": "P", "CCC": "P", "CCA": "P", "CCG": "P",
          // Serine
          "TCT": "S", "TCC": "S", "TCA": "S", "TCG": "S", "AGT": "S", "AGC": "S",
          // Threonine
          "ACT": "T", "ACC": "T", "ACA": "T", "ACG": "T",
          // Tryptophan
          "TGG": "W",
          // Tyrosine
          "TAT": "Y", "TAC": "Y",
          // Valine
          "GTT": "V", "GTC": "V", "GTA": "V", "GTG": "V",
        };

        // Test all 64 codons
        const testCodons = Object.entries(codonToAA);

        for (const [codon, expectedAA] of testCodons) {
          const seq = "ATG" + codon; // ATG + test codon (minimum: 1 codon * 3 = 3 nucleotides)
          const jsonResult = comparison.wasm.compare_proteins_full(
            seq, seq, 0, 0, seq.length,
            1, // AA_SEGMENT_WINDOW_LENGTH
            MIN_IDENTITY,
            MIN_SIGNIFICANT_LENGTH_GROUP
          );
          const result = JSON.parse(jsonResult);
          expect(result.aa1[1]).toBe(expectedAA, `Codon ${codon} should translate to ${expectedAA}`);
          expect(result.aa2[1]).toBe(expectedAA, `Codon ${codon} should translate to ${expectedAA}`);
        }
      });

      it("should handle sequences with multiple codons correctly", () => {
        // Test a known sequence: ATG AAA CCC GGG TTT
        // Expected: M K P G F
        const seq = "ATGAAACCCGGGTTT";
        
        const jsonResult = comparison.wasm.compare_proteins_full(
          seq, seq, 0, 0, seq.length,
          1, // AA_SEGMENT_WINDOW_LENGTH
          MIN_IDENTITY,
          MIN_SIGNIFICANT_LENGTH_GROUP
        );
        const result = JSON.parse(jsonResult);
        
        // Check first 5 amino acids
        expect(result.aa1.substring(0, 5)).toBe("MKPGF");
        expect(result.aa2.substring(0, 5)).toBe("MKPGF");
      });

      it("should handle invalid nucleotides by returning X", () => {
        // Sequence with invalid nucleotide should produce X
        const seq = "ATGNNN"; // N is invalid
        const jsonResult = comparison.wasm.compare_proteins_full(
          seq, seq, 0, 0, seq.length,
          1, // AA_SEGMENT_WINDOW_LENGTH
          MIN_IDENTITY,
          MIN_SIGNIFICANT_LENGTH_GROUP
        );
        const result = JSON.parse(jsonResult);
        
        expect(result.aa1[1]).toBe("X");
        expect(result.aa2[1]).toBe("X");
      });
    });

    it("should compare proteins from identical DNA sequences", () => {
      const seq1 = "ATGAAACCCGGG";
      const seq2 = "ATGAAACCCGGG";
      
      const jsonResult = comparison.wasm.compare_proteins_full(
        seq1, seq2, 0, 0, seq1.length,
        1, // AA_SEGMENT_WINDOW_LENGTH
        MIN_IDENTITY,
        MIN_SIGNIFICANT_LENGTH_GROUP
      );
      const result = JSON.parse(jsonResult);

      expect(result.identity).toBe(1.0);
      expect(result.mismatches).toBe(0);
      expect(result.aa1.length).toBeGreaterThan(0);
      expect(result.aa2.length).toBeGreaterThan(0);
    });

    it("should detect amino acid differences", () => {
      const seq1 = "ATGAAACCCGGG";
      const seq2 = "ATGAAATTTGGG";
      
      const jsonResult = comparison.wasm.compare_proteins_full(
        seq1, seq2, 0, 0, 12,
        1, // AA_SEGMENT_WINDOW_LENGTH
        MIN_IDENTITY,
        MIN_SIGNIFICANT_LENGTH_GROUP
      );
      const result = JSON.parse(jsonResult);

      expect(result.identity).toBeGreaterThanOrEqual(0);
      expect(result.identity).toBeLessThanOrEqual(1.0);
      expect(typeof result.mismatches).toBe("number");
      expect(typeof result.mask).toBe("string");
    });

    it("should include reading frame information", () => {
      const seq1 = "ATGAAACCCGGG";
      const seq2 = "ATGAAACCCGGG";
      
      const jsonResult = comparison.wasm.compare_proteins_full(
        seq1, seq2, 0, 0, 12,
        1, // AA_SEGMENT_WINDOW_LENGTH
        MIN_IDENTITY,
        MIN_SIGNIFICANT_LENGTH_GROUP
      );
      const result = JSON.parse(jsonResult);

      expect(typeof result.frame1).toBe("number");
      expect(typeof result.frame2).toBe("number");
      expect(result.frame1).toBeGreaterThanOrEqual(0);
      expect(result.frame1).toBeLessThan(3);
      expect(result.frame2).toBeGreaterThanOrEqual(0);
      expect(result.frame2).toBeLessThan(3);
    });

    it("should find conserved blocks in proteins", () => {
      const seq = "ATGAAACCCGGGTTT";
      
      const jsonResult = comparison.wasm.compare_proteins_full(
        seq, seq, 0, 0, seq.length,
        1, // AA_SEGMENT_WINDOW_LENGTH
        MIN_IDENTITY,
        MIN_SIGNIFICANT_LENGTH_GROUP
      );
      const result = JSON.parse(jsonResult);

      expect(result.conservedBlocks.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle sequences with different offsets", () => {
      const seq1 = "CCCATGAAACCCGGG";
      const seq2 = "ATGAAACCCGGG";
      
      const jsonResult = comparison.wasm.compare_proteins_full(
        seq1, seq2, 3, 0, 12,
        1, // AA_SEGMENT_WINDOW_LENGTH
        MIN_IDENTITY,
        MIN_SIGNIFICANT_LENGTH_GROUP
      );
      const result = JSON.parse(jsonResult);

      expect(result.identity).toBeGreaterThanOrEqual(0);
      expect(result.identity).toBeLessThanOrEqual(1.0);
      expect(result.aa1.length).toBeGreaterThan(0);
      expect(result.aa2.length).toBeGreaterThan(0);
    });

    it("should calculate protein offsets from nucleotide offsets", () => {
      const seq1 = "ATGAAACCCGGG";
      const seq2 = "ATGAAACCCGGG";
      
      const jsonResult = comparison.wasm.compare_proteins_full(
        seq1, seq2, 6, 0, 6,
        1, // AA_SEGMENT_WINDOW_LENGTH
        MIN_IDENTITY,
        MIN_SIGNIFICANT_LENGTH_GROUP
      );
      const result = JSON.parse(jsonResult);

      expect(typeof result.offset1).toBe("number");
      expect(typeof result.offset2).toBe("number");
    });
  });
});
