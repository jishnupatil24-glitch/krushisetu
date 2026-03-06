import React, { useState } from "react";
import { auth, db } from "../../firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

function FarmerRegister() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [village, setVillage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Basic validation
    if (phone.length !== 10) {
      setError("Please enter a valid 10 digit phone number!");
      setLoading(false);
      return;
    }

    try {
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      // Save farmer details in Firestore
      await setDoc(doc(db, "users", user.uid), {
        name: name,
        email: email,
        phone: phone,
        village: village,
        role: "farmer",
        createdAt: new Date(),
      });

      // Registration successful - go to login
      alert("Registration successful! Please login now.");
      navigate("/login");

    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setError("This email is already registered! Please login.");
      } else if (err.code === "auth/weak-password") {
        setError("Password should be at least 6 characters!");
      } else {
        setError("Something went wrong. Please try again.");
      }
    }

    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Header */}
        <h1 style={styles.title}>🌾 KrishiSetu</h1>
        <h2 style={styles.heading}>Farmer Registration</h2>
        <p style={styles.subtitle}>Create your farmer account</p>

        {/* Error message */}
        {error && <p style={styles.error}>{error}</p>}

        {/* Registration Form */}
        <form onSubmit={handleRegister}>
          <input
            style={styles.input}
            type="text"
            placeholder="Your full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            style={styles.input}
            type="email"
            placeholder="Your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Create a password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <input
            style={styles.input}
            type="tel"
            placeholder="Your phone number (10 digits)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <input
            style={styles.input}
            type="text"
            placeholder="Your village/town name"
            value={village}
            onChange={(e) => setVillage(e.target.value)}
            required
          />

          <button
            style={styles.button}
            type="submit"
            disabled={loading}
          >
            {loading ? "Registering..." : "Register as Farmer"}
          </button>
        </form>

        {/* Login link */}
        <p style={styles.loginText}>
          Already have an account?{" "}
          <span
            style={styles.link}
            onClick={() => navigate("/login")}
          >
            Login here
          </span>
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#f0f4f0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
  },
  card: {
    backgroundColor: "white",
    padding: "40px",
    borderRadius: "12px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
    width: "100%",
    maxWidth: "420px",
    textAlign: "center",
  },
  title: {
    color: "#2d6a4f",
    fontSize: "28px",
    marginBottom: "4px",
  },
  heading: {
    color: "#333",
    fontSize: "20px",
    marginBottom: "4px",
  },
  subtitle: {
    color: "#666",
    marginBottom: "24px",
    fontSize: "14px",
  },
  input: {
    width: "100%",
    padding: "12px",
    marginBottom: "16px",
    borderRadius: "8px",
    border: "1px solid #ddd",
    fontSize: "16px",
    boxSizing: "border-box",
  },
  button: {
    width: "100%",
    padding: "12px",
    backgroundColor: "#2d6a4f",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "16px",
    cursor: "pointer",
  },
  error: {
    color: "red",
    marginBottom: "16px",
    fontSize: "14px",
  },
  loginText: {
    marginTop: "20px",
    color: "#666",
  },
  link: {
    color: "#2d6a4f",
    cursor: "pointer",
    fontWeight: "bold",
  },
};

export default FarmerRegister;