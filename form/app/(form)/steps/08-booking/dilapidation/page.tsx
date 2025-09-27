import { getRequest } from "@/lib/http/fetcher";
import FormHeader from "@/components/ui/FormHeader";
import { getBookingNote } from "@/lib/actions/globals/getGlobal";
import NoteBox from "@/components/ui/messages/NoteBox";
import { redirect } from "next/navigation";
import BookingForm from "@/components/bookings/BookingForm";
import SelectField from "@/components/ui/fields/SelectField";
import TextField from "@/components/ui/fields/TextField";
import EmailField from "@/components/ui/fields/EmailField";
import AuPhoneField from "@/components/ui/fields/AuPhoneField";
import { submitBooking } from "@/lib/actions/bookings/submitBooking";

// Server action wrapper for the form
async function handleBookingSubmit(formData: FormData) {
    "use server";
    await submitBooking({}, formData);
}

type ContactRecord = { id: string | number; first_name?: string | null; last_name?: string | null; phone?: string | null; email?: string | null; contact_type?: string | null };

// Helper function to format contact type for display
function formatContactType(contactType: string | null | undefined): string {
    if (!contactType) return "—";
    return contactType
        .replace(/_/g, " ") // Replace underscores with spaces
        .replace(/\b\w/g, (l) => l.toUpperCase()); // Capitalize first letter of each word
}

