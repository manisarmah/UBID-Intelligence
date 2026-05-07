"use client";

import { useState, useEffect } from "react";
import { getPendingRecords, runMatchingEngine } from "../actions";
import { Loader2, GitMerge, ArrowRight, AlertCircle, CheckCircle, Search } from "lucide-react";

export default function MatchingPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null);
  
  const [filters, setFilters] = useState({ dept: "", name: "", address: "", id: "", status: "All" });
  const [debouncedFilters, setDebouncedFilters] = useState(filters);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters(filters);
      setPage(1); // Reset page on new filter
    }, 500);
    return () => clearTimeout(timer);
  }, [filters]);

  const fetchRecords = async (p: number, currentFilters: any) => {
    setLoading(true);
    const res = await getPendingRecords(p, 10, currentFilters);
    if (res.success && res.records) {
      setRecords(res.records);
      setTotal(res.total || 0);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRecords(page, debouncedFilters);
  }, [page, debouncedFilters]);

  const handleRunEngine = async () => {
    setMatching(true);
    setMessage(null);
    const res = await runMatchingEngine();
    setMatching(false);
    
    if (res.success) {
      setMessage({ type: "success", text: res.message! });
      fetchRecords(1, debouncedFilters); // Refresh data
    } else {
      setMessage({ type: "error", text: res.error! });
    }
  };

  return (
    <div className="container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 className="title">Standardization & Matching</h1>
          <p className="subtitle" style={{ marginBottom: 0 }}>
            {total} pending records awaiting unification
          </p>
        </div>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <button 
            className="btn" 
            onClick={handleRunEngine}
            disabled={matching || total === 0}
            style={{ backgroundColor: "var(--warning-color)", color: "#000" }}
          >
            {matching ? (
              <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Loader2 size={18} className="spin" /> Processing...
              </span>
            ) : (
              <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <GitMerge size={18} /> Run Matching Engine
              </span>
            )}
          </button>
          <button 
            className="btn" 
            onClick={() => window.location.href = "/dashboard"}
            style={{ backgroundColor: "transparent", border: "1px solid var(--border-color)" }}
          >
            Go to Dashboard <ArrowRight size={18} style={{ display: "inline", verticalAlign: "middle" }} />
          </button>
        </div>
      </div>

      {message && (
        <div style={{ 
          marginBottom: "1.5rem", 
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

      <div className="card" style={{ padding: 0, overflow: "hidden", overflowX: "auto", position: "relative" }}>
        {loading && (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 10 }}>
            <Loader2 size={32} className="spin" style={{ color: "var(--primary-color)" }} />
          </div>
        )}
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", opacity: loading ? 0.5 : 1, transition: "opacity 0.2s" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "rgba(0,0,0,0.2)" }}>
                <th style={{ padding: "1rem", fontWeight: "600" }}>
                  <div>Department</div>
                  <input type="text" placeholder="Filter..." value={filters.dept} onChange={e => setFilters({...filters, dept: e.target.value})} style={{marginTop:"0.5rem", width:"100%", padding:"0.25rem", fontSize:"0.75rem", borderRadius:"4px", border:"1px solid var(--border-color)", background:"var(--bg-color)", color:"var(--text-primary)"}} />
                </th>
                <th style={{ padding: "1rem", fontWeight: "600" }}>
                  <div>Business Name</div>
                  <input type="text" placeholder="Filter..." value={filters.name} onChange={e => setFilters({...filters, name: e.target.value})} style={{marginTop:"0.5rem", width:"100%", padding:"0.25rem", fontSize:"0.75rem", borderRadius:"4px", border:"1px solid var(--border-color)", background:"var(--bg-color)", color:"var(--text-primary)"}} />
                </th>
                <th style={{ padding: "1rem", fontWeight: "600" }}>
                  <div>Address</div>
                  <input type="text" placeholder="Filter..." value={filters.address} onChange={e => setFilters({...filters, address: e.target.value})} style={{marginTop:"0.5rem", width:"100%", padding:"0.25rem", fontSize:"0.75rem", borderRadius:"4px", border:"1px solid var(--border-color)", background:"var(--bg-color)", color:"var(--text-primary)"}} />
                </th>
                <th style={{ padding: "1rem", fontWeight: "600" }}>
                  <div>PAN/GSTIN</div>
                  <input type="text" placeholder="Filter..." value={filters.id} onChange={e => setFilters({...filters, id: e.target.value})} style={{marginTop:"0.5rem", width:"100%", padding:"0.25rem", fontSize:"0.75rem", borderRadius:"4px", border:"1px solid var(--border-color)", background:"var(--bg-color)", color:"var(--text-primary)"}} />
                </th>
                <th style={{ padding: "1rem", fontWeight: "600" }}>
                  <div>Status</div>
                  <select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})} style={{marginTop:"0.5rem", width:"100%", padding:"0.25rem", fontSize:"0.75rem", borderRadius:"4px", border:"1px solid var(--border-color)", background:"var(--bg-color)", color:"var(--text-primary)"}}>
                    <option value="All">All</option>
                    <option value="PENDING">PENDING</option>
                    <option value="AUTO_LINKED">AUTO_LINKED</option>
                    <option value="REVIEW">REVIEW</option>
                    <option value="NEW_ENTITY">NEW_ENTITY</option>
                  </select>
                </th>
                <th style={{ padding: "1rem", fontWeight: "600" }}>Match Details</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>
                    No records match your filters.
                  </td>
                </tr>
              ) : (
                records.map(record => (
                  <tr key={record.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <td style={{ padding: "1rem" }}>
                      {record.departmentName}
                      {record.departmentId && record.departmentId !== "NaN" && (
                        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>ID: {record.departmentId}</div>
                      )}
                    </td>
                    <td style={{ padding: "1rem", fontWeight: "500" }}>{record.businessName}</td>
                    <td style={{ padding: "1rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                      {record.address} <br/> {record.city} {record.pincode}
                    </td>
                    <td style={{ padding: "1rem", fontSize: "0.875rem" }}>
                      {record.pan ? <div>PAN: {record.pan}</div> : null}
                      {record.gstin ? <div>GST: {record.gstin}</div> : null}
                      {!record.pan && !record.gstin ? <span style={{ color: "var(--text-secondary)" }}>N/A</span> : null}
                    </td>
                    <td style={{ padding: "1rem" }}>
                      <span style={{ 
                        padding: "0.25rem 0.5rem", 
                        borderRadius: "4px", 
                        fontSize: "0.75rem",
                        backgroundColor: record.status === "PENDING" ? "rgba(59, 130, 246, 0.1)" : record.status === "AUTO_LINKED" ? "rgba(16, 185, 129, 0.1)" : record.status === "NEW_ENTITY" ? "rgba(139, 92, 246, 0.1)" : "rgba(245, 158, 11, 0.1)",
                        color: record.status === "PENDING" ? "var(--primary-color)" : record.status === "AUTO_LINKED" ? "var(--success-color)" : record.status === "NEW_ENTITY" ? "var(--accent-color)" : "var(--warning-color)",
                        fontWeight: "600"
                      }}>
                        {record.status}
                      </span>
                    </td>
                    <td style={{ padding: "1rem", fontSize: "0.875rem" }}>
                      {record.matchScore !== null && (
                        <div style={{ marginBottom: "0.25rem" }}>
                          <strong style={{ color: "var(--text-primary)" }}>Score: {(record.matchScore * 100).toFixed(0)}%</strong>
                        </div>
                      )}
                      {record.matchReason && (
                        <div style={{ color: "var(--text-secondary)", fontSize: "0.75rem", lineHeight: "1.2" }}>
                          {record.matchReason}
                        </div>
                      )}
                      {!record.matchScore && !record.matchReason && <span style={{ color: "var(--text-secondary)" }}>-</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
      </div>

      {total > 10 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1.5rem" }}>
          <button 
            className="btn" 
            style={{ padding: "0.5rem 1rem", backgroundColor: "transparent", border: "1px solid var(--border-color)" }}
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
          >
            Previous
          </button>
          <span style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            Page {page} of {Math.ceil(total / 10)}
          </span>
          <button 
            className="btn" 
            style={{ padding: "0.5rem 1rem", backgroundColor: "transparent", border: "1px solid var(--border-color)" }}
            disabled={page >= Math.ceil(total / 10)}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </button>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin { animation: spin 1s linear infinite; }
      `}} />
    </div>
  );
}
