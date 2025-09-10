"use client";

import { useState } from "react";
import TextField from "@/components/ui/fields/TextField";
import AuPhoneField from "@/components/ui/fields/AuPhoneField";

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

    return (
        <div>
            <div>
                {Array.from({ length: agentCount }, (_, index) => (
                    <div key={index} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, marginTop: 8, alignItems: "end" }}>
                        <TextField name={`new_agent_${index + 2}_first_name`} label="First name" />
                        <TextField name={`new_agent_${index + 2}_last_name`} label="Last name" />
                        <AuPhoneField name={`new_agent_${index + 2}_mobile`} label="Mobile" />
                        <button 
                            type="button" 
                            onClick={() => removeAgent(index)}
                            style={{
                                height: "var(--field-height)",
                                width: "var(--field-height)",
                                backgroundColor: "transparent",
                                color: "var(--color-text-muted)",
                                border: "1px solid var(--color-light-gray)",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontSize: "16px",
                                fontWeight: "400",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                marginBottom: "16px"
                            }}
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>
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
