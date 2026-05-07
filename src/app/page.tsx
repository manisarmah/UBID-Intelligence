"use client";

import { useState, useRef } from "react";
import { uploadCsvAction, parseCsvHeaders, suggestColumnMapping, runMatchingEngine } from "./actions";
import { UploadCloud, FileType, CheckCircle, AlertCircle, Loader2, ArrowRight, GitMerge, Database } from "lucide-react";

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

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null);
  
  const [globalDept, setGlobalDept] = useState("");
  const [step, setStep] = useState<"UPLOAD" | "MAPPING">("UPLOAD");
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setMessage(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setMessage(null);
    }
  };

  const handleAnalyzeFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setMessage(null);
    setLoadingMessage("Reading file headers...");

    const formData = new FormData();
    formData.append("file", file);

    const parseResult = await parseCsvHeaders(formData);
    
    if (!parseResult.success || !parseResult.headers) {
      setMessage({ type: "error", text: parseResult.error || "Failed to read CSV headers" });
      setLoading(false);
      return;
    }

    setHeaders(parseResult.headers);
    setLoadingMessage("AI is mapping columns...");
    
    const mappingResult = await suggestColumnMapping(parseResult.headers, parseResult.sampleRows || []);
    
    if (mappingResult.success && mappingResult.mapping) {
      setMapping(mappingResult.mapping);
      setStep("MAPPING");
    } else {
      setMessage({ type: "error", text: "Failed to suggest mapping. Please try again." });
    }
    
    setLoading(false);
  };

  const handleConfirmIngestion = async () => {
    if (!file) return;

    setLoading(true);
    setMessage(null);
    setLoadingMessage("Ingesting records...");

    const formData = new FormData();
    formData.append("file", file);

    const result = await uploadCsvAction(formData, JSON.stringify(mapping), globalDept);

    setLoading(false);
    if (result.success) {
      setMessage({ type: "success", text: result.message! });
      setStep("UPLOAD");
      setFile(null);
      setGlobalDept("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } else {
      setMessage({ type: "error", text: result.error! });
    }
  };

  const handleMappingChange = (csvHeader: string, targetKey: string) => {
    setMapping(prev => ({ ...prev, [csvHeader]: targetKey }));
  };

  return (
    <div style={{ maxWidth: "1600px", margin: "0 auto", padding: "1.5rem 2rem", height: "calc(100vh - 65px)", display: "flex", flexDirection: "column" }}>
      <div className="card" style={{ maxWidth: "800px", margin: "4rem auto" }}>
        <h1 className="title">{step === "UPLOAD" ? "Data Ingestion" : "Semantic Column Mapping"}</h1>
        <p className="subtitle">
          {step === "UPLOAD" 
            ? "Upload department data (CSV) to begin the unification and UBID generation process."
            : "Review the AI-suggested column mappings below. Adjust if necessary, then confirm to ingest."}
        </p>

        {step === "UPLOAD" && (
          <form onSubmit={handleAnalyzeFile}>
            <div 
              className={`upload-area ${isDragging ? "dragover" : ""}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud size={48} color={isDragging ? "var(--primary-color)" : "var(--text-secondary)"} style={{ margin: "0 auto 1rem" }} />
              <p style={{ fontSize: "1.125rem", marginBottom: "0.5rem" }}>
                {isDragging ? "Drop the CSV file here" : "Click or drag CSV file here"}
              </p>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                Supports any .csv file format
              </p>
              <input 
                type="file" 
                accept=".csv" 
                ref={fileInputRef} 
                style={{ display: "none" }} 
                onChange={handleFileChange}
              />
            </div>

            {file && (
              <div className="file-list">
                <div className="file-item">
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <FileType size={18} color="var(--primary-color)" />
                    <span>{file.name}</span>
                  </div>
                  <span style={{ color: "var(--text-secondary)" }}>
                    {(file.size / 1024).toFixed(1)} KB
                  </span>
                </div>
              </div>
            )}

            {message && (
              <div style={{ 
                marginTop: "1.5rem", 
                padding: "1rem", 
                borderRadius: "8px", 
                backgroundColor: message.type === "success" ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                border: `1px solid ${message.type === "success" ? "var(--success-color)" : "var(--danger-color)"}`,
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                color: message.type === "success" ? "var(--success-color)" : "var(--danger-color)"
              }}>
                {message.type === "success" ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                {message.text}
              </div>
            )}

            <div style={{ marginTop: "2rem", display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" className="btn" disabled={!file || loading}>
                {loading ? (
                  <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Loader2 size={18} className="spin" /> {loadingMessage}
                  </span>
                ) : (
                  <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    Next: Map Columns <ArrowRight size={18} />
                  </span>
                )}
              </button>
            </div>
          </form>
        )}

        <div style={{ marginTop: "3rem", borderTop: "1px solid var(--border-color)", paddingTop: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>Ready to Process?</h2>
            <p style={{ color: "var(--text-secondary)" }}>
              After ingesting your records, head over to the matching engine.
            </p>
          </div>
          <button 
            type="button" 
            className="btn" 
            onClick={() => window.location.href = "/matching"}
            style={{ backgroundColor: "var(--warning-color)", color: "#000" }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              Go to Matching Engine <ArrowRight size={18} />
            </span>
          </button>
        </div>

        {step === "MAPPING" && (
          <div>
            <div style={{ marginBottom: "2rem", padding: "1rem", backgroundColor: "var(--surface-hover)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>Source Department (Optional)</label>
              <input 
                type="text" 
                placeholder="e.g., BESCOM, Labour, KSPCB" 
                value={globalDept}
                onChange={e => setGlobalDept(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  borderRadius: "6px",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "var(--bg-color)",
                  color: "var(--text-primary)"
                }}
              />
              <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginTop: "0.5rem" }}>
                If the CSV doesn't have a department column, this name will be applied to all records.
              </p>
            </div>

            <div style={{ backgroundColor: "var(--surface-hover)", borderRadius: "8px", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "rgba(0,0,0,0.2)" }}>
                    <th style={{ padding: "1rem", fontWeight: "600" }}>Source CSV Header</th>
                    <th style={{ padding: "1rem", fontWeight: "600" }}>Maps To (Target Schema)</th>
                  </tr>
                </thead>
                <tbody>
                  {headers.map(header => (
                    <tr key={header} style={{ borderBottom: "1px solid var(--border-color)" }}>
                      <td style={{ padding: "1rem" }}>{header}</td>
                      <td style={{ padding: "1rem" }}>
                        <select 
                          value={mapping[header] || "IGNORE"} 
                          onChange={(e) => handleMappingChange(header, e.target.value)}
                          style={{ 
                            padding: "0.5rem", 
                            borderRadius: "6px", 
                            backgroundColor: "var(--bg-color)",
                            color: "var(--text-primary)",
                            border: "1px solid var(--border-color)",
                            width: "100%"
                          }}
                        >
                          <option value="IGNORE">-- Ignore / Do not map --</option>
                          {TARGET_SCHEMA.map(schemaKey => (
                            <option key={schemaKey} value={schemaKey}>{schemaKey}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {message && (
              <div style={{ 
                marginTop: "1.5rem", 
                padding: "1rem", 
                borderRadius: "8px", 
                backgroundColor: message.type === "success" ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                border: `1px solid ${message.type === "success" ? "var(--success-color)" : "var(--danger-color)"}`,
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                color: message.type === "success" ? "var(--success-color)" : "var(--danger-color)"
              }}>
                <AlertCircle size={20} />
                {message.text}
              </div>
            )}

            <div style={{ marginTop: "2rem", display: "flex", justifyContent: "space-between" }}>
              <button 
                type="button" 
                onClick={() => setStep("UPLOAD")} 
                className="btn" 
                style={{ backgroundColor: "transparent", border: "1px solid var(--border-color)" }}
                disabled={loading}
              >
                Back
              </button>
              <button className="btn btn-primary" onClick={handleConfirmIngestion} disabled={loading} style={{ marginLeft: "1rem", flex: 1, display: "flex", justifyContent: "center", gap: "0.5rem" }}>
                {loading ? <Loader2 className="spin" size={18} /> : <Database size={18} />}
                {loading ? "Cooking..." : "Process Master Data"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
