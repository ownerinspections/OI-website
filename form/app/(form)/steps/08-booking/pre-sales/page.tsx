import { getRequest } from "@/lib/http/fetcher";
import FormHeader from "@/components/ui/FormHeader";
import { getBookingNote } from "@/lib/actions/globals/getGlobal";
import NoteBox from "@/components/ui/messages/NoteBox";
import { redirect } from "next/navigation";
import BookingForm from "@/components/bookings/BookingForm";

type AgentRecord = { id: string | number; first_name?: string | null; last_name?: string | null; mobile?: string | null; email?: string | null };
type ContactRecord = { id: string | number; first_name?: string | null; last_name?: string | null; phone?: string | null; email?: string | null };

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

    // Load agents via junction
    const agentsRes = await getRequest<{ data: Array<{ agents_id: any }> }>(
        `/items/bookings_agents?filter[bookings_id][_eq]=${encodeURIComponent(String(bookingId))}&fields=agents_id.id,agents_id.first_name,agents_id.last_name,agents_id.mobile,agents_id.email&limit=100`
    );
    const agentsExpanded: any[] = Array.isArray((agentsRes as any)?.data) ? (agentsRes as any).data.map((r: any) => r.agents_id) : [];

    // Normalize agents list as minimal editable fields
    const agentsList: AgentRecord[] = agentsExpanded.map((a: any) => (typeof a === "object" ? a : { id: a }));

    // Load contacts from booking record (contacts field contains array of contact IDs)
    const contactIds: string[] = (() => {
        const result: string[] = [];
        if (Array.isArray(booking?.contacts)) {
            for (const c of booking.contacts) {
                const id = typeof c === "object" ? String((c as any)?.id ?? "") : String(c ?? "");
                if (id) result.push(id);
            }
        }
        return result;
    })();

    // Load contact details for each contact ID
    const contactsList: ContactRecord[] = [];
    for (const contactId of contactIds) {
        try {
            const contactRes = await getRequest<{ data: ContactRecord }>(`/items/contacts/${encodeURIComponent(contactId)}?fields=id,first_name,last_name,phone,email`);
            const contact = (contactRes as any)?.data;
            if (contact) {
                contactsList.push(contact);
            }
        } catch (error) {
            console.error(`Failed to load contact ${contactId}:`, error);
        }
    }

    // Load properties via junction
    const propsRes = await getRequest<{ data: Array<{ property_id: any }> }>(
        `/items/bookings_property?filter[bookings_id][_eq]=${encodeURIComponent(String(bookingId))}&fields=property_id.*&limit=100`
    );
    const propertiesExpanded: any[] = Array.isArray((propsRes as any)?.data) ? (propsRes as any).data.map((r: any) => r.property_id) : [];

    // Resolve service name and selected add-ons from deal (read-only display)
    let serviceName: string | undefined = undefined;
    let selectedAddons: Array<{ id: string | number; name: string; price?: number }> = [];
    try {
        if (dealId) {
            const dealRes = await getRequest<{ data: { service?: string | number; addons?: Array<number> } }>(`/items/os_deals/${encodeURIComponent(String(dealId))}?fields=service,addons`);
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
                <FormHeader rightTitle="Booking" rightMeta={headerMeta as any} />
                {bookingNote ? (
                    <NoteBox style={{ marginBottom: 16 }}>
                        {bookingNote}
                    </NoteBox>
                ) : null}

                <div style={{ display: "grid", gap: 16 }}>
                    {/* Inspection type and Add-ons side by side */}
                    <div className="booking-details-section">
                        {/* Inspection type (service): read-only */}
                        <div>
                            <div style={{ fontWeight: 600, marginBottom: 8 }}>Inspection type</div>
                            <div style={{ color: "var(--color-text-secondary)", fontSize: 14 }}>{serviceName || "—"}</div>
                        </div>

                        {/* Add-ons: read-only */}
                        <div>
                            <div style={{ fontWeight: 600, marginBottom: 8 }}>Add-ons</div>
                            <div style={{ color: "var(--color-text-secondary)", fontSize: 14 }}>
                                {selectedAddons.length === 0 ? (
                                    "—"
                                ) : (
                                    selectedAddons.map((a) => (
                                        <div key={String(a.id)}>{a.name}</div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                    

                    {/* Properties block: read-only with details if present */}
                    <div>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>Property</div>
                        <div style={{ display: "grid", gap: 12, color: "var(--color-text-secondary)", fontSize: 14 }}>
                            {propertiesExpanded.length === 0 && <div>—</div>}
                            {propertiesExpanded.map((p: any) => {
                                const address = p?.full_address || [p?.street_address, p?.suburb, p?.state, p?.post_code].filter(Boolean).join(", ");
                                const realestateUrl: string | undefined = typeof p?.realestate_url === "string" && p.realestate_url ? p.realestate_url : undefined;
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
                                pushDetail("Levels", p?.number_of_levels);
                                if (typeof p?.basement === "boolean") {
                                    pushDetail("Basement/Subfloor", p.basement ? "Yes" : "No");
                                } else {
                                    pushDetail("Basement/Subfloor", p?.basement);
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
                                
                                const leftItems: ItemType[] = [
                                    { label: "Address", value: address || String(p?.id || "Property"), isAddress: true },
                                    ...details.slice(0, 3) // First 3 details for left column
                                ];
                                
                                const rightItems: ItemType[] = [
                                    ...(realestateUrl ? [{ label: "View on realestate.com.au", value: "", isLink: true, url: realestateUrl }] : []),
                                    ...details.slice(3, 6) // Next 3 details for right column
                                ];

                                // Pad arrays to ensure 4 items each
                                while (leftItems.length < 4) {
                                    leftItems.push({ label: "", value: "", isEmpty: true });
                                }
                                while (rightItems.length < 4) {
                                    rightItems.push({ label: "", value: "", isEmpty: true });
                                }

                                return (
                                    <div key={String(p?.id || Math.random())} style={{ display: "grid", gap: 16 }}>
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
                                                                {item.value}
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
                                <div style={{ fontWeight: 600, marginBottom: 8 }}>Contacts</div>
                                <div style={{ display: "grid", gap: 8, padding: 12, border: "1px solid var(--color-light-gray)", borderRadius: 6, backgroundColor: "var(--color-pale-gray)" }}>
                                    {contactsList.length === 0 ? (
                                        <div style={{ color: "var(--color-text-secondary)", fontSize: 14, textAlign: "center" }}>No contacts assigned to this booking</div>
                                    ) : (
                                        contactsList.map((ct) => (
                                            <div key={String(ct.id)} style={{ display: "grid", gap: 8 }}>
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
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Real Estate Agents block: read-only display */}
                            <div>
                                <div style={{ fontWeight: 600, marginBottom: 8 }}>Real Estate Agent</div>
                                <div style={{ display: "grid", gap: 8, padding: 12, border: "1px solid var(--color-light-gray)", borderRadius: 6, backgroundColor: "var(--color-pale-gray)" }}>
                                    {agentsList.length === 0 ? (
                                        <div style={{ color: "var(--color-text-secondary)", fontSize: 14, textAlign: "center" }}>No real estate agents assigned to this booking</div>
                                    ) : (
                                        agentsList.map((ag) => (
                                            <div key={String(ag.id)} style={{ display: "grid", gap: 8 }}>
                                                <div className="agent-form-grid">
                                                    <div>
                                                        <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 4 }}>First name</div>
                                                        <div style={{ color: "var(--color-text-primary)" }}>{ag.first_name || "—"}</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 4 }}>Last name</div>
                                                        <div style={{ color: "var(--color-text-primary)" }}>{ag.last_name || "—"}</div>
                                                    </div>
                                                </div>
                                                <div className="agent-form-grid">
                                                    <div>
                                                        <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 4 }}>Email</div>
                                                        <div style={{ color: "var(--color-text-primary)" }}>{ag.email && ag.email !== "N/A" ? ag.email : "—"}</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 4 }}>Mobile</div>
                                                        <div style={{ color: "var(--color-text-primary)" }}>{ag.mobile || "—"}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
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
                            agentsList={agentsList}
                            contactsList={contactsList}
                            booking={booking}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
