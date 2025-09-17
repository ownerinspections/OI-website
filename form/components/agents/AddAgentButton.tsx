"use client";

import { useState } from "react";
import TextField from "@/components/ui/fields/TextField";
import AuPhoneField from "@/components/ui/fields/AuPhoneField";
import EmailField from "@/components/ui/fields/EmailField";

interface AddAgentButtonProps {
    onAgentAdded?: (agentIndex: number) => void;
}

export default function AddAgentButton({ onAgentAdded }: AddAgentButtonProps) {
    const [agentCount, setAgentCount] = useState(0);

    const addAgent = () => {
        setAgentCount(prev => prev + 1);
        onAgentAdded?.(agentCount + 1);
    };

    const removeAgent = (index: number) => {
        setAgentCount(prev => prev - 1);
    };

    const handleRemoveAgent = (index: number) => () => {
        removeAgent(index);
    };

    return (
        <div>
            {agentCount > 0 && (
                <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                    {Array.from({ length: agentCount }, (_, index) => (
                        <div key={index} style={{ position: "relative", display: "grid", gap: 8, padding: 12, border: "1px dashed var(--color-light-gray)", borderRadius: 6, backgroundColor: "var(--color-pale-gray)" }}>
                            <button 
                                type="button" 
                                onClick={handleRemoveAgent(index)}
                                style={{
                                    position: "absolute",
                                    top: 8,
                                    right: 8,
                                    width: "20px",
                                    height: "20px",
                                    backgroundColor: "transparent",
                                    color: "var(--color-text-muted)",
                                    border: "none",
                                    borderRadius: "50%",
                                    cursor: "pointer",
                                    fontSize: "14px",
                                    fontWeight: "400",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    zIndex: 1
                                }}
                            >
                                ×
                            </button>
                            <div style={{ display: "grid", gap: 8 }}>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                    <TextField name={`new_agent_${index + 2}_first_name`} label="First name" required />
                                    <TextField name={`new_agent_${index + 2}_last_name`} label="Last name" required />
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                    <EmailField name={`new_agent_${index + 2}_email`} label="Email (optional)" />
                                    <AuPhoneField name={`new_agent_${index + 2}_mobile`} label="Mobile" required />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 8 }}>
                <button 
                    type="button" 
                    onClick={addAgent}
                    style={{
                        padding: "6px 12px",
                        backgroundColor: "transparent",
                        color: "var(--color-secondary-blue)",
                        border: "1px solid var(--color-secondary-blue)",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: "500"
                    }}
                >
                    + Add Real Estate Agent
                </button>
            </div>
        </div>
    );
}
