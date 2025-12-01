#!/usr/bin/env node

// Find orthologous genes across human, rhesus monkey, and house mouse

import fs from "fs";
import path from "path";
import inquirer from "inquirer";
import { fileURLToPath } from "url";

import { searchNCBI, getSummaries, fetchFromNCBI } from "./lib/ncbi.js";
import { loadGeneMap, saveGeneMap, getSequenceCacheFolder } from "./lib/cache.js";
import { createLogger } from "./lib/logger.js";
import { MAX_LINE_LENGTH } from "./lib/constants.js";

const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] === __filename;

// Organism definitions
const ORGANISMS = {
  human: {
    name: "Homo sapiens",
    label: "Human",
    searchTerm: "human[Organism]",
  },
  rhesus: {
    name: "Macaca mulatta",
    label: "Rhesus Monkey",
    searchTerm: "rhesus monkey[Organism]",
  },
  mouse: {
    name: "Mus musculus",
    label: "House Mouse",
    searchTerm: "house mouse[Organism]",
  },
};

// Search for a gene in a specific organism
const searchGeneInOrganism = async (geneName, organism, logger) => {
  // Only search for NM_ (mRNA) sequences, exclude NC_ (chromosome) sequences
  const query = `${geneName}[Gene] AND ${organism.searchTerm} AND RefSeq[Filter] AND biomol mrna[PROP]`;
  
  logger.log(`  Searching ${organism.label}...`);
  
  try {
    const ids = await searchNCBI(query, 10);
    
    if (ids.length === 0) {
      logger.log(`    ✗ No results found for ${organism.label}`);
      return null;
    }
    
    const summaries = await getSummaries(ids);
    logger.log(`    ✓ Found ${summaries.length} result(s) for ${organism.label}`);
    
    return summaries;
  } catch (err) {
    logger.log(`    ✗ Error searching ${organism.label}: ${err.message}`);
    return null;
  }
};

