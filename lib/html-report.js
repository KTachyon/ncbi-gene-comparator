// HTML report generator for comparison results

import { writeFileSync, mkdirSync, existsSync } from 'fs';

// Format sequence for HTML display - use full width, let CSS handle wrapping
const formatSequenceHTML = (seq, groupSize = 3) => {
  const groups = [];
  for (let i = 0; i < seq.length; i += groupSize) {
    const group = seq.slice(i, i + groupSize);
    const highlighted = group.split('').map(char => {
      if (char === '?') {
        return `<span class="mismatch">${char}</span>`;
      }
      return char;
    }).join('');
    // Wrap each codon group in a non-breaking span
    groups.push(`<span class="codon-group">${highlighted}</span>`);
  }
  
  // Join all groups with spaces - CSS will handle wrapping
  return `<div class="sequence-block">${groups.join(" ")}</div>`;
};

// Generate HTML for a single comparison block
const generateBlockHTML = (block, idx, label) => {
  const blockMismatches = (block.sequence.match(/\?/g) || []).length;
  const blockIdentity = 1 - blockMismatches / block.length;
  const unit = label.includes("acid") ? "AA" : "bp";
  
  return `
    <div class="block">
      <div class="block-header">
        <strong>Block ${idx + 1}</strong> [${block.start}:${block.end}] - ${block.length} ${unit}, ${(100 * blockIdentity).toFixed(1)}% identity
      </div>
      <div class="block-sequence">
        ${formatSequenceHTML(block.sequence)}
      </div>
    </div>
  `;
};

