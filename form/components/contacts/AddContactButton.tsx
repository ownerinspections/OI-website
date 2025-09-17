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

    const handleRemoveContact = (index: number) => () => {
        removeContact(index);
    };


    return (
        <div>
            {contactCount > 0 && (
                <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                    {Array.from({ length: contactCount }, (_, index) => (
                        <div key={index} style={{ position: "relative", display: "grid", gap: 8, padding: 12, border: "1px dashed var(--color-light-gray)", borderRadius: 6, backgroundColor: "var(--color-pale-gray)" }}>
                            <button 
                                type="button" 
                                onClick={handleRemoveContact(index)}
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
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                <TextField name={`new_contact_${index + 2}_first_name`} label="First name" required />
                                <TextField name={`new_contact_${index + 2}_last_name`} label="Last name" required />
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                <EmailField name={`new_contact_${index + 2}_email`} label="Email" required />
                                <AuPhoneField name={`new_contact_${index + 2}_phone`} label="Mobile" required />
                            </div>
                        </div>
                    ))}
                </div>
            )}
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
                    + Add more contacts to this booking
                </button>
            </div>
        </div>
    );
}
