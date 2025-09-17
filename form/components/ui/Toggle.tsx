"use client";

import React from "react";

interface ToggleProps {
	checked: boolean;
	onChange: (next: boolean) => void;
	disabled?: boolean;
	size?: "small" | "medium" | "large";
	className?: string;
}

export default function Toggle({ 
	checked, 
	onChange, 
	disabled = false, 
	size = "medium",
	className = ""
}: ToggleProps) {
	const sizeConfig = {
		small: { width: 32, height: 18, knobSize: 14, knobOffset: 16 },
		medium: { width: 44, height: 24, knobSize: 20, knobOffset: 20 },
		large: { width: 56, height: 30, knobSize: 26, knobOffset: 24 }
	};

	const config = sizeConfig[size];

	const trackStyle: React.CSSProperties = {
		width: config.width,
		height: config.height,
		borderRadius: 999,
		background: checked ? "var(--color-primary)" : "#d9d9d9",
		position: "relative",
		border: "none",
		outline: "none",
		cursor: disabled ? "not-allowed" : "pointer",
		padding: 2,
		display: "inline-flex",
		alignItems: "center",
		opacity: disabled ? 0.6 : 1,
		transition: "background-color 0.15s ease-in-out",
	};

	const knobStyle: React.CSSProperties = {
		width: config.knobSize,
		height: config.knobSize,
		borderRadius: 999,
		background: "#fff",
		boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
		transform: checked ? `translateX(${config.knobOffset}px)` : "translateX(0px)",
		transition: "transform 0.15s ease-in-out",
	};

	const handleClick = () => {
		if (!disabled) {
			onChange(!checked);
		}
	};

	return (
		<button 
			type="button" 
			role="switch" 
			aria-checked={checked}
			aria-disabled={disabled}
			onClick={handleClick} 
			style={trackStyle}
			className={className}
		>
			<span style={knobStyle} />
		</button>
	);
}
