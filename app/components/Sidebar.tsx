"use client";

import { useState } from "react";
import { CopyableEntityId } from "./CopyableEntityId";

type NavItem = {
  id: string;
  label: string;
  icon: string;
};

const navItems: NavItem[] = [
  { id: "properties", label: "Properties", icon: "◈" },
  { id: "sharing", label: "Sharing", icon: "⬡" },
  { id: "devices", label: "Devices", icon: "⬢" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

type SidebarProps = {
  activeSection: string;
  onSectionChange: (section: string) => void;
  entityId: string | null;
  connected: boolean;
  onLogout: () => void;
};

export function Sidebar({ activeSection, onSectionChange, entityId, connected, onLogout }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNavClick = (id: string) => {
    onSectionChange(id);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile header */}
      <header className="mobile-header">
        <button className="menu-toggle" onClick={() => setMobileOpen(!mobileOpen)}>
          <span className="menu-icon">{mobileOpen ? "✕" : "☰"}</span>
        </button>
        <div className="mobile-title">
          <span className="logo">◇</span>
          <span>Vault</span>
        </div>
        <div className={`status-dot ${connected ? "connected" : "disconnected"}`} />
      </header>

      {/* Sidebar */}
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <div className="brand">
            <span className="logo">◇</span>
            <span className="brand-name">Vault</span>
          </div>
          <div className={`status-indicator ${connected ? "connected" : "disconnected"}`}>
            {connected ? "● Live" : "○ Offline"}
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activeSection === item.id ? "active" : ""}`}
              onClick={() => handleNavClick(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          {entityId && (
            <div className="entity-info">
              <span className="entity-label">Entity</span>
              <CopyableEntityId entityId={entityId} short className="entity-id" />
            </div>
          )}
          <button className="logout-btn" onClick={onLogout}>
            Log out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}
    </>
  );
}
