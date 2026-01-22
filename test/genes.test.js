// Tests for gene utilities

import { describe, it, expect } from "vitest";
import { genes, getGeneNames, getGenesByCategory, getCategories } from "../lib/genes.js";

describe("Genes", () => {
  describe("getGeneNames", () => {
    it("should return all gene names as an array", () => {
      const names = getGeneNames();
      
      expect(Array.isArray(names)).toBe(true);
      expect(names).toContain("TP53");
      expect(names).toContain("EGFR");
      expect(names).toContain("MYC");
    });

    it("should return same count as genes object keys", () => {
      const names = getGeneNames();
      const objectKeys = Object.keys(genes);
      
      expect(names.length).toBe(objectKeys.length);
    });
  });

  describe("getGenesByCategory", () => {
    it("should filter genes by Cancer category", () => {
      const cancerGenes = getGenesByCategory("Cancer");
      
      expect(cancerGenes).toContain("TP53");
      expect(cancerGenes).toContain("KRAS");
      expect(cancerGenes).toContain("BRAF");
      expect(cancerGenes).toContain("MYC");
    });

    it("should filter genes by Immune category", () => {
      const immuneGenes = getGenesByCategory("Immune");
      
      expect(immuneGenes).toContain("CD8A");
      expect(immuneGenes).toContain("CD3D");
      expect(immuneGenes).toContain("B2M");
      expect(immuneGenes).toContain("CCL2");
    });

    it("should return empty array for non-existent category", () => {
      const noGenes = getGenesByCategory("NonExistentCategory");
      
      expect(noGenes).toEqual([]);
    });

    it("should filter genes by Metabolism category", () => {
      const metabolismGenes = getGenesByCategory("Metabolism");
      
      expect(metabolismGenes).toContain("LDHA");
      expect(metabolismGenes.length).toBeGreaterThan(0);
    });
  });

  describe("getCategories", () => {
    it("should return unique categories sorted alphabetically", () => {
      const categories = getCategories();
      
      expect(Array.isArray(categories)).toBe(true);
      expect(categories).toContain("Cancer");
      expect(categories).toContain("Immune");
      expect(categories).toContain("Metabolism");
      expect(categories).toContain("DNA Repair");
    });

    it("should return sorted categories", () => {
      const categories = getCategories();
      const sorted = [...categories].sort();
      
      expect(categories).toEqual(sorted);
    });

    it("should not have duplicate categories", () => {
      const categories = getCategories();
      const uniqueCategories = [...new Set(categories)];
      
      expect(categories.length).toBe(uniqueCategories.length);
    });
  });
});

