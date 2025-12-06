use wasm_bindgen::prelude::*;
use web_sys::console;

// ============================================================================
// Constants
// ============================================================================
const CODON_SIZE: usize = 3; // Fundamental: 3 nucleotides = 1 codon (does not change)

// ============================================================================
// Codon Table
// ============================================================================
// Amino acid lookup table
// Encoding: index = i1*16 + i2*4 + i3 where T=0, C=1, A=2, G=3
// Built from JS codon table to ensure exact match
const AMINO_ACIDS: &[u8] = b"FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG";

fn nuc_to_index(c: u8) -> Option<usize> {
  match c {
    b'T' | b't' => Some(0),
    b'C' | b'c' => Some(1),
    b'A' | b'a' => Some(2),
    b'G' | b'g' => Some(3),
    _ => None,
  }
}

fn translate_codon(c1: u8, c2: u8, c3: u8) -> u8 {
  match (nuc_to_index(c1), nuc_to_index(c2), nuc_to_index(c3)) {
    (Some(i1), Some(i2), Some(i3)) => AMINO_ACIDS[i1 * 16 + i2 * 4 + i3],
    _ => b'X',
  }
}

fn translate_dna_internal(seq: &[u8]) -> Vec<u8> {
  let codon_count = seq.len() / 3;
  let mut result = Vec::with_capacity(codon_count);
  for i in 0..codon_count {
    let pos = i * 3;
    result.push(translate_codon(seq[pos], seq[pos + 1], seq[pos + 2]));
  }
  result
}

// ============================================================================
// Comparison Core
// ============================================================================
fn compare_regions(seq1: &[u8], seq2: &[u8]) -> (Vec<u8>, usize) {
  let len = seq1.len().min(seq2.len());
  let mut mask = Vec::with_capacity(len);
  let mut mismatches = 0;
  
  for i in 0..len {
    if seq1[i] == seq2[i] {
      mask.push(seq1[i]);
    } else {
      mask.push(b'?');
      mismatches += 1;
    }
  }
  
  (mask, mismatches)
}

fn count_mismatches_in_mask(mask: &[u8]) -> usize {
  mask.iter().filter(|&&b| b == b'?').count()
}

// ============================================================================
// Conserved Blocks
// ============================================================================
#[derive(Clone)]
struct ConservedBlock {
  start: usize,
  end: usize,
  length: usize,
  sequence: Vec<u8>,
}

fn find_conserved_blocks(mask: &[u8], window_size: usize, min_identity: f64, min_significant_length_group: f64) -> Vec<ConservedBlock> {
  let mut blocks = Vec::new();
  let mut current_block = Vec::new();
  let mut block_start = 0;
  let mut in_block = false;
  
  let mut i = 0;
  while i < mask.len() {
    let end = (i + window_size).min(mask.len());
    let window = &mask[i..end];
    let mismatches = count_mismatches_in_mask(window);
    let identity = 1.0 - (mismatches as f64) / (window.len() as f64);
    
    if identity >= min_identity {
      if !in_block {
        block_start = i;
        in_block = true;
      }
      current_block.extend_from_slice(window);
    } else {
      if !current_block.is_empty() {
        blocks.push(ConservedBlock {
          start: block_start,
          end: block_start + current_block.len(),
          length: current_block.len(),
          sequence: current_block.clone(),
        });
        current_block.clear();
        in_block = false;
      }
    }
    i += window_size;
  }
  
  // Save final block
  if !current_block.is_empty() {
    blocks.push(ConservedBlock {
      start: block_start,
      end: block_start + current_block.len(),
      length: current_block.len(),
      sequence: current_block,
    });
  }
  
  // Filter small blocks
  if blocks.len() > 1 {
    let max_length = blocks.iter().map(|b| b.length).max().unwrap_or(0);
    let min_significant = (max_length as f64 * min_significant_length_group) as usize;
    let filtered: Vec<_> = blocks.iter().filter(|b| b.length >= min_significant).cloned().collect();
    if !filtered.is_empty() {
      return filtered;
    }
  }
  
  blocks
}

fn blocks_to_json(blocks: &[ConservedBlock]) -> String {
  let parts: Vec<String> = blocks.iter().map(|b| {
    format!(
      r#"{{"start":{},"end":{},"length":{},"sequence":"{}"}}"#,
      b.start, b.end, b.length,
      String::from_utf8_lossy(&b.sequence)
    )
  }).collect();
  format!("[{}]", parts.join(","))
}

