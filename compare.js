#!/usr/bin/env node

// Main CLI for DNA sequence comparison
// Compares nucleotide and amino acid sequences from NCBI

// Import local modules
import { loadGeneMap } from "./lib/cache.js";
import { runSingleComparison } from "./lib/sequence-loader.js";
import { printComparison } from "./lib/formatter.js";
import { MAX_LINE_LENGTH } from "./lib/constants.js";
import { init as initComparison } from "./lib/comparison.js";
import { generateComparisonHTML, generateSingleComparisonHTML, saveHTMLReport } from "./lib/html-report.js";

// ============================================================================
// CONFIGURATION
// ============================================================================

// Organism configuration - add/remove/modify organisms here
const ORGANISMS = {
  human: { id: 'human', label: 'Human' },
  rhesus: { id: 'rhesus', label: 'Rhesus' },
  mouse: { id: 'mouse', label: 'Mouse' }
};

// Comparison pairs - define which organisms to compare
// Each pair is [organism1_id, organism2_id]
const COMPARISON_PAIRS = [
  ['human', 'rhesus'],
  ['human', 'mouse']
];

// Generate comparison configurations
const COMPARISONS_CONFIG = COMPARISON_PAIRS.map(([org1, org2]) => ({
  org1,
  org2,
  label: `${ORGANISMS[org1].label} vs ${ORGANISMS[org2].label}`
}));

// ============================================================================

// Simple argument parsing
const args = process.argv.slice(2);

if (args.length < 1 || args.includes('--help') || args.includes('-h')) {
  console.log('Usage: node compare.js <gene_name>');
  console.log('       node compare.js <accession1> <accession2>');
  console.log('');
  console.log('Compare DNA sequences across species using gene-map.json');
  console.log('or compare two specific accession numbers');
  console.log('');
  console.log(`Species: ${Object.values(ORGANISMS).map(o => o.label).join(', ')}`);
  console.log(`Comparisons: ${COMPARISONS_CONFIG.map(c => c.label).join(', ')}`);
  console.log('');
  console.log('Examples:');
  console.log('  node compare.js FOXP2              # Compare across configured species');
  console.log('  node compare.js NM_148900.4 NM_053242.4  # Direct comparison');
  process.exit(args.includes('--help') || args.includes('-h') ? 0 : 1);
}

