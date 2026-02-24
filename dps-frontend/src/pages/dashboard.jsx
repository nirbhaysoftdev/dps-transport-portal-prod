// src/pages/dashboard.jsx
export default function Dashboard() {
  const kpiData = [
    { title: "Pending Invoices", value: 120, type: "neutral" },
    { title: "Delivered Vehicles", value: 75, type: "neutral" },
    { title: "Total Profit", value: "$34,500", type: "highlight" },
    { title: "Employees Present", value: 15, type: "neutral" },
  ];

  return (
    <section className="page-content">
      <div className="page-header-box">
        <div>
          <h1>Dashboard</h1>
          <p>Plan, prioritize, and accomplish your tasks with ease.</p>
        </div>
      </div>

      <div className="kpi-grid">
        {kpiData.map((kpi, index) => (
          <div
            key={index}
            className={`kpi-card ${kpi.type === "highlight" ? "highlight" : ""}`}
          >
            <div className="kpi-header">
              <span>{kpi.title}</span>
              <div className="arrow">↑</div>
            </div>
            <h2>{kpi.value}</h2>
            <p className={kpi.type === "highlight" ? "" : kpi.type}>{kpi.type}</p>
          </div>
        ))}
      </div>

      <div className="charts-section">
        {/* <div className="chart-card">
          <h3>Expense vs Income</h3>
          <p>Chart will go here</p>
        </div>
        <div className="chart-card">
          <h3>Vehicle Status Overview</h3>
          <p>Chart will go here</p>
        </div> */}
      </div>
    </section>
  );
}