export default async function StepBooking({ searchParams }: { searchParams?: Promise<Record<string, string | string[]>> }) {
    const params = (await searchParams) ?? {};
    const bookingId = typeof params.bookingId === "string" ? params.bookingId : undefined;
    const userId = typeof params.userId === "string" ? params.userId : undefined;
    const contactId = typeof params.contactId === "string" ? params.contactId : undefined;
    const dealId = typeof params.dealId === "string" ? params.dealId : undefined;
    const propertyId = typeof params.propertyId === "string" ? params.propertyId : undefined;
    const quoteId = typeof params.quoteId === "string" ? params.quoteId : undefined;
    const invoiceId = typeof params.invoiceId === "string" ? params.invoiceId : undefined;

    if (!bookingId) {
        redirect('/not-found');
    }

    // Load booking core
    const bookingRes = await getRequest<{ data: any }>(`/items/bookings/${encodeURIComponent(String(bookingId))}?fields=*`);
    const booking = (bookingRes as any)?.data ?? null;


    // Load contacts from os_deals_contacts junction table
    const contactsList: ContactRecord[] = [];
    if (dealId) {
        try {
            const contactsRes = await getRequest<{ data: Array<{ contacts_id: any }> }>(
                `/items/os_deals_contacts?filter[os_deals_id][_eq]=${encodeURIComponent(String(dealId))}&fields=contacts_id.id,contacts_id.first_name,contacts_id.last_name,contacts_id.phone,contacts_id.email,contacts_id.contact_type&limit=100`
            );
            const contactsExpanded: any[] = Array.isArray((contactsRes as any)?.data) ? (contactsRes as any).data.map((r: any) => r.contacts_id) : [];
            
            // Normalize contacts list - exclude real estate agents for dilapidation inspections
            for (const contact of contactsExpanded) {
                if (typeof contact === "object" && contact) {
                    // Skip real estate agents for dilapidation inspections
                    if (contact.contact_type === "real_estate_agent") {
                        continue;
                    }
                    
                    contactsList.push({
                        id: contact.id,
                        first_name: contact.first_name,
                        last_name: contact.last_name,
                        phone: contact.phone,
                        email: contact.email,
                        contact_type: contact.contact_type
                    });
                }
            }
        } catch (error) {
            console.error(`Failed to load contacts from os_deals_contacts for deal ${dealId}:`, error);
        }
    }

    // Load all properties from deal (dilapidation deals store properties in multiple fields)
    let propertiesExpanded: any[] = [];
    if (dealId) {
        try {
            // First get the deal to see which property fields are populated
            const dealRes = await getRequest<{ data: any }>(
                `/items/os_deals/${encodeURIComponent(String(dealId))}?fields=properties,properties2,properties3,properties4`
            );
            const deal = (dealRes as any)?.data;
            
            // Collect all property IDs from different fields
            const propertyIds: string[] = [];
            
            // Check each property field and extract IDs
            if (deal?.properties && Array.isArray(deal.properties)) {
                propertyIds.push(...deal.properties.map((id: any) => String(id)));
            }
            if (deal?.properties2 && Array.isArray(deal.properties2)) {
                propertyIds.push(...deal.properties2.map((id: any) => String(id)));
            }
            if (deal?.properties3 && Array.isArray(deal.properties3)) {
                propertyIds.push(...deal.properties3.map((id: any) => String(id)));
            }
            if (deal?.properties4 && Array.isArray(deal.properties4)) {
                propertyIds.push(...deal.properties4.map((id: any) => String(id)));
            }
            
            // Load all properties if we found any IDs
            if (propertyIds.length > 0) {
                const uniquePropertyIds = [...new Set(propertyIds)]; // Remove duplicates
                const idsCsv = uniquePropertyIds.join(",");
                const propertiesRes = await getRequest<{ data: any[] }>(
                    `/items/property?filter%5Bid%5D%5B_in%5D=${encodeURIComponent(idsCsv)}&fields=*`
                );
                propertiesExpanded = Array.isArray((propertiesRes as any)?.data) ? (propertiesRes as any).data : [];
                console.log(`[DilapidationBooking] Loaded ${propertiesExpanded.length} properties from deal ${dealId}:`, uniquePropertyIds);
            }
        } catch (error) {
            console.error(`Failed to load properties from deal ${dealId}:`, error);
            // Fallback to junction table method
            try {
                const propsRes = await getRequest<{ data: Array<{ property_id: any }> }>(
                    `/items/bookings_property?filter[bookings_id][_eq]=${encodeURIComponent(String(bookingId))}&fields=property_id.*&limit=100`
                );
                propertiesExpanded = Array.isArray((propsRes as any)?.data) ? (propsRes as any).data.map((r: any) => r.property_id) : [];
            } catch (fallbackError) {
                console.error(`Fallback property loading also failed:`, fallbackError);
            }
        }
    }

    // Resolve service name, selected add-ons, and contact persons from deal (read-only display)
    let serviceName: string | undefined = undefined;
    let selectedAddons: Array<{ id: string | number; name: string; price?: number }> = [];
    let contactPersonIds: Array<string | number | null> = [];
    try {
        if (dealId) {
            const dealRes = await getRequest<{ data: { service?: string | number; addons?: Array<number>; contact_person?: string | number; contact_person2?: string | number; contact_person3?: string | number; contact_person4?: string | number } }>(`/items/os_deals/${encodeURIComponent(String(dealId))}?fields=service,addons,contact_person,contact_person2,contact_person3,contact_person4`);
            const svcId = (dealRes as any)?.data?.service;
            if (svcId) {
                try {
                    const svcRes = await getRequest<{ data: { service_name?: string } }>(`/items/services/${encodeURIComponent(String(svcId))}?fields=service_name`);
                    serviceName = (svcRes as any)?.data?.service_name;
                } catch {}
            }
            const addonIds: number[] = Array.isArray((dealRes as any)?.data?.addons) ? ((dealRes as any).data.addons as number[]) : [];
            if (addonIds.length > 0) {
                const uniqueAddonIds = [...new Set(addonIds)]; // Remove duplicates
                const idsCsv = uniqueAddonIds.join(",");
                const addonsRes = await getRequest<{ data: any[] }>(`/items/addons?filter%5Bid%5D%5B_in%5D=${encodeURIComponent(idsCsv)}&fields=*`);
                const rows = Array.isArray((addonsRes as any)?.data) ? ((addonsRes as any).data as any[]) : [];
                selectedAddons = rows.map((a: any) => ({ 
                    id: a.id, 
                    name: a.name || a.addon_name || a.title || `Addon ${a.id}`, 
                    price: a.price 
                }));
                console.log(`[DilapidationBooking] Loaded ${selectedAddons.length} addons from deal ${dealId}:`, uniqueAddonIds);
            }
            
            // Extract contact person IDs for each property
            const deal = (dealRes as any)?.data;
            contactPersonIds = [
                deal?.contact_person || null,
                deal?.contact_person2 || null,
                deal?.contact_person3 || null,
                deal?.contact_person4 || null
            ];
            console.log(`[DilapidationBooking] Loaded contact person IDs from deal ${dealId}:`, contactPersonIds);
        }
    } catch (error) {
        console.error(`Failed to load service, addons, and contact persons from deal ${dealId}:`, error);
    }

    // No read-only inspection date display

    // No navigation controls here; submission only on this step

    const effectiveContactId = (() => {
        if (Array.isArray(booking?.contacts) && booking.contacts.length > 0) {
            const first = booking.contacts[0];
            return typeof first === "object" ? String(first?.id || "") : String(first || "");
        }
        if (typeof contactId === "string" && contactId) return contactId;
        if (booking?.contacts_id) return String(booking.contacts_id);
        return "";
    })();


    const headerMeta = [
        { label: "Booking #", value: booking?.booking_id || booking?.id },
        { label: "Status", value: booking?.status || "—" },
        { label: "Date", value: new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(new Date()) },
    ];

    const bookingNote = await getBookingNote();

    // Check if booking is in submitted status (editable) or other status (read-only)
    const isEditable = booking?.status === "submitted";

    return (
        <div className="container">
            <div className="card">
                <FormHeader 
                    rightTitle="Booking" 
                    rightSubtitle="Dilapidation Inspection"
                    rightMeta={headerMeta as any} 
                />
                {bookingNote ? (
                    <NoteBox style={{ marginBottom: 16 }}>
                        {bookingNote}
                    </NoteBox>
                ) : null}

                <div style={{ display: "grid", gap: 16 }}>
                    {/* Inspection type */}
                    <div style={{ textAlign: "center", marginBottom: 8 }}>
                        <div style={{ color: "var(--color-text-primary)", fontSize: 18, fontWeight: 700 }}>{serviceName || "Dilapidation Inspection"}</div>
                    </div>
                    

                    {/* Properties block: read-only with details if present */}
                    <div>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>
                            {propertiesExpanded.length <= 1 ? "Property" : `Properties (${propertiesExpanded.length})`}
                        </div>
                        <div style={{ display: "grid", gap: 16, color: "var(--color-text-secondary)", fontSize: 14 }}>
                            {propertiesExpanded.length === 0 && <div>—</div>}
                            {propertiesExpanded.map((p: any, index: number) => {
                                const address = p?.full_address || [p?.street_address, p?.suburb, p?.state, p?.post_code].filter(Boolean).join(", ");
                                const details: Array<{ label: string; value: string }> = [];
                                function pushDetail(label: string, raw: unknown) {
                                    if (raw === null || raw === undefined) return;
                                    const v = String(raw).trim();
                                    if (!v || v === "N/A") return;
                                    details.push({ label, value: v });
                                }
                                pushDetail("Classification", p?.property_category);
                                pushDetail("Type", p?.property_type);
                                pushDetail("Bedrooms", p?.number_of_bedrooms);
                                pushDetail("Bathrooms", p?.number_of_bathrooms);
                                
                                // Only show levels and basement if not an apartment
                                const isApartment = p?.property_type?.toLowerCase().includes('apartment') || 
                                                   p?.property_category?.toLowerCase().includes('apartment') ||
                                                   p?.property_type?.toLowerCase().includes('unit') ||
                                                   p?.property_category?.toLowerCase().includes('unit');
                                
                                if (!isApartment) {
                                    pushDetail("Levels", p?.number_of_levels || p?.levels || p?.storeys);
                                    if (typeof p?.basement === "boolean") {
                                        pushDetail("Basement/Subfloor", p.basement ? "Yes" : "No");
                                    } else {
                                        pushDetail("Basement/Subfloor", p?.basement || p?.subfloor || p?.has_basement);
                                    }
                                }
                                pushDetail("Additional structures", p?.additional_structures);
                                pushDetail("Land size", p?.land_size);
                                pushDetail("Year built", p?.year_built);
                                pushDetail("Termite risk", p?.termite_risk);
                                pushDetail("Flood risk", p?.flood_risk);
                                pushDetail("Bushfire prone", p?.bushfire_prone);
                                pushDetail("Heritage overlay", p?.heritage_overlay);
                                pushDetail("Last sold", p?.last_sold);
                                pushDetail("Last rental", p?.last_rental);

                                // Create balanced layout with address included
                                type ItemType = 
                                    | { label: string; value: string; isAddress?: boolean; isLink?: boolean; url?: string; isEmpty?: boolean };
                                
                                // Create ordered layout based on requirements
                                const leftItems: ItemType[] = [
                                    details.find(d => d.label === "Classification") || { label: "Classification", value: "—" },
                                    details.find(d => d.label === "Bedrooms") || { label: "Bedrooms", value: "—" },
                                    details.find(d => d.label === "Levels") || { label: "Levels", value: "—" },
                                    { label: "", value: "", isEmpty: true } // Empty item to maintain 4 items
                                ];
                                
                                const rightItems: ItemType[] = [
                                    details.find(d => d.label === "Type") || { label: "Type", value: "—" },
                                    details.find(d => d.label === "Bathrooms") || { label: "Bathrooms", value: "—" },
                                    details.find(d => d.label === "Basement/Subfloor") || { label: "Basement/Subfloor", value: "—" },
                                    { label: "", value: "", isEmpty: true } // Empty item to maintain 4 items
                                ];

                                // Arrays are already properly sized with 4 items each

                                return (
                                    <div key={String(p?.id || Math.random())} style={{ 
                                        display: "grid", 
                                        gap: 16,
                                        padding: propertiesExpanded.length > 1 ? "16px" : "0",
                                        border: propertiesExpanded.length > 1 ? "1px solid var(--color-light-gray)" : "none",
                                        borderRadius: propertiesExpanded.length > 1 ? "8px" : "0",
                                        backgroundColor: propertiesExpanded.length > 1 ? "var(--color-pale-gray)" : "transparent"
                                    }}>
                                        {propertiesExpanded.length > 1 && (
                                            <div style={{ 
                                                fontSize: 14, 
                                                fontWeight: 600, 
                                                color: "var(--color-text-primary)",
                                                marginBottom: 8
                                            }}>
                                                Property {index + 1}
                                            </div>
                                        )}
                                        
                                        {/* Address - full width row */}
                                        <div style={{ 
                                            display: "flex", 
                                            gap: 6, 
                                            alignItems: "baseline", 
                                            whiteSpace: "nowrap",
                                            marginBottom: 8
                                        }}>
                                            <div style={{ color: "var(--color-text-muted)", flexShrink: 0, fontWeight: 600 }}>
                                                Address:
                                            </div>
                                            <div style={{ 
                                                color: "var(--color-text-primary)", 
                                                overflow: "hidden", 
                                                textOverflow: "ellipsis",
                                                fontWeight: 500
                                            }}>
                                                <a 
                                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || String(p?.id || "Property"))}`}
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    style={{ 
                                                        color: "var(--color-link)", 
                                                        textDecoration: "underline",
                                                        fontWeight: 500
                                                    }}
                                                >
                                                    {address || String(p?.id || "Property")}
                                                </a>
                                            </div>
                                        </div>
                                        
                                        <div className="property-details-two-column" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                                            {/* Left column - 4 items */}
                                            <div style={{ display: "grid", gap: "8px" }}>
                                                {leftItems.map((item, index) => {
                                                    if (item.isEmpty) {
                                                        return <div key={`left-empty-${index}`} style={{ height: "20px" }}></div>;
                                                    }
                                                    return (
                                                        <div key={`${String(p?.id)}-left-${index}`} style={{ display: "flex", gap: 6, alignItems: "baseline", whiteSpace: "nowrap" }}>
                                                            <div style={{ color: "var(--color-text-muted)", flexShrink: 0, fontWeight: item.isAddress ? 600 : 400 }}>
                                                                {item.isAddress ? "" : `${item.label}:`}
                                                            </div>
                                                            <div style={{ 
                                                                color: item.isAddress ? "var(--color-text-primary)" : "var(--color-text-secondary)", 
                                                                overflow: "hidden", 
                                                                textOverflow: "ellipsis",
                                                                fontWeight: item.isAddress ? 500 : 400
                                                            }}>
                                                                {item.isAddress ? (
                                                                    <a 
                                                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.value)}`}
                                                                        target="_blank" 
                                                                        rel="noopener noreferrer"
                                                                        style={{ 
                                                                            color: "var(--color-link)", 
                                                                            textDecoration: "underline",
                                                                            fontWeight: 500
                                                                        }}
                                                                    >
                                                                        {item.value}
                                                                    </a>
                                                                ) : (
                                                                    item.value
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            
                                            {/* Right column - 4 items */}
                                            <div style={{ display: "grid", gap: "8px" }}>
                                                {rightItems.map((item, index) => {
                                                    if (item.isEmpty) {
                                                        return <div key={`right-empty-${index}`} style={{ height: "20px" }}></div>;
                                                    }
                                                    if (item.isLink) {
                                                        return (
                                                            <div key={`${String(p?.id)}-right-${index}`} style={{ display: "flex", gap: 6, alignItems: "baseline", whiteSpace: "nowrap" }}>
                                                                <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-link)", textDecoration: "underline", fontSize: 14 }}>
                                                                    {item.label}
                                                                </a>
                                                            </div>
                                                        );
                                                    }
                                                    return (
                                                        <div key={`${String(p?.id)}-right-${index}`} style={{ display: "flex", gap: 6, alignItems: "baseline", whiteSpace: "nowrap" }}>
                                                            <div style={{ color: "var(--color-text-muted)", flexShrink: 0 }}>{item.label}:</div>
                                                            <div style={{ color: "var(--color-text-secondary)", overflow: "hidden", textOverflow: "ellipsis" }}>{item.value}</div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        
                                        {/* Add-ons for this property */}
                                        {selectedAddons.length > 0 && (
                                            <div style={{ 
                                                marginTop: 16, 
                                                paddingTop: 12, 
                                                borderTop: propertiesExpanded.length > 1 ? "1px solid var(--color-light-gray)" : "none"
                                            }}>
                                                <div style={{ 
                                                    fontWeight: 600, 
                                                    marginBottom: 8, 
                                                    fontSize: 14,
                                                    color: "var(--color-text-primary)"
                                                }}>
                                                    Add-ons ({selectedAddons.length})
                                                </div>
                                                <div style={{ display: "grid", gap: 6 }}>
                                                    {selectedAddons.map((addon) => (
                                                        <div key={String(addon.id)} style={{ 
                                                            fontSize: 13,
                                                            color: "var(--color-text-secondary)"
                                                        }}>
                                                            <span>{addon.name}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Contact Person for this property - read-only display */}
                                        {!isEditable && (
                                            <div style={{ 
                                                marginTop: 16, 
                                                paddingTop: 12, 
                                                borderTop: propertiesExpanded.length > 1 ? "1px solid var(--color-light-gray)" : "none"
                                            }}>
                                                <div style={{ 
                                                    fontWeight: 600, 
                                                    marginBottom: 12, 
                                                    fontSize: 14,
                                                    color: "var(--color-text-primary)"
                                                }}>
                                                    Contact Person for Inspection
                                                </div>
                                                
                                                {(() => {
                                                    const contactPersonId = contactPersonIds[index] || null;
                                                    const contactPerson = contactPersonId ? contactsList.find(ct => String(ct.id) === String(contactPersonId)) : null;
                                                    
                                                    return (
                                                        <div style={{ 
                                                            padding: 12, 
                                                            border: "1px solid var(--color-light-gray)", 
                                                            borderRadius: 8, 
                                                            backgroundColor: "var(--color-pale-gray)"
                                                        }}>
                                                            {contactPerson ? (
                                                                <div style={{ display: "grid", gap: 8 }}>
                                                                    <div style={{ 
                                                                        display: "flex", 
                                                                        justifyContent: "space-between", 
                                                                        alignItems: "center" 
                                                                    }}>
                                                                        <div style={{ 
                                                                            fontSize: 13, 
                                                                            fontWeight: 600, 
                                                                            color: "var(--color-text-primary)" 
                                                                        }}>
                                                                            {[contactPerson.first_name, contactPerson.last_name].filter(Boolean).join(" ") || "Contact Person"}
                                                                        </div>
                                                                        <div style={{ 
                                                                            padding: "4px 8px", 
                                                                            backgroundColor: "#0b487b", 
                                                                            color: "white", 
                                                                            borderRadius: 4, 
                                                                            fontSize: 11, 
                                                                            fontWeight: 600
                                                                        }}>
                                                                            Contact Person
                                                                        </div>
                                                                    </div>
                                                                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                                                                        {formatContactType(contactPerson.contact_type)}
                                                                    </div>
                                                                    {contactPerson.email && (
                                                                        <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                                                                            {contactPerson.email}
                                                                        </div>
                                                                    )}
                                                                    {contactPerson.phone && (
                                                                        <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                                                                            {contactPerson.phone}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div style={{ 
                                                                    fontSize: 13, 
                                                                    color: "var(--color-text-secondary)", 
                                                                    fontStyle: "italic" 
                                                                }}>
                                                                    No contact person assigned
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        )}



                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Inspection date display removed per request */}

                    {/* Add-ons section moved above; removed duplicate */}

                    {/* Show read-only information when not editable */}
                    {!isEditable && (
                        <div style={{ display: "grid", gap: 16 }}>
                            {/* Contacts block: read-only display */}
                            <div>
                                <div style={{ fontWeight: 600, marginBottom: 12 }}>Contacts</div>
                                {contactsList.length === 0 ? (
                                    <div style={{ 
                                        display: "grid", 
                                        gap: 8, 
                                        padding: 16, 
                                        border: "1px solid var(--color-light-gray)", 
                                        borderRadius: 8, 
                                        backgroundColor: "var(--color-pale-gray)",
                                        textAlign: "center"
                                    }}>
                                        <div style={{ color: "var(--color-text-secondary)", fontSize: 14 }}>No contacts assigned to this booking</div>
                                    </div>
                                ) : (
                                    <div style={{ display: "grid", gap: 16 }}>
                                        {contactsList.map((ct) => (
                                            <div key={String(ct.id)}>
                                                <div style={{ 
                                                    display: "grid", 
                                                    gap: 12, 
                                                    padding: 16, 
                                                    border: "1px solid var(--color-light-gray)", 
                                                    borderRadius: 8, 
                                                    backgroundColor: "var(--color-pale-gray)"
                                                }}>
                                                
                                                <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                    <div>
                                                        <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 4 }}>Contact type</div>
                                                        <div style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>{formatContactType(ct.contact_type)}</div>
                                                    </div>
                                                </div>
                                                
                                                <div className="contact-form-grid">
                                                    <div>
                                                        <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 4 }}>First name</div>
                                                        <div style={{ color: "var(--color-text-primary)" }}>{ct.first_name || "—"}</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 4 }}>Last name</div>
                                                        <div style={{ color: "var(--color-text-primary)" }}>{ct.last_name || "—"}</div>
                                                    </div>
                                                </div>
                                                <div className="contact-form-grid">
                                                    <div>
                                                        <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 4 }}>Email</div>
                                                        <div style={{ color: "var(--color-text-primary)" }}>{ct.email || "—"}</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 4 }}>Mobile</div>
                                                        <div style={{ color: "var(--color-text-primary)" }}>{ct.phone || "—"}</div>
                                                    </div>
                                                </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>


                            {/* Read-only booking details */}
                            <div style={{ display: "grid", gap: 12, marginBottom: 16, marginTop: 24 }}>
                                <div style={{ gridColumn: "1 / -1" }}>
                                    <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 4 }}>Tentative inspection date</div>
                                    <div style={{ color: "var(--color-text-primary)" }}>
                                        {(booking as any)?.tentative_date 
                                            ? new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(new Date((booking as any).tentative_date))
                                            : "—"
                                        }
                                    </div>
                                </div>
                                <div style={{ gridColumn: "1 / -1" }}>
                                    <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 4 }}>Additional information</div>
                                    <div style={{ color: "var(--color-text-primary)", whiteSpace: "pre-wrap" }}>
                                        {(booking as any)?.additional_info || "—"}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Only show form and Book Now button if editable */}
                    {isEditable && (
                        <BookingForm
                            bookingId={bookingId}
                            userId={userId}
                            contactId={contactId}
                            dealId={dealId}
                            propertyId={propertyId}
                            quoteId={quoteId}
                            invoiceId={invoiceId}
                            inspection_type="dilapidation"
                            contactsList={contactsList}
                            booking={booking}
                            properties={propertiesExpanded}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
