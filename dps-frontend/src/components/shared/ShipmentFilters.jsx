import { useState, useMemo, useCallback, useEffect } from "react";
import { apiFetch, getUser } from "../../utils/apiClient";

/* ══════════════════════════════════════════════════════════════════
   useShipmentFilters — shared hook for search, filter, sort
   
   Usage:
     const { filterBar, sorted } = useShipmentFilters(rows, opts);
     // filterBar = JSX to render inline
     // sorted    = filtered + sorted array ready for display
   ══════════════════════════════════════════════════════════════════ */
export function useShipmentFilters(rows, {
  searchFields = ["shipment_no", "billing_doc_number", "chassis_no"],
  showDateRange = true,
  showLocationFilters = true,
  defaultSort = { col: "shipment_date", dir: "desc" },
  onDateChange,                     // optional callback for server-side date filter
} = {}) {
  const user   = getUser();
  const isAdmin = user?.role === "admin";

  // ── State ──
  const [search, setSearch]       = useState("");
  const [dateFrom, setDateFrom]   = useState("");
  const [dateTo, setDateTo]       = useState("");
  const [dispatchFilter, setDispatchFilter] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState("");
  const [dealerFilter, setDealerFilter]     = useState("");
  const [stateFilter, setStateFilter]       = useState("");
  const [sortCol, setSortCol]     = useState(defaultSort.col);
  const [sortDir, setSortDir]     = useState(defaultSort.dir);

  // Build filter option lists from data
  const dispatchOptions  = useMemo(() =>
    [...new Set(rows.map(r => r.dispatch_plant || r.raw_dispatch_plant).filter(Boolean))].sort(), [rows]);
  const deliveryOptions  = useMemo(() =>
    [...new Set(rows.map(r => r.delivery_location || r.raw_delivery_location).filter(Boolean))].sort(), [rows]);
  const dealerOptions    = useMemo(() =>
    [...new Set(rows.map(r => r.dealer_name || r.raw_dealer_name).filter(Boolean))].sort(), [rows]);
  const stateOptions     = useMemo(() =>
    [...new Set(rows.map(r => r.state || r.raw_state).filter(Boolean))].sort(), [rows]);

  // ── Filtering ──
  const filtered = useMemo(() => {
    let result = [...rows];

    // Text search
    const q = search.toLowerCase().trim();
    if (q) {
      result = result.filter(r =>
        searchFields.some(field => String(r[field] ?? "").toLowerCase().includes(q))
      );
    }

    // Client-side date filter (only if no onDateChange callback)
    if (!onDateChange && showDateRange) {
      if (dateFrom) {
        result = result.filter(r => {
          const d = r.dispatch_date || r.shipment_date;
          return d && d.slice(0, 10) >= dateFrom;
        });
      }
      if (dateTo) {
        result = result.filter(r => {
          const d = r.dispatch_date || r.shipment_date;
          return d && d.slice(0, 10) <= dateTo;
        });
      }
    }

    // Location filters
    if (dispatchFilter) {
      result = result.filter(r =>
        (r.dispatch_plant || r.raw_dispatch_plant) === dispatchFilter);
    }
    if (deliveryFilter) {
      result = result.filter(r =>
        (r.delivery_location || r.raw_delivery_location) === deliveryFilter);
    }
    if (dealerFilter) {
      result = result.filter(r =>
        (r.dealer_name || r.raw_dealer_name) === dealerFilter);
    }
    if (stateFilter) {
      result = result.filter(r =>
        (r.state || r.raw_state) === stateFilter);
    }

    return result;
  }, [rows, search, dateFrom, dateTo, dispatchFilter, deliveryFilter, dealerFilter, stateFilter, searchFields, onDateChange, showDateRange]);

  // ── Sorting ──
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let va = a[sortCol], vb = b[sortCol];
      // Number columns
      if (["km", "grand_total", "base_total", "fuel_total"].includes(sortCol)) {
        va = Number(va || 0); vb = Number(vb || 0);
      } else {
        va = String(va ?? "").toLowerCase();
        vb = String(vb ?? "").toLowerCase();
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortCol, sortDir]);

  const toggleSort = useCallback((col) => {
    setSortCol(prev => {
      if (prev === col) {
        setSortDir(d => d === "asc" ? "desc" : "asc");
        return col;
      }
      setSortDir("asc");
      return col;
    });
  }, []);

  const SortTh = useCallback(({ col, children, ...props }) => (
    <th onClick={() => toggleSort(col)}
      style={{ cursor: "pointer", userSelect: "none" }}
      className={sortCol === col ? "sf-sorted" : ""}
      {...props}
    >
      {children}
      <span style={{ marginLeft: 4, fontSize: 10, opacity: sortCol === col ? 1 : 0.4 }}>
        {sortCol === col ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
      </span>
    </th>
  ), [toggleSort, sortCol, sortDir]);

  const clearAll = useCallback(() => {
    setSearch(""); setDateFrom(""); setDateTo("");
    setDispatchFilter(""); setDeliveryFilter("");
    setDealerFilter(""); setStateFilter("");
  }, []);

  const hasFilters = search || dateFrom || dateTo || dispatchFilter || deliveryFilter || dealerFilter || stateFilter;

  // ── Filter bar JSX ──
  const filterBar = (
    <div className="sf-toolbar">
      <div className="sf-row">
        {/* Search */}
        <div className="sf-search-wrap">
          <span className="sf-search-icon">🔍</span>
          <input
            className="sf-search"
            placeholder="Search by shipment no, billing doc, chassis…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="sf-search-clear" onClick={() => setSearch("")}>✕</button>
          )}
        </div>

        {/* Date range */}
        {showDateRange && (
          <div className="sf-filter-group">
            <span className="sf-filter-label">From</span>
            <input className="sf-date-input" type="date" value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); onDateChange?.(); }} />
            <span className="sf-filter-label">To</span>
            <input className="sf-date-input" type="date" value={dateTo}
              onChange={e => { setDateTo(e.target.value); onDateChange?.(); }} />
          </div>
        )}
      </div>

      {/* Location filters */}
      {showLocationFilters && (
        <div className="sf-row sf-row-filters">
          {dispatchOptions.length > 0 && (
            <select className="sf-select" value={dispatchFilter}
              onChange={e => setDispatchFilter(e.target.value)}>
              <option value="">All Dispatch</option>
              {dispatchOptions.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          )}
          {deliveryOptions.length > 0 && (
            <select className="sf-select" value={deliveryFilter}
              onChange={e => setDeliveryFilter(e.target.value)}>
              <option value="">All Delivery</option>
              {deliveryOptions.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          )}
          {dealerOptions.length > 0 && (
            <select className="sf-select" value={dealerFilter}
              onChange={e => setDealerFilter(e.target.value)}>
              <option value="">All Dealers</option>
              {dealerOptions.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          )}
          {isAdmin && stateOptions.length > 0 && (
            <select className="sf-select" value={stateFilter}
              onChange={e => setStateFilter(e.target.value)}>
              <option value="">All States</option>
              {stateOptions.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          )}
          {hasFilters && (
            <button className="sf-clear-btn" onClick={clearAll}>✕ Clear All</button>
          )}
        </div>
      )}
    </div>
  );

  return { filterBar, sorted, filtered, toggleSort, sortCol, sortDir, SortTh, hasFilters };
}
