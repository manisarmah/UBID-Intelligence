import { compareTwoStrings } from "string-similarity";

// Utility to normalize text for comparison
function normalizeText(text: string | null | undefined): string {
  if (!text) return "";
  let norm = text.toLowerCase();
  
  // Expand common business abbreviations
  norm = norm.replace(/\bpvt\b/g, "private");
  norm = norm.replace(/\bltd\b/g, "limited");
  norm = norm.replace(/\bindl\b/g, "industrial");
  norm = norm.replace(/\bcorp\b/g, "corporation");
  norm = norm.replace(/\binc\b/g, "incorporated");
  norm = norm.replace(/\bco\b/g, "company");

  // Remove punctuation and extra spaces
  norm = norm.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ");
  norm = norm.replace(/\s{2,}/g, " ").trim();
  
  return norm;
}

// Token-based overlap coefficient (handles cases where one string is a subset of another)
function getTokenOverlap(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  const set1 = new Set(str1.split(" ").filter(t => t.length > 0));
  const set2 = new Set(str2.split(" ").filter(t => t.length > 0));
  
  let intersectionCount = 0;
  for (const token of set1) {
    if (set2.has(token)) intersectionCount++;
  }
  
  const minLength = Math.min(set1.size, set2.size);
  if (minLength === 0) return 0;
  
  return intersectionCount / minLength;
}

export function calculateConfidence(recordA: any, recordB: any): { score: number, reason: string } {
  let score = 0;
  let maxPossibleScore = 0;
  let reasons: string[] = [];

  // 1. Hard Identifiers (PAN / GSTIN) - Strongest Signal
  const panA = recordA.pan?.trim().toUpperCase();
  const panB = recordB.pan?.trim().toUpperCase();
  const gstA = recordA.gstin?.trim().toUpperCase();
  const gstB = recordB.gstin?.trim().toUpperCase();

  if (panA && panB && panA === panB) {
    return { score: 1.0, reason: "PAN exactly matches." };
  } else if (gstA && gstB && gstA === gstB) {
    return { score: 1.0, reason: "GSTIN exactly matches." };
  } else if ((panA && gstB && gstB.includes(panA)) || (panB && gstA && gstA.includes(panB))) {
    return { score: 0.95, reason: "PAN of one matches with GSTIN of other." };
  } else if (panA && panB && panA !== panB) {
    return { score: 0.1, reason: "Different PANs detected. Almost certainly different entities." };
  } else if (gstA && gstB && gstA !== gstB) {
    return { score: 0.1, reason: "Different GSTINs detected." };
  }

  // 2. Business Name Comparison
  const nameA = normalizeText(recordA.businessName);
  const nameB = normalizeText(recordB.businessName);
  
  if (nameA && nameB) {
    maxPossibleScore += 30;
    const nameSimilarity = compareTwoStrings(nameA, nameB);
    score += nameSimilarity * 30;
    if (nameSimilarity > 0.8) {
      reasons.push("High semantic overlap between names.");
    }
  }

  // 3. Address Comparison (Using Token Overlap because addresses are often subsets of each other)
  const addrA = normalizeText(recordA.address) + " " + normalizeText(recordA.city) + " " + normalizeText(recordA.pincode);
  const addrB = normalizeText(recordB.address) + " " + normalizeText(recordB.city) + " " + normalizeText(recordB.pincode);
  
  if (addrA.trim() && addrB.trim()) {
    maxPossibleScore += 30;
    const addrSimilarity = getTokenOverlap(addrA, addrB);
    score += addrSimilarity * 30;
    if (addrSimilarity > 0.8) {
      reasons.push("Maximum overlap between addresses.");
    }
  }

  // 4. Phone Match (Bonus signal)
  if (recordA.phone && recordB.phone) {
    maxPossibleScore += 10;
    if (recordA.phone === recordB.phone) {
      score += 10;
      reasons.push("Phone numbers matched.");
    }
  }

  if (maxPossibleScore === 0) return { score: 0, reason: "No core data to compare." };

  const finalScore = score / maxPossibleScore;

  if (reasons.length === 0) {
    reasons.push("No exact identifier matches. Low semantic overlap.");
  }

  return { score: finalScore, reason: reasons.join(" ") };
}