// Main function (can be called from other scripts)
export const findOrthologs = async (geneName, options = {}) => {
  const {
    autoSelect = false,
    runComparison = false,
    silent = false,
  } = options;

  const logger = createLogger(silent);
  const sequenceCacheFolder = getSequenceCacheFolder();

  // Load gene map
  const geneMap = loadGeneMap();
  
  // Check if gene is already mapped
  const existingData = geneMap.genes[geneName] || {};
  const hasExistingData = Object.keys(existingData).length > 0;
  
  if (hasExistingData) {
    if (!silent) {
      logger.log(`\n✓ Gene ${geneName} found in map:`);
      for (const [organism, accession] of Object.entries(existingData)) {
        if (accession === null) {
          logger.log(`  ${ORGANISMS[organism].label.padEnd(15)}: (not found in NCBI)`);
        } else if (accession === undefined) {
          logger.log(`  ${ORGANISMS[organism].label.padEnd(15)}: (not yet searched)`);
        } else {
          logger.log(`  ${ORGANISMS[organism].label.padEnd(15)}: ${accession}`);
        }
      }
    }
    
    // Check if all non-null cached files exist
    const cachedAccessions = Object.entries(existingData)
      .filter(([_, acc]) => acc && acc !== null)
      .map(([_, acc]) => acc);
    
    const allCachedExist = cachedAccessions.length > 0 && cachedAccessions.every(acc => 
      fs.existsSync(path.join(sequenceCacheFolder, `${acc}.txt`))
    );
    
    // Check if any organisms need searching (undefined)
    const needsSearch = Object.entries(ORGANISMS).some(([key]) => 
      existingData[key] === undefined
    );
    
    if (allCachedExist && !needsSearch) {
      logger.log(`✓ All sequence files already downloaded\n`);
      return {
        geneName,
        accessions: existingData,
        fromCache: true,
      };
    } else if (!allCachedExist && cachedAccessions.length > 0) {
      logger.log(`⚠️  Some sequence files missing, will re-download\n`);
    }
  }

  logger.log(`\n${"=".repeat(MAX_LINE_LENGTH)}`);
  logger.log(`Searching for orthologous genes: ${geneName}`);
  logger.log(`Organisms: Human, Rhesus Monkey, House Mouse`);
  logger.log(`${"=".repeat(MAX_LINE_LENGTH)}\n`);

  // Search organisms based on cache status
  const results = {};
  
  for (const [key, organism] of Object.entries(ORGANISMS)) {
    const cachedValue = existingData[key];
    
    if (cachedValue === null) {
      // Previously searched, not found - skip
      logger.log(`  Skipping ${organism.label} (previously not found in NCBI)`);
      results[key] = null;
    } else if (cachedValue && cachedValue !== undefined) {
      // Has valid accession - use cached value, check if file exists
      const cacheFile = path.join(sequenceCacheFolder, `${cachedValue}.txt`);
      if (fs.existsSync(cacheFile)) {
        logger.log(`  Using cached ${organism.label}: ${cachedValue}`);
        results[key] = [{ accession: cachedValue }]; // Wrap in array to match search result format
      } else {
        logger.log(`  Re-downloading ${organism.label}: ${cachedValue} (file missing)`);
        results[key] = [{ accession: cachedValue }];
      }
    } else {
      // Undefined - needs searching
      const summaries = await searchGeneInOrganism(geneName, organism, logger);
      results[key] = summaries;
    }
  }
  
  logger.log('\n');
  
  // Check if we have at least some results
  const hasResults = Object.values(results).some(r => r && r.length > 0);
  
  if (!hasResults) {
    logger.log('No results found for any organism. Try a different gene name.');
    return null;
  }
  
  // Select sequences for each organism
  const selectedAccessions = {};
  
  for (const [key, organism] of Object.entries(ORGANISMS)) {
    const summaries = results[key];
    
    // Handle null (previously not found)
    if (summaries === null) {
      selectedAccessions[key] = null;
      continue;
    }
    
    if (!summaries || summaries.length === 0) {
      logger.log(`⚠️  No results for ${organism.label} - marking as not found`);
      selectedAccessions[key] = null;
      continue;
    }
    
    if (autoSelect) {
      // Auto-select - prefer NM_ (curated) over XM_ (predicted)
      const nmSequences = summaries.filter(s => s.accession.startsWith('NM_'));
      const selected = nmSequences.length > 0 ? nmSequences[0] : summaries[0];
      
      selectedAccessions[key] = selected.accession;
      const prefix = selected.accession.startsWith('NM_') ? 'NM' : 'XM';
      logger.log(`✓ Auto-selected for ${organism.label}: ${selected.accession} (${prefix}) - ${selected.title}`);
    } else {
      // Interactive selection
      const choices = summaries.map(s => ({
        name: `${s.accession} - ${s.title.substring(0, 80)}... (${s.length} bp)`,
        value: s.accession,
        short: s.accession,
      }));
      
      choices.push({
        name: "Skip this organism",
        value: null,
        short: "Skip",
      });
      
      const answer = await inquirer.prompt([
        {
          type: "list",
          name: "accession",
          message: `Select sequence for ${organism.label}:`,
          choices: choices,
          pageSize: 10,
        },
      ]);
      
      if (answer.accession) {
        selectedAccessions[key] = answer.accession;
      }
    }
  }
  
  const numSelected = Object.keys(selectedAccessions).length;
  
  if (numSelected === 0) {
    logger.log('\nNo sequences selected.');
    return null;
  }
  
  // Save to gene map
  geneMap.genes[geneName] = selectedAccessions;
  saveGeneMap(geneMap);
  logger.log(`\n✓ Saved ${geneName} to gene map`);
  
  // Download selected sequences (skip null entries)
  const toDownload = Object.entries(selectedAccessions).filter(([_, acc]) => acc !== null);
  
  if (toDownload.length > 0) {
    logger.log(`\n${"=".repeat(MAX_LINE_LENGTH)}`);
    logger.log(`Downloading ${toDownload.length} sequence(s)...`);
    logger.log(`${"=".repeat(MAX_LINE_LENGTH)}\n`);
    
    for (const [key, accession] of toDownload) {
      const organism = ORGANISMS[key];
      const cacheFile = path.join(sequenceCacheFolder, `${accession}.txt`);
      
      if (fs.existsSync(cacheFile)) {
        logger.log(`✓ ${organism.label}: ${accession} (already cached)`);
      } else {
        try {
          const fastaData = await fetchFromNCBI(accession);
          fs.writeFileSync(cacheFile, fastaData, "utf8");
          logger.log(`✓ ${organism.label}: ${accession} (downloaded)`);
        } catch (err) {
          logger.log(`✗ ${organism.label}: ${accession} (failed: ${err.message})`);
          selectedAccessions[key] = null; // Mark as null if download fails
        }
      }
    }
  }
  
  // Summary
  if (!silent) {
    logger.log(`\n${"=".repeat(MAX_LINE_LENGTH)}`);
    logger.log(`ORTHOLOG SEARCH RESULTS FOR ${geneName}`);
    logger.log(`${"=".repeat(MAX_LINE_LENGTH)}`);
    
    for (const [key, organism] of Object.entries(ORGANISMS)) {
      const accession = selectedAccessions[key];
      if (accession) {
        logger.log(`  ${organism.label.padEnd(15)}: ${accession}`);
      } else {
        logger.log(`  ${organism.label.padEnd(15)}: (not found/selected)`);
      }
    }
    
    logger.log(`${"=".repeat(MAX_LINE_LENGTH)}\n`);
  }
  
  // Return result
  const result = {
    geneName,
    accessions: selectedAccessions,
    fromCache: false,
  };
  
  // Run comparison if requested
  if (runComparison && numSelected >= 2) {
    const accessionList = Object.values(selectedAccessions);
    
    if (accessionList.length === 2) {
      logger.log('Running comparison...\n');
      const { spawn } = require('child_process');
      
      const compare = spawn('node', ['compare.js', ...accessionList], {
        stdio: 'inherit',
        cwd: __dirname,
      });
      
      await new Promise((resolve) => {
        compare.on('close', resolve);
      });
    } else if (accessionList.length === 3) {
      logger.log('Cannot run comparison for 3 sequences, use batch-compare.js instead...\n');
    }
  }
  
  return result;
};

