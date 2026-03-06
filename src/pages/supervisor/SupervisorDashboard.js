import React, { useState, useEffect } from "react";
import { auth, db } from "../../firebase";
import {
  collection,
  query,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  where,
  onSnapshot,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

function SupervisorDashboard() {
  const [supervisorName, setSupervisorName] = useState("");
  const [supervisorData, setSupervisorData] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [myLabours, setMyLabours] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("bookings");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [availableCount, setAvailableCount] = useState(0);
  const [availabilityConfirmed, setAvailabilityConfirmed] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedLabourIds, setSelectedLabourIds] = useState([]);

  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      const user = auth.currentUser;
      if (!user) { navigate("/login"); return; }

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setSupervisorData({ id: user.uid, ...data });
        setSupervisorName(data.name);
        setAvailableCount(data.availableLabourCount || 0);
      }

      // Real time bookings
      onSnapshot(collection(db, "bookings"), (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        list.sort((a, b) => new Date(a.date) - new Date(b.date));
        setBookings(list);
      });

      // Real time my labours only
      const labourQuery = query(
        collection(db, "labours"),
        where("supervisorId", "==", user.uid)
      );
      onSnapshot(labourQuery, (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setMyLabours(list);
      });
    };

    loadData();
  }, [navigate]);

  // Confirm nightly availability
  const handleConfirmAvailability = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    const user = auth.currentUser;

    try {
      const availableLabours = myLabours.slice(0, availableCount);
      const unavailableLabours = myLabours.slice(availableCount);

      for (const labour of availableLabours) {
        await updateDoc(doc(db, "labours", labour.id), {
          available: true,
        });
      }

      for (const labour of unavailableLabours) {
        await updateDoc(doc(db, "labours", labour.id), {
          available: false,
        });
      }

      await updateDoc(doc(db, "users", user.uid), {
        availableLabourCount: availableCount,
        labourCount: myLabours.length,
      });

      setSupervisorData({
        ...supervisorData,
        availableLabourCount: availableCount,
      });

      setAvailabilityConfirmed(true);
      setSuccess(`✅ Confirmed! ${availableCount} labours available tomorrow!`);
    } catch (err) {
      setError("Failed to confirm availability. Try again.");
    }
    setLoading(false);
  };

  const toggleLabourSelection = (labourId) => {
    setSelectedLabourIds((prev) =>
      prev.includes(labourId)
        ? prev.filter((id) => id !== labourId)
        : [...prev, labourId]
    );
  };

  // Assign selected labours to a specific farm
  const handleAssignLabours = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    const user = auth.currentUser;

    if (!selectedBooking) return;

    if (selectedLabourIds.length === 0) {
      setError("Please select at least 1 labour!");
      setLoading(false);
      return;
    }

    if (selectedLabourIds.length > selectedBooking.labourCount) {
      setError(
        `Farmer needs only ${selectedBooking.labourCount} labours! Please deselect some.`
      );
      setLoading(false);
      return;
    }

    try {
      const selectedLabours = myLabours.filter((l) =>
        selectedLabourIds.includes(l.id)
      );
      const labourNames = selectedLabours.map((l) => l.name);

      // Update booking
      await updateDoc(doc(db, "bookings", selectedBooking.id), {
        status: "assigned",
        supervisorId: user.uid,
        supervisorName: supervisorName,
        supervisorPhone: supervisorData.phone,
        assignedLabour: selectedLabourIds.length,
        assignedLabourIds: selectedLabourIds,
        assignedLabourNames: labourNames,
      });

      // Mark selected labours as busy with farmer name
      for (const labourId of selectedLabourIds) {
        await updateDoc(doc(db, "labours", labourId), {
          available: false,
          assignedBookingId: selectedBooking.id,
          assignedFarmerName: selectedBooking.farmerName,
        });
      }

      // Recalculate available count
      const stillAvailable = myLabours.filter(
        (l) => l.available && !selectedLabourIds.includes(l.id)
      ).length;

      await updateDoc(doc(db, "users", user.uid), {
        availableLabourCount: stillAvailable,
      });

      setSuccess(
        `✅ ${labourNames.join(", ")} assigned to ${selectedBooking.farmerName}!`
      );
      setSelectedBooking(null);
      setSelectedLabourIds([]);
    } catch (err) {
      setError("Failed to assign labours. Try again.");
    }
    setLoading(false);
  };

  // Mark individual labour attendance
  const handleMarkAttendance = async (labourId, currentStatus) => {
    try {
      await updateDoc(doc(db, "labours", labourId), {
        attendanceMarked: !currentStatus,
      });
      setSuccess("Attendance updated! ✅");
    } catch (err) {
      setError("Failed to update attendance.");
    }
  };

  // Confirm booking attendance
  const handleConfirmBookingAttendance = async (bookingId) => {
    setLoading(true);
    try {
      await updateDoc(doc(db, "bookings", bookingId), {
        supervisorConfirmed: true,
      });
      setSuccess("Booking attendance confirmed! ✅");
    } catch (err) {
      setError("Failed to confirm.");
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  const getStatusColor = (status) => {
    if (status === "pending") return "#ff9800";
    if (status === "assigned") return "#2196f3";
    if (status === "completed") return "#4caf50";
    return "#666";
  };

  const availableLabours = myLabours.filter((l) => l.available);
  const busyLabours = myLabours.filter((l) => !l.available);

  const myAssignedBookings = bookings.filter(
    (b) =>
      b.supervisorId === auth.currentUser?.uid &&
      b.status !== "completed"
  );

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.headerTitle}>🌾 KrishiSetu</h1>
          <p style={styles.headerSubtitle}>👷 Supervisor: {supervisorName}</p>
        </div>
        <button style={styles.logoutBtn} onClick={handleLogout}>Logout</button>
      </div>

      {/* Stats */}
      <div style={styles.statsCard}>
        <div style={styles.statItem}>
          <span style={styles.statNumber}>{myLabours.length}</span>
          <span style={styles.statLabel}>Total Labour</span>
        </div>
        <div style={styles.statItem}>
          <span style={styles.statNumber}>{availableLabours.length}</span>
          <span style={styles.statLabel}>Available</span>
        </div>
        <div style={styles.statItem}>
          <span style={styles.statNumber}>
            {bookings.filter((b) => b.status === "pending").length}
          </span>
          <span style={styles.statLabel}>Pending</span>
        </div>
        <div style={styles.statItem}>
          <span style={styles.statNumber}>{myAssignedBookings.length}</span>
          <span style={styles.statLabel}>Assigned</span>
        </div>
      </div>

      {/* Messages */}
      {error && <p style={styles.error}>{error}</p>}
      {success && <p style={styles.success}>{success}</p>}

      {/* Nightly Availability */}
      <div style={styles.nightlyCard}>
        <p style={styles.nightlyTitle}>🌙 Confirm Tomorrow's Labour Availability</p>
        <p style={styles.nightlySubtitle}>
          Total labours under you: {myLabours.length}
        </p>
        <div style={styles.nightlyRow}>
          <input
            style={styles.nightlyInput}
            type="number"
            min="0"
            max={myLabours.length}
            value={availableCount}
            onChange={(e) => {
              setAvailableCount(parseInt(e.target.value) || 0);
              setAvailabilityConfirmed(false);
            }}
          />
          <button
            style={{
              ...styles.nightlyBtn,
              backgroundColor: availabilityConfirmed ? "#4caf50" : "#2d6a4f",
            }}
            onClick={handleConfirmAvailability}
            disabled={loading}
          >
            {availabilityConfirmed ? "✅ Confirmed!" : "Confirm"}
          </button>
        </div>
      </div>

      {/* Assignment Modal */}
      {selectedBooking && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>
              Assign Labour to 👨‍🌾 {selectedBooking.farmerName}
            </h3>
            <p style={styles.modalSubtitle}>
              📅 {selectedBooking.date} |{" "}
              {selectedBooking.timeSlot === "8-12"
                ? "Morning"
                : selectedBooking.timeSlot === "2-6"
                ? "Afternoon"
                : "Full Day"}
            </p>
            <p style={styles.modalSubtitle}>
              Farmer needs: {selectedBooking.labourCount} labours
            </p>
            <p style={styles.modalSubtitle}>
              Selected: {selectedLabourIds.length} / {selectedBooking.labourCount}
            </p>

            {/* Available labours */}
            <p style={styles.sectionLabel}>✅ Available Labours (tap to select):</p>
            {availableLabours.length === 0 ? (
              <p style={styles.emptyText}>No available labours right now!</p>
            ) : (
              availableLabours.map((labour) => (
                <div
                  key={labour.id}
                  style={{
                    ...styles.labourSelectItem,
                    backgroundColor: selectedLabourIds.includes(labour.id)
                      ? "#e8f5e9"
                      : "white",
                    border: selectedLabourIds.includes(labour.id)
                      ? "2px solid #2d6a4f"
                      : "1px solid #ddd",
                  }}
                  onClick={() => toggleLabourSelection(labour.id)}
                >
                  <div>
                    <p style={styles.labourName}>👤 {labour.name}</p>
                    <p style={styles.labourPhone}>📞 {labour.phone}</p>
                  </div>
                  {selectedLabourIds.includes(labour.id) ? (
                    <span style={styles.selectedCheck}>✅</span>
                  ) : (
                    <span style={styles.selectHint}>Tap</span>
                  )}
                </div>
              ))
            )}

            {/* Busy labours */}
            {busyLabours.length > 0 && (
              <>
                <p style={styles.sectionLabel}>
                  ⏳ Already Assigned to Other Farms:
                </p>
                {busyLabours.map((labour) => (
                  <div key={labour.id} style={styles.labourBusyItem}>
                    <div>
                      <p style={styles.labourName}>👤 {labour.name}</p>
                      <p style={styles.labourPhone}>📞 {labour.phone}</p>
                    </div>
                    <span style={styles.busyBadge}>
                      ⏳ {labour.assignedFarmerName || "Assigned"}
                    </span>
                  </div>
                ))}
              </>
            )}

            <div style={styles.modalButtons}>
              <button
                style={{
                  ...styles.assignConfirmBtn,
                  opacity: selectedLabourIds.length === 0 ? 0.5 : 1,
                }}
                onClick={handleAssignLabours}
                disabled={loading || selectedLabourIds.length === 0}
              >
                {loading
                  ? "Assigning..."
                  : `✅ Assign ${selectedLabourIds.length} Labours to ${selectedBooking.farmerName}`}
              </button>
              <button
                style={styles.cancelBtn}
                onClick={() => {
                  setSelectedBooking(null);
                  setSelectedLabourIds([]);
                }}
              >
                ❌ Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={styles.tabContainer}>
        {["bookings", "labours", "assigned"].map((tab) => (
          <button
            key={tab}
            style={{
              ...styles.tabButton,
              backgroundColor: activeTab === tab ? "#2d6a4f" : "#e8f5e9",
              color: activeTab === tab ? "white" : "#2d6a4f",
            }}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "bookings" && "📋 Farm Requests"}
            {tab === "labours" && `👥 My Labours (${myLabours.length})`}
            {tab === "assigned" && "✅ My Assignments"}
          </button>
        ))}
      </div>

      {/* Farm Requests Tab */}
      {activeTab === "bookings" && (
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>All Farm Requests</h2>
          {bookings.filter((b) => b.status === "pending").length === 0 ? (
            <p style={styles.emptyText}>No pending requests!</p>
          ) : (
            bookings
              .filter((b) => b.status === "pending")
              .map((booking) => (
                <div key={booking.id} style={styles.bookingCard}>
                  <div style={styles.bookingHeader}>
                    <span style={styles.farmerName}>
                      👨‍🌾 {booking.farmerName}
                    </span>
                    <span
                      style={{
                        ...styles.statusBadge,
                        backgroundColor: getStatusColor(booking.status),
                      }}
                    >
                      {booking.status}
                    </span>
                  </div>
                  <p style={styles.bookingDetail}>📅 Date: {booking.date}</p>
                  <p style={styles.bookingDetail}>
                    ⏰ Time:{" "}
                    {booking.timeSlot === "8-12"
                      ? "Morning (8AM-12PM)"
                      : booking.timeSlot === "2-6"
                      ? "Afternoon (2PM-6PM)"
                      : "Full Day"}
                  </p>
                  <p style={styles.bookingDetail}>
                    👷 Labour Needed: {booking.labourCount}
                  </p>
                  <p style={styles.bookingDetail}>📍 {booking.village}</p>
                  <p style={styles.bookingDetail}>
                    📞 Farmer: {booking.farmerPhone}
                  </p>
                  {booking.description && (
                    <p style={styles.bookingDetail}>📝 {booking.description}</p>
                  )}
                  <button
                    style={{
                      ...styles.assignBtn,
                      opacity: availableLabours.length === 0 ? 0.5 : 1,
                    }}
                    onClick={() => {
                      if (availableLabours.length === 0) {
                        setError("No available labours to assign!");
                        return;
                      }
                      setSelectedBooking(booking);
                      setSelectedLabourIds([]);
                    }}
                  >
                    👥 Select & Assign Labours by Name
                  </button>
                </div>
              ))
          )}
        </div>
      )}

      {/* My Labours Tab */}
      {activeTab === "labours" && (
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>👥 My Labours</h2>
          <p style={styles.hint}>Mark attendance for each labour individually</p>

          {myLabours.length === 0 ? (
            <p style={styles.emptyText}>No labours assigned yet! Contact admin.</p>
          ) : (
            myLabours.map((labour) => (
              <div key={labour.id} style={styles.labourCard}>
                <div style={styles.labourInfo}>
                  <p style={styles.labourName}>👤 {labour.name}</p>
                  <p style={styles.labourPhone}>📞 {labour.phone}</p>
                  {!labour.available && labour.assignedFarmerName && (
                    <p style={styles.assignedTo}>
                      🌾 Assigned to: {labour.assignedFarmerName}
                    </p>
                  )}
                  <span
                    style={{
                      ...styles.availableBadge,
                      backgroundColor: labour.available ? "#4caf50" : "#ff9800",
                    }}
                  >
                    {labour.available ? "✅ Available" : "⏳ Assigned"}
                  </span>
                </div>
                <button
                  style={{
                    ...styles.attendanceToggleBtn,
                    backgroundColor: labour.attendanceMarked
                      ? "#4caf50"
                      : "#e8f5e9",
                    color: labour.attendanceMarked ? "white" : "#2d6a4f",
                  }}
                  onClick={() =>
                    handleMarkAttendance(labour.id, labour.attendanceMarked)
                  }
                >
                  {labour.attendanceMarked ? "✅ Present" : "Mark Present"}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* My Assignments Tab */}
      {activeTab === "assigned" && (
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>My Assignments</h2>
          {myAssignedBookings.length === 0 ? (
            <p style={styles.emptyText}>No active assignments!</p>
          ) : (
            myAssignedBookings.map((booking) => (
              <div key={booking.id} style={styles.bookingCard}>
                <div style={styles.bookingHeader}>
                  <span style={styles.farmerName}>
                    👨‍🌾 {booking.farmerName}
                  </span>
                  <span
                    style={{
                      ...styles.statusBadge,
                      backgroundColor: getStatusColor(booking.status),
                    }}
                  >
                    {booking.status}
                  </span>
                </div>
                <p style={styles.bookingDetail}>📅 {booking.date}</p>
                <p style={styles.bookingDetail}>
                  ⏰{" "}
                  {booking.timeSlot === "8-12"
                    ? "Morning (8AM-12PM)"
                    : booking.timeSlot === "2-6"
                    ? "Afternoon (2PM-6PM)"
                    : "Full Day"}
                </p>
                <p style={styles.bookingDetail}>
                  👷 Labour Assigned: {booking.assignedLabour}
                </p>
                {booking.assignedLabourNames && (
                  <div style={styles.labourNamesList}>
                    <p style={styles.labourNamesTitle}>👥 Assigned Labours:</p>
                    {booking.assignedLabourNames.map((name, index) => (
                      <span key={index} style={styles.labourNameTag}>
                        👤 {name}
                      </span>
                    ))}
                  </div>
                )}
                <p style={styles.bookingDetail}>📞 Farmer: {booking.farmerPhone}</p>
                <p style={styles.bookingDetail}>📍 {booking.village}</p>

                {!booking.supervisorConfirmed ? (
                  <button
                    style={styles.attendanceBtn}
                    onClick={() => handleConfirmBookingAttendance(booking.id)}
                    disabled={loading}
                  >
                    📝 Confirm Attendance for This Booking
                  </button>
                ) : (
                  <p style={styles.confirmedText}>✅ You confirmed attendance!</p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { minHeight: "100vh", backgroundColor: "#f0f4f0", paddingBottom: "40px" },
  header: { backgroundColor: "#2d6a4f", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "white" },
  headerTitle: { margin: 0, fontSize: "22px" },
  headerSubtitle: { margin: 0, fontSize: "14px", opacity: 0.9 },
  logoutBtn: { backgroundColor: "transparent", border: "2px solid white", color: "white", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "14px" },
  statsCard: { backgroundColor: "#2d6a4f", margin: "16px 24px", padding: "16px", borderRadius: "12px", display: "flex", justifyContent: "space-around" },
  statItem: { textAlign: "center", color: "white" },
  statNumber: { display: "block", fontSize: "28px", fontWeight: "bold" },
  statLabel: { fontSize: "12px", opacity: 0.9 },
  nightlyCard: { backgroundColor: "white", margin: "0 24px 16px 24px", padding: "16px", borderRadius: "12px", boxShadow: "0 2px 10px rgba(0,0,0,0.08)" },
  nightlyTitle: { fontWeight: "bold", color: "#333", margin: "0 0 4px 0" },
  nightlySubtitle: { color: "#888", fontSize: "13px", margin: "0 0 12px 0" },
  nightlyRow: { display: "flex", gap: "12px" },
  nightlyInput: { flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "16px" },
  nightlyBtn: { padding: "10px 20px", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "14px" },
  tabContainer: { display: "flex", gap: "8px", padding: "0 24px", flexWrap: "wrap" },
  tabButton: { padding: "10px 16px", border: "2px solid #2d6a4f", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "13px", marginBottom: "8px" },
  card: { backgroundColor: "white", margin: "16px 24px", padding: "24px", borderRadius: "12px", boxShadow: "0 2px 10px rgba(0,0,0,0.08)" },
  cardTitle: { color: "#2d6a4f", marginTop: 0, marginBottom: "20px" },
  hint: { color: "#888", fontSize: "13px", marginBottom: "16px" },
  bookingCard: { border: "1px solid #ddd", borderRadius: "8px", padding: "16px", marginBottom: "12px" },
  bookingHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" },
  farmerName: { fontWeight: "bold", color: "#333", fontSize: "16px" },
  statusBadge: { color: "white", padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "bold", textTransform: "uppercase" },
  bookingDetail: { margin: "4px 0", color: "#555", fontSize: "14px" },
  assignBtn: { marginTop: "12px", width: "100%", padding: "10px", backgroundColor: "#2d6a4f", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "14px" },
  attendanceBtn: { marginTop: "12px", width: "100%", padding: "10px", backgroundColor: "#1565c0", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "14px" },
  confirmedText: { color: "#4caf50", fontWeight: "bold", marginTop: "8px" },
  labourCard: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", border: "1px solid #ddd", borderRadius: "8px", marginBottom: "10px" },
  labourInfo: { flex: 1 },
  labourName: { fontWeight: "bold", color: "#333", margin: "0 0 4px 0", fontSize: "15px" },
  labourPhone: { color: "#666", margin: "0 0 6px 0", fontSize: "13px" },
  assignedTo: { color: "#ff9800", fontSize: "12px", margin: "0 0 6px 0", fontWeight: "bold" },
  availableBadge: { color: "white", padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "bold" },
  attendanceToggleBtn: { padding: "8px 12px", border: "2px solid #2d6a4f", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "12px", whiteSpace: "nowrap" },
  labourNamesList: { backgroundColor: "#f9f9f9", padding: "10px", borderRadius: "8px", margin: "8px 0" },
  labourNamesTitle: { fontWeight: "bold", color: "#333", margin: "0 0 8px 0", fontSize: "13px" },
  labourNameTag: { display: "inline-block", backgroundColor: "#e8f5e9", color: "#2d6a4f", padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "bold", margin: "2px" },
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" },
  modal: { backgroundColor: "white", borderRadius: "12px", padding: "24px", width: "100%", maxWidth: "400px", maxHeight: "80vh", overflowY: "auto" },
  modalTitle: { color: "#2d6a4f", margin: "0 0 8px 0", fontSize: "18px" },
  modalSubtitle: { color: "#666", fontSize: "14px", margin: "0 0 8px 0" },
  sectionLabel: { fontWeight: "bold", color: "#333", fontSize: "14px", margin: "16px 0 8px 0" },
  labourSelectItem: { padding: "12px", borderRadius: "8px", marginBottom: "8px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" },
  labourBusyItem: { padding: "10px", borderRadius: "8px", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f5f5f5", border: "1px solid #eee", opacity: 0.6 },
  busyBadge: { color: "white", padding: "4px 8px", borderRadius: "8px", fontSize: "11px", fontWeight: "bold", backgroundColor: "#ff9800" },
  selectedCheck: { fontSize: "20px" },
  selectHint: { color: "#999", fontSize: "11px" },
  modalButtons: { marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px" },
  assignConfirmBtn: { width: "100%", padding: "12px", backgroundColor: "#2d6a4f", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "15px" },
  cancelBtn: { width: "100%", padding: "12px", backgroundColor: "#f44336", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "15px" },
  error: { color: "red", margin: "0 24px 8px 24px", fontSize: "14px" },
  success: { color: "#2d6a4f", margin: "0 24px 8px 24px", fontSize: "14px", fontWeight: "bold" },
  emptyText: { textAlign: "center", color: "#888", padding: "20px 0" },
};

export default SupervisorDashboard;