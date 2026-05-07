"use client";

import React, { useState } from "react";
import { executeNLQuery } from "../actions";
import { Search, Loader2, Sparkles, Database, AlertCircle, LayoutGrid } from "lucide-react";

export default function QueryPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setLoading(true);
    setResult(null);
    const res = await executeNLQuery(query);
    setResult(res);
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem", display: "flex", flexDirection: "column", gap: "2rem", minHeight: "calc(100vh - 65px)" }}>
      <div>
        <h1 className="title" style={{ fontSize: "2rem", display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
          Ask Me Anything 💡
        </h1>
        <p className="subtitle" style={{ fontSize: "1rem" }}>
          Ask questions about your unified database in plain English. The AI will find exactly what you need and show the results instantly.
        </p>
      </div>

      <div className="card" style={{ padding: "1.5rem" }}>
        <form onSubmit={handleQuery} style={{ display: "flex", gap: "1rem" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Search size={20} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
            <input 
              type="text" 
              placeholder="e.g. Show me all businesses in Bangalore with more than 2 events"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ width: "100%", padding: "1rem 1rem 1rem 3rem", fontSize: "1rem", borderRadius: "8px", border: "1px solid var(--border-color)", background: "rgba(255,255,255,0.02)", color: "var(--text-primary)" }}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading || !query.trim()} style={{ padding: "0 2rem" }}>
            {loading ? <Loader2 className="spin" size={20} /> : "Query Database"}
          </button>
        </form>
      </div>

      {result && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {!result.success ? (
            <div className="card" style={{ padding: "1.5rem", borderColor: "var(--danger-color)", backgroundColor: "rgba(239, 68, 68, 0.05)", display: "flex", alignItems: "flex-start", gap: "1rem" }}>
              <AlertCircle color="var(--danger-color)" style={{ flexShrink: 0 }} />
              <div>
                <h3 style={{ margin: "0 0 0.5rem 0", color: "var(--danger-color)" }}>Query Failed</h3>
                <p style={{ margin: 0, color: "var(--text-secondary)" }}>{result.error}</p>
              </div>
            </div>
          ) : !result.isValid ? (
            <div className="card" style={{ padding: "1.5rem", borderColor: "var(--warning-color)", backgroundColor: "rgba(245, 158, 11, 0.05)", display: "flex", alignItems: "flex-start", gap: "1rem" }}>
              <AlertCircle color="var(--warning-color)" style={{ flexShrink: 0 }} />
              <div>
                <h3 style={{ margin: "0 0 0.5rem 0", color: "var(--warning-color)" }}>Out of Scope</h3>
                <p style={{ margin: 0, color: "var(--text-secondary)" }}>The AI determined this query is not relevant to our database schema. Please try asking about businesses, departments, matches, or events.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="card" style={{ padding: "1.5rem", backgroundColor: "rgba(16, 185, 129, 0.05)", borderColor: "rgba(16, 185, 129, 0.2)", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--success-color)" }}>
                  <Database size={18} /> AI Interpretation
                </h3>
                <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>{result.explanation}</p>
                <div style={{ marginTop: "1rem", padding: "1rem", background: "rgba(0,0,0,0.2)", borderRadius: "6px", fontFamily: "monospace", fontSize: "0.8rem", color: "var(--text-secondary)", overflowX: "auto" }}>
                  {result.sql}
                </div>
              </div>

              <div className="card" style={{ padding: 0, flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--border-color)", backgroundColor: "rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <LayoutGrid size={18} color="var(--text-secondary)" />
                  <h3 style={{ margin: 0, fontSize: "1rem" }}>Results ({result.rows.length})</h3>
                </div>
                
                <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "400px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                    <thead style={{ position: "sticky", top: 0, backgroundColor: "var(--bg-color)", zIndex: 1 }}>
                      <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                        {result.columns.map((col: string) => (
                          <th key={col} style={{ padding: "1rem", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.length === 0 ? (
                        <tr>
                          <td colSpan={result.columns.length} style={{ padding: "2rem", textAlign: "center", color: "var(--text-secondary)" }}>
                            No results found for this query.
                          </td>
                        </tr>
                      ) : (
                        result.rows.map((row: any, i: number) => (
                          <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                            {result.columns.map((col: string) => (
                              <td key={col} style={{ padding: "1rem", fontSize: "0.875rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "300px" }}>
                                {row[col] !== null ? String(row[col]) : "-"}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {result.summary && (
                <div className="card" style={{ padding: "1.5rem", backgroundColor: "rgba(139, 92, 246, 0.05)", borderColor: "var(--primary-color)" }}>
                  <h3 style={{ margin: "0 0 0.5rem 0", color: "var(--primary-color)", fontSize: "1rem" }}>Summary</h3>
                  <p style={{ margin: 0, color: "var(--text-primary)", lineHeight: 1.6 }}>{result.summary}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
