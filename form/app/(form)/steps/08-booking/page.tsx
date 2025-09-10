import { getRequest, patchRequest, postRequest } from "@/lib/http/fetcher";
import FormHeader from "@/components/ui/FormHeader";
import TextField from "@/components/ui/fields/TextField";
import AuPhoneField from "@/components/ui/fields/AuPhoneField";
import EmailField from "@/components/ui/fields/EmailField";
import TextAreaField from "@/components/ui/fields/TextAreaField";
import LongDateField from "@/components/ui/fields/LongDateField";
import AddAgentButton from "@/components/agents/AddAgentButton";
import AddContactButton from "@/components/contacts/AddContactButton";
import { getBookingNote } from "@/lib/actions/globals/getGlobal";

type AgentRecord = { id: string | number; first_name?: string | null; last_name?: string | null; mobile?: string | null };
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
        return <div className="container"><div className="card">Missing bookingId</div></div>;
    }

    // Load booking core
    const bookingRes = await getRequest<{ data: any }>(`/items/bookings/${encodeURIComponent(String(bookingId))}?fields=*`);
    const booking = (bookingRes as any)?.data ?? null;

    // Load agents via junction
    const agentsRes = await getRequest<{ data: Array<{ agents_id: any }> }>(
        `/items/bookings_agents?filter[bookings_id][_eq]=${encodeURIComponent(String(bookingId))}&fields=agents_id.*&limit=100`
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
                    <div style={{ background: "var(--color-pale-gray)", borderRadius: 6, padding: 12, marginBottom: 16 }}>
                        <div>{bookingNote}</div>
                    </div>
                ) : null}

                <div style={{ display: "grid", gap: 16 }}>
                    {/* Inspection type and Add-ons side by side */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                        {/* Inspection type (service): read-only */}
                        <div>
                            <div style={{ fontWeight: 600, marginBottom: 8 }}>Inspection type</div>
                            <div style={{ color: "var(--color-text-secondary)", fontSize: 14 }}>{serviceName || "—"}</div>
                        </div>

                        {/* Add-ons: read-only */}
                        <div>
                            <div style={{ fontWeight: 600, marginBottom: 8 }}>Add-ons</div>
                            <div style={{ display: "grid", gap: 6, color: "var(--color-text-secondary)", fontSize: 14 }}>
                                {selectedAddons.length === 0 ? (
                                    <div>—</div>
                                ) : (
                                    selectedAddons.map((a) => (
                                        <div key={String(a.id)} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                                            <div style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>{a.name}</div>
                                            {a.price != null ? (
                                                <div style={{ color: "var(--color-dark-gray)", fontSize: 13 }}>
                                                    {new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(Number(a.price) || 0)}
                                                </div>
                                            ) : null}
                                        </div>
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

                                return (
                                    <div key={String(p?.id || Math.random())} style={{ display: "grid", gap: 6 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                                            <div style={{ fontWeight: 500, color: "var(--color-text-primary)" }}>{address || String(p?.id || "Property")}</div>
                                            {realestateUrl ? (
                                                <a href={realestateUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-link)", textDecoration: "underline", fontSize: 14, whiteSpace: "nowrap" }}>
                                                    View on realestate.com.au
                                                </a>
                                            ) : null}
                                        </div>
                                        {details.length > 0 ? (
                                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 8 }}>
                                                {details.map((d) => (
                                                    <div key={`${String(p?.id)}-${d.label}`} style={{ display: "flex", gap: 6, alignItems: "baseline", whiteSpace: "nowrap" }}>
                                                        <div style={{ color: "var(--color-text-muted)", flexShrink: 0 }}>{d.label}:</div>
                                                        <div style={{ color: "var(--color-text-secondary)", overflow: "hidden", textOverflow: "ellipsis" }}>{d.value}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Inspection date display removed per request */}

                    {/* Add-ons section moved above; removed duplicate */}

                        {/* Only show form and Book Now button if editable */}
                        {isEditable && (
                            <form id="booking-form" action={async (formData: FormData) => {
                                "use server";
                                console.log("🚀 [BOOKING FORM] Starting form submission");
                                console.log("🚀 [BOOKING FORM] Form data keys:", Array.from(formData.keys()));
                                console.log("🚀 [BOOKING FORM] Booking ID:", bookingId);
                                console.log("🚀 [BOOKING FORM] User ID:", userId);
                                console.log("🚀 [BOOKING FORM] Property ID:", propertyId);
                                
                                try {
                                    const updates: Array<Promise<any>> = [];
                                
                                // Handle existing real estate agents updates
                                console.log("🔧 [BOOKING FORM] Processing existing agents:", agentsList.length);
                                for (const ag of agentsList) {
                                    const fn = formData.get(`agent_${ag.id}_first_name`);
                                    const ln = formData.get(`agent_${ag.id}_last_name`);
                                    const ph = formData.get(`agent_${ag.id}_mobile`);
                                    console.log(`🔧 [BOOKING FORM] Agent ${ag.id} - FN: ${fn}, LN: ${ln}, PH: ${ph}`);
                                    const payload: Record<string, unknown> = {};
                                    if (typeof fn === "string") payload.first_name = fn;
                                    if (typeof ln === "string") payload.last_name = ln;
                                    if (typeof ph === "string") payload.mobile = ph;
                                    if (Object.keys(payload).length > 0) {
                                        console.log(`🔧 [BOOKING FORM] Updating agent ${ag.id} with payload:`, payload);
                                        updates.push(patchRequest(`/items/agents/${encodeURIComponent(String(ag.id))}`, payload));
                                    }
                                }
                                
                                // Handle existing contacts updates
                                console.log("🔧 [BOOKING FORM] Processing existing contacts:", contactsList.length);
                                for (const ct of contactsList) {
                                    const fn = formData.get(`contact_${ct.id}_first_name`);
                                    const ln = formData.get(`contact_${ct.id}_last_name`);
                                    const ph = formData.get(`contact_${ct.id}_phone`);
                                    const em = formData.get(`contact_${ct.id}_email`);
                                    console.log(`🔧 [BOOKING FORM] Contact ${ct.id} - FN: ${fn}, LN: ${ln}, PH: ${ph}, EM: ${em}`);
                                    const payload: Record<string, unknown> = {};
                                    if (typeof fn === "string") payload.first_name = fn;
                                    if (typeof ln === "string") payload.last_name = ln;
                                    if (typeof ph === "string") payload.phone = ph;
                                    if (typeof em === "string") payload.email = em;
                                    if (Object.keys(payload).length > 0) {
                                        console.log(`🔧 [BOOKING FORM] Updating contact ${ct.id} with payload:`, payload);
                                        updates.push(patchRequest(`/items/contacts/${encodeURIComponent(String(ct.id))}`, payload));
                                    }
                                }
                                
                                // Handle new real estate agents creation
                                console.log("🆕 [BOOKING FORM] Processing new agents...");
                                const newAgents: Array<{ first_name?: string; last_name?: string; mobile?: string }> = [];
                                let agentIndex = 2; // Start from index 2 to match AddAgentButton
                                while (true) {
                                    const firstName = String(formData.get(`new_agent_${agentIndex}_first_name`) ?? "").trim();
                                    const lastName = String(formData.get(`new_agent_${agentIndex}_last_name`) ?? "").trim();
                                    const mobile = String(formData.get(`new_agent_${agentIndex}_mobile`) ?? "").trim();
                                    
                                    console.log(`🆕 [BOOKING FORM] Checking new agent ${agentIndex}: FN="${firstName}", LN="${lastName}", MOBILE="${mobile}"`);
                                    
                                    if (!firstName && !lastName && !mobile) break;
                                    
                                    newAgents.push({
                                        first_name: firstName || undefined,
                                        last_name: lastName || undefined,
                                        mobile: mobile || undefined
                                    });
                                    agentIndex++;
                                }
                                console.log(`🆕 [BOOKING FORM] Found ${newAgents.length} new agents to create:`, newAgents);
                                
                                // Handle new contacts creation
                                console.log("🆕 [BOOKING FORM] Processing new contacts...");
                                const newContacts: Array<{ first_name?: string; last_name?: string; phone?: string; email?: string }> = [];
                                let contactIndex = 2; // Start from index 2 to match AddContactButton
                                while (true) {
                                    const firstName = String(formData.get(`new_contact_${contactIndex}_first_name`) ?? "").trim();
                                    const lastName = String(formData.get(`new_contact_${contactIndex}_last_name`) ?? "").trim();
                                    const phone = String(formData.get(`new_contact_${contactIndex}_phone`) ?? "").trim();
                                    const email = String(formData.get(`new_contact_${contactIndex}_email`) ?? "").trim();
                                    
                                    console.log(`🆕 [BOOKING FORM] Checking new contact ${contactIndex}: FN="${firstName}", LN="${lastName}", PH="${phone}", EM="${email}"`);
                                    
                                    if (!firstName && !lastName && !phone && !email) break;
                                    
                                    newContacts.push({
                                        first_name: firstName || undefined,
                                        last_name: lastName || undefined,
                                        phone: phone || undefined,
                                        email: email || undefined
                                    });
                                    contactIndex++;
                                }
                                console.log(`🆕 [BOOKING FORM] Found ${newContacts.length} new contacts to create:`, newContacts);
                                
                                // Create new real estate agents if any
                                let newAgentIds: Array<string | number> = [];
                                if (newAgents.length > 0 && propertyId) {
                                    console.log(`🆕 [BOOKING FORM] Creating ${newAgents.length} new agents for property ${propertyId}`);
                                    try {
                                        const { createAgentsForProperty } = await import("@/lib/actions/agents/createAgent");
                                        const createdAgents = await createAgentsForProperty(propertyId, newAgents);
                                        newAgentIds = createdAgents.map(agent => agent.id);
                                        console.log(`✅ [BOOKING FORM] Successfully created agents with IDs:`, newAgentIds);
                                    } catch (error) {
                                        console.error("❌ [BOOKING FORM] Failed to create new real estate agents:", error);
                                    }
                                } else {
                                    console.log(`⚠️ [BOOKING FORM] Skipping agent creation - newAgents: ${newAgents.length}, propertyId: ${propertyId}`);
                                }
                                
                                // Create new contacts if any
                                let newContactIds: Array<string | number> = [];
                                if (newContacts.length > 0) {
                                    console.log(`🆕 [BOOKING FORM] Creating ${newContacts.length} new contacts`);
                                    try {
                                        const { createContact } = await import("@/lib/actions/contacts/createContact");
                                        const { updateContact } = await import("@/lib/actions/contacts/updateContact");
                                        for (const contactData of newContacts) {
                                            console.log(`🆕 [BOOKING FORM] Processing contact data:`, contactData);
                                            // Only create contact if we have required fields
                                            if (contactData.first_name && contactData.last_name && contactData.email) {
                                                console.log(`🆕 [BOOKING FORM] Creating contact with required fields`);
                                                const res = await createContact({
                                                    first_name: contactData.first_name,
                                                    last_name: contactData.last_name,
                                                    email: contactData.email,
                                                    phone: contactData.phone || ""
                                                });
                                                console.log(`🆕 [BOOKING FORM] Contact creation result:`, res);
                                                if (res?.success && res?.contactId) {
                                                    newContactIds.push(res.contactId);
                                                    console.log(`✅ [BOOKING FORM] Added contact ID ${res.contactId} to newContactIds`);
                                                    
                                                    // Link contact to user (same approach as first step)
                                                    if (userId) {
                                                        console.log(`🔗 [BOOKING FORM] Linking new contact ${res.contactId} to user ${userId}`);
                                                        try {
                                                            await updateContact(res.contactId, { user: userId } as any);
                                                            console.log(`✅ [BOOKING FORM] Successfully linked contact ${res.contactId} to user ${userId}`);
                                                        } catch (linkError) {
                                                            console.error(`❌ [BOOKING FORM] Failed to link contact ${res.contactId} to user:`, linkError);
                                                        }
                                                    } else {
                                                        console.log(`⚠️ [BOOKING FORM] No userId available to link contact ${res.contactId}`);
                                                    }
                                                }
                                            } else {
                                                console.log(`⚠️ [BOOKING FORM] Skipping contact creation - missing required fields:`, {
                                                    hasFirstName: !!contactData.first_name,
                                                    hasLastName: !!contactData.last_name,
                                                    hasEmail: !!contactData.email
                                                });
                                            }
                                        }
                                        console.log(`✅ [BOOKING FORM] Successfully created contacts with IDs:`, newContactIds);
                                    } catch (error) {
                                        console.error("❌ [BOOKING FORM] Failed to create new contacts:", error);
                                    }
                                } else {
                                    console.log(`⚠️ [BOOKING FORM] No new contacts to create`);
                                }
                                const tentativeDate = String(formData.get("booking_tentative_inspection_date") ?? "").trim();
                                const additionalInfo = String(formData.get("booking_additional_information") ?? "").trim();
                                
                                // Ensure existing booking contacts are linked to the user
                                if (userId && contactIds.length > 0) {
                                    console.log(`🔗 [BOOKING FORM] Linking existing contacts to user ${userId}:`, contactIds);
                                    try {
                                        await patchRequest(`/users/${encodeURIComponent(String(userId))}`, { contacts: contactIds.map((id) => ({ id: String(id) })) } as any);
                                        console.log(`✅ [BOOKING FORM] Successfully linked existing contacts to user`);
                                    } catch (error) {
                                        console.error("❌ [BOOKING FORM] Failed to link existing contacts to user:", error);
                                    }
                                } else {
                                    console.log(`⚠️ [BOOKING FORM] Skipping user-contact linking - userId: ${userId}, contactIds: ${contactIds.length}`);
                                }
                                
                                // Also update user's contacts field to include new contacts
                                if (userId && newContactIds.length > 0) {
                                    console.log(`🔗 [BOOKING FORM] Adding new contacts to user's contacts field:`, newContactIds);
                                    try {
                                        // Get existing user contacts first
                                        const userRes = await getRequest(`/users/${encodeURIComponent(String(userId))}?fields=contacts`);
                                        const existingUserContacts = (userRes as any)?.data?.contacts || [];
                                        const existingContactIds = Array.isArray(existingUserContacts) 
                                            ? existingUserContacts.map((c: any) => typeof c === "object" ? String(c.id) : String(c))
                                            : [];
                                        
                                        console.log(`🔗 [BOOKING FORM] Existing user contacts:`, existingContactIds);
                                        
                                        // Combine existing and new contact IDs
                                        const allUserContactIds = [...existingContactIds, ...newContactIds.map(String)];
                                        const uniqueContactIds = [...new Set(allUserContactIds)]; // Remove duplicates
                                        
                                        console.log(`🔗 [BOOKING FORM] Updating user contacts field with:`, uniqueContactIds);
                                        
                                        await patchRequest(`/users/${encodeURIComponent(String(userId))}`, { 
                                            contacts: uniqueContactIds.map((id) => ({ id: String(id) })) 
                                        } as any);
                                        console.log(`✅ [BOOKING FORM] Successfully updated user's contacts field`);
                                    } catch (error) {
                                        console.error("❌ [BOOKING FORM] Failed to update user's contacts field:", error);
                                    }
                                } else {
                                    console.log(`⚠️ [BOOKING FORM] Skipping user contacts field update - userId: ${userId}, newContactIds: ${newContactIds.length}`);
                                }
                                
                                if (updates.length > 0) {
                                    console.log(`🔧 [BOOKING FORM] Processing ${updates.length} updates for existing records`);
                                    await Promise.allSettled(updates);
                                    console.log(`✅ [BOOKING FORM] Completed all updates`);
                                } else {
                                    console.log(`⚠️ [BOOKING FORM] No updates to process`);
                                }
                                
                                // Link new real estate agents to the booking
                                if (newAgentIds.length > 0 && booking?.id != null) {
                                    console.log(`🔗 [BOOKING FORM] Linking ${newAgentIds.length} new agents to booking ${booking.id}:`, newAgentIds);
                                    try {
                                        for (const agentId of newAgentIds) {
                                            console.log(`🔗 [BOOKING FORM] Linking agent ${agentId} to booking ${booking.id}`);
                                            await postRequest("/items/bookings_agents", {
                                                agents_id: String(agentId),
                                                bookings_id: String(booking.id),
                                            } as unknown as Record<string, unknown>);
                                            console.log(`✅ [BOOKING FORM] Successfully linked agent ${agentId} to booking`);
                                        }
                                        console.log(`✅ [BOOKING FORM] Successfully linked all new agents to booking`);
                                    } catch (error) {
                                        console.error("❌ [BOOKING FORM] Failed to link new real estate agents to booking:", error);
                                    }
                                } else {
                                    console.log(`⚠️ [BOOKING FORM] Skipping agent-booking linking - newAgentIds: ${newAgentIds.length}, bookingId: ${booking?.id}`);
                                }
                                
                                // Add new contacts to the booking's contacts array
                                if (newContactIds.length > 0 && booking?.id != null) {
                                    console.log(`🔗 [BOOKING FORM] Adding ${newContactIds.length} new contacts to booking ${booking.id}:`, newContactIds);
                                    try {
                                        // Get existing contact IDs from booking
                                        const existingContactIds: string[] = [];
                                        if (Array.isArray(booking?.contacts)) {
                                            for (const c of booking.contacts) {
                                                const id = typeof c === "object" ? String((c as any)?.id ?? "") : String(c ?? "");
                                                if (id) existingContactIds.push(id);
                                            }
                                        }
                                        console.log(`🔗 [BOOKING FORM] Existing contact IDs:`, existingContactIds);
                                        
                                        // Combine existing and new contact IDs
                                        const allContactIds = [...existingContactIds, ...newContactIds.map(String)];
                                        console.log(`🔗 [BOOKING FORM] Combined contact IDs:`, allContactIds);
                                        
                                        // Update booking with combined contacts
                                        console.log(`🔗 [BOOKING FORM] Updating booking ${booking.id} with contacts:`, allContactIds);
                                        await patchRequest(`/items/bookings/${encodeURIComponent(String(booking.id))}`, {
                                            contacts: allContactIds
                                        });
                                        console.log(`✅ [BOOKING FORM] Successfully added new contacts to booking`);
                                    } catch (error) {
                                        console.error("❌ [BOOKING FORM] Failed to add new contacts to booking:", error);
                                    }
                                } else {
                                    console.log(`⚠️ [BOOKING FORM] Skipping contact-booking linking - newContactIds: ${newContactIds.length}, bookingId: ${booking?.id}`);
                                }
                                
                                // Update booking with combined payload and set status to booked, then redirect to thank you (step 9)
                                if (booking?.id != null) {
                                    const bookingPayload: Record<string, unknown> = { status: "booked" };
                                    if (tentativeDate) bookingPayload.tentative_date = tentativeDate;
                                    if (additionalInfo) bookingPayload.additional_info = additionalInfo;
                                    
                                    console.log(`📝 [BOOKING FORM] Updating booking ${booking.id} with payload:`, bookingPayload);
                                    try { 
                                        await patchRequest(`/items/bookings/${encodeURIComponent(String(booking.id))}`, bookingPayload);
                                        console.log(`✅ [BOOKING FORM] Successfully updated booking status to 'booked'`);
                                    } catch (error) {
                                        console.error("❌ [BOOKING FORM] Failed to update booking:", error);
                                    }
                                } else {
                                    console.log(`⚠️ [BOOKING FORM] No booking ID available for status update`);
                                }
                                } catch (error) {
                                    console.error("💥 CRITICAL ERROR in booking form submission:", error);
                                    throw error; // Re-throw to prevent silent failures
                                }
                                
                                // Redirect after successful completion (outside try-catch to avoid catching redirect errors)
                                if (booking?.id != null) {
                                    console.log(`🔄 [BOOKING FORM] Redirecting to thank you page with booking ID: ${booking.id}`);
                                    const params = new URLSearchParams();
                                    params.set("bookingId", String(booking?.id));
                                    if (userId) params.set("userId", String(userId));
                                    if (contactId) params.set("contactId", String(contactId));
                                    if (dealId) params.set("dealId", String(dealId));
                                    if (propertyId) params.set("propertyId", String(propertyId));
                                    if (quoteId) params.set("quoteId", String(quoteId));
                                    if (invoiceId) params.set("invoiceId", String(invoiceId));
                                    
                                    console.log(`🔄 [BOOKING FORM] Redirect URL: /steps/09-thank-you?${params.toString()}`);
                                    const { redirect } = await import("next/navigation");
                                    redirect(`/steps/09-thank-you?${params.toString()}`);
                                } else {
                                    console.log(`⚠️ [BOOKING FORM] No booking ID available for redirect`);
                                }
                            }}>
                                {/* Contacts block: edit contacts */}
                                <div>
                                    <div style={{ fontWeight: 600, marginBottom: 8 }}>Contacts</div>
                                    <div style={{ display: "grid", gap: 8, padding: 12, border: "1px dashed var(--color-light-gray)", borderRadius: 6, backgroundColor: "var(--color-pale-gray)" }}>
                                        {contactsList.length === 0 ? (
                                            <>
                                                <div style={{ color: "var(--color-text-secondary)", fontSize: 14, textAlign: "center" }}>No contacts assigned to this booking</div>
                                                <div style={{ display: "grid", gap: 8 }}>
                                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                                        <TextField name="new_contact_1_first_name" label="First name" />
                                                        <TextField name="new_contact_1_last_name" label="Last name" />
                                                    </div>
                                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                                        <AuPhoneField name="new_contact_1_phone" label="Mobile" />
                                                        <EmailField name="new_contact_1_email" label="Email" />
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            contactsList.map((ct) => (
                                                <div key={String(ct.id)} style={{ display: "grid", gap: 8 }}>
                                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                                        <TextField name={`contact_${ct.id}_first_name`} label="First name" defaultValue={ct.first_name || ""} />
                                                        <TextField name={`contact_${ct.id}_last_name`} label="Last name" defaultValue={ct.last_name || ""} />
                                                    </div>
                                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                                        <AuPhoneField name={`contact_${ct.id}_phone`} label="Mobile" defaultValue={(ct.phone || "").toString()} />
                                                        <EmailField name={`contact_${ct.id}_email`} label="Email" defaultValue={ct.email || ""} />
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    <AddContactButton />
                                </div>

                                {/* Real Estate Agents block: edit real estate agents */}
                                <div>
                                    <div style={{ fontWeight: 600, marginTop: 8 }}>Real Estate Agent</div>
                                    <div style={{ display: "grid", gap: 8, padding: 12, border: "1px dashed var(--color-light-gray)", borderRadius: 6, backgroundColor: "var(--color-pale-gray)" }}>
                                        {agentsList.length === 0 ? (
                                            <>
                                                <div style={{ color: "var(--color-text-secondary)", fontSize: 14, textAlign: "center" }}>No real estate agents assigned to this booking</div>
                                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                                                    <TextField name="new_agent_1_first_name" label="First name" />
                                                    <TextField name="new_agent_1_last_name" label="Last name" />
                                                    <AuPhoneField name="new_agent_1_mobile" label="Mobile" />
                                                </div>
                                            </>
                                        ) : (
                                            agentsList.map((ag) => (
                                                <div key={String(ag.id)} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                                                    <TextField name={`agent_${ag.id}_first_name`} label="First name" defaultValue={ag.first_name || ""} />
                                                    <TextField name={`agent_${ag.id}_last_name`} label="Last name" defaultValue={ag.last_name || ""} />
                                                    <AuPhoneField name={`agent_${ag.id}_mobile`} label="Mobile" defaultValue={(ag.mobile || "").toString()} />
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    <AddAgentButton />
                                </div>

                                {/* Form fields for tentative date and additional information */}
                                <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
                                    <div style={{ gridColumn: "1 / -1" }}>
                                        <LongDateField
                                            name="booking_tentative_inspection_date"
                                            label="Tentative inspection date (To Be Confirmed)"
                                            defaultValue={(booking as any)?.tentative_date ? new Date((booking as any).tentative_date).toISOString() : undefined}
                                        />
                                    </div>
                                    <div style={{ gridColumn: "1 / -1" }}>
                                        <TextAreaField name="booking_additional_information" label="Additional information" placeholder="Add any extra details for this booking (optional)" rows={4} defaultValue={(booking as any)?.additional_info || ""} />
                                    </div>
                                </div>
                                
                                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                                    <button type="submit" className="button-primary">Book Now</button>
                                </div>
                            </form>
                        )}
                </div>
            </div>
        </div>
    );
}



