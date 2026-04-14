const { useState, useEffect, useRef, useCallback, useMemo } = React;

// ─── Config ───────────────────────────────────────────────────────────────────
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz5WKLTWe0H4SsYAdXjuFCYeMSNRvc47fEJuAv_EPs4xKN7N7CWGRKCgzyNz_G2bmoo/exec";
const BACKUP_INTERVAL_MS = 60 * 60 * 1000;

// ─── Persistence ──────────────────────────────────────────────────────────────
const SK = "adelantos_v3";
const BK = "adelantos_backup_ts";
const load = () => { try { const r = localStorage.getItem(SK); return r ? JSON.parse(r) : null; } catch { return null; } };
const save = (d) => { try { localStorage.setItem(SK, JSON.stringify(d)); } catch {} };
const loadTs = () => localStorage.getItem(BK) || null;
const saveTs = (t) => localStorage.setItem(BK, t);
const INIT = { empleados: [], adelantos: [], quincenas_cerradas: [], pagos: [] };
const SUCURSALES = ["Principal", "Sucursal Norte", "Sucursal Sur", "Bodega", "Ventas Externas"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt$ = (n) => `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().split("T")[0];
const getQ = () => new Date().getDate() <= 15 ? "01" : "02";
const ym2label = (ym) => {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  return `${["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][+m - 1]} ${y}`;
};
const fmtDT = (iso) => {
  if (!iso) return "Nunca";
  const d = new Date(iso);
  return d.toLocaleDateString("es-SV", { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString("es-SV", { hour: "2-digit", minute: "2-digit" });
};

// ─── Drive ────────────────────────────────────────────────────────────────────
const pushDrive = async (data) => {
  const r = await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify({ ...data, _at: new Date().toISOString() }) });
  if (!r.ok) throw new Error();
  const j = await r.json(); if (!j.ok) throw new Error(j.error);
  const ts = new Date().toISOString(); saveTs(ts); return ts;
};
const pullDrive = async () => {
  const r = await fetch(SCRIPT_URL + "?t=" + Date.now());
  if (!r.ok) throw new Error();
  const j = await r.json(); return j.empty ? null : j;
};

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  primary:       "#00327d",
  primaryCont:   "#0047ab",
  onPrimary:     "#ffffff",
  secondary:     "#006c4a",
  secondaryCont: "#82f5c1",
  onSecondaryCont: "#00714e",
  surface:       "#f7f9fb",
  surfaceLowest: "#ffffff",
  surfaceLow:    "#f2f4f6",
  surfaceCont:   "#eceef0",
  surfaceHigh:   "#e6e8ea",
  surfaceHighest:"#e0e3e5",
  onSurface:     "#191c1e",
  onSurfaceVar:  "#434653",
  outline:       "#737784",
  outlineVar:    "#c3c6d5",
  error:         "#ba1a1a",
  errorCont:     "#ffdad6",
  primaryFixed:  "#dae2ff",
  primaryFixedDim:"#b1c5ff",
};

// ─── Material Icons (inline SVG subset) ───────────────────────────────────────
const MI = ({ name, size = 22, color = T.onSurfaceVar, fill = false }) => {
  const paths = {
    dashboard:    <path d="M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z"/>,
    group:        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>,
    payments:     <path d="M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/>,
    history:      <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>,
    person:       <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>,
    add_circle:   <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>,
    event_busy:   <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zm-8.46-3.85l-.71-.71L8 17l1.41 1.41 2.13-2.13 4.24-4.24-1.41-1.41-3.83 3.52z"/>,
    search:       <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>,
    add_card:     <path d="M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h9v-2H4v-6h16V6c0-1.11-.89-2-2-2zm0 4H4V6h16v2zm4 9v2h-3v3h-2v-3h-3v-2h3v-3h2v3h3z"/>,
    lock:         <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>,
    lock_open:    <path d="M12 13c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6-5h-1V6c0-2.76-2.24-5-5-5-2.28 0-4.27 1.54-4.84 3.75l1.94.49C9.44 3.93 10.63 3 12 3c1.65 0 3 1.35 3 3v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z"/>,
    trending_up:  <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/>,
    verified:     <path d="M23 12l-2.44-2.79.34-3.69-3.61-.82-1.89-3.2L12 2.96 8.6 1.5 6.71 4.69 3.1 5.5l.34 3.7L1 12l2.44 2.79-.34 3.7 3.61.82 1.89 3.2L12 21.04l3.4 1.47 1.89-3.2 3.61-.82-.34-3.69L23 12zm-12.91 4.72l-3.8-3.81 1.48-1.48 2.32 2.33 5.85-5.87 1.48 1.48-7.33 7.35z"/>,
    notifications:<path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>,
    cloud:        <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>,
    check_circle: <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>,
    warning:      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>,
    cloud_upload: <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>,
    cloud_download:<path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/>,
    person_add:   <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>,
    delete:       <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>,
    edit:         <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>,
    send:         <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>,
    description:  <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>,
    calendar:     <path d="M20 3h-1V1h-2v2H7V1H5v2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 18H4V8h16v13z"/>,
    schedule:     <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/>,
    visibility:   <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>,
    verified_user:<path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>,
    restore:      <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>,
    wa:           null,
    expand_more:  <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/>,
    close:        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>,
    arrow_back:   <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>,
    account_balance:<path d="M4 10v7h3v-7H4zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm14-12v7h3v-7h-3zM11.5 1L2 6v2h19V6l-9.5-5z"/>,
    dollar:       null,
    location_on: <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>,
  };

  const isFill = fill;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
      {name === "wa" ? (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      ) : name === "dollar" ? (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23"/>
          <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
        </svg>
      ) : (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={isFill ? color : "none"}>
          <g fill={color}>{paths[name]}</g>
        </svg>
      )}
    </span>
  );
};

// ─── Base Components ──────────────────────────────────────────────────────────
function Toast({ msg, onClose }) {
  useEffect(() => { if (msg) { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); } }, [msg]);
  if (!msg) return null;
  return (
    <div style={{
      position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)",
      background: T.onSurface, color: "#fff", padding: "12px 22px", borderRadius: 12,
      fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 500, zIndex: 9999,
      boxShadow: "0 4px 24px rgba(0,0,0,.2)", animation: "fadeUp .25s ease",
      maxWidth: "88vw", textAlign: "center", whiteSpace: "nowrap"
    }}>{msg}</div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(25,28,30,.5)", zIndex: 1000,
      display: "flex", alignItems: "flex-end", justifyContent: "center"
    }} onClick={onClose}>
      <div style={{
        background: T.surface, borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 540,
        maxHeight: "92vh", overflowY: "auto", padding: "22px 20px 48px",
        animation: "slideUp .22s ease", boxShadow: "0 -8px 40px rgba(0,50,125,.08)"
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 18, fontWeight: 800, color: T.primary }}>{title}</span>
          <button onClick={onClose} style={{
            background: T.surfaceLow, border: "none", borderRadius: "50%",
            width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer"
          }}><MI name="close" size={18} color={T.outline} fill /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

const FieldLabel = ({ icon, children }) => (
  <label style={{
    display: "flex", alignItems: "center", gap: 6,
    fontSize: 11, fontWeight: 700, letterSpacing: ".15em",
    textTransform: "uppercase", color: T.onSurfaceVar, marginBottom: 8
  }}>
    {icon && <MI name={icon} size={16} color={T.onSurfaceVar} fill />}
    {children}
  </label>
);

const FInput = ({ label, icon, ...props }) => (
  <div style={{ marginBottom: 16 }}>
    {label && <FieldLabel icon={icon}>{label}</FieldLabel>}
    <input {...props} style={{
      width: "100%", height: 52, padding: "0 14px",
      background: T.surfaceLow, border: "none", borderRadius: 10,
      fontSize: 15, fontFamily: "'Inter', sans-serif", color: T.onSurface,
      fontWeight: 600, outline: "none", boxSizing: "border-box", ...props.style
    }} />
  </div>
);

const FSel = ({ label, icon, children, ...props }) => (
  <div style={{ marginBottom: 16 }}>
    {label && <FieldLabel icon={icon}>{label}</FieldLabel>}
    <div style={{ position: "relative" }}>
      <select {...props} style={{
        width: "100%", height: 52, padding: "0 40px 0 14px",
        background: T.surfaceLow, border: "none", borderRadius: 10,
        fontSize: 15, fontFamily: "'Inter', sans-serif", color: T.onSurface,
        fontWeight: 600, outline: "none", appearance: "none", boxSizing: "border-box"
      }}>{children}</select>
      <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
        <MI name="expand_more" size={20} color={T.onSurfaceVar} fill />
      </span>
    </div>
  </div>
);

const FTextarea = ({ label, icon, ...props }) => (
  <div style={{ marginBottom: 16 }}>
    {label && <FieldLabel icon={icon}>{label}</FieldLabel>}
    <textarea {...props} style={{
      width: "100%", padding: "14px", background: T.surfaceLow, border: "none",
      borderRadius: 10, fontSize: 14, fontFamily: "'Inter', sans-serif",
      color: T.onSurface, fontWeight: 500, outline: "none", resize: "vertical",
      minHeight: 80, boxSizing: "border-box"
    }} />
  </div>
);

const CTABtn = ({ children, onClick, disabled, style = {} }) => (
  <button onClick={onClick} disabled={disabled} style={{
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    padding: "0 22px", height: 52, borderRadius: 10, border: "none",
    background: `linear-gradient(135deg, ${T.primary} 0%, ${T.primaryCont} 100%)`,
    color: "#fff", fontFamily: "'Manrope', sans-serif", fontWeight: 700,
    fontSize: 15, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? .6 : 1,
    boxShadow: "0 4px 16px rgba(0,50,125,.15)", ...style
  }}>{children}</button>
);

const OutlineBtn = ({ children, onClick, style = {} }) => (
  <button onClick={onClick} style={{
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    padding: "0 18px", height: 52, borderRadius: 10,
    border: `1.5px solid ${T.outlineVar}`, background: T.surfaceLowest,
    color: T.onSurfaceVar, fontFamily: "'Manrope', sans-serif",
    fontWeight: 700, fontSize: 14, cursor: "pointer", ...style
  }}>{children}</button>
);

