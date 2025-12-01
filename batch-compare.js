#!/usr/bin/env node

// Batch comparison of orthologous genes across species
// Finds orthologs, runs comparisons, and calculates average identity rates

import { findOrthologs } from "./find-orthologs.js";
import { runSingleComparison } from "./lib/sequence-loader.js";
import { compareProteins } from "./lib/protein-comparison.js";
import { MAX_LINE_LENGTH } from "./lib/constants.js";
import { getGeneNames } from "./lib/genes.js";

const GENE_LIST = getGeneNames();

// ============================================================================
// CONFIGURATION
// ============================================================================

// Organism configuration - add/remove/modify organisms here
const ORGANISMS = {
  human: { id: 'human', label: 'Human', shortLabel: 'H' },
  rhesus: { id: 'rhesus', label: 'Rhesus', shortLabel: 'R' },
  mouse: { id: 'mouse', label: 'Mouse', shortLabel: 'M' }
};

// Comparison pairs - define which organisms to compare
// Each pair is [organism1_id, organism2_id]
const COMPARISON_PAIRS = [
  ['human', 'rhesus'],
  ['human', 'mouse'],
  ['rhesus', 'mouse']
];

// Generate comparison labels and keys
const COMPARISONS_CONFIG = COMPARISON_PAIRS.map(([org1, org2]) => ({
  key: `${ORGANISMS[org1].label}-${ORGANISMS[org2].label}`,
  org1,
  org2,
  label: `${ORGANISMS[org1].label}-${ORGANISMS[org2].label}`,
  shortLabel: `${ORGANISMS[org1].shortLabel}${ORGANISMS[org2].shortLabel}`
}));

// Calculate identity over CONSERVED BLOCKS only (like compare.js does)
const calculateBlockIdentity = (blocks) => {
  if (!blocks || blocks.length === 0) return 0;
  
  const { totalLength, totalMismatches } = blocks.reduce(
    (acc, block) => ({
      totalLength: acc.totalLength + block.length,
      totalMismatches: acc.totalMismatches + (block.sequence.match(/\?/g) || []).length
    }),
    { totalLength: 0, totalMismatches: 0 }
  );
  
  return totalLength > 0 ? (1 - totalMismatches / totalLength) : 0;
};

// Run comparison and extract identity rates
const runComparison = async (accession1, accession2, silent = true) => {
  try {
    // Use shared comparison logic from sequence-loader
    const { seq1, seq2, nucResult } = await runSingleComparison(accession1, accession2);
    
    // Amino acid comparison
    const { result: aaResult } = compareProteins(seq1, seq2, nucResult);
    
    const nucConservedIdentity = calculateBlockIdentity(nucResult.conservedBlocks);
    const aaConservedIdentity = calculateBlockIdentity(aaResult.conservedBlocks);
    
    // Calculate total conserved block length
    const nucConservedLength = nucResult.conservedBlocks.reduce((sum, b) => sum + b.length, 0);
    const aaConservedLength = aaResult.conservedBlocks.reduce((sum, b) => sum + b.length, 0);
    
    // Calculate alignment coverage
    const seq1Coverage = nucResult.length / seq1.length;
    const seq2Coverage = nucResult.length / seq2.length;
    
    return {
      accession1,
      accession2,
      seq1Length: seq1.length,
      seq2Length: seq2.length,
      alignmentLength: nucResult.length,
      alignmentOffset1: nucResult.offset1,
      alignmentOffset2: nucResult.offset2,
      seq1Coverage: seq1Coverage,
      seq2Coverage: seq2Coverage,
      // Overall alignment identity (raw)
      overallNucIdentity: nucResult.identity,
      overallAAIdentity: aaResult.identity,
      // Conserved blocks identity (what compare.js shows)
      nucleotideIdentity: nucConservedIdentity,
      aminoAcidIdentity: aaConservedIdentity,
      nucConservedLength: nucConservedLength,
      aaConservedLength: aaConservedLength,
      numNucBlocks: nucResult.conservedBlocks.length,
      numAABlocks: aaResult.conservedBlocks.length,
    };
  } catch (err) {
    if (!silent) {
      console.error(`Error comparing ${accession1} vs ${accession2}: ${err.message}`);
    }
    return null;
  }
};