// Generate HTML for comparison results (used by compare.js)
export const generateComparisonHTML = (geneName, accessions, comparisons, organisms) => {
  const calcConservedIdentity = (result) => {
    if (!result.conservedBlocks || result.conservedBlocks.length === 0) return '0.0';
    const conservedLength = result.conservedBlocks.reduce((sum, block) => sum + block.length, 0);
    const conservedMismatches = result.conservedBlocks.reduce((sum, block) => sum + (block.sequence.match(/\?/g) || []).length, 0);
    return conservedLength > 0 ? ((1 - conservedMismatches / conservedLength) * 100).toFixed(1) : '0.0';
  };

  const comparisonsHTML = comparisons.map(({ config, nucResult, aaResult, seq1Data, seq2Data }) => {
    const nucIdentity = calcConservedIdentity(nucResult);
    const aaIdentity = calcConservedIdentity(aaResult);
    
    const nucBlocksHTML = nucResult.conservedBlocks && nucResult.conservedBlocks.length > 0
      ? nucResult.conservedBlocks.map((block, idx) => generateBlockHTML(block, idx + 1, "Nucleotide")).join('')
      : '<div class="no-blocks">No well-conserved blocks found (sequences may be too divergent).</div>';
    
    const aaBlocksHTML = aaResult.conservedBlocks && aaResult.conservedBlocks.length > 0
      ? aaResult.conservedBlocks.map((block, idx) => generateBlockHTML(block, idx + 1, "Amino acid")).join('')
      : '<div class="no-blocks">No well-conserved blocks found (sequences may be too divergent).</div>';
    
    const frameInfo = aaResult.frame1 !== undefined && aaResult.frame2 !== undefined
      ? `<div class="frame-info">Reading frames: seq1 +${aaResult.frame1}, seq2 +${aaResult.frame2}</div>`
      : '';
    
    // Get accession labels - use seq1Data/seq2Data if available, otherwise fall back to accessions object
    const org1Label = organisms[config.org1]?.label || 'Sequence 1';
    const org2Label = organisms[config.org2]?.label || 'Sequence 2';
    const org1Acc = seq1Data?.header || accessions[config.org1] || 'N/A';
    const org2Acc = seq2Data?.header || accessions[config.org2] || 'N/A';
    
    return `
      <div class="comparison-section">
        <h2>${config.label}</h2>
        <div class="accession-info">
          <div><strong>${org1Label}:</strong> ${org1Acc}</div>
          <div><strong>${org2Label}:</strong> ${org2Acc}</div>
        </div>
        
        <div class="summary-box">
          <div class="summary-item">
            <span class="summary-label">Nucleotide Identity:</span>
            <span class="summary-value">${nucIdentity}%</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Amino Acid Identity:</span>
            <span class="summary-value">${aaIdentity}%</span>
          </div>
        </div>
        
        <div class="comparison-type">
          <h3>Nucleotide Comparison</h3>
          ${nucBlocksHTML}
        </div>
        
        <div class="comparison-type">
          <h3>Amino Acid Comparison</h3>
          ${frameInfo}
          ${aaBlocksHTML}
        </div>
      </div>
    `;
  }).join('');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DNA Comparison Report: ${geneName}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #e0e0e0;
      background: #1a1a1a;
      padding: 0;
      margin: 0;
    }
    
    .container {
      width: 100%;
      margin: 0;
      background: #2d2d2d;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }
    
    h1 {
      color: #64b5f6;
      border-bottom: 3px solid #42a5f5;
      padding-bottom: 10px;
      margin-bottom: 30px;
    }
    
    h2 {
      color: #90caf9;
      margin-top: 30px;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 2px solid #424242;
    }
    
    h3 {
      color: #b0bec5;
      margin-top: 20px;
      margin-bottom: 10px;
      font-size: 1.1em;
    }
    
    .accession-info {
      background: #3d3d3d;
      padding: 15px;
      border-radius: 4px;
      margin-bottom: 15px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
      color: #e0e0e0;
    }
    
    .accession-info div {
      margin: 5px 0;
    }
    
    .summary-box {
      display: flex;
      gap: 20px;
      margin: 20px 0;
      padding: 15px;
      background: #3d3d3d;
      border-radius: 4px;
      border-left: 4px solid #42a5f5;
    }
    
    .summary-item {
      display: flex;
      flex-direction: column;
    }
    
    .summary-label {
      font-size: 0.85em;
      color: #b0bec5;
      margin-bottom: 5px;
    }
    
    .summary-value {
      font-size: 1.5em;
      font-weight: bold;
      color: #64b5f6;
    }
    
    .comparison-section {
      margin-bottom: 40px;
      padding-bottom: 30px;
      border-bottom: 1px solid #424242;
    }
    
    .comparison-section:last-child {
      border-bottom: none;
    }
    
    .comparison-type {
      margin-top: 20px;
    }
    
    .block {
      margin: 15px 0;
      padding: 15px;
      background: #3d3d3d;
      border-radius: 4px;
      border-left: 3px solid #66bb6a;
    }
    
    .block-header {
      margin-bottom: 10px;
      color: #81c784;
      font-weight: 600;
    }
    
    .block-sequence {
      background: #1e1e1e;
      padding: 10px;
      border-radius: 3px;
      overflow-x: auto;
    }
    
    .sequence-block {
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
      line-height: 1.3;
      white-space: normal;
      word-spacing: 0;
      margin: 0;
      color: #e0e0e0;
    }
    
    .codon-group {
      white-space: nowrap;
      display: inline-block;
    }
    
    .mismatch {
      background: #e57373;
      color: #1a1a1a;
      border-radius: 2px;
      font-weight: bold;
    }
    
    .no-blocks {
      padding: 15px;
      background: #5d4037;
      border-left: 3px solid #ff9800;
      color: #ffcc80;
      border-radius: 4px;
      margin: 15px 0;
    }
    
    .frame-info {
      padding: 10px;
      background: #1e3a5f;
      border-left: 3px solid #42a5f5;
      margin-bottom: 15px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
      color: #90caf9;
    }
    
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #424242;
      text-align: center;
      color: #9e9e9e;
      font-size: 0.85em;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>DNA Comparison Report: ${geneName}</h1>
    
    ${comparisonsHTML}
    
    <div class="footer">
      Generated on ${new Date().toLocaleString()}
    </div>
  </div>
</body>
</html>
  `;

  return html.trim();
};

// Generate HTML for a single comparison (no header/footer)
export const generateSingleComparisonHTML = (comparison, organisms) => {
  const { config, nucResult, aaResult, seq1Data, seq2Data } = comparison;
  
  const calcConservedIdentity = (result) => {
    if (!result.conservedBlocks || result.conservedBlocks.length === 0) return '0.0';
    const conservedLength = result.conservedBlocks.reduce((sum, block) => sum + block.length, 0);
    const conservedMismatches = result.conservedBlocks.reduce((sum, block) => sum + (block.sequence.match(/\?/g) || []).length, 0);
    return conservedLength > 0 ? ((1 - conservedMismatches / conservedLength) * 100).toFixed(1) : '0.0';
  };
  
  const nucIdentity = calcConservedIdentity(nucResult);
  const aaIdentity = calcConservedIdentity(aaResult);
  
  const nucBlocksHTML = nucResult.conservedBlocks && nucResult.conservedBlocks.length > 0
    ? nucResult.conservedBlocks.map((block, idx) => generateBlockHTML(block, idx + 1, "Nucleotide")).join('')
    : '<div class="no-blocks">No well-conserved blocks found (sequences may be too divergent).</div>';
  
  const aaBlocksHTML = aaResult.conservedBlocks && aaResult.conservedBlocks.length > 0
    ? aaResult.conservedBlocks.map((block, idx) => generateBlockHTML(block, idx + 1, "Amino acid")).join('')
    : '<div class="no-blocks">No well-conserved blocks found (sequences may be too divergent).</div>';
  
  const frameInfo = aaResult.frame1 !== undefined && aaResult.frame2 !== undefined
    ? `<div class="frame-info">Reading frames: seq1 +${aaResult.frame1}, seq2 +${aaResult.frame2}</div>`
    : '';
  
  const org1Label = organisms[config.org1]?.label || 'Sequence 1';
  const org2Label = organisms[config.org2]?.label || 'Sequence 2';
  const org1Acc = seq1Data?.header || 'N/A';
  const org2Acc = seq2Data?.header || 'N/A';
  
  const comparisonHTML = `
    <div class="comparison-section">
      <h2>${config.label}</h2>
      <div class="accession-info">
        <div><strong>${org1Label}:</strong> ${org1Acc}</div>
        <div><strong>${org2Label}:</strong> ${org2Acc}</div>
      </div>
      
      <div class="summary-box">
        <div class="summary-item">
          <span class="summary-label">Nucleotide Identity:</span>
          <span class="summary-value">${nucIdentity}%</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Amino Acid Identity:</span>
          <span class="summary-value">${aaIdentity}%</span>
        </div>
      </div>
      
      <div class="comparison-type">
        <h3>Nucleotide Comparison</h3>
        ${nucBlocksHTML}
      </div>
      
      <div class="comparison-type">
        <h3>Amino Acid Comparison</h3>
        ${frameInfo}
        ${aaBlocksHTML}
      </div>
    </div>
  `;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.label}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #e0e0e0;
      background: #1a1a1a;
      padding: 0;
      margin: 0;
    }
    
    .container {
      width: 100%;
      margin: 0;
      background: #2d2d2d;
      padding: 30px 30px 0 30px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }
    
    h2 {
      color: #90caf9;
      margin-top: 0;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 2px solid #424242;
    }
    
    h3 {
      color: #b0bec5;
      margin-top: 20px;
      margin-bottom: 10px;
      font-size: 1.1em;
    }
    
    .accession-info {
      background: #3d3d3d;
      padding: 15px;
      border-radius: 4px;
      margin-bottom: 15px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
      color: #e0e0e0;
    }
    
    .accession-info div {
      margin: 5px 0;
    }
    
    .summary-box {
      display: flex;
      gap: 20px;
      margin: 20px 0;
      padding: 15px;
      background: #3d3d3d;
      border-radius: 4px;
      border-left: 4px solid #42a5f5;
    }
    
    .summary-item {
      display: flex;
      flex-direction: column;
    }
    
    .summary-label {
      font-size: 0.85em;
      color: #b0bec5;
      margin-bottom: 5px;
    }
    
    .summary-value {
      font-size: 1.5em;
      font-weight: bold;
      color: #64b5f6;
    }
    
    .comparison-section {
      margin-bottom: 40px;
      padding-bottom: 30px;
      border-bottom: 1px solid #424242;
    }
    
    .comparison-section:last-child {
      border-bottom: none;
    }
    
    .comparison-type {
      margin-top: 20px;
    }
    
    .block {
      margin: 15px 0;
      padding: 15px;
      background: #3d3d3d;
      border-radius: 4px;
      border-left: 3px solid #66bb6a;
    }
    
    .block-header {
      margin-bottom: 10px;
      color: #81c784;
      font-weight: 600;
    }
    
    .block-sequence {
      background: #1e1e1e;
      padding: 10px;
      border-radius: 3px;
      overflow-x: auto;
    }
    
    .sequence-block {
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
      line-height: 1.3;
      white-space: normal;
      word-spacing: 0;
      margin: 0;
      color: #e0e0e0;
    }
    
    .codon-group {
      white-space: nowrap;
      display: inline-block;
    }
    
    .mismatch {
      background: #e57373;
      color: #1a1a1a;
      border-radius: 2px;
      font-weight: bold;
    }
    
    .no-blocks {
      padding: 15px;
      background: #5d4037;
      border-left: 3px solid #ff9800;
      color: #ffcc80;
      border-radius: 4px;
      margin: 15px 0;
    }
    
    .frame-info {
      padding: 10px;
      background: #1e3a5f;
      border-left: 3px solid #42a5f5;
      margin-bottom: 15px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
      color: #90caf9;
    }
    
    .comparison-section {
      margin-bottom: 0;
      padding-bottom: 0;
    }
  </style>
</head>
<body>
  <div class="container">
    ${comparisonHTML}
  </div>
</body>
</html>
  `;

  return html.trim();
};

