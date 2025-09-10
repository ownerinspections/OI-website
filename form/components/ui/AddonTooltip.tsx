"use client";

import React, { useState, useRef, useEffect } from 'react';

interface AddonTooltipProps {
  addonId: number;
  children: React.ReactNode;
}

export default function AddonTooltip({ addonId, children }: AddonTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [description, setDescription] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasDescription, setHasDescription] = useState<boolean | null>(null); // null = not checked yet, true = has description, false = no description
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const fetchDescription = async () => {
    if (description !== null || isLoading) return; // Already fetched or currently loading
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/addons/${addonId}/description`);
      if (response.ok) {
        const data = await response.json();
        if (data.description && data.description !== 'No description available for this addon') {
          setDescription(data.description);
          setHasDescription(true);
        } else {
          setDescription(''); // Empty string means no description available
          setHasDescription(false);
        }
      } else {
        setError('Failed to load description');
        setHasDescription(false);
      }
    } catch (err) {
      setError('Failed to load description');
      setHasDescription(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Check if addon has description on component mount
  useEffect(() => {
    const checkDescription = async () => {
      try {
        const response = await fetch(`/api/addons/${addonId}/description`);
        if (response.ok) {
          const data = await response.json();
          if (data.description && data.description !== 'No description available for this addon') {
            setHasDescription(true);
          } else {
            setHasDescription(false);
          }
        } else {
          setHasDescription(false);
        }
      } catch (err) {
        setHasDescription(false);
      }
    };

    checkDescription();
  }, [addonId]);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      fetchDescription();
    }, 300); // 300ms delay before showing tooltip
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    left: '100%',
    transform: 'translateY(-50%)',
    backgroundColor: 'var(--color-pale-gray)',
    color: '#262626',
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    lineHeight: '1.4',
    maxWidth: '300px',
    zIndex: 1000,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    marginLeft: '8px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  const arrowStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    left: '-6px',
    transform: 'translateY(-50%)',
    width: 0,
    height: 0,
    borderTop: '6px solid transparent',
    borderBottom: '6px solid transparent',
    borderRight: '6px solid var(--color-pale-gray)',
  };

  const iconStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    cursor: 'pointer',
    color: '#2c9bd6',
    marginLeft: '6px',
  };

  return (
    <div 
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={hasDescription ? handleMouseEnter : undefined}
      onMouseLeave={hasDescription ? handleMouseLeave : undefined}
    >
      {children}
      {hasDescription && (
        <div style={iconStyle}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
            <line x1="12" y1="10" x2="12" y2="16" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="7" r="1" fill="currentColor" />
          </svg>
        </div>
      )}
      
      {isVisible && hasDescription && (description || isLoading || error) && (
        <div ref={tooltipRef} style={tooltipStyle}>
          {isLoading && <div>Loading...</div>}
          {error && <div style={{ color: '#ef4444' }}>{error}</div>}
          {description && !isLoading && !error && <div>{description}</div>}
          <div style={arrowStyle}></div>
        </div>
      )}
    </div>
  );
}
