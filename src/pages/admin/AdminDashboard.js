import React, { useState, useEffect } from "react";
import { auth, db } from "../../firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { useNavigate } from "react-router-dom";

// Secondary Firebase app to create supervisor accounts
// without logging out admin
const firebaseConfig = {

  apiKey: "AIzaSyCZaYEyCETKnCtGlVlujV5QCnv4z_vPCMM",
  authDomain: "krishisetu-d5278.firebaseapp.com",
  projectId: "krishisetu-d5278",
  storageBucket: "krishisetu-d5278.firebasestorage.app",
  messagingSenderId: "340746027277",
  appId: "1:340746027277:web:ffadd5ad2ed84af97c3044"
};

let secondaryApp;
let secondaryAuth;
try {
  secondaryApp = initializeApp(firebaseConfig, "Secondary");
  secondaryAuth = getAuth(secondaryApp);
} catch (e) {
  secondaryApp = null;
  secondaryAuth = null;
}

function AdminDashboard() {
  const [supervisors, setSupervisors] = useState([]);
  const [farmers, setFarmers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [labours, setLabours] = useState([]);
  const [selectedSupervisor, setSelectedSupervisor] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);

  // Create supervisor form
  const [supName, setSupName] = useState("");
  const [supEmail, setSupEmail] = useState("");
  const [supPhone, setSupPhone] = useState("");
  const [supPassword, setSupPassword] = useState("");
  const [supSuccess, setSupSuccess] = useState("");
  const [supError, setSupError] = useState("");

  // Add labour form
  const [newLabourName, setNewLabourName] = useState("");
  const [newLabourPhone, setNewLabourPhone] = useState("");
  const [selectedSupervisorForLabour, setSelectedSupervisorForLabour] = useState("");
  const [labourSuccess, setLabourSuccess] = useState("");
  const [labourError, setLabourError] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      const user = auth.currentUser;
      if (!user) { navigate("/login"); return; }

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists() || userDoc.data().role !== "admin") {
        navigate("/login");
        return;
      }

      await loadAllData();

      // Real time labours
      onSnapshot(collection(db, "labours"), (snapshot) => {
        const labourList = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setLabours(labourList);
      });

      // Real time bookings
      onSnapshot(collection(db, "bookings"), (snapshot) => {
        const bookingList = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setBookings(bookingList);
      });

      setLoading(false);
    };

    loadData();
  }, [navigate]);

  const loadAllData = async () => {
    const usersSnapshot = await getDocs(collection(db, "users"));
    const allUsers = usersSnapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
    setSupervisors(allUsers.filter((u) => u.role === "supervisor"));
    setFarmers(allUsers.filter((u) => u.role === "farmer"));
  };

  // Create supervisor account from admin dashboard
  const handleCreateSupervisor = async (e) => {
    e.preventDefault();
    setSupError("");
    setSupSuccess("");

    if (supPhone.length !== 10) {
      setSupError("Please enter a valid 10 digit phone number!");
      return;
    }

    try {
      // Use secondary app to create account without logging out admin
      const secondaryAuthInstance = secondaryAuth ||
        getAuth(initializeApp(firebaseConfig, `Secondary-${Date.now()}`));

      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuthInstance,
        supEmail,
        supPassword
      );

      const newUser = userCredential.user;

      // Save supervisor in Firestore
      await setDoc(doc(db, "users", newUser.uid), {
        name: supName,
        email: supEmail,
        phone: supPhone,
        role: "supervisor",
        labourCount: 0,
        availableLabourCount: 0,
        createdAt: new Date(),
      });

      // Sign out from secondary app
      await signOut(secondaryAuthInstance);

      setSupSuccess(`Supervisor ${supName} created successfully! ✅`);
      setSupName("");
      setSupEmail("");
      setSupPhone("");
      setSupPassword("");

      // Reload supervisors list
      await loadAllData();

    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setSupError("This email is already registered!");
      } else {
        setSupError("Failed to create supervisor: " + err.message);
      }
    }
  };

  // Add labour under supervisor
  const handleAddLabour = async (e) => {
    e.preventDefault();
    setLabourError("");
    setLabourSuccess("");

    if (newLabourPhone.length !== 10) {
      setLabourError("Please enter a valid 10 digit phone number!");
      return;
    }

    if (!selectedSupervisorForLabour) {
      setLabourError("Please select a supervisor!");
      return;
    }

    try {
      const supervisor = supervisors.find(
        (s) => s.id === selectedSupervisorForLabour
      );

      await addDoc(collection(db, "labours"), {
        name: newLabourName,
        phone: newLabourPhone,
        supervisorId: selectedSupervisorForLabour,
        supervisorName: supervisor?.name || "",
        available: true,
        assignedBookingId: null,
        attendanceMarked: false,
        createdAt: new Date(),
      });

      // Update supervisor labour count
      const currentCount = labours.filter(
        (l) => l.supervisorId === selectedSupervisorForLabour
      ).length;

      await updateDoc(doc(db, "users", selectedSupervisorForLabour), {
        labourCount: currentCount + 1,
        availableLabourCount: currentCount + 1,
      });

      setLabourSuccess(`${newLabourName} added successfully! ✅`);
      setNewLabourName("");
      setNewLabourPhone("");

    } catch (err) {
      setLabourError("Failed to add labour: " + err.message);
    }
  };

  const hasMismatch = (booking) => {
    return (
      booking.supervisorConfirmed !== booking.farmerConfirmed &&
      (booking.supervisorConfirmed || booking.farmerConfirmed)
    );
  };

  const getMismatchBookings = () => bookings.filter((b) => hasMismatch(b));

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <p>Loading Admin Dashboard... ⏳</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.headerTitle}>🌾 KrishiSetu</h1>
          <p style={styles.headerSubtitle}>🔧 Admin Dashboard</p>
        </div>
        <button style={styles.logoutBtn} onClick={handleLogout}>
          Logout
        </button>
      </div>

      {/* Stats */}
      <div style={styles.statsContainer}>
        <div style={styles.statCard}>
          <span style={styles.statNumber}>{supervisors.length}</span>
          <span style={styles.statLabel}>👷 Supervisors</span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statNumber}>{farmers.length}</span>
          <span style={styles.statLabel}>👨‍🌾 Farmers</span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statNumber}>{labours.length}</span>
          <span style={styles.statLabel}>👥 Labours</span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statNumber}>{bookings.length}</span>
          <span style={styles.statLabel}>📋 Bookings</span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statNumber}>{getMismatchBookings().length}</span>
          <span style={styles.statLabel}>⚠️ Mismatches</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabContainer}>
        {["overview", "create", "labours", "bookings", "mismatch"].map((tab) => (
          <button
            key={tab}
            style={{
              ...styles.tabButton,
              backgroundColor: activeTab === tab ? "#2d6a4f" : "#e8f5e9",
              color: activeTab === tab ? "white" : "#2d6a4f",
            }}
            onClick={() => {
              setActiveTab(tab);
              setSelectedSupervisor(null);
            }}
          >
            {tab === "overview" && "📊 Overview"}
            {tab === "create" && "➕ Add Supervisor"}
            {tab === "labours" && "👥 Add Labour"}
            {tab === "bookings" && "📋 Bookings"}
            {tab === "mismatch" && "⚠️ Mismatches"}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>System Overview</h2>

          <h3 style={styles.sectionTitle}>👷 Supervisors</h3>
          {supervisors.length === 0 && (
            <p style={styles.emptyText}>No supervisors yet! Create one.</p>
          )}
          {supervisors.map((sup) => (
            <div
              key={sup.id}
              style={styles.listItem}
              onClick={() => {
                setSelectedSupervisor(sup);
                setActiveTab("supervisorDetail");
              }}
            >
              <div>
                <p style={styles.itemName}>{sup.name}</p>
                <p style={styles.itemDetail}>📧 {sup.email}</p>
                <p style={styles.itemDetail}>📞 {sup.phone}</p>
                <p style={styles.itemDetail}>
                  👥 Total Labour:{" "}
                  {labours.filter((l) => l.supervisorId === sup.id).length}
                </p>
                <p style={styles.itemDetail}>
                  ✅ Available:{" "}
                  {labours.filter(
                    (l) => l.supervisorId === sup.id && l.available
                  ).length}
                </p>
              </div>
              <span style={styles.viewBtn}>View →</span>
            </div>
          ))}

          <h3 style={styles.sectionTitle}>👨‍🌾 Registered Farmers</h3>
          {farmers.length === 0 && (
            <p style={styles.emptyText}>No farmers registered yet!</p>
          )}
          {farmers.map((farmer) => (
            <div key={farmer.id} style={styles.listItem}>
              <div>
                <p style={styles.itemName}>{farmer.name}</p>
                <p style={styles.itemDetail}>📧 {farmer.email}</p>
                <p style={styles.itemDetail}>📞 {farmer.phone}</p>
                <p style={styles.itemDetail}>📍 {farmer.village}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Supervisor Detail Tab */}
      {activeTab === "supervisorDetail" && selectedSupervisor && (
        <div style={styles.card}>
          <button
            style={styles.backBtn}
            onClick={() => {
              setSelectedSupervisor(null);
              setActiveTab("overview");
            }}
          >
            ← Back
          </button>

          <div style={styles.supervisorDetail}>
            <h3 style={styles.supervisorName}>
              👷 {selectedSupervisor.name}
            </h3>
            <p style={styles.itemDetail}>📧 {selectedSupervisor.email}</p>
            <p style={styles.itemDetail}>📞 {selectedSupervisor.phone}</p>
            <p style={styles.itemDetail}>
              👥 Total Labour:{" "}
              {labours.filter((l) => l.supervisorId === selectedSupervisor.id).length}
            </p>
            <p style={styles.itemDetail}>
              ✅ Available:{" "}
              {labours.filter(
                (l) => l.supervisorId === selectedSupervisor.id && l.available
              ).length}
            </p>
          </div>

          <h3 style={styles.sectionTitle}>👥 Labours</h3>
          {labours
            .filter((l) => l.supervisorId === selectedSupervisor.id)
            .map((labour) => (
              <div key={labour.id} style={styles.labourItem}>
                <div>
                  <p style={styles.labourName}>👤 {labour.name}</p>
                  <p style={styles.labourPhone}>📞 {labour.phone}</p>
                </div>
                <span
                  style={{
                    ...styles.availableBadge,
                    backgroundColor: labour.available ? "#4caf50" : "#ff9800",
                  }}
                >
                  {labour.available ? "✅ Available" : "⏳ Busy"}
                </span>
              </div>
            ))}

          <h3 style={styles.sectionTitle}>📋 Assignments</h3>
          {bookings
            .filter((b) => b.supervisorId === selectedSupervisor.id)
            .map((booking) => (
              <div key={booking.id} style={styles.bookingCard}>
                <div style={styles.bookingHeader}>
                  <span style={styles.farmerName}>
                    👨‍🌾 {booking.farmerName}
                  </span>
                  <span
                    style={{
                      ...styles.statusBadge,
                      backgroundColor:
                        booking.status === "completed" ? "#4caf50" : "#2196f3",
                    }}
                  >
                    {booking.status}
                  </span>
                </div>
                <p style={styles.bookingDetail}>📅 {booking.date}</p>
                <p style={styles.bookingDetail}>
                  👷 Labour Assigned: {booking.assignedLabour}
                </p>
                <p style={styles.bookingDetail}>📍 {booking.village}</p>
                <div style={styles.attendanceRow}>
                  <span
                    style={{
                      ...styles.attendanceBadge,
                      backgroundColor: booking.supervisorConfirmed
                        ? "#4caf50"
                        : "#ff9800",
                    }}
                  >
                    Supervisor: {booking.supervisorConfirmed ? "✅" : "⏳"}
                  </span>
                  <span
                    style={{
                      ...styles.attendanceBadge,
                      backgroundColor: booking.farmerConfirmed
                        ? "#4caf50"
                        : "#ff9800",
                    }}
                  >
                    Farmer: {booking.farmerConfirmed ? "✅" : "⏳"}
                  </span>
                </div>
                {hasMismatch(booking) && (
                  <p style={styles.mismatchWarning}>⚠️ Attendance Mismatch!</p>
                )}
              </div>
            ))}
        </div>
      )}

      {/* Create Supervisor Tab */}
      {activeTab === "create" && (
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>➕ Create New Supervisor</h2>

          {supError && <p style={styles.error}>{supError}</p>}
          {supSuccess && <p style={styles.success}>{supSuccess}</p>}

          <form onSubmit={handleCreateSupervisor}>
            <label style={styles.label}>Full Name</label>
            <input
              style={styles.input}
              type="text"
              placeholder="Supervisor's full name"
              value={supName}
              onChange={(e) => setSupName(e.target.value)}
              required
            />

            <label style={styles.label}>Email Address</label>
            <input
              style={styles.input}
              type="email"
              placeholder="Supervisor's email"
              value={supEmail}
              onChange={(e) => setSupEmail(e.target.value)}
              required
            />

            <label style={styles.label}>Phone Number</label>
            <input
              style={styles.input}
              type="tel"
              placeholder="10 digit phone number"
              value={supPhone}
              onChange={(e) => setSupPhone(e.target.value)}
              required
            />

            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              type="password"
              placeholder="Set password for supervisor"
              value={supPassword}
              onChange={(e) => setSupPassword(e.target.value)}
              required
            />

            <button style={styles.button} type="submit">
              ➕ Create Supervisor Account
            </button>
          </form>

          <h3 style={styles.sectionTitle}>Existing Supervisors</h3>
          {supervisors.map((sup) => (
            <div key={sup.id} style={styles.listItem}>
              <div>
                <p style={styles.itemName}>{sup.name}</p>
                <p style={styles.itemDetail}>📧 {sup.email}</p>
                <p style={styles.itemDetail}>📞 {sup.phone}</p>
              </div>
              <span
                style={{
                  ...styles.availableBadge,
                  backgroundColor: "#2d6a4f",
                }}
              >
                Active
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Add Labour Tab */}
      {activeTab === "labours" && (
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>👥 Add Labour</h2>

          {labourError && <p style={styles.error}>{labourError}</p>}
          {labourSuccess && <p style={styles.success}>{labourSuccess}</p>}

          <form onSubmit={handleAddLabour}>
            <label style={styles.label}>Select Supervisor</label>
            <select
              style={styles.input}
              value={selectedSupervisorForLabour}
              onChange={(e) => setSelectedSupervisorForLabour(e.target.value)}
              required
            >
              <option value="">-- Select Supervisor --</option>
              {supervisors.map((sup) => (
                <option key={sup.id} value={sup.id}>
                  {sup.name}
                </option>
              ))}
            </select>

            <label style={styles.label}>Labour Name</label>
            <input
              style={styles.input}
              type="text"
              placeholder="Labour's full name"
              value={newLabourName}
              onChange={(e) => setNewLabourName(e.target.value)}
              required
            />

            <label style={styles.label}>Labour Phone</label>
            <input
              style={styles.input}
              type="tel"
              placeholder="10 digit phone number"
              value={newLabourPhone}
              onChange={(e) => setNewLabourPhone(e.target.value)}
              required
            />

            <button style={styles.button} type="submit">
              ➕ Add Labour
            </button>
          </form>

          {/* Show labours by supervisor */}
          <h3 style={styles.sectionTitle}>All Labours by Supervisor</h3>
          {supervisors.map((sup) => (
            <div key={sup.id} style={styles.supervisorLabourSection}>
              <p style={styles.supervisorLabourTitle}>
                👷 {sup.name} —{" "}
                {labours.filter((l) => l.supervisorId === sup.id).length} labours
              </p>
              {labours
                .filter((l) => l.supervisorId === sup.id)
                .map((labour) => (
                  <div key={labour.id} style={styles.labourItem}>
                    <div>
                      <p style={styles.labourName}>👤 {labour.name}</p>
                      <p style={styles.labourPhone}>📞 {labour.phone}</p>
                    </div>
                    <span
                      style={{
                        ...styles.availableBadge,
                        backgroundColor: labour.available ? "#4caf50" : "#ff9800",
                      }}
                    >
                      {labour.available ? "✅ Available" : "⏳ Busy"}
                    </span>
                  </div>
                ))}
              {labours.filter((l) => l.supervisorId === sup.id).length === 0 && (
                <p style={styles.emptyText}>No labours added yet!</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Bookings Tab */}
      {activeTab === "bookings" && (
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>📋 All Bookings</h2>
          {bookings.length === 0 ? (
            <p style={styles.emptyText}>No bookings yet!</p>
          ) : (
            bookings.map((booking) => (
              <div key={booking.id} style={styles.bookingCard}>
                <div style={styles.bookingHeader}>
                  <span style={styles.farmerName}>
                    👨‍🌾 {booking.farmerName}
                  </span>
                  <span
                    style={{
                      ...styles.statusBadge,
                      backgroundColor:
                        booking.status === "pending"
                          ? "#ff9800"
                          : booking.status === "assigned"
                          ? "#2196f3"
                          : "#4caf50",
                    }}
                  >
                    {booking.status}
                  </span>
                </div>
                <p style={styles.bookingDetail}>📅 {booking.date}</p>
                <p style={styles.bookingDetail}>
                  👷 Labour: {booking.labourCount}
                </p>
                <p style={styles.bookingDetail}>📍 {booking.village}</p>
                {booking.supervisorName && (
                  <p style={styles.bookingDetail}>
                    👷 Supervisor: {booking.supervisorName}
                  </p>
                )}
                {booking.assignedLabourNames && (
                  <p style={styles.bookingDetail}>
                    👥 Assigned: {booking.assignedLabourNames.join(", ")}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Mismatch Tab */}
      {activeTab === "mismatch" && (
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>⚠️ Attendance Mismatches</h2>
          <p style={styles.hint}>
            Bookings where supervisor and farmer confirmations don't match!
          </p>
          {getMismatchBookings().length === 0 ? (
            <p style={styles.emptyText}>No mismatches! All good ✅</p>
          ) : (
            getMismatchBookings().map((booking) => (
              <div
                key={booking.id}
                style={{
                  ...styles.bookingCard,
                  borderColor: "#ff5722",
                  borderWidth: "2px",
                }}
              >
                <p style={styles.mismatchWarning}>⚠️ ATTENDANCE MISMATCH</p>
                <p style={styles.farmerName}>👨‍🌾 {booking.farmerName}</p>
                <p style={styles.bookingDetail}>📅 {booking.date}</p>
                <p style={styles.bookingDetail}>
                  👷 Supervisor: {booking.supervisorName}
                </p>
                {booking.assignedLabourNames && (
                  <p style={styles.bookingDetail}>
                    👥 Assigned Labour: {booking.assignedLabourNames.join(", ")}
                  </p>
                )}
                <div style={styles.attendanceRow}>
                  <span
                    style={{
                      ...styles.attendanceBadge,
                      backgroundColor: booking.supervisorConfirmed
                        ? "#4caf50"
                        : "#ff5722",
                    }}
                  >
                    Supervisor:{" "}
                    {booking.supervisorConfirmed ? "✅ Confirmed" : "❌ Not Confirmed"}
                  </span>
                  <span
                    style={{
                      ...styles.attendanceBadge,
                      backgroundColor: booking.farmerConfirmed
                        ? "#4caf50"
                        : "#ff5722",
                    }}
                  >
                    Farmer:{" "}
                    {booking.farmerConfirmed ? "✅ Confirmed" : "❌ Not Confirmed"}
                  </span>
                </div>
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
  loadingContainer: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" },
  header: { backgroundColor: "#2d6a4f", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "white" },
  headerTitle: { margin: 0, fontSize: "22px" },
  headerSubtitle: { margin: 0, fontSize: "14px", opacity: 0.9 },
  logoutBtn: { backgroundColor: "transparent", border: "2px solid white", color: "white", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "14px" },
  statsContainer: { display: "flex", gap: "12px", padding: "16px 24px", overflowX: "auto" },
  statCard: { backgroundColor: "#2d6a4f", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", alignItems: "center", minWidth: "90px", color: "white" },
  statNumber: { fontSize: "28px", fontWeight: "bold" },
  statLabel: { fontSize: "11px", opacity: 0.9, textAlign: "center" },
  tabContainer: { display: "flex", gap: "8px", padding: "0 24px", flexWrap: "wrap" },
  tabButton: { padding: "8px 14px", border: "2px solid #2d6a4f", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "13px", marginBottom: "8px" },
  card: { backgroundColor: "white", margin: "16px 24px", padding: "24px", borderRadius: "12px", boxShadow: "0 2px 10px rgba(0,0,0,0.08)" },
  cardTitle: { color: "#2d6a4f", marginTop: 0, marginBottom: "20px" },
  sectionTitle: { color: "#333", borderBottom: "2px solid #e8f5e9", paddingBottom: "8px", marginTop: "24px" },
  hint: { color: "#888", fontSize: "13px", marginBottom: "16px" },
  label: { display: "block", marginBottom: "6px", fontWeight: "bold", color: "#333", fontSize: "14px" },
  input: { width: "100%", padding: "12px", marginBottom: "16px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "16px", boxSizing: "border-box" },
  button: { width: "100%", padding: "12px", backgroundColor: "#2d6a4f", color: "white", border: "none", borderRadius: "8px", fontSize: "16px", cursor: "pointer", fontWeight: "bold", marginBottom: "8px" },
  error: { color: "red", marginBottom: "12px", fontSize: "14px" },
  success: { color: "#2d6a4f", marginBottom: "12px", fontSize: "14px", fontWeight: "bold" },
  listItem: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", border: "1px solid #ddd", borderRadius: "8px", marginBottom: "8px", cursor: "pointer" },
  itemName: { fontWeight: "bold", color: "#333", margin: "0 0 4px 0", fontSize: "15px" },
  itemDetail: { color: "#666", margin: "2px 0", fontSize: "13px" },
  viewBtn: { color: "#2d6a4f", fontWeight: "bold", fontSize: "14px" },
  backBtn: { marginBottom: "16px", padding: "8px 16px", backgroundColor: "#e8f5e9", color: "#2d6a4f", border: "2px solid #2d6a4f", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" },
  supervisorDetail: { backgroundColor: "#e8f5e9", padding: "16px", borderRadius: "8px", marginBottom: "16px" },
  supervisorName: { color: "#2d6a4f", margin: "0 0 8px 0" },
  bookingCard: { border: "1px solid #ddd", borderRadius: "8px", padding: "16px", marginBottom: "12px" },
  bookingHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" },
  farmerName: { fontWeight: "bold", color: "#333", fontSize: "15px" },
  statusBadge: { color: "white", padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "bold", textTransform: "uppercase" },
  bookingDetail: { margin: "4px 0", color: "#555", fontSize: "14px" },
  attendanceRow: { display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" },
  attendanceBadge: { color: "white", padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "bold" },
  mismatchWarning: { color: "#ff5722", fontWeight: "bold", margin: "8px 0" },
  emptyText: { textAlign: "center", color: "#888", padding: "20px 0" },
  supervisorLabourSection: { border: "1px solid #ddd", borderRadius: "8px", padding: "16px", marginBottom: "16px" },
  supervisorLabourTitle: { fontWeight: "bold", color: "#2d6a4f", fontSize: "15px", margin: "0 0 12px 0" },
  labourItem: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", backgroundColor: "#f9f9f9", borderRadius: "8px", marginBottom: "8px" },
  labourName: { fontWeight: "bold", color: "#333", margin: "0 0 4px 0", fontSize: "14px" },
  labourPhone: { color: "#666", margin: 0, fontSize: "13px" },
  availableBadge: { color: "white", padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "bold" },
};

export default AdminDashboard;