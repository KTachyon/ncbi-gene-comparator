// Tests for cache utilities

import { describe, it, beforeEach, afterEach, vi, expect } from "vitest";
import fs from "fs";
import { 
  loadGeneMap, 
  saveGeneMap,
  getSequenceCacheFolder,
  GENE_MAP_FILE 
} from "../lib/cache.js";

describe("Cache Utilities", () => {
  describe("getSequenceCacheFolder", () => {
    let existsSyncSpy;
    let mkdirSyncSpy;

    beforeEach(() => {
      existsSyncSpy = vi.spyOn(fs, "existsSync");
      mkdirSyncSpy = vi.spyOn(fs, "mkdirSync");
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should return a valid path", () => {
      // Stub existsSync to return true (folder exists)
      existsSyncSpy.mockReturnValue(true);

      const folder = getSequenceCacheFolder();
      
      expect(typeof folder).toBe("string");
      expect(folder).toContain("seqs");
      expect(existsSyncSpy).toHaveBeenCalledWith(folder);
    });

    it("should create folder if it doesn't exist", () => {
      // Stub existsSync to return false (folder doesn't exist)
      existsSyncSpy.mockReturnValue(false);
      mkdirSyncSpy.mockImplementation(() => {});

      const folder = getSequenceCacheFolder();
      
      // Should have called mkdirSync to create the folder
      expect(mkdirSyncSpy).toHaveBeenCalledWith(
        folder,
        { recursive: true }
      );
    });
  });

  describe("loadGeneMap", () => {
    let existsSyncSpy;
    let readFileSyncSpy;

    beforeEach(() => {
      existsSyncSpy = vi.spyOn(fs, "existsSync");
      readFileSyncSpy = vi.spyOn(fs, "readFileSync");
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should load existing gene map", () => {
      const mockGeneMap = {
        genes: {
          BRCA1: {
            human: "NM_007294.3",
            mouse: "NM_009764.3"
          }
        },
        metadata: {
          lastUpdated: "2024-01-01T00:00:00.000Z",
          totalGenes: 1
        }
      };

      // Stub file exists and reading
      existsSyncSpy.mockReturnValue(true);
      readFileSyncSpy.mockReturnValue(JSON.stringify(mockGeneMap));
      
      const geneMap = loadGeneMap();
      
      expect(geneMap).toEqual(mockGeneMap);
      expect(existsSyncSpy).toHaveBeenCalledWith(GENE_MAP_FILE);
      expect(readFileSyncSpy).toHaveBeenCalledWith(GENE_MAP_FILE, "utf8");
    });

    it("should return default structure if file doesn't exist", () => {
      // Stub file doesn't exist
      existsSyncSpy.mockReturnValue(false);

      const geneMap = loadGeneMap();
      
      expect(geneMap).toEqual({
        genes: {},
        metadata: {
          lastUpdated: null,
          totalGenes: 0
        }
      });
      expect(existsSyncSpy).toHaveBeenCalledWith(GENE_MAP_FILE);
      // Should not try to read file if it doesn't exist
      expect(readFileSyncSpy).not.toHaveBeenCalled();
    });
  });

  describe("saveGeneMap", () => {
    let writeFileSyncSpy;

    beforeEach(() => {
      writeFileSyncSpy = vi.spyOn(fs, "writeFileSync");
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should save gene map and update metadata", () => {
      // Mock the Date to have consistent timestamps
      const mockDate = new Date("2024-12-02T12:00:00.000Z");
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);

      const testMap = {
        genes: {
          TEST1: {
            human: "NM_001001.1",
            mouse: "NM_001002.1"
          },
          TEST2: {
            human: "NM_002001.1",
            mouse: "NM_002002.1"
          }
        },
        metadata: {
          lastUpdated: null,
          totalGenes: 0
        }
      };

      // Stub writeFileSync
      writeFileSyncSpy.mockImplementation(() => {});

      saveGeneMap(testMap);

      // Verify writeFileSync was called
      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        GENE_MAP_FILE,
        expect.any(String),
        "utf8"
      );

      // Verify the data that would be written
      const writtenData = JSON.parse(writeFileSyncSpy.mock.calls[0][1]);
      expect(writtenData.metadata.totalGenes).toBe(2);
      expect(writtenData.metadata.lastUpdated).toBe(mockDate.toISOString());
      expect(writtenData.genes).toEqual(testMap.genes);

      vi.useRealTimers();
    });

    it("should update metadata with correct gene count", () => {
      const testMap = {
        genes: {
          GENE1: { human: "NM_001.1" },
          GENE2: { human: "NM_002.1" },
          GENE3: { human: "NM_003.1" }
        },
        metadata: {
          lastUpdated: null,
          totalGenes: 0
        }
      };

      writeFileSyncSpy.mockImplementation(() => {});

      saveGeneMap(testMap);

      const writtenData = JSON.parse(writeFileSyncSpy.mock.calls[0][1]);
      expect(writtenData.metadata.totalGenes).toBe(3);
      expect(writeFileSyncSpy).toHaveBeenCalledTimes(1);
    });
  });
});
