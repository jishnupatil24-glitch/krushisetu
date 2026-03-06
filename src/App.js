// Import React
import FarmerRegister from "./pages/farmer/FarmerRegister";
import FarmerDashboard from "./pages/farmer/FarmerDashboard";
import SupervisorDashboard from "./pages/supervisor/SupervisorDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";
import React from "react";

// Import routing tools
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// Import pages (we will create these one by one)
import Login from "./pages/Login";

// Main App component - controls all page routing
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/register" element={<FarmerRegister />} />
        <Route path="/farmer/dashboard" element={<FarmerDashboard />} />
        <Route path="/supervisor/dashboard" element={<SupervisorDashboard />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        {/* Login page - first page users see */}
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </Router>
  );
}

export default App;