// Generate HTML for batch comparison results (used by batch-compare.js)
export const generateBatchHTML = (data) => {
  const {
    fullyComparedGenes,
    comparisons,
    comparisonsConfig,
    organisms,
    geneResults,
    fragmentedGenes,
    nmOnly,
    uniqueBlocks,
    totalTime
  } = data;

  const calculateAverage = (arr, key) => {
    if (arr.length === 0) return 0;
    return arr.reduce((sum, item) => sum + item[key], 0) / arr.length;
  };

  // Generate summary statistics
  const summaryHTML = comparisonsConfig.map(config => {
    const avgNuc = calculateAverage(comparisons[config.key], 'nucleotideIdentity');
    const avgAA = calculateAverage(comparisons[config.key], 'aminoAcidIdentity');
    return `
      <div class="summary-stat">
        <div class="stat-label">${config.label}</div>
        <div class="stat-value">${(avgNuc * 100).toFixed(1)}%</div>
        <div class="stat-sublabel">nucleotide</div>
        <div class="stat-value">${(avgAA * 100).toFixed(1)}%</div>
        <div class="stat-sublabel">amino acid</div>
        <div class="stat-count">n=${comparisons[config.key].length}</div>
      </div>
    `;
  }).join('');

  // Generate table rows
  const tableRows = fullyComparedGenes.map(gene => {
    const geneResultsForGene = {};
    comparisonsConfig.forEach(config => {
      geneResultsForGene[config.key] = comparisons[config.key].find(r => r.gene === gene);
    });

    // Find max values for highlighting
    const nucValues = comparisonsConfig.map(c => geneResultsForGene[c.key]?.nucleotideIdentity).filter(v => v !== null && v !== undefined);
    const aaValues = comparisonsConfig.map(c => geneResultsForGene[c.key]?.aminoAcidIdentity).filter(v => v !== null && v !== undefined);
    const bpValues = comparisonsConfig.map(c => geneResultsForGene[c.key]?.nucConservedLength).filter(v => v !== null && v !== undefined);
    
    const maxNuc = nucValues.length > 0 ? Math.max(...nucValues) : 0;
    const maxAA = aaValues.length > 0 ? Math.max(...aaValues) : 0;
    const maxBp = bpValues.length > 0 ? Math.max(...bpValues) : 0;

    // Check for multiple blocks
    const hasMultipleBlocks = comparisonsConfig.some(c => {
      const r = geneResultsForGene[c.key];
      return r && (r.numNucBlocks > 1 || r.numAABlocks > 1);
    });

    const cells = comparisonsConfig.map(config => {
      const r = geneResultsForGene[config.key];
      if (!r) return '<td class="no-data">-</td>';
      
      const nucPct = (r.nucleotideIdentity * 100).toFixed(1);
      const aaPct = (r.aminoAcidIdentity * 100).toFixed(1);
      const bp = r.nucConservedLength;
      
      const nucClass = r.nucleotideIdentity === maxNuc ? 'highlight' : '';
      const aaClass = r.aminoAcidIdentity === maxAA ? 'highlight' : '';
      const bpClass = r.nucConservedLength === maxBp ? 'highlight' : '';
      
      return `
        <td class="data-cell">
          <span class="cell-label">nt:</span>
          <span class="cell-value ${nucClass}">${nucPct}%</span>
          <span class="cell-label">aa:</span>
          <span class="cell-value ${aaClass}">${aaPct}%</span>
          <span class="cell-label">bp:</span>
          <span class="cell-value ${bpClass}">${bp}</span>
        </td>
      `;
    }).join('');

    return `
      <tr>
        <td class="gene-name">${gene}${hasMultipleBlocks ? ' ⚠' : ''}</td>
        ${cells}
      </tr>
    `;
  }).join('');

  // Average row
  const avgCells = comparisonsConfig.map(config => {
    const avg_nuc = calculateAverage(comparisons[config.key], 'nucleotideIdentity');
    const avg_aa = calculateAverage(comparisons[config.key], 'aminoAcidIdentity');
    const avg_bp = Math.round(calculateAverage(comparisons[config.key], 'nucConservedLength'));
    return `
      <td class="average-cell data-cell">
        <span class="cell-label">nt:</span>
        <span class="cell-value">${(avg_nuc * 100).toFixed(1)}%</span>
        <span class="cell-label">aa:</span>
        <span class="cell-value">${(avg_aa * 100).toFixed(1)}%</span>
        <span class="cell-label">bp:</span>
        <span class="cell-value">${avg_bp}</span>
      </td>
    `;
  }).join('');

  // Fragmented genes section
  const fragmentedHTML = fragmentedGenes && fragmentedGenes.length > 0 ? `
    <div class="fragmented-section">
      <h2>Fragmented Alignments</h2>
      <p class="section-note">Found ${fragmentedGenes.length} genes with fragmented alignments (multiple conserved blocks):</p>
      <ul class="fragmented-list">
        ${fragmentedGenes.map(({ gene, details }) => `
          <li><strong>${gene}:</strong> ${details}</li>
        `).join('')}
      </ul>
      <p class="section-note">Multiple blocks may indicate structural differences, insertions/deletions, or alternative splicing variants.</p>
    </div>
  ` : '';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Batch DNA Comparison Report</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #e0e0e0;
      background: #1a1a1a;
      padding: 0;
      margin: 0;
    }
    
    .container {
      width: 100%;
      margin: 0;
      background: #2d2d2d;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }
    
    h1 {
      color: #64b5f6;
      border-bottom: 3px solid #42a5f5;
      padding-bottom: 10px;
      margin-bottom: 30px;
    }
    
    h2 {
      color: #90caf9;
      margin-top: 30px;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 2px solid #424242;
    }
    
    .info-section {
      background: #3d3d3d;
      padding: 15px;
      border-radius: 4px;
      margin-bottom: 20px;
      border-left: 4px solid #42a5f5;
      color: #e0e0e0;
    }
    
    .info-section p {
      margin: 5px 0;
    }
    
    .summary-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin: 30px 0;
    }
    
    .summary-stat {
      background: #3d3d3d;
      padding: 20px;
      border-radius: 4px;
      border-left: 4px solid #42a5f5;
      text-align: center;
    }
    
    .stat-label {
      font-weight: 600;
      color: #b0bec5;
      margin-bottom: 10px;
    }
    
    .stat-value {
      font-size: 1.8em;
      font-weight: bold;
      color: #64b5f6;
      margin: 5px 0;
    }
    
    .stat-sublabel {
      font-size: 0.85em;
      color: #9e9e9e;
      margin-top: 5px;
    }
    
    .stat-count {
      font-size: 0.8em;
      color: #757575;
      margin-top: 10px;
    }
    
    .table-container {
      overflow-x: auto;
      margin: 30px 0;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      background: #3d3d3d;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }
    
    thead {
      background: #1e3a5f;
      color: #e0e0e0;
    }
    
    th {
      padding: 4px 8px;
      text-align: left;
      font-weight: 600;
      font-size: 0.9em;
    }
    
    th:first-child {
      border-top-left-radius: 4px;
    }
    
    th:last-child {
      border-top-right-radius: 4px;
    }
    
    tbody tr {
      border-bottom: 1px solid #424242;
      line-height: 1.2;
      background: #3d3d3d;
      color: #e0e0e0;
    }
    
    tbody tr:hover {
      background: #4d4d4d;
    }
    
    tbody tr:last-child {
      border-bottom: none;
    }
    
    .average-row {
      background: #2d4d6d;
      font-weight: 600;
    }
    
    td {
      padding: 3px 8px;
      vertical-align: middle;
    }
    
    .gene-name {
      font-weight: 600;
      color: #90caf9;
      font-family: 'Courier New', monospace;
    }
    
    .data-cell {
      white-space: nowrap;
    }
    
    .cell-label {
      font-size: 0.8em;
      color: #9e9e9e;
      display: inline-block;
      width: 28px;
      text-align: right;
      padding-right: 3px;
    }
    
    .cell-value {
      font-weight: 600;
      color: #e0e0e0;
      display: inline-block;
      min-width: 50px;
      padding-right: 8px;
      text-align: left;
      font-size: 0.9em;
    }
    
    .cell-value.highlight {
      background: #66bb6a;
      color: #1a1a1a;
      padding: 1px 4px;
      border-radius: 2px;
    }
    
    .average-cell {
      background: #2d4d6d;
    }
    
    .no-data {
      color: #757575;
      font-style: italic;
      text-align: center;
    }
    
    .fragmented-section {
      margin-top: 40px;
      padding: 20px;
      background: #5d4037;
      border-radius: 4px;
      border-left: 4px solid #ff9800;
    }
    
    .fragmented-list {
      margin: 15px 0;
      padding-left: 25px;
    }
    
    .fragmented-list li {
      margin: 8px 0;
      font-family: 'Courier New', monospace;
      color: #ffcc80;
    }
    
    .section-note {
      color: #ffcc80;
      margin: 10px 0;
    }
    
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #424242;
      text-align: center;
      color: #9e9e9e;
      font-size: 0.85em;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Batch DNA Comparison Report</h1>
    
    <div class="info-section">
      <p><strong>Total Genes Analyzed:</strong> ${fullyComparedGenes.length}</p>
      <p><strong>Species:</strong> ${Object.values(organisms).map(o => o.label).join(', ')}</p>
      ${nmOnly ? '<p><strong>Filter:</strong> NM_ sequences only (excluding XM_ predicted sequences)</p>' : ''}
      ${uniqueBlocks ? '<p><strong>Filter:</strong> Only genes with unique blocks (single block, not fragmented)</p>' : ''}
      ${totalTime ? `<p><strong>Total Time:</strong> ${totalTime}</p>` : ''}
    </div>
    
    <h2>Average Identity Rates</h2>
    <div class="summary-stats">
      ${summaryHTML}
    </div>
    
    <h2>Detailed Results</h2>
    <p class="section-note">⚠ = Multiple conserved blocks (fragmented alignment)</p>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Gene</th>
            ${comparisonsConfig.map(c => `<th>${c.label}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${tableRows}
          <tr class="average-row">
            <td class="gene-name">AVERAGE</td>
            ${avgCells}
          </tr>
        </tbody>
      </table>
    </div>
    
    ${fragmentedHTML}
    
    <div class="footer">
      Generated on ${new Date().toLocaleString()}
    </div>
  </div>
</body>
</html>
  `;

  return html.trim();
};

// Generate table-only batch report
export const generateBatchTableHTML = (data) => {
  const {
    fullyComparedGenes,
    comparisons,
    comparisonsConfig
  } = data;

  const calculateAverage = (arr, key) => {
    if (arr.length === 0) return 0;
    return arr.reduce((sum, item) => sum + item[key], 0) / arr.length;
  };

  // Generate table rows
  const tableRows = fullyComparedGenes.map(gene => {
    const geneResultsForGene = {};
    comparisonsConfig.forEach(config => {
      geneResultsForGene[config.key] = comparisons[config.key].find(r => r.gene === gene);
    });

    // Find max values for highlighting
    const nucValues = comparisonsConfig.map(c => geneResultsForGene[c.key]?.nucleotideIdentity).filter(v => v !== null && v !== undefined);
    const aaValues = comparisonsConfig.map(c => geneResultsForGene[c.key]?.aminoAcidIdentity).filter(v => v !== null && v !== undefined);
    const bpValues = comparisonsConfig.map(c => geneResultsForGene[c.key]?.nucConservedLength).filter(v => v !== null && v !== undefined);
    
    const maxNuc = nucValues.length > 0 ? Math.max(...nucValues) : 0;
    const maxAA = aaValues.length > 0 ? Math.max(...aaValues) : 0;
    const maxBp = bpValues.length > 0 ? Math.max(...bpValues) : 0;

    // Check for multiple blocks
    const hasMultipleBlocks = comparisonsConfig.some(c => {
      const r = geneResultsForGene[c.key];
      return r && (r.numNucBlocks > 1 || r.numAABlocks > 1);
    });

    const cells = comparisonsConfig.map(config => {
      const r = geneResultsForGene[config.key];
      if (!r) return '<td class="no-data">-</td>';
      
      const nucPct = (r.nucleotideIdentity * 100).toFixed(1);
      const aaPct = (r.aminoAcidIdentity * 100).toFixed(1);
      const bp = r.nucConservedLength;
      
      const nucClass = r.nucleotideIdentity === maxNuc ? 'highlight' : '';
      const aaClass = r.aminoAcidIdentity === maxAA ? 'highlight' : '';
      const bpClass = r.nucConservedLength === maxBp ? 'highlight' : '';
      
      return `
        <td class="data-cell">
          <span class="cell-label">nt:</span>
          <span class="cell-value ${nucClass}">${nucPct}%</span>
          <span class="cell-label">aa:</span>
          <span class="cell-value ${aaClass}">${aaPct}%</span>
          <span class="cell-label">bp:</span>
          <span class="cell-value ${bpClass}">${bp}</span>
        </td>
      `;
    }).join('');

    return `
      <tr>
        <td class="gene-name">${gene}${hasMultipleBlocks ? ' ⚠' : ''}</td>
        ${cells}
      </tr>
    `;
  }).join('');

  // Average row
  const avgCells = comparisonsConfig.map(config => {
    const avg_nuc = calculateAverage(comparisons[config.key], 'nucleotideIdentity');
    const avg_aa = calculateAverage(comparisons[config.key], 'aminoAcidIdentity');
    const avg_bp = Math.round(calculateAverage(comparisons[config.key], 'nucConservedLength'));
    return `
      <td class="average-cell data-cell">
        <span class="cell-label">nt:</span>
        <span class="cell-value">${(avg_nuc * 100).toFixed(1)}%</span>
        <span class="cell-label">aa:</span>
        <span class="cell-value">${(avg_aa * 100).toFixed(1)}%</span>
        <span class="cell-label">bp:</span>
        <span class="cell-value">${avg_bp}</span>
      </td>
    `;
  }).join('');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Batch Comparison Table</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #e0e0e0;
      background: #1a1a1a;
      padding: 0;
      margin: 0;
    }
    
    .table-container {
      overflow-x: auto;
      margin: 0;
      padding: 0;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      background: #3d3d3d;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }
    
    thead {
      background: #1e3a5f;
      color: #e0e0e0;
    }
    
    th {
      padding: 4px 8px;
      text-align: left;
      font-weight: 600;
      font-size: 0.9em;
    }
    
    th:first-child {
      border-top-left-radius: 4px;
    }
    
    th:last-child {
      border-top-right-radius: 4px;
    }
    
    tbody tr {
      border-bottom: 1px solid #424242;
      line-height: 1.2;
      background: #3d3d3d;
      color: #e0e0e0;
    }
    
    tbody tr:hover {
      background: #4d4d4d;
    }
    
    tbody tr:last-child {
      border-bottom: none;
    }
    
    .average-row {
      background: #2d4d6d;
      font-weight: 600;
    }
    
    td {
      padding: 3px 8px;
      vertical-align: middle;
    }
    
    .gene-name {
      font-weight: 600;
      color: #90caf9;
      font-family: 'Courier New', monospace;
    }
    
    .data-cell {
      white-space: nowrap;
    }
    
    .cell-label {
      font-size: 0.8em;
      color: #9e9e9e;
      display: inline-block;
      width: 28px;
      text-align: right;
      padding-right: 3px;
    }
    
    .cell-value {
      font-weight: 600;
      color: #e0e0e0;
      display: inline-block;
      min-width: 50px;
      padding-right: 8px;
      text-align: left;
      font-size: 0.9em;
    }
    
    .cell-value.highlight {
      background: #66bb6a;
      color: #1a1a1a;
      padding: 1px 4px;
      border-radius: 2px;
    }
    
    .average-cell {
      background: #2d4d6d;
    }
    
    .no-data {
      color: #757575;
      font-style: italic;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th>Gene</th>
          ${comparisonsConfig.map(c => `<th>${c.label}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${tableRows}
        <tr class="average-row">
          <td class="gene-name">AVERAGE</td>
          ${avgCells}
        </tr>
      </tbody>
    </table>
  </div>
</body>
</html>
  `;

  return html.trim();
};

// Save HTML report to file
export const saveHTMLReport = (html, filename) => {
  const reportsDir = 'reports';
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }
  const filepath = `${reportsDir}/${filename}`;
  writeFileSync(filepath, html, 'utf8');
  console.log(`\n✅ HTML report saved to: ${filepath}`);
};
