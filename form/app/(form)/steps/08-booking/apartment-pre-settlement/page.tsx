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
import { formatPropertyLevels, formatPropertyBasement } from "@/lib/utils/propertyFormatting";

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
    const bookingRes = await getRequest<{ data: any }>(`/items/bookings/${encodeURIComponent(String(bookingId))}?fields=*,inspectors.*,booking_date_and_time`);
    const booking = (bookingRes as any)?.data ?? null;


    // Load contacts from os_deals_contacts junction table
    const uniqueContactsList: ContactRecord[] = [];
    if (dealId) {
        try {
            const contactsRes = await getRequest<{ data: Array<{ contacts_id: any }> }>(
                `/items/os_deals_contacts?filter[os_deals_id][_eq]=${encodeURIComponent(String(dealId))}&fields=contacts_id.id,contacts_id.first_name,contacts_id.last_name,contacts_id.phone,contacts_id.email,contacts_id.contact_type&limit=100`
            );
            const contactsExpanded: any[] = Array.isArray((contactsRes as any)?.data) ? (contactsRes as any).data.map((r: any) => r.contacts_id) : [];
            
            // Normalize contacts list
            for (const contact of contactsExpanded) {
                if (typeof contact === "object" && contact) {
                    uniqueContactsList.push({
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

    // Load properties via junction
    const propsRes = await getRequest<{ data: Array<{ property_id: any }> }>(
        `/items/bookings_property?filter[bookings_id][_eq]=${encodeURIComponent(String(bookingId))}&fields=property_id.*&limit=100`
    );
    const propertiesExpanded: any[] = Array.isArray((propsRes as any)?.data) ? (propsRes as any).data.map((r: any) => r.property_id) : [];

    // Resolve service name, selected add-ons, and contact person from deal (read-only display)
    let serviceName: string | undefined = undefined;
    let selectedAddons: Array<{ id: string | number; name: string; price?: number }> = [];
    let contactPersonId: string | number | null = null;
    try {
        if (dealId) {
            const dealRes = await getRequest<{ data: { service?: string | number; addons?: Array<number>; contact_person?: string | number } }>(`/items/os_deals/${encodeURIComponent(String(dealId))}?fields=service,addons,contact_person`);
            const svcId = (dealRes as any)?.data?.service;
            if (svcId) {
                try {
                    const svcRes = await getRequest<{ data: { service_name?: string } }>(`/items/services/${encodeURIComponent(String(svcId))}?fields=service_name`);
                    serviceName = (svcRes as any)?.data?.service_name;
                } catch {}
            }
            const addonIds: number[] = Array.isArray((dealRes as any)?.data?.addons) ? ((dealRes as any).data.addons as number[]) : [];
            if (addonIds.length > 0) {
                const idsCsv = addonIds.join(",");
                const addonsRes = await getRequest<{ data: any[] }>(`/items/addons?filter%5Bid%5D%5B_in%5D=${encodeURIComponent(idsCsv)}`);
                const rows = Array.isArray((addonsRes as any)?.data) ? ((addonsRes as any).data as any[]) : [];
                selectedAddons = rows.map((a: any) => ({ id: a.id, name: a.name || a.addon_name || a.title || `Addon ${a.id}`, price: a.price }));
            }
            
            // Extract contact person from deal
            contactPersonId = (dealRes as any)?.data?.contact_person || null;
        }
    } catch {}

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
                    rightSubtitle="Apartment Pre-Settlement Inspection"
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
                        <div style={{ color: "var(--color-text-primary)", fontSize: 18, fontWeight: 700 }}>{serviceName || "Apartment Pre-Settlement Inspection"}</div>
                    </div>

                    {/* Properties block: read-only with details if present */}
                    <div>
                        <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14, color: "var(--color-text-secondary)" }}>
                            {propertiesExpanded.length <= 1 ? "Property" : `Properties (${propertiesExpanded.length})`}
                        </div>
                        <div style={{ display: "grid", gap: 16, color: "var(--color-text-secondary)", fontSize: 14 }}>
                            {propertiesExpanded.length === 0 && <div>—</div>}
                            {propertiesExpanded.map((p: any, index: number) => {
                                const address = p?.full_address || [p?.street_address, p?.suburb, p?.state, p?.post_code].filter(Boolean).join(", ");
                                const realestateUrl: string | undefined = typeof p?.realestate_url === "string" && p.realestate_url ? p.realestate_url : undefined;
                                const details: Array<{ label: string; value: string }> = [];
                                function pushDetail(label: string, raw: unknown) {
                                    if (raw === null || raw === undefined) {
                                        details.push({ label, value: "—" });
                                        return;
                                    }
                                    const v = String(raw).trim();
                                    if (!v || v === "N/A") {
                                        details.push({ label, value: "—" });
                                        return;
                                    }
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
                                    const levelsValue = p?.number_of_levels || p?.levels || p?.storeys;
                                    const formattedLevels = formatPropertyLevels(levelsValue);
                                    if (formattedLevels) {
                                        pushDetail("Levels", formattedLevels);
                                    }
                                    
                                    const basementValue = p?.basement || p?.subfloor || p?.has_basement;
                                    const formattedBasement = formatPropertyBasement(basementValue);
                                    pushDetail("Basement/Subfloor", formattedBasement);
                                }

                                // Create balanced layout with address included
                                type ItemType = 
                                    | { label: string; value: string; isAddress?: boolean; isLink?: boolean; url?: string; isEmpty?: boolean };
                                
                                const leftItems: ItemType[] = [
                                    ...details.slice(0, 2) // First 2 details for left column
                                ];
                                
                                const rightItems: ItemType[] = [
                                    ...details.slice(2, 4) // Next 2 details for right column
                                ];

                                const propertyElement = (
                                    <div key={String(p?.id || Math.random())} style={{ 
                                        display: "grid", 
                                        gap: 16,
                                        padding: "16px",
                                        border: "1px solid var(--color-light-gray)",
                                        borderRadius: "8px",
                                        backgroundColor: "var(--color-pale-gray)"
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
                                            {/* Left column - 2 items */}
                                            <div style={{ display: "grid", gap: "8px" }}>
                                                {leftItems.map((item, index) => {
                                                    if (item.isEmpty) {
                                                        return <div key={`left-empty-${index}`} style={{ height: "20px" }}></div>;
                                                    }
                                                    return (
                                                        <div key={`${String(p?.id)}-left-${index}`} style={{ display: "flex", gap: 6, alignItems: "baseline", whiteSpace: "nowrap" }}>
                                                            <div style={{ color: "var(--color-text-muted)", flexShrink: 0 }}>
                                                                {item.label}:
                                                            </div>
                                                            <div style={{ 
                                                                color: "var(--color-text-secondary)", 
                                                                overflow: "hidden", 
                                                                textOverflow: "ellipsis"
                                                            }}>
                                                                {item.value}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            
                                            {/* Right column - 2 items */}
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
                                                borderTop: "1px solid var(--color-light-gray)"
                                            }}>
                                                <div style={{ 
                                                    fontWeight: 600, 
                                                    marginBottom: 8, 
                                                    fontSize: 14,
                                                    color: "var(--color-text-primary)"
                                                }}>
                                                    Add-ons
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

                                    </div>
                                );

                                // Return property with optional view link (read-only)
                                return (
                                    <div key={`${String(p?.id)}-container`}>
                                        {propertyElement}
                                        {!isEditable && realestateUrl && (
                                            <div style={{ 
                                                marginTop: 12,
                                                textAlign: "center"
                                            }}>
                                                <a 
                                                    href={realestateUrl} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer" 
                                                    style={{ 
                                                        background: "#0b487b",
                                                        color: "white",
                                                        border: "none",
                                                        borderRadius: 6,
                                                        padding: "12px 24px",
                                                        cursor: "pointer",
                                                        fontSize: 14,
                                                        fontWeight: "500",
                                                        textDecoration: "none",
                                                        display: "inline-block"
                                                    }}
                                                >
                                                    View Property
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>


                    {/* Inspector & Schedule - Modern Simple Design - Hidden if status is submitted or booked */}
                    {booking?.status !== "submitted" && booking?.status !== "booked" && (
                        <div style={{ 
                            background: "white",
                            borderRadius: 12,
                            padding: 24,
                            border: "1px solid #e2e8f0",
                            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)"
                        }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "stretch" }}>
                                {/* Inspector Assigned */}
                                <div style={{ display: "flex", flexDirection: "column" }}>
                                    <div style={{ 
                                        fontSize: 15, 
                                        fontWeight: 600, 
                                        color: "#374151", 
                                        marginBottom: 12
                                    }}>
                                        Inspector Assigned
                                    </div>
                                    
                                    {!booking?.inspectors || (Array.isArray(booking.inspectors) && booking.inspectors.length === 0) ? (
                                        <div style={{
                                            padding: 16,
                                            borderRadius: 8,
                                            backgroundColor: "#fef2f2",
                                            border: "1px solid #fecaca",
                                            textAlign: "center",
                                            color: "#dc2626",
                                            fontSize: 14,
                                            flex: 1,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center"
                                        }}>
                                            No inspector assigned yet
                                        </div>
                                    ) : (
                                        <div style={{ display: "grid", gap: 12, flex: 1 }}>
                                            {(Array.isArray(booking.inspectors) ? booking.inspectors : [booking.inspectors]).map((inspector: any) => {
                                                const inspectorName = [inspector?.first_name, inspector?.last_name].filter(Boolean).join(" ") || "Inspector";
                                                
                                                return (
                                                    <div key={String(inspector?.id || Math.random())} style={{
                                                        padding: 16,
                                                        borderRadius: 8,
                                                        border: "1px solid #e5e7eb",
                                                        backgroundColor: "#f9fafb",
                                                        flex: 1,
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        textAlign: "center"
                                                    }}>
                                                        <div style={{
                                                            fontSize: 16,
                                                            fontWeight: 600,
                                                            color: "#1f2937",
                                                            marginBottom: 8
                                                        }}>
                                                            {inspectorName}
                                                        </div>
                                                        
                                                        {inspector?.phone && (
                                                            <a href={`tel:${inspector.phone}`} style={{ 
                                                                fontSize: 14, 
                                                                color: "#6b7280",
                                                                textDecoration: "none"
                                                            }}>
                                                                {(() => {
                                                                    let phone = String(inspector.phone || '').trim();
                                                                    
                                                                    // Remove all non-digits
                                                                    const digitsOnly = phone.replace(/\D/g, '');
                                                                    
                                                                    // Handle +61xxxxxxxxx format (11 digits total: 61 + 9 digits)
                                                                    if (digitsOnly.startsWith('61') && digitsOnly.length === 11) {
                                                                        const number = digitsOnly.substring(2);
                                                                        return `+61 ${number.substring(0, 3)} ${number.substring(3, 6)} ${number.substring(6)}`;
                                                                    }
                                                                    
                                                                    // Handle +61xxxxxxxx format (10 digits total: 61 + 8 digits)
                                                                    if (digitsOnly.startsWith('61') && digitsOnly.length === 10) {
                                                                        const number = digitsOnly.substring(2);
                                                                        return `+61 ${number.substring(0, 3)} ${number.substring(3, 6)} ${number.substring(6)}`;
                                                                    }
                                                                    
                                                                    // Handle 0xxxxxxxxx format (10 digits starting with 0)
                                                                    if (digitsOnly.startsWith('0') && digitsOnly.length === 10) {
                                                                        const withoutZero = digitsOnly.substring(1);
                                                                        return `+61 ${withoutZero.substring(0, 3)} ${withoutZero.substring(3, 6)} ${withoutZero.substring(6)}`;
                                                                    }
                                                                    
                                                                    // Handle xxxxxxxxx format (9 digits)
                                                                    if (digitsOnly.length === 9) {
                                                                        return `+61 ${digitsOnly.substring(0, 3)} ${digitsOnly.substring(3, 6)} ${digitsOnly.substring(6)}`;
                                                                    }
                                                                    
                                                                    // Handle xxxxxxxx format (8 digits)
                                                                    if (digitsOnly.length === 8) {
                                                                        return `+61 ${digitsOnly.substring(0, 3)} ${digitsOnly.substring(3, 6)} ${digitsOnly.substring(6)}`;
                                                                    }
                                                                    
                                                                    return phone;
                                                                })()}
                                                            </a>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Scheduled Date & Time */}
                                <div style={{ display: "flex", flexDirection: "column" }}>
                                    <div style={{ 
                                        fontSize: 15, 
                                        fontWeight: 600, 
                                        color: "#374151", 
                                        marginBottom: 12
                                    }}>
                                        Scheduled Date & Time
                                    </div>
                                    
                                    <div style={{
                                        padding: 16,
                                        borderRadius: 8,
                                        border: "1px solid #e5e7eb",
                                        backgroundColor: "#f9fafb",
                                        flex: 1,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center"
                                    }}>
                                        {booking?.booking_date_and_time ? (
                                            <div style={{ textAlign: "center", width: "100%" }}>
                                                <div style={{
                                                    fontSize: 16,
                                                    fontWeight: 600,
                                                    color: "#1f2937",
                                                    marginBottom: 2
                                                }}>
                                                    {new Intl.DateTimeFormat("en-AU", { 
                                                        weekday: "long",
                                                        day: "numeric",
                                                        month: "long", 
                                                        year: "numeric",
                                                        timeZone: "Australia/Sydney"
                                                    }).format(new Date(booking.booking_date_and_time))}
                                                </div>
                                            <div style={{
                                                fontSize: 14,
                                                fontWeight: 500,
                                                color: "#6b7280"
                                            }}>
                                                {new Intl.DateTimeFormat("en-AU", { 
                                                    timeStyle: "short",
                                                    timeZone: "Australia/Sydney"
                                                }).format(new Date(booking.booking_date_and_time)).replace(/am|pm/gi, (match) => match.toUpperCase())}
                                            </div>
                                            </div>
                                        ) : (
                                            <div style={{
                                                fontSize: 14,
                                                color: "#6b7280",
                                                fontStyle: "italic",
                                                textAlign: "center"
                                            }}>
                                                No date scheduled yet
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Inspection date display removed per request */}

                    {/* Add-ons section moved above; removed duplicate */}

                    {/* Show read-only information when not editable */}
                    {!isEditable && (
                        <div style={{ display: "grid", gap: 16 }}>
                            {/* Contacts block: read-only display */}
                            <div>
                                <div style={{ fontWeight: 600, marginBottom: 12 }}>Contacts</div>
                                {uniqueContactsList.length === 0 ? (
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
                                        {uniqueContactsList
                                            .sort((a, b) => {
                                                // Sort contact person to the top for better visibility
                                                const aIsContactPerson = contactPersonId && String(contactPersonId) === String(a.id);
                                                const bIsContactPerson = contactPersonId && String(contactPersonId) === String(b.id);
                                                
                                                if (aIsContactPerson && !bIsContactPerson) return -1;
                                                if (!aIsContactPerson && bIsContactPerson) return 1;
                                                return 0;
                                            })
                                            .map((ct) => {
                                                const isContactPerson = contactPersonId && String(contactPersonId) === String(ct.id);
                                                
                                                return (
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
                                                            {isContactPerson && (
                                                                <div style={{ 
                                                                    padding: "6px 12px", 
                                                                    backgroundColor: "#0b487b", 
                                                                    color: "white", 
                                                                    borderRadius: 6, 
                                                                    fontSize: 13, 
                                                                    fontWeight: 600,
                                                                    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)"
                                                                }}>
                                                                    Contact Person
                                                                </div>
                                                            )}
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
                                                                <div style={{ color: "var(--color-text-primary)" }}>
                                                                    {ct.phone ? (
                                                                        <a href={`tel:${ct.phone}`} style={{ color: "var(--color-text-primary)", textDecoration: "none" }}>
                                                                            {(() => {
                                                                                const phone = String(ct.phone).replace(/\D/g, '');
                                                                                if (phone.startsWith('61')) {
                                                                                    const number = phone.substring(2);
                                                                                    if (number.length === 9) {
                                                                                        return `+61 ${number.substring(0, 3)} ${number.substring(3, 6)} ${number.substring(6)}`;
                                                                                    }
                                                                                }
                                                                                if (phone.length === 10 && phone.startsWith('0')) {
                                                                                    const withoutZero = phone.substring(1);
                                                                                    return `+61 ${withoutZero.substring(0, 3)} ${withoutZero.substring(3, 6)} ${withoutZero.substring(6)}`;
                                                                                }
                                                                                return ct.phone;
                                                                            })()}
                                                                        </a>
                                                                    ) : "—"}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                )}
                            </div>

                            {/* Application Process - only for expert witness reports */}
                            {booking?.inspection_type === "expert_witness_report" && (
                                <div>
                                    <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14, color: "var(--color-text-secondary)" }}>
                                        Application Process
                                    </div>
                                    <div style={{ 
                                        padding: 16, 
                                        border: "1px solid var(--color-light-gray)", 
                                        borderRadius: 8, 
                                        backgroundColor: "var(--color-pale-gray)"
                                    }}>
                                        <div style={{ color: "var(--color-text-primary)" }}>
                                            {(() => {
                                                const process = booking?.application_process;
                                                if (!process) return "—";
                                                
                                                const processLabels: Record<string, string> = {
                                                    "nothing_lodged_yet": "Nothing lodged yet",
                                                    "in_mediation": "In mediation", 
                                                    "at_tribunal": "At tribunal",
                                                    "in_court": "In court"
                                                };
                                                
                                                return processLabels[process] || process;
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Tentative Inspection Date */}
                            {booking?.tentative_date && (
                                <div>
                                    <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14, color: "var(--color-text-secondary)" }}>
                                        Tentative Inspection Date
                                    </div>
                                    <div style={{ 
                                        padding: 16, 
                                        border: "1px solid var(--color-light-gray)", 
                                        borderRadius: 8, 
                                        backgroundColor: "var(--color-pale-gray)"
                                    }}>
                                        <div style={{ color: "var(--color-text-primary)" }}>
                                            {new Intl.DateTimeFormat("en-AU", { 
                                                weekday: "long",
                                                day: "numeric",
                                                month: "long", 
                                                year: "numeric",
                                                timeZone: "Australia/Sydney"
                                            }).format(new Date(booking.tentative_date))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Additional Information */}
                            {booking?.additional_info && (
                                <div>
                                    <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14, color: "var(--color-text-secondary)" }}>
                                        Additional Information
                                    </div>
                                    <div style={{ 
                                        padding: 16, 
                                        border: "1px solid var(--color-light-gray)", 
                                        borderRadius: 8, 
                                        backgroundColor: "var(--color-pale-gray)"
                                    }}>
                                        <div style={{ 
                                            color: "var(--color-text-primary)", 
                                            whiteSpace: "pre-wrap",
                                            lineHeight: 1.5
                                        }}>
                                            {booking.additional_info}
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>
                    )}


                    {/* Only show form and Book Now button if editable */}
                    {isEditable && (
                        <div>
                            <script dangerouslySetInnerHTML={{
                                __html: `
                                    document.addEventListener('DOMContentLoaded', function() {
                                        // Handle contact person choice selection
                                        function initContactPersonChoiceLogic() {
                                            const contactPersonChoices = document.querySelectorAll('select[name$="_contact_person_choice"]');
                                            contactPersonChoices.forEach(select => {
                                                const selectName = select.getAttribute('name');
                                                const propertyId = selectName?.match(/property_(\\d+)_contact_person_choice/)?.[1];
                                                
                                                if (!propertyId) return;
                                                
                                                const newContactFields = document.getElementById(\`new-contact-person-fields-\${propertyId}\`);
                                                if (!newContactFields) return;
                                                
                                                function toggleNewContactFields() {
                                                    const selectElement = select as HTMLSelectElement;
                                                    if (selectElement.value === 'new_contact') {
                                                        newContactFields.style.display = 'block';
                                                    } else {
                                                        newContactFields.style.display = 'none';
                                                    }
                                                }
                                                
                                                select.addEventListener('change', toggleNewContactFields);
                                                toggleNewContactFields(); // Initial check
                                            });
                                        }
                                        
                                        // Handle contact person email requirement logic
                                        function initContactPersonEmailLogic() {
                                            const contactTypeSelects = document.querySelectorAll('select[name$="_contact_person_contact_type"]');
                                            contactTypeSelects.forEach(select => {
                                                const selectName = select.getAttribute('name');
                                                const propertyId = selectName?.match(/property_(\\d+)_contact_person_contact_type/)?.[1];
                                                
                                                if (!propertyId) return;
                                                
                                                const emailField = document.querySelector(\`input[name="property_\${propertyId}_contact_person_email"]\`) as HTMLInputElement;
                                                if (!emailField) return;
                                                
                                                function updateContactPersonEmailRequirement() {
                                                    const selectElement = select as HTMLSelectElement;
                                                    const isRealEstateAgent = selectElement.value === 'real_estate_agent';
                                                    emailField.required = !isRealEstateAgent;
                                                }
                                                
                                                select.addEventListener('change', updateContactPersonEmailRequirement);
                                                updateContactPersonEmailRequirement(); // Initial check
                                            });
                                        }
                                        
                                        initContactPersonChoiceLogic();
                                        initContactPersonEmailLogic();
                                    });
                                `
                            }} />
                            
                            {/* Contact Person for Inspection - only for pre-purchase and apartment pre-settlement */}
                            {propertiesExpanded.length > 0 && (
                                <div style={{ marginBottom: 24 }}>
                                    <div style={{ 
                                        fontWeight: 600, 
                                        marginBottom: 16, 
                                        fontSize: 16,
                                        color: "var(--color-text-primary)"
                                    }}>
                                        Contact Person for Inspection
                                    </div>
                                    <div style={{ display: "grid", gap: 16 }}>
                                        {propertiesExpanded.map((property: any, index: number) => (
                                            <div key={String(property?.id || index)}>
                                                {propertiesExpanded.length > 1 && (
                                                    <div style={{ 
                                                        fontSize: 14, 
                                                        fontWeight: 600, 
                                                        color: "var(--color-text-primary)",
                                                        marginBottom: 12
                                                    }}>
                                                        Property {index + 1}
                                                    </div>
                                                )}
                                                <div style={{ 
                                                    padding: 16, 
                                                    border: "1px solid var(--color-light-gray)", 
                                                    borderRadius: 8, 
                                                    backgroundColor: "var(--color-pale-gray)"
                                                }}>
                                                    <div style={{ display: "grid", gap: 16 }}>
                                                        <SelectField
                                                            name={`property_${property?.id}_contact_person_choice`}
                                                            label="Who should we contact at inspection time?"
                                                            options={[
                                                                { value: "me", label: "Me (current contact)" },
                                                                { value: "new_contact", label: "Someone else (add new contact)" }
                                                            ]}
                                                            defaultValue={(booking as any)?.contact_person_choice || "me"}
                                                            placeholder="Select who to contact"
                                                            required
                                                        />
                                                        
                                                        {/* New contact fields - shown conditionally based on JavaScript */}
                                                        <div id={`new-contact-person-fields-${property?.id}`} style={{ display: "none", border: "1px solid var(--color-light-gray)", borderRadius: 8, padding: 16, backgroundColor: "white" }}>
                                                            <div style={{ display: "grid", gap: 16 }}>
                                                                <SelectField 
                                                                    name={`property_${property?.id}_contact_person_contact_type`} 
                                                                    label="Contact type" 
                                                                    options={[
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
                                                                        { value: "real_estate_agent", label: "Real Estate Agent" },
                                                                        { value: "seller", label: "Seller" },
                                                                        { value: "site_supervisor", label: "Site Supervisor" },
                                                                        { value: "solicitor", label: "Solicitor" },
                                                                        { value: "tenant", label: "Tenant" },
                                                                    ]}
                                                                    placeholder="Select contact type"
                                                                    required 
                                                                />
                                                                <div className="contact-form-grid">
                                                                    <TextField 
                                                                        name={`property_${property?.id}_contact_person_first_name`} 
                                                                        label="First name" 
                                                                        required 
                                                                    />
                                                                    <TextField 
                                                                        name={`property_${property?.id}_contact_person_last_name`} 
                                                                        label="Last name" 
                                                                        required 
                                                                    />
                                                                </div>
                                                                <div className="contact-form-grid">
                                                                    <EmailField 
                                                                        name={`property_${property?.id}_contact_person_email`} 
                                                                        label="Email" 
                                                                        required 
                                                                    />
                                                                    <AuPhoneField 
                                                                        name={`property_${property?.id}_contact_person_phone`} 
                                                                        label="Mobile" 
                                                                        required 
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <BookingForm
                                bookingId={bookingId}
                                userId={userId}
                                contactId={contactId}
                                dealId={dealId}
                                propertyId={propertyId}
                                quoteId={quoteId}
                                invoiceId={invoiceId}
                                inspection_type="apartment-pre-settlement"
                                contactsList={uniqueContactsList}
                                booking={booking}
                                properties={propertiesExpanded}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>

    );
}