// ============================================================================
// Full Sequence Comparison (exported)
// ============================================================================
#[wasm_bindgen]
pub fn compare_sequences_full(
  seq1: &str,
  seq2: &str,
  segment_window_length: usize,
  min_identity: f64,
  min_significant_length_group: f64,
  min_sequence_overlap_pct: f64,
) -> String {
  let bytes1 = seq1.as_bytes();
  let bytes2 = seq2.as_bytes();
  
  if bytes1.is_empty() || bytes2.is_empty() {
    return r#"{"mask":"","mismatches":0,"length":0,"identity":0,"truncated":true,"offset1":0,"offset2":0,"conservedBlocks":[]}"#.to_string();
  }
  
  let len1 = bytes1.len() as i32;
  let len2 = bytes2.len() as i32;
  let min_overlap = ((len1.min(len2) as f64) * min_sequence_overlap_pct).ceil() as i32;
  
  let mut best_offset1: i32 = 0;
  let mut best_offset2: i32 = 0;
  let mut best_identity: f64 = 0.0;
  let mut best_overlap_len: i32 = 0;
  let mut best_mismatches: i32 = i32::MAX;
  
  // Find best alignment
  for offset in (-len2 + min_overlap)..=(len1 - min_overlap) {
    let start1 = if offset > 0 { offset } else { 0 };
    let start2 = if offset < 0 { -offset } else { 0 };
    let overlap_len = (len1 - start1).min(len2 - start2);
    
    if overlap_len < min_overlap {
      continue;
    }
    
    // Count mismatches
    let mut mismatches: i32 = 0;
    for i in 0..overlap_len {
      if bytes1[(start1 + i) as usize] != bytes2[(start2 + i) as usize] {
        mismatches += 1;
      }
    }
    
    let identity = 1.0 - (mismatches as f64) / (overlap_len as f64);
    let is_better = identity > best_identity + 0.01
      || ((identity - best_identity).abs() < 0.01 && overlap_len > best_overlap_len);
    
    if is_better {
      best_identity = identity;
      best_offset1 = start1;
      best_offset2 = start2;
      best_overlap_len = overlap_len;
      best_mismatches = mismatches;
    }
    
    if mismatches == 0 {
      break;
    }
  }
  
  // Build mask
  let region1 = &bytes1[best_offset1 as usize..(best_offset1 + best_overlap_len) as usize];
  let region2 = &bytes2[best_offset2 as usize..(best_offset2 + best_overlap_len) as usize];
  let (mask, _) = compare_regions(region1, region2);
  
  // Find conserved blocks
  let blocks = find_conserved_blocks(&mask, segment_window_length, min_identity, min_significant_length_group);
  
  let truncated = len1 != len2 || best_offset1 != 0 || best_offset2 != 0;
  
  format!(
    r#"{{"mask":"{}","mismatches":{},"length":{},"identity":{},"truncated":{},"offset1":{},"offset2":{},"conservedBlocks":{}}}"#,
    String::from_utf8_lossy(&mask),
    best_mismatches,
    best_overlap_len,
    best_identity,
    truncated,
    best_offset1,
    best_offset2,
    blocks_to_json(&blocks)
  )
}