// Main
(async () => {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node batch-compare.js [--nm-only]');
    console.log('');
    console.log(`Batch comparison of ${GENE_LIST.length} orthologous genes across ${Object.keys(ORGANISMS).length} species`);
    console.log('');
    console.log('Options:');
    console.log('  --nm-only       Only use NM_ (curated) sequences, skip XM_ (predicted)');
    console.log('');
    console.log('This script will:');
    console.log(`  1. Find orthologs for ${GENE_LIST.length} curated genes (uses cached results when available)`);
    console.log(`  2. Run ${GENE_LIST.length * COMPARISON_PAIRS.length} pairwise comparisons (${GENE_LIST.length} genes × ${COMPARISON_PAIRS.length} pairs)`);
    console.log('  3. Calculate average identity rates per species pair');
    console.log('  4. Save results to batch-results.json');
    console.log('');
    console.log('How it works:');
    console.log('  - Finds best alignment allowing offsets in both sequences');
    console.log('  - Requires minimum 50% overlap of shorter sequence');
    console.log('  - Filters to CONSERVED BLOCKS (60bp windows with ≥65% identity)');
    console.log('  - Identity = matches / conserved_blocks_length');
    console.log('  - Only includes genes with conserved blocks in all 3 pairs');
    console.log('  - Genes with ⚠ have multiple blocks (fragmented alignment)');
    console.log('');
    console.log('RefSeq Types:');
    console.log('  NM_ = Curated mRNA (gold standard)');
    console.log('  XM_ = Predicted mRNA (computational model)');
    console.log('');
    console.log(`Species: ${Object.values(ORGANISMS).map(o => o.label).join(', ')}`);
    console.log(`Comparisons: ${COMPARISONS_CONFIG.map(c => c.label).join(', ')}`);
    process.exit(0);
  }
  
  const nmOnly = args.includes('--nm-only');
  
  console.log(`\n${"=".repeat(MAX_LINE_LENGTH)}`);
  console.log(`BATCH ORTHOLOG COMPARISON`);
  console.log(`${"=".repeat(MAX_LINE_LENGTH)}\n`);
  
  console.log(`Total genes to process: ${GENE_LIST.length}`);
  console.log(`Species: ${Object.values(ORGANISMS).map(o => o.label).join(', ')}`);
  console.log(`Total comparisons: ${GENE_LIST.length * COMPARISON_PAIRS.length} (${GENE_LIST.length} genes × ${COMPARISON_PAIRS.length} species pairs)`);
  if (nmOnly) {
    console.log(`Filter: NM_ sequences only (excluding XM_ predicted sequences)`);
  }
  console.log('');
  
  // Step 1: Find/verify all orthologs
  console.log(`${"=".repeat(MAX_LINE_LENGTH)}`);
  console.log(`STEP 1: Finding Orthologs`);
  console.log(`${"=".repeat(MAX_LINE_LENGTH)}\n`);
  
  const geneResults = {};
  
  for (const gene of GENE_LIST) {
    console.log(`Processing ${gene}...`);
    
    try {
      const result = await findOrthologs(gene, { 
        autoSelect: true, 
        runComparison: false,
        silent: true
      });
      
      if (result && Object.keys(result.accessions).length === 3) {
        geneResults[gene] = result.accessions;
        console.log(`  ✓ ${gene}: Found all 3 orthologs ${result.fromCache ? '(cached)' : '(new)'}`);
      } else if (result) {
        console.log(`  ⚠️  ${gene}: Only found ${Object.keys(result.accessions).length}/3 orthologs`);
        geneResults[gene] = result.accessions;
      } else {
        console.log(`  ✗ ${gene}: No results found`);
      }
    } catch (err) {
      console.log(`  ✗ ${gene}: Error - ${err.message}`);
    }
  }
  
  console.log('');
  
  // Filter to only genes with all 3 orthologs
  let completeGenes = Object.entries(geneResults)
    .filter(([_, acc]) => Object.keys(acc).length === 3)
    .map(([gene, _]) => gene);
  
  console.log(`\n✓ ${completeGenes.length}/${GENE_LIST.length} genes have all 3 orthologs`);
  
  // Filter out XM sequences if --nm-only flag is set
  if (nmOnly) {
    const hasXM = (gene) => {
      const accessions = Object.values(geneResults[gene]);
      return accessions.some(acc => acc?.startsWith('XM_'));
    };
    
    const genesWithXM = completeGenes.filter(hasXM);
    completeGenes = completeGenes.filter(gene => !hasXM(gene));
    
    if (genesWithXM.length > 0) {
      console.log(`✗ ${genesWithXM.length} genes excluded due to XM_ sequences: ${genesWithXM.join(', ')}`);
    }
    console.log(`✓ ${completeGenes.length} genes with NM_ sequences only\n`);
  } else {
    console.log('');
  }
  
  if (completeGenes.length === 0) {
    console.log('No complete gene sets found. Exiting.');
    process.exit(1);
  }
  
  // Step 2: Run all comparisons
  console.log(`${"=".repeat(MAX_LINE_LENGTH)}`);
  console.log(`STEP 2: Running Pairwise Comparisons`);
  console.log(`${"=".repeat(MAX_LINE_LENGTH)}`);
  console.log(`Note: Identity is calculated over CONSERVED BLOCKS only (≥70% identity windows)`);
  console.log(`      This matches the output from compare.js\n`);
  
  // Initialize comparison results object dynamically
  const comparisons = {};
  COMPARISONS_CONFIG.forEach(config => {
    comparisons[config.key] = [];
  });
  
  const fullyComparedGenes = [];
  
  for (const gene of completeGenes) {
    console.log(`Comparing ${gene}...`);
    const acc = geneResults[gene];
    
    // Run all configured comparisons
    const results = {};
    for (const config of COMPARISONS_CONFIG) {
      results[config.key] = await runComparison(acc[config.org1], acc[config.org2]);
    }
    
    // Only include if all comparisons succeeded AND have conserved blocks
    const hasConservedBlocks = (result) => result && result.nucConservedLength > 0 && result.aaConservedLength > 0;
    const allSuccessful = COMPARISONS_CONFIG.every(config => hasConservedBlocks(results[config.key]));
    
    if (allSuccessful) {
      // Add results to comparisons
      for (const config of COMPARISONS_CONFIG) {
        comparisons[config.key].push({ gene, ...results[config.key] });
      }
      fullyComparedGenes.push(gene);
      
      // Print results
      for (const config of COMPARISONS_CONFIG) {
        const r = results[config.key];
        console.log(`  ${config.label.padEnd(14)}: ${(r.nucleotideIdentity * 100).toFixed(1)}% nt, ${(r.aminoAcidIdentity * 100).toFixed(1)}% aa | ${r.nucConservedLength}bp conserved (${r.numNucBlocks} blocks)`);
      }
    } else {
      const anyFailed = COMPARISONS_CONFIG.some(config => !results[config.key]);
      if (anyFailed) {
        console.log(`  ✗ Comparison failed for one or more pairs, skipping ${gene}`);
      } else {
        console.log(`  ✗ No conserved blocks found in one or more pairs, skipping ${gene}`);
      }
    }
    
    console.log('');
  }
  
  console.log(`\n✓ ${fullyComparedGenes.length}/${completeGenes.length} genes successfully compared with conserved blocks in all ${COMPARISON_PAIRS.length} pairs\n`);
  
  if (fullyComparedGenes.length === 0) {
    console.log(`No genes with conserved blocks in all ${COMPARISON_PAIRS.length} comparisons. Cannot calculate averages.`);
    console.log('\nThis may happen if:');
    console.log('  - Sequences are too divergent (no conserved blocks)');
    console.log('  - Sequences failed to align properly');
    console.log('  - Try adjusting conserved block thresholds in lib/comparison.js');
    process.exit(1);
  }
  
  // Step 3: Calculate averages
  console.log(`${"=".repeat(MAX_LINE_LENGTH)}`);
  console.log(`STEP 3: Average Identity Rates (Conserved Blocks Only)`);
  console.log(`${"=".repeat(MAX_LINE_LENGTH)}\n`);
  
  const calculateAverage = (arr, key) => {
    if (arr.length === 0) return 0;
    return arr.reduce((sum, item) => sum + item[key], 0) / arr.length;
  };
  
  console.log(`Overall Average Identity (over conserved blocks):\n`);
  
  for (const [pair, results] of Object.entries(comparisons)) {
    const avgNuc = calculateAverage(results, 'nucleotideIdentity');
    const avgAA = calculateAverage(results, 'aminoAcidIdentity');
    
    console.log(`${pair.padEnd(15)}: ${(avgNuc * 100).toFixed(1)}% nucleotide, ${(avgAA * 100).toFixed(1)}% amino acid (n=${results.length})`);
  }
  
  // Step 4: Detailed results table
  console.log(`${"=".repeat(MAX_LINE_LENGTH)}`);
  console.log(`DETAILED RESULTS`);
  console.log(`${"=".repeat(MAX_LINE_LENGTH)}`);
  console.log(`⚠ = Multiple conserved blocks (fragmented alignment)\n`);
  
  const spacing = '        '; // 8 spaces between columns
  
  const formatPct = (nuc, aa, conservedBp, highlightNuc = false, highlightAA = false, highlightBp = false) => {
    // Check for null/undefined explicitly, not just falsy (0 is valid but shows as no match)
    if (nuc === null || nuc === undefined || aa === null || aa === undefined) {
      return '    -        -        -  ';
    }
    
    // Format with consistent width: " 99.1%" or "100.0%" (5 digits + %)
    const nucStr = `${(nuc * 100).toFixed(1).padStart(5)}%`;
    const aaStr = `${(aa * 100).toFixed(1).padStart(5)}%`;
    const bpStr = `${(conservedBp || 0)}bp`.padStart(6);
    
    // Apply green background to highest values
    const nucFormatted = highlightNuc ? `\x1b[42m\x1b[30m${nucStr}\x1b[0m` : nucStr;
    const aaFormatted = highlightAA ? `\x1b[42m\x1b[30m${aaStr}\x1b[0m` : aaStr;
    const bpFormatted = highlightBp ? `\x1b[42m\x1b[30m${bpStr}\x1b[0m` : bpStr;
    
    // Fixed visible width: 6 chars for nuc + 2 spaces + 6 chars for aa + 2 spaces + 6 chars for bp
    return `${nucFormatted}  ${aaFormatted}  ${bpFormatted}`;
  };
  
  // Print table headers with proper alignment
  // Each column: " 99.1%  99.1%  1234bp" = 22 visible chars
  const headerRow1 = `Gene`.padEnd(10) + COMPARISONS_CONFIG.map(c => c.label.padEnd(22)).join(spacing);
  const headerRow2 = `    `.padEnd(10) + COMPARISONS_CONFIG.map(() => `   nt%     aa%      bp`).join(spacing);
  
  console.log(headerRow1);
  console.log(headerRow2);
  console.log(`${"─".repeat(100)}`);
  
  for (const gene of fullyComparedGenes) {
    // Get results for all configured comparisons
    const geneResults = {};
    for (const config of COMPARISONS_CONFIG) {
      geneResults[config.key] = comparisons[config.key].find(r => r.gene === gene);
    }
    
    // Find max nucleotide, amino acid identity, and bp length for this gene
    const nucValues = COMPARISONS_CONFIG.map(c => geneResults[c.key]?.nucleotideIdentity).filter(v => v !== null && v !== undefined);
    const aaValues = COMPARISONS_CONFIG.map(c => geneResults[c.key]?.aminoAcidIdentity).filter(v => v !== null && v !== undefined);
    const bpValues = COMPARISONS_CONFIG.map(c => geneResults[c.key]?.nucConservedLength).filter(v => v !== null && v !== undefined);
    
    const maxNuc = Math.max(...nucValues);
    const maxAA = Math.max(...aaValues);
    const maxBp = Math.max(...bpValues);
    
    // Check if any comparison has multiple blocks (fragmented alignment)
    const hasMultipleBlocks = COMPARISONS_CONFIG.some(c => {
      const r = geneResults[c.key];
      return r && (r.numNucBlocks > 1 || r.numAABlocks > 1);
    });
    
    const geneDisplay = hasMultipleBlocks ? `${gene}⚠`.padEnd(10) : gene.padEnd(10);
    
    // Format each column dynamically
    const columns = COMPARISONS_CONFIG.map(config => {
      const r = geneResults[config.key];
      return formatPct(
        r?.nucleotideIdentity, 
        r?.aminoAcidIdentity, 
        r?.nucConservedLength, 
        r?.nucleotideIdentity === maxNuc, 
        r?.aminoAcidIdentity === maxAA,
        r?.nucConservedLength === maxBp
      );
    });
    
    console.log(geneDisplay + columns.join(spacing));
  }
  
  // Add average row (only if we have comparisons)
  if (fullyComparedGenes.length > 0) {
    console.log(`${"─".repeat(100)}`);
    
    const avgColumns = COMPARISONS_CONFIG.map(config => {
      const avg_nuc = calculateAverage(comparisons[config.key], 'nucleotideIdentity');
      const avg_aa = calculateAverage(comparisons[config.key], 'aminoAcidIdentity');
      const avg_bp = Math.round(calculateAverage(comparisons[config.key], 'nucConservedLength'));
      return formatPct(avg_nuc, avg_aa, avg_bp, false, false, false);
    });
    
    console.log('AVERAGE'.padEnd(10) + avgColumns.join(spacing));
  }
  
  // Fragmented alignments report
  const fragmentedGenes = [];
  
  for (const gene of fullyComparedGenes) {
    const fragments = [];
    
    for (const config of COMPARISONS_CONFIG) {
      const r = comparisons[config.key].find(res => res.gene === gene);
      if (r && (r.numNucBlocks > 1 || r.numAABlocks > 1)) {
        fragments.push(`${config.shortLabel}: ${r.numNucBlocks}nt/${r.numAABlocks}aa blocks`);
      }
    }
    
    if (fragments.length > 0) {
      fragmentedGenes.push({ gene, details: fragments.join(', ') });
    }
  }
  
  if (fragmentedGenes.length > 0) {
    console.log(`\n${"=".repeat(MAX_LINE_LENGTH)}`);
    console.log(`FRAGMENTED ALIGNMENTS (Multiple Conserved Blocks)`);
    console.log(`${"=".repeat(MAX_LINE_LENGTH)}`);
    console.log(`Found ${fragmentedGenes.length} genes with fragmented alignments:\n`);
    
    fragmentedGenes.forEach(({ gene, details }) => {
      console.log(`  ${gene.padEnd(12)} ${details}`);
    });
    
    console.log(`\nNote: Multiple blocks may indicate:`);
    console.log(`  - Structural differences (insertions/deletions)`);
    console.log(`  - Highly divergent regions`);
    console.log(`  - Alternative splicing variants`);
  }
})();
