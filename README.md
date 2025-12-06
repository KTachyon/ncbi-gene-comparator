# DNA Sequence Comparison Tool

A modular DNA sequence comparison tool with NCBI integration, conserved blocks detection, and amino acid translation. Designed for comparing orthologous genes across species (Human, Rhesus Monkey, House Mouse).

## Features

- **NCBI Integration**: Fetch sequences directly from NCBI using accession numbers or search by gene name
- **Smart Caching**: Automatically cache downloaded sequences locally
- **Best Alignment**: Finds optimal alignment allowing both sequences to have offsets (minimum 50% overlap)
- **Conserved Blocks**: Identifies well-conserved regions (≥67% identity in 66bp windows)
- **Amino Acid Translation**: Translates and compares protein sequences with automatic reading frame detection
- **Rate Limiting**: Built-in rate limiting and retry logic for NCBI API calls
- **Batch Processing**: Compare multiple orthologous genes across species pairs
- **Gene Mapping**: Cache gene-to-accession mappings to avoid redundant NCBI searches

## Installation

```bash
npm install
```

The Rust WASM module is pre-built and included in the repository. If you need to rebuild it (e.g., after modifying Rust code):

```bash
cd wasm
bash build.sh
```

**Prerequisites for rebuilding WASM:**
- Rust toolchain (`rustup`)
- `wasm-pack` (`cargo install wasm-pack`)
- `wasm32-unknown-unknown` target (`rustup target add wasm32-unknown-unknown`)

## Usage

### 1. Compare Two Sequences by Gene Name

```bash
node compare.js FOXP2
```

Automatically compares Human-Rhesus and Human-Mouse using cached gene-map.json.

### 2. Compare Two Sequences by Accession

```bash
node compare.js NM_148900.4 NM_053242.4
```

Direct comparison of two NCBI accession numbers.

### 3. Find Orthologs

```bash
# Interactive mode
node find-orthologs.js FOXP2

# Auto-select first result for each species
node find-orthologs.js FOXP2 --auto

# Auto-select and run comparison
node find-orthologs.js FOXP2 --auto --compare

# Only use NM_ (curated) sequences
node find-orthologs.js FOXP2 --auto --nm-only
```

Searches NCBI for orthologous genes across Human, Rhesus Monkey, and House Mouse. Results are cached in `gene-map.json`.

### 4. Batch Comparison

```bash
# Compare all genes in the gene list
node batch-compare.js

# Only compare genes with NM_ sequences (exclude XM_ predicted)
node batch-compare.js --nm-only
```

Batch comparison of 111 curated genes across 3 species. Calculates average identity rates and identifies fragmented alignments.

## Project Structure

```
dna/
├── compare.js                 # Main comparison CLI (gene name or accession)
├── find-orthologs.js          # Find and cache orthologous genes
├── batch-compare.js           # Batch processing of multiple genes
├── gene-map.json              # Cached gene-to-accession mappings
├── lib/
│   ├── ncbi.js                # NCBI API (ESearch, ESummary, EFetch) + caching + rate limiting
│   ├── parser.js              # FASTA format parsing
│   ├── validator.js           # Sequence normalization and validation
│   ├── comparison.js          # Rust WASM comparison engine (singleton initialization)
│   ├── sequence-loader.js     # Sequence fetching and comparison orchestration
│   ├── formatter.js           # Console output formatting
│   ├── cache.js               # Gene map and sequence caching
│   ├── genes.js               # Gene list management
│   ├── logger.js              # Logging utilities
│   └── constants.js           # Configuration constants
├── wasm/
│   └── rust/                  # Rust WASM implementation
│       ├── src/lib.rs         # Rust source code
│       └── pkg/               # Built WASM module (committed)
└── seqs/                      # Cached sequences (created automatically)
```

## Module Documentation

### lib/ncbi.js
Unified NCBI API interface with rate limiting and caching.

**Exports:**
- `fetchFromNCBI(accession)` - Fetch raw FASTA from NCBI (EFetch)
- `getSequenceData(accession, cacheDir)` - Get from cache or fetch
- `searchNCBI(query, retmax)` - Search NCBI for sequences (ESearch)
- `getSummaries(ids)` - Get summary information for IDs (ESummary)

All API calls are rate-limited to 2 requests/second (500ms between requests) with exponential backoff retry on 429 errors.

### lib/parser.js
**Exports:**
- `parseFasta(fastaData)` - Parse FASTA format into `{ header, sequence }`

### lib/validator.js
**Exports:**
- `normalizeSeq(seq)` - Normalize sequence (uppercase, remove spaces)
- `validateDNA(seq)` - Validate DNA sequence (A, C, G, T, N, - only)

### lib/comparison.js
Rust WASM-powered comparison engine. Uses singleton pattern - initializes once and returns cached instance.

**Initialization:**
- `init()` - Initialize comparison engine (returns object with all functions, singleton pattern)

**Exports (from init() return object):**
- `compareSequences(seq1, seq2)` - Find best alignment allowing offsets (WASM)
- `compareProteins(seq1, seq2, nucResult)` - Full protein comparison with automatic reading frame detection (fully implemented in Rust WASM with logging)

The engine tries all 9 reading frame combinations (3×3) and selects the best amino acid alignment. Returns alignment with offsets, identity percentage, and conserved blocks. Filters out blocks < 15% of largest block.

### lib/sequence-loader.js
**Exports:**
- `runSingleComparison(acc1, acc2)` - Load sequences from NCBI, validate, and run nucleotide comparison

Orchestrates fetching, parsing, validation, and comparison. Automatically initializes comparison engine.

### lib/formatter.js
**Exports:**
- `printComparison(label, result)` - Print formatted comparison with conserved blocks

## Algorithm

### Nucleotide Comparison
1. Try all possible alignments requiring ≥50% overlap of shorter sequence
2. Select alignment with best identity percentage
3. Identify conserved blocks:
   - Use 66bp sliding windows with ≥67% identity threshold
   - Filter out blocks < 15% size of largest block
   - Only substantial conserved regions are reported

### Amino Acid Comparison
1. Extract aligned nucleotide regions from best nucleotide alignment
2. Try all 9 reading frame combinations (3 frames × 3 frames)
3. Select frame combination with best amino acid identity
4. Detect conserved blocks on amino acid sequence (10 AA windows, ≥67% identity)
5. Report blocks separately from nucleotide blocks

This ensures proper codon alignment even when nucleotide alignment doesn't preserve reading frames (e.g., when 5' UTR causes frame shifts).

## Gene Map Cache

The `gene-map.json` file caches search results:

```json
{
  "genes": {
    "FOXP2": {
      "human": "NM_148900.4",
      "rhesus": "NM_001033021.1",
      "mouse": "NM_053242.4"
    }
  },
  "metadata": {
    "lastUpdated": "2025-12-02T...",
    "totalGenes": 111
  }
}
```

This avoids redundant NCBI API calls when re-running comparisons.

## RefSeq Sequence Types

- **NM_** - Curated mRNA sequences (gold standard, manually reviewed)
- **XM_** - Predicted mRNA sequences (computational models, may have errors)
- **NC_** - Chromosome sequences (full chromosomes, not gene-specific)

Use `--nm-only` flag to exclude XM_ sequences in batch comparisons.

## Output Indicators

- **⚠** - Gene has multiple conserved blocks (fragmented alignment)
  - May indicate structural differences, insertions/deletions, or divergent regions
- **Highlighted percentages** - Green background shows highest identity for each gene

## License

ISC
