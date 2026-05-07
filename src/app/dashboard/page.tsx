"use client";

import React, { useState, useEffect } from "react";
import { getUnifiedRecords, getReviewCount, getEventReviewCount } from "../actions";
import { Loader2, ShieldAlert, ArrowRight, Building, Search, Eye, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";

export default function DashboardPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [eventReviewCount, setEventReviewCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ name: "", address: "", dept: "", id: "", status: "All", ubid: "", score: "", reasoning: "", activity: "All" });
  const [debouncedFilters, setDebouncedFilters] = useState(filters);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters(filters);
      setPage(1); // Reset page on new filter
    }, 500);
    return () => clearTimeout(timer);
  }, [filters]);

  const fetchData = async (p: number, currentFilters: any) => {
    setLoading(true);
    const [unifiedRes, reviewRes, eventReviewRes] = await Promise.all([
      getUnifiedRecords(p, 10, currentFilters),
      getReviewCount(),
      getEventReviewCount()
    ]);

    if (unifiedRes.success) {
      setRecords(unifiedRes.records);
      setTotal(unifiedRes.total);
    }
    if (reviewRes.success) setReviewCount(reviewRes.count);
    if (eventReviewRes.success) setEventReviewCount(eventReviewRes.count);

    setLoading(false);
  };

  const totalPages = Math.ceil(total / 10);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, page - 2);
      let end = Math.min(totalPages, page + 2);
      
      if (start === 1) end = maxVisible;
      if (end === totalPages) start = totalPages - maxVisible + 1;
      
      for (let i = start; i <= end; i++) pages.push(i);
    }
    return pages;
  };

  useEffect(() => {
    fetchData(page, debouncedFilters);
  }, [page, debouncedFilters]);

  return (
    <div style={{ maxWidth: "1600px", margin: "0 auto", padding: "1.5rem 2rem", height: "calc(100vh - 65px)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 className="title">Unified Dashboard</h1>
          <p className="subtitle" style={{ marginBottom: 0 }}>
            {total} businesses uniquely identified across departments
          </p>
        </div>

        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          {reviewCount > 0 && (
            <button
              className="btn"
              onClick={() => window.location.href = "/review"}
              style={{ backgroundColor: "rgba(245, 158, 11, 0.1)", color: "var(--warning-color)", border: "1px solid var(--warning-color)", display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <ShieldAlert size={18} />
              {reviewCount} master data {reviewCount === 1 ? "entry" : "entries"} need review
              <ArrowRight size={18} />
            </button>
          )}
          {eventReviewCount > 0 && (
            <button
              className="btn"
              onClick={() => window.location.href = "/review-events"}
              style={{ backgroundColor: "rgba(139, 92, 246, 0.1)", color: "var(--accent-color)", border: "1px solid var(--accent-color)", display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <AlertCircle size={18} />
              {eventReviewCount} event {eventReviewCount === 1 ? "match" : "matches"} need review
              <ArrowRight size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "auto", position: "relative", flex: 1, minHeight: 0 }}>
        {loading && (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 10 }}>
            <Loader2 size={32} className="spin" style={{ color: "var(--primary-color)" }} />
          </div>
        )}
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", opacity: loading ? 0.5 : 1, transition: "opacity 0.2s" }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: "var(--surface-color)", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
            <tr style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "rgba(0,0,0,0.2)" }}>
              <th style={{ padding: "1rem", fontWeight: "600", minWidth: "120px", verticalAlign: "top" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div>UBID</div>
                  <input type="text" placeholder="Filter..." value={filters.ubid} onChange={e => setFilters({ ...filters, ubid: e.target.value })} style={{ boxSizing: "border-box", width: "100%", padding: "0.25rem", height: "30px", fontSize: "0.75rem", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--text-primary)" }} />
                </div>
              </th>
              <th style={{ padding: "1rem", fontWeight: "600", minWidth: "280px", verticalAlign: "top" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div>Business Details</div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input type="text" placeholder="Name..." value={filters.name} onChange={e => setFilters({ ...filters, name: e.target.value })} style={{ boxSizing: "border-box", width: "100%", padding: "0.25rem", height: "30px", fontSize: "0.75rem", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--text-primary)" }} />
                    <input type="text" placeholder="PAN/GSTIN..." value={filters.id} onChange={e => setFilters({ ...filters, id: e.target.value })} style={{ boxSizing: "border-box", width: "100%", padding: "0.25rem", height: "30px", fontSize: "0.75rem", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--text-primary)" }} />
                  </div>
                </div>
              </th>
              <th style={{ padding: "1rem", fontWeight: "600", minWidth: "150px", verticalAlign: "top" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div>Address</div>
                  <input type="text" placeholder="Filter..." value={filters.address} onChange={e => setFilters({ ...filters, address: e.target.value })} style={{ boxSizing: "border-box", width: "100%", padding: "0.25rem", height: "30px", fontSize: "0.75rem", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--text-primary)" }} />
                </div>
              </th>
              <th style={{ padding: "1rem", fontWeight: "600", minWidth: "150px", verticalAlign: "top" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div>Activity</div>
                  <select value={filters.activity} onChange={e => setFilters({ ...filters, activity: e.target.value })} style={{ boxSizing: "border-box", width: "100%", padding: "0.25rem", height: "30px", fontSize: "0.75rem", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--text-primary)", cursor: "pointer" }}>
                    <option value="All">All</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="DORMANT">DORMANT</option>
                    <option value="CLOSED">CLOSED</option>
                    <option value="UNKNOWN">UNKNOWN</option>
                  </select>
                </div>
              </th>
              <th style={{ padding: "1rem", fontWeight: "600", minWidth: "120px", verticalAlign: "top" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div>Linked Dept</div>
                  <input type="text" placeholder="Filter..." value={filters.dept} onChange={e => setFilters({ ...filters, dept: e.target.value })} style={{ boxSizing: "border-box", width: "100%", padding: "0.25rem", height: "30px", fontSize: "0.75rem", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--text-primary)" }} />
                </div>
              </th>
              <th style={{ padding: "1rem", fontWeight: "600", minWidth: "150px", verticalAlign: "top" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div>Match Status</div>
                  <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })} style={{ boxSizing: "border-box", width: "100%", padding: "0.25rem", height: "30px", fontSize: "0.75rem", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--text-primary)", cursor: "pointer" }}>
                    <option value="All">All</option>
                    <option value="NEW_ENTITY">NEW_ENTITY</option>
                    <option value="AUTO_LINKED">AUTO_LINKED</option>
                    <option value="MANUAL_LINK">MANUAL_LINK</option>
                    <option value="IN_REVIEW">IN REVIEW</option>
                  </select>
                </div>
              </th>
              <th style={{ padding: "1rem", fontWeight: "600", minWidth: "100px", verticalAlign: "top" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div>Score(%)</div>
                  <input type="number" placeholder="Min %" value={filters.score} onChange={e => setFilters({ ...filters, score: e.target.value })} style={{ boxSizing: "border-box", width: "100%", padding: "0.25rem", height: "30px", fontSize: "0.75rem", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--text-primary)" }} />
                </div>
              </th>
              <th style={{ padding: "1rem", fontWeight: "600", minWidth: "200px", verticalAlign: "top" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div>Reasoning</div>
                  <input type="text" placeholder="Filter..." value={filters.reasoning} onChange={e => setFilters({ ...filters, reasoning: e.target.value })} style={{ boxSizing: "border-box", width: "100%", padding: "0.25rem", height: "30px", fontSize: "0.75rem", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--text-primary)" }} />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>
                  No unified records match your filters.
                </td>
              </tr>
            ) : (
              records.map(record => {
                const allActions = [...(record.rawRecords || []), ...(record.linkDoubts || []).map((d: any) => ({ ...d, isDoubt: true, status: "IN_REVIEW" }))];
                const rowCount = allActions.length || 1;

                return (
                  <React.Fragment key={record.ubid}>
                    <tr style={{ borderTop: "1px solid var(--border-color)" }}>
                      <td rowSpan={rowCount} style={{ padding: "1rem", fontFamily: "monospace", fontSize: "0.875rem", color: "var(--text-secondary)", borderRight: "1px solid var(--border-color)" }}>
                        {record.ubid.split("-")[0]}...
                      </td>
                      <td rowSpan={rowCount} style={{ padding: "1rem", borderRight: "1px solid var(--border-color)" }}>
                        <div style={{ fontWeight: "500", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <Building size={16} color="var(--primary-color)" />
                          {record.businessName}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                          {record.pan && <span>PAN: {record.pan} &middot; </span>}
                          {record.gstin && <span>GST: {record.gstin}</span>}
                        </div>
                      </td>
                      <td rowSpan={rowCount} style={{ padding: "1rem", fontSize: "0.875rem", color: "var(--text-secondary)", borderRight: "1px solid var(--border-color)" }}>
                        {record.address} <br /> {record.city} {record.pincode}
                      </td>
                      <td rowSpan={rowCount} style={{ padding: "1rem", borderRight: "1px solid var(--border-color)" }}>
                         <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                           {/* PENDING_MASTER_REVIEW: events blocked until master data resolved */}
                           {record.hasPendingMasterEventReview && (
                             <div title="Events are linked to this business but master data has unresolved review. Resolve master data first." style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.2rem 0.6rem", borderRadius: "4px", fontSize: "0.7rem", backgroundColor: "rgba(156,163,175,0.1)", color: "#9ca3af", fontWeight: "600", cursor: "help", alignSelf: "flex-start" }}>
                               <AlertCircle size={12} /> PENDING MASTER REVIEW
                             </div>
                           )}
                           <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                             <span style={{
                               padding: "0.2rem 0.6rem",
                               borderRadius: "4px",
                               fontSize: "0.75rem",
                               backgroundColor: record.activityStatus === "ACTIVE" ? "rgba(16, 185, 129, 0.1)" : record.activityStatus === "DORMANT" ? "rgba(245, 158, 11, 0.1)" : record.activityStatus === "CLOSED" ? "rgba(239, 68, 68, 0.1)" : "rgba(255, 255, 255, 0.05)",
                               color: record.activityStatus === "ACTIVE" ? "var(--success-color)" : record.activityStatus === "DORMANT" ? "var(--warning-color)" : record.activityStatus === "CLOSED" ? "var(--danger-color)" : "var(--text-secondary)",
                               fontWeight: "600"
                             }}>
                               {record.activityStatus || "UNKNOWN"}
                             </span>
                             {/* Orange event review count badge — only shown if no directly-linked events exist */}
                             {!record.hasLinkedEvents && record.pendingEventReviewCount > 0 && (
                               <a href="/review-events" title={`${record.pendingEventReviewCount} fuzzy event match(es) need review`} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: "20px", height: "20px", borderRadius: "50%", backgroundColor: "var(--accent-color)", color: "#fff", fontSize: "0.65rem", fontWeight: "700", textDecoration: "none", padding: "0 4px" }}>
                                 {record.pendingEventReviewCount}
                               </a>
                             )}
                           </div>
                           <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                             {record.activityReason || "No transaction events linked yet."}
                           </div>
                         </div>
                      </td>

                      {allActions.length > 0 ? (
                        <>
                          <td style={{ padding: "1rem", fontSize: "0.875rem", fontWeight: "500", backgroundColor: allActions[0].isDoubt ? "rgba(245, 158, 11, 0.05)" : "transparent" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                {allActions[0].departmentName}
                                <a href={`/audit?id=${allActions[0].id}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary-color)", opacity: 0.7, display: "flex", alignItems: "center" }} title="View Original Audit Record">
                                  <Eye size={14} />
                                </a>
                              </div>
                              {allActions[0].departmentId && (
                                <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", fontWeight: "normal" }}>
                                  ID: {allActions[0].departmentId}
                                </div>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: "1rem", backgroundColor: allActions[0].isDoubt ? "rgba(245, 158, 11, 0.05)" : "transparent" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <span style={{
                                padding: "0.15rem 0.4rem",
                                borderRadius: "4px",
                                fontSize: "0.65rem",
                                backgroundColor: allActions[0].isDoubt ? "rgba(245, 158, 11, 0.1)" : allActions[0].status === "AUTO_LINKED" || allActions[0].status === "MANUAL_LINK" ? "rgba(16, 185, 129, 0.1)" : "rgba(139, 92, 246, 0.1)",
                                color: allActions[0].isDoubt ? "var(--warning-color)" : allActions[0].status === "AUTO_LINKED" || allActions[0].status === "MANUAL_LINK" ? "var(--success-color)" : "var(--accent-color)",
                                fontWeight: "600"
                              }}>
                                {allActions[0].isDoubt ? "IN REVIEW" : allActions[0].status}
                              </span>
                              {allActions[0].isDoubt && (
                                <a href={`/review?id=${allActions[0].doubtId}`} style={{ color: "var(--warning-color)", opacity: 0.8, display: "flex", alignItems: "center", padding: "0.2rem", borderRadius: "4px", backgroundColor: "rgba(245, 158, 11, 0.1)" }} title="Review this match">
                                  <ArrowRight size={14} />
                                </a>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: "1rem", fontSize: "0.875rem", backgroundColor: allActions[0].isDoubt ? "rgba(245, 158, 11, 0.05)" : "transparent" }}>
                            {allActions[0].matchScore ? `${(allActions[0].matchScore * 100).toFixed(0)}%` : "-"}
                          </td>
                          <td style={{ padding: "1rem", fontSize: "0.75rem", color: allActions[0].isDoubt ? "var(--warning-color)" : "var(--text-secondary)", backgroundColor: allActions[0].isDoubt ? "rgba(245, 158, 11, 0.05)" : "transparent" }}>
                            {allActions[0].matchReason || "-"}
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ padding: "1rem" }}>-</td>
                          <td style={{ padding: "1rem" }}>-</td>
                          <td style={{ padding: "1rem" }}>-</td>
                          <td style={{ padding: "1rem" }}>-</td>
                        </>
                      )}
                    </tr>
                    {allActions.slice(1).map((action: any, idx: number) => (
                      <tr key={action.id || idx} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                        <td style={{ padding: "1rem", fontSize: "0.875rem", fontWeight: "500", backgroundColor: action.isDoubt ? "rgba(245, 158, 11, 0.05)" : "transparent" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              {action.departmentName}
                              <a href={`/audit?id=${action.id}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary-color)", opacity: 0.7, display: "flex", alignItems: "center" }} title="View Original Audit Record">
                                <Eye size={14} />
                              </a>
                            </div>
                            {action.departmentId && (
                              <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", fontWeight: "normal" }}>
                                ID: {action.departmentId}
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "1rem", backgroundColor: action.isDoubt ? "rgba(245, 158, 11, 0.05)" : "transparent" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{
                              padding: "0.15rem 0.4rem",
                              borderRadius: "4px",
                              fontSize: "0.65rem",
                              backgroundColor: action.isDoubt ? "rgba(245, 158, 11, 0.1)" : action.status === "AUTO_LINKED" || action.status === "MANUAL_LINK" ? "rgba(16, 185, 129, 0.1)" : "rgba(139, 92, 246, 0.1)",
                              color: action.isDoubt ? "var(--warning-color)" : action.status === "AUTO_LINKED" || action.status === "MANUAL_LINK" ? "var(--success-color)" : "var(--accent-color)",
                              fontWeight: "600"
                            }}>
                              {action.isDoubt ? "IN REVIEW" : action.status}
                            </span>
                            {action.isDoubt && (
                              <a href={`/review?id=${action.doubtId}`} style={{ color: "var(--warning-color)", opacity: 0.8, display: "flex", alignItems: "center", padding: "0.2rem", borderRadius: "4px", backgroundColor: "rgba(245, 158, 11, 0.1)" }} title="Review this match">
                                <ArrowRight size={14} />
                              </a>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "1rem", fontSize: "0.875rem", backgroundColor: action.isDoubt ? "rgba(245, 158, 11, 0.05)" : "transparent" }}>
                          {action.matchScore ? `${(action.matchScore * 100).toFixed(0)}%` : "-"}
                        </td>
                        <td style={{ padding: "1rem", fontSize: "0.75rem", color: action.isDoubt ? "var(--warning-color)" : "var(--text-secondary)", backgroundColor: action.isDoubt ? "rgba(245, 158, 11, 0.05)" : "transparent" }}>
                          {action.matchReason || "-"}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {total > 10 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2rem" }}>
          <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            Showing page {page} of {totalPages || 1}
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button 
              className="btn" 
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              style={{ padding: "0.5rem", backgroundColor: "var(--bg-color)", border: "1px solid var(--border-color)" }}
            >
              <ChevronLeft size={16} />
            </button>

            {getPageNumbers().map(p => (
              <button
                key={p}
                className="btn"
                onClick={() => setPage(p)}
                style={{ 
                  padding: "0.5rem 1rem", 
                  backgroundColor: page === p ? "var(--primary-color)" : "var(--bg-color)", 
                  border: `1px solid ${page === p ? "var(--primary-color)" : "var(--border-color)"}`,
                  color: page === p ? "#fff" : "var(--text-primary)",
                  fontWeight: page === p ? "600" : "400"
                }}
              >
                {p}
              </button>
            ))}

            <button 
              className="btn" 
              disabled={page >= totalPages || totalPages === 0}
              onClick={() => setPage(page + 1)}
              style={{ padding: "0.5rem", backgroundColor: "var(--bg-color)", border: "1px solid var(--border-color)" }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
