import React, { useEffect, useState } from "react";
import {
  fetchProfileViews,
  fetchStatusBreakdown
} from "../api/analyticsApi";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

export default function MemberDashboardPage() {
  const [profileViews, setProfileViews] = useState([]);
  const [statusBreakdown, setStatusBreakdown] = useState([]);

  useEffect(() => {
    fetchProfileViews("m_8f6f908dfa7c").then((data) => {
      console.log("profileViews", data);
      setProfileViews(Array.isArray(data) ? data : []);
    });

    fetchStatusBreakdown().then((data) => {
      console.log("statusBreakdown", data);
      const formatted = Array.isArray(data)
        ? data.map((item) => ({
            name: item.status,
            value: item.count
          }))
        : [];
      setStatusBreakdown(formatted);
    });
  }, []);

  const pieColors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

  return (
    <div style={{ padding: "30px", maxWidth: "900px", margin: "0 auto" }}>
      <h2 style={{ textAlign: "center", marginBottom: "30px" }}>
        Member Dashboard
      </h2>

      <div style={{ marginBottom: "50px" }}>
        <h3>Profile Views per Day</h3>
        {profileViews.length === 0 && <p>No profile views data yet.</p>}
        <LineChart width={700} height={300} data={profileViews}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="views" stroke="#3b82f6" />
        </LineChart>
      </div>

      <div style={{ marginBottom: "50px" }}>
        <h3>Application Status Breakdown</h3>
        {statusBreakdown.length === 0 && <p>No status data yet.</p>}
        <PieChart width={700} height={320}>
          <Pie
            data={statusBreakdown}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={100}
            label
          >
            {statusBreakdown.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </div>
    </div>
  );
}