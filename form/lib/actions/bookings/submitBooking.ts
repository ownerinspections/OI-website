"use server";

import { getRequest, patchRequest, postRequest } from "@/lib/http/fetcher";
import { createAgent } from "@/lib/actions/agents/createAgent";
import { createContact } from "@/lib/actions/contacts/createContact";
import { updateContact } from "@/lib/actions/contacts/updateContact";
import { redirect } from "next/navigation";

export type BookingActionResult = {
	success?: boolean;
	errors?: Record<string, string>;
	message?: string;
	debug?: unknown[];
};

type AgentData = {
	first_name?: string;
	last_name?: string;
	mobile?: string;
	email?: string;
};

type ContactData = {
	first_name?: string;
	last_name?: string;
	phone?: string;
	email?: string;
};

function validateAgent(agent: AgentData, index: string | number): Record<string, string> {
	const errors: Record<string, string> = {};
	
	if (agent.first_name && agent.last_name && !agent.mobile?.trim()) {
		errors[`agent_${index}_mobile`] = "Mobile number is required";
	}
	
	return errors;
}

function validateContact(contact: ContactData, index: string | number, isNew: boolean = false): Record<string, string> {
	const errors: Record<string, string> = {};
	
	// Only validate phone for new contacts (existing contacts have read-only phone)
	if (isNew && contact.first_name && contact.last_name && !contact.phone?.trim()) {
		errors[`contact_${index}_phone`] = "Phone is required";
	}
	
	return errors;
}

