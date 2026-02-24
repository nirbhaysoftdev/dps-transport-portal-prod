import { useEffect, useState } from "react";

export default function PendingShipments() {
  const [rows, setRows] = useState([]);

  const load = async () => {
    const res = await fetch("/api/api/shipments/pending");
    const json = await res.json();
    setRows(json.data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const approve = async (shipment_id) => {
    await fetch("/api/api/shipments/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shipment_id }),
    });

    setRows(r => r.filter(x => x.shipment_id !== shipment_id));
  };

  const reject = async (shipment_id) => {
    await fetch("/api/api/shipments/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shipment_id }),
    });

    setRows(r => r.filter(x => x.shipment_id !== shipment_id));
  };

  return (
    <div>
      <h2>Pending Shipments</h2>

      <table>
        <thead>
          <tr>
            <th>Shipment No</th>
            <th>Missing Masters</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(s => (
            <tr key={s.shipment_id}>
              <td>{s.shipment_no}</td>

              <td>
                {!s.route_id && <span>Route </span>}
                {!s.vehicle_id && <span>Vehicle </span>}
                {!s.driver_route_id && <span>Driver</span>}
              </td>

              <td>
                <button onClick={() => approve(s.shipment_id)}>
                  Approve
                </button>
                <button
                  style={{ marginLeft: 8 }}
                  onClick={() => reject(s.shipment_id)}
                >
                  Reject
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