(async () => {
  try {
    // Check if this is a gene name or direct accession numbers
    const isGeneName = args.length === 1;
    
    if (isGeneName) {
      // Gene-based comparison using gene-map.json
      const geneName = args[0];
      const geneMap = loadGeneMap();
      
      if (!geneMap.genes[geneName]) {
        console.error(`\nError: Gene "${geneName}" not found in gene-map.json`);
        console.error(`\nRun: node find-orthologs.js ${geneName} --auto`);
        console.error(`  to search for this gene and add it to the map\n`);
        process.exit(1);
      }
      
      const accessions = geneMap.genes[geneName];
      
      // Check we have all required organisms (from all configured comparisons)
      const requiredOrganisms = new Set();
      COMPARISON_PAIRS.forEach(([org1, org2]) => {
        requiredOrganisms.add(org1);
        requiredOrganisms.add(org2);
      });
      
      const missing = [];
      for (const orgId of requiredOrganisms) {
        if (!accessions[orgId]) {
          missing.push(ORGANISMS[orgId].label);
        }
      }
      
      if (missing.length > 0) {
        console.error(`\nError: Gene "${geneName}" is missing organisms: ${missing.join(', ')}`);
        console.error(`\nRun: node find-orthologs.js ${geneName} --auto`);
        console.error(`  to update this gene in the map\n`);
        process.exit(1);
      }
      
      console.log(`\n${"=".repeat(MAX_LINE_LENGTH)}`);
      console.log(`GENE: ${geneName}`);
      console.log(`${"=".repeat(MAX_LINE_LENGTH)}`);
      for (const orgId of Object.keys(ORGANISMS)) {
        if (accessions[orgId]) {
          console.log(`${ORGANISMS[orgId].label}:  ${accessions[orgId]}`);
        }
      }
      console.log(`${"=".repeat(MAX_LINE_LENGTH)}\n`);
      
      // Run all configured comparisons
      const comparisons = [];
      
      for (let i = 0; i < COMPARISONS_CONFIG.length; i++) {
        const config = COMPARISONS_CONFIG[i];
        
        console.log(`\n${"=".repeat(MAX_LINE_LENGTH)}`);
        console.log(`COMPARISON ${i + 1}: ${config.label}`);
        console.log(`${"=".repeat(MAX_LINE_LENGTH)}`);
        
        const {
          seq1Data, seq2Data,
          seq1, seq2,
          nucResult
        } = await runSingleComparison(accessions[config.org1], accessions[config.org2]);
        
        console.log(`\n${"=".repeat(MAX_LINE_LENGTH)}`);
        console.log(`${ORGANISMS[config.org1].label}:  ${seq1Data.header}`);
        console.log(`${ORGANISMS[config.org2].label}: ${seq2Data.header}`);
        console.log(`${"=".repeat(MAX_LINE_LENGTH)}`);
        
        printComparison("Nucleotide", nucResult);
        
        const protein = (await initComparison()).compareProteins(seq1, seq2, nucResult);
        printComparison("Amino acid", protein.result);
        
        comparisons.push({ config, nucResult, aaResult: protein.result, seq1Data, seq2Data });
      }
      
      // Calculate conserved block identity for summary
      const calcConservedIdentity = (result) => {
        const conservedLength = result.conservedBlocks.reduce((sum, block) => sum + block.length, 0);
        const conservedMismatches = result.conservedBlocks.reduce((sum, block) => sum + (block.sequence.match(/\?/g) || []).length, 0);
        return conservedLength > 0 ? ((1 - conservedMismatches / conservedLength) * 100).toFixed(1) : '0.0';
      };
      
      console.log(`\n\n${"=".repeat(MAX_LINE_LENGTH)}`);
      console.log(`SUMMARY: ${geneName}`);
      console.log(`${"=".repeat(MAX_LINE_LENGTH)}`);
      
      for (const { config, nucResult, aaResult } of comparisons) {
        const nucIdentity = calcConservedIdentity(nucResult);
        const aaIdentity = calcConservedIdentity(aaResult);
        console.log(`${config.label}: ${nucIdentity}% nt, ${aaIdentity}% aa (conserved blocks)`);
      }
      
      console.log(`${"=".repeat(MAX_LINE_LENGTH)}\n`);
      
      // Generate main HTML report
      const html = generateComparisonHTML(geneName, accessions, comparisons, ORGANISMS);
      const filename = `compare-${geneName.toLowerCase()}.html`;
      saveHTMLReport(html, filename);
      
      // Generate individual comparison reports
      for (let i = 0; i < comparisons.length; i++) {
        const singleHTML = generateSingleComparisonHTML(comparisons[i], ORGANISMS);
        const singleFilename = `compare-${geneName.toLowerCase()}-${i + 1}.html`;
        saveHTMLReport(singleHTML, singleFilename);
      }
      
    } else if (args.length === 2) {
      // Direct accession comparison (original behavior)
      const accession1 = args[0];
      const accession2 = args[1];
      
      const { seq1Data, seq2Data, seq1, seq2, nucResult } = await runSingleComparison(accession1, accession2);
      
      console.log(`\n${"=".repeat(MAX_LINE_LENGTH)}`);
      console.log(`Sequence 1: ${seq1Data.header}`);
      console.log(`Sequence 2: ${seq2Data.header}`);
      console.log(`${"=".repeat(MAX_LINE_LENGTH)}`);
      
      printComparison("Nucleotide", nucResult);
      
      const protein = (await initComparison()).compareProteins(seq1, seq2, nucResult);
      printComparison("Amino acid", protein.result);
      
      // Generate HTML report for direct accession comparison
      const directAccessions = {};
      const directComparisons = [{
        config: { org1: 'seq1', org2: 'seq2', label: 'Direct Comparison' },
        nucResult,
        aaResult: protein.result,
        seq1Data,
        seq2Data
      }];
      const directOrganisms = {
        seq1: { id: 'seq1', label: 'Sequence 1' },
        seq2: { id: 'seq2', label: 'Sequence 2' }
      };
      const html = generateComparisonHTML(`${accession1}_vs_${accession2}`, directAccessions, directComparisons, directOrganisms);
      const filename = `compare-${accession1.replace(/[^a-zA-Z0-9]/g, '_')}_vs_${accession2.replace(/[^a-zA-Z0-9]/g, '_')}.html`;
      saveHTMLReport(html, filename);
      
    } else {
      console.error('\nError: Invalid number of arguments');
      console.error('Usage: node compare.js <gene_name>');
      console.error('       node compare.js <accession1> <accession2>\n');
      process.exit(1);
    }
  } catch (err) {
    console.error("\nError:", err.message);
    process.exit(1);
  }
})();
