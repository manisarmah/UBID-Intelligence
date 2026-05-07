

# 🏛️ UBID: Business Identity Resolution & Activity Intelligence Layer

![Python](https://img.shields.io/badge/python-3.8+-blue.svg)
![Streamlit](https://img.shields.io/badge/Streamlit-FF4B4B?style=flat&logo=Streamlit&logoColor=white)
![NetworkX](https://img.shields.io/badge/NetworkX-Graph_Clustering-lightgrey)
![RapidFuzz](https://img.shields.io/badge/RapidFuzz-Fuzzy_Matching-success)

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





This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
