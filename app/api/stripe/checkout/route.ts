import { NextResponse } from "next/server";
import Stripe from "stripe";
import { requireSession } from "@/src/lib/server/auth";

const plans: Record<string, { name: string; amount: number; priceEnv: string }> = {
  captain: { name: "Neptune Captain", amount: 49900, priceEnv: "STRIPE_PRICE_CAPTAIN" },
  fleetops: { name: "Neptune FleetOps", amount: 149900, priceEnv: "STRIPE_PRICE_FLEETOPS" },
  enterprise: { name: "Neptune Enterprise", amount: 499900, priceEnv: "STRIPE_PRICE_ENTERPRISE" }
};

export async function POST(request: Request) {
  try {
    const sessionUser = await requireSession();
    if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: "Stripe is not configured. Add STRIPE_SECRET_KEY or use demo access." }, { status: 503 });
    const body = await request.json().catch(() => ({}));
    const planKey = plans[body.plan] ? body.plan : "fleetops";
    const plan = plans[planKey];
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const priceId = process.env[plan.priceEnv];
    const lineItem = priceId
      ? { price: priceId, quantity: 1 }
      : { price_data: { currency: "usd", product_data: { name: plan.name }, unit_amount: plan.amount, recurring: { interval: "month" as const } }, quantity: 1 };
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [lineItem],
      customer_email: sessionUser.email,
      success_url: `${appUrl}/api/stripe/confirm?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/checkout?cancelled=true`,
      metadata: { orgId: sessionUser.orgId, userId: sessionUser.userId, plan: planKey },
      subscription_data: { metadata: { orgId: sessionUser.orgId, plan: planKey } },
      allow_promotion_codes: true
    });
    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to start Stripe checkout" }, { status: 500 });
  }
}
