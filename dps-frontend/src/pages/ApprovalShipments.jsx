import { useEffect, useState, useCallback } from "react";
import "../assets/css/PendingShipments.css";
import "../assets/css/shipments.css";
import { apiFetch, getUser } from "../utils/apiClient";
import ShipmentView from "../components/shipments/ShipmentView";
import { useShipmentFilters } from "../components/shared/ShipmentFilters";

const RejectConfirm = ({ shipment, onConfirm, onCancel }) => (
  <div className="ps-reject-overlay">
    <div className="ps-reject-card">
      <div className="ps-reject-icon">⚠️</div>
      <h3 className="ps-reject-title">Reject Shipment?</h3>
      <p className="ps-reject-msg">
        Are you sure you want to reject shipment <strong>#{shipment.shipment_no}</strong>?
        This action cannot be undone.
      </p>
      <div className="ps-reject-actions">
        <button className="ps-btn-no" onClick={onCancel}>No, Keep It</button>
        <button className="ps-btn-yes" onClick={onConfirm}>Yes, Reject</button>
      </div>
    </div>
  </div>
);

export default function ApprovalShipments() {
  const canEdit = ["admin"].includes(getUser()?.role);
  const [rows, setRows] = useState([]);
  const [rejectingRow, setRejectingRow] = useState(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [viewingShipment, setViewingShipment] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/shipments/approval`);
      if (!res || !res.ok) {
        console.error("Failed to load approval shipments", res?.status);
        setRows([]);
        return;
      }
      const json = await res.json();
      setRows(json.data || []);
    } catch (err) {
      console.error(err);
      setRows([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Use shared filters
  const { filterBar, sorted, SortTh } = useShipmentFilters(rows, {
    searchFields: ["shipment_no", "raw_dispatch_plant", "raw_delivery_location", "raw_vehicle_material_no"],
    showLocationFilters: false,
    defaultSort: { col: "shipment_date", dir: "desc" },
  });

  const confirmReject = async () => {
    if (!rejectingRow) return;
    setLoadingAction(true);
    try {
      await apiFetch(`/api/shipments/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipment_id: rejectingRow.shipment_id }),
      });
      setRows(r => r.filter(x => x.shipment_id !== rejectingRow.shipment_id));
    } finally {
      setLoadingAction(false);
      setRejectingRow(null);
    }
  };

  const approveShipment = async (shipment) => {
    setLoadingAction(true);
    try {
      await apiFetch(`/api/shipments/admin-approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipment_id: shipment.shipment_id }),
      });
      setRows(r => r.filter(x => x.shipment_id !== shipment.shipment_id));
    } finally {
      setLoadingAction(false);
    }
  };

  /** View Wrapper for Action buttons in View Mode **/
  if (viewingShipment) {
    return (
      <div style={{ position: "relative", height: "100%", paddingBottom: "80px" }}>
        <ShipmentView shipmentId={viewingShipment.shipment_id} onBack={() => { setViewingShipment(null); load(); }} />
        {canEdit && (
          <div style={{
            position: "fixed", bottom: 0, left: 240, right: 0, padding: "16px 24px",
            background: "#fff", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end",
            gap: "12px", zIndex: 1000, boxShadow: "0 -4px 6px -1px rgba(0,0,0,0.05)"
          }}>
            <button className="ps-reject-btn" style={{ padding: "10px 24px", fontSize: "15px" }} 
              onClick={() => setRejectingRow(viewingShipment)} disabled={loadingAction}>
              Reject
            </button>
            <button className="ps-approve-btn" style={{ padding: "10px 24px", fontSize: "15px" }}
              onClick={async () => {
                await approveShipment(viewingShipment);
                setViewingShipment(null);
              }} disabled={loadingAction}>
              {loadingAction ? "Processing..." : "Approve Shipment"}
            </button>
          </div>
        )}
        {rejectingRow && (
          <RejectConfirm shipment={rejectingRow}
            onConfirm={async () => { await confirmReject(); setViewingShipment(null); }}
            onCancel={() => setRejectingRow(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="ps-wrapper">
      <div className="ps-header">
        <div>
          <h2 className="ps-title">Approval Shipments</h2>
          <p className="ps-subtitle">{rows.length} shipment{rows.length !== 1 ? "s" : ""} awaiting your approval</p>
        </div>
      </div>

      {/* Filter bar */}
      {filterBar}

      {sorted.length === 0 ? (
        <div className="ps-empty">
          <div className="ps-empty-icon">✓</div>
          <p>No shipments awaiting approval. You're all caught up!</p>
        </div>
      ) : (
        <div className="ps-table-card">
          <table className="ps-table">
            <thead>
              <tr>
                <SortTh col="shipment_no">Shipment No</SortTh>
                <th>Mapped Route</th>
                <th>Mapped Vehicle</th>
                <SortTh col="shipment_date">Date</SortTh>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(s => (
                <tr key={s.shipment_id}>
                  <td><span className="ps-shipno">#{s.shipment_no}</span></td>
                  <td>
                    {s.route_id ? "✓ Mapped" : "⚠ Missing"} <br/>
                    <small>D: {s.raw_dispatch_plant} → {s.raw_delivery_location}</small>
                  </td>
                  <td>
                    {s.vehicle_id ? "✓ Mapped" : "⚠ Missing"} <br/>
                    <small>{s.raw_vehicle_material_no}</small>
                  </td>
                  <td className="ps-date">{s.shipment_date ? new Date(s.shipment_date).toLocaleDateString("en-IN") : "—"}</td>
                  <td>
                    <div className="ps-action-btns">
                      <button className="ps-view-btn" style={{ padding: "6px 12px", borderRadius: "6px", backgroundColor: "#f3f4f6", border: "1px solid #e5e7eb", cursor: "pointer" }} onClick={() => setViewingShipment(s)}>
                        View Details
                      </button>
                      {canEdit && (
                        <>
                          <button className="ps-approve-btn" onClick={() => approveShipment(s)} disabled={loadingAction}>
                            Approve
                          </button>
                          <button className="ps-reject-btn" onClick={() => setRejectingRow(s)} disabled={loadingAction}>
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rejectingRow && (
        <RejectConfirm
          shipment={rejectingRow}
          onConfirm={confirmReject}
          onCancel={() => setRejectingRow(null)}
        />
      )}
    </div>
  );
}
