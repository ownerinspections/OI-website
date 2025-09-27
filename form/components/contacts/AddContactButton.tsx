"use client";

import { useState } from "react";
import TextField from "@/components/ui/fields/TextField";
import AuPhoneField from "@/components/ui/fields/AuPhoneField";
import EmailField from "@/components/ui/fields/EmailField";
import SelectField from "@/components/ui/fields/SelectField";

const CONTACT_TYPE_OPTIONS = [
	{ value: "agent", label: "Agent" },
	{ value: "builder", label: "Builder" },
	{ value: "buyer", label: "Buyer" },
	{ value: "conveyancer", label: "Conveyancer" },
	{ value: "developer", label: "Developer" },
	{ value: "individual", label: "Individual" },
	{ value: "landlord", label: "Landlord" },
	{ value: "lawyer", label: "Lawyer" },
	{ value: "organization", label: "Organization" },
	{ value: "other", label: "Other" },
	{ value: "owner", label: "Owner" },
	{ value: "seller", label: "Seller" },
	{ value: "site_supervisor", label: "Site Supervisor" },
	{ value: "solicitor", label: "Solicitor" },
	{ value: "tenant", label: "Tenant" },
];

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
                            <div style={{ gridColumn: "1 / -1" }}>
                                <SelectField 
                                    name={`new_contact_${index + 2}_contact_type`} 
                                    label="Contact type" 
                                    options={CONTACT_TYPE_OPTIONS}
                                    placeholder="Select contact type"
                                    required 
                                />
                            </div>
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
            <div style={{ textAlign: "center", marginTop: 16 }}>
                <button 
                    type="button" 
                    onClick={addContact}
                    style={{
                        background: "#0b487b",
                        color: "white",
                        border: "none",
                        borderRadius: 6,
                        padding: "12px 24px",
                        cursor: "pointer",
                        fontSize: 14,
                        fontWeight: "500"
                    }}
                >
                    + Add more contacts to this booking
                </button>
            </div>
        </div>
    );
}
