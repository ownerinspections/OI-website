"use client";

import React from 'react';

interface SkeletonLoaderProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export default function SkeletonLoader({ className = "", style = {}, children }: SkeletonLoaderProps) {
  return (
    <div className={`skeleton-loader ${className}`} style={style}>
      {children}
    </div>
  );
}

// Individual skeleton components for different form elements
export function SkeletonField({ width = "100%", height = "44px" }: { width?: string; height?: string }) {
  return (
    <div 
      className="skeleton-field" 
      style={{ width, height }}
    />
  );
}

export function SkeletonButton({ width = "140px", height = "44px" }: { width?: string; height?: string }) {
  return (
    <div 
      className="skeleton-button" 
      style={{ width, height }}
    />
  );
}

export function SkeletonText({ lines = 1, width = "100%" }: { lines?: number; width?: string }) {
  return (
    <div className="skeleton-text-container" style={{ width }}>
      {Array.from({ length: lines }).map((_, index) => (
        <div 
          key={index}
          className="skeleton-text" 
          style={{ 
            width: index === lines - 1 ? "75%" : "100%",
            marginBottom: index < lines - 1 ? "8px" : "0"
          }}
        />
      ))}
    </div>
  );
}

// Form skeleton that mimics the contact form structure
export function ContactFormSkeleton() {
  return (
    <div className="form-grid" style={{ display: "grid", gap: 16 }}>
      <div>
        <SkeletonText lines={1} width="80px" />
        <SkeletonField width="100%" height="44px" />
      </div>
      <div>
        <SkeletonText lines={1} width="80px" />
        <SkeletonField width="100%" height="44px" />
      </div>
      <div>
        <SkeletonText lines={1} width="60px" />
        <SkeletonField width="100%" height="44px" />
      </div>
      <div>
        <SkeletonText lines={1} width="60px" />
        <SkeletonField width="100%" height="44px" />
      </div>
      <div style={{ gridColumn: "1 / -1" }}>
        <SkeletonText lines={1} width="120px" />
        <SkeletonField width="100%" height="44px" />
      </div>
      <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
        <SkeletonButton width="140px" height="44px" />
      </div>
    </div>
  );
}

// Property form skeleton that mimics the property form structure
export function PropertyFormSkeleton() {
  return (
    <div className="form-grid" style={{ display: "grid", gap: 16 }}>
      <div style={{ gridColumn: "1 / -1" }}>
        <SkeletonText lines={1} width="100px" />
        <SkeletonField width="100%" height="44px" />
      </div>
      <div>
        <SkeletonText lines={1} width="80px" />
        <SkeletonField width="100%" height="44px" />
      </div>
      <div>
        <SkeletonText lines={1} width="80px" />
        <SkeletonField width="100%" height="44px" />
      </div>
      <div>
        <SkeletonText lines={1} width="100px" />
        <SkeletonField width="100%" height="44px" />
      </div>
      <div>
        <SkeletonText lines={1} width="80px" />
        <SkeletonField width="100%" height="44px" />
      </div>
      <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between" }}>
        <SkeletonButton width="120px" height="44px" />
        <SkeletonButton width="140px" height="44px" />
      </div>
    </div>
  );
}

// Phone verification form skeleton
export function PhoneVerificationSkeleton() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <SkeletonText lines={1} width="80px" />
        <SkeletonField width="100%" height="44px" />
      </div>
      <div>
        <SkeletonText lines={1} width="120px" />
        <SkeletonField width="100%" height="44px" />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <SkeletonButton width="120px" height="44px" />
        <SkeletonButton width="140px" height="44px" />
      </div>
    </div>
  );
}

// Quote form skeleton that mimics the quote form structure
export function QuoteFormSkeleton() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Quote details section */}
      <div style={{ gridColumn: "1 / -1" }}>
        <SkeletonText lines={1} width="120px" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 8 }}>
          <SkeletonField width="100%" height="44px" />
          <SkeletonField width="100%" height="44px" />
        </div>
      </div>
      
      {/* Addons section */}
      <div style={{ gridColumn: "1 / -1" }}>
        <SkeletonText lines={1} width="100px" />
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <SkeletonField width="20px" height="20px" />
              <SkeletonText lines={1} width="200px" />
              <SkeletonText lines={1} width="80px" />
            </div>
          ))}
        </div>
      </div>
      
      {/* Total section */}
      <div style={{ gridColumn: "1 / -1", borderTop: "1px solid var(--color-light-gray)", paddingTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <SkeletonText lines={1} width="100px" />
          <SkeletonText lines={1} width="80px" />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <SkeletonText lines={1} width="80px" />
          <SkeletonText lines={1} width="60px" />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
          <SkeletonText lines={1} width="120px" />
          <SkeletonText lines={1} width="100px" />
        </div>
      </div>
      
      {/* Actions */}
      <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between" }}>
        <SkeletonButton width="120px" height="44px" />
        <SkeletonButton width="140px" height="44px" />
      </div>
    </div>
  );
}

