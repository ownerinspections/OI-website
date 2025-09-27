import { NextResponse } from "next/server";
import { patchRequest } from "@/lib/http/fetcher";
import { updateDeal } from "@/lib/actions/deals/updateDeal";
import { getRequest } from "@/lib/http/fetcher";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
	try {
		const { id } = await ctx.params;
		if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
		const body = await req.json().catch(() => ({}));
		const total = Number(body?.total ?? NaN);
		if (!Number.isFinite(total)) return NextResponse.json({ error: "Invalid total" }, { status: 400 });

		// Update proposal total amount in Directus (os_proposals/quote_amount)
		await patchRequest(`/items/os_proposals/${encodeURIComponent(String(id))}`, { quote_amount: total });

	// Also update the related deal with selected addons and stages if provided
	const addons: number[] | undefined = Array.isArray(body?.addons)
		? body.addons
			.map((x: unknown) => Number(x as any))
			.filter((n: number) => Number.isFinite(n))
		: undefined;
	
	// Handle property-specific addons for dilapidation
	const propertyAddons: Record<string, number[]> | undefined = body?.propertyAddons
		? Object.fromEntries(
			Object.entries(body.propertyAddons as Record<string, any>)
				.map(([fieldName, addonIds]) => [
					fieldName,
					Array.isArray(addonIds) 
						? addonIds.map((x: unknown) => Number(x as any)).filter((n: number) => Number.isFinite(n))
						: []
				])
				.filter(([, addonIds]) => (addonIds as number[]).length > 0)
		)
		: undefined;
	
	// Property prices are handled at quote creation time via ratesheet engine, not here
		
		const stages: number[] | undefined = Array.isArray(body?.stages)
			? body.stages
				.map((x: unknown) => Number(x as any))
				.filter((n: number) => Number.isFinite(n))
			: undefined;

		const stagePrices: Array<{ stage: number; price: number }> | undefined = Array.isArray(body?.stagePrices)
			? body.stagePrices
				.map((x: unknown) => {
					const obj = x as any;
					return { stage: Number(obj.stage), price: Number(obj.price) };
				})
				.filter((s: { stage: number; price: number }) => Number.isFinite(s.stage) && Number.isFinite(s.price))
			: undefined;

	// Update deal with selected addons and/or inspection stages if provided
	// Always update if stages array is provided (even if empty) to handle clearing stages
	if ((addons && addons.length > 0) || propertyAddons || stages !== undefined) {
		// Find proposal to get deal id
		try {
			const propRes = await getRequest<{ data: { deal?: string | number } }>(`/items/os_proposals/${encodeURIComponent(String(id))}?fields=deal`);
			const dealId = (propRes as any)?.data?.deal;
			if (dealId) {
				const dealUpdateData: any = {};
				
				// Handle regular addons (for non-dilapidation services)
				if (addons && addons.length > 0) {
					dealUpdateData.addons = addons;
				}
				
				// Handle property-specific addons (for dilapidation services)
				if (propertyAddons) {
					Object.entries(propertyAddons).forEach(([fieldName, addonIds]) => {
						dealUpdateData[fieldName] = addonIds;
					});
				}
				
				// Property prices are handled at quote creation time, not during real-time updates
					
					// Handle inspection stages by creating stage objects with stage_name
					// Always process stages (even if empty array) to clear stages when all are deselected
					if (stages !== undefined) {
						try {
							// Get deal to find service
							const dealRes = await getRequest<{ data: { service?: number } }>(`/items/os_deals/${encodeURIComponent(String(dealId))}?fields=service`);
							const serviceId = (dealRes as any)?.data?.service;
							
							if (serviceId) {
								// Get service stages configuration
								const serviceRes = await getRequest<{ data: { stages?: any[] } }>(`/items/services/${encodeURIComponent(String(serviceId))}?fields=stages`);
								const serviceStages = (serviceRes as any)?.data?.stages || [];
								
								// Create inspection stage objects for selected stages
								const inspectionStages: Array<{ stage_name: string; stage_number: number; stage_description?: string; stage_price?: number }> = [];
								
								for (const stageNumber of stages) {
									const serviceStage = serviceStages.find((s: any) => String(s.stage_number) === String(stageNumber));
									const stagePriceData = stagePrices?.find((sp: any) => sp.stage === stageNumber);
									
									if (serviceStage) {
										const baseStageName = serviceStage.stage_name || `Stage ${stageNumber}`;
										inspectionStages.push({
											stage_name: `Stage ${stageNumber} - ${baseStageName}`,
											stage_number: Number(stageNumber),
											stage_description: serviceStage.stage_description || undefined,
											stage_price: stagePriceData?.price
										});
									} else {
										// Fallback for stages not found in service config
										inspectionStages.push({
											stage_name: `Stage ${stageNumber}`,
											stage_number: Number(stageNumber),
											stage_price: stagePriceData?.price
										});
									}
								}
								
								// Always set inspection_stages (even if empty array) to clear stages when all are deselected
								dealUpdateData.inspection_stages = inspectionStages;
							}
						} catch (stagesError) {
							console.warn('Failed to handle inspection stages:', stagesError);
							// Fallback: create basic stage objects (or empty array if no stages)
							const fallbackStages = stages.map(stageNumber => {
								const stagePriceData = stagePrices?.find((sp: any) => sp.stage === stageNumber);
								return {
									stage_name: `Stage ${stageNumber}`,
									stage_number: Number(stageNumber),
									stage_price: stagePriceData?.price
								};
							});
							// Always set inspection_stages (even if empty array) to clear stages when all are deselected
							dealUpdateData.inspection_stages = fallbackStages;
						}
					}
					
					await updateDeal(dealId, dealUpdateData);
				}
			} catch {}
		}

		return NextResponse.json({ success: true });
	} catch (e) {
		return NextResponse.json({ error: "Failed to update total" }, { status: 500 });
	}
}


