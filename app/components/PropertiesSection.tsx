"use client";

import { useState } from "react";

type PropertiesSectionProps = {
  properties: Record<string, string>;
  onSetProperty: (key: string, value: string) => void;
  onDeleteProperty: (key: string) => void;
  disabled: boolean;
};

export function PropertiesSection({ properties, onSetProperty, onDeleteProperty, disabled }: PropertiesSectionProps) {
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const propertyKeys = Object.keys(properties).sort();

  const handleAddProperty = () => {
    if (!newKey.trim()) return;
    onSetProperty(newKey.trim(), newValue);
    setNewKey("");
    setNewValue("");
  };

  const handleStartEdit = (key: string) => {
    setEditingKey(key);
    setEditValue(properties[key]);
  };

  const handleSaveEdit = () => {
    if (editingKey) {
      onSetProperty(editingKey, editValue);
      setEditingKey(null);
      setEditValue("");
    }
  };

  const handleCancelEdit = () => {
    setEditingKey(null);
    setEditValue("");
  };

  return (
    <div className="section">
      <div className="section-header">
        <h2>Properties</h2>
        <span className="badge">{propertyKeys.length}</span>
      </div>
      <p className="section-desc">
        Store any key-value data. Changes sync instantly across all your devices.
      </p>

      {/* Add new property */}
      <div className="add-property-form">
        <input
          type="text"
          placeholder="Key"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          disabled={disabled}
          className="input-small"
        />
        <input
          type="text"
          placeholder="Value"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          disabled={disabled}
          onKeyDown={(e) => e.key === "Enter" && handleAddProperty()}
        />
        <button onClick={handleAddProperty} disabled={disabled || !newKey.trim()}>
          Add
        </button>
      </div>

      {/* Property list */}
      {propertyKeys.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">◈</span>
          <p>No properties yet</p>
          <span className="empty-hint">Add your first property above</span>
        </div>
      ) : (
        <ul className="property-list">
          {propertyKeys.map((key) => (
            <li key={key} className="property-item">
              {editingKey === key ? (
                <div className="property-edit">
                  <span className="property-key">{key}</span>
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveEdit();
                      if (e.key === "Escape") handleCancelEdit();
                    }}
                    autoFocus
                    disabled={disabled}
                  />
                  <div className="property-actions">
                    <button className="small" onClick={handleSaveEdit} disabled={disabled}>
                      Save
                    </button>
                    <button className="small secondary" onClick={handleCancelEdit}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="property-content" onClick={() => handleStartEdit(key)}>
                    <span className="property-key">{key}</span>
                    <span className="property-value">{properties[key] || <em className="empty">empty</em>}</span>
                  </div>
                  <button
                    className="small danger"
                    onClick={() => onDeleteProperty(key)}
                    disabled={disabled}
                  >
                    Delete
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
