import React, { useEffect, useState } from "react";
import {
  fetchTopJobs,
  fetchJobClicks,
  fetchSavedTrend,
  fetchLowTractionJobs,
  fetchGeoAnalytics,
  fetchFunnelAnalytics
} from "../api/analyticsApi";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts";

export default function RecruiterDashboardPage() {
  const [topJobs, setTopJobs] = useState([]);
  const [jobClicks, setJobClicks] = useState([]);
  const [savedTrend, setSavedTrend] = useState([]);
  const [lowTractionJobs, setLowTractionJobs] = useState([]);
  const [geoData, setGeoData] = useState([]);
  const [funnelData, setFunnelData] = useState([]);

  useEffect(() => {
  fetchTopJobs().then(data => setTopJobs(Array.isArray(data) ? data : []));
  fetchJobClicks().then(data => setJobClicks(Array.isArray(data) ? data : []));
  fetchSavedTrend().then(data => setSavedTrend(Array.isArray(data) ? data : []));
  fetchLowTractionJobs().then(data => setLowTractionJobs(Array.isArray(data) ? data : []));
  fetchGeoAnalytics().then(data => setGeoData(Array.isArray(data) ? data : []));
  fetchFunnelAnalytics().then(data => setFunnelData(Array.isArray(data) ? data : []));
}, []);

  const pieColors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

  return (
    <div style={{ padding: "30px", maxWidth: "900px", margin: "0 auto" }}>
      <h2 style={{ textAlign: "center", marginBottom: "30px" }}>
        Recruiter Dashboard
      </h2>

      <div style={{ marginBottom: "50px" }}>
        <h3>Top Jobs by Applications</h3>
        <BarChart width={700} height={300} data={topJobs}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="job_id" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="applications" fill="#3b82f6" />
        </BarChart>
      </div>

      <div style={{ marginBottom: "50px" }}>
        <h3>Clicks per Job</h3>
        <BarChart width={700} height={300} data={jobClicks}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="job_id" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="clicks" fill="#10b981" />
        </BarChart>
      </div>

      <div style={{ marginBottom: "50px" }}>
        <h3>Saved Jobs per Day</h3>
        <LineChart width={700} height={300} data={savedTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="saved_count" stroke="#ef4444" strokeWidth={2} />
        </LineChart>
      </div>

      <div style={{ marginBottom: "50px" }}>
        <h3>Low-Traction Jobs</h3>
        <BarChart width={700} height={300} data={lowTractionJobs}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="job_id" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="applications" fill="#f59e0b" />
        </BarChart>
      </div>

      <div style={{ marginBottom: "50px" }}>
        <h3>Application Funnel</h3>
        <BarChart width={700} height={300} data={funnelData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="stage" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="count" fill="#8b5cf6" />
        </BarChart>
      </div>

      <div style={{ marginBottom: "50px" }}>
        <h3>City-wise Applications</h3>
        <PieChart width={700} height={320}>
          <Pie
            data={geoData}
            dataKey="applications"
            nameKey="city"
            cx="50%"
            cy="50%"
            outerRadius={100}
            label
          >
            {geoData.map((entry, index) => (
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