"use server";

import { PrismaClient } from "@prisma/client";
import { parse } from "csv-parse/sync";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { calculateConfidence } from "@/lib/matching";

const prisma = new PrismaClient();

// Helper to handle 503/429 spikes gracefully
async function generateWithRetry(model: any, prompt: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await model.generateContent(prompt);
    } catch (error: any) {
      const isTransient = error.status === 503 || error.status === 429 || error.message?.includes('503') || error.message?.includes('429');
      if (i === retries - 1 || !isTransient) throw error;
      
      const delay = Math.pow(2, i) * 1000 + (Math.random() * 500); // Exponential backoff with jitter
      console.warn(`Gemini API busy (503/429). Retrying in ${Math.round(delay)}ms...`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
}

// Target schema that we want to map into
const TARGET_SCHEMA = [
  "departmentName",
  "departmentId",
  "businessName",
  "address",
  "pincode",
  "city",
  "pan",
  "gstin",
  "phone",
  "email",
  "businessType"
];

export async function parseCsvHeaders(formData: FormData) {
  try {
    const file = formData.get("file") as File;
    if (!file) return { success: false, error: "No file provided" };
    
    const text = await file.text();
    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as any[];
    
    if (records.length === 0) return { success: false, error: "CSV is empty" };
    
    const headers = Object.keys(records[0]);
    // Send 3 sample rows to help LLM understand the data better
    const sampleRows = records.slice(0, 3);
    
    return { success: true, headers, sampleRows };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to parse CSV headers" };
  }
}

export async function suggestColumnMapping(headers: string[], sampleRows: any[]) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("No GEMINI_API_KEY found, using naive fallback mapping.");
      return { success: true, mapping: naiveFallbackMapping(headers) };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `
You are an expert data integration assistant.
I have a CSV file with the following headers:
${JSON.stringify(headers)}

Here are 3 sample rows to give you context on the data:
${JSON.stringify(sampleRows, null, 2)}

Our target database schema expects the following keys exactly:
${JSON.stringify(TARGET_SCHEMA)}

Your task is to map each of my CSV headers to ONE of the target schema keys based on semantic meaning.
If a CSV header does not match any target key semantically, map it to "IGNORE".
Return ONLY a valid JSON object where the keys are the original CSV headers and the values are the mapped target schema keys (or "IGNORE"). Do not include any markdown formatting like \`\`\`json.
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
    
    try {
      const mapping = JSON.parse(responseText);
      // Ensure all headers have a mapping
      headers.forEach(h => {
        if (!mapping[h]) mapping[h] = "IGNORE";
      });
      return { success: true, mapping };
    } catch (e) {
      console.error("Failed to parse LLM JSON:", responseText);
      return { success: true, mapping: naiveFallbackMapping(headers) };
    }

  } catch (error: any) {
    console.error("LLM Mapping error:", error);
    return { success: true, mapping: naiveFallbackMapping(headers) };
  }
}

function naiveFallbackMapping(headers: string[]) {
  const mapping: Record<string, string> = {};
  
  headers.forEach(h => {
    const hl = h.toLowerCase();
    if (hl.includes("name") || hl.includes("company") || hl.includes("firm")) mapping[h] = "businessName";
    else if (hl.includes("address") || hl.includes("location") || hl.includes("premises")) mapping[h] = "address";
    else if (hl.includes("pin") || hl.includes("zip")) mapping[h] = "pincode";
    else if (hl.includes("city") || hl.includes("town")) mapping[h] = "city";
    else if (hl.includes("pan")) mapping[h] = "pan";
    else if (hl.includes("gst")) mapping[h] = "gstin";
    else if (hl.includes("phone") || hl.includes("mobile")) mapping[h] = "phone";
    else if (hl.includes("mail")) mapping[h] = "email";
    else if (hl.includes("type") || hl.includes("category")) mapping[h] = "businessType";
    else if (hl.includes("dept") || hl.includes("department")) {
      if (hl.includes("id")) mapping[h] = "departmentId";
      else mapping[h] = "departmentName";
    }
    else mapping[h] = "IGNORE";
  });
  return mapping;
}

export async function uploadCsvAction(formData: FormData, mappingStr: string, globalDept: string = "") {
  try {
    const file = formData.get("file") as File;
    if (!file) {
      return { success: false, error: "No file provided" };
    }

    const mapping = JSON.parse(mappingStr);

    const text = await file.text();
    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const dbRecords = records.map((record: any) => {
      const mappedRecord: any = { departmentName: globalDept || "Unknown", departmentId: null }; // Default
      
      for (const [csvHeader, targetKey] of Object.entries(mapping)) {
        if (targetKey !== "IGNORE" && targetKey) {
          mappedRecord[targetKey as string] = record[csvHeader];
        }
      }
      return mappedRecord;
    }).filter((r: any) => r.businessName && r.address); // Ensure critical fields exist

    if (dbRecords.length === 0) {
        return { success: false, error: "No valid records after mapping. Make sure 'businessName' and 'address' are mapped correctly." };
    }

    const result = await prisma.rawRecord.createMany({
      data: dbRecords,
    });

    return { 
      success: true, 
      message: `Successfully mapped and ingested ${result.count} records.`,
      count: result.count 
    };

  } catch (error: any) {
    console.error("Error processing CSV:", error);
    return { success: false, error: error.message || "Failed to process CSV" };
  }
}

export async function runMatchingEngine() {
  try {
    const pendingRecords = await prisma.rawRecord.findMany({
      where: { status: "PENDING" }
    });

    if (pendingRecords.length === 0) {
      return { success: true, message: "No pending records to process." };
    }

    const unifiedRecords = await prisma.unifiedRecord.findMany();
    let autoLinkedCount = 0;
    let reviewCount = 0;
    let newUnifiedCount = 0;

    const ops: any[] = [];
    const HIGH_THRESHOLD = 0.85;
    const MEDIUM_THRESHOLD = 0.65;

    for (const raw of pendingRecords) {
      let bestMatch = null;
      let bestConfidence = 0;
      let bestReason = "";

      for (const uni of unifiedRecords) {
        const result = calculateConfidence(raw, uni);
        if (result.score > bestConfidence) {
          bestConfidence = result.score;
          bestMatch = uni;
          bestReason = result.reason;
        }
      }

      if (bestMatch && bestConfidence >= HIGH_THRESHOLD) {
        ops.push(prisma.rawRecord.update({
          where: { id: raw.id },
          data: {
            status: "AUTO_LINKED",
            ubid: bestMatch.ubid,
            matchScore: bestConfidence,
            matchReason: bestReason
          }
        }));

        const updateData: any = {};
        if (!bestMatch.pan && raw.pan) updateData.pan = raw.pan;
        if (!bestMatch.gstin && raw.gstin) updateData.gstin = raw.gstin;
        if (!bestMatch.pincode && raw.pincode) updateData.pincode = raw.pincode;
        if (!bestMatch.city && raw.city) updateData.city = raw.city;
        
        if (Object.keys(updateData).length > 0) {
           ops.push(prisma.unifiedRecord.update({
             where: { ubid: bestMatch.ubid },
             data: updateData
           }));
           Object.assign(bestMatch, updateData);
        }
        autoLinkedCount++;
      } else if (bestMatch && bestConfidence >= MEDIUM_THRESHOLD) {
        ops.push(prisma.linkDoubt.create({
          data: {
            rawRecordId1: raw.id,
            rawRecordId2: bestMatch.ubid,
            confidence: bestConfidence,
            status: "PENDING",
            comments: "AI detected partial match. Needs human review."
          }
        }));
        ops.push(prisma.rawRecord.update({
          where: { id: raw.id },
          data: { status: "REVIEW", matchScore: bestConfidence, matchReason: `Review required. ${bestReason}` }
        }));
        reviewCount++;
      } else {
        const newUbid = crypto.randomUUID();
        ops.push(prisma.unifiedRecord.create({
          data: {
            ubid: newUbid,
            businessName: raw.businessName,
            address: raw.address,
            pincode: raw.pincode,
            city: raw.city,
            pan: raw.pan,
            gstin: raw.gstin,
            activityStatus: "UNKNOWN"
          }
        }));
        ops.push(prisma.rawRecord.update({
          where: { id: raw.id },
          data: {
            status: "NEW_ENTITY",
            ubid: newUbid,
            matchScore: bestConfidence,
            matchReason: bestMatch ? `Low confidence. ${bestReason} Created new identity.` : "No existing identities to compare. Created new identity."
          }
        }));
        newUnifiedCount++;
      }

      if (ops.length >= 50) {
        await prisma.$transaction(ops);
        ops.length = 0;
      }
    }

    if (ops.length > 0) {
      await prisma.$transaction(ops);
    }

    return {
      success: true,
      message: `Matching complete! Auto-linked: ${autoLinkedCount}, Sent to Review: ${reviewCount}, Created New UBIDs: ${newUnifiedCount}`
    };

  } catch (error: any) {
    console.error("Matching engine error:", error);
    return { success: false, error: error.message || "Failed to run matching engine" };
  }
}

export async function getPendingRecords(page = 1, limit = 10, filters: any = {}) {
  try {
    const skip = (page - 1) * limit;
    
    // Only fetch PENDING records
    const whereClause: any = { status: "PENDING" };
    
    if (filters.dept) whereClause.departmentName = { contains: filters.dept };
    if (filters.name) whereClause.businessName = { contains: filters.name };
    if (filters.address) whereClause.address = { contains: filters.address };
    if (filters.id) {
      whereClause.OR = [
        { pan: { contains: filters.id } },
        { gstin: { contains: filters.id } }
      ];
    }

    const [records, total] = await Promise.all([
      prisma.rawRecord.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.rawRecord.count({ where: whereClause })
    ]);
    return { success: true, records, total, pages: Math.ceil(total / limit) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getUnifiedRecords(page = 1, limit = 10, filters: any = {}) {
  try {
    const skip = (page - 1) * limit;

    const whereClause: any = {};
    if (filters.name) whereClause.businessName = { contains: filters.name, mode: 'insensitive' };
    if (filters.address) whereClause.address = { contains: filters.address, mode: 'insensitive' };
    if (filters.ubid) whereClause.ubid = { contains: filters.ubid, mode: 'insensitive' };
    if (filters.activity && filters.activity !== "All") whereClause.activityStatus = filters.activity;
    if (filters.id) {
      whereClause.OR = [
        { pan: { contains: filters.id, mode: 'insensitive' } },
        { gstin: { contains: filters.id, mode: 'insensitive' } }
      ];
    }
    
    const rawRecordFilter: any = {};
    if (filters.dept) rawRecordFilter.departmentName = { contains: filters.dept, mode: 'insensitive' };
    if (filters.status && filters.status !== "All" && filters.status !== "IN_REVIEW") rawRecordFilter.status = filters.status;
    if (filters.score) {
      const s = parseFloat(filters.score) / 100;
      if (!isNaN(s)) rawRecordFilter.matchScore = { gte: s };
    }
    if (filters.reasoning) rawRecordFilter.matchReason = { contains: filters.reasoning, mode: 'insensitive' };

    if (Object.keys(rawRecordFilter).length > 0) {
      whereClause.rawRecords = { some: rawRecordFilter };
    }

    if (filters.status === "IN_REVIEW") {
       const doubts = await prisma.linkDoubt.findMany({ where: { status: "PENDING" }, select: { rawRecordId2: true } });
       const doubtUbids = doubts.map(d => d.rawRecordId2).filter(Boolean) as string[];
       if (whereClause.ubid) {
           whereClause.AND = [ { ubid: whereClause.ubid }, { ubid: { in: doubtUbids } } ];
           delete whereClause.ubid;
       } else {
           whereClause.ubid = { in: doubtUbids };
       }
    }

    const [records, total] = await Promise.all([
      prisma.unifiedRecord.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { rawRecords: true }
      }),
      prisma.unifiedRecord.count({ where: whereClause })
    ]);

    const ubids = records.map(r => r.ubid);
    const linkDoubts = await prisma.linkDoubt.findMany({
      where: { rawRecordId2: { in: ubids }, status: "PENDING" }
    });

    const doubtRawIds = linkDoubts.map(d => d.rawRecordId1);
    const doubtRaws = await prisma.rawRecord.findMany({
      where: { id: { in: doubtRawIds } }
    });

    const recordsWithDoubts = records.map(r => {
      const doubts = linkDoubts.filter(d => d.rawRecordId2 === r.ubid);
      const rawDoubts = doubts.map(d => {
        const raw = doubtRaws.find(raw => raw.id === d.rawRecordId1);
        if (!raw) return null;
        return { ...raw, doubtId: d.id };
      }).filter(Boolean);
      return { ...r, linkDoubts: rawDoubts };
    });

    // Enrich with event review metadata for badges
    const [pendingEventDoubts, linkedEvents, pendingMasterEvents] = await Promise.all([
      prisma.eventDoubt.findMany({ where: { ubid: { in: ubids }, status: 'PENDING' }, select: { ubid: true } }),
      prisma.activityEvent.findMany({ where: { ubid: { in: ubids }, status: 'LINKED' }, select: { ubid: true } }),
      prisma.activityEvent.findMany({ where: { ubid: { in: ubids }, status: 'PENDING_MASTER_REVIEW' }, select: { ubid: true } }),
    ]);

    const enriched = recordsWithDoubts.map(r => {
      const pendingEventReviewCount = pendingEventDoubts.filter(e => e.ubid === r.ubid).length;
      const hasLinkedEvents = linkedEvents.some(e => e.ubid === r.ubid);
      const hasPendingMasterEventReview = pendingMasterEvents.some(e => e.ubid === r.ubid);
      return { ...r, pendingEventReviewCount, hasLinkedEvents, hasPendingMasterEventReview };
    });

    return { success: true, records: enriched, total, pages: Math.ceil(total / limit) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getReviewCount() {
  try {
    const count = await prisma.linkDoubt.count({ where: { status: "PENDING" } });
    return { success: true, count };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getEventReviewCount() {
  try {
    const count = await prisma.eventDoubt.count({ where: { status: "PENDING" } });
    return { success: true, count };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
export async function getPendingDoubts() {
  try {
    const doubts = await prisma.linkDoubt.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" }
    });

    const rawIds = doubts.map(d => d.rawRecordId1);
    const ubids = doubts.map(d => d.rawRecordId2);

    const [rawRecords, unifiedRecords] = await Promise.all([
      prisma.rawRecord.findMany({ where: { id: { in: rawIds } } }),
      prisma.unifiedRecord.findMany({ where: { ubid: { in: ubids } } })
    ]);

    const enrichedDoubts = doubts.map(doubt => ({
      ...doubt,
      rawRecord: rawRecords.find(r => r.id === doubt.rawRecordId1),
      unifiedRecord: unifiedRecords.find(u => u.ubid === doubt.rawRecordId2)
    }));

    return { success: true, doubts: enrichedDoubts };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function approveDoubt(doubtId: string, reviewerNotes?: string) {
  try {
    const doubt = await prisma.linkDoubt.findUnique({ where: { id: doubtId } });
    if (!doubt) throw new Error("Doubt not found");

    const raw = await prisma.rawRecord.findUnique({ where: { id: doubt.rawRecordId1 } });
    const uni = await prisma.unifiedRecord.findUnique({ where: { ubid: doubt.rawRecordId2 } });

    if (!raw || !uni) throw new Error("Records not found");

    const updateData: any = {};
    if (!uni.pan && raw.pan) updateData.pan = raw.pan;
    if (!uni.gstin && raw.gstin) updateData.gstin = raw.gstin;
    if (!uni.pincode && raw.pincode) updateData.pincode = raw.pincode;
    if (!uni.city && raw.city) updateData.city = raw.city;

    const baseReason = "Human reviewer manually approved the merge.";
    const finalReason = reviewerNotes ? `${baseReason} Note: ${reviewerNotes}` : baseReason;

    const transactions: any[] = [
      prisma.linkDoubt.update({
        where: { id: doubtId },
        data: { status: "APPROVED" }
      }),
      prisma.rawRecord.update({
        where: { id: doubt.rawRecordId1 },
        data: {
          status: "MANUAL_LINK",
          ubid: doubt.rawRecordId2,
          matchReason: finalReason
        }
      })
    ];

    if (Object.keys(updateData).length > 0) {
      transactions.push(prisma.unifiedRecord.update({
        where: { ubid: uni.ubid },
        data: updateData
      }));
    }

    await prisma.$transaction(transactions);

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function rejectDoubt(doubtId: string, reviewerNotes?: string) {
  try {
    const doubt = await prisma.linkDoubt.findUnique({ where: { id: doubtId } });
    if (!doubt) throw new Error("Doubt not found");

    const raw = await prisma.rawRecord.findUnique({ where: { id: doubt.rawRecordId1 } });
    if (!raw) throw new Error("Raw record not found");

    const newUni = await prisma.unifiedRecord.create({
      data: {
        businessName: raw.businessName,
        address: raw.address,
        pincode: raw.pincode,
        city: raw.city,
        pan: raw.pan,
        gstin: raw.gstin,
      }
    });

    const baseReason = "Human reviewer rejected merge. Created new identity.";
    const finalReason = reviewerNotes ? `${baseReason} Note: ${reviewerNotes}` : baseReason;

    await prisma.$transaction([
      prisma.linkDoubt.update({
        where: { id: doubtId },
        data: { status: "REJECTED" }
      }),
      prisma.rawRecord.update({
        where: { id: doubt.rawRecordId1 },
        data: {
          status: "NEW_ENTITY",
          ubid: newUni.ubid,
          matchReason: finalReason
        }
      })
    ]);

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getRawRecordById(id: string) {
  try {
    const record = await prisma.rawRecord.findUnique({
      where: { id },
      include: { unifiedRecord: true }
    });
    return { success: true, record };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// --- PART B: EVENT INGESTION & MAPPING ---

export async function parseEventCsvHeaders(formData: FormData) {
  try {
    const file = formData.get("file") as File;
    if (!file) return { success: false, error: "No file provided" };
    const text = await file.text();
    const records = parse(text, { columns: true, skip_empty_lines: true, trim: true }) as any[];
    if (records.length === 0) return { success: false, error: "CSV is empty" };
    return { success: true, headers: Object.keys(records[0]), sampleRows: records.slice(0, 3) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function uploadEventsAction(formData: FormData, mappingStr: string, globalDept: string = "Unknown") {
  try {
    const file = formData.get("file") as File;
    const mapping = JSON.parse(mappingStr);
    const text = await file.text();
    const records = parse(text, { columns: true, skip_empty_lines: true, trim: true }) as any[];

    const dbRecords = records.map((record: any) => {
      const mappedRecord: any = { departmentName: globalDept, eventDate: new Date(), status: "PENDING" };
      const metadataObj: any = {};
      for (const [csvHeader, targetKey] of Object.entries(mapping)) {
        if (targetKey !== "IGNORE" && targetKey) {
          if (targetKey === "eventDate") mappedRecord[targetKey] = new Date(record[csvHeader]);
          else mappedRecord[targetKey as string] = record[csvHeader];
        }
        // Always store ALL columns in metadata (mapped + unmapped) so inference engine has full context
        metadataObj[csvHeader] = record[csvHeader];
      }
      mappedRecord.metadata = JSON.stringify(metadataObj);
      if (!mappedRecord.eventType) mappedRecord.eventType = "GENERAL_ACTIVITY";
      return mappedRecord;
    });

    const result = await prisma.activityEvent.createMany({ data: dbRecords });
    return { success: true, count: result.count };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function runEventMappingEngine() {
  try {
    const pendingEvents = await prisma.activityEvent.findMany({ where: { status: "PENDING" } });
    if (pendingEvents.length === 0) return { success: true, message: "No pending events." };

    // Load all master data for matching
    const rawRecords = await prisma.rawRecord.findMany();
    const unifiedRecords = await prisma.unifiedRecord.findMany();

    // Pre-compute which UBIDs have pending master review (LinkDoubt PENDING)
    const pendingLinkDoubts = await prisma.linkDoubt.findMany({ where: { status: "PENDING" } });
    const rawIdsWithPendingMasterReview = new Set([
      ...pendingLinkDoubts.map(d => d.rawRecordId1),
      ...pendingLinkDoubts.map(d => d.rawRecordId2),
    ]);
    // Map UBID -> whether any of its raw records has a pending doubt
    const ubidsWithPendingMasterReview = new Set(
      rawRecords
        .filter(r => r.ubid && rawIdsWithPendingMasterReview.has(r.id))
        .map(r => r.ubid as string)
    );

    let linkedCount = 0;
    let reviewCount = 0;
    let rejectedCount = 0;
    let pendingMasterCount = 0;
    const linkedUbids = new Set<string>(); // track which UBIDs got direct events linked

    const ops: any[] = [];
    const FUZZY_REVIEW_THRESHOLD = 0.75;

    for (const event of pendingEvents) {
      // ── STEP 1: Department ID exact match ──
      let directMatch: any;
      const eventDeptId = event.departmentId?.toString().trim();
      if (eventDeptId && eventDeptId !== "NaN") {
        directMatch = rawRecords.find(r => r.departmentId?.toString().trim() === eventDeptId && r.ubid);
      }

      if (directMatch && directMatch.ubid) {
        const targetUbid = directMatch.ubid;
        if (ubidsWithPendingMasterReview.has(targetUbid)) {
          ops.push(prisma.activityEvent.update({
            where: { id: event.id },
            data: { status: "PENDING_MASTER_REVIEW", ubid: targetUbid }
          }));
          pendingMasterCount++;
        } else {
          ops.push(prisma.activityEvent.update({
            where: { id: event.id },
            data: { status: "LINKED", ubid: targetUbid }
          }));
          linkedUbids.add(targetUbid);
          linkedCount++;
        }
      } else {
        // ── STEP 2: Fuzzy fallback ──
        let bestMatch: any = null;
        let bestConfidence = 0;

        if (event.pan) {
          const m = unifiedRecords.find(u => u.pan === event.pan);
          if (m) { bestMatch = m; bestConfidence = 1.0; }
        }
        if (!bestMatch && event.gstin) {
          const m = unifiedRecords.find(u => u.gstin === event.gstin);
          if (m) { bestMatch = m; bestConfidence = 1.0; }
        }

        if (!bestMatch) {
          for (const uni of unifiedRecords) {
            const mockRaw: any = {
              businessName: event.businessName || "",
              address: event.address || "",
              pincode: event.pincode,
              city: event.city,
              pan: event.pan,
              gstin: event.gstin
            };
            const result = calculateConfidence(mockRaw, uni);
            if (result.score > bestConfidence) {
              bestConfidence = result.score;
              bestMatch = uni;
            }
          }
        }

        if (bestMatch && bestConfidence >= FUZZY_REVIEW_THRESHOLD) {
          if (ubidsWithPendingMasterReview.has(bestMatch.ubid)) {
            ops.push(prisma.activityEvent.update({
              where: { id: event.id },
              data: { status: "PENDING_MASTER_REVIEW", ubid: bestMatch.ubid }
            }));
            pendingMasterCount++;
          } else {
            ops.push(prisma.eventDoubt.create({
              data: {
                eventId: event.id,
                ubid: bestMatch.ubid,
                confidence: bestConfidence,
                status: "PENDING",
                comments: `Fuzzy match at ${(bestConfidence * 100).toFixed(0)}% confidence. Requires human review.`
              }
            }));
            ops.push(prisma.activityEvent.update({
              where: { id: event.id },
              data: { status: "REVIEW" }
            }));
            reviewCount++;
          }
        } else {
          ops.push(prisma.activityEvent.update({
            where: { id: event.id },
            data: { status: "REJECTED" }
          }));
          rejectedCount++;
        }
      }

      if (ops.length >= 50) {
        await prisma.$transaction(ops);
        ops.length = 0;
      }
    }

    if (ops.length > 0) {
      await prisma.$transaction(ops);
    }

    return { 
      success: true, 
      message: `Events Linked: ${linkedCount}, Sent to Review: ${reviewCount}, Pending Master Review: ${pendingMasterCount}, Auto-Rejected: ${rejectedCount}`,
      linkedUbids: Array.from(linkedUbids)
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function runActivityInferenceEngine() {
  try {
    const unifiedRecords = await prisma.unifiedRecord.findMany({
      include: { activityEvents: { where: { status: "LINKED" }, orderBy: { eventDate: 'desc' } } }
    });

    let updatedCount = 0;
    const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    // gemini-2.0-flash is fine — we only make 1 API call total per run now (BATCH_SIZE=10000)
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Handle no-event records instantly (no LLM needed)
    for (const uni of unifiedRecords) {
      if (uni.activityEvents.length === 0 && uni.activityStatus !== "UNKNOWN") {
        await prisma.unifiedRecord.update({
          where: { ubid: uni.ubid },
          data: { activityStatus: "UNKNOWN", activityReason: "No transaction events linked to this identity." }
        });
        updatedCount++;
      }
    }

    // Only LLM-process records that have events
    const recordsWithEvents = unifiedRecords.filter(u => u.activityEvents.length > 0);
    const BATCH_SIZE = 10000; // Send all at once — Gemma 3 12B has 128K context, easily handles 500+ businesses in 1 call
    const batches: typeof recordsWithEvents[] = [];
    for (let i = 0; i < recordsWithEvents.length; i += BATCH_SIZE) {
      batches.push(recordsWithEvents.slice(i, i + BATCH_SIZE));
    }

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];
      const batchPayload = batch.map(uni => ({
        ubid: uni.ubid,
        businessName: uni.businessName,
        events: uni.activityEvents.map(e => {
          // Parse metadata safely
          let meta = {};
          try { meta = e.metadata ? JSON.parse(e.metadata) : {}; } catch {}
          return {
            eventDate: e.eventDate,
            eventType: e.eventType,
            department: e.departmentName,
            description: e.description,
            // Include all raw CSV columns from metadata for full context
            rawData: meta
          };
        })
      }));

      const prompt = `You are an intelligence engine classifying operational status for a batch of businesses.
The current date is ${currentDate}.

For EACH business in the input array, analyze its events and determine:
1. Operational status: "ACTIVE", "DORMANT", or "CLOSED"
2. A concise specific reason citing actual data points from the events

STRICT CLASSIFICATION RULES:
1. Time-Based Baseline (compare event dates to current date ${currentDate}):
   - Any event within last 6 months -> ACTIVE
   - Latest event 6 months to 2 years ago -> DORMANT
   - Latest event older than 2 years -> CLOSED
2. Semantic Override (TRUMPS TIME RULES):
   - Deeply analyze ALL key-value pairs in the 'metadata' objects.
   - If ANY metadata field contains signals like "shut down", "permanently closed", "license revoked", "bankrupt", "ceased operations" -> classify as CLOSED regardless of date.
3. Reason must be highly specific - extract exact dates, amounts, and remarks from metadata.
   - GOOD: "Latest BESCOM bill of Rs 4,500 paid on Jan 12th, 2024."
   - GOOD: "KSPCB inspection on Aug 14th, 2023 noted facility is permanently shut down."
   - BAD: "General activity detected." or "Operating."
4. If the status is CLOSED, always append this exact phrase to the end of the reason: ", suggesting this business has likely been inactive for an extended period."

Return ONLY a valid JSON array (no markdown) with one object per business:
[{ "ubid": "...", "status": "ACTIVE|DORMANT|CLOSED", "reason": "..." }, ...]

Businesses to classify:
${JSON.stringify(batchPayload, null, 2)}`;

      try {
        const result = await generateWithRetry(model, prompt);
        const responseText = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed: Array<{ ubid: string; status: string; reason: string }> = JSON.parse(responseText);

        for (const item of parsed) {
          const uni = batch.find(u => u.ubid === item.ubid);
          if (!uni) continue;
          const newStatus = item.status || "UNKNOWN";
          const reason = item.reason || "No reasoning returned by LLM.";
          if (uni.activityStatus !== newStatus || uni.activityReason !== reason) {
            await prisma.unifiedRecord.update({
              where: { ubid: item.ubid },
              data: { activityStatus: newStatus, activityReason: reason }
            });
            updatedCount++;
          }
        }
      } catch (batchError: any) {
        const fullError = batchError?.message || batchError?.toString() || "Unknown error";
        console.error(`Batch ${batchIdx + 1} inference error:`, fullError);
        for (const uni of batch) {
          await prisma.unifiedRecord.update({
            where: { ubid: uni.ubid },
            data: { activityStatus: "UNKNOWN", activityReason: `AI inference failed: ${fullError.slice(0, 200)}` }
          });
        }
      }

      // 2s delay between batches to stay safe within 30 RPM
      if (batchIdx < batches.length - 1) {
        await new Promise(res => setTimeout(res, 2000));
      }
    }

    return { success: true, message: `Successfully inferred activity status for ${updatedCount} businesses.` };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getPendingEventDoubts() {
  try {
    const doubts = await prisma.eventDoubt.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" }
    });

    const eventIds = doubts.map(d => d.eventId);
    const ubids = doubts.map(d => d.ubid).filter(id => id !== "ORPHAN");

    const [activityEvents, unifiedRecords] = await Promise.all([
      prisma.activityEvent.findMany({ where: { id: { in: eventIds } } }),
      prisma.unifiedRecord.findMany({ where: { ubid: { in: ubids } } })
    ]);

    const enrichedDoubts = doubts.map(doubt => ({
      ...doubt,
      activityEvent: activityEvents.find(e => e.id === doubt.eventId),
      unifiedRecord: doubt.ubid === "ORPHAN" ? null : unifiedRecords.find(u => u.ubid === doubt.ubid)
    }));

    return { success: true, doubts: enrichedDoubts };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function approveEventDoubt(doubtId: string, reviewerNotes?: string) {
  try {
    const doubt = await prisma.eventDoubt.findUnique({ where: { id: doubtId } });
    if (!doubt) throw new Error("Doubt not found");

    if (doubt.ubid === "ORPHAN") {
      throw new Error("Cannot auto-approve an ORPHAN event. You must manually link it to a UBID or reject it.");
    }

    await prisma.activityEvent.update({
      where: { id: doubt.eventId },
      data: { status: "LINKED", ubid: doubt.ubid }
    });

    await prisma.eventDoubt.update({
      where: { id: doubtId },
      data: { status: "APPROVED", comments: reviewerNotes }
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function rejectEventDoubt(doubtId: string, reviewerNotes?: string) {
  try {
    const doubt = await prisma.eventDoubt.findUnique({ where: { id: doubtId } });
    if (!doubt) throw new Error("Doubt not found");

    await prisma.activityEvent.update({
      where: { id: doubt.eventId },
      data: { status: "REJECTED" } 
    });

    await prisma.eventDoubt.update({
      where: { id: doubtId },
      data: { status: "REJECTED", comments: reviewerNotes }
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getAuditLogs() {
  try {
    const rawRecords = await prisma.rawRecord.findMany({
      where: { status: { not: "PENDING" } },
      orderBy: { createdAt: "desc" },
      take: 3000
    });
    
    const events = await prisma.activityEvent.findMany({
      where: { status: { not: "PENDING" } },
      orderBy: { eventDate: "desc" },
      take: 3000
    });

    return { success: true, masterData: rawRecords, events };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function undoMasterMapping(rawId: string) {
  try {
    const raw = await prisma.rawRecord.findUnique({ where: { id: rawId } });
    if (!raw) throw new Error("Record not found.");

    if (raw.status === "NEW_ENTITY" && raw.ubid) {
      const linkedCount = await prisma.rawRecord.count({ where: { ubid: raw.ubid } });
      if (linkedCount <= 1) {
        await prisma.rawRecord.update({ where: { id: rawId }, data: { status: "PENDING", ubid: null, matchScore: null, matchReason: "Reverted from NEW_ENTITY. Now pending matching." } });
        await prisma.unifiedRecord.delete({ where: { ubid: raw.ubid } }).catch(() => {});
      } else {
        await prisma.rawRecord.update({ where: { id: rawId }, data: { status: "PENDING", ubid: null, matchScore: null, matchReason: "Reverted from NEW_ENTITY. Now pending matching." } });
      }
    } else if (raw.status === "AUTO_LINKED" || raw.status === "MANUAL_LINK") {
      const newUni = await prisma.unifiedRecord.create({
        data: {
          businessName: raw.businessName,
          address: raw.address,
          pincode: raw.pincode,
          city: raw.city,
          pan: raw.pan,
          gstin: raw.gstin,
        }
      });
      await prisma.rawRecord.update({ 
        where: { id: rawId }, 
        data: { 
          status: "NEW_ENTITY", 
          ubid: newUni.ubid, 
          matchScore: null, 
          matchReason: `Reverted from ${raw.status}. Split into isolated entity.` 
        } 
      });
    } else {
      await prisma.rawRecord.update({ where: { id: rawId }, data: { status: "PENDING", ubid: null, matchScore: null, matchReason: "Reverted. Now pending matching." } });
    }

    await prisma.linkDoubt.deleteMany({ where: { rawRecordId1: rawId } }).catch(() => {});

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function undoEventMapping(eventId: string) {
  try {
    await prisma.activityEvent.update({
      where: { id: eventId },
      data: { status: "PENDING", ubid: null }
    });
    await prisma.eventDoubt.deleteMany({ where: { eventId: eventId } }).catch(() => {});
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function executeNLQuery(query: string) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { success: false, error: "GEMINI_API_KEY is missing." };

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Step 1: SQL Generation
    const sqlPrompt = `
You are an expert Data Analyst and PostgreSQL database engineer working on the UBID (Unique Business Identifier) platform for Karnataka.
Our goal is to map fragmented business records and track their activity (Active, Dormant, Closed) across multiple department systems without altering the source databases.

DATABASE SCHEMA (PostgreSQL):
- "UnifiedRecord" ("ubid", "businessName", "address", "pincode", "city", "pan", "gstin", "activityStatus", "activityReason", "createdAt", "updatedAt"): The single source of truth for a unique business. 'activityStatus' is exactly one of: 'ACTIVE', 'DORMANT', 'CLOSED', or 'UNKNOWN'.
- "RawRecord" ("id", "departmentName", "departmentId", "businessName", "address", "pincode", "city", "pan", "gstin", "phone", "email", "businessType", "status", "matchScore", "matchReason", "ubid", "createdAt", "updatedAt"): Represents raw fragmented departmental data. 'status' is exactly one of: 'PENDING', 'AUTO_LINKED', 'MANUAL_LINK', 'NEW_ENTITY'.
- "ActivityEvent" ("id", "departmentName", "departmentId", "eventType", "eventDate", "description", "metadata", "businessName", "address", "pincode", "city", "pan", "gstin", "ubid", "status", "createdAt", "updatedAt"): Represents raw operational events (e.g., inspections, consumption).
- "LinkDoubt" ("id", "rawRecordId1", "rawRecordId2", "confidence", "status", "comments", "createdAt"): Represents ambiguous matches sent for human review.
- "EventDoubt" ("id", "eventId", "ubid", "confidence", "status", "comments", "createdAt"): Represents ambiguous event mappings sent for human review.

APPLICATION LOGIC & DICTIONARY (CRITICAL):
1. **"Unique Businesses"**: Refers to the "UnifiedRecord" table. Do NOT count RawRecords to find unique businesses.
2. **"Active / Dormant / Closed"**: Explicitly refers to the "activityStatus" column in the "UnifiedRecord" table! Do NOT try to infer this by checking for empty ActivityEvents. If someone asks for "dormant businesses", query "UnifiedRecord"."activityStatus" = 'DORMANT'.
3. **"Linked / Merged / Fragmented"**: Refers to "RawRecord"s that have been assigned a "ubid" (status = AUTO_LINKED or MANUAL_LINK).
4. **"Doubts / Ambiguous / Review"**: Refers to the "LinkDoubt" or "EventDoubt" tables where human reviewers intervene.
5. **Geographic Searches (City/Pincode)**: Data is extremely messy. 'city' might be blank. If a user asks for a city (e.g., "Bangalore"), ALWAYS cast a wide net using LOWER() and ILIKE (Postgres case-insensitive like) on the "address" column as a fallback, and ALWAYS expand semantic aliases naturally (e.g., '%bangalore%', '%bengaluru%', '%blr%'). Do the same for pincodes (check if the pincode string exists inside the address).

USER QUERY: "${query}"

INSTRUCTIONS:
1. Perform a deep semantic analysis of the query. Think step-by-step using the Application Logic dictionary.
2. Translate this logic into a highly robust, optimized, READ-ONLY PostgreSQL query (SELECT only).
3. CRITICAL: You MUST use double quotes for ALL table and column names (e.g., "UnifiedRecord"."businessName") because PostgreSQL is case-sensitive for unquoted identifiers.
4. Provide a JSON response (without markdown formatting) with the following strictly defined keys:
   {
     "isValid": boolean (true if the query relates to the domain; false otherwise),
     "thoughtProcess": "string (explain your step-by-step reasoning on how you parsed the intent, expanded edge cases, and mapped it to the specific schema rules above)",
     "sql": "string (the final robust PostgreSQL query with double-quoted identifiers)",
     "explanation": "string (a very brief, user-friendly 1-2 sentence summary of what the query is going to do)"
   }
`;

    const sqlResult = await generateWithRetry(model, sqlPrompt);
    const responseText = sqlResult.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch (e) {
      return { success: false, error: "Failed to parse AI response into SQL." };
    }

    if (!parsed.isValid) {
      return { success: true, isValid: false };
    }

    // Security block to prevent destructive queries
    if (/insert|update|delete|drop|alter|create/i.test(parsed.sql)) {
       return { success: false, error: "Only SELECT queries are allowed for security." };
    }

    // Step 2: Execute query
    const rows: any[] = await prisma.$queryRawUnsafe(parsed.sql);

    // Extract columns
    let columns: string[] = [];
    if (rows.length > 0) {
      columns = Object.keys(rows[0]);
    }

    // Handle BigInts for JSON serialization (Prisma returns COUNT as BigInt)
    const sanitizedRows = rows.map(row => {
      const newRow: any = {};
      for (const [key, value] of Object.entries(row)) {
        newRow[key] = typeof value === 'bigint' ? Number(value) : value;
      }
      return newRow;
    });

    // Step 3: Optional AI Summary
    let summary = "Results returned successfully.";
    if (sanitizedRows.length <= 15) {
      const summaryPrompt = `
The user asked: "${query}"
The database returned the following JSON result:
${JSON.stringify(sanitizedRows, null, 2)}
Please provide a brief, conversational 1-2 sentence summary of this result answering the user's question directly.
If the array is empty, simply say "No records were found matching your criteria."
`;
      const summaryResult = await generateWithRetry(model, summaryPrompt);
      summary = summaryResult.response.text().trim();
    } else {
      summary = `Found ${sanitizedRows.length} records. Showing the tabular data above.`;
    }

    return { 
      success: true, 
      isValid: true, 
      sql: parsed.sql, 
      explanation: parsed.explanation, 
      columns, 
      rows: sanitizedRows,
      summary 
    };

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

