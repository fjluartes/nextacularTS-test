import { buffer } from 'micro';
import prisma from '../../../../prisma';
import { updateSubscription } from '../../../../prisma/services/customer';

import type { NextApiRequest, NextApiResponse } from 'next';
import stripe from '../../../lib/server/stripe';

export const config = { api: { bodyParser: false } };

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const reqBuffer = await buffer(req);
  const signature = req.headers['stripe-signature'];
  let event = null;

  try {
    event = stripe.webhooks.constructEvent(
      reqBuffer,
      signature,
      process.env.PAYMENTS_SIGNING_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event) {
    const { metadata } = event.data.object;

    switch (event.type) {
      case 'charge.succeeded':
        if (metadata?.customerId && metadata?.type) {
          await updateSubscription(metadata.customerId, metadata.type);
        }
        break;
      default:
        res
          .status(400)
          .send(`Webhook Error: Unhandled event type ${event.type}`);
    }
  } else {
    return res.status(400).send(`Webhook Error: Event not created`);
  }

  await prisma.$disconnect();
  res.status(200).send({ received: true });
};

export default handler;
