# WASM Rust Implementation

This directory contains the Rust WebAssembly implementation of DNA sequence comparison functions.

## Architecture

The comparison engine is implemented in Rust and compiled to WebAssembly for high performance. The WASM module is loaded by `lib/comparison.js` which provides a JavaScript interface with singleton initialization.

## Prerequisites

To rebuild the WASM module, you need:

1. **Rust toolchain**:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   source ~/.cargo/env
   ```

2. **wasm-pack** (for building Rust to WASM):
   ```bash
   cargo install wasm-pack
   ```

3. **wasm32 target**:
   ```bash
   rustup target add wasm32-unknown-unknown
   ```

## Building

The WASM module is pre-built and committed to the repository. To rebuild:

```bash
cd wasm
bash build.sh
```

Or manually:

```bash
cd wasm/rust
wasm-pack build --target nodejs --release
```

The build output goes to `wasm/rust/pkg/` and is committed to the repository so users don't need Rust toolchain installed.

## Module Structure

- `src/lib.rs` - Rust source code with all comparison functions
- `pkg/` - Built WASM module (committed to git)
  - `dna_wasm_rust.js` - JavaScript bindings
  - `dna_wasm_rust_bg.wasm` - Compiled WebAssembly binary
  - `*.d.ts` - TypeScript definitions

## Exported Functions

The Rust WASM module exports:

1. **translate_dna(seq: &str) -> String** - DNA to protein translation
2. **compare_sequences_full(seq1: &str, seq2: &str) -> String** - Full nucleotide sequence comparison
3. **compare_proteins_full(seq1: &str, seq2: &str, nuc_offset1: i32, nuc_offset2: i32, nuc_length: i32) -> String** - Full protein comparison with reading frame detection

All functions return JSON strings that are parsed by the JavaScript wrapper in `lib/comparison.js`.
