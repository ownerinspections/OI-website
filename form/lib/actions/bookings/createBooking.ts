"use server";

import { getRequest, postRequest, patchRequest } from "@/lib/http/fetcher";

type DirectusItemResponse<T> = { data: T };
type DirectusListResponse<T> = { data: T[] };

export type BookingRecord = {
    id: string | number;
    booking_id?: string | number | null;
    property?: string | number | null;
    user?: string | number | null;
    contacts?: Array<string | number> | null;
    agents?: Array<string | number> | null;
    inspectors?: Array<string | number> | null;
    status?: string | null;
    tentative_date?: string | null;
    booking_date_and_time?: string | null;
    additional_info?: string | null;
    booking_link?: string | null;
};

export async function findAgentsForProperty(propertyId: string | number): Promise<Array<string | number>> {
    const agentIds: Array<string | number> = [];
    try {
        const res1 = await getRequest<DirectusListResponse<{ agents_id: string | number }>>(
            `/items/agents_property_2?filter[property_id][_eq]=${encodeURIComponent(String(propertyId))}&fields=agents_id&limit=100`
        );
        const list1 = Array.isArray(res1?.data) ? res1.data : [];
        for (const row of list1) {
            if (row?.agents_id != null) agentIds.push(row.agents_id);
        }
    } catch {}
    try {
        const res2 = await getRequest<DirectusListResponse<{ agents_id: string | number }>>(
            `/items/property_agents_1?filter[property_id][_eq]=${encodeURIComponent(String(propertyId))}&fields=agents_id&limit=100`
        );
        const list2 = Array.isArray(res2?.data) ? res2.data : [];
        for (const row of list2) {
            if (row?.agents_id != null) agentIds.push(row.agents_id);
        }
    } catch {}
    // unique preserve order
    const seen = new Set<string>();
    const unique: Array<string | number> = [];
    for (const id of agentIds) {
        const key = String(id);
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(id);
        }
    }
    return unique;
}

