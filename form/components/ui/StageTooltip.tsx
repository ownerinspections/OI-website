"use client";

import React, { useState, useRef, useEffect } from 'react';

interface StageTooltipProps {
  serviceId: number;
  stageNumber: number;
  children: React.ReactNode;
}

export default function StageTooltip({ serviceId, stageNumber, children }: StageTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [description, setDescription] = useState<string | null>(null);
  const [stageName, setStageName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasDescription, setHasDescription] = useState<boolean | null>(null); // null = not checked yet, true = has description, false = no description
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const fetchStageDescription = async () => {
    if (description !== null || isLoading) return; // Already fetched or currently loading
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/services/${serviceId}/stage/${stageNumber}/description`);
      if (response.ok) {
        const data = await response.json();
        if (data.description && data.description !== 'No description available for this stage') {
          setDescription(data.description);
          setStageName(data.stage_name || `Stage ${stageNumber}`);
          setHasDescription(true);
        } else {
          setDescription(''); // Empty string means no description available
          setStageName(data.stage_name || `Stage ${stageNumber}`);
          setHasDescription(false);
        }
      } else {
        setError('Failed to load stage description');
        setHasDescription(false);
      }
    } catch (err) {
      setError('Failed to load stage description');
      setHasDescription(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Check if stage has description on component mount
  useEffect(() => {
    fetchStageDescription();
  }, [serviceId, stageNumber]);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      fetchStageDescription();
    }, 500); // 500ms delay before showing tooltip
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 200); // 200ms delay before hiding tooltip
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
    left: 'calc(100% + 12px)',
    transform: 'translateY(-50%)',
    backgroundColor: 'var(--color-pale-gray)',
    border: '1px solid var(--color-light-gray)',
    borderRadius: '6px',
    padding: '8px 12px',
    fontSize: '12px',
    lineHeight: '1.4',
    color: 'var(--color-charcoal)',
    zIndex: 1000,
    maxWidth: '280px',
    minWidth: '200px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    whiteSpace: 'normal',
    wordWrap: 'break-word',
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
          {description && !isLoading && !error && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>{stageName}</div>
              <div>{description}</div>
            </div>
          )}
          <div style={arrowStyle}></div>
        </div>
      )}
    </div>
  );
}