// Invoice form skeleton
export function InvoiceFormSkeleton() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Customer details */}
      <div style={{ gridColumn: "1 / -1" }}>
        <SkeletonText lines={1} width="120px" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 8 }}>
          <div>
            <SkeletonText lines={1} width="80px" />
            <SkeletonField width="100%" height="44px" />
          </div>
          <div>
            <SkeletonText lines={1} width="80px" />
            <SkeletonField width="100%" height="44px" />
          </div>
        </div>
      </div>
      
      {/* Invoice items */}
      <div style={{ gridColumn: "1 / -1" }}>
        <SkeletonText lines={1} width="100px" />
        <div style={{ marginTop: 8 }}>
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 16, marginBottom: 8 }}>
              <SkeletonField width="100%" height="44px" />
              <SkeletonField width="100%" height="44px" />
              <SkeletonField width="100%" height="44px" />
            </div>
          ))}
        </div>
      </div>
      
      {/* Actions */}
      <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between" }}>
        <SkeletonButton width="120px" height="44px" />
        <SkeletonButton width="140px" height="44px" />
      </div>
    </div>
  );
}

// Payment form skeleton
export function PaymentFormSkeleton() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Payment details */}
      <div style={{ gridColumn: "1 / -1" }}>
        <SkeletonText lines={1} width="120px" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 8 }}>
          <div>
            <SkeletonText lines={1} width="100px" />
            <SkeletonField width="100%" height="44px" />
          </div>
          <div>
            <SkeletonText lines={1} width="100px" />
            <SkeletonField width="100%" height="44px" />
          </div>
        </div>
      </div>
      
      {/* Card details */}
      <div style={{ gridColumn: "1 / -1" }}>
        <SkeletonText lines={1} width="100px" />
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 16, marginTop: 8 }}>
          <SkeletonField width="100%" height="44px" />
          <SkeletonField width="100%" height="44px" />
          <SkeletonField width="100%" height="44px" />
        </div>
      </div>
      
      {/* Actions */}
      <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "center" }}>
        <SkeletonButton width="200px" height="44px" />
      </div>
    </div>
  );
}

// Receipt page skeleton (static content)
export function ReceiptSkeleton() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Receipt header */}
      <div style={{ gridColumn: "1 / -1", textAlign: "center" }}>
        <SkeletonText lines={1} width="200px" />
        <SkeletonText lines={1} width="150px" />
      </div>
      
      {/* Receipt details */}
      <div style={{ gridColumn: "1 / -1" }}>
        <SkeletonText lines={1} width="120px" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 8 }}>
          <div>
            <SkeletonText lines={1} width="80px" />
            <SkeletonText lines={1} width="120px" />
          </div>
          <div>
            <SkeletonText lines={1} width="80px" />
            <SkeletonText lines={1} width="100px" />
          </div>
        </div>
      </div>
      
      {/* Payment summary */}
      <div style={{ gridColumn: "1 / -1", borderTop: "1px solid var(--color-light-gray)", paddingTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <SkeletonText lines={1} width="100px" />
          <SkeletonText lines={1} width="80px" />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
          <SkeletonText lines={1} width="120px" />
          <SkeletonText lines={1} width="100px" />
        </div>
      </div>
      
      {/* Actions */}
      <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "center" }}>
        <SkeletonButton width="180px" height="44px" />
      </div>
    </div>
  );
}

// Booking form skeleton
export function BookingFormSkeleton() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Booking details */}
      <div style={{ gridColumn: "1 / -1" }}>
        <SkeletonText lines={1} width="120px" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 8 }}>
          <div>
            <SkeletonText lines={1} width="80px" />
            <SkeletonField width="100%" height="44px" />
          </div>
          <div>
            <SkeletonText lines={1} width="80px" />
            <SkeletonField width="100%" height="44px" />
          </div>
        </div>
      </div>
      
      {/* Contact information */}
      <div style={{ gridColumn: "1 / -1" }}>
        <SkeletonText lines={1} width="100px" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 8 }}>
          <div>
            <SkeletonText lines={1} width="80px" />
            <SkeletonField width="100%" height="44px" />
          </div>
          <div>
            <SkeletonText lines={1} width="80px" />
            <SkeletonField width="100%" height="44px" />
          </div>
        </div>
      </div>
      
      {/* Additional fields */}
      <div style={{ gridColumn: "1 / -1" }}>
        <SkeletonText lines={1} width="100px" />
        <SkeletonField width="100%" height="44px" />
      </div>
      
      {/* Actions */}
      <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between" }}>
        <SkeletonButton width="120px" height="44px" />
        <SkeletonButton width="140px" height="44px" />
      </div>
    </div>
  );
}

// Thank you page skeleton (static content)
export function ThankYouSkeleton() {
  return (
    <div style={{ display: "grid", gap: 16, textAlign: "center" }}>
      {/* Success message */}
      <div style={{ gridColumn: "1 / -1" }}>
        <SkeletonText lines={1} width="300px" />
        <SkeletonText lines={1} width="250px" />
      </div>
      
      {/* Summary details */}
      <div style={{ gridColumn: "1 / -1" }}>
        <SkeletonText lines={1} width="120px" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 8 }}>
          <div>
            <SkeletonText lines={1} width="80px" />
            <SkeletonText lines={1} width="120px" />
          </div>
          <div>
            <SkeletonText lines={1} width="80px" />
            <SkeletonText lines={1} width="100px" />
          </div>
        </div>
      </div>
      
      {/* Next steps */}
      <div style={{ gridColumn: "1 / -1" }}>
        <SkeletonText lines={1} width="100px" />
        <SkeletonText lines={1} width="200px" />
        <SkeletonText lines={1} width="180px" />
      </div>
      
      {/* Actions */}
      <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "center" }}>
        <SkeletonButton width="160px" height="44px" />
      </div>
    </div>
  );
}
