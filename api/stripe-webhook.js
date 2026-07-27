import Stripe from 'stripe';
import { createClient } from '@libsql/client';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function insertPurchase(session) {
  let productName = null;
  try {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
    productName = lineItems.data[0]?.description ?? null;
  } catch (err) {
    console.error('Failed to fetch line items for', session.id, err.message);
  }

  await turso.execute({
    sql: `INSERT INTO purchases (id, created_at, amount, currency, status, customer_email, product_name, payment_link_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO NOTHING`,
    args: [
      session.id,
      session.created,
      session.amount_total,
      session.currency,
      session.payment_status,
      session.customer_details?.email ?? session.customer_email ?? null,
      productName,
      session.payment_link ?? null,
    ],
  });
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const rawBody = await request.text();
    const signature = request.headers.get('stripe-signature');

    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, endpointSecret);
    } catch (err) {
      console.error('Webhook signature verification failed.', err.message);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
      try {
        await insertPurchase(event.data.object);
      } catch (err) {
        console.error('Failed to insert purchase into Turso', err.message);
        return new Response('Database error', { status: 500 });
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
