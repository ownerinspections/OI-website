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

		// Also update the related deal with selected addons if provided
		const addons: number[] | undefined = Array.isArray(body?.addons)
			? body.addons
				.map((x: unknown) => Number(x as any))
				.filter((n: number) => Number.isFinite(n))
			: undefined;
		if (addons && addons.length > 0) {
			// Find proposal to get deal id
			try {
				const propRes = await getRequest<{ data: { deal?: string | number } }>(`/items/os_proposals/${encodeURIComponent(String(id))}?fields=deal`);
				const dealId = (propRes as any)?.data?.deal;
				if (dealId) {
					await updateDeal(dealId, { addons });
				}
			} catch {}
		}

		return NextResponse.json({ success: true });
	} catch (e) {
		return NextResponse.json({ error: "Failed to update total" }, { status: 500 });
	}
}