// ============================================================================
// Full Protein Comparison (exported)
// ============================================================================
#[wasm_bindgen]
pub fn compare_proteins_full(
  seq1: &str,
  seq2: &str,
  nuc_offset1: i32,
  nuc_offset2: i32,
  nuc_length: i32,
  aa_segment_window_length: usize,
  min_identity: f64,
  min_significant_length_group: f64,
) -> String {
  // Logging for reading frame detection
  console::log_1(&"\n📍 Reading Frame Detection:".into());
  console::log_1(&"   Note: mRNA sequences include 5' UTR, so they don't start at codon boundaries".into());
  
  // Find start codons
  let find_start_codon = |seq: &str| -> Option<usize> {
    seq.find("ATG")
  };
  
  let start1 = find_start_codon(seq1);
  let start2 = find_start_codon(seq2);
  
  if let (Some(s1), Some(s2)) = (start1, start2) {
    let frame1 = ((nuc_offset1 - s1 as i32) % CODON_SIZE as i32 + CODON_SIZE as i32) % CODON_SIZE as i32;
    let frame2 = ((nuc_offset2 - s2 as i32) % CODON_SIZE as i32 + CODON_SIZE as i32) % CODON_SIZE as i32;
    
    console::log_1(&format!("   Found start codons: seq1 at position {}, seq2 at position {}", s1, s2).into());
    console::log_1(&format!("   Alignment offset: seq1[{}], seq2[{}]", nuc_offset1, nuc_offset2).into());
    console::log_1(&format!("   Inferred frames relative to CDS: seq1 +{}, seq2 +{}", frame1, frame2).into());
    
    if frame1 != frame2 {
      console::log_1(&"   ⚠️  Nucleotide alignment broke the reading frame!".into());
      console::log_1(&"   Searching all 9 frame combinations for best protein alignment...".into());
    }
  } else {
    console::log_1(&"   Start codon not found in one or both sequences".into());
    console::log_1(&"   Trying all 9 reading frame combinations...".into());
  }
  
  let bytes1 = seq1.as_bytes();
  let bytes2 = seq2.as_bytes();
  
  // Find best reading frame
  let mut best_frame1: usize = 0;
  let mut best_frame2: usize = 0;
  let mut best_identity: f64 = 0.0;
  let mut best_aa1: Vec<u8> = Vec::new();
  let mut best_aa2: Vec<u8> = Vec::new();
  
  for frame1 in 0..CODON_SIZE {
    for frame2 in 0..CODON_SIZE {
      let start1 = (nuc_offset1 as usize) + frame1;
      let start2 = (nuc_offset2 as usize) + frame2;
      let adjusted_len = ((nuc_length as usize).saturating_sub(frame1))
        .min((nuc_length as usize).saturating_sub(frame2));
      
      if adjusted_len < aa_segment_window_length * CODON_SIZE {
        continue;
      }
      
      let end1 = (start1 + adjusted_len).min(bytes1.len());
      let end2 = (start2 + adjusted_len).min(bytes2.len());
      
      if start1 >= bytes1.len() || start2 >= bytes2.len() {
        continue;
      }
      
      let region1 = &bytes1[start1..end1];
      let region2 = &bytes2[start2..end2];
      
      let aa1 = translate_dna_internal(region1);
      let aa2 = translate_dna_internal(region2);
      
      let min_len = aa1.len().min(aa2.len());
      if min_len == 0 {
        continue;
      }
      
      let (_, mismatches) = compare_regions(&aa1[..min_len], &aa2[..min_len]);
      let identity = 1.0 - (mismatches as f64) / (min_len as f64);
      
      // Match JS behavior: use > (strictly greater) so first frame with best identity wins
      // When frames are checked in order (0,0), (0,1), (0,2), (1,0), etc., the first one
      // that achieves the best identity will be selected and subsequent equal identities won't replace it
      if identity > best_identity {
        best_identity = identity;
        best_frame1 = frame1;
        best_frame2 = frame2;
        best_aa1 = aa1;
        best_aa2 = aa2;
      }
    }
  }
  
  // Compare best amino acid sequences
  let length = best_aa1.len().min(best_aa2.len());
  let (mask, mismatches) = if length > 0 {
    compare_regions(&best_aa1[..length], &best_aa2[..length])
  } else {
    (Vec::new(), 0)
  };
  
  // Use best_identity from the loop (matches JS behavior)
  let identity = best_identity;
  
  // Find conserved blocks on amino acids
  let blocks = find_conserved_blocks(&mask, aa_segment_window_length, min_identity, min_significant_length_group);
  
  let adjusted_offset1 = nuc_offset1 as usize + best_frame1;
  let adjusted_offset2 = nuc_offset2 as usize + best_frame2;
  
  // Log best alignment
  console::log_1(&format!("   ✓ Best protein alignment: seq1 +{}, seq2 +{}", best_frame1, best_frame2).into());
  
  format!(
    r#"{{"aa1":"{}","aa2":"{}","mask":"{}","mismatches":{},"length":{},"identity":{},"truncated":{},"offset1":{},"offset2":{},"frame1":{},"frame2":{},"conservedBlocks":{}}}"#,
    String::from_utf8_lossy(&best_aa1),
    String::from_utf8_lossy(&best_aa2),
    String::from_utf8_lossy(&mask),
    mismatches,
    length,
    identity,
    best_aa1.len() != best_aa2.len(),
    adjusted_offset1 / CODON_SIZE,
    adjusted_offset2 / CODON_SIZE,
    best_frame1,
    best_frame2,
    blocks_to_json(&blocks)
  )
}
