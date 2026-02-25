import { useEffect, useState } from "react";
import "../assets/css/shipments.css";
import BulkUploadModal from "../components/shipments/BulkUploadModal";
import ShipmentView from "../components/shipments/ShipmentView";

const TABS = ["All", "Delivered", "Running", "Dispatched", "Accident"];

export default function Shipments() {
  const [activeTab, setActiveTab]     = useState("All");
  const [data, setData]               = useState([]);
  const [showBulk, setShowBulk]       = useState(false);
  const [viewingId, setViewingId]     = useState(null); // shipment_id being viewed

  useEffect(() => { fetchData(); }, [activeTab]);

  const fetchData = async () => {
    const baseUrl = `${import.meta.env.VITE_API_URL}/api/shipments`;
    const url = activeTab === "All" ? baseUrl : `${baseUrl}?status=${activeTab}`;
    try {
      const res  = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json.data || []);
    } catch (err) {
      console.error("Fetch error:", err);
      setData([]);
    }
  };

  /* ── Show ShipmentView instead of listing ── */
  if (viewingId) {
    return (
      <ShipmentView
        shipmentId={viewingId}
        onBack={() => setViewingId(null)}
      />
    );
  }

  return (
    <div className="shipments-wrapper">
      <div className="flex justify-between items-center mb-4">
        <h2 className="page-title">Shipments</h2>
        <div className="buttons">
          <button className="view-btn" onClick={() => setShowBulk(true)}>Bulk Upload</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {TABS.map(tab => (
          <button key={tab} className={`tab ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="table-card">
        {data.length === 0 ? (
          <p style={{ padding: 24, color: "#9ca3af" }}>No shipments available.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Shipment No</th>
                <th>Material No</th>
                <th>Route</th>
                <th>Dealer</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => (
                <tr key={row.shipment_id}>
                  <td>{row.shipment_no}</td>
                  <td>{row.material_no || "—"}</td>
                  <td>{row.dispatch_plant || "—"} → {row.delivery_location || "—"}</td>
                  <td>{row.dealer_name || "—"}</td>
                  <td>
                    <span className={`status ${row.current_status?.toLowerCase() || ""}`}>
                      {row.current_status || "—"}
                    </span>
                  </td>
                  <td>
                    <button className="view-btn" onClick={() => setViewingId(row.shipment_id)}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showBulk && (
        <BulkUploadModal onClose={() => setShowBulk(false)} onSuccess={fetchData} />
      )}
    </div>
  );
}