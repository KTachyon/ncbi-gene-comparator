// FASTA format parsing utilities

// Parse FASTA format to extract header and sequence
export const parseFasta = (fastaData) => {
  const lines = fastaData.split("\n");
  
  // Extract header (first line starting with '>')
  const headerLine = lines.find(line => line.startsWith('>'));
  const header = headerLine ? headerLine.substring(1).trim() : "Unknown";
  
  // Extract sequence (skip header lines)
  const sequence = lines
    .filter(line => !line.startsWith('>'))
    .join("")
    .trim();
  
  if (!sequence) {
    throw new Error("No sequence data found in FASTA");
  }
  
  return { header, sequence };
};
