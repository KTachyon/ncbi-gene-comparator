// Tests for DNA to amino acid translation

import { describe, it, expect } from "vitest";
import { translateDNA } from "../lib/translation.js";

describe("DNA Translation", () => {
  describe("translateDNA", () => {
    it("should translate ATG to M (Methionine)", () => {
      const result = translateDNA("ATG");
      expect(result).toBe("M");
    });

    it("should translate multiple codons", () => {
      const result = translateDNA("ATGAAACCCGGG");
      expect(result).toBe("MKPG");
    });

    it("should translate stop codons to *", () => {
      const result = translateDNA("ATGTAA");
      expect(result).toBe("M*");
    });

    it("should handle all three stop codons", () => {
      expect(translateDNA("TAA")).toBe("*");
      expect(translateDNA("TAG")).toBe("*");
      expect(translateDNA("TGA")).toBe("*");
    });

    it("should ignore incomplete codon at end", () => {
      const result = translateDNA("ATGAAACCCGG"); // GG is incomplete
      expect(result).toBe("MKP");
    });

    it("should return empty string for sequence shorter than 3bp", () => {
      expect(translateDNA("AT")).toBe("");
      expect(translateDNA("")).toBe("");
    });

    it("should handle unknown codons with X", () => {
      const result = translateDNA("NNNAAACCC");
      expect(result).toBe("XKP");
    });

    it("should translate common amino acids correctly", () => {
      // Test a few common codons
      expect(translateDNA("TTT")).toBe("F"); // Phenylalanine
      expect(translateDNA("TTA")).toBe("L"); // Leucine
      expect(translateDNA("TCT")).toBe("S"); // Serine
      expect(translateDNA("TAT")).toBe("Y"); // Tyrosine
      expect(translateDNA("TGT")).toBe("C"); // Cysteine
      expect(translateDNA("TGG")).toBe("W"); // Tryptophan
      expect(translateDNA("CCT")).toBe("P"); // Proline
      expect(translateDNA("CAT")).toBe("H"); // Histidine
      expect(translateDNA("CAA")).toBe("Q"); // Glutamine
      expect(translateDNA("CGT")).toBe("R"); // Arginine
      expect(translateDNA("ATT")).toBe("I"); // Isoleucine
      expect(translateDNA("ACT")).toBe("T"); // Threonine
      expect(translateDNA("AAT")).toBe("N"); // Asparagine
      expect(translateDNA("AAA")).toBe("K"); // Lysine
      expect(translateDNA("AGT")).toBe("S"); // Serine
      expect(translateDNA("GTT")).toBe("V"); // Valine
      expect(translateDNA("GCT")).toBe("A"); // Alanine
      expect(translateDNA("GAT")).toBe("D"); // Aspartic acid
      expect(translateDNA("GAA")).toBe("E"); // Glutamic acid
      expect(translateDNA("GGT")).toBe("G"); // Glycine
    });

    it("should handle realistic gene sequence", () => {
      // Simple realistic sequence: Start codon + 4 amino acids
      const sequence = "ATGAAACCCGGGTTT";
      const result = translateDNA(sequence);
      expect(result).toBe("MKPGF");
      expect(result.length).toBe(5);
    });
  });
});
