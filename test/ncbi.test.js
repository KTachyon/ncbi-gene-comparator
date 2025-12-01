// Tests for NCBI API utilities
// Stubs rate limiter and tests all other functions

import { describe, it, beforeEach, afterEach, vi, expect } from "vitest";
import fs from "fs";
import path from "path";
import Bottleneck from "bottleneck";
import {
  fetchFromNCBI,
  searchNCBI,
  getSummaries,
  getSequenceData,
  Helper,
} from "../lib/ncbi.js";

describe("Rate Limiter Setup", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should call limiter.schedule with a function", async () => {
    // Spy on Bottleneck's schedule method
    const scheduleSpy = vi.spyOn(Bottleneck.prototype, "schedule");
    
    // Mock fetch to return a successful response
    const mockResponse = {
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue("test"),
    };
    vi.spyOn(global, "fetch").mockResolvedValue(mockResponse);
    
    // Call rateLimitedFetch which should call limiter.schedule
    await Helper.rateLimitedFetch("https://example.com", 1);
    
    // Verify schedule was called
    expect(scheduleSpy).toHaveBeenCalled();
    
    // Verify schedule was called with a function as the first argument
    const scheduleCall = scheduleSpy.mock.calls[0];
    expect(scheduleCall).toBeDefined();
    expect(scheduleCall.length).toBe(1);
    expect(typeof scheduleCall[0]).toBe("function");
  });
});

