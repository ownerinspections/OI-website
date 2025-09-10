"use client";

import { useState } from "react";
import TextField from "@/components/ui/fields/TextField";
import AuPhoneField from "@/components/ui/fields/AuPhoneField";
import EmailField from "@/components/ui/fields/EmailField";

interface AddContactButtonProps {
    onContactAdded?: (contactIndex: number) => void;
}

export default function AddContactButton({ onContactAdded }: AddContactButtonProps) {
    const [contactCount, setContactCount] = useState(0);

    const addContact = () => {
        setContactCount(prev => prev + 1);
        onContactAdded?.(contactCount + 1);
    };

    const removeContact = (index: number) => {
        setContactCount(prev => prev - 1);
    };

    return (
        <div>
            <div>
                {Array.from({ length: contactCount }, (_, index) => (
                    <div key={index} style={{ display: "grid", gap: 8, marginTop: 8 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "end" }}>
                            <TextField name={`new_contact_${index + 2}_first_name`} label="First name" />
                            <TextField name={`new_contact_${index + 2}_last_name`} label="Last name" />
                            <button 
                                type="button" 
                                onClick={() => removeContact(index)}
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
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <AuPhoneField name={`new_contact_${index + 2}_phone`} label="Mobile" />
                            <EmailField name={`new_contact_${index + 2}_email`} label="Email" />
                        </div>
                    </div>
                ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 8 }}>
                <button 
                    type="button" 
                    onClick={addContact}
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
                    + Add Contact
                </button>
            </div>
        </div>
    );
}
