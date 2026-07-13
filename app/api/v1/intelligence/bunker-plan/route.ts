import { NextResponse } from "next/server";
import { requireSession } from "@/src/lib/server/auth";
import { createResource, listResource } from "@/src/lib/server/db";
import { calculateBunkerPlan, fetchBunkerPrice } from "@/src/lib/server/maritime";

export async function GET() {
  try {
    const session = await requireSession();
    return NextResponse.json({ plans: await listResource("bunker_plans", session.orgId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Unable to load bunkering plans." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json();
    if (!body.departure_port || !body.destination_port || !body.bunker_port || !body.fuel_type) {
      return NextResponse.json({ error: "Departure, destination, bunker port, and fuel type are required." }, { status: 400 });
    }

    let pricePerMt = Number(body.price_per_mt || 0);
    let priceProvider: Record<string, any> | null = null;
    if (!pricePerMt) {
      priceProvider = await fetchBunkerPrice(String(body.bunker_port), String(body.fuel_type));
      if (priceProvider.pricePerMt) pricePerMt = Number(priceProvider.pricePerMt);
    }

    const calculation = calculateBunkerPlan({ ...body, price_per_mt: pricePerMt });
    const plan = await createResource("bunker_plans", session.orgId, {
      ...body,
      ...calculation,
      price_per_mt: calculation.price_per_mt,
      estimated_cost: calculation.estimated_cost,
      status: body.status || "Draft",
      notes: [body.notes, priceProvider?.configured ? `Price source: ${priceProvider.provider}` : null].filter(Boolean).join("\n")
    });

    return NextResponse.json({ plan, calculation, priceProvider }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    console.error(error);
    if (message === "DATABASE_REQUIRED") return NextResponse.json({ error: "DATABASE_URL is required to save real bunkering plans." }, { status: 503 });
    return NextResponse.json({ error: "Unable to calculate or save the bunkering plan." }, { status: 500 });
  }
}
