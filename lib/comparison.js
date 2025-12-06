// Sequence comparison and alignment utilities
// Rust WASM implementation - returns object with comparison functions

import {
  SEGMENT_WINDOW_LENGTH,
  MIN_IDENTITY,
  MIN_SIGNIFICANT_LENGTH_GROUP,
  MIN_SEQUENCE_OVERLAP_PCT,
  AA_SEGMENT_WINDOW_LENGTH
} from "./constants.js";

// ============================================================================
// Initialization - returns object with all comparison functions
// Singleton pattern: only initializes once, returns cached instance
// ============================================================================

let comparisonInstance = null;
let initPromise = null;

export async function init() {
  // Return cached instance if already initialized
  if (comparisonInstance) {
    return comparisonInstance;
  }
  
  // If initialization is in progress, wait for it
  if (initPromise) {
    return initPromise;
  }
  
  // Start initialization
  initPromise = (async () => {
    // Load Rust WASM module
    let wasm;
    try {
      wasm = await import("../wasm/rust/pkg/dna_wasm_rust.js");
    } catch (e) {
      throw new Error(`Failed to load Rust WASM: ${e.message}`);
    }

    console.log("✅ Rust WASM engine loaded");

    // ============================================================================
    // Full Sequence Comparison (WASM)
    // ============================================================================

    const compareSequences = (seq1, seq2) => JSON.parse(
      wasm.compare_sequences_full(
        seq1, seq2,
        SEGMENT_WINDOW_LENGTH,
        MIN_IDENTITY,
        MIN_SIGNIFICANT_LENGTH_GROUP,
        MIN_SEQUENCE_OVERLAP_PCT
      )
    );

    // ============================================================================
    // Protein Comparison (WASM - fully implemented in Rust)
    // ============================================================================

    const compareProteins = (seq1, seq2, nucResult) => {
      // Call WASM function - it handles all logging and computation
      const parsed = JSON.parse(
        wasm.compare_proteins_full(
          seq1, seq2,
          nucResult.offset1, nucResult.offset2, nucResult.length,
          AA_SEGMENT_WINDOW_LENGTH,
          MIN_IDENTITY,
          MIN_SIGNIFICANT_LENGTH_GROUP
        )
      );
      
      // Return in the expected format
      return {
        aa1: parsed.aa1,
        aa2: parsed.aa2,
        result: {
          mask: parsed.mask,
          mismatches: parsed.mismatches,
          length: parsed.length,
          identity: parsed.identity,
          truncated: parsed.truncated,
          offset1: parsed.offset1,
          offset2: parsed.offset2,
          frame1: parsed.frame1,
          frame2: parsed.frame2,
          conservedBlocks: parsed.conservedBlocks
        }
      };
    };

    // Return object with all comparison functions
    const instance = {
      compareSequences,
      compareProteins,
      wasm
    };
    
    // Cache the instance
    comparisonInstance = instance;
    return instance;
  })();
  
  return initPromise;
}
