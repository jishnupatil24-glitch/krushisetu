import React, { useState, useEffect } from "react";
import { auth, db } from "../../firebase";
import {
  collection,
  addDoc,
  query,
  where,
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

function FarmerDashboard() {
  const [farmerName, setFarmerName] = useState("");
  const [farmerData, setFarmerData] = useState(null);
  const [labourCount, setLabourCount] = useState(1);
  const [timeSlot, setTimeSlot] = useState("8-12");
  const [workType, setWorkType] = useState("harvesting");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [bookings, setBookings] = useState([]);
  const [totalAvailableLabour, setTotalAvailableLabour] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState("request");

  const navigate = useNavigate();

  useEffect(() => {
    const loadFarmerData = async () => {
      const user = auth.currentUser;
      if (!user) { navigate("/login"); return; }

      // Get farmer details
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        setFarmerData(userDoc.data());
        setFarmerName(userDoc.data().name);
      }

      // Real time bookings for this farmer
      const bookingQuery = query(
        collection(db, "bookings"),
        where("farmerId", "==", user.uid)
      );
      onSnapshot(bookingQuery, (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        // Sort newest first
        list.sort((a, b) => new Date(b.createdAt?.toDate()) - new Date(a.createdAt?.toDate()));
        setBookings(list);
      });

      // Real time available labour count
      onSnapshot(collection(db, "labours"), (snapshot) => {
        const availableCount = snapshot.docs.filter(
          (d) => d.data().available === true
        ).length;
        setTotalAvailableLabour(availableCount);
      });
    };

    loadFarmerData();
  }, [navigate]);

  // Submit labour request
  const handleRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    const user = auth.currentUser;

    try {
      // Check availability
      if (labourCount > totalAvailableLabour) {
        setError(
          `Only ${totalAvailableLabour} labours available right now! Please reduce your request.`
        );
        setLoading(false);
        return;
      }

      // Save booking
      await addDoc(collection(db, "bookings"), {
        farmerId: user.uid,
        farmerName: farmerName,
        farmerPhone: farmerData.phone,
        village: farmerData.village,
        labourCount: labourCount,
        timeSlot: timeSlot,
        workType: workType,
        date: date,
        description: description,
        status: "pending",
        supervisorId: null,
        supervisorName: null,
        supervisorPhone: null,
        assignedLabour: 0,
        assignedLabourIds: [],
        assignedLabourNames: [],
        farmerConfirmed: false,
        supervisorConfirmed: false,
        createdAt: new Date(),
      });

      setSuccess("Labour request submitted successfully! 🎉");
      setDate("");
      setDescription("");
      setLabourCount(1);
      setActiveTab("bookings");

    } catch (err) {
      setError("Failed to submit request. Please try again.");
    }
    setLoading(false);
  };

  // Farmer confirms attendance
  const handleConfirmAttendance = async (bookingId) => {
    setLoading(true);
    try {
      await updateDoc(doc(db, "bookings", bookingId), {
        farmerConfirmed: true,
      });
      setSuccess("Attendance confirmed! ✅");
    } catch (err) {
      setError("Failed to confirm attendance.");
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

  const getStatusText = (status) => {
    if (status === "pending") return "⏳ Pending - Waiting for supervisor";
    if (status === "assigned") return "✅ Assigned - Labour coming!";
    if (status === "completed") return "🎉 Completed";
    return status;
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.headerTitle}>🌾 KrishiSetu</h1>
          <p style={styles.headerSubtitle}>Welcome, {farmerName}! 👨‍🌾</p>
        </div>
        <button style={styles.logoutBtn} onClick={handleLogout}>
          Logout
        </button>
      </div>

      {/* Live Available Labour Banner */}
      <div style={styles.labourBanner}>
        <div>
          <p style={styles.bannerLabel}>👷 Labour Available Right Now</p>
          <p style={styles.bannerHint}>Updates in real time</p>
        </div>
        <span style={styles.bannerCount}>{totalAvailableLabour}</span>
      </div>

      {/* Messages */}
      {error && <p style={styles.error}>{error}</p>}
      {success && <p style={styles.success}>{success}</p>}

      {/* Tabs */}
      <div style={styles.tabContainer}>
        <button
          style={{
            ...styles.tabButton,
            backgroundColor: activeTab === "request" ? "#2d6a4f" : "#e8f5e9",
            color: activeTab === "request" ? "white" : "#2d6a4f",
          }}
          onClick={() => setActiveTab("request")}
        >
          📋 Request Labour
        </button>
        <button
          style={{
            ...styles.tabButton,
            backgroundColor: activeTab === "bookings" ? "#2d6a4f" : "#e8f5e9",
            color: activeTab === "bookings" ? "white" : "#2d6a4f",
          }}
          onClick={() => setActiveTab("bookings")}
        >
          📅 My Bookings ({bookings.length})
        </button>
      </div>

      {/* Request Labour Tab */}
      {activeTab === "request" && (
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Request Labour</h2>

          {totalAvailableLabour === 0 && (
            <div style={styles.noLabourWarning}>
              ⚠️ No labour available right now!
              Please check back later or tomorrow morning.
            </div>
          )}

          <form onSubmit={handleRequest}>
            {/* Date */}
            <label style={styles.label}>📅 Select Date</label>
            <input
              style={styles.input}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              required
            />

            {/* Time Slot */}
            <label style={styles.label}>⏰ Select Time Slot</label>
            <div style={styles.slotContainer}>
              {[
                { value: "8-12", label: "🌅 Morning (8AM - 12PM)" },
                { value: "2-6", label: "☀️ Afternoon (2PM - 6PM)" },
                { value: "fullday", label: "🌞 Full Day (8AM - 6PM)" },
              ].map((slot) => (
                <button
                  key={slot.value}
                  type="button"
                  style={{
                    ...styles.slotButton,
                    backgroundColor:
                      timeSlot === slot.value ? "#2d6a4f" : "#e8f5e9",
                    color: timeSlot === slot.value ? "white" : "#2d6a4f",
                  }}
                  onClick={() => setTimeSlot(slot.value)}
                >
                  {slot.label}
                </button>
              ))}
            </div>

            {/* Work Type */}
            <label style={styles.label}>🌾 Type of Work</label>
            <select
              style={styles.input}
              value={workType}
              onChange={(e) => setWorkType(e.target.value)}
              required
            >
              <option value="harvesting">🌾 Harvesting</option>
              <option value="planting">🌱 Planting</option>
              <option value="weeding">🌿 Weeding</option>
              <option value="irrigation">💧 Irrigation</option>
              <option value="spraying">🧴 Spraying</option>
              <option value="other">📝 Other</option>
            </select>

            {/* Labour Count */}
            <label style={styles.label}>
              👷 Number of Labour Needed
            </label>
            <input
              style={styles.input}
              type="number"
              min="1"
              max={totalAvailableLabour || 1}
              value={labourCount}
              onChange={(e) => setLabourCount(parseInt(e.target.value))}
              required
            />
            <p style={styles.availableHint}>
              ✅ {totalAvailableLabour} labours currently available
            </p>

            {/* Description */}
            <label style={styles.label}>📝 Additional Details (optional)</label>
            <textarea
              style={styles.textarea}
              placeholder="Describe the work, field size, special requirements..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />

            <button
              style={{
                ...styles.button,
                opacity: totalAvailableLabour === 0 ? 0.5 : 1,
              }}
              type="submit"
              disabled={loading || totalAvailableLabour === 0}
            >
              {loading ? "Submitting..." : "Submit Labour Request 🌾"}
            </button>
          </form>
        </div>
      )}

      {/* My Bookings Tab */}
      {activeTab === "bookings" && (
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>My Bookings</h2>

          {bookings.length === 0 ? (
            <p style={styles.emptyText}>
              No bookings yet! Request labour to get started.
            </p>
          ) : (
            bookings.map((booking) => (
              <div key={booking.id} style={styles.bookingCard}>
                {/* Booking Header */}
                <div style={styles.bookingHeader}>
                  <span style={styles.bookingDate}>📅 {booking.date}</span>
                  <span
                    style={{
                      ...styles.statusBadge,
                      backgroundColor: getStatusColor(booking.status),
                    }}
                  >
                    {booking.status}
                  </span>
                </div>

                {/* Status Text */}
                <p style={styles.statusText}>
                  {getStatusText(booking.status)}
                </p>

                {/* Booking Details */}
                <p style={styles.bookingDetail}>
                  ⏰{" "}
                  {booking.timeSlot === "8-12"
                    ? "Morning (8AM-12PM)"
                    : booking.timeSlot === "2-6"
                    ? "Afternoon (2PM-6PM)"
                    : "Full Day (8AM-6PM)"}
                </p>
                <p style={styles.bookingDetail}>
                  🌾 Work: {booking.workType || "General"}
                </p>
                <p style={styles.bookingDetail}>
                  👷 Labour Requested: {booking.labourCount}
                </p>

                {/* Assigned Labour Details */}
                {booking.status === "assigned" && (
                  <div style={styles.assignedBox}>
                    <p style={styles.assignedTitle}>✅ Labour Assigned!</p>
                    <p style={styles.bookingDetail}>
                      👷 Labour Count: {booking.assignedLabour}
                    </p>
                    {booking.assignedLabourNames &&
                      booking.assignedLabourNames.length > 0 && (
                        <div>
                          <p style={styles.labourNamesTitle}>
                            👥 Your Labours:
                          </p>
                          <div style={styles.labourTagsContainer}>
                            {booking.assignedLabourNames.map((name, index) => (
                              <span key={index} style={styles.labourTag}>
                                👤 {name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    {booking.supervisorName && (
                      <p style={styles.bookingDetail}>
                        👷 Supervisor: {booking.supervisorName}
                      </p>
                    )}
                    {booking.supervisorPhone && (
                      <p style={styles.supervisorPhone}>
                        📞 Supervisor Phone:{" "}
                        <strong>{booking.supervisorPhone}</strong>
                      </p>
                    )}
                  </div>
                )}

                {booking.description && (
                  <p style={styles.bookingDetail}>📝 {booking.description}</p>
                )}

                {/* Attendance Confirmation */}
                {booking.status === "assigned" &&
                  !booking.farmerConfirmed && (
                    <div style={styles.confirmBox}>
                      <p style={styles.confirmText}>
                        Did the labour come and work today?
                      </p>
                      <button
                        style={styles.confirmBtn}
                        onClick={() => handleConfirmAttendance(booking.id)}
                        disabled={loading}
                      >
                        ✅ Yes! Confirm Labour Attended
                      </button>
                    </div>
                  )}

                {booking.farmerConfirmed && (
                  <p style={styles.confirmedText}>
                    ✅ You confirmed attendance!
                  </p>
                )}

                {/* Mismatch warning */}
                {booking.farmerConfirmed &&
                  !booking.supervisorConfirmed && (
                    <p style={styles.mismatchText}>
                      ⚠️ Waiting for supervisor to confirm...
                    </p>
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
  labourBanner: { backgroundColor: "#1b4332", color: "white", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" },
  bannerLabel: { margin: 0, fontSize: "15px", fontWeight: "bold" },
  bannerHint: { margin: "4px 0 0 0", fontSize: "12px", opacity: 0.7 },
  bannerCount: { fontSize: "40px", fontWeight: "bold", color: "#95d5b2" },
  tabContainer: { display: "flex", gap: "12px", padding: "20px 24px 0 24px" },
  tabButton: { padding: "10px 20px", border: "2px solid #2d6a4f", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "14px" },
  card: { backgroundColor: "white", margin: "20px 24px", padding: "24px", borderRadius: "12px", boxShadow: "0 2px 10px rgba(0,0,0,0.08)" },
  cardTitle: { color: "#2d6a4f", marginTop: 0, marginBottom: "20px" },
  noLabourWarning: { backgroundColor: "#fff3e0", color: "#e65100", padding: "12px", borderRadius: "8px", marginBottom: "16px", fontWeight: "bold", fontSize: "14px" },
  label: { display: "block", marginBottom: "8px", fontWeight: "bold", color: "#333", fontSize: "14px" },
  input: { width: "100%", padding: "12px", marginBottom: "16px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "16px", boxSizing: "border-box" },
  availableHint: { color: "#2d6a4f", fontSize: "13px", marginBottom: "16px", fontWeight: "bold", marginTop: "-8px" },
  textarea: { width: "100%", padding: "12px", marginBottom: "16px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "16px", boxSizing: "border-box", resize: "vertical" },
  slotContainer: { display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" },
  slotButton: { padding: "12px", border: "2px solid #2d6a4f", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "14px", textAlign: "left" },
  button: { width: "100%", padding: "14px", backgroundColor: "#2d6a4f", color: "white", border: "none", borderRadius: "8px", fontSize: "16px", cursor: "pointer", fontWeight: "bold" },
  error: { color: "red", margin: "8px 24px", fontSize: "14px" },
  success: { color: "#2d6a4f", margin: "8px 24px", fontSize: "14px", fontWeight: "bold" },
  bookingCard: { border: "1px solid #ddd", borderRadius: "8px", padding: "16px", marginBottom: "12px" },
  bookingHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" },
  bookingDate: { fontWeight: "bold", color: "#333", fontSize: "15px" },
  statusBadge: { color: "white", padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "bold", textTransform: "uppercase" },
  statusText: { color: "#666", fontSize: "13px", margin: "4px 0 10px 0", fontStyle: "italic" },
  bookingDetail: { margin: "4px 0", color: "#555", fontSize: "14px" },
  assignedBox: { backgroundColor: "#e8f5e9", padding: "12px", borderRadius: "8px", margin: "10px 0" },
  assignedTitle: { fontWeight: "bold", color: "#2d6a4f", margin: "0 0 8px 0" },
  labourNamesTitle: { fontWeight: "bold", color: "#333", fontSize: "13px", margin: "8px 0 6px 0" },
  labourTagsContainer: { display: "flex", flexWrap: "wrap", gap: "6px" },
  labourTag: { backgroundColor: "#2d6a4f", color: "white", padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "bold" },
  supervisorPhone: { color: "#1565c0", margin: "6px 0", fontSize: "14px" },
  confirmBox: { backgroundColor: "#fff3e0", padding: "12px", borderRadius: "8px", margin: "10px 0" },
  confirmText: { color: "#e65100", fontWeight: "bold", margin: "0 0 10px 0", fontSize: "14px" },
  confirmBtn: { width: "100%", padding: "10px", backgroundColor: "#2d6a4f", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "14px" },
  confirmedText: { color: "#4caf50", fontWeight: "bold", marginTop: "8px", fontSize: "14px" },
  mismatchText: { color: "#ff9800", fontSize: "13px", marginTop: "6px", fontWeight: "bold" },
  emptyText: { textAlign: "center", color: "#888", padding: "40px 0" },
};

export default FarmerDashboard;