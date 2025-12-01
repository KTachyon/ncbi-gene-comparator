// Data cache utilities
// Manages persistent data storage (gene-to-accession mappings, sequences, etc.)

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const GENE_MAP_FILE = path.join(__dirname, "..", "gene-map.json");

// Get sequence cache folder path and ensure it exists
export const getSequenceCacheFolder = () => {
  const sequenceCacheFolder = path.join(__dirname, "..", "seqs");
  
  if (!fs.existsSync(sequenceCacheFolder)) {
    fs.mkdirSync(sequenceCacheFolder, { recursive: true });
  }
  
  return sequenceCacheFolder;
};

// Load gene map from disk
export const loadGeneMap = () => fs.existsSync(GENE_MAP_FILE)
  ? JSON.parse(fs.readFileSync(GENE_MAP_FILE, "utf8"))
  : { genes: {}, metadata: { lastUpdated: null, totalGenes: 0 } };

// Save gene map to disk
export const saveGeneMap = (geneMap) => {
  geneMap.metadata.lastUpdated = new Date().toISOString();
  geneMap.metadata.totalGenes = Object.keys(geneMap.genes).length;
  fs.writeFileSync(GENE_MAP_FILE, JSON.stringify(geneMap, null, 2), "utf8");
};