describe("rateLimitedFetch Inner Function", () => {
  let scheduleSpy;
  let fetchSpy;

  beforeEach(() => {
    // Stub Bottleneck's schedule to immediately execute the function
    scheduleSpy = vi.spyOn(Bottleneck.prototype, "schedule").mockImplementation(async (fn) => {
      return await fn();
    });
    
    // Spy on fetch
    fetchSpy = vi.spyOn(global, "fetch");
    
    // Mock console.log to avoid noise in tests
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("should return response on successful fetch", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue("test data"),
    };

    fetchSpy.mockResolvedValue(mockResponse);

    const result = await Helper.rateLimitedFetch("https://example.com", 1);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com");
    expect(result).toBe(mockResponse);
  });

  it("should retry on network error with exponential backoff", async () => {
    vi.useFakeTimers();

    const mockResponse = {
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue("test data"),
    };

    // First attempt fails, second succeeds
    fetchSpy
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce(mockResponse);

    const fetchPromise = Helper.rateLimitedFetch("https://example.com", 3);

    // Fast-forward through retry delay (2^0 * 500 = 500ms)
    await vi.advanceTimersByTimeAsync(500);

    const result = await fetchPromise;

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result).toBe(mockResponse);
  });

  it("should handle 429 rate limit with exponential backoff", async () => {
    vi.useFakeTimers();

    const rateLimitResponse = {
      ok: false,
      status: 429,
    };

    const successResponse = {
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue("test data"),
    };

    // First attempt gets rate limited, second succeeds
    fetchSpy
      .mockResolvedValueOnce(rateLimitResponse)
      .mockResolvedValueOnce(successResponse);

    const fetchPromise = Helper.rateLimitedFetch("https://example.com", 3);

    // Fast-forward through rate limit wait (2^1 * 1000 = 2000ms)
    await vi.advanceTimersByTimeAsync(2000);

    const result = await fetchPromise;

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result).toBe(successResponse);
  });

  it("should throw error after max retries", async () => {
    vi.useFakeTimers();

    fetchSpy.mockRejectedValue(new Error("Network error"));

    const fetchPromise = Helper.rateLimitedFetch("https://example.com", 2);
    
    // Add catch handler to prevent unhandled rejection
    fetchPromise.catch(() => {});

    // Run all timers to completion
    await vi.runAllTimersAsync();

    await expect(fetchPromise).rejects.toThrow("Network error");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("should throw error for non-200, non-429 status codes", async () => {
    const errorResponse = {
      ok: false,
      status: 500,
    };

    fetchSpy.mockResolvedValue(errorResponse);

    await expect(Helper.rateLimitedFetch("https://example.com", 1)).rejects.toThrow(
      "NCBI API returned status 500"
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("should retry on non-200 status codes up to max retries", async () => {
    vi.useFakeTimers();

    const errorResponse = {
      ok: false,
      status: 500,
    };

    fetchSpy.mockResolvedValue(errorResponse);

    const fetchPromise = Helper.rateLimitedFetch("https://example.com", 2);
    
    // Add catch handler to prevent unhandled rejection
    fetchPromise.catch(() => {});

    // Run all timers to completion
    await vi.runAllTimersAsync();

    await expect(fetchPromise).rejects.toThrow("NCBI API returned status 500");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

describe("NCBI API Utilities", () => {
  let rateLimitedFetchSpy;

  beforeEach(() => {
    // Stub Helper.rateLimitedFetch to bypass rate limiter
    rateLimitedFetchSpy = vi.spyOn(Helper, "rateLimitedFetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.NCBI_API_KEY;
  });

  describe("fetchFromNCBI", () => {
    it("should fetch FASTA data from NCBI", async () => {
      const mockFastaData = ">NM_000123.4\nATGCGATCGATCGATCG";
      const mockResponse = {
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(mockFastaData),
      };

      rateLimitedFetchSpy.mockResolvedValue(mockResponse);

      const result = await fetchFromNCBI("NM_000123.4");

      expect(rateLimitedFetchSpy).toHaveBeenCalled();
      const callUrl = rateLimitedFetchSpy.mock.calls[0][0];
      expect(callUrl).toContain("efetch.fcgi");
      expect(callUrl).toContain("db=nuccore");
      expect(callUrl).toContain("id=NM_000123.4");
      expect(callUrl).toContain("rettype=fasta");
      expect(callUrl).toContain("retmode=text");
      expect(result).toBe(mockFastaData);
    });

    it("should include API key in URL if available", async () => {
      process.env.NCBI_API_KEY = "test-api-key-123";

      const mockResponse = {
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(">test\nATGC"),
      };

      rateLimitedFetchSpy.mockResolvedValue(mockResponse);

      await fetchFromNCBI("NM_000123.4");

      const callUrl = rateLimitedFetchSpy.mock.calls[0][0];
      expect(callUrl).toContain("api_key=test-api-key-123");
    });

    it("should not include API key in URL if not set", async () => {
      delete process.env.NCBI_API_KEY;

      const mockResponse = {
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(">test\nATGC"),
      };

      rateLimitedFetchSpy.mockResolvedValue(mockResponse);

      await fetchFromNCBI("NM_000123.4");

      const callUrl = rateLimitedFetchSpy.mock.calls[0][0];
      expect(callUrl).not.toContain("api_key");
    });

    it("should throw error if no data returned", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(""),
      };

      rateLimitedFetchSpy.mockResolvedValue(mockResponse);

      await expect(fetchFromNCBI("NM_000123.4")).rejects.toThrow(
        "No data returned for NM_000123.4"
      );
    });

    it("should throw error if only whitespace returned", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue("   \n\t  "),
      };

      rateLimitedFetchSpy.mockResolvedValue(mockResponse);

      await expect(fetchFromNCBI("NM_000123.4")).rejects.toThrow(
        "No data returned for NM_000123.4"
      );
    });
  });

  describe("searchNCBI", () => {
    it("should search NCBI and return ID list", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          esearchresult: {
            idlist: ["12345", "67890", "11111"],
          },
        }),
      };

      rateLimitedFetchSpy.mockResolvedValue(mockResponse);

      const result = await searchNCBI("FOXP2[Gene Name]", 20);

      expect(rateLimitedFetchSpy).toHaveBeenCalled();
      const callUrl = rateLimitedFetchSpy.mock.calls[0][0];
      expect(callUrl).toContain("esearch.fcgi");
      expect(callUrl).toContain("db=nuccore");
      expect(callUrl).toContain("term=FOXP2%5BGene+Name%5D");
      expect(callUrl).toContain("retmax=20");
      expect(callUrl).toContain("retmode=json");
      expect(result).toEqual(["12345", "67890", "11111"]);
    });

    it("should use default retmax if not provided", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          esearchresult: {
            idlist: ["12345"],
          },
        }),
      };

      rateLimitedFetchSpy.mockResolvedValue(mockResponse);

      await searchNCBI("test query");

      const callUrl = rateLimitedFetchSpy.mock.calls[0][0];
      expect(callUrl).toContain("retmax=20");
    });

    it("should include API key in URL if available", async () => {
      process.env.NCBI_API_KEY = "test-key-456";

      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          esearchresult: {
            idlist: ["123"],
          },
        }),
      };

      rateLimitedFetchSpy.mockResolvedValue(mockResponse);

      await searchNCBI("test");

      const callUrl = rateLimitedFetchSpy.mock.calls[0][0];
      expect(callUrl).toContain("api_key=test-key-456");
    });

    it("should throw error if no results found", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          esearchresult: {},
        }),
      };

      rateLimitedFetchSpy.mockResolvedValue(mockResponse);

      await expect(searchNCBI("nonexistent")).rejects.toThrow("No results found");
    });

    it("should throw error if idlist is missing", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          esearchresult: {
            count: "0",
          },
        }),
      };

      rateLimitedFetchSpy.mockResolvedValue(mockResponse);

      await expect(searchNCBI("test")).rejects.toThrow("No results found");
    });
  });

  describe("getSummaries", () => {
    it("should fetch summaries for multiple IDs", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          result: {
            "12345": {
              accessionversion: "NM_000123.4",
              title: "Test gene 1",
              slen: 1000,
            },
            "67890": {
              accessionversion: "NM_000456.7",
              title: "Test gene 2",
              slen: 2000,
            },
          },
        }),
      };

      rateLimitedFetchSpy.mockResolvedValue(mockResponse);

      const result = await getSummaries(["12345", "67890"]);

      expect(rateLimitedFetchSpy).toHaveBeenCalled();
      const callUrl = rateLimitedFetchSpy.mock.calls[0][0];
      expect(callUrl).toContain("esummary.fcgi");
      expect(callUrl).toContain("db=nuccore");
      // URL encodes comma as %2C
      expect(callUrl).toContain("id=12345%2C67890");
      expect(callUrl).toContain("retmode=json");

      expect(result).toEqual([
        {
          id: "12345",
          accession: "NM_000123.4",
          title: "Test gene 1",
          length: 1000,
        },
        {
          id: "67890",
          accession: "NM_000456.7",
          title: "Test gene 2",
          length: 2000,
        },
      ]);
    });

    it("should handle missing IDs in response", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          result: {
            "12345": {
              accessionversion: "NM_000123.4",
              title: "Test gene",
              slen: 1000,
            },
            // 67890 is missing
          },
        }),
      };

      rateLimitedFetchSpy.mockResolvedValue(mockResponse);

      const result = await getSummaries(["12345", "67890"]);

      expect(result).toEqual([
        {
          id: "12345",
          accession: "NM_000123.4",
          title: "Test gene",
          length: 1000,
        },
        // 67890 is not included because it's missing from response
      ]);
    });

    it("should throw error if no result data", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({}),
      };

      rateLimitedFetchSpy.mockResolvedValue(mockResponse);

      await expect(getSummaries(["12345"])).rejects.toThrow(
        "No summary data returned"
      );
    });

    it("should include API key in URL if available", async () => {
      process.env.NCBI_API_KEY = "test-key-789";

      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          result: {
            "12345": {
              accessionversion: "NM_000123.4",
              title: "Test",
              slen: 1000,
            },
          },
        }),
      };

      rateLimitedFetchSpy.mockResolvedValue(mockResponse);

      await getSummaries(["12345"]);

      const callUrl = rateLimitedFetchSpy.mock.calls[0][0];
      expect(callUrl).toContain("api_key=test-key-789");
    });
  });

  describe("getSequenceData", () => {
    const testCacheDir = "/tmp/test-cache";
    const testAccession = "NM_000123.4";
    const testCacheFile = path.join(testCacheDir, `${testAccession}.txt`);
    const mockFastaData = ">NM_000123.4 Test sequence\nATGCGATCGATCGATCG";
    let originalExistsSync;
    let originalReadFileSync;
    let originalWriteFileSync;
    let originalMkdirSync;
    let originalLog;

    beforeEach(() => {
      originalExistsSync = fs.existsSync;
      originalReadFileSync = fs.readFileSync;
      originalWriteFileSync = fs.writeFileSync;
      originalMkdirSync = fs.mkdirSync;
      originalLog = console.log;

      vi.spyOn(fs, "existsSync");
      vi.spyOn(fs, "readFileSync");
      vi.spyOn(fs, "writeFileSync").mockImplementation(() => {});
      vi.spyOn(fs, "mkdirSync").mockImplementation(() => {});
      vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
      fs.existsSync = originalExistsSync;
      fs.readFileSync = originalReadFileSync;
      fs.writeFileSync = originalWriteFileSync;
      fs.mkdirSync = originalMkdirSync;
      console.log = originalLog;
    });

    it("should return cached data if file exists", async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(mockFastaData);

      const result = await getSequenceData(testAccession, testCacheDir);

      expect(fs.existsSync).toHaveBeenCalledWith(testCacheFile);
      expect(fs.readFileSync).toHaveBeenCalledWith(testCacheFile, "utf8");
      expect(rateLimitedFetchSpy).not.toHaveBeenCalled();
      expect(result).toBe(mockFastaData);
      expect(console.log).toHaveBeenCalledWith(
        `Using cached data: ${testAccession}`
      );
    });

    it("should fetch from NCBI if not cached", async () => {
      fs.existsSync.mockReturnValue(false);

      const mockResponse = {
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(mockFastaData),
      };

      rateLimitedFetchSpy.mockResolvedValue(mockResponse);

      const result = await getSequenceData(testAccession, testCacheDir);

      expect(fs.existsSync).toHaveBeenCalledWith(testCacheFile);
      expect(rateLimitedFetchSpy).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        testCacheFile,
        mockFastaData,
        "utf8"
      );
      expect(result).toBe(mockFastaData);
      expect(console.log).toHaveBeenCalledWith(
        `Fetching from NCBI: ${testAccession}...`
      );
      expect(console.log).toHaveBeenCalledWith(
        `Cached data: ${testAccession}`
      );
    });

    it("should throw error if fetch fails", async () => {
      fs.existsSync.mockReturnValue(false);

      const mockResponse = {
        ok: false,
        status: 500,
      };

      rateLimitedFetchSpy.mockResolvedValue(mockResponse);

      await expect(
        getSequenceData(testAccession, testCacheDir)
      ).rejects.toThrow("Failed to fetch NM_000123.4 from NCBI");
    });

    it("should handle network errors during fetch", async () => {
      fs.existsSync.mockReturnValue(false);
      rateLimitedFetchSpy.mockRejectedValue(new Error("Network timeout"));

      await expect(
        getSequenceData(testAccession, testCacheDir)
      ).rejects.toThrow("Failed to fetch NM_000123.4 from NCBI");
    });
  });
});