const GhostBtn = ({ children, onClick, style = {} }) => (
  <button onClick={onClick} style={{
    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
    padding: "0 16px", height: 44, borderRadius: 8, border: "none",
    background: T.surfaceLow, color: T.onSurface,
    fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer", ...style
  }}>{children}</button>
);

const QuinenaToggle = ({ value, onChange }) => (
  <div style={{ display: "flex", background: T.surfaceLow, padding: 4, borderRadius: 10, height: 52, gap: 4 }}>
    {["01", "02"].map(q => (
      <button key={q} onClick={() => onChange(q)} style={{
        flex: 1, borderRadius: 8, border: "none",
        background: value === q ? T.surfaceLowest : "transparent",
        boxShadow: value === q ? "0 1px 4px rgba(0,0,0,.1)" : "none",
        color: value === q ? T.primary : T.onSurfaceVar,
        fontFamily: "'Inter', sans-serif", fontWeight: 700,
        fontSize: 14, cursor: "pointer", transition: "all .15s"
      }}>{q === "01" ? "1ra" : "2da"}</button>
    ))}
  </div>
);

const StatusBadge = ({ children, color = T.secondary, bg = "#e8f5ee" }) => (
  <span style={{
    padding: "3px 10px", borderRadius: 6,
    background: bg, color, fontSize: 10,
    fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em"
  }}>{children}</span>
);

const MetricCard = ({ label, value, sub, subColor, dark }) => (
  <div style={{
    background: dark ? T.primary : T.surfaceLowest,
    borderRadius: 14, padding: "24px 20px",
    border: dark ? "none" : `1px solid ${T.outlineVar}22`,
    display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 140
  }}>
    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: dark ? T.primaryFixedDim : T.onSurfaceVar, marginBottom: 8 }}>{label}</p>
    <p style={{ fontSize: 36, fontWeight: 800, fontFamily: "'Manrope', sans-serif", color: dark ? "#fff" : T.onSurface, lineHeight: 1.1 }}>{value}</p>
    {sub && <p style={{ fontSize: 12, fontWeight: 600, color: subColor || (dark ? T.primaryFixedDim : T.onSurfaceVar), marginTop: 10 }}>{sub}</p>}
  </div>
);

// ─── Comprobante ──────────────────────────────────────────────────────────────
function Comprobante({ adelanto, empleado, onClose }) {
  const ym = adelanto.fecha.substring(0, 7);
  const qL = adelanto.quincena === "01" ? "1ra Quincena" : "2da Quincena";
  const share = () => {
    const t = encodeURIComponent(`💵 *Adelanto de Salario*\n👤 ${empleado.nombre}\n📅 ${adelanto.fecha} — ${qL}\n💰 ${fmt$(adelanto.cantidad)}${adelanto.observacion ? `\n📝 ${adelanto.observacion}` : ""}`);
    window.open(`https://wa.me/?text=${t}`, "_blank");
  };
  return (
    <Modal title="Comprobante de Adelanto" onClose={onClose}>
      {/* Receipt card */}
      <div style={{
        background: `linear-gradient(135deg, ${T.primary} 0%, ${T.primaryCont} 100%)`,
        borderRadius: 20, padding: "24px 20px", marginBottom: 20,
        color: "#fff", position: "relative", overflow: "hidden"
      }}>
        <div style={{ position: "absolute", top: -32, right: -32, width: 100, height: 100, background: "rgba(255,255,255,.08)", borderRadius: "50%", filter: "blur(16px)" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".2em", opacity: .7, textTransform: "uppercase", marginBottom: 4 }}>Comprobante de Adelanto</p>
            <h3 style={{ fontFamily: "'Manrope', sans-serif", fontSize: 18, fontWeight: 700, margin: 0 }}>ADELANTO DE SALARIOS</h3>
          </div>
          <MI name="verified" size={34} color="rgba(255,255,255,.4)" fill />
        </div>
        <div style={{ height: 1, background: "rgba(255,255,255,.2)", margin: "12px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".18em", opacity: .7, textTransform: "uppercase", marginBottom: 4 }}>Empleado</p>
            <p style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 17, margin: 0 }}>{empleado.nombre}</p>
            <p style={{ fontSize: 12, opacity: .7, marginTop: 2 }}>{empleado.puesto || "—"} · {qL} · {ym2label(ym)}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".18em", opacity: .7, textTransform: "uppercase", marginBottom: 4 }}>Monto</p>
            <p style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 28, margin: 0 }}>{fmt$(adelanto.cantidad)}</p>
          </div>
        </div>
        {adelanto.observacion && <p style={{ fontSize: 12, opacity: .7, marginTop: 10 }}>Nota: {adelanto.observacion}</p>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <OutlineBtn onClick={onClose}>Cerrar</OutlineBtn>
        <CTABtn onClick={share} style={{ background: "#25D366", boxShadow: "0 4px 16px rgba(37,211,102,.2)" }}>
          <MI name="wa" size={18} color="#fff" />Enviar
        </CTABtn>
      </div>
    </Modal>
  );
}