export async function ensureBooking(params: {
    invoiceId: string | number;
    propertyId: string | number;
    userId?: string | number;
    contactId?: string | number;
    dealId?: string | number;
    quoteId?: string | number;
}): Promise<BookingRecord> {
    let bookingPublicId = String(params.invoiceId);
    // Derive public invoice number (quote id) for booking_id when available
    try {
        const inv = await getRequest<{ data: { invoice_id?: string | number } }>(
            `/items/os_invoices/${encodeURIComponent(String(params.invoiceId))}?fields=invoice_id`
        );
        const invData = (inv as any)?.data || {};
        const cand = (invData as any)?.invoice_id;
        if (cand) bookingPublicId = String(cand);
    } catch {}

    // Idempotent check by booking_id
    try {
        const existing = await getRequest<DirectusListResponse<BookingRecord>>(
            `/items/bookings?filter[booking_id][_eq]=${encodeURIComponent(bookingPublicId)}&limit=1`
        );
        const arr = Array.isArray(existing?.data) ? existing.data : [];
        if (arr.length > 0) return arr[0] as BookingRecord;
    } catch {}

    // Load all contacts from deal if dealId is provided
    let dealContactIds: Array<string> = [];
    if (params.dealId) {
        try {
            console.log(`[ensureBooking] Loading contacts from deal ${params.dealId}`);
            const contactsRes = await getRequest<{ data: Array<{ contacts_id: any }> }>(
                `/items/os_deals_contacts?filter[os_deals_id][_eq]=${encodeURIComponent(String(params.dealId))}&fields=contacts_id.id&limit=100`
            );
            const contactsExpanded: any[] = Array.isArray((contactsRes as any)?.data) ? (contactsRes as any).data.map((r: any) => r.contacts_id) : [];
            
            // Extract contact IDs
            for (const contact of contactsExpanded) {
                if (typeof contact === "object" && contact?.id) {
                    dealContactIds.push(String(contact.id));
                }
            }
            console.log(`[ensureBooking] Found ${dealContactIds.length} contacts in deal: [${dealContactIds.join(', ')}]`);
        } catch (error) {
            console.error(`[ensureBooking] Failed to load contacts from deal ${params.dealId}:`, error);
        }
    }

    // Include primary contact if provided and not already in deal contacts
    const allContactIds: Array<string> = [...dealContactIds];
    if (params.contactId && !dealContactIds.includes(String(params.contactId))) {
        allContactIds.push(String(params.contactId));
    }

    const payload: Record<string, unknown> = {
        booking_id: bookingPublicId,
        status: "submitted",
        ...(params.userId ? { user: String(params.userId) } : {}),
        ...(allContactIds.length > 0 ? { contacts: allContactIds } : {}),
    };

    console.log(`[ensureBooking] Creating booking with ${allContactIds.length} contacts: [${allContactIds.join(', ')}]`);
    const created = await postRequest<DirectusItemResponse<BookingRecord>>("/items/bookings", payload);
    const createdBooking = (created as any)?.data as BookingRecord;

    // Update deal with booking reference
    if (createdBooking?.id && params.dealId) {
        try {
            await patchRequest(`/items/os_deals/${encodeURIComponent(String(params.dealId))}`, {
                booking: String(createdBooking.id)
            });
            console.log(`[ensureBooking] Successfully linked booking ${createdBooking.id} to deal ${params.dealId}`);
        } catch (error) {
            console.error(`[ensureBooking] Failed to link booking ${createdBooking.id} to deal ${params.dealId}:`, error);
        }
    }

    // Update booking with booking_link after creation
    if (createdBooking?.id) {
        try {
            const base = (process.env.APP_BASE_URL || "").trim() || "http://localhost:8030";
            const baseNoSlash = base.replace(/\/$/, "");
            
            // Build full URL with all parameters
            const sp = new URLSearchParams();
            if (params.userId) sp.set("userId", String(params.userId));
            if (params.contactId) sp.set("contactId", String(params.contactId));
            if (params.dealId) sp.set("dealId", String(params.dealId));
            if (params.propertyId) sp.set("propertyId", String(params.propertyId));
            if (params.quoteId) sp.set("quoteId", String(params.quoteId));
            if (params.invoiceId) sp.set("invoiceId", String(params.invoiceId));
            sp.set("bookingId", String(createdBooking.id));
            
            const bookingLink = `${baseNoSlash}/steps/08-booking?${sp.toString()}`;
            
            await patchRequest(`/items/bookings/${encodeURIComponent(String(createdBooking.id))}`, {
                booking_link: bookingLink
            });
        } catch (error) {
            console.error("Failed to update booking with booking_link:", error);
        }
    }

    // Attach agents via junction table bookings_agents
    try {
        const agentIds = await findAgentsForProperty(params.propertyId);
        if (agentIds.length > 0 && createdBooking?.id != null) {
            // Fetch existing links to avoid duplicates
            let existing: Array<{ agents_id: string | number }> = [];
            try {
                const existingRes = await getRequest<DirectusListResponse<{ agents_id: string | number }>>(
                    `/items/bookings_agents?filter[bookings_id][_eq]=${encodeURIComponent(String(createdBooking.id))}&fields=agents_id&limit=500`
                );
                existing = Array.isArray(existingRes?.data) ? existingRes.data : [];
            } catch {}
            const existingSet = new Set(existing.map((r) => String(r.agents_id)));
            for (const aId of agentIds) {
                if (existingSet.has(String(aId))) continue;
                try {
                    await postRequest("/items/bookings_agents", {
                        agents_id: String(aId),
                        bookings_id: String(createdBooking.id),
                    } as unknown as Record<string, unknown>);
                } catch {}
            }
        }
    } catch {}

    // Attach property via junction table bookings_property (many-to-many)
    try {
        if (createdBooking?.id != null && params.propertyId != null) {
            // Avoid duplicate links
            let existingProps: Array<{ property_id: string | number }> = [];
            try {
                const existRes = await getRequest<DirectusListResponse<{ property_id: string | number }>>(
                    `/items/bookings_property?filter[bookings_id][_eq]=${encodeURIComponent(String(createdBooking.id))}&fields=property_id&limit=200`
                );
                existingProps = Array.isArray(existRes?.data) ? existRes.data : [];
            } catch {}
            const exists = existingProps.some((r) => String(r.property_id) === String(params.propertyId));
            if (!exists) {
                try {
                    await postRequest("/items/bookings_property", {
                        property_id: String(params.propertyId),
                        bookings_id: String(createdBooking.id),
                    } as unknown as Record<string, unknown>);
                } catch {}
            }
        }
    } catch {}

    return createdBooking;
}


