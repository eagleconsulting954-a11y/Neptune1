import { NextResponse } from "next/server";
import Stripe from "stripe";
import { upsertSubscription } from "@/src/lib/server/db";

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) return NextResponse.json({ error: "Stripe webhook is not configured" }, { status: 503 });
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });

  try {
    const payload = await request.text();
    const event = stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET);

    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const orgId = subscription.metadata.orgId;
      if (orgId) {
        await upsertSubscription({
          orgId,
          customerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
          subscriptionId: subscription.id,
          plan: subscription.metadata.plan || "fleetops",
          status: subscription.status,
          currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
  }
}
