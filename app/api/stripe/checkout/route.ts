import { NextResponse } from "next/server";
import Stripe from "stripe";
import { requireSession } from "@/src/lib/server/auth";
import { normalizePlan, PLAN_CATALOG } from "@/src/lib/plans";

export async function POST(request: Request) {
  try {
    const sessionUser = await requireSession({ allowExpired: true });
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Stripe billing is not configured yet." }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const planKey = normalizePlan(body.plan || "captain");
    const plan = PLAN_CATALOG[planKey];
    if (plan.price === null) {
      return NextResponse.json({ error: "Enterprise plans require a custom implementation agreement." }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const priceId = process.env[plan.stripePriceEnv];
    const lineItem = priceId
      ? { price: priceId, quantity: 1 }
      : {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Neptune ${plan.name}`,
              description: plan.description
            },
            unit_amount: plan.price,
            recurring: { interval: "month" as const }
          },
          quantity: 1
        };

    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [lineItem],
      customer_email: sessionUser.email,
      success_url: `${appUrl}/api/stripe/confirm?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing?cancelled=true`,
      metadata: { orgId: sessionUser.orgId, userId: sessionUser.userId, plan: planKey },
      subscription_data: { metadata: { orgId: sessionUser.orgId, plan: planKey } },
      allow_promotion_codes: true
    });

    return NextResponse.json({ url: checkout.url, plan: planKey });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Login required" }, { status: 401 });
    console.error(error);
    return NextResponse.json({ error: "Unable to start Stripe checkout" }, { status: 500 });
  }
}
