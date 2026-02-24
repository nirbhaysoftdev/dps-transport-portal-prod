import { useEffect, useState } from "react";
import "../assets/css/shipments.css";

import BulkUploadModal from "../components/shipments/BulkUploadModal";

import useShipmentForm from "../hooks/useShipmentForm";
import ShipmentForm from "../components/shipments/ShipmentForm";

const TABS = ["All", "Delivered", "Running", "Dispatched", "Accident"];

export default function Shipments() {
  const [activeTab, setActiveTab] = useState("All");
  const [data, setData] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showBulk, setShowBulk] = useState(false);


  const shipmentForm = useShipmentForm(() => {
    setShowModal(false);
    fetchData();
  });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    let url = "/api/api/shipments";
    if (activeTab !== "All") url += `?status=${activeTab}`;

    const res = await fetch(url);
    const json = await res.json();
    setData(json.data || []);
  };

  return (
    <div className="shipments-wrapper">
      <div className="flex justify-between items-center mb-4">
        <h2 className="page-title">Shipments</h2>
        <button className="view-btn" onClick={() => setShowModal(true)}>
          + Add Entry
        </button>
        <button className="view-btn" onClick={() => setShowBulk(true)}>
  Bulk Upload
</button>

      </div>



      <div className="tabs">
        {TABS.map(tab => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="table-card">
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
                <td>{row.material_no}</td>
                <td>{row.dispatch_plant} → {row.delivery_location}</td>
                <td>{row.dealer_name}</td>
               
                <td>
                  <span className={`status ${row.current_status?.toLowerCase()}`}>
                    {row.current_status}
                  </span>
                </td>
                <td><button className="view-btn">View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Add Shipment</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div className="modal-body">
              <ShipmentForm {...shipmentForm} />
            </div>

            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="save-btn" onClick={shipmentForm.submit}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showBulk && (
  <BulkUploadModal
    onClose={() => setShowBulk(false)}
    onSuccess={fetchData}
  />
)}


    </div>
    
  );
}
