// Tests for logger utilities

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createLogger } from "../lib/logger.js";

describe("Logger", () => {
  let consoleLogSpy;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createLogger", () => {
    it("should create logger with default silent=false", () => {
      const logger = createLogger();
      
      expect(logger).toBeDefined();
      expect(typeof logger.log).toBe("function");
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.warn).toBe("function");
    });

    it("should create logger with explicit silent=false", () => {
      const logger = createLogger(false);
      
      expect(logger).toBeDefined();
    });

    it("should create logger with silent=true", () => {
      const logger = createLogger(true);
      
      expect(logger).toBeDefined();
    });
  });

  describe("log method", () => {
    it("should call console.log when silent is false", () => {
      const logger = createLogger(false);
      
      logger.log("test message");
      
      expect(consoleLogSpy).toHaveBeenCalledWith("test message");
    });

    it("should pass multiple arguments to console.log", () => {
      const logger = createLogger(false);
      
      logger.log("message", 123, { key: "value" });
      
      expect(consoleLogSpy).toHaveBeenCalledWith("message", 123, { key: "value" });
    });

    it("should NOT call console.log when silent is true", () => {
      const logger = createLogger(true);
      
      logger.log("test message");
      
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe("error method", () => {
    it("should call console.error when silent is false", () => {
      const logger = createLogger(false);
      
      logger.error("error message");
      
      expect(consoleErrorSpy).toHaveBeenCalledWith("error message");
    });

    it("should NOT call console.error when silent is true", () => {
      const logger = createLogger(true);
      
      logger.error("error message");
      
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe("warn method", () => {
    it("should call console.warn when silent is false", () => {
      const logger = createLogger(false);
      
      logger.warn("warning message");
      
      expect(consoleWarnSpy).toHaveBeenCalledWith("warning message");
    });

    it("should NOT call console.warn when silent is true", () => {
      const logger = createLogger(true);
      
      logger.warn("warning message");
      
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });
});

