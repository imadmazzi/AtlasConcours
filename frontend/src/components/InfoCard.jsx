import React from 'react';

/**
 * InfoRow — a single label/value pair. Hidden if value is falsy.
 */
function InfoRow({ icon, label, value, urgent }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className={`ic-row${urgent ? ' ic-row--urgent' : ''}`}>
      <div className="ic-label">
        <span className="ic-icon"><i className={`fa ${icon}`}></i></span>
        <span className="ic-label-text">{label}</span>
      </div>
      <div className="ic-value">{value}</div>
    </div>
  );
}

/**
 * InfoCard — white rounded card showing structured field/value rows.
 *
 * Props:
 *   title   string  Card heading (default: "Description de l'annonce")
 *   fields  array   [{ icon: 'fa-xxx', label: '...', value: '...', urgent?: bool }]
 */
export default function InfoCard({ title = "Description de l'annonce", fields = [] }) {
  const visible = fields.filter(
    f => f.value !== null && f.value !== undefined && f.value !== ''
  );

  return (
    <div className="ic-card">
      <h2 className="ic-title">
        <i className="fa fa-list-ul ic-title-icon"></i>
        {title}
      </h2>
      <div className="ic-rows">
        {visible.length === 0 ? (
          <p className="ic-empty">Aucune information disponible.</p>
        ) : (
          visible.map((f, i) => (
            <InfoRow
              key={i}
              icon={f.icon}
              label={f.label}
              value={f.value}
              urgent={!!f.urgent}
            />
          ))
        )}
      </div>
    </div>
  );
}