// CLI entry point
if (isMainModule) {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node find-orthologs.js <gene_name> [--auto] [--compare]');
    console.log('');
    console.log('Find orthologous genes across human, rhesus monkey, and house mouse');
    console.log('');
    console.log('Arguments:');
    console.log('  gene_name       Gene symbol to search (e.g., FOXP2, BRCA1, TP53)');
    console.log('');
    console.log('Options:');
    console.log('  --auto          Automatically select top result for each organism');
    console.log('  --compare       Run comparison after downloading');
    console.log('');
    console.log('Examples:');
    console.log('  node find-orthologs.js FOXP2');
    console.log('  node find-orthologs.js BRCA1 --auto --compare');
    process.exit(args.includes('--help') || args.includes('-h') ? 0 : 1);
  }
  
  const geneName = args[0];
  const autoSelect = args.includes('--auto');
  const runComparison = args.includes('--compare');
  
  (async () => {
    try {
      const result = await findOrthologs(geneName, { autoSelect, runComparison });
      
      if (!result) {
        process.exit(1);
      }
      
      // Suggest comparison commands
      const accessionList = Object.values(result.accessions);
      
      if (accessionList.length === 2 && !runComparison) {
        console.log('You can now compare these sequences:');
        console.log(`  node compare.js ${accessionList[0]} ${accessionList[1]}`);
      } else if (accessionList.length === 3 && !runComparison) {
        console.log('You can now compare these sequences (pairwise):');
        console.log(`  node compare.js ${accessionList[0]} ${accessionList[1]}`);
        console.log(`  node compare.js ${accessionList[0]} ${accessionList[2]}`);
        console.log(`  node compare.js ${accessionList[1]} ${accessionList[2]}`);
      }
      
    } catch (err) {
      console.error("Error:", err.message);
      process.exit(1);
    }
  })();
}
