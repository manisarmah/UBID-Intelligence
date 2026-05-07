"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getPendingDoubts, approveDoubt, rejectDoubt } from "../actions";
import { Loader2, CheckCircle, XCircle, AlertCircle, Building, ArrowRight, Search, ChevronRight } from "lucide-react";

function ReviewContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlId = searchParams.get("id");

  const [doubts, setDoubts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(urlId);
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [toast, setToast] = useState<{message: string, type: 'approve' | 'reject' | 'error'} | null>(null);

  const showToast = (message: string, type: 'approve' | 'reject' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchDoubts = async () => {
    setLoading(true);
    const res = await getPendingDoubts();
    if (res.success) {
      setDoubts(res.doubts);
      if (!selectedId && res.doubts.length > 0) {
        const firstId = res.doubts[0].id;
        setSelectedId(firstId);
        router.replace(`/review?id=${firstId}`);
      } else if (selectedId && !res.doubts.find((d: any) => d.id === selectedId) && res.doubts.length > 0) {
        const firstId = res.doubts[0].id;
        setSelectedId(firstId);
        router.replace(`/review?id=${firstId}`);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDoubts();
  }, []);

  const handleSelectDoubt = (id: string) => {
    setSelectedId(id);
    setReviewerNotes("");
    router.replace(`/review?id=${id}`);
  };

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    const res = await approveDoubt(id, reviewerNotes);
    if (res.success) {
      showToast("Successfully approved the merge.", "approve");
      setReviewerNotes("");
      const nextDoubts = doubts.filter(d => d.id !== id);
      setDoubts(nextDoubts);
      
      if (selectedId === id) {
        if (nextDoubts.length > 0) {
          const nextId = nextDoubts[0].id;
          setSelectedId(nextId);
          router.replace(`/review?id=${nextId}`);
        } else {
          setSelectedId(null);
          router.replace('/review');
        }
      }
    } else {
      showToast("Failed to approve doubt: " + res.error, "error");
    }
    setProcessingId(null);
  };

  const handleReject = async (id: string) => {
    setProcessingId(id);
    const res = await rejectDoubt(id, reviewerNotes);
    if (res.success) {
      showToast("Rejected match and created a new entity.", "reject");
      setReviewerNotes("");
      const nextDoubts = doubts.filter(d => d.id !== id);
      setDoubts(nextDoubts);
      
      if (selectedId === id) {
        if (nextDoubts.length > 0) {
          const nextId = nextDoubts[0].id;
          setSelectedId(nextId);
          router.replace(`/review?id=${nextId}`);
        } else {
          setSelectedId(null);
          router.replace('/review');
        }
      }
    } else {
      showToast("Failed to reject doubt: " + res.error, "error");
    }
    setProcessingId(null);
  };

  const filteredDoubts = doubts.filter(d => 
    d.rawRecord?.businessName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    d.unifiedRecord?.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.rawRecord?.pan?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedDoubt = doubts.find(d => d.id === selectedId) || null;

  if (loading) {
    return (
      <div className="container" style={{ display: "flex", justifyContent: "center", paddingTop: "5rem" }}>
        <Loader2 size={32} className="spin" style={{ color: "var(--primary-color)" }} />
      </div>
    );
  }

  if (doubts.length === 0) {
    return (
      <div className="container">
        <div className="card" style={{ textAlign: "center", padding: "4rem" }}>
          <CheckCircle size={48} color="var(--success-color)" style={{ margin: "0 auto 1rem" }} />
          <h2 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>All caught up!</h2>
          <p style={{ color: "var(--text-secondary)" }}>
            There are no pending matches requiring human review at this time.
          </p>
          <button className="btn" onClick={() => window.location.href = "/dashboard"} style={{ marginTop: "1.5rem" }}>
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1600px", margin: "0 auto", padding: "1.5rem 2rem", height: "calc(100vh - 65px)", display: "flex", flexDirection: "column" }}>
      <div style={{ marginBottom: "1rem", flexShrink: 0 }}>
        <h1 className="title" style={{ fontSize: "1.75rem", marginBottom: "0.25rem" }}>Review Portal</h1>
        <p className="subtitle" style={{ marginBottom: 0 }}>
          {doubts.length} records require human verification
        </p>
      </div>

      <div style={{ display: "flex", gap: "1.5rem", flex: 1, minHeight: 0 }}>
        {/* Left Pane - List */}
        <div className="card" style={{ width: "350px", display: "flex", flexDirection: "column", padding: "1rem", overflow: "hidden" }}>
          <div style={{ position: "relative", marginBottom: "1rem" }}>
            <Search size={16} color="var(--text-secondary)" style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)" }} />
            <input 
              type="text" 
              placeholder="Filter company or PAN..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "0.75rem 1rem 0.75rem 2.5rem",
                borderRadius: "8px",
                border: "1px solid var(--border-color)",
                backgroundColor: "var(--bg-color)",
                color: "var(--text-primary)",
                fontSize: "0.875rem"
              }}
            />
          </div>

          <div style={{ overflowY: "auto", flex: 1, paddingRight: "0.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {filteredDoubts.length === 0 ? (
              <div style={{ padding: "2rem 1rem", textAlign: "center", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                No records match your search.
              </div>
            ) : (
              filteredDoubts.map(doubt => {
                const isSelected = selectedId === doubt.id;
                return (
                  <button
                    key={doubt.id}
                    onClick={() => handleSelectDoubt(doubt.id)}
                    style={{
                      textAlign: "left",
                      padding: "1rem",
                      borderRadius: "8px",
                      border: `1px solid ${isSelected ? "var(--primary-color)" : "var(--border-color)"}`,
                      backgroundColor: isSelected ? "rgba(59, 130, 246, 0.1)" : "var(--surface-hover)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      transition: "all 0.2s ease"
                    }}
                  >
                    <div style={{ overflow: "hidden", paddingRight: "0.5rem" }}>
                      <div style={{ fontWeight: isSelected ? "600" : "500", fontSize: "0.875rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: "0.25rem", color: isSelected ? "var(--primary-color)" : "var(--text-primary)" }}>
                        {doubt.rawRecord?.businessName}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "flex", gap: "0.5rem" }}>
                        <span style={{ color: "var(--warning-color)" }}>{(doubt.confidence * 100).toFixed(0)}% Match</span>
                        <span>&middot;</span>
                        <span>{doubt.rawRecord?.departmentName}</span>
                      </div>
                    </div>
                    {isSelected && <ChevronRight size={16} color="var(--primary-color)" />}
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Right Pane - Detail View */}
        <div className="card" style={{ flex: 1, overflowY: "auto", position: "relative", padding: "2rem" }}>
          {!selectedDoubt ? (
            <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}>
              Select a record from the list to review.
            </div>
          ) : (
            <div style={{ opacity: processingId === selectedDoubt.id ? 0.5 : 1, transition: "opacity 0.2s" }}>
              {processingId === selectedDoubt.id && (
                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 10 }}>
                  <Loader2 size={32} className="spin" style={{ color: "var(--primary-color)" }} />
                </div>
              )}
              
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "1.5rem", marginBottom: "2rem" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.25rem" }}>
                    <AlertCircle size={24} color="var(--warning-color)" />
                    <h2 style={{ fontWeight: "600", fontSize: "1.25rem", margin: 0 }}>Action Required</h2>
                  </div>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", margin: 0 }}>
                    AI detected a {(selectedDoubt.confidence * 100).toFixed(1)}% match but requires human verification.
                  </p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 40px 1fr", gap: "1.5rem", alignItems: "start", marginBottom: "2rem" }}>
                {/* Incoming Record */}
                <div style={{ backgroundColor: "rgba(255,255,255,0.02)", padding: "1.5rem", borderRadius: "12px", border: "1px dashed var(--border-color)" }}>
                  <div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", marginBottom: "1rem", fontWeight: "600", display: "flex", justifyContent: "space-between" }}>
                    <span>Incoming Record</span>
                    <span style={{ backgroundColor: "rgba(255,255,255,0.1)", padding: "0.15rem 0.5rem", borderRadius: "4px", color: "#fff" }}>{selectedDoubt.rawRecord.departmentName}</span>
                  </div>
                  <div style={{ fontWeight: "600", fontSize: "1.25rem", display: "flex", alignItems: "flex-start", gap: "0.75rem", marginBottom: "1rem" }}>
                    <Building size={20} color="var(--primary-color)" style={{ marginTop: "0.25rem", flexShrink: 0 }} /> 
                    <span>{selectedDoubt.rawRecord.businessName}</span>
                  </div>
                  <div style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "1.5rem", lineHeight: "1.6" }}>
                    {selectedDoubt.rawRecord.address} <br/> 
                    {selectedDoubt.rawRecord.city && `${selectedDoubt.rawRecord.city}, `} 
                    {selectedDoubt.rawRecord.pincode}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", fontSize: "0.875rem" }}>
                    <div style={{ backgroundColor: "var(--bg-color)", padding: "0.75rem", borderRadius: "6px", border: "1px solid var(--border-color)" }}>
                      <span style={{ color: "var(--text-secondary)", display: "block", fontSize: "0.75rem", marginBottom: "0.25rem" }}>PAN</span>
                      <strong style={{ fontFamily: "monospace", fontSize: "1rem" }}>{selectedDoubt.rawRecord.pan || "-"}</strong>
                    </div>
                    <div style={{ backgroundColor: "var(--bg-color)", padding: "0.75rem", borderRadius: "6px", border: "1px solid var(--border-color)" }}>
                      <span style={{ color: "var(--text-secondary)", display: "block", fontSize: "0.75rem", marginBottom: "0.25rem" }}>GSTIN</span>
                      <strong style={{ fontFamily: "monospace", fontSize: "1rem" }}>{selectedDoubt.rawRecord.gstin || "-"}</strong>
                    </div>
                  </div>
                </div>

                {/* Arrow Indicator */}
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", paddingTop: "2rem" }}>
                  <ArrowRight size={28} color="var(--text-secondary)" opacity={0.5} />
                </div>

                {/* Target Profile */}
                <div style={{ backgroundColor: "rgba(59, 130, 246, 0.03)", padding: "1.5rem", borderRadius: "12px", border: "1px solid rgba(59, 130, 246, 0.3)" }}>
                  <div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--primary-color)", marginBottom: "1rem", fontWeight: "600", display: "flex", justifyContent: "space-between" }}>
                    <span>Existing Golden Profile</span>
                    <span style={{ backgroundColor: "rgba(59, 130, 246, 0.1)", padding: "0.15rem 0.5rem", borderRadius: "4px" }}>UBID</span>
                  </div>
                  <div style={{ fontWeight: "600", fontSize: "1.25rem", display: "flex", alignItems: "flex-start", gap: "0.75rem", marginBottom: "1rem" }}>
                    <Building size={20} color="var(--primary-color)" style={{ marginTop: "0.25rem", flexShrink: 0 }} /> 
                    <span>{selectedDoubt.unifiedRecord.businessName}</span>
                  </div>
                  <div style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "1.5rem", lineHeight: "1.6" }}>
                    {selectedDoubt.unifiedRecord.address} <br/> 
                    {selectedDoubt.unifiedRecord.city && `${selectedDoubt.unifiedRecord.city}, `} 
                    {selectedDoubt.unifiedRecord.pincode}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", fontSize: "0.875rem" }}>
                    <div style={{ backgroundColor: "var(--bg-color)", padding: "0.75rem", borderRadius: "6px", border: "1px solid rgba(59, 130, 246, 0.2)" }}>
                      <span style={{ color: "var(--text-secondary)", display: "block", fontSize: "0.75rem", marginBottom: "0.25rem" }}>PAN</span>
                      <strong style={{ fontFamily: "monospace", fontSize: "1rem" }}>{selectedDoubt.unifiedRecord.pan || "-"}</strong>
                    </div>
                    <div style={{ backgroundColor: "var(--bg-color)", padding: "0.75rem", borderRadius: "6px", border: "1px solid rgba(59, 130, 246, 0.2)" }}>
                      <span style={{ color: "var(--text-secondary)", display: "block", fontSize: "0.75rem", marginBottom: "0.25rem" }}>GSTIN</span>
                      <strong style={{ fontFamily: "monospace", fontSize: "1rem" }}>{selectedDoubt.unifiedRecord.gstin || "-"}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {selectedDoubt.comments && (
                <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)", backgroundColor: "rgba(255,255,255,0.02)", padding: "1rem", borderRadius: "8px", borderLeft: "4px solid var(--warning-color)", marginBottom: "1.5rem" }}>
                  <strong style={{ color: "var(--text-primary)", display: "block", marginBottom: "0.25rem" }}>AI Diagnostic Notes</strong>
                  {selectedDoubt.comments}
                </div>
              )}

              <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "1.5rem", display: "flex", gap: "1.5rem", alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.5rem" }}>Reviewer Notes (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="E.g., Verified addresses on MCA website..." 
                    value={reviewerNotes}
                    onChange={e => setReviewerNotes(e.target.value)}
                    disabled={!!processingId}
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      border: "1px solid var(--border-color)",
                      backgroundColor: "var(--bg-color)",
                      color: "var(--text-primary)",
                      fontSize: "0.875rem"
                    }}
                  />
                </div>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <button 
                    className="btn" 
                    onClick={() => handleReject(selectedDoubt.id)}
                    disabled={!!processingId}
                    style={{ backgroundColor: "transparent", border: "1px solid var(--danger-color)", color: "var(--danger-color)", padding: "0.75rem 1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}
                  >
                    <XCircle size={18} /> Reject & Create New
                  </button>
                  <button 
                    className="btn" 
                    onClick={() => handleApprove(selectedDoubt.id)}
                    disabled={!!processingId}
                    style={{ backgroundColor: "var(--success-color)", color: "#fff", padding: "0.75rem 1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}
                  >
                    <CheckCircle size={18} /> Approve Merge
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div style={{
          position: "fixed",
          top: "80px",
          right: "2rem",
          backgroundColor: toast.type === 'approve' ? "var(--success-color)" : toast.type === 'reject' ? "var(--warning-color)" : "var(--danger-color)",
          color: toast.type === 'reject' ? "#000" : "white",
          padding: "1rem 1.5rem",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          zIndex: 1000,
          animation: "slideInTop 0.3s ease"
        }}>
          {toast.type === 'approve' ? <CheckCircle size={20} /> : toast.type === 'reject' ? <XCircle size={20} /> : <AlertCircle size={20} />}
          <span style={{ fontWeight: "600" }}>{toast.message}</span>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideInTop {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}} />
    </div>
  );
}

export default function ReviewPortal() {
  return (
    <Suspense fallback={
      <div className="container" style={{ display: "flex", justifyContent: "center", paddingTop: "5rem" }}>
        <Loader2 size={32} className="spin" style={{ color: "var(--primary-color)" }} />
      </div>
    }>
      <ReviewContent />
    </Suspense>
  );
}
