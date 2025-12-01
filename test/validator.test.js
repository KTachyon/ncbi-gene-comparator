// Tests for sequence validation and normalization

import { describe, it, expect } from "vitest";
import { normalizeSeq, validateDNA } from "../lib/validator.js";

describe("Validator", () => {
  describe("normalizeSeq", () => {
    it("should convert lowercase to uppercase", () => {
      const result = normalizeSeq("atgc");
      expect(result).toBe("ATGC");
    });

    it("should remove spaces", () => {
      const result = normalizeSeq("ATG CCC GGG");
      expect(result).toBe("ATGCCCGGG");
    });

    it("should handle mixed case with spaces", () => {
      const result = normalizeSeq("atg CCC ggg TTT");
      expect(result).toBe("ATGCCCGGGTTT");
    });

    it("should handle empty string", () => {
      const result = normalizeSeq("");
      expect(result).toBe("");
    });

    it("should handle newlines and tabs", () => {
      const result = normalizeSeq("ATG\nCCC\tGGG");
      expect(result).toBe("ATGCCCGGG");
    });
  });

  describe("validateDNA", () => {
    it("should accept valid DNA sequences with exact bases", () => {
      expect(() => validateDNA("ATGC")).not.toThrow();
      expect(() => validateDNA("ATGCATGC")).not.toThrow();
    });

    it("should accept sequences with gaps", () => {
      expect(() => validateDNA("ATG-CCC-GGG")).not.toThrow();
    });

    it("should reject IUPAC ambiguity codes (N)", () => {
      expect(() => validateDNA("ATGCNATGC")).toThrow(/Invalid DNA sequence/);
    });

    it("should reject IUPAC ambiguity codes (R, Y, etc.)", () => {
      expect(() => validateDNA("ATGCRATGC")).toThrow(/Invalid DNA sequence/);
      expect(() => validateDNA("ATGCYATGC")).toThrow(/Invalid DNA sequence/);
    });

    it("should reject sequences with invalid characters", () => {
      expect(() => validateDNA("ATGCXYZ")).toThrow(/Invalid DNA sequence/);
    });

    it("should reject sequences with numbers", () => {
      expect(() => validateDNA("ATG123")).toThrow(/Invalid DNA sequence/);
    });

    it("should reject sequences with lowercase (must normalize first)", () => {
      expect(() => validateDNA("atgc")).toThrow(/Invalid DNA sequence/);
    });
  });
});
