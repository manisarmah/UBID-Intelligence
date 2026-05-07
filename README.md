

# 🏛️ UBID: Business Identity Resolution & Activity Intelligence Layer

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-black?style=flat&logo=next.js&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=flat&logo=Prisma&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat&logo=vercel&logoColor=white)

A confidence-driven platform built for **Karnataka Commerce & Industries** to transform fragmented departmental data silos into a unified, intelligent, and actionable business intelligence layer.

---

## 🛑 The Problem
Karnataka's business ecosystem operates across 40+ isolated department systems (Factories, Shops, KSPCB, BESCOM, etc.). Because these systems were built independently, they lack shared identifiers, store data as unstructured text, and only partially capture PAN/GSTIN. 

Consequently, the State cannot accurately answer fundamental questions like:
* *How many unique businesses are actually operating?*
* *What is their real-time operational status (Active/Dormant/Closed)?*

**Constraint:** We cannot modify, re-platform, or disrupt the existing source department systems.

---

## 💡 Our Solution
We built a non-intrusive, external intelligence layer divided into two core pipelines:

### **Part A: Entity Resolution & UBID Assignment**
We ingest fragmented records, normalize the data, and use multi-signal fuzzy matching (Name, Address, PAN/GSTIN) to group records belonging to the same real-world entity. 
* **High Confidence (>85%):** Auto-linked into a single profile.
* **Medium Confidence (60-85%):** Routed to a Human-in-the-loop Reviewer Dashboard.
* **Golden Record & Anchoring:** Unified profiles are assigned a Unique Business Identifier (UBID), anchored to their PAN/GSTIN if present, or given a temporary ID that can be promoted later.

### **Part B: Activity Intelligence**
We map highly dynamic transaction event logs (electricity bills, inspections, renewals) back to the Master UBID. By analyzing the temporal recency of these events, the system deterministically infers whether a business is **Active**, **Dormant**, or **Closed**, providing plain-text explainability for every classification.

---

## 📐 Architecture Flow

```mermaid
graph TD
    subgraph 1. Master Data Ingestion
    A(Factories Dept) --> E[Standardisation Layer]
    B(Shops Dept) --> E
    C(BESCOM Meters) --> E
    D(KSPCB Dept) --> E
    end
    
    E --> F{Multi-Signal Matching Engine}
    F -->|High Confidence| G[Auto-Link]
    F -->|Medium Confidence| H[Human Review UI]
    H --> G
    F -->|Low Confidence| I[Keep Separate]
    
    G --> J[(Master UBID Registry)]
    
    subgraph 2. Transaction Stream
    K(Event Logs / Bills / Inspections) --> L[Bridge / Mapping Engine]
    end
    
    J --> L
    L --> M{Activity Inference Engine}
    M --> N[Active / Dormant / Closed]
    M --> O[Orphaned Events Queue]





