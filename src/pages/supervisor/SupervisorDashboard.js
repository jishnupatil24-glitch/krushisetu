import React, { useState, useEffect } from "react";
import { auth, db } from "../../firebase";
import {
  collection, query, where, doc, getDoc, getDocs,
  onSnapshot, updateDoc, addDoc, deleteDoc, setDoc
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import {
  Leaf, LogOut, Users, ClipboardList, CheckSquare,
  Plus, Trash2, Phone, Calendar, Clock, MapPin,
  FileText, Wallet, Sun, Sunset, Sunrise, User,
  AlertCircle, CheckCircle2, XCircle, ToggleLeft,
  ToggleRight, ChevronRight,
} from "lucide-react";

const SLOT_CONFIG = {
  "8-12":   { label: "Morning",   time: "8AM–12PM", icon: Sunrise, color: "#f59e0b", rate: 300 },
  "2-6":    { label: "Afternoon", time: "2PM–6PM",  icon: Sunset,  color: "#f97316", rate: 300 },
  fullday:  { label: "Full Day",  time: "8AM–6PM",  icon: Sun,     color: "#10b981", rate: 600 },
};

export default function SupervisorDashboard() {
  const [supData,      setSupData]      = useState(null);
  const [myLabours,    setMyLabours]    = useState([]);
  const [allBookings,  setAllBookings]  = useState([]);
  const [activeTab,    setActiveTab]    = useState("requests");
  const [loading,      setLoading]      = useState(false);

  // Add labour form
  const [newName,  setNewName]  = useState("");
  const [newPhone, setNewPhone] = useState("");

  // Assignment modal
  const [assignModal,       setAssignModal]       = useState(null); // booking obj
  const [selectedLabourIds, setSelectedLabourIds] = useState([]);

  // Unavailability modal
  const [unavailModal,   setUnavailModal]   = useState(null); // labour obj
  const [unavailDate,    setUnavailDate]    = useState("");
  const [unavailSlot,    setUnavailSlot]    = useState("8-12");
  const [unavailReason,  setUnavailReason]  = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) { navigate("/login"); return; }

    getDoc(doc(db, "users", user.uid)).then(d => {
      if (d.exists()) setSupData({ id: user.uid, ...d.data() });
    });

    // My labours
    const lq = query(collection(db, "labours"), where("supervisorId", "==", user.uid));
    const u1 = onSnapshot(lq, snap => {
      setMyLabours(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // All bookings
    const u2 = onSnapshot(collection(db, "bookings"), snap => {
      setAllBookings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { u1(); u2(); };
  }, [navigate]);

  // ── AVAILABILITY LOGIC ──
  // Is a labour available for a given date+slot?
  const isLabourAvailableForSlot = (labour, date, slot) => {
    // Check manual unavailability set by supervisor
    const unavailKey = `${date}_${slot}`;
    if (labour.unavailability?.[unavailKey]) return false;
    if (slot === "fullday") {
      if (labour.unavailability?.[`${date}_8-12`]) return false;
      if (labour.unavailability?.[`${date}_2-6`])  return false;
    }
    // Check if assigned to another booking on same date+slot
    const busy = allBookings.some(b => {
      if (b.status !== "assigned" && b.status !== "completed") return false;
      if (b.date !== date) return false;
      if (!b.assignedLabourIds?.includes(labour.id)) return false;
      const overlaps = b.timeSlot === slot || b.timeSlot === "fullday" || slot === "fullday";
      return overlaps;
    });
    return !busy;
  };

  // Count available labours for a date+slot
  const getAvailableForSlot = (date, slot) => {
    if (!date || !slot) return myLabours.length;
    return myLabours.filter(l => isLabourAvailableForSlot(l, date, slot)).length;
  };

  // Pending bookings = not yet assigned
  const pendingBookings  = allBookings.filter(b => b.status === "pending");
  // My assigned bookings
  const myAssigned       = allBookings.filter(b => b.supervisorId === auth.currentUser?.uid && b.status === "assigned");

  // ── ADD LABOUR ──
  const handleAddLabour = async (e) => {
    e.preventDefault();
    if (!newName.trim())       { toast.error("Enter labour name!");      return; }
    if (newPhone.length !== 10){ toast.error("Enter valid 10 digit phone!"); return; }
    setLoading(true);
    try {
      await addDoc(collection(db, "labours"), {
        name:         newName.trim(),
        phone:        newPhone,
        supervisorId: supData.id,
        supervisorName: supData.name,
        available:    true,
        unavailability: {},
        attendanceMarked: false,
        createdAt:    new Date(),
      });
      await updateDoc(doc(db, "users", supData.id), {
        labourCount: myLabours.length + 1,
      });
      toast.success(`${newName} added! ✅`);
      setNewName(""); setNewPhone("");
    } catch { toast.error("Failed to add labour."); }
    setLoading(false);
  };

  // ── DELETE LABOUR ──
  const handleDeleteLabour = async (labourId, name) => {
    if (!window.confirm(`Remove ${name} from your team?`)) return;
    try {
      await deleteDoc(doc(db, "labours", labourId));
      toast.success(`${name} removed.`);
    } catch { toast.error("Failed to remove."); }
  };

  // ── MARK LABOUR UNAVAILABLE FOR DATE+SLOT ──
  const handleMarkUnavailable = async () => {
    if (!unavailDate) { toast.error("Select a date!"); return; }
    try {
      const labour = unavailModal;
      const key    = `${unavailDate}_${unavailSlot}`;
      const updated = { ...(labour.unavailability || {}), [key]: unavailReason || "Personal reason" };
      await updateDoc(doc(db, "labours", labour.id), { unavailability: updated });
      toast.success("Marked unavailable ✅");
      setUnavailModal(null); setUnavailDate(""); setUnavailReason("");
    } catch { toast.error("Failed to update."); }
  };

  // ── REMOVE UNAVAILABILITY ──
  const handleRemoveUnavailability = async (labourId, key) => {
    const labour = myLabours.find(l => l.id === labourId);
    const updated = { ...(labour.unavailability || {}) };
    delete updated[key];
    await updateDoc(doc(db, "labours", labourId), { unavailability: updated });
    toast.success("Availability restored ✅");
  };

  // ── ASSIGN LABOURS ──
  const handleAssign = async () => {
    if (!assignModal) return;
    if (selectedLabourIds.length === 0) { toast.error("Select at least 1 labour!"); return; }
    if (selectedLabourIds.length > assignModal.labourCount) {
      toast.error(`Farmer needs only ${assignModal.labourCount} labours!`); return;
    }
    setLoading(true);
    try {
      const selected = myLabours.filter(l => selectedLabourIds.includes(l.id));
      const names    = selected.map(l => l.name);
      await updateDoc(doc(db, "bookings", assignModal.id), {
        status:              "assigned",
        supervisorId:        supData.id,
        supervisorName:      supData.name,
        supervisorPhone:     supData.phone,
        assignedLabour:      selectedLabourIds.length,
        assignedLabourIds:   selectedLabourIds,
        assignedLabourNames: names,
      });
      toast.success(`${names.join(", ")} assigned to ${assignModal.farmerName}! ✅`);
      setAssignModal(null); setSelectedLabourIds([]);
    } catch { toast.error("Failed to assign."); }
    setLoading(false);
  };

  // ── CONFIRM BOOKING ATTENDANCE ──
  const handleConfirmAttendance = async (bookingId) => {
    try {
      await updateDoc(doc(db, "bookings", bookingId), { supervisorConfirmed: true });
      toast.success("Attendance confirmed! ✅");
    } catch { toast.error("Failed to confirm."); }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  const toggleLabour = (id) => {
    setSelectedLabourIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const getStatusCfg = (status) => {
    if (status === "pending")   return { color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  label: "Pending",   icon: AlertCircle };
    if (status === "assigned")  return { color: "#10b981", bg: "rgba(16,185,129,0.1)",  label: "Assigned",  icon: CheckCircle2 };
    if (status === "completed") return { color: "#6366f1", bg: "rgba(99,102,241,0.1)",  label: "Completed", icon: CheckCircle2 };
    return { color: "#888", bg: "rgba(136,136,136,0.1)", label: status, icon: AlertCircle };
  };

  return (
    <div style={S.root}>
      <Toaster position="top-right" />

      {/* ── UNAVAILABILITY MODAL ── */}
      <AnimatePresence>
        {unavailModal && (
          <motion.div style={S.overlay}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div style={S.modal}
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}>
              <h3 style={S.modalTitle}>Mark Unavailable</h3>
              <p style={S.modalSub}>👤 {unavailModal.name}</p>

              <label style={S.label}>Date</label>
              <input style={S.input} type="date" value={unavailDate}
                onChange={e => setUnavailDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]} />

              <label style={S.label}>Time Slot</label>
              <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                {Object.entries(SLOT_CONFIG).map(([key, cfg]) => {
                  const Icon = cfg.icon;
                  return (
                    <motion.button key={key} type="button"
                      style={{
                        ...S.slotPill,
                        backgroundColor: unavailSlot === key ? `${cfg.color}18` : "transparent",
                        border: `1.5px solid ${unavailSlot === key ? cfg.color : "rgba(255,255,255,0.1)"}`,
                        color: unavailSlot === key ? cfg.color : "#666",
                      }}
                      onClick={() => setUnavailSlot(key)}
                      whileHover={{ scale: 1.03 }}>
                      <Icon size={12} />{cfg.label}
                    </motion.button>
                  );
                })}
              </div>

              <label style={S.label}>Reason (optional)</label>
              <input style={S.input} type="text" placeholder="Personal reason, illness..."
                value={unavailReason} onChange={e => setUnavailReason(e.target.value)} />

              <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                <motion.button style={S.modalConfirmBtn} onClick={handleMarkUnavailable}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                  Confirm
                </motion.button>
                <motion.button style={S.modalCancelBtn} onClick={() => setUnavailModal(null)}
                  whileHover={{ scale: 1.02 }}>
                  Cancel
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── ASSIGN MODAL ── */}
      <AnimatePresence>
        {assignModal && (
          <motion.div style={S.overlay}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div style={{ ...S.modal, maxWidth: "480px" }}
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}>
              <h3 style={S.modalTitle}>Assign Labour</h3>
              <div style={S.assignInfo}>
                <div style={S.assignInfoRow}><Calendar size={13} color="#4ade80" /><span>{assignModal.date}</span></div>
                <div style={S.assignInfoRow}>
                  {React.createElement(SLOT_CONFIG[assignModal.timeSlot]?.icon || Clock, { size: 13, color: SLOT_CONFIG[assignModal.timeSlot]?.color })}
                  <span>{SLOT_CONFIG[assignModal.timeSlot]?.label} · {SLOT_CONFIG[assignModal.timeSlot]?.time}</span>
                </div>
                <div style={S.assignInfoRow}><Users size={13} color="#60a5fa" /><span>{assignModal.farmerName} needs {assignModal.labourCount} labours</span></div>
                <div style={S.assignInfoRow}><MapPin size={13} color="#888" /><span>{assignModal.farmAddress || assignModal.village}</span></div>
              </div>

              <p style={{ fontSize: "12px", color: "#888", marginBottom: "10px" }}>
                Selected: <span style={{ color: "#4ade80", fontWeight: 700 }}>{selectedLabourIds.length}</span> / {assignModal.labourCount} needed
              </p>

              {/* Available labours for this slot */}
              <p style={S.sectionLabel}>✅ Available Labours</p>
              <div style={{ maxHeight: "220px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px" }}>
                {myLabours.filter(l => isLabourAvailableForSlot(l, assignModal.date, assignModal.timeSlot)).length === 0 ? (
                  <p style={{ color: "#555", fontSize: "13px", textAlign: "center", padding: "20px 0" }}>No available labours for this slot!</p>
                ) : (
                  myLabours.filter(l => isLabourAvailableForSlot(l, assignModal.date, assignModal.timeSlot)).map(l => {
                    const isSel = selectedLabourIds.includes(l.id);
                    return (
                      <motion.div key={l.id}
                        style={{
                          ...S.labourSelectRow,
                          backgroundColor: isSel ? "rgba(74,222,128,0.08)" : "rgba(255,255,255,0.02)",
                          border: `1px solid ${isSel ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.06)"}`,
                        }}
                        onClick={() => toggleLabour(l.id)}
                        whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div style={{ ...S.labourDot, backgroundColor: isSel ? "#4ade80" : "#333" }} />
                          <div>
                            <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: isSel ? "#e2e8f0" : "#999" }}>👤 {l.name}</p>
                            <p style={{ margin: 0, fontSize: "11px", color: "#555" }}>📞 {l.phone}</p>
                          </div>
                        </div>
                        {isSel && <span style={{ color: "#4ade80", fontSize: "16px" }}>✓</span>}
                      </motion.div>
                    );
                  })
                )}
              </div>

              {/* Busy labours */}
              {myLabours.filter(l => !isLabourAvailableForSlot(l, assignModal.date, assignModal.timeSlot)).length > 0 && (
                <>
                  <p style={{ ...S.sectionLabel, color: "#ef4444" }}>⏳ Busy / Unavailable</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginBottom: "12px", opacity: 0.5 }}>
                    {myLabours.filter(l => !isLabourAvailableForSlot(l, assignModal.date, assignModal.timeSlot)).map(l => (
                      <div key={l.id} style={{ ...S.labourSelectRow, cursor: "default" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div style={{ ...S.labourDot, backgroundColor: "#444" }} />
                          <p style={{ margin: 0, fontSize: "13px", color: "#555" }}>👤 {l.name}</p>
                        </div>
                        <span style={{ fontSize: "11px", color: "#ef4444", fontWeight: 600 }}>Unavailable</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div style={{ display: "flex", gap: "10px" }}>
                <motion.button style={{
                    ...S.modalConfirmBtn,
                    opacity: selectedLabourIds.length === 0 ? 0.5 : 1,
                  }}
                  onClick={handleAssign} disabled={loading || selectedLabourIds.length === 0}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                  {loading ? "Assigning..." : `✅ Assign ${selectedLabourIds.length} Labours`}
                </motion.button>
                <motion.button style={S.modalCancelBtn}
                  onClick={() => { setAssignModal(null); setSelectedLabourIds([]); }}
                  whileHover={{ scale: 1.02 }}>Cancel</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SIDEBAR ── */}
      <motion.aside style={S.sidebar}
        initial={{ x: -80, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.5 }}>

        <div style={S.sidebarLogo}>
          <div style={S.logoIcon}><Leaf size={20} color="#60a5fa" /></div>
          <div>
            <div style={S.logoTitle}>KrishiSetu</div>
            <div style={{ ...S.logoSub, color: "#60a5fa" }}>Supervisor Portal</div>
          </div>
        </div>

        {supData && (
          <div style={{ ...S.profileCard, borderColor: "rgba(96,165,250,0.15)", backgroundColor: "rgba(96,165,250,0.05)" }}>
            <div style={{ ...S.profileAvatar, backgroundColor: "rgba(96,165,250,0.15)", borderColor: "rgba(96,165,250,0.3)", color: "#60a5fa" }}>
              {supData.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <div style={S.profileName}>{supData.name}</div>
              <div style={S.profileMeta}>📞 {supData.phone}</div>
              <div style={S.profileMeta}>👥 {myLabours.length} labours</div>
            </div>
          </div>
        )}

        <nav style={S.nav}>
          {[
            { id: "requests",  icon: ClipboardList, label: "Farm Requests",  badge: pendingBookings.length },
            { id: "assigned",  icon: CheckSquare,   label: "My Assignments", badge: myAssigned.length },
            { id: "labours",   icon: Users,         label: "My Labours",     badge: myLabours.length },
          ].map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <motion.button key={item.id}
                style={{
                  ...S.navItem,
                  backgroundColor: isActive ? "rgba(96,165,250,0.1)" : "transparent",
                  borderLeft: `3px solid ${isActive ? "#60a5fa" : "transparent"}`,
                }}
                onClick={() => setActiveTab(item.id)}
                whileHover={{ x: 4 }} whileTap={{ scale: 0.97 }}>
                <Icon size={17} color={isActive ? "#60a5fa" : "#555"} />
                <span style={{ ...S.navLabel, color: isActive ? "#60a5fa" : "#777" }}>{item.label}</span>
                {item.badge > 0 && (
                  <span style={{ ...S.navBadge, backgroundColor: isActive ? "rgba(96,165,250,0.15)" : "rgba(255,255,255,0.06)", color: isActive ? "#60a5fa" : "#666" }}>
                    {item.badge}
                  </span>
                )}
              </motion.button>
            );
          })}
        </nav>

        {/* Quick stats */}
        <div style={S.statsBox}>
          {[
            { label: "Total", value: myLabours.length, color: "#60a5fa" },
            { label: "Available", value: myLabours.filter(l => l.available !== false).length, color: "#4ade80" },
            { label: "Assigned", value: myAssigned.length, color: "#f59e0b" },
          ].map((s, i) => (
            <React.Fragment key={s.label}>
              {i > 0 && <div style={S.statsDivider} />}
              <div style={S.statItem}>
                <span style={{ ...S.statNum, color: s.color }}>{s.value}</span>
                <span style={S.statLabel}>{s.label}</span>
              </div>
            </React.Fragment>
          ))}
        </div>

        <motion.button style={S.logoutBtn} onClick={handleLogout}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <LogOut size={15} color="#ef4444" />
          <span style={{ color: "#ef4444", fontSize: "13px", fontWeight: 600 }}>Logout</span>
        </motion.button>
      </motion.aside>

      {/* ── MAIN ── */}
      <main style={S.main}>
        <AnimatePresence mode="wait">

          {/* ───── FARM REQUESTS ───── */}
          {activeTab === "requests" && (
            <motion.div key="requests"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>

              <div style={S.pageHeader}>
                <div>
                  <h1 style={S.pageTitle}>Farm Requests</h1>
                  <p style={S.pageSub}>{pendingBookings.length} pending requests</p>
                </div>
              </div>

              {pendingBookings.length === 0 ? (
                <div style={S.emptyState}>
                  <div style={{ fontSize: "48px", marginBottom: "12px" }}>📭</div>
                  <p style={{ fontSize: "18px", fontWeight: 700, color: "#fff", margin: "0 0 6px" }}>No pending requests</p>
                  <p style={{ fontSize: "13px", color: "#555" }}>New farm bookings will appear here</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {pendingBookings
                    .sort((a, b) => new Date(a.date) - new Date(b.date))
                    .map(booking => {
                      const slotCfg = SLOT_CONFIG[booking.timeSlot];
                      const SlotIcon = slotCfg?.icon || Clock;
                      const availForSlot = getAvailableForSlot(booking.date, booking.timeSlot);
                      const canAssign = availForSlot >= booking.labourCount;

                      return (
                        <motion.div key={booking.id} style={S.bookingCard}
                          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                          whileHover={{ y: -2 }}>

                          <div style={S.bHeader}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <div style={S.bDateBadge}>
                                <Calendar size={11} color="#4ade80" />
                                <span>{booking.date}</span>
                              </div>
                              <div style={{
                                ...S.bSlotBadge,
                                backgroundColor: `${slotCfg?.color}18`,
                                color: slotCfg?.color,
                                border: `1px solid ${slotCfg?.color}40`,
                              }}>
                                <SlotIcon size={11} />
                                {slotCfg?.label}
                              </div>
                            </div>
                            <span style={S.bCost}>
                              ₹{(booking.totalCost || booking.labourCount * (slotCfg?.rate || 300)).toLocaleString()}
                            </span>
                          </div>

                          <div style={S.bGrid}>
                            <div style={S.bDetail}><User size={13} color="#888" /><span>{booking.farmerName}</span></div>
                            <div style={S.bDetail}><Phone size={13} color="#888" /><span>{booking.farmerPhone}</span></div>
                            <div style={S.bDetail}><Users size={13} color="#888" /><span>{booking.labourCount} labours needed</span></div>
                            <div style={S.bDetail}><SlotIcon size={13} color={slotCfg?.color} /><span>{slotCfg?.time}</span></div>
                            <div style={S.bDetail}><MapPin size={13} color="#888" /><span>{booking.farmAddress || booking.village}</span></div>
                            {booking.landmark && <div style={S.bDetail}><MapPin size={13} color="#555" /><span style={{ color: "#666" }}>{booking.landmark}</span></div>}
                            {booking.workType && <div style={S.bDetail}><FileText size={13} color="#888" /><span>{booking.workType}</span></div>}
                          </div>

                          {/* Availability indicator */}
                          <div style={{
                            ...S.availChip,
                            backgroundColor: canAssign ? "rgba(74,222,128,0.08)" : "rgba(239,68,68,0.08)",
                            border: `1px solid ${canAssign ? "rgba(74,222,128,0.2)" : "rgba(239,68,68,0.2)"}`,
                          }}>
                            <div style={{ ...S.availDot, backgroundColor: canAssign ? "#4ade80" : "#ef4444" }} />
                            <span style={{ color: canAssign ? "#4ade80" : "#ef4444", fontSize: "12px", fontWeight: 600 }}>
                              {availForSlot} of your labours available for this slot
                            </span>
                          </div>

                          <motion.button
                            style={{
                              ...S.assignBtn,
                              opacity: canAssign ? 1 : 0.4,
                              cursor: canAssign ? "pointer" : "not-allowed",
                            }}
                            onClick={() => {
                              if (!canAssign) { toast.error(`Not enough labours! Only ${availForSlot} available.`); return; }
                              setAssignModal(booking);
                              setSelectedLabourIds([]);
                            }}
                            whileHover={{ scale: canAssign ? 1.02 : 1 }}
                            whileTap={{ scale: canAssign ? 0.97 : 1 }}>
                            <Users size={14} />
                            {canAssign ? "Select & Assign Labours" : `Need ${booking.labourCount}, only ${availForSlot} available`}
                          </motion.button>
                        </motion.div>
                      );
                    })}
                </div>
              )}
            </motion.div>
          )}

          {/* ───── MY ASSIGNMENTS ───── */}
          {activeTab === "assigned" && (
            <motion.div key="assigned"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>

              <div style={S.pageHeader}>
                <div>
                  <h1 style={S.pageTitle}>My Assignments</h1>
                  <p style={S.pageSub}>{myAssigned.length} active assignments</p>
                </div>
              </div>

              {myAssigned.length === 0 ? (
                <div style={S.emptyState}>
                  <div style={{ fontSize: "48px", marginBottom: "12px" }}>📋</div>
                  <p style={{ fontSize: "18px", fontWeight: 700, color: "#fff", margin: "0 0 6px" }}>No assignments yet</p>
                  <p style={{ fontSize: "13px", color: "#555" }}>Assign labours to pending requests first</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {myAssigned
                    .sort((a, b) => new Date(a.date) - new Date(b.date))
                    .map(booking => {
                      const slotCfg = SLOT_CONFIG[booking.timeSlot];
                      const SlotIcon = slotCfg?.icon || Clock;
                      const presentCount = Object.values(booking.labourAttendance || {}).filter(Boolean).length;
                      const absentCount  = (booking.assignedLabour || 0) - presentCount;

                      return (
                        <motion.div key={booking.id} style={S.bookingCard}
                          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                          whileHover={{ y: -2 }}>

                          <div style={S.bHeader}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <div style={S.bDateBadge}><Calendar size={11} color="#4ade80" /><span>{booking.date}</span></div>
                              <div style={{ ...S.bSlotBadge, backgroundColor: `${slotCfg?.color}18`, color: slotCfg?.color, border: `1px solid ${slotCfg?.color}40` }}>
                                <SlotIcon size={11} />{slotCfg?.label}
                              </div>
                              <div style={{ ...S.bSlotBadge, backgroundColor: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)" }}>
                                <CheckCircle2 size={11} />Assigned
                              </div>
                            </div>
                            <span style={S.bCost}>₹{(booking.totalCost || booking.labourCount * (slotCfg?.rate || 300)).toLocaleString()}</span>
                          </div>

                          <div style={S.bGrid}>
                            <div style={S.bDetail}><User size={13} color="#888" /><span>{booking.farmerName}</span></div>
                            <div style={S.bDetail}><Phone size={13} color="#888" /><span>{booking.farmerPhone}</span></div>
                            <div style={S.bDetail}><Users size={13} color="#888" /><span>{booking.assignedLabour} assigned</span></div>
                            <div style={S.bDetail}><MapPin size={13} color="#888" /><span>{booking.farmAddress || booking.village}</span></div>
                            {booking.landmark && <div style={S.bDetail}><MapPin size={13} color="#555" /><span style={{ color: "#666" }}>📍 {booking.landmark}</span></div>}
                            {booking.workType && <div style={S.bDetail}><FileText size={13} color="#888" /><span>{booking.workType}</span></div>}
                          </div>

                          {/* Assigned labours + attendance */}
                          {booking.assignedLabourNames?.length > 0 && (
                            <div style={S.laboursBox}>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
                                <Users size={13} color="#a78bfa" />
                                <span style={{ color: "#a78bfa", fontWeight: 700, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                  Assigned Labour ({booking.assignedLabour})
                                </span>
                                <div style={{ marginLeft: "auto", display: "flex", gap: "10px" }}>
                                  <span style={{ color: "#4ade80", fontSize: "11px", fontWeight: 600 }}>✅ {presentCount}</span>
                                  <span style={{ color: absentCount > 0 ? "#ef4444" : "#555", fontSize: "11px", fontWeight: 600 }}>❌ {absentCount}</span>
                                </div>
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                                {booking.assignedLabourNames.map((name, idx) => {
                                  const labourId  = booking.assignedLabourIds?.[idx];
                                  const isPresent = booking.labourAttendance?.[labourId] === true;
                                  const isFarmerPresent = booking.labourAttendance?.[labourId] === true;
                                  return (
                                    <div key={idx} style={{
                                      ...S.labourAttRow,
                                      backgroundColor: isPresent ? "rgba(74,222,128,0.06)" : "rgba(255,255,255,0.02)",
                                      border: `1px solid ${isPresent ? "rgba(74,222,128,0.18)" : "rgba(255,255,255,0.05)"}`,
                                    }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <div style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: isPresent ? "#4ade80" : "#333" }} />
                                        <span style={{ fontSize: "13px", color: isPresent ? "#e2e8f0" : "#777", fontWeight: isPresent ? 600 : 400 }}>
                                          👤 {name}
                                        </span>
                                        {isFarmerPresent && <span style={{ fontSize: "10px", color: "#4ade80", backgroundColor: "rgba(74,222,128,0.1)", padding: "2px 6px", borderRadius: "6px" }}>farmer confirmed</span>}
                                      </div>
                                      <span style={{ fontSize: "11px", color: isPresent ? "#4ade80" : "#555", fontWeight: 600 }}>
                                        {isPresent ? "✅ Present" : "Pending"}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Confirm attendance */}
                          {!booking.supervisorConfirmed ? (
                            <motion.button style={S.confirmBtn}
                              onClick={() => handleConfirmAttendance(booking.id)}
                              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                              <CheckCircle2 size={14} />
                              Confirm Work Completed
                            </motion.button>
                          ) : (
                            <div style={S.confirmedRow}>
                              <CheckCircle2 size={13} color="#4ade80" />
                              <span>You confirmed attendance</span>
                              {!booking.farmerConfirmed && <span style={{ color: "#f59e0b", fontSize: "11px" }}>· Waiting for farmer</span>}
                              {booking.farmerConfirmed  && <span style={{ color: "#4ade80", fontSize: "11px" }}>· Farmer also confirmed ✅</span>}
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                </div>
              )}
            </motion.div>
          )}

          {/* ───── MY LABOURS ───── */}
          {activeTab === "labours" && (
            <motion.div key="labours"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>

              <div style={S.pageHeader}>
                <div>
                  <h1 style={S.pageTitle}>My Labours</h1>
                  <p style={S.pageSub}>{myLabours.length} team members</p>
                </div>
              </div>

              {/* Add Labour Form */}
              <div style={{ ...S.bookingCard, marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                  <Plus size={15} color="#60a5fa" />
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Add New Labour
                  </span>
                </div>
                <form onSubmit={handleAddLabour} style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <input style={{ ...S.input, flex: 2, minWidth: "140px" }}
                    type="text" placeholder="Full name"
                    value={newName} onChange={e => setNewName(e.target.value)} />
                  <input style={{ ...S.input, flex: 1, minWidth: "120px" }}
                    type="tel" placeholder="Phone (10 digits)"
                    value={newPhone} onChange={e => setNewPhone(e.target.value)} maxLength={10} />
                  <motion.button type="submit" style={S.addBtn} disabled={loading}
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <Plus size={14} /> Add
                  </motion.button>
                </form>
              </div>

              {/* Labours List */}
              {myLabours.length === 0 ? (
                <div style={S.emptyState}>
                  <div style={{ fontSize: "48px", marginBottom: "12px" }}>👥</div>
                  <p style={{ fontSize: "18px", fontWeight: 700, color: "#fff", margin: "0 0 6px" }}>No labours yet</p>
                  <p style={{ fontSize: "13px", color: "#555" }}>Add your first team member above</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {myLabours.map(labour => {
                    const unavailKeys = Object.keys(labour.unavailability || {});
                    const isBusyToday = allBookings.some(b =>
                      b.status === "assigned" &&
                      b.assignedLabourIds?.includes(labour.id)
                    );

                    return (
                      <motion.div key={labour.id} style={S.labourCard}
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        whileHover={{ y: -1 }}>

                        <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                          <div style={S.labourAvatar}>{labour.name[0]?.toUpperCase()}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>{labour.name}</span>
                              {isBusyToday && (
                                <span style={{ fontSize: "10px", backgroundColor: "rgba(245,158,11,0.12)", color: "#f59e0b", padding: "2px 7px", borderRadius: "8px", fontWeight: 600 }}>
                                  Assigned
                                </span>
                              )}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                              <Phone size={11} color="#555" />
                              <span style={{ fontSize: "12px", color: "#555" }}>{labour.phone}</span>
                            </div>

                            {/* Unavailability tags */}
                            {unavailKeys.length > 0 && (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "6px" }}>
                                {unavailKeys.map(key => {
                                  const [d, s] = key.split("_");
                                  return (
                                    <div key={key} style={S.unavailTag}>
                                      <span>🚫 {d} · {SLOT_CONFIG[s]?.label || s}</span>
                                      <span style={{ color: "#ef4444", cursor: "pointer", marginLeft: "4px", fontSize: "12px" }}
                                        onClick={() => handleRemoveUnavailability(labour.id, key)}>×</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <motion.button style={S.unavailBtn}
                            onClick={() => { setUnavailModal(labour); setUnavailDate(""); setUnavailReason(""); }}
                            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <XCircle size={13} />
                            Mark Unavailable
                          </motion.button>
                          <motion.button style={S.deleteBtn}
                            onClick={() => handleDeleteLabour(labour.id, labour.name)}
                            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <Trash2 size={13} />
                          </motion.button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}

const S = {
  root: { minHeight: "100vh", backgroundColor: "#060d08", display: "flex", fontFamily: "'DM Sans','Segoe UI',sans-serif", color: "#e2e8f0" },

  // Modals
  overlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" },
  modal: { backgroundColor: "#0d1a11", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "20px", padding: "28px", width: "100%", maxWidth: "400px", maxHeight: "85vh", overflowY: "auto" },
  modalTitle: { fontSize: "18px", fontWeight: 800, color: "#fff", margin: "0 0 4px" },
  modalSub: { fontSize: "13px", color: "#666", margin: "0 0 18px" },
  modalConfirmBtn: { flex: 2, padding: "12px", background: "linear-gradient(135deg,#4ade80,#22c55e)", border: "none", borderRadius: "10px", color: "#060d08", fontSize: "13px", fontWeight: 800, cursor: "pointer", fontFamily: "inherit" },
  modalCancelBtn: { flex: 1, padding: "12px", backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "10px", color: "#ef4444", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  slotPill: { display: "flex", alignItems: "center", gap: "5px", padding: "8px 12px", borderRadius: "8px", cursor: "pointer", border: "none", fontFamily: "inherit", fontSize: "12px", fontWeight: 600 },
  assignInfo: { backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "12px", marginBottom: "14px", display: "flex", flexDirection: "column", gap: "6px" },
  assignInfoRow: { display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#999" },
  sectionLabel: { fontSize: "11px", fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 8px" },
  labourSelectRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: "8px", cursor: "pointer" },
  labourDot: { width: "8px", height: "8px", borderRadius: "50%" },

  // Sidebar
  sidebar: { width: "256px", minHeight: "100vh", backgroundColor: "#080f0a", borderRight: "1px solid rgba(255,255,255,0.04)", padding: "24px 0", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh", overflowY: "auto", flexShrink: 0 },
  sidebarLogo: { display: "flex", alignItems: "center", gap: "10px", padding: "0 18px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)" },
  logoIcon: { width: "34px", height: "34px", borderRadius: "9px", backgroundColor: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)", display: "flex", alignItems: "center", justifyContent: "center" },
  logoTitle: { fontSize: "14px", fontWeight: 800, color: "#fff" },
  logoSub: { fontSize: "10px", fontWeight: 500 },
  profileCard: { margin: "14px 10px", padding: "12px", borderRadius: "12px", border: "1px solid", display: "flex", alignItems: "center", gap: "10px" },
  profileAvatar: { width: "36px", height: "36px", borderRadius: "50%", border: "2px solid", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 800, flexShrink: 0 },
  profileName: { fontSize: "13px", fontWeight: 700, color: "#fff", marginBottom: "2px" },
  profileMeta: { fontSize: "11px", color: "#555" },
  nav: { padding: "14px 10px", flex: 1 },
  navItem: { width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "8px", border: "none", cursor: "pointer", marginBottom: "3px", transition: "all 0.2s" },
  navLabel: { fontSize: "13px", fontWeight: 600, flex: 1, textAlign: "left" },
  navBadge: { fontSize: "11px", fontWeight: 700, padding: "2px 7px", borderRadius: "10px" },
  statsBox: { margin: "0 10px 12px", padding: "12px", backgroundColor: "rgba(255,255,255,0.02)", borderRadius: "10px", display: "flex", justifyContent: "space-around" },
  statsDivider: { width: "1px", backgroundColor: "rgba(255,255,255,0.05)" },
  statItem: { display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" },
  statNum: { fontSize: "18px", fontWeight: 800, lineHeight: 1 },
  statLabel: { fontSize: "10px", color: "#444", textTransform: "uppercase" },
  logoutBtn: { margin: "0 10px", padding: "10px 14px", backgroundColor: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.1)", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" },

  // Main
  main: { flex: 1, padding: "30px", overflowY: "auto", minHeight: "100vh" },
  pageHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "22px" },
  pageTitle: { fontSize: "24px", fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.5px" },
  pageSub: { fontSize: "13px", color: "#555", margin: "4px 0 0" },

  // Booking cards
  bookingCard: { backgroundColor: "#0d1a11", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "18px" },
  bHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" },
  bDateBadge: { display: "flex", alignItems: "center", gap: "5px", backgroundColor: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.15)", padding: "4px 10px", borderRadius: "20px", fontSize: "11px", color: "#4ade80", fontWeight: 600 },
  bSlotBadge: { display: "flex", alignItems: "center", gap: "4px", padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700 },
  bCost: { fontSize: "16px", fontWeight: 800, color: "#fff" },
  bGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "12px" },
  bDetail: { display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#777" },
  availChip: { display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", borderRadius: "8px", marginBottom: "10px" },
  availDot: { width: "7px", height: "7px", borderRadius: "50%", flexShrink: 0 },
  assignBtn: { width: "100%", padding: "11px", backgroundColor: "rgba(96,165,250,0.1)", border: "1.5px solid rgba(96,165,250,0.25)", borderRadius: "10px", color: "#60a5fa", fontSize: "13px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", fontFamily: "inherit" },

  // Labours box inside assignments
  laboursBox: { backgroundColor: "rgba(167,139,250,0.04)", border: "1px solid rgba(167,139,250,0.1)", borderRadius: "10px", padding: "12px", marginBottom: "10px" },
  labourAttRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: "8px" },

  confirmBtn: { width: "100%", padding: "11px", backgroundColor: "rgba(74,222,128,0.08)", border: "1.5px solid rgba(74,222,128,0.2)", borderRadius: "10px", color: "#4ade80", fontSize: "13px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", fontFamily: "inherit", marginTop: "4px" },
  confirmedRow: { display: "flex", alignItems: "center", gap: "6px", padding: "8px 12px", marginTop: "4px", backgroundColor: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.12)", borderRadius: "8px", fontSize: "12px", color: "#4ade80", fontWeight: 600 },

  // Labour management
  labourCard: { backgroundColor: "#0d1a11", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "14px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" },
  labourAvatar: { width: "34px", height: "34px", borderRadius: "50%", backgroundColor: "rgba(96,165,250,0.1)", border: "1.5px solid rgba(96,165,250,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 800, color: "#60a5fa", flexShrink: 0 },
  unavailTag: { display: "flex", alignItems: "center", gap: "2px", backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", color: "#ef4444" },
  unavailBtn: { display: "flex", alignItems: "center", gap: "5px", padding: "7px 12px", backgroundColor: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)", borderRadius: "8px", color: "#ef4444", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" },
  deleteBtn: { padding: "7px 10px", backgroundColor: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: "8px", color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", fontFamily: "inherit" },

  // Form elements
  label: { display: "block", fontSize: "11px", fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" },
  input: { width: "100%", padding: "11px 13px", backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "9px", fontSize: "14px", color: "#fff", boxSizing: "border-box", outline: "none", fontFamily: "inherit" },
  addBtn: { padding: "11px 18px", background: "linear-gradient(135deg,#60a5fa,#3b82f6)", border: "none", borderRadius: "9px", color: "#fff", fontSize: "13px", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: "5px", fontFamily: "inherit", whiteSpace: "nowrap" },

  emptyState: { textAlign: "center", padding: "60px 40px", backgroundColor: "#0d1a11", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "14px" },
};