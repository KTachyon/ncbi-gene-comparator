// Tests for FASTA parsing

import { describe, it, expect } from "vitest";
import { parseFasta } from "../lib/parser.js";
import {
  SAMPLE_FASTA_SIMPLE,
  SAMPLE_FASTA_MULTILINE,
  SAMPLE_FASTA_WITH_WHITESPACE,
  SAMPLE_FASTA_SPECIAL_CHARS,
  SAMPLE_FASTA_EMPTY_SEQUENCE,
  SAMPLE_FASTA_NO_HEADER
} from "./fixtures/sample-sequences.js";

describe("FASTA Parser", () => {
  describe("parseFasta", () => {
    it("should parse simple FASTA format", () => {
      const result = parseFasta(SAMPLE_FASTA_SIMPLE);
      
      expect(result.header).toBe("NM_001001.1 Test sequence");
      expect(result.sequence).toBe("ATGCCCGGG");
    });

    it("should parse multi-line sequence", () => {
      const result = parseFasta(SAMPLE_FASTA_MULTILINE);
      
      expect(result.header).toBe("NM_001001.1 Test sequence");
      expect(result.sequence).toBe("ATGCCCGGGTTTAAACCCGGGTTTAAA");
    });

    it("should handle FASTA with extra whitespace", () => {
      const result = parseFasta(SAMPLE_FASTA_WITH_WHITESPACE);
      
      expect(result.header).toBe("NM_001001.1 Test sequence");
      expect(result.sequence).toBe("ATGCCCGGGTTTAAACCC");
    });

    it("should extract header without > symbol", () => {
      const result = parseFasta(SAMPLE_FASTA_SPECIAL_CHARS);
      
      expect(result.header).toBe("Header with special chars [gene=TEST1]");
    });

    it("should throw error for empty sequence", () => {
      expect(() => parseFasta(SAMPLE_FASTA_EMPTY_SEQUENCE)).toThrow(/No sequence data found/);
    });

    it("should throw error for missing header", () => {
      const result = parseFasta(SAMPLE_FASTA_NO_HEADER);
      
      expect(result.header).toBe("Unknown");
      expect(result.sequence).toBe("ATGCCCGGG");
    });
  });
});
