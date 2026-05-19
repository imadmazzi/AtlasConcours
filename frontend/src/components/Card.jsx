import React from 'react';
import { Link } from 'react-router-dom';
import { T } from './T';

export default function Card({ id, title, type, date, excerpt, linkTo, linkTextFr, linkTextAr }) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="badge">{type}</span>
        <span className="card-date">
          {(() => {
            if (!date) return "N/A";
            const d = new Date(date);
            return isNaN(d.getTime()) ? date : d.toLocaleDateString();
          })()}
        </span>
      </div>
      <h3 className="card-title">{title}</h3>
      <p className="card-body">
        {excerpt}
      </p>
      <div className="card-footer">
        <Link to={linkTo} className="btn-primary">
          <T fr={linkTextFr} arKey={linkTextAr} />
        </Link>
      </div>
    </div>
  );
}
