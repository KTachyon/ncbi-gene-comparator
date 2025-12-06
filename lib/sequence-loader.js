// Sequence loading and initial comparison utilities
// Orchestrates fetching, parsing, validation, and nucleotide comparison

import { getSequenceData } from "./ncbi.js";
import { parseFasta } from "./parser.js";
import { normalizeSeq, validateDNA } from "./validator.js";
import { getSequenceCacheFolder } from "./cache.js";
import { init as initComparison } from "./comparison.js";

// Load and compare two sequences by accession
// Returns parsed sequences and nucleotide comparison result
export async function runSingleComparison(acc1, acc2) {
  const sequenceCacheFolder = getSequenceCacheFolder();

  // Fetch and parse sequences
  const fasta1 = await getSequenceData(acc1, sequenceCacheFolder);
  const fasta2 = await getSequenceData(acc2, sequenceCacheFolder);
  
  const seq1Data = parseFasta(fasta1);
  const seq2Data = parseFasta(fasta2);

  const seq1 = normalizeSeq(seq1Data.sequence);
  const seq2 = normalizeSeq(seq2Data.sequence);

  // Validate sequences
  validateDNA(seq1);
  validateDNA(seq2);

  // Nucleotide-level comparison (finds best alignment)
  const nucResult = (await initComparison()).compareSequences(seq1, seq2);
  
  return {
    seq1Data,
    seq2Data,
    seq1,
    seq2,
    nucResult
  };
}