// ─── Iniciales avatar ─────────────────────────────────────────────────────────
const Avatar = ({ nombre, size = 40 }) => {
  const init = nombre ? nombre.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() : "?";
  const hue = nombre ? (nombre.charCodeAt(0) * 37) % 360 : 200;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `hsl(${hue},55%,88%)`, color: `hsl(${hue},55%,30%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 800, fontSize: size * .35, fontFamily: "'Manrope', sans-serif",
      flexShrink: 0
    }}>{init}</div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MÓDULO DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function ModDashboard({ data, setData, setToast, setTab, setPrefilledEmp }) {
  const [q, setQ] = useState("");
  const [modalCerrar, setModalCerrar] = useState(false);
  const [qnCerrar, setQnCerrar] = useState({ mes: today().substring(0, 7), quincena: "01" });

  const total = data.adelantos.reduce((s, a) => s + Number(a.cantidad), 0);
  const activos = data.empleados.filter(e => e.activo !== false).length;
  const recientes = [...data.adelantos].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 6);

  const qKey = `${qnCerrar.mes}_${qnCerrar.quincena}`;
  const listaQn = data.empleados.map(emp => {
    const t = data.adelantos.filter(a => a.empleadoId === emp.id && a.fecha.startsWith(qnCerrar.mes) && a.quincena === qnCerrar.quincena).reduce((s, a) => s + Number(a.cantidad), 0);
    return { emp, total: t };
  }).filter(x => x.total > 0);
  const totalQn = listaQn.reduce((s, x) => s + x.total, 0);

  const filteredEmps = q ? data.empleados.filter(e => e.nombre.toLowerCase().includes(q.toLowerCase()) || (e.puesto || "").toLowerCase().includes(q.toLowerCase())) : [];

  // Cálculos para Gráficas
  const statsEmp = useMemo(() => {
    const map = {};
    data.adelantos.forEach(a => {
        map[a.empleadoId] = (map[a.empleadoId] || 0) + Number(a.cantidad);
    });
    return Object.entries(map)
        .map(([id, val]) => ({ id, val, nombre: data.empleados.find(e => e.id === id)?.nombre || "Desconocido" }))
        .sort((a, b) => b.val - a.val)
        .slice(0, 5);
  }, [data]);

  const statsSuc = useMemo(() => {
    const map = {};
    data.adelantos.forEach(a => {
        const emp = data.empleados.find(e => e.id === a.empleadoId);
        const suc = emp?.sucursal || "Sin Sucursal";
        map[suc] = (map[suc] || 0) + Number(a.cantidad);
    });
    return Object.entries(map).sort((a, b) => b.1 - a.1);
  }, [data]);

  const diasCierre = useMemo(() => {
    const d = new Date();
    const day = d.getDate();
    if (day <= 15) return 15 - day;
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return lastDay - day;
  }, []);

  const cerrar = () => {
    if (data.quincenas_cerradas.includes(qKey)) return setToast("Esta quincena ya fue cerrada");
    setData(d => ({ ...d, quincenas_cerradas: [...d.quincenas_cerradas, qKey] }));
    setToast("Quincena cerrada ✓");
    setModalCerrar(false);
  };

  // Últimas 4 quincenas para history
  const byQ = {};
  data.adelantos.forEach(a => {
    const k = `${a.fecha.substring(0, 7)}_${a.quincena}`;
    byQ[k] = (byQ[k] || 0) + Number(a.cantidad);
  });
  const qKeys = Object.keys(byQ).sort().reverse().slice(0, 4);

  return (
    <div>
      {/* Search + actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}>
            <MI name="search" size={20} color={T.outline} fill />
          </span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar empleados por nombre o puesto..."
            style={{
              width: "100%", padding: "0 14px 0 44px", height: 52, boxSizing: "border-box",
              background: T.surfaceLow, border: "none", borderRadius: 12,
              fontSize: 15, fontFamily: "'Inter', sans-serif", color: T.onSurface, outline: "none"
            }} />
          {q && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: T.surfaceLowest, borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,.12)", zIndex: 50, maxHeight: 220, overflowY: "auto", marginTop: 4 }}>
              {filteredEmps.length === 0
                ? <div style={{ padding: "14px 16px", fontSize: 13, color: T.outline }}>Sin resultados</div>
                : filteredEmps.map(e => {
                  const tot = data.adelantos.filter(a => a.empleadoId === e.id).reduce((s, a) => s + Number(a.cantidad), 0);
                  return (
                    <div key={e.id} onClick={() => { setPrefilledEmp(e.id); setTab("adelantos"); setQ(""); }}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer", borderBottom: `1px solid ${T.surfaceLow}` }}>
                      <Avatar nombre={e.nombre} size={36} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: T.onSurface }}>{e.nombre}</div>
                        <div style={{ fontSize: 11, color: T.outline }}>{e.puesto || "Sin puesto"}</div>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 14, color: T.primary }}>{fmt$(tot)}</div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <CTABtn onClick={() => setTab("adelantos")} style={{ flex: 1 }}>
            <MI name="add_circle" size={18} color="#fff" fill />Nuevo Adelanto
          </CTABtn>
          <OutlineBtn onClick={() => setModalCerrar(true)} style={{ flex: 1 }}>
            <MI name="event_busy" size={18} color={T.onSurfaceVar} fill />Cerrar Quincena
          </OutlineBtn>
        </div>
      </div>

      {/* Bento metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
        <div style={{ gridColumn: "1 / -1", background: T.surfaceLowest, borderRadius: 16, padding: "28px 24px", border: `1px solid ${T.outlineVar}22`, position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: T.secondary, marginBottom: 8 }}>Total adelantos registrados</p>
              <h2 style={{ fontFamily: "'Manrope', sans-serif", fontSize: 40, fontWeight: 800, color: T.onSurface, margin: 0 }}>{fmt$(total)}</h2>
            </div>
            <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: T.error, marginBottom: 4 }}>Cierre quincena</p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5 }}>
                    <MI name="schedule" size={16} color={T.error} fill />
                    <span style={{ fontSize: 18, fontWeight: 800, color: T.onSurface }}>{diasCierre} días</span>
                </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 14, background: `${T.secondaryCont}44`, padding: "5px 12px", borderRadius: 20, width: "fit-content" }}>
            <MI name="trending_up" size={14} color={T.onSecondaryCont} fill />
            <span style={{ fontSize: 11, fontWeight: 700, color: T.onSecondaryCont }}>{data.adelantos.length} registros totales</span>
          </div>
        </div>
        <MetricCard label="Empleados activos" value={activos} sub={`${data.empleados.length} registrados`} dark />
        <MetricCard label="Quincenas cerradas" value={data.quincenas_cerradas.length} sub="Periodos liquidados" subColor={T.outline} />
      </div>

      {/* SECCIÓN DE GRÁFICAS */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16, marginBottom: 24 }}>
        {/* Gráfica Empleados */}
        <div style={{ background: T.surfaceLowest, borderRadius: 16, padding: 20, border: `1px solid ${T.outlineVar}22` }}>
            <h3 style={{ fontFamily: "'Manrope', sans-serif", fontSize: 15, fontWeight: 800, color: T.onSurface, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <MI name="group" size={18} color={T.primary} fill /> Top 5 Empleados (Adelantos)
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {statsEmp.length === 0 ? <p style={{ fontSize: 12, color: T.outline }}>Sin datos suficientes</p> : statsEmp.map(e => {
                    const pct = (e.val / statsEmp[0].val) * 100;
                    return (
                        <div key={e.id}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                                <span style={{ fontWeight: 600 }}>{e.nombre}</span>
                                <span style={{ fontWeight: 800, color: T.primary }}>{fmt$(e.val)}</span>
                            </div>
                            <div style={{ height: 8, background: T.surfaceLow, borderRadius: 4, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${pct}%`, background: T.primary, borderRadius: 4 }} />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>

        {/* Gráfica Sucursales */}
        <div style={{ background: T.surfaceLowest, borderRadius: 16, padding: 20, border: `1px solid ${T.outlineVar}22` }}>
            <h3 style={{ fontFamily: "'Manrope', sans-serif", fontSize: 15, fontWeight: 800, color: T.onSurface, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <MI name="location_on" size={18} color={T.secondary} fill /> Gasto por Sucursal
            </h3>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", height: 120, paddingBottom: 20 }}>
                {statsSuc.length === 0 ? <p style={{ fontSize: 12, color: T.outline }}>Sin datos</p> : statsSuc.map(([suc, val]) => {
                    const pct = (val / statsSuc[0][1]) * 100;
                    return (
                        <div key={suc} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                            <div style={{ fontSize: 9, fontWeight: 800 }}>{fmt$(val)}</div>
                            <div style={{ width: "100%", height: `${pct}%`, background: T.secondary, borderRadius: "4px 4px 0 0", minHeight: 4 }} />
                            <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", textAlign: "center", height: 10 }}>{suc}</div>
                        </div>
                    );
                })}
            </div>
        </div>
      </div>

      {/* Adelantos recientes */}
      {recientes.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontFamily: "'Manrope', sans-serif", fontSize: 20, fontWeight: 700, color: T.onSurface, margin: 0 }}>Adelantos Recientes</h3>
            <button onClick={() => setTab("adelantos")} style={{ background: "none", border: "none", color: T.primary, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Ver todo</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {recientes.map(adv => {
              const emp = data.empleados.find(e => e.id === adv.empleadoId);
              return (
                <div key={adv.id} style={{ background: T.surfaceLowest, borderRadius: 14, padding: "16px 14px", border: `1px solid ${T.outlineVar}18` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <Avatar nombre={emp?.nombre || "?"} size={38} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: T.onSurface, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{emp?.nombre || "—"}</div>
                      <div style={{ fontSize: 10, color: T.outline, textTransform: "uppercase", letterSpacing: ".06em" }}>{emp?.puesto || "—"}</div>
                    </div>
                  </div>
                  <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 18, fontWeight: 700, color: T.secondary, marginBottom: 8 }}>{fmt$(adv.cantidad)}</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 8, borderTop: `1px solid ${T.surfaceLow}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <MI name="calendar" size={12} color={T.outline} fill />
                      <span style={{ fontSize: 11, color: T.outline }}>{adv.fecha}</span>
                    </div>
                    <StatusBadge color={T.onSecondaryCont} bg={`${T.secondaryCont}44`}>{adv.quincena === "01" ? "1ra Qna" : "2da Qna"}</StatusBadge>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Historial quincenas */}
      {qKeys.length > 0 && (
        <section>
          <h3 style={{ fontFamily: "'Manrope', sans-serif", fontSize: 20, fontWeight: 700, color: T.onSurface, margin: "0 0 14px" }}>Historial por Quincena</h3>
          {qKeys.map(k => {
            const [ym, qn] = k.split("_");
            const closed = data.quincenas_cerradas.includes(k);
            const isCurrentMes = ym === today().substring(0, 7) && qn === getQ();
            return (
              <div key={k} style={{
                borderRadius: 16, border: `1px solid ${T.outlineVar}22`, overflow: "hidden", marginBottom: 10,
                background: closed ? `${T.surfaceLow}88` : T.surfaceLowest
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", background: closed ? `${T.surfaceHigh}66` : `${T.surfaceLow}88` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {!closed && <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.primary, display: "inline-block", animation: "pulse 2s infinite" }} />}
                    {closed && <MI name="lock" size={18} color={T.outline} fill />}
                    <span style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 14, color: closed ? T.onSurfaceVar : T.onSurface }}>
                      {qn === "01" ? "1ra Quincena" : "2da Quincena"} — {ym2label(ym)}
                    </span>
                  </div>
                  <StatusBadge
                    color={closed ? T.onSurfaceVar : T.primary}
                    bg={closed ? T.surfaceHighest : T.primaryFixed}>
                    {closed ? "Cerrada" : isCurrentMes ? "En Curso" : "Abierta"}
                  </StatusBadge>
                </div>
                <div style={{ padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 13, color: T.onSurfaceVar }}>
                    {data.adelantos.filter(a => a.fecha.startsWith(ym) && a.quincena === qn).length} adelantos
                  </div>
                  <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 16, fontWeight: 700, color: closed ? T.onSurfaceVar : T.primary }}>
                    {fmt$(byQ[k])}
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {modalCerrar && (
        <Modal title="Cerrar Quincena" onClose={() => setModalCerrar(false)}>
          <FSel label="Mes" icon="calendar" value={qnCerrar.mes} onChange={e => setQnCerrar(q => ({ ...q, mes: e.target.value }))}>
            {Array.from({ length: 6 }, (_, i) => {
              const d = new Date(); d.setMonth(d.getMonth() - i);
              const v = d.toISOString().substring(0, 7);
              return <option key={v} value={v}>{ym2label(v)}</option>;
            })}
          </FSel>
          <div style={{ marginBottom: 16 }}>
            <FieldLabel icon="schedule">Quincena</FieldLabel>
            <QuinenaToggle value={qnCerrar.quincena} onChange={q => setQnCerrar(v => ({ ...v, quincena: q }))} />
          </div>

          {listaQn.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: T.onSurfaceVar, marginBottom: 10 }}>
                Adelantos del período — {ym2label(qnCerrar.mes)}
              </p>
              <div style={{ border: `1px solid ${T.outlineVar}33`, borderRadius: 10, overflow: "hidden" }}>
                {listaQn.map((x, i) => (
                  <div key={x.emp.id} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "11px 14px",
                    background: i % 2 === 0 ? T.surfaceLowest : T.surfaceLow,
                    borderBottom: i < listaQn.length - 1 ? `1px solid ${T.outlineVar}22` : "none"
                  }}>
                    <Avatar nombre={x.emp.nombre} size={32} />
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: T.onSurface }}>{x.emp.nombre}</span>
                    <span style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 15, color: T.secondary }}>{fmt$(x.total)}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", background: `${T.secondaryCont}33`, borderTop: `1px solid ${T.outlineVar}22` }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: T.secondary }}>Total del período</span>
                  <span style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 16, color: T.secondary }}>{fmt$(totalQn)}</span>
                </div>
              </div>
            </div>
          )}
          {listaQn.length === 0 && (
            <div style={{ background: T.surfaceLow, borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: T.outline }}>Sin adelantos registrados en este período.</div>
          )}

          <div style={{ background: T.errorCont, borderRadius: 10, padding: "10px 14px", marginBottom: 18, display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: T.error }}>
            <MI name="warning" size={16} color={T.error} fill />Esta acción no se puede deshacer.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <OutlineBtn onClick={() => setModalCerrar(false)}>Cancelar</OutlineBtn>
            <CTABtn onClick={cerrar}>Confirmar cierre</CTABtn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MÓDULO EMPLEADOS (Staff)
// ═══════════════════════════════════════════════════════════════════════════════
function ModEmpleados({ data, setData, setToast, prefilledEmp, setPrefilledEmp }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ nombre: "", puesto: "", telefono: "", sucursal: SUCURSALES[0] });
  const [q, setQ] = useState("");

  const filtered = data.empleados.filter(e =>
    e.nombre.toLowerCase().includes(q.toLowerCase()) || (e.puesto || "").toLowerCase().includes(q.toLowerCase())
  );

  const save_ = () => {
    if (!form.nombre.trim()) return setToast("El nombre es requerido");
    if (modal === "add") setData(d => ({ ...d, empleados: [...d.empleados, { id: Date.now() + "", activo: true, ...form }] }));
    else setData(d => ({ ...d, empleados: d.empleados.map(e => e.id === modal.id ? { ...e, ...form } : e) }));
    setToast(modal === "add" ? "Empleado agregado" : "Empleado actualizado");
    setModal(null);
  };

  const totalEmp = (id) => data.adelantos.filter(a => a.empleadoId === id).reduce((s, a) => s + Number(a.cantidad), 0);
  const total = data.adelantos.reduce((s, a) => s + Number(a.cantidad), 0);

  return (
    <div>
      {/* Header bento */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 20 }}>
        <div style={{ background: T.surfaceLowest, borderRadius: 14, padding: "20px", border: `1px solid ${T.outlineVar}22`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: T.outline, marginBottom: 6 }}>Total Adelantos Activos</p>
            <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 22, fontWeight: 800, color: T.onSurface }}>{fmt$(total)}</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            {[40, 60, 30, 80].map((h, i) => <div key={i} style={{ width: 6, height: h * .35, background: i === 3 ? T.secondary : `${T.secondary}44`, borderRadius: 3 }} />)}
          </div>
        </div>
        <div style={{ background: T.primary, borderRadius: 14, padding: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: T.primaryFixedDim, margin: 0 }}>Nómina</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <MI name="verified" size={20} color={T.secondaryCont} fill />
            <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 16, fontWeight: 700, color: "#fff", margin: 0 }}>Estable</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 16 }}>
        <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}>
          <MI name="search" size={20} color={T.outline} fill />
        </span>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar empleados..."
          style={{ width: "100%", padding: "0 14px 0 44px", height: 52, boxSizing: "border-box", background: T.surfaceLow, border: "none", borderRadius: 12, fontSize: 14, fontFamily: "'Inter', sans-serif", color: T.onSurface, outline: "none" }} />
      </div>

      {/* List */}
      <div style={{ background: T.surfaceLowest, borderRadius: 14, overflow: "hidden", border: `1px solid ${T.outlineVar}18` }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", padding: "10px 16px", background: `${T.surfaceHigh}55`, borderBottom: `1px solid ${T.outlineVar}22` }}>
          {["Empleado", "Adelanto", ""].map((h, i) => (
            <span key={i} style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: T.outline, textAlign: i === 1 ? "right" : i === 2 ? "right" : "left" }}>{h}</span>
          ))}
        </div>
        {filtered.length === 0 && <div style={{ padding: "32px", textAlign: "center", color: T.outline, fontSize: 14 }}>Sin empleados</div>}
        {filtered.map((emp, idx) => (
          <div key={emp.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", alignItems: "center", padding: "14px 16px", borderBottom: idx < filtered.length - 1 ? `1px solid ${T.surfaceLow}` : "none", opacity: emp.activo ? 1 : .5, gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ position: "relative" }}>
                <Avatar nombre={emp.nombre} size={40} />
                <span style={{ position: "absolute", bottom: 0, right: 0, width: 11, height: 11, borderRadius: "50%", background: emp.activo ? T.secondary : T.outline, border: "2px solid #fff" }} />
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: 14, color: T.onSurface, margin: 0 }}>{emp.nombre}</p>
                <p style={{ fontSize: 11, color: T.outline, margin: "2px 0 0", fontWeight: 500 }}>{emp.sucursal || "Sin sede"} · {emp.puesto || "Sin puesto"}</p>
              </div>
            </div>
            <p style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 15, color: T.onSurface, margin: 0, textAlign: "right" }}>{fmt$(totalEmp(emp.id))}</p>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => { setForm({ nombre: emp.nombre, puesto: emp.puesto || "", telefono: emp.telefono || "", sucursal: emp.sucursal || SUCURSALES[0] }); setModal(emp); }}
                style={{ background: T.surfaceLow, border: "none", borderRadius: 8, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <MI name="edit" size={15} color={T.onSurfaceVar} fill />
              </button>
              <button onClick={() => setData(d => ({ ...d, empleados: d.empleados.map(e => e.id === emp.id ? { ...e, activo: !e.activo } : e) }))}
                style={{ background: emp.activo ? T.errorCont : `${T.secondaryCont}55`, border: "none", borderRadius: 8, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: emp.activo ? T.error : T.secondary, display: "block" }} />
              </button>
            </div>
          </div>
        ))}
        <div style={{ padding: "14px 16px", textAlign: "center", borderTop: `1px solid ${T.outlineVar}22` }}>
          <button onClick={() => { setForm({ nombre: "", puesto: "", telefono: "", sucursal: SUCURSALES[0] }); setModal("add"); }} style={{ background: "none", border: "none", color: T.primary, fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, margin: "0 auto" }}>
            <MI name="person_add" size={16} color={T.primary} fill />Agregar Empleado
          </button>
        </div>
      </div>

      {/* FAB */}
      <button onClick={() => { setForm({ nombre: "", puesto: "", telefono: "", sucursal: SUCURSALES[0] }); setModal("add"); }} style={{
        position: "fixed", bottom: 90, right: 20, width: 54, height: 54,
        background: `linear-gradient(135deg, ${T.primary}, ${T.primaryCont})`, color: "#fff",
        borderRadius: 16, border: "none", display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", boxShadow: "0 8px 28px rgba(0,50,125,.25)", zIndex: 40
      }}><MI name="person_add" size={22} color="#fff" fill /></button>

      {modal && (
        <Modal title={modal === "add" ? "Nuevo Empleado" : "Editar Empleado"} onClose={() => setModal(null)}>
          <FInput label="Nombre completo" icon="person" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej. Juan García" />
          <FSel label="Sucursal / Sede" icon="location_on" value={form.sucursal} onChange={e => setForm(f => ({ ...f, sucursal: e.target.value }))}>
            {SUCURSALES.map(s => <option key={s} value={s}>{s}</option>)}
          </FSel>
          <FInput label="Puesto" icon="description" value={form.puesto} onChange={e => setForm(f => ({ ...f, puesto: e.target.value }))} placeholder="Ej. Cocinero" />
          <FInput label="Teléfono" icon="schedule" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} placeholder="Ej. 7777-1234" type="tel" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <OutlineBtn onClick={() => setModal(null)}>Cancelar</OutlineBtn>
            <CTABtn onClick={save_}>Guardar</CTABtn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MÓDULO ADELANTOS
// ═══════════════════════════════════════════════════════════════════════════════
function ModAdelantos({ data, setData, setToast, prefilledEmp, setPrefilledEmp }) {
  const [modal, setModal] = useState(false);
  const [comp, setComp] = useState(null);
  const [form, setForm] = useState({ empleadoId: prefilledEmp || "", fecha: today(), quincena: getQ(), cantidad: "", observacion: "" });
  const [q, setQ] = useState("");
  const [fEmp, setFEmp] = useState("");

  useEffect(() => {
    if (prefilledEmp) { setForm(f => ({ ...f, empleadoId: prefilledEmp })); setModal(true); setPrefilledEmp(""); }
  }, [prefilledEmp]);

  const activos = data.empleados.filter(e => e.activo !== false);
  const prevEmp = form.empleadoId ? data.adelantos.filter(a => a.empleadoId === form.empleadoId) : [];
  const prevTotal = prevEmp.reduce((s, a) => s + Number(a.cantidad), 0);
  const empSel = data.empleados.find(e => e.id === form.empleadoId);

  const save_ = () => {
    if (!form.empleadoId) return setToast("Selecciona un empleado");
    if (!form.cantidad || isNaN(form.cantidad) || Number(form.cantidad) <= 0) return setToast("Ingresa una cantidad válida");
    const nuevo = { id: Date.now() + "", ...form, cantidad: Number(form.cantidad) };
    setData(d => ({ ...d, adelantos: [nuevo, ...d.adelantos] }));
    const emp = data.empleados.find(e => e.id === form.empleadoId);
    setComp({ adelanto: nuevo, empleado: emp });
    setModal(false);
    setForm({ empleadoId: "", fecha: today(), quincena: getQ(), cantidad: "", observacion: "" });
    setToast("Adelanto registrado");
  };

  const list = data.adelantos
    .filter(a => {
      const n = (data.empleados.find(e => e.id === a.empleadoId)?.nombre || "").toLowerCase();
      return n.includes(q.toLowerCase()) && (fEmp ? a.empleadoId === fEmp : true);
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: T.secondary, margin: 0 }}>Operaciones</p>
          <h2 style={{ fontFamily: "'Manrope', sans-serif", fontSize: 24, fontWeight: 800, color: T.onSurface, margin: "4px 0 0" }}>Adelantos</h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: `${T.secondaryCont}44`, padding: "5px 12px", borderRadius: 20 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: T.secondary, display: "inline-block" }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: T.onSecondaryCont }}>Quincena Activa</span>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}><MI name="search" size={18} color={T.outline} fill /></span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar..."
            style={{ width: "100%", padding: "0 12px 0 38px", height: 46, boxSizing: "border-box", background: T.surfaceLow, border: "none", borderRadius: 10, fontSize: 14, fontFamily: "'Inter', sans-serif", color: T.onSurface, outline: "none" }} />
        </div>
        <select value={fEmp} onChange={e => setFEmp(e.target.value)}
          style={{ flex: 1, padding: "0 12px", height: 46, background: T.surfaceLow, border: "none", borderRadius: 10, fontSize: 13, fontFamily: "'Inter', sans-serif", color: T.onSurface, outline: "none", appearance: "none" }}>
          <option value="">Todos los empleados</option>
          {data.empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
      </div>

      {/* List */}
      {list.length === 0 && <div style={{ textAlign: "center", color: T.outline, marginTop: 48, fontSize: 14 }}>Sin adelantos registrados</div>}
      {list.map(adv => {
        const emp = data.empleados.find(e => e.id === adv.empleadoId);
        const ym = adv.fecha.substring(0, 7);
        const closed = data.quincenas_cerradas.includes(`${ym}_${adv.quincena}`);
        return (
          <div key={adv.id} style={{ background: T.surfaceLowest, borderRadius: 14, padding: "16px", marginBottom: 10, border: `1px solid ${T.outlineVar}18` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                <Avatar nombre={emp?.nombre || "?"} size={42} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: T.onSurface }}>{emp?.nombre || "—"}</div>
                  <div style={{ fontSize: 11, color: T.outline, textTransform: "uppercase", letterSpacing: ".06em" }}>{emp?.puesto || "—"}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                    <MI name="calendar" size={11} color={T.outline} fill />
                    <span style={{ fontSize: 11, color: T.outline }}>{adv.fecha}</span>
                    <StatusBadge color={closed ? T.onSurfaceVar : T.onSecondaryCont} bg={closed ? T.surfaceHighest : `${T.secondaryCont}44`}>
                      {adv.quincena === "01" ? "1ra" : "2da"} Qna {ym2label(ym)}{closed ? " 🔒" : ""}
                    </StatusBadge>
                  </div>
                  {adv.observacion && <div style={{ fontSize: 11, color: T.outline, marginTop: 4 }}>{adv.observacion}</div>}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, marginLeft: 8, flexShrink: 0 }}>
                <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 17, fontWeight: 800, color: T.secondary }}>{fmt$(adv.cantidad)}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setComp({ adelanto: adv, empleado: emp })}
                    style={{ background: "#25D36622", border: "none", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    <MI name="wa" size={15} color="#25D366" />
                  </button>
                  <button onClick={() => { if (window.confirm("¿Eliminar?")) setData(d => ({ ...d, adelantos: d.adelantos.filter(a => a.id !== adv.id) })); }}
                    style={{ background: T.errorCont, border: "none", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    <MI name="delete" size={15} color={T.error} fill />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* FAB */}
      <button onClick={() => setModal(true)} style={{
        position: "fixed", bottom: 90, right: 20, width: 54, height: 54,
        background: `linear-gradient(135deg, ${T.primary}, ${T.primaryCont})`,
        borderRadius: 16, border: "none", display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", boxShadow: "0 8px 28px rgba(0,50,125,.25)", zIndex: 40
      }}><MI name="add_circle" size={24} color="#fff" fill /></button>

      {modal && (
        <Modal title="Nuevo Adelanto" onClose={() => setModal(false)}>
          <section style={{ marginBottom: 10 }}>
            <h1 style={{ fontFamily: "'Manrope', sans-serif", fontSize: 22, fontWeight: 800, color: T.primary, margin: "0 0 4px" }}>Registrar Adelanto</h1>
            <p style={{ fontSize: 13, color: T.onSurfaceVar, margin: 0 }}>Registra un adelanto y genera un comprobante compartible.</p>
          </section>
          <div style={{ background: T.surfaceLowest, borderRadius: 14, padding: 16, marginBottom: 16, boxShadow: `0 2px 12px ${T.primary}0a` }}>
            <FSel label="Selección de Empleado" icon="person" value={form.empleadoId} onChange={e => setForm(f => ({ ...f, empleadoId: e.target.value }))}>
              <option value="">Seleccionar Empleado</option>
              {activos.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </FSel>
            {form.empleadoId && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: -8, marginBottom: 12 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: T.secondary, display: "inline-block" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: T.secondary, textTransform: "uppercase", letterSpacing: ".08em" }}>
                  Saldo actual: {fmt$(prevTotal)}
                </span>
              </div>
            )}
            {form.empleadoId && prevEmp.length > 0 && (
              <div style={{ background: `${T.secondaryCont}22`, borderRadius: 10, padding: "10px 12px", marginBottom: 12, border: `1px solid ${T.secondaryCont}44` }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: T.onSecondaryCont, marginBottom: 8 }}>Adelantos Previos</p>
                {prevEmp.slice(0, 3).map(a => (
                  <div key={a.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: T.onSurfaceVar }}>{a.fecha} · {a.quincena === "01" ? "1ra" : "2da"} Qna</span>
                    <span style={{ fontWeight: 700, color: T.secondary }}>{fmt$(a.cantidad)}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FInput label="Fecha" icon="calendar" type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
              <div style={{ marginBottom: 16 }}>
                <FieldLabel icon="schedule">Quincena</FieldLabel>
                <QuinenaToggle value={form.quincena} onChange={q => setForm(f => ({ ...f, quincena: q }))} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <FieldLabel icon="payments">Monto del Adelanto</FieldLabel>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontFamily: "'Manrope', sans-serif", fontSize: 22, fontWeight: 700, color: T.primary }}>$</span>
                <input type="number" value={form.cantidad} onChange={e => setForm(f => ({ ...f, cantidad: e.target.value }))} placeholder="0.00" min="0"
                  style={{ width: "100%", height: 64, paddingLeft: 32, paddingRight: 14, background: T.surfaceLow, border: "none", borderRadius: 10, fontSize: 28, fontFamily: "'Manrope', sans-serif", fontWeight: 800, color: T.primary, outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>
            <FTextarea label="Observaciones" icon="description" value={form.observacion} onChange={e => setForm(f => ({ ...f, observacion: e.target.value }))} placeholder="Agrega detalles opcionales..." />
          </div>

          {/* Preview */}
          {(form.empleadoId || form.cantidad) && (
            <div style={{ background: `linear-gradient(135deg, ${T.primary} 0%, ${T.primaryCont} 100%)`, borderRadius: 16, padding: "20px", marginBottom: 16, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, background: "rgba(255,255,255,.07)", borderRadius: "50%", filter: "blur(12px)" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <p style={{ fontSize: 9, letterSpacing: ".2em", opacity: .7, textTransform: "uppercase", color: "#fff", marginBottom: 4 }}>Vista Previa del Comprobante</p>
                  <h3 style={{ fontFamily: "'Manrope', sans-serif", fontSize: 16, fontWeight: 700, color: "#fff", margin: 0 }}>Comprobante de Adelanto</h3>
                </div>
                <MI name="verified" size={30} color="rgba(255,255,255,.35)" fill />
              </div>
              <div style={{ height: 1, background: "rgba(255,255,255,.2)", margin: "10px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                  <p style={{ fontSize: 9, opacity: .7, textTransform: "uppercase", letterSpacing: ".18em", color: "#fff", marginBottom: 4 }}>Para</p>
                  <p style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 15, color: "#fff", margin: 0 }}>{empSel?.nombre || "—"}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: 9, opacity: .7, textTransform: "uppercase", letterSpacing: ".18em", color: "#fff", marginBottom: 4 }}>Monto</p>
                  <p style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 22, color: "#fff", margin: 0 }}>{form.cantidad ? fmt$(form.cantidad) : "$0.00"}</p>
                </div>
              </div>
            </div>
          )}

          <button onClick={save_} style={{
            width: "100%", height: 60, background: `linear-gradient(90deg, ${T.primary}, ${T.primaryCont})`,
            color: "#fff", border: "none", borderRadius: 12, fontFamily: "'Manrope', sans-serif",
            fontWeight: 700, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center",
            justifyContent: "center", gap: 10, boxShadow: `0 6px 20px ${T.primary}33`, marginBottom: 8
          }}>
            <MI name="send" size={20} color="#fff" fill />Guardar y Generar Comprobante
          </button>
          <p style={{ textAlign: "center", color: T.outline, fontSize: 11, textTransform: "uppercase", letterSpacing: ".1em" }}>Se generará un comprobante para WhatsApp</p>
        </Modal>
      )}
      {comp && <Comprobante adelanto={comp.adelanto} empleado={comp.empleado} onClose={() => setComp(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MÓDULO HISTORIAL + DATOS
// ═══════════════════════════════════════════════════════════════════════════════
function ModHistorial({ data, setData, setToast, driveStatus, lastBackup, onBackup, onRestore }) {
  const fileRef = useRef();
  const [confirmRestore, setConfirmRestore] = useState(false);

  const total = data.adelantos.reduce((s, a) => s + Number(a.cantidad), 0);
  const avg = data.adelantos.length ? total / data.adelantos.length : 0;

  const byQ = {};
  data.adelantos.forEach(a => {
    const k = `${a.fecha.substring(0, 7)}_${a.quincena}`;
    if (!byQ[k]) byQ[k] = { total: 0, count: 0 };
    byQ[k].total += Number(a.cantidad);
    byQ[k].count++;
  });
  const qKeys = Object.keys(byQ).sort().reverse();

  const scCfg = {
    idle:    { color: T.secondary, icon: "cloud",         text: "Respaldo en la nube activo" },
    saving:  { color: T.primary,   icon: "cloud_upload",  text: "Guardando en la nube..." },
    ok:      { color: T.secondary, icon: "check_circle",  text: "Guardado correctamente" },
    error:   { color: T.error,     icon: "warning",       text: "Error al guardar" },
    loading: { color: T.primary,   icon: "restore",       text: "Restaurando desde la nube..." },
  }[driveStatus] || { color: T.secondary, icon: "cloud", text: "Nube activa" };

  const download = () => {
    const b = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const u = URL.createObjectURL(b); const a = document.createElement("a");
    a.href = u; a.download = `respaldo_${today()}.json`; a.click();
    setToast("Archivo descargado");
  };

  const importFile = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      try { const p = JSON.parse(ev.target.result); if (!p.empleados || !p.adelantos) throw 0; setData(p); setToast("Datos importados"); }
      catch { setToast("Archivo inválido"); }
    };
    r.readAsText(f); e.target.value = "";
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: T.secondary, margin: 0 }}>Estado Financiero</p>
          <h2 style={{ fontFamily: "'Manrope', sans-serif", fontSize: 22, fontWeight: 800, color: T.onSurface, margin: "4px 0 4px" }}>Historial & Datos</h2>
          <p style={{ fontSize: 13, color: T.onSurfaceVar, margin: 0 }}>Revisa ciclos anteriores y gestiona el respaldo de datos.</p>
        </div>
      </div>

      {/* Metrics grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Total Adelantos", val: `$${(total / 1000).toFixed(1)}k`, sub: "+vs anterior", subColor: T.secondary },
          { label: "Personal Activo", val: data.empleados.filter(e => e.activo !== false).length, sub: "registrados" },
          { label: "Período Abierto", val: fmt$(data.adelantos.filter(a => !data.quincenas_cerradas.includes(`${a.fecha.substring(0, 7)}_${a.quincena}`)).reduce((s, a) => s + Number(a.cantidad), 0)), sub: "Pendiente cierre", subColor: T.primary },
          { label: "Adelanto Promedio", val: fmt$(avg), sub: "por empleado" },
        ].map(m => (
          <div key={m.label} style={{ background: T.surfaceLowest, borderRadius: 12, padding: "16px", border: `1px solid ${T.outlineVar}18` }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: T.onSurfaceVar, marginBottom: 6 }}>{m.label}</p>
            <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 20, fontWeight: 800, color: T.onSurface, margin: "0 0 8px" }}>{m.val}</p>
            <p style={{ fontSize: 11, color: m.subColor || T.onSurfaceVar, fontWeight: 600, margin: 0 }}>{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Quincena groups */}
      <section style={{ marginBottom: 24 }}>
        <h3 style={{ fontFamily: "'Manrope', sans-serif", fontSize: 18, fontWeight: 700, color: T.onSurface, margin: "0 0 12px" }}>Historial por Quincena</h3>
        {qKeys.length === 0 && <div style={{ textAlign: "center", color: T.outline, padding: 24, fontSize: 14 }}>Sin registros aún</div>}
        {qKeys.map((k, ki) => {
          const [ym, qn] = k.split("_");
          const closed = data.quincenas_cerradas.includes(k);
          const qAdvs = data.adelantos.filter(a => a.fecha.startsWith(ym) && a.quincena === qn);
          const isFirst = ki === 0;
          return (
            <div key={k} style={{ background: closed ? `${T.surfaceLow}88` : `${T.surfaceLowest}`, borderRadius: 20, border: `1px solid ${T.outlineVar}18`, overflow: "hidden", marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", background: closed ? `${T.surfaceHigh}55` : `${T.surfaceLow}66` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {!closed && <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.primary, display: "inline-block" }} />}
                  {closed && <MI name="lock" size={18} color={T.outline} fill />}
                  <h3 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 14, color: closed ? T.onSurfaceVar : T.onSurface, margin: 0 }}>
                    {!closed && isFirst ? "Actual: " : ""}{qn === "01" ? "1ra" : "2da"} Quincena {ym2label(ym)}
                  </h3>
                </div>
                <StatusBadge color={closed ? T.onSurfaceVar : T.primary} bg={closed ? T.surfaceHighest : T.primaryFixed}>
                  {closed ? "Cerrada & Pagada" : "En Curso"}
                </StatusBadge>
              </div>
              {!closed && qAdvs.length > 0 && (
                <div style={{ padding: "8px" }}>
                  <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 4px" }}>
                    <thead>
                      <tr style={{ color: T.outline, fontSize: 10 }}>
                        {["Empleado", "Referencia", "Fecha", "Monto", "Estado"].map((h, i) => (
                          <th key={h} style={{ padding: "4px 12px 6px", fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", textAlign: i >= 3 ? "right" : "left" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {qAdvs.slice(0, 5).map(a => {
                        const emp = data.empleados.find(e => e.id === a.empleadoId);
                        return (
                          <tr key={a.id} style={{ background: T.surfaceLowest, borderRadius: 10 }}>
                            <td style={{ padding: "10px 12px", borderRadius: "10px 0 0 10px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <Avatar nombre={emp?.nombre || "?"} size={28} />
                                <div>
                                  <p style={{ fontSize: 12, fontWeight: 700, color: T.onSurface, margin: 0 }}>{emp?.nombre || "—"}</p>
                                  <p style={{ fontSize: 10, color: T.outline, margin: 0 }}>{emp?.puesto || "—"}</p>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: 11, color: T.outline, fontFamily: "monospace" }}>#{a.id.slice(-4)}</td>
                            <td style={{ padding: "10px 12px", fontSize: 11, color: T.outline }}>{a.fecha}</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 13, color: T.onSurface }}>{fmt$(a.cantidad)}</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", borderRadius: "0 10px 10px 0" }}>
                              <StatusBadge color={T.onSecondaryCont} bg={`${T.secondaryCont}44`}>Aprobado</StatusBadge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div style={{ padding: "12px 18px", borderTop: `1px solid ${T.outlineVar}18`, display: "flex", justifyContent: "space-between", alignItems: "center", background: `${T.surfaceLow}33` }}>
                <span style={{ fontSize: 12, color: T.onSurfaceVar }}>{byQ[k].count} adelantos</span>
                <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 15, fontWeight: 800, color: closed ? T.onSurfaceVar : T.primary }}>
                  Subtotal: {fmt$(byQ[k].total)}
                </span>
              </div>
            </div>
          );
        })}
      </section>

      {/* Respaldo en la nube */}
      <div style={{ background: T.onSurface, borderRadius: 20, padding: "24px 20px", marginBottom: 16, color: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <h3 style={{ fontFamily: "'Manrope', sans-serif", fontSize: 18, fontWeight: 800, color: "#fff", margin: "0 0 4px" }}>Respaldo en la Nube</h3>
            <p style={{ fontSize: 12, opacity: .7, margin: 0 }}>Último respaldo: {fmtDT(lastBackup)}</p>
          </div>
          <div style={{ width: 44, height: 44, background: "rgba(255,255,255,.1)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MI name={scCfg.icon} size={22} color="#fff" fill />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14, fontSize: 12, opacity: .75, flexDirection: "column" }}>
          <span>✓ Auto-guardado cada hora</span>
          <span>✓ Historial de versiones disponible</span>
          <span>Para soporte, contactar al <strong style={{ opacity: 1 }}>administrador de la aplicación</strong></span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onBackup} disabled={driveStatus === "saving"} style={{
            flex: 1, height: 44, background: "#fff", color: T.primary, border: "none", borderRadius: 10,
            fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: driveStatus === "saving" ? .6 : 1
          }}>
            <MI name="cloud_upload" size={16} color={T.primary} fill />{driveStatus === "saving" ? "Guardando..." : "Guardar ahora"}
          </button>
          <button onClick={() => setConfirmRestore(true)} disabled={driveStatus === "loading"} style={{
            flex: 1, height: 44, background: "rgba(255,255,255,.12)", color: "#fff", border: "1.5px solid rgba(255,255,255,.25)", borderRadius: 10,
            fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: driveStatus === "loading" ? .6 : 1
          }}>
            <MI name="restore" size={16} color="#fff" fill />{driveStatus === "loading" ? "Restaurando..." : "Restaurar"}
          </button>
        </div>
      </div>

      {/* Otras acciones */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        <GhostBtn onClick={download} style={{ height: 48, justifyContent: "flex-start", padding: "0 16px", width: "100%" }}>
          <MI name="cloud_download" size={18} color={T.onSurfaceVar} fill />Descargar copia local (.json)
        </GhostBtn>
        <GhostBtn onClick={() => fileRef.current?.click()} style={{ height: 48, justifyContent: "flex-start", padding: "0 16px", width: "100%" }}>
          <MI name="cloud_upload" size={18} color={T.onSurfaceVar} fill />Importar desde archivo
        </GhostBtn>
        <input ref={fileRef} type="file" accept=".json" onChange={importFile} style={{ display: "none" }} />
        <GhostBtn onClick={() => {
          const t = `📊 *Resumen Adelantos*\n👥 Empleados: ${data.empleados.length}\n📋 Registros: ${data.adelantos.length}\n💰 Total: ${fmt$(total)}\n📅 ${today()}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(t)}`, "_blank");
        }} style={{ height: 48, justifyContent: "flex-start", padding: "0 16px", width: "100%", background: "#25D36618", color: "#1a9c4a" }}>
          <MI name="wa" size={18} color="#25D366" />Compartir resumen por WhatsApp
        </GhostBtn>
        <GhostBtn onClick={() => { if (window.confirm("⚠️ ¿Borrar TODOS los datos? No se puede deshacer.")) { setData(INIT); setToast("Datos borrados"); } }}
          style={{ height: 48, justifyContent: "flex-start", padding: "0 16px", width: "100%", background: T.errorCont, color: T.error }}>
          <MI name="delete" size={18} color={T.error} fill />Borrar todos los datos
        </GhostBtn>
      </div>

      {confirmRestore && (
        <Modal title="Restaurar desde la nube" onClose={() => setConfirmRestore(false)}>
          <p style={{ fontSize: 14, color: T.onSurfaceVar, lineHeight: 1.6, marginTop: 0 }}>
            Reemplazará los datos de este dispositivo con el último respaldo.<br /><br />
            Útil para transferir datos a un teléfono nuevo o recuperar información.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <OutlineBtn onClick={() => setConfirmRestore(false)}>Cancelar</OutlineBtn>
            <CTABtn onClick={() => { setConfirmRestore(false); onRestore(); }}>Restaurar</CTABtn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP ROOT
// ═══════════════════════════════════════════════════════════════════════════════
function App() {
  const [data, setRaw] = useState(() => load() || INIT);
  const [tab, setTab] = useState("dashboard");
  const [toast, setToast] = useState("");
  const [ds, setDs] = useState("idle");
  const [lastTs, setLastTs] = useState(() => loadTs());
  const [prefilledEmp, setPrefilledEmp] = useState("");
  const debRef = useRef(null);
  const intRef = useRef(null);

  const setData = useCallback((u) => {
    setRaw(prev => { const next = typeof u === "function" ? u(prev) : u; save(next); return next; });
  }, []);

  const doBackup = useCallback(async (d) => {
    if (!d.empleados?.length && !d.adelantos?.length && !d.pagos?.length) return false;
    setDs("saving");
    try { const ts = await pushDrive(d); setLastTs(ts); setDs("ok"); setTimeout(() => setDs("idle"), 3000); return true; }
    catch { setDs("error"); setTimeout(() => setDs("idle"), 4000); return false; }
  }, []);

  const handleBackup = useCallback(async () => {
    const ok = await doBackup(data);
    setToast(ok ? "Guardado en la nube ✓" : "Error al guardar. Revisa tu conexión.");
  }, [data, doBackup]);

  const handleRestore = useCallback(async () => {
    setDs("loading");
    try {
      const r = await pullDrive();
      if (!r) { setToast("Sin respaldo disponible aún."); setDs("idle"); return; }
      delete r._at;
      if (!r.empleados || !r.adelantos) throw new Error();
      setData(r); setToast("Datos restaurados ✓");
    } catch { setToast("Error al restaurar. Revisa tu conexión."); }
    setDs("idle");
  }, [setData]);

  useEffect(() => {
    intRef.current = setInterval(() => { setRaw(c => { doBackup(c); return c; }); }, BACKUP_INTERVAL_MS);
    return () => clearInterval(intRef.current);
  }, [doBackup]);

  useEffect(() => {
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => doBackup(data), 15000);
    return () => clearTimeout(debRef.current);
  }, [data, doBackup]);

  const dsIcon = { idle: "cloud", saving: "cloud_upload", ok: "check_circle", error: "warning", loading: "restore" }[ds];
  const dsColor = { idle: T.outline, saving: T.primary, ok: T.secondary, error: T.error, loading: T.primary }[ds];

  const tabs = [
    { id: "dashboard", icon: "dashboard",  label: "Dashboard" },
    { id: "empleados", icon: "group",       label: "Personal" },
    { id: "adelantos", icon: "account_balance", label: "Adelanto" },
    { id: "diapago",   icon: "payments",    label: "Día Pago" },
    { id: "historial", icon: "history",     label: "Historial" },
  ];

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: T.surface, minHeight: "100vh", maxWidth: 540, margin: "0 auto", paddingBottom: 90 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap');
        @keyframes slideUp{from{transform:translateY(36px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes fadeUp{from{transform:translate(-50%,16px);opacity:0}to{transform:translate(-50%,0);opacity:1}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        *{box-sizing:border-box}
        input,select,textarea,button{font-family:'Inter',sans-serif}
        button:disabled{opacity:.5;cursor:not-allowed!important}
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}
      `}</style>

      {/* Top App Bar */}
      <header style={{
        position: "fixed", top: 0, width: "100%", maxWidth: 540, zIndex: 50,
        background: "rgba(255,255,255,.85)", backdropFilter: "blur(20px)",
        boxShadow: "0 1px 0 rgba(0,50,125,.06)", height: 64,
        display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <MI name="account_balance" size={22} color={T.primary} fill />
          <h1 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 17, color: T.primary, margin: 0, letterSpacing: "-.02em" }}>
            ADELANTO DE SALARIOS
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setTab("historial")} style={{ background: "none", border: "none", borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <MI name={dsIcon} size={20} color={dsColor} fill />
          </button>
          <button style={{ background: "none", border: "none", borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <MI name="notifications" size={20} color={T.outline} fill />
          </button>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: T.primaryFixed, border: `2px solid ${T.outlineVar}44`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MI name="person" size={18} color={T.primary} fill />
          </div>
        </div>
      </header>

      {/* Content */}
      <div style={{ padding: "80px 16px 16px" }}>
        {tab === "dashboard" && <ModDashboard data={data} setData={setData} setToast={setToast} setTab={setTab} setPrefilledEmp={setPrefilledEmp} />}
        {tab === "empleados" && <ModEmpleados data={data} setData={setData} setToast={setToast} prefilledEmp={prefilledEmp} setPrefilledEmp={setPrefilledEmp} />}
        {tab === "adelantos" && <ModAdelantos data={data} setData={setData} setToast={setToast} prefilledEmp={prefilledEmp} setPrefilledEmp={setPrefilledEmp} />}
        {tab === "diapago"   && <ModDiaPago  data={data} setData={setData} setToast={setToast}/>}
        {tab === "historial" && <ModHistorial data={data} setData={setData} setToast={setToast} driveStatus={ds} lastBackup={lastTs} onBackup={handleBackup} onRestore={handleRestore} />}
      </div>

      {/* Bottom Nav */}
      <nav style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 540, background: "rgba(255,255,255,.92)",
        backdropFilter: "blur(20px)", borderTop: `1px solid ${T.outlineVar}22`,
        borderRadius: "20px 20px 0 0", display: "flex", justifyContent: "space-around",
        alignItems: "center", padding: "10px 8px 20px", zIndex: 50,
        boxShadow: "0 -4px 20px rgba(0,0,0,.04)"
      }}>
        {tabs.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              padding: "8px 16px", borderRadius: 14, border: "none", cursor: "pointer",
              background: active ? "#e8f5ee" : "transparent",
              color: active ? T.secondary : T.outline, gap: 3, transition: "all .15s"
            }}>
              <MI name={t.icon} size={22} color={active ? T.secondary : T.outline} fill={active} />
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", marginTop: 1 }}>{t.label}</span>
            </button>
          );
        })}
      </nav>

      <Toast msg={toast} onClose={() => setToast("")} />
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════════════════════
// MÓDULO DÍA DE PAGO
// ═══════════════════════════════════════════════════════════════════════════════
function ModDiaPago({ data, setData, setToast }) {
  const [buscar, setBuscar] = useState("");
  const [empSel, setEmpSel] = useState(null);
  const [modalPago, setModalPago] = useState(false);
  const [salarioInput, setSalarioInput] = useState("");
  const [modalDetalle, setModalDetalle] = useState(null); // pago ya registrado

  // Quincena actual
  const mesActual = today().substring(0, 7);
  const qActual   = getQ();
  const qKey      = `${mesActual}_${qActual}`;

  // Empleados activos con sus adelantos de la quincena actual
  const empleadosConInfo = data.empleados
    .filter(e => e.activo !== false)
    .map(emp => {
      const adelantosQna = (data.adelantos || []).filter(
        a => a.empleadoId === emp.id &&
             a.fecha.startsWith(mesActual) &&
             a.quincena === qActual
      );
      const totalAdelantos = adelantosQna.reduce((s, a) => s + Number(a.cantidad), 0);
      const pagado = (data.pagos || []).find(
        p => p.empleadoId === emp.id && p.quincena === qActual && p.mes === mesActual
      );
      return { emp, adelantosQna, totalAdelantos, pagado };
    })
    .filter(x => x.emp.nombre.toLowerCase().includes(buscar.toLowerCase()) ||
                 (x.emp.puesto || "").toLowerCase().includes(buscar.toLowerCase()));

  const pendientes = empleadosConInfo.filter(x => !x.pagado);
  const pagados    = empleadosConInfo.filter(x =>  x.pagado);

  // Salario neto calculado
  const salarioNominal = parseFloat(salarioInput) || 0;
  const selInfo        = empSel ? empleadosConInfo.find(x => x.emp.id === empSel.id) : null;
  const totalAdelSel   = selInfo?.totalAdelantos || 0;
  const saldoAPagar    = Math.max(0, salarioNominal - totalAdelSel);

  const registrarPago = () => {
    if (!salarioInput || salarioNominal <= 0) return setToast("Ingresa el salario nominal");
    const pago = {
      id:              Date.now() + "",
      empleadoId:      empSel.id,
      mes:             mesActual,
      quincena:        qActual,
      fecha:           today(),
      salarioNominal,
      totalAdelantos:  totalAdelSel,
      saldoPagado:     saldoAPagar,
      adelantosIds:    selInfo.adelantosQna.map(a => a.id),
    };
    setData(d => ({ ...d, pagos: [...(d.pagos || []), pago] }));
    setToast(`Pago registrado para ${empSel.nombre} ✓`);
    setModalPago(false);
    setSalarioInput("");
    setEmpSel(null);
  };

  const totalPagadoQna  = pagados.reduce((s, x) => s + (x.pagado?.saldoPagado || 0), 0);
  const totalAdelQna    = empleadosConInfo.reduce((s, x) => s + x.totalAdelantos, 0);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: T.secondary, margin: 0 }}>Nómina</p>
          <h2 style={{ fontFamily: "'Manrope', sans-serif", fontSize: 24, fontWeight: 800, color: T.onSurface, margin: "4px 0 0" }}>Día de Pago</h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: `${T.secondaryCont}44`, padding: "5px 12px", borderRadius: 20 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: T.secondary, display: "inline-block" }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: T.onSecondaryCont }}>
            {qActual === "01" ? "1ra" : "2da"} Qna · {ym2label(mesActual)}
          </span>
        </div>
      </div>

      {/* Resumen quincena */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
        <div style={{ background: T.primary, borderRadius: 14, padding: "16px 14px" }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: T.primaryFixedDim, margin: "0 0 6px" }}>Pendientes</p>
          <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 26, fontWeight: 800, color: "#fff", margin: 0 }}>{pendientes.length}</p>
          <p style={{ fontSize: 11, color: T.primaryFixedDim, marginTop: 4 }}>empleados por pagar</p>
        </div>
        <div style={{ background: T.surfaceLowest, borderRadius: 14, padding: "16px 14px", border: `1px solid ${T.outlineVar}22` }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: T.outline, margin: "0 0 6px" }}>Adelantos Qna</p>
          <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 20, fontWeight: 800, color: T.accent || T.primary, margin: 0 }}>{fmt$(totalAdelQna)}</p>
          <p style={{ fontSize: 11, color: T.outline, marginTop: 4 }}>{pagados.length} pagados · {fmt$(totalPagadoQna)}</p>
        </div>
      </div>

      {/* Búsqueda */}
      <div style={{ position: "relative", marginBottom: 16 }}>
        <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}>
          <MI name="search" size={18} color={T.outline} fill />
        </span>
        <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar empleado..."
          style={{ width: "100%", padding: "0 14px 0 42px", height: 48, boxSizing: "border-box",
            background: T.surfaceLow, border: "none", borderRadius: 10,
            fontSize: 14, fontFamily: "'Inter', sans-serif", color: T.onSurface, outline: "none" }} />
      </div>

      {/* Pendientes de pago */}
      {pendientes.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: T.onSurfaceVar, margin: "0 0 10px" }}>
            Pendientes de pago ({pendientes.length})
          </p>
          {pendientes.map(({ emp, adelantosQna, totalAdelantos }) => (
            <div key={emp.id} style={{ background: T.surfaceLowest, borderRadius: 14, padding: "14px 16px",
              marginBottom: 8, border: `1px solid ${T.outlineVar}18`,
              display: "flex", alignItems: "center", gap: 12 }}
              onClick={() => { setEmpSel(emp); setModalPago(true); setSalarioInput(""); }}>
              <Avatar nombre={emp.nombre} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: T.onSurface }}>{emp.nombre}</div>
                <div style={{ fontSize: 12, color: T.outline, marginTop: 2 }}>{emp.puesto || "Sin puesto"}</div>
                <div style={{ fontSize: 12, color: T.primary, marginTop: 4, fontWeight: 600 }}>
                  {adelantosQna.length} adelanto{adelantosQna.length !== 1 ? "s" : ""} · {fmt$(totalAdelantos)}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                <span style={{ background: `${T.primaryFixed}`, color: T.primary, fontSize: 10,
                  fontWeight: 800, padding: "3px 9px", borderRadius: 6, textTransform: "uppercase" }}>Pendiente</span>
                <CTABtn onClick={e => { e.stopPropagation(); setEmpSel(emp); setModalPago(true); setSalarioInput(""); }}
                  style={{ padding: "6px 14px", fontSize: 12, height: "auto", borderRadius: 8 }}>
                  <MI name="payments" size={13} color="#fff" fill />Pagar
                </CTABtn>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ya pagados */}
      {pagados.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: T.onSurfaceVar, margin: "0 0 10px" }}>
            Pagados esta quincena ({pagados.length})
          </p>
          {pagados.map(({ emp, pagado }) => (
            <div key={emp.id} style={{ background: T.surfaceLowest, borderRadius: 14, padding: "14px 16px",
              marginBottom: 8, border: `1.5px solid ${T.secondary}22`,
              display: "flex", alignItems: "center", gap: 12, opacity: .85 }}
              onClick={() => setModalDetalle(pagado)}>
              <Avatar nombre={emp.nombre} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: T.onSurface }}>{emp.nombre}</div>
                <div style={{ fontSize: 12, color: T.outline, marginTop: 2 }}>{emp.puesto || "Sin puesto"}</div>
                <div style={{ fontSize: 12, color: T.secondary, marginTop: 4, fontWeight: 600 }}>
                  Pagado: {fmt$(pagado.saldoPagado)} · {pagado.fecha}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                <span style={{ background: `${T.secondaryCont}55`, color: T.secondary, fontSize: 10,
                  fontWeight: 800, padding: "3px 9px", borderRadius: 6, textTransform: "uppercase" }}>✓ Pagado</span>
                <GhostBtn onClick={e => { e.stopPropagation(); setModalDetalle(pagado); }}
                  style={{ padding: "5px 12px", fontSize: 12, height: "auto", borderRadius: 8 }}>
                  <MI name="visibility" size={13} color={T.onSurfaceVar} fill />Ver
                </GhostBtn>
              </div>
            </div>
          ))}
        </div>
      )}

      {empleadosConInfo.length === 0 && (
        <div style={{ textAlign: "center", color: T.outline, marginTop: 48, fontSize: 14 }}>
          Sin empleados activos
        </div>
      )}

      {/* ── MODAL REGISTRAR PAGO ─────────────────────────────────────────── */}
      {modalPago && selInfo && (
        <Modal title="Registrar Pago" onClose={() => { setModalPago(false); setEmpSel(null); }}>

          {/* Info empleado */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: T.surfaceLow,
            borderRadius: 12, padding: "12px 14px", marginBottom: 18 }}>
            <Avatar nombre={empSel.nombre} size={46} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: T.onSurface }}>{empSel.nombre}</div>
              <div style={{ fontSize: 13, color: T.outline }}>{empSel.puesto || "Sin puesto"}</div>
            </div>
          </div>

          {/* Adelantos de la quincena */}
          {selInfo.adelantosQna.length > 0 ? (
            <div style={{ background: `${T.primaryFixed}88`, borderRadius: 12, padding: "12px 14px", marginBottom: 16, border: `1px solid ${T.primary}22` }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".13em", textTransform: "uppercase", color: T.primary, margin: "0 0 10px" }}>
                Adelantos de esta quincena
              </p>
              {selInfo.adelantosQna.map(a => (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                  <span style={{ color: T.onSurfaceVar }}>{a.fecha}{a.observacion ? ` · ${a.observacion}` : ""}</span>
                  <span style={{ fontWeight: 700, color: T.primary }}>{fmt$(a.cantidad)}</span>
                </div>
              ))}
              <div style={{ height: 1, background: `${T.primary}22`, margin: "8px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 14 }}>
                <span style={{ color: T.primary }}>Total adelantos</span>
                <span style={{ color: T.primary }}>{fmt$(totalAdelSel)}</span>
              </div>
            </div>
          ) : (
            <div style={{ background: T.surfaceLow, borderRadius: 10, padding: "10px 14px", marginBottom: 16,
              fontSize: 13, color: T.outline }}>Sin adelantos en esta quincena.</div>
          )}

          {/* Ingresar salario */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".15em",
              textTransform: "uppercase", color: T.onSurfaceVar, marginBottom: 8 }}>
              Salario nominal de esta quincena
            </label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                fontFamily: "'Manrope', sans-serif", fontSize: 22, fontWeight: 700, color: T.primary }}>$</span>
              <input type="number" value={salarioInput} onChange={e => setSalarioInput(e.target.value)}
                placeholder="0.00" min="0"
                style={{ width: "100%", height: 64, paddingLeft: 32, paddingRight: 14,
                  background: T.surfaceLow, border: "none", borderRadius: 10,
                  fontSize: 28, fontFamily: "'Manrope', sans-serif", fontWeight: 800,
                  color: T.primary, outline: "none", boxSizing: "border-box" }} />
            </div>
          </div>

          {/* Resumen de pago */}
          {salarioNominal > 0 && (
            <div style={{ background: `linear-gradient(135deg, ${T.primary}, ${T.primaryCont})`,
              borderRadius: 14, padding: "18px 16px", marginBottom: 18, color: "#fff" }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".2em", opacity: .7,
                textTransform: "uppercase", margin: "0 0 12px" }}>Resumen de Liquidación</p>
              {[
                ["Salario nominal",  fmt$(salarioNominal)],
                ["Menos adelantos", `- ${fmt$(totalAdelSel)}`],
              ].map(([l, v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                  <span style={{ opacity: .8 }}>{l}</span>
                  <span style={{ fontWeight: 600 }}>{v}</span>
                </div>
              ))}
              <div style={{ height: 1, background: "rgba(255,255,255,.25)", margin: "10px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>Saldo a pagar</span>
                <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 26, fontWeight: 800 }}>
                  {fmt$(saldoAPagar)}
                </span>
              </div>
              {saldoAPagar === 0 && totalAdelSel >= salarioNominal && (
                <p style={{ fontSize: 12, opacity: .75, marginTop: 8, textAlign: "center" }}>
                  ⚠️ Los adelantos cubren o superan el salario nominal.
                </p>
              )}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <OutlineBtn onClick={() => { setModalPago(false); setEmpSel(null); }}>Cancelar</OutlineBtn>
            <CTABtn onClick={registrarPago} disabled={salarioNominal <= 0}>
              <MI name="check_circle" size={16} color="#fff" fill />Confirmar Pago
            </CTABtn>
          </div>
        </Modal>
      )}

      {/* ── MODAL DETALLE PAGO YA REGISTRADO ────────────────────────────── */}
      {modalDetalle && (() => {
        const emp  = data.empleados.find(e => e.id === modalDetalle.empleadoId);
        const advs = (data.adelantos || []).filter(a => modalDetalle.adelantosIds?.includes(a.id));
        const share = () => {
          const lines = [
            `💵 *Comprobante de Pago*`,
            `👤 ${emp?.nombre || "—"}`,
            `📅 ${modalDetalle.fecha} · ${modalDetalle.quincena === "01" ? "1ra" : "2da"} Qna ${ym2label(modalDetalle.mes)}`,
            ``,
            `Salario nominal:  ${fmt$(modalDetalle.salarioNominal)}`,
            `Menos adelantos:  - ${fmt$(modalDetalle.totalAdelantos)}`,
            `─────────────────────`,
            `Saldo pagado:     ${fmt$(modalDetalle.saldoPagado)}`,
          ].join("\n");
          window.open(`https://wa.me/?text=${encodeURIComponent(lines)}`, "_blank");
        };
        return (
          <Modal title="Detalle de Pago" onClose={() => setModalDetalle(null)}>
            {/* Encabezado recibo */}
            <div style={{ background: `linear-gradient(135deg, ${T.primary}, ${T.primaryCont})`,
              borderRadius: 16, padding: "20px", marginBottom: 16, color: "#fff", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80,
                background: "rgba(255,255,255,.07)", borderRadius: "50%", filter: "blur(12px)" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <p style={{ fontSize: 9, letterSpacing: ".2em", opacity: .7, textTransform: "uppercase", margin: "0 0 4px" }}>Comprobante de Pago</p>
                  <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 17, fontWeight: 800, margin: 0 }}>{emp?.nombre || "—"}</p>
                  <p style={{ fontSize: 12, opacity: .75, marginTop: 2 }}>
                    {emp?.puesto || "—"} · {modalDetalle.quincena === "01" ? "1ra" : "2da"} Qna {ym2label(modalDetalle.mes)}
                  </p>
                </div>
                <MI name="check_circle" size={32} color="rgba(255,255,255,.5)" fill />
              </div>
              <div style={{ height: 1, background: "rgba(255,255,255,.2)", margin: "10px 0" }} />
              {[
                ["Fecha de pago",    modalDetalle.fecha],
                ["Salario nominal",  fmt$(modalDetalle.salarioNominal)],
                ["Total adelantos",  `- ${fmt$(modalDetalle.totalAdelantos)}`],
              ].map(([l, v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                  <span style={{ opacity: .75 }}>{l}</span>
                  <span style={{ fontWeight: 600 }}>{v}</span>
                </div>
              ))}
              <div style={{ height: 1, background: "rgba(255,255,255,.2)", margin: "10px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>Saldo pagado</span>
                <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 24, fontWeight: 800 }}>
                  {fmt$(modalDetalle.saldoPagado)}
                </span>
              </div>
            </div>

            {/* Adelantos incluidos */}
            {advs.length > 0 && (
              <div style={{ background: T.surfaceLow, borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".13em", textTransform: "uppercase",
                  color: T.onSurfaceVar, margin: "0 0 8px" }}>Adelantos incluidos</p>
                {advs.map(a => (
                  <div key={a.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: T.onSurfaceVar }}>{a.fecha}{a.observacion ? ` · ${a.observacion}` : ""}</span>
                    <span style={{ fontWeight: 600, color: T.primary }}>{fmt$(a.cantidad)}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <OutlineBtn onClick={() => setModalDetalle(null)}>Cerrar</OutlineBtn>
              <CTABtn onClick={share} style={{ background: "#25D366", boxShadow: "0 4px 16px rgba(37,211,102,.2)" }}>
                <MI name="wa" size={16} color="#fff" />WhatsApp
              </CTABtn>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}

if (typeof window.__appLoaded === 'function') window.__appLoaded();