export async function submitBooking(prevState: BookingActionResult, formData: FormData): Promise<BookingActionResult> {
	const debug: unknown[] = [];
	
	try {
		console.log("🚀 [SUBMIT BOOKING] Starting booking submission");
		debug.push({ tag: "start", timestamp: new Date().toISOString() });
		
		const bookingId = String(formData.get("booking_id") ?? "");
		const userId = String(formData.get("user_id") ?? "");
		const propertyId = String(formData.get("property_id") ?? "");
		const contactId = String(formData.get("contact_id") ?? "");
		const dealId = String(formData.get("deal_id") ?? "");
		const quoteId = String(formData.get("quote_id") ?? "");
		const invoiceId = String(formData.get("invoice_id") ?? "");
		
		console.log("🚀 [SUBMIT BOOKING] Form data keys:", Array.from(formData.keys()));
		debug.push({ 
			tag: "form_data", 
			bookingId, 
			userId, 
			propertyId, 
			contactId, 
			dealId, 
			quoteId, 
			invoiceId 
		});
		
		if (!bookingId) {
			return {
				success: false,
				message: "Booking ID is required",
				debug
			};
		}
		
		// Load existing agents and contacts
		const agentsRes = await getRequest<{ data: Array<{ agents_id: any }> }>(
			`/items/bookings_agents?filter[bookings_id][_eq]=${encodeURIComponent(bookingId)}&fields=agents_id.id,agents_id.first_name,agents_id.last_name,agents_id.mobile,agents_id.email&limit=100`
		);
		const agentsExpanded: any[] = Array.isArray((agentsRes as any)?.data) ? (agentsRes as any).data.map((r: any) => r.agents_id) : [];
		const agentsList = agentsExpanded.map((a: any) => (typeof a === "object" ? a : { id: a }));
		
		// Load existing contacts
		const bookingRes = await getRequest<{ data: any }>(`/items/bookings/${encodeURIComponent(bookingId)}?fields=*`);
		const booking = (bookingRes as any)?.data ?? null;
		
		const contactIds: string[] = [];
		if (Array.isArray(booking?.contacts)) {
			for (const c of booking.contacts) {
				const id = typeof c === "object" ? String((c as any)?.id ?? "") : String(c ?? "");
				if (id) contactIds.push(id);
			}
		}
		
		const contactsList: any[] = [];
		for (const contactId of contactIds) {
			try {
				const contactRes = await getRequest<{ data: any }>(`/items/contacts/${encodeURIComponent(contactId)}?fields=id,first_name,last_name,phone,email`);
				const contact = (contactRes as any)?.data;
				if (contact) {
					contactsList.push(contact);
				}
			} catch (error) {
				console.error(`Failed to load contact ${contactId}:`, error);
			}
		}
		
		debug.push({ 
			tag: "loaded_data", 
			agentsCount: agentsList.length, 
			contactsCount: contactsList.length 
		});
		
		// Validate existing agents
		const allErrors: Record<string, string> = {};
		
		for (const ag of agentsList) {
			const fn = formData.get(`agent_${ag.id}_first_name`);
			const ln = formData.get(`agent_${ag.id}_last_name`);
			const ph = formData.get(`agent_${ag.id}_mobile`);
			const em = formData.get(`agent_${ag.id}_email`);
			
			const agentData: AgentData = {
				first_name: typeof fn === "string" ? fn : undefined,
				last_name: typeof ln === "string" ? ln : undefined,
				mobile: typeof ph === "string" ? ph : undefined,
				email: typeof em === "string" ? em : undefined,
			};
			
			const agentErrors = validateAgent(agentData, ag.id);
			Object.assign(allErrors, agentErrors);
		}
		
		// Validate existing contacts
		for (const ct of contactsList) {
			const fn = formData.get(`contact_${ct.id}_first_name`);
			const ln = formData.get(`contact_${ct.id}_last_name`);
			const ph = formData.get(`contact_${ct.id}_phone`);
			const em = formData.get(`contact_${ct.id}_email`);
			
			const contactData: ContactData = {
				first_name: typeof fn === "string" ? fn : undefined,
				last_name: typeof ln === "string" ? ln : undefined,
				phone: typeof ph === "string" ? ph : undefined,
				email: typeof em === "string" ? em : undefined,
			};
			
			const contactErrors = validateContact(contactData, ct.id, false); // false = existing contact (read-only phone)
			Object.assign(allErrors, contactErrors);
		}
		
		// Validate new agents
		let validateAgentIndex = 1;
		let foundAnyNewAgentsForValidation = false;
		while (true) {
			const firstName = String(formData.get(`new_agent_${validateAgentIndex}_first_name`) ?? "").trim();
			const lastName = String(formData.get(`new_agent_${validateAgentIndex}_last_name`) ?? "").trim();
			const mobile = String(formData.get(`new_agent_${validateAgentIndex}_mobile`) ?? "").trim();
			const email = String(formData.get(`new_agent_${validateAgentIndex}_email`) ?? "").trim();
			
			if (!firstName && !lastName && !mobile && !email) {
				// If we haven't found any new agents yet, continue checking higher indices
				// If we have found agents before, then we've reached the end
				if (!foundAnyNewAgentsForValidation && validateAgentIndex < 10) {
					validateAgentIndex++;
					continue;
				} else {
					break;
				}
			}
			
			foundAnyNewAgentsForValidation = true;
			const agentData: AgentData = { first_name: firstName, last_name: lastName, mobile, email };
			const agentErrors = validateAgent(agentData, `new_${validateAgentIndex}`);
			Object.assign(allErrors, agentErrors);
			
			validateAgentIndex++;
		}
		
		// Validate new contacts
		let validateContactIndex = 1;
		let foundAnyNewContactsForValidation = false;
		while (true) {
			const firstName = String(formData.get(`new_contact_${validateContactIndex}_first_name`) ?? "").trim();
			const lastName = String(formData.get(`new_contact_${validateContactIndex}_last_name`) ?? "").trim();
			const phone = String(formData.get(`new_contact_${validateContactIndex}_phone`) ?? "").trim();
			const email = String(formData.get(`new_contact_${validateContactIndex}_email`) ?? "").trim();
			
			if (!firstName && !lastName && !phone && !email) {
				// If we haven't found any new contacts yet, continue checking higher indices
				// If we have found contacts before, then we've reached the end
				if (!foundAnyNewContactsForValidation && validateContactIndex < 10) {
					validateContactIndex++;
					continue;
				} else {
					break;
				}
			}
			
			foundAnyNewContactsForValidation = true;
			const contactData: ContactData = { first_name: firstName, last_name: lastName, phone, email };
			const contactErrors = validateContact(contactData, `new_${validateContactIndex}`, true); // true = new contact (editable phone)
			Object.assign(allErrors, contactErrors);
			
			validateContactIndex++;
		}
		
		// If there are validation errors, return them
		if (Object.keys(allErrors).length > 0) {
			console.log("❌ [SUBMIT BOOKING] Validation errors:", allErrors);
			debug.push({ tag: "validation_errors", errors: allErrors });
			return {
				success: false,
				errors: allErrors,
				debug
			};
		}
		
		// If validation passes, proceed with the original booking logic
		console.log("✅ [SUBMIT BOOKING] Validation passed, proceeding with booking");
		debug.push({ tag: "validation_passed" });
		
		
		// Execute the original booking logic here
		const updates: Array<Promise<any>> = [];
		
		// Handle existing real estate agents updates
		console.log("🔧 [SUBMIT BOOKING] Processing existing agents:", agentsList.length);
		for (const ag of agentsList) {
			const fn = formData.get(`agent_${ag.id}_first_name`);
			const ln = formData.get(`agent_${ag.id}_last_name`);
			const ph = formData.get(`agent_${ag.id}_mobile`);
			const em = formData.get(`agent_${ag.id}_email`);
			
			const payload: Record<string, unknown> = {};
			if (typeof fn === "string") payload.first_name = fn;
			if (typeof ln === "string") payload.last_name = ln;
			if (typeof ph === "string") payload.mobile = ph;
			if (typeof em === "string" && em.trim()) payload.email = em.trim();
			if (Object.keys(payload).length > 0) {
				console.log(`🔧 [SUBMIT BOOKING] Updating agent ${ag.id} with payload:`, payload);
				updates.push(patchRequest(`/items/agents/${encodeURIComponent(String(ag.id))}`, payload));
			}
		}
		
		// Handle existing contacts updates
		console.log("🔧 [SUBMIT BOOKING] Processing existing contacts:", contactsList.length);
		for (const ct of contactsList) {
			const fn = formData.get(`contact_${ct.id}_first_name`);
			const ln = formData.get(`contact_${ct.id}_last_name`);
			const ph = formData.get(`contact_${ct.id}_phone`);
			const em = formData.get(`contact_${ct.id}_email`);
			
			const payload: Record<string, unknown> = {};
			if (typeof fn === "string") payload.first_name = fn;
			if (typeof ln === "string") payload.last_name = ln;
			if (typeof ph === "string") payload.phone = ph;
			if (typeof em === "string" && em.trim()) payload.email = em.trim();
			if (Object.keys(payload).length > 0) {
				console.log(`🔧 [SUBMIT BOOKING] Updating contact ${ct.id} with payload:`, payload);
				updates.push(patchRequest(`/items/contacts/${encodeURIComponent(String(ct.id))}`, payload));
			}
		}
		
		// Handle new agents creation
		let newAgentIds: Array<string | number> = [];
		const newAgents: Array<{ first_name?: string; last_name?: string; mobile?: string; email?: string }> = [];
		let createAgentIndex = 1;
		let foundAnyNewAgents = false;
		while (true) {
			const firstName = String(formData.get(`new_agent_${createAgentIndex}_first_name`) ?? "").trim();
			const lastName = String(formData.get(`new_agent_${createAgentIndex}_last_name`) ?? "").trim();
			const mobile = String(formData.get(`new_agent_${createAgentIndex}_mobile`) ?? "").trim();
			const email = String(formData.get(`new_agent_${createAgentIndex}_email`) ?? "").trim();
			
			if (!firstName && !lastName && !mobile && !email) {
				// If we haven't found any new agents yet, continue checking higher indices
				// If we have found agents before, then we've reached the end
				if (!foundAnyNewAgents && createAgentIndex < 10) {
					createAgentIndex++;
					continue;
				} else {
					break;
				}
			}
			
			foundAnyNewAgents = true;
			newAgents.push({
				first_name: firstName || undefined,
				last_name: lastName || undefined,
				mobile: mobile || undefined,
				email: email || undefined
			});
			createAgentIndex++;
		}
		
		if (newAgents.length > 0 && propertyId) {
			console.log(`🆕 [SUBMIT BOOKING] Creating ${newAgents.length} new agents for property ${propertyId}`);
			try {
				const { createAgentsForProperty } = await import("@/lib/actions/agents/createAgent");
				const createdAgents = await createAgentsForProperty(propertyId, newAgents);
				newAgentIds = createdAgents.map(agent => agent.id);
				console.log(`✅ [SUBMIT BOOKING] Successfully created agents with IDs:`, newAgentIds);
			} catch (error) {
				console.error("❌ [SUBMIT BOOKING] Failed to create new real estate agents:", error);
			}
		}
		
		// Handle new contacts creation
		let newContactIds: Array<string | number> = [];
		const newContacts: Array<{ first_name?: string; last_name?: string; phone?: string; email?: string }> = [];
		let createContactIndex = 1;
		let foundAnyNewContacts = false;
		while (true) {
			const firstName = String(formData.get(`new_contact_${createContactIndex}_first_name`) ?? "").trim();
			const lastName = String(formData.get(`new_contact_${createContactIndex}_last_name`) ?? "").trim();
			const phone = String(formData.get(`new_contact_${createContactIndex}_phone`) ?? "").trim();
			const email = String(formData.get(`new_contact_${createContactIndex}_email`) ?? "").trim();
			
			if (!firstName && !lastName && !phone && !email) {
				// If we haven't found any new contacts yet, continue checking higher indices
				// If we have found contacts before, then we've reached the end
				if (!foundAnyNewContacts && createContactIndex < 10) {
					createContactIndex++;
					continue;
				} else {
					break;
				}
			}
			
			foundAnyNewContacts = true;
			newContacts.push({
				first_name: firstName || undefined,
				last_name: lastName || undefined,
				phone: phone || undefined,
				email: email || undefined
			});
			createContactIndex++;
		}
		
		if (newContacts.length > 0) {
			console.log(`🆕 [SUBMIT BOOKING] Creating ${newContacts.length} new contacts`);
			try {
				for (const contactData of newContacts) {
					if (contactData.first_name && contactData.last_name && contactData.email) {
						const res = await createContact({
							first_name: contactData.first_name,
							last_name: contactData.last_name,
							email: contactData.email,
							phone: contactData.phone || ""
						});
						if (res?.success && res?.contactId) {
							newContactIds.push(res.contactId);
							
							// Link contact to current user
							if (userId) {
								try {
									await updateContact(res.contactId, { user: userId } as any);
									console.log(`✅ [SUBMIT BOOKING] Successfully linked contact ${res.contactId} to user ${userId}`);
								} catch (linkError) {
									console.error(`❌ [SUBMIT BOOKING] Failed to link contact ${res.contactId} to user ${userId}:`, linkError);
								}
							} else {
								console.warn(`⚠️ [SUBMIT BOOKING] No userId provided, contact ${res.contactId} not linked to user`);
							}
						}
					}
				}
				console.log(`✅ [SUBMIT BOOKING] Successfully created contacts with IDs:`, newContactIds);
			} catch (error) {
				console.error("❌ [SUBMIT BOOKING] Failed to create new contacts:", error);
			}
		}
		
		// Link new agents to the booking
		if (newAgentIds.length > 0 && booking?.id != null) {
			console.log(`🔗 [SUBMIT BOOKING] Linking ${newAgentIds.length} new agents to booking ${booking.id}`);
			try {
				for (const agentId of newAgentIds) {
					await postRequest("/items/bookings_agents", {
						agents_id: String(agentId),
						bookings_id: String(booking.id),
					} as unknown as Record<string, unknown>);
				}
				console.log(`✅ [SUBMIT BOOKING] Successfully linked all new agents to booking`);
			} catch (error) {
				console.error("❌ [SUBMIT BOOKING] Failed to link new real estate agents to booking:", error);
			}
		}
		
		// Add new contacts to the booking's contacts array
		if (newContactIds.length > 0 && booking?.id != null) {
			console.log(`🔗 [SUBMIT BOOKING] Adding ${newContactIds.length} new contacts to booking ${booking.id}`);
			try {
				// Get existing contact IDs from booking
				const existingContactIds: string[] = [];
				if (Array.isArray(booking?.contacts)) {
					for (const c of booking.contacts) {
						const id = typeof c === "object" ? String((c as any)?.id ?? "") : String(c ?? "");
						if (id) existingContactIds.push(id);
					}
				}
				
				// Combine existing and new contact IDs
				const allContactIds = [...existingContactIds, ...newContactIds.map(String)];
				
				console.log(`🔗 [SUBMIT BOOKING] Existing contacts: [${existingContactIds.join(', ')}]`);
				console.log(`🔗 [SUBMIT BOOKING] New contacts: [${newContactIds.map(String).join(', ')}]`);
				console.log(`🔗 [SUBMIT BOOKING] All contacts: [${allContactIds.join(', ')}]`);
				
				// Update booking with combined contacts
				await patchRequest(`/items/bookings/${encodeURIComponent(String(booking.id))}`, {
					contacts: allContactIds
				});
				console.log(`✅ [SUBMIT BOOKING] Successfully added new contacts to booking ${booking.id}`);
			} catch (error) {
				console.error("❌ [SUBMIT BOOKING] Failed to add new contacts to booking:", error);
			}
		}
		
		if (updates.length > 0) {
			console.log(`🔧 [SUBMIT BOOKING] Processing ${updates.length} updates for existing records`);
			await Promise.allSettled(updates);
			console.log(`✅ [SUBMIT BOOKING] Completed all updates`);
		}
		
		// Update booking status
		if (booking?.id != null) {
			const tentativeDate = String(formData.get("booking_tentative_inspection_date") ?? "").trim();
			const additionalInfo = String(formData.get("booking_additional_information") ?? "").trim();
			
			const bookingPayload: Record<string, unknown> = { status: "booked" };
			if (tentativeDate) bookingPayload.tentative_date = tentativeDate;
			if (additionalInfo) bookingPayload.additional_info = additionalInfo;
			
			console.log(`📝 [SUBMIT BOOKING] Updating booking ${booking.id} with payload:`, bookingPayload);
			await patchRequest(`/items/bookings/${encodeURIComponent(String(booking.id))}`, bookingPayload);
			console.log(`✅ [SUBMIT BOOKING] Successfully updated booking status to 'booked'`);
		}
		
		// Redirect to thank you page
		if (booking?.id != null) {
			console.log(`🔄 [SUBMIT BOOKING] Redirecting to thank you page with booking ID: ${booking.id}`);
			const params = new URLSearchParams();
			params.set("bookingId", String(booking?.id));
			if (userId) params.set("userId", String(userId));
			if (contactId) params.set("contactId", String(contactId));
			if (dealId) params.set("dealId", String(dealId));
			if (propertyId) params.set("propertyId", String(propertyId));
			if (quoteId) params.set("quoteId", String(quoteId));
			if (invoiceId) params.set("invoiceId", String(invoiceId));
			
			console.log(`🔄 [SUBMIT BOOKING] Redirect URL: /steps/09-thank-you?${params.toString()}`);
			redirect(`/steps/09-thank-you?${params.toString()}`);
		}
		
		return {
			success: true,
			message: "Booking submitted successfully",
			debug
		};
		
	} catch (error) {
		// Check if this is a Next.js redirect (which is expected behavior)
		if (error instanceof Error && error.message === "NEXT_REDIRECT") {
			// Re-throw redirect errors - they are handled by Next.js
			throw error;
		}
		
		console.error("💥 [SUBMIT BOOKING] Critical error:", error);
		debug.push({ tag: "critical_error", error: String(error) });
		return {
			success: false,
			message: "An unexpected error occurred",
			debug
		};
	}
}
