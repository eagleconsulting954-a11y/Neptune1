import { NextResponse } from "next/server";
import Stripe from "stripe";
import { upsertSubscription } from "@/src/lib/server/db";
import { setAccessCookie } from "@/src/lib/server/auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || url.origin;
  if (!sessionId || !process.env.STRIPE_SECRET_KEY) return NextResponse.redirect(`${appUrl}/checkout?error=verification`);

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const checkout = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
  if (checkout.payment_status !== "paid" && checkout.status !== "complete") return NextResponse.redirect(`${appUrl}/checkout?error=unpaid`);

  const subscription = typeof checkout.subscription === "string" ? await stripe.subscriptions.retrieve(checkout.subscription) : checkout.subscription;
  const orgId = checkout.metadata?.orgId;
  const currentPeriodEnd = subscription?.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : new Date(Date.now() + 30 * 86_400_000).toISOString();

  if (orgId) {
    await upsertSubscription({
      orgId,
      customerId: typeof checkout.customer === "string" ? checkout.customer : checkout.customer?.id || null,
      subscriptionId: subscription?.id || null,
      plan: checkout.metadata?.plan || "fleetops",
      status: subscription?.status || "active",
      currentPeriodEnd
    });
  }

  await setAccessCookie({
    allowed: true,
    status: "active",
    plan: checkout.metadata?.plan || "fleetops",
    expiresAt: currentPeriodEnd,
    daysRemaining: Math.max(1, Math.ceil((new Date(currentPeriodEnd).getTime() - Date.now()) / 86_400_000))
  });

  return NextResponse.redirect(`${appUrl}/dashboard`);
}
