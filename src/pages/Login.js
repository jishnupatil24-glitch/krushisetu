import React, { useState } from "react";
import { auth, db } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import { Leaf, Mail, Lock, ChevronRight, Sprout, Users, ShieldCheck } from "lucide-react";

const roles = [
  {
    id: "farmer",
    label: "Farmer",
    icon: Sprout,
    description: "Request & manage farm labour",
    color: "#4ade80",
    bg: "rgba(74,222,128,0.08)",
    border: "rgba(74,222,128,0.3)",
  },
  {
    id: "supervisor",
    label: "Supervisor",
    icon: Users,
    description: "Manage labour groups",
    color: "#60a5fa",
    bg: "rgba(96,165,250,0.08)",
    border: "rgba(96,165,250,0.3)",
  },
  {
    id: "admin",
    label: "Admin",
    icon: ShieldCheck,
    description: "Full system control",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.3)",
  },
];

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("farmer");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const selectedRole = roles.find((r) => r.id === role);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const userDoc = await getDoc(doc(db, "users", user.uid));

      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.role !== role) {
          toast.error(`You are not registered as a ${role}!`);
          setLoading(false);
          return;
        }
        toast.success(`Welcome back! 🌾`);
        setTimeout(() => {
          if (role === "farmer") navigate("/farmer/dashboard");
          else if (role === "supervisor") navigate("/supervisor/dashboard");
          else if (role === "admin") navigate("/admin/dashboard");
        }, 800);
      } else {
        toast.error("User not found! Please register.");
      }
    } catch (err) {
      toast.error("Invalid email or password!");
    }
    setLoading(false);
  };

  return (
    <div style={styles.root}>
      <Toaster position="top-center" />

      {/* Animated background blobs */}
      <div style={styles.blob1} />
      <div style={styles.blob2} />
      <div style={styles.blob3} />

      {/* Grid overlay */}
      <div style={styles.grid} />

      <div style={styles.wrapper}>
        {/* Left Panel */}
        <motion.div
          style={styles.leftPanel}
          initial={{ opacity: 0, x: -60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          {/* Logo */}
          <div style={styles.logo}>
            <div style={styles.logoIcon}>
              <Leaf size={28} color="#4ade80" />
            </div>
            <span style={styles.logoText}>KrishiSetu</span>
          </div>

          <motion.h1
            style={styles.heroTitle}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            Connecting
            <br />
            <span style={styles.heroAccent}>Farmers</span>
            <br />
            with Labour
          </motion.h1>

          <motion.p
            style={styles.heroSubtitle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            A smart platform to manage agricultural
            labour efficiently across villages.
          </motion.p>

          {/* Stats */}
          <motion.div
            style={styles.statsRow}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            {[
              { value: "500+", label: "Farmers" },
              { value: "50+", label: "Supervisors" },
              { value: "2000+", label: "Labourers" },
            ].map((stat) => (
              <div key={stat.label} style={styles.statItem}>
                <span style={styles.statValue}>{stat.value}</span>
                <span style={styles.statLabel}>{stat.label}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Right Panel - Login Form */}
        <motion.div
          style={styles.rightPanel}
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <div style={styles.formCard}>
            {/* Form Header */}
            <div style={styles.formHeader}>
              <h2 style={styles.formTitle}>Welcome back</h2>
              <p style={styles.formSubtitle}>Sign in to your account</p>
            </div>

            {/* Role Selector */}
            <div style={styles.roleContainer}>
              {roles.map((r) => {
                const Icon = r.icon;
                const isSelected = role === r.id;
                return (
                  <motion.button
                    key={r.id}
                    style={{
                      ...styles.roleBtn,
                      backgroundColor: isSelected ? r.bg : "transparent",
                      border: `1.5px solid ${isSelected ? r.border : "rgba(255,255,255,0.08)"}`,
                    }}
                    onClick={() => setRole(r.id)}
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Icon
                      size={18}
                      color={isSelected ? r.color : "#666"}
                    />
                    <span
                      style={{
                        ...styles.roleBtnLabel,
                        color: isSelected ? r.color : "#888",
                      }}
                    >
                      {r.label}
                    </span>
                    {isSelected && (
                      <motion.div
                        style={{
                          ...styles.roleSelectedDot,
                          backgroundColor: r.color,
                        }}
                        layoutId="selectedDot"
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Role description */}
            <AnimatePresence mode="wait">
              <motion.p
                key={role}
                style={{
                  ...styles.roleDescription,
                  color: selectedRole.color,
                }}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2 }}
              >
                {selectedRole.description}
              </motion.p>
            </AnimatePresence>

            {/* Form */}
            <form onSubmit={handleLogin}>
              {/* Email */}
              <div style={styles.inputGroup}>
                <div style={styles.inputIcon}>
                  <Mail size={16} color="#555" />
                </div>
                <input
                  style={styles.input}
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {/* Password */}
              <div style={styles.inputGroup}>
                <div style={styles.inputIcon}>
                  <Lock size={16} color="#555" />
                </div>
                <input
                  style={styles.input}
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {/* Submit */}
              <motion.button
                style={{
                  ...styles.submitBtn,
                  background: `linear-gradient(135deg, ${selectedRole.color}, ${selectedRole.color}aa)`,
                }}
                type="submit"
                disabled={loading}
                whileHover={{ scale: 1.02, opacity: 0.95 }}
                whileTap={{ scale: 0.98 }}
              >
                {loading ? (
                  <motion.div
                    style={styles.spinner}
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                  />
                ) : (
                  <>
                    <span>Sign in as {selectedRole.label}</span>
                    <ChevronRight size={18} />
                  </>
                )}
              </motion.button>
            </form>

            {/* Divider */}
            <div style={styles.divider}>
              <div style={styles.dividerLine} />
              <span style={styles.dividerText}>or</span>
              <div style={styles.dividerLine} />
            </div>

            {/* Register Link */}
            {role === "farmer" && (
              <motion.button
                style={styles.registerBtn}
                onClick={() => navigate("/register")}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                New farmer? Create account
              </motion.button>
            )}

            {role === "supervisor" && (
              <p style={styles.infoText}>
                👷 Supervisor accounts are created by Admin
              </p>
            )}

            {role === "admin" && (
              <p style={styles.infoText}>
                🔐 Admin access is restricted
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

const styles = {
  root: {
    minHeight: "100vh",
    backgroundColor: "#080f0a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
    fontFamily: "'Georgia', serif",
  },
  blob1: {
    position: "absolute",
    width: "600px",
    height: "600px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(74,222,128,0.12) 0%, transparent 70%)",
    top: "-200px",
    left: "-200px",
    pointerEvents: "none",
  },
  blob2: {
    position: "absolute",
    width: "500px",
    height: "500px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(96,165,250,0.08) 0%, transparent 70%)",
    bottom: "-150px",
    right: "-100px",
    pointerEvents: "none",
  },
  blob3: {
    position: "absolute",
    width: "300px",
    height: "300px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
  },
  grid: {
    position: "absolute",
    inset: 0,
    backgroundImage: `
      linear-gradient(rgba(74,222,128,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(74,222,128,0.03) 1px, transparent 1px)
    `,
    backgroundSize: "60px 60px",
    pointerEvents: "none",
  },
  wrapper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "80px",
    padding: "40px 24px",
    width: "100%",
    maxWidth: "1100px",
    position: "relative",
    zIndex: 1,
    flexWrap: "wrap",
  },
  leftPanel: {
    flex: 1,
    minWidth: "280px",
    maxWidth: "420px",
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "48px",
  },
  logoIcon: {
    width: "44px",
    height: "44px",
    borderRadius: "12px",
    backgroundColor: "rgba(74,222,128,0.1)",
    border: "1px solid rgba(74,222,128,0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontSize: "22px",
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: "-0.5px",
  },
  heroTitle: {
    fontSize: "54px",
    fontWeight: "800",
    color: "#ffffff",
    lineHeight: 1.1,
    margin: "0 0 20px 0",
    letterSpacing: "-2px",
  },
  heroAccent: {
    color: "#4ade80",
    fontStyle: "italic",
  },
  heroSubtitle: {
    fontSize: "16px",
    color: "#888",
    lineHeight: 1.7,
    margin: "0 0 48px 0",
    maxWidth: "320px",
  },
  statsRow: {
    display: "flex",
    gap: "32px",
  },
  statItem: {
    display: "flex",
    flexDirection: "column",
  },
  statValue: {
    fontSize: "24px",
    fontWeight: "800",
    color: "#4ade80",
    letterSpacing: "-1px",
  },
  statLabel: {
    fontSize: "12px",
    color: "#666",
    marginTop: "2px",
    textTransform: "uppercase",
    letterSpacing: "1px",
  },
  rightPanel: {
    flex: 1,
    minWidth: "320px",
    maxWidth: "420px",
  },
  formCard: {
    backgroundColor: "#0d1a11",
    border: "1px solid rgba(74,222,128,0.1)",
    borderRadius: "24px",
    padding: "36px",
    boxShadow: "0 25px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(74,222,128,0.05)",
  },
  formHeader: {
    marginBottom: "28px",
  },
  formTitle: {
    fontSize: "26px",
    fontWeight: "700",
    color: "#ffffff",
    margin: "0 0 6px 0",
    letterSpacing: "-0.5px",
  },
  formSubtitle: {
    fontSize: "14px",
    color: "#666",
    margin: 0,
  },
  roleContainer: {
    display: "flex",
    gap: "8px",
    marginBottom: "12px",
  },
  roleBtn: {
    flex: 1,
    padding: "10px 6px",
    borderRadius: "10px",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    position: "relative",
    transition: "all 0.2s",
  },
  roleBtnLabel: {
    fontSize: "11px",
    fontWeight: "600",
    letterSpacing: "0.5px",
  },
  roleSelectedDot: {
    position: "absolute",
    bottom: "6px",
    width: "4px",
    height: "4px",
    borderRadius: "50%",
  },
  roleDescription: {
    fontSize: "12px",
    margin: "0 0 20px 0",
    textAlign: "center",
    fontStyle: "italic",
  },
  inputGroup: {
    position: "relative",
    marginBottom: "14px",
  },
  inputIcon: {
    position: "absolute",
    left: "14px",
    top: "50%",
    transform: "translateY(-50%)",
    pointerEvents: "none",
  },
  input: {
    width: "100%",
    padding: "14px 14px 14px 42px",
    backgroundColor: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "12px",
    fontSize: "14px",
    color: "#ffffff",
    boxSizing: "border-box",
    outline: "none",
    transition: "border-color 0.2s",
  },
  submitBtn: {
    width: "100%",
    padding: "14px",
    border: "none",
    borderRadius: "12px",
    fontSize: "15px",
    fontWeight: "700",
    color: "#080f0a",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    marginTop: "8px",
    letterSpacing: "-0.3px",
  },
  spinner: {
    width: "20px",
    height: "20px",
    border: "2px solid rgba(0,0,0,0.3)",
    borderTop: "2px solid #080f0a",
    borderRadius: "50%",
  },
  divider: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    margin: "20px 0",
  },
  dividerLine: {
    flex: 1,
    height: "1px",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  dividerText: {
    fontSize: "12px",
    color: "#444",
  },
  registerBtn: {
    width: "100%",
    padding: "13px",
    backgroundColor: "transparent",
    border: "1px solid rgba(74,222,128,0.2)",
    borderRadius: "12px",
    fontSize: "14px",
    color: "#4ade80",
    cursor: "pointer",
    fontWeight: "600",
    letterSpacing: "-0.2px",
  },
  infoText: {
    textAlign: "center",
    color: "#555",
    fontSize: "13px",
    margin: 0,
  },
};

export default Login;