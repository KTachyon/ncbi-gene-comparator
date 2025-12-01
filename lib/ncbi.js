// NCBI API utilities with rate limiting
// Handles ESearch, ESummary, and EFetch endpoints

import fs from "fs";
import path from "path";
import Bottleneck from "bottleneck";

// NCBI rate limiter: 3 requests/second without API key, 10 with API key
// Using conservative 2 requests/second (one every 500ms)
const limiter = new Bottleneck({
  minTime: 500, // Minimum time between requests (ms)
  maxConcurrent: 1, // Only one request at a time
});

export const Helper = {
  // Rate-limited fetch with retry logic
  rateLimitedFetch: async (url, retries = 3) => {
    return limiter.schedule(async () => {
      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          const response = await fetch(url);
          
          // Handle rate limiting (429)
          if (response.status === 429) {
            const waitTime = Math.pow(2, attempt + 1) * 1000; // Exponential backoff
            console.log(`    ⏱  Rate limited, waiting ${waitTime / 1000}s before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
          
          if (!response.ok) {
            throw new Error(`NCBI API returned status ${response.status}`);
          }
          
          return response;
        } catch (err) {
          if (attempt === retries - 1) {
            throw err;
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 500));
        }
      }
      
      throw new Error("Max retries exceeded");
    });
  }
}

const NCBI_BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

// Build NCBI API URL with URLSearchParams
const buildUrl = (endpoint, params) => {
  const url = new URL(`${NCBI_BASE_URL}/${endpoint}`);
  const searchParams = new URLSearchParams(params);
  
  // Add API key if available
  const apiKey = process.env.NCBI_API_KEY;
  if (apiKey) {
    searchParams.set("api_key", apiKey);
  }
  
  url.search = searchParams.toString();
  return url.toString();
};

// ============================================================================
// EFetch: Fetch raw FASTA data from NCBI using accession number
// ============================================================================
export const fetchFromNCBI = async (accession) => {
  const url = buildUrl("efetch.fcgi", {
    db: "nuccore",
    id: accession,
    rettype: "fasta",
    retmode: "text",
  });
  
  const response = await Helper.rateLimitedFetch(url);
  const data = await response.text();
  
  if (!data || !data.trim()) {
    throw new Error(`No data returned for ${accession}`);
  }
  
  return data;
};

// ============================================================================
// ESearch: Search NCBI for sequences
// ============================================================================
export const searchNCBI = async (query, retmax = 20) => {
  const url = buildUrl("esearch.fcgi", {
    db: "nuccore",
    term: query,
    retmax: retmax,
    retmode: "json",
  });

  const response = await Helper.rateLimitedFetch(url);
  const data = await response.json();

  if (!data.esearchresult || !data.esearchresult.idlist) {
    throw new Error("No results found");
  }

  return data.esearchresult.idlist;
};

// ============================================================================
// ESummary: Get summary information for a list of IDs
// ============================================================================
export const getSummaries = async (ids) => {
  const url = buildUrl("esummary.fcgi", {
    db: "nuccore",
    id: ids.join(","),
    retmode: "json",
  });

  const response = await Helper.rateLimitedFetch(url);
  const data = await response.json();

  if (!data.result) {
    throw new Error("No summary data returned");
  }

  // Convert to array of summaries
  const summaries = [];
  for (const id of ids) {
    if (data.result[id]) {
      summaries.push({
        id: id,
        accession: data.result[id].accessionversion,
        title: data.result[id].title,
        length: data.result[id].slen,
      });
    }
  }

  return summaries;
};

// ============================================================================
// Caching: Get sequence from cache or fetch from NCBI
// ============================================================================
export const getSequenceData = async (accession, cacheDir) => {
  const cacheFile = path.join(cacheDir, `${accession}.txt`);
  
  // Check if cached
  if (fs.existsSync(cacheFile)) {
    console.log(`Using cached data: ${accession}`);
    return fs.readFileSync(cacheFile, "utf8");
  } else {
    // Fetch from NCBI
    console.log(`Fetching from NCBI: ${accession}...`);
    try {
      const fastaData = await fetchFromNCBI(accession);
      
      // Cache the raw FASTA data
      fs.writeFileSync(cacheFile, fastaData, "utf8");
      console.log(`Cached data: ${accession}`);

      return fastaData;
    } catch (err) {
      throw new Error(`Failed to fetch ${accession} from NCBI: ${err.message}`);
    }
  }
};

