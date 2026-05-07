"use client";

import React, { useState } from "react";
import { parseEventCsvHeaders, uploadEventsAction, runEventMappingEngine, runActivityInferenceEngine } from "../actions";
import { Loader2, Upload, Database, Activity } from "lucide-react";

export default function UploadEventsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [department, setDepartment] = useState("BESCOM");
  const [headers, setHeaders] = useState<string[]>([]);
  const [sampleRows, setSampleRows] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const targetFields = ["departmentId", "businessName", "address", "pincode", "city", "pan", "gstin", "eventType", "eventDate", "description", "IGNORE"];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setLoading(true);
      const formData = new FormData();
      formData.append("file", e.target.files[0]);
      const res = await parseEventCsvHeaders(formData);
      if (res.success) {
        setHeaders(res.headers || []);
        setSampleRows(res.sampleRows || []);
        
        // Auto-mapping fallback
        const initialMapping: any = {};
        res.headers?.forEach((h: string) => {
          const hl = h.toLowerCase();
          if (hl.includes("id") || hl.includes("license") || hl.includes("reg")) initialMapping[h] = "departmentId";
          else if (hl.includes("name") || hl.includes("business")) initialMapping[h] = "businessName";
          else if (hl.includes("address") || hl.includes("location") || hl.includes("premises")) initialMapping[h] = "address";
          else if (hl.includes("pin") || hl.includes("zip")) initialMapping[h] = "pincode";
          else if (hl.includes("city") || hl.includes("town")) initialMapping[h] = "city";
          else if (hl.includes("pan")) initialMapping[h] = "pan";
          else if (hl.includes("gst")) initialMapping[h] = "gstin";
          else if (hl.includes("date") || hl.includes("time")) initialMapping[h] = "eventDate";
          else if (hl.includes("type") || hl.includes("event") || hl.includes("activity")) initialMapping[h] = "eventType";
          else if (hl.includes("desc") || hl.includes("remark") || hl.includes("reason")) initialMapping[h] = "description";
          else initialMapping[h] = "IGNORE";
        });
        setMapping(initialMapping);
        setStep(2);
      }
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setStatus("Ingesting events into database...");
    const formData = new FormData();
    formData.append("file", file);
    
    const uploadRes = await uploadEventsAction(formData, JSON.stringify(mapping), department);
    if (!uploadRes.success) {
      alert("Error: " + uploadRes.error);
      setLoading(false);
      return;
    }

    setStatus(`Ingested ${uploadRes.count} events. Running Mapping Engine...`);
    const mappingRes = await runEventMappingEngine();
    
    // Only run inference for UBIDs that got directly linked events (not fuzzy review ones)
    const linkedUbids: string[] = (mappingRes as any).linkedUbids || [];
    if (linkedUbids.length > 0) {
      setStatus(`Mapped events. Running Activity Inference for ${linkedUbids.length} linked businesses...`);
      const inferenceRes = await runActivityInferenceEngine();
      setStatus(`Complete! ${mappingRes.message}. ${inferenceRes.message}`);
    } else {
      setStatus(`Complete! ${mappingRes.message}`);
    }

    setStep(3);
    setLoading(false);
  };

  return (
    <div className="container" style={{ maxWidth: "800px", paddingTop: "2rem" }}>
      <h1 className="title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}><Activity color="var(--primary-color)" /> Event Ingestion Portal</h1>
      <p className="subtitle">Upload a CSV of transactional events (inspections, consumption, renewals) to update Activity Intelligence.</p>
      
      {step === 1 && (
        <div className="card">
          <div style={{ border: "2px dashed var(--border-color)", padding: "3rem", borderRadius: "12px", textAlign: "center", position: "relative" }}>
            <input type="file" accept=".csv" onChange={handleFileChange} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }} />
            <Upload size={32} style={{ color: "var(--text-secondary)", margin: "0 auto 1rem" }} />
            <h3 style={{ fontSize: "1.125rem", fontWeight: "600", marginBottom: "0.5rem" }}>Click or Drag Event CSV here</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>Supports transaction data dumps</p>
          </div>
          {loading && <div style={{ display: "flex", justifyContent: "center", marginTop: "1rem" }}><Loader2 className="spin" /></div>}
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <h2 style={{ fontSize: "1.25rem", marginBottom: "1.5rem" }}>Map CSV Headers to Event Schema</h2>

          <div style={{ marginBottom: "1.5rem", padding: "1rem", background: "rgba(255,255,255,0.03)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", fontSize: "0.875rem" }}>Department Source</label>
            <input type="text" value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. BESCOM, KSPCB, Shops" style={{ width: "100%", padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "white" }} />
            <p style={{ marginTop: "0.4rem", fontSize: "0.75rem", color: "var(--text-secondary)" }}>This will be stored as the department name for all events in this file.</p>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {headers.map(h => (
              <div key={h} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", alignItems: "center", padding: "1rem", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                <div>
                  <div style={{ fontWeight: "600", marginBottom: "0.25rem" }}>{h}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontStyle: "italic" }}>
                    e.g. {sampleRows.map(r => r[h]).join(", ")}
                  </div>
                </div>
                <select value={mapping[h] || "IGNORE"} onChange={e => setMapping({...mapping, [h]: e.target.value})} style={{ padding: "0.5rem", borderRadius: "4px", background: "var(--bg-color)", border: "1px solid var(--border-color)", color: "white", width: "100%" }}>
                  {targetFields.map(tf => <option key={tf} value={tf}>{tf}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div style={{ marginTop: "2rem", display: "flex", gap: "1rem" }}>
            <button className="btn" onClick={() => setStep(1)} style={{ background: "transparent", border: "1px solid var(--border-color)" }}>Back</button>
            <button className="btn btn-primary" onClick={handleUpload} disabled={loading} style={{ flex: 1, display: "flex", justifyContent: "center", gap: "0.5rem" }}>
              {loading ? <Loader2 className="spin" size={18} /> : <Database size={18} />}
              {loading ? "Woofing..." : "Process Event Stream"}
            </button>
          </div>
          {status && <div style={{ marginTop: "1rem", color: "var(--primary-color)", fontSize: "0.875rem", textAlign: "center" }}>{status}</div>}
        </div>
      )}

      {step === 3 && (
        <div className="card" style={{ textAlign: "center", padding: "4rem 2rem" }}>
          <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(16, 185, 129, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem" }}>
            <Activity color="var(--success-color)" size={32} />
          </div>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Events Successfully Processed!</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: "2rem", lineHeight: 1.6 }}>{status}</p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
             <button className="btn btn-primary" onClick={() => window.location.href='/dashboard'}>View Dashboard</button>
             <button className="btn" onClick={() => {setStep(1); setFile(null); setStatus("");}} style={{ background: "transparent", border: "1px solid var(--border-color)" }}>Upload More Events</button>
          </div>
        </div>
      )}
    </div>
  );
}
