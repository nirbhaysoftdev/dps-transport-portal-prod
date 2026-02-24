const BASE = "/api/shipments/bulk";

export const bulkPreview = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BASE}/preview`, {
    method: "POST",
    body: formData,
  });

  return res.json();
};

export const bulkCommit = async (rows) => {
  const res = await fetch(`${BASE}/commit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows }),
  });

  return res.json();
};
