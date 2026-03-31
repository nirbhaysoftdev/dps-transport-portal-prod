import { useEffect, useState } from "react";
import "../assets/css/shipments.css";
import "../assets/css/Shipments.fund.css";
import BulkUploadModal from "../components/shipments/BulkUploadModal";
import ShipmentView from "../components/shipments/ShipmentView";
import { apiFetch } from "../utils/apiClient";
import { useShipmentFilters } from "../components/shared/ShipmentFilters";

const TABS = ["All", "Hold", "Delivered", "Running", "Dispatched", "Accident"];

export default function Shipments() {
  const [activeTab, setActiveTab] = useState("All");
  const [data, setData]           = useState([]);
  const [showBulk, setShowBulk]   = useState(false);
  const [viewingId, setViewingId] = useState(null);

  useEffect(() => { fetchData(); }, [activeTab]);

  const fetchData = async () => {
    const path = activeTab === "All"  ? "/api/shipments"
               : activeTab === "Hold" ? "/api/shipments?approval=HOLD"
               : `/api/shipments?status=${activeTab}`;
    try {
      const res  = await apiFetch(path);
      if (!res || !res.ok) {
        console.error("Fetch error:", res?.status);
        setData([]);
        return;
      }
      const json = await res.json();
      setData(json.data || []);
    } catch (err) {
      console.error("Fetch error:", err);
      setData([]);
    }
  };

  // Use shared filters hook
  const { filterBar, sorted, SortTh } = useShipmentFilters(data, {
    searchFields: ["shipment_no", "billing_doc_number", "chassis_no", "dealer_name", "material_no"],
    defaultSort: { col: "shipment_date", dir: "desc" },
  });

  /* ── Show ShipmentView instead of listing ── */
  if (viewingId) {
    return (
      <ShipmentView
        shipmentId={viewingId}
        onBack={() => { setViewingId(null); fetchData(); }}
      />
    );
  }

  const holdCount = data.filter(r => r.approval_status === "HOLD").length;

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
            {tab === "Hold" && holdCount > 0 && activeTab !== "Hold" && (
              <span className="tab-badge">{holdCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      {filterBar}

      {/* Table */}
      <div className="table-card">
        {sorted.length === 0 ? (
          <p style={{ padding: 24, color: "#9ca3af" }}>No shipments available.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <SortTh col="shipment_no">Shipment No</SortTh>
                <SortTh col="material_no">Material No</SortTh>
                <SortTh col="dispatch_plant">Route</SortTh>
                <SortTh col="dealer_name">Dealer</SortTh>
                <SortTh col="current_status">Status</SortTh>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(row => {
                const isHold = row.approval_status === "HOLD";
                return (
                  <tr key={row.shipment_id} className={isHold ? "tr-hold" : ""}>
                    <td>{row.shipment_no}</td>
                    <td>{row.material_no || "—"}</td>
                    <td>{row.dispatch_plant || "—"} → {row.delivery_location || "—"}</td>
                    <td>{row.dealer_name || "—"}</td>
                    <td>
                      <span className={`status ${row.current_status?.toLowerCase() || ""}`}>
                        {row.current_status || "—"}
                      </span>
                      {isHold && <span className="hold-badge">HOLD</span>}
                    </td>
                    <td>
                      <button className="view-btn" onClick={() => setViewingId(row.shipment_id)}>
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
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