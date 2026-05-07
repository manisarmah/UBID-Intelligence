"use client";

import React, { useState, useEffect } from "react";
import { getAuditLogs, undoMasterMapping, undoEventMapping } from "../actions";
import { Loader2, RotateCcw, ShieldCheck, FileText, Activity } from "lucide-react";

export default function AuditPage() {
  const [logs, setLogs] = useState<{masterData: any[], events: any[]}>({ masterData: [], events: [] });
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const [masterSearch, setMasterSearch] = useState("");
  const [eventSearch, setEventSearch] = useState("");
  const [masterPage, setMasterPage] = useState(1);
  const [eventPage, setEventPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  const fetchLogs = async () => {
    setLoading(true);
    const res = await getAuditLogs();
    if (res.success) {
      setLogs({ masterData: res.masterData, events: res.events });
    }
    setLoading(false);
    return res.success ? res : null;
  };

  useEffect(() => {
    fetchLogs().then((logsData) => {
      // Check URL for id to highlight
      const params = new URLSearchParams(window.location.search);
      const id = params.get("id");
      if (id && logsData) {
        setHighlightId(id);
        
        // Find which page it's on
        const masterIndex = logsData.masterData.findIndex((r: any) => r.id === id);
        if (masterIndex !== -1) {
          setMasterPage(Math.ceil((masterIndex + 1) / ITEMS_PER_PAGE));
        } else {
          const eventIndex = logsData.events.findIndex((e: any) => e.id === id);
          if (eventIndex !== -1) {
            setEventPage(Math.ceil((eventIndex + 1) / ITEMS_PER_PAGE));
          }
        }

        setTimeout(() => {
          const el = document.getElementById(`audit-row-${id}`);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100); // Give DOM a moment to render
      }
    });
  }, []);

  const handleUndoMaster = async (id: string) => {
    setProcessingId(id);
    const res = await undoMasterMapping(id);
    if (res.success) {
      fetchLogs(); // Reload logs
    } else {
      alert("Failed to undo: " + res.error);
    }
    setProcessingId(null);
  };

  const handleUndoEvent = async (id: string) => {
    setProcessingId(id);
    const res = await undoEventMapping(id);
    if (res.success) {
      fetchLogs();
    } else {
      alert("Failed to undo: " + res.error);
    }
    setProcessingId(null);
  };

  if (loading && !logs.masterData.length && !logs.events.length) {
    return (
      <div className="container" style={{ display: "flex", justifyContent: "center", paddingTop: "5rem" }}>
        <Loader2 size={32} className="spin" style={{ color: "var(--primary-color)" }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1600px", margin: "0 auto", padding: "1.5rem 2rem", height: "calc(100vh - 65px)", display: "flex", flexDirection: "column" }}>
      <div style={{ marginBottom: "1.5rem", flexShrink: 0 }}>
        <h1 className="title" style={{ fontSize: "1.75rem", marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <ShieldCheck color="var(--primary-color)" /> Audit Trail & System Reversions
        </h1>
        <p className="subtitle" style={{ marginBottom: 0 }}>
          Track every operation executed by the AI or human reviewers. Revert actions with a single click.
        </p>
      </div>

      <div style={{ display: "flex", gap: "2rem", flex: 1, minHeight: 0 }}>
        {/* Master Data Logs */}
        <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "1.5rem", borderBottom: "1px solid var(--border-color)", backgroundColor: "rgba(0,0,0,0.2)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <FileText size={20} color="var(--text-secondary)" />
              <h2 style={{ fontSize: "1.125rem", margin: 0, fontWeight: "600" }}>Master Data Actions</h2>
            </div>
            <input type="text" placeholder="Search by name or dept..." value={masterSearch} onChange={e => { setMasterSearch(e.target.value); setMasterPage(1); }} style={{ padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--text-primary)", fontSize: "0.75rem", width: "200px" }} />
          </div>
          <div style={{ overflowY: "auto", flex: 1, padding: "1rem" }}>
            {logs.masterData.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text-secondary)", padding: "2rem" }}>No processed master data records found.</div>
            ) : (() => {
              const filtered = logs.masterData.filter(r => (r.businessName || "").toLowerCase().includes(masterSearch.toLowerCase()) || (r.departmentName || "").toLowerCase().includes(masterSearch.toLowerCase()));
              const paginated = filtered.slice((masterPage - 1) * ITEMS_PER_PAGE, masterPage * ITEMS_PER_PAGE);
              return (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {paginated.map(record => {
                  const isHighlighted = highlightId === record.id;
                  return (
                  <div id={`audit-row-${record.id}`} key={record.id} style={{ 
                    padding: "1rem", 
                    borderRadius: "8px", 
                    border: isHighlighted ? "2px solid var(--primary-color)" : "1px solid var(--border-color)", 
                    backgroundColor: isHighlighted ? "rgba(139, 92, 246, 0.15)" : "var(--bg-color)", 
                    boxShadow: isHighlighted ? "0 0 15px rgba(139, 92, 246, 0.4)" : "none",
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center", 
                    transition: "all 0.5s ease",
                    transform: isHighlighted ? "scale(1.02)" : "scale(1)"
                  }}>
                    <div>
                      <div style={{ fontWeight: "600", fontSize: "0.875rem", marginBottom: "0.25rem" }}>{record.businessName} <span style={{ color: "var(--text-secondary)", fontWeight: "normal" }}>({record.departmentName})</span></div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "flex", gap: "0.75rem" }}>
                        <span style={{ color: record.status === "AUTO_LINKED" ? "var(--success-color)" : record.status === "NEW_ENTITY" ? "var(--primary-color)" : "var(--warning-color)" }}>{record.status}</span>
                        <span>{record.matchReason || "No reasoning provided."}</span>
                      </div>
                    </div>
                    <button 
                      className="btn" 
                      onClick={() => handleUndoMaster(record.id)} 
                      disabled={processingId === record.id}
                      style={{ padding: "0.5rem 1rem", backgroundColor: "transparent", border: "1px solid var(--border-color)", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.75rem" }}
                    >
                      {processingId === record.id ? <Loader2 size={14} className="spin" /> : <RotateCcw size={14} />}
                      Revert
                    </button>
                  </div>
                  );
                })}
                {(() => {
                  const filtered = logs.masterData.filter(r => (r.businessName || "").toLowerCase().includes(masterSearch.toLowerCase()) || (r.departmentName || "").toLowerCase().includes(masterSearch.toLowerCase()));
                  return filtered.length > ITEMS_PER_PAGE ? (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 0" }}>
                      <button className="btn" disabled={masterPage === 1} onClick={() => setMasterPage(p => p - 1)} style={{ padding: "0.5rem 1rem", background: "transparent", border: "1px solid var(--border-color)" }}>Previous</button>
                      <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Page {masterPage} of {Math.ceil(filtered.length / ITEMS_PER_PAGE)}</span>
                      <button className="btn" disabled={masterPage >= Math.ceil(filtered.length / ITEMS_PER_PAGE)} onClick={() => setMasterPage(p => p + 1)} style={{ padding: "0.5rem 1rem", background: "transparent", border: "1px solid var(--border-color)" }}>Next</button>
                    </div>
                  ) : null;
                })()}
              </div>
            );
          })()}
          </div>
        </div>

        {/* Activity Event Logs */}
        <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "1.5rem", borderBottom: "1px solid var(--border-color)", backgroundColor: "rgba(0,0,0,0.2)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Activity size={20} color="var(--text-secondary)" />
              <h2 style={{ fontSize: "1.125rem", margin: 0, fontWeight: "600" }}>Event Stream Actions</h2>
            </div>
            <input type="text" placeholder="Search by type or dept..." value={eventSearch} onChange={e => { setEventSearch(e.target.value); setEventPage(1); }} style={{ padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--text-primary)", fontSize: "0.75rem", width: "200px" }} />
          </div>
          <div style={{ overflowY: "auto", flex: 1, padding: "1rem" }}>
            {logs.events.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text-secondary)", padding: "2rem" }}>No processed events found.</div>
            ) : (() => {
              const filtered = logs.events.filter(e => (e.eventType || "").toLowerCase().includes(eventSearch.toLowerCase()) || (e.departmentName || "").toLowerCase().includes(eventSearch.toLowerCase()));
              const paginated = filtered.slice((eventPage - 1) * ITEMS_PER_PAGE, eventPage * ITEMS_PER_PAGE);
              return (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {paginated.map(event => {
                  const isHighlighted = highlightId === event.id;
                  return (
                  <div id={`audit-row-${event.id}`} key={event.id} style={{ 
                    padding: "1rem", 
                    borderRadius: "8px", 
                    border: isHighlighted ? "2px solid var(--accent-color)" : "1px solid var(--border-color)", 
                    backgroundColor: isHighlighted ? "rgba(59, 130, 246, 0.15)" : "var(--bg-color)", 
                    boxShadow: isHighlighted ? "0 0 15px rgba(59, 130, 246, 0.4)" : "none",
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center", 
                    transition: "all 0.5s ease",
                    transform: isHighlighted ? "scale(1.02)" : "scale(1)"
                  }}>
                    <div>
                      <div style={{ fontWeight: "600", fontSize: "0.875rem", marginBottom: "0.25rem" }}>{event.eventType} <span style={{ color: "var(--text-secondary)", fontWeight: "normal" }}>({event.departmentName})</span></div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "flex", gap: "0.75rem" }}>
                        <span style={{ color: event.status === "LINKED" ? "var(--success-color)" : event.status === "REJECTED" ? "var(--danger-color)" : "var(--warning-color)" }}>{event.status}</span>
                        <span>{new Date(event.eventDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button 
                      className="btn" 
                      onClick={() => handleUndoEvent(event.id)} 
                      disabled={processingId === event.id}
                      style={{ padding: "0.5rem 1rem", backgroundColor: "transparent", border: "1px solid var(--border-color)", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.75rem" }}
                    >
                      {processingId === event.id ? <Loader2 size={14} className="spin" /> : <RotateCcw size={14} />}
                      Revert
                    </button>
                  </div>
                  );
                })}
                {filtered.length > ITEMS_PER_PAGE && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 0" }}>
                    <button className="btn" disabled={eventPage === 1} onClick={() => setEventPage(p => p - 1)} style={{ padding: "0.5rem 1rem", background: "transparent", border: "1px solid var(--border-color)" }}>Previous</button>
                    <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Page {eventPage} of {Math.ceil(filtered.length / ITEMS_PER_PAGE)}</span>
                    <button className="btn" disabled={eventPage >= Math.ceil(filtered.length / ITEMS_PER_PAGE)} onClick={() => setEventPage(p => p + 1)} style={{ padding: "0.5rem 1rem", background: "transparent", border: "1px solid var(--border-color)" }}>Next</button>
                  </div>
                )}
              </div>
            );
          })()}
          </div>
        </div>
      </div>
    </div>
  );
}
