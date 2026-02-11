import { Hono } from 'hono';
import type { Env } from '../lib/types';
import {
  getPaidAttentionMessage,
  submitCheckIn,
  submitPaidAttentionResponse,
  checkHealth,
  getCheckInMessageToSign,
  getResponseMessageToSign,
} from '../services/aibtc';

export const heartbeat = new Hono<{ Bindings: Env }>();

/**
 * Get current paid attention message from aibtc.com
 */
heartbeat.get('/current', async (c) => {
  const message = await getPaidAttentionMessage(c.env.AIBTC_API_URL);

  if (!message) {
    return c.json({ error: 'Failed to fetch current message' }, 502);
  }

  return c.json({
    message,
    checkInFormat: getCheckInMessageToSign(),
    responseFormat: message.messageId
      ? `Paid Attention | ${message.messageId} | {your response}`
      : null,
  });
});

/**
 * Submit a check-in heartbeat
 */
heartbeat.post('/check-in', async (c) => {
  const body = await c.req.json();
  const { btcAddress, stxAddress, signature, publicKey } = body;

  if (!stxAddress || !signature || !publicKey) {
    return c.json(
      { error: 'Required: stxAddress, signature, publicKey' },
      400
    );
  }

  const result = await submitCheckIn(
    btcAddress || '',
    stxAddress,
    signature,
    publicKey,
    c.env.AIBTC_API_URL
  );

  if (!result.success) {
    return c.json({ error: result.error }, 400);
  }

  // Log the check-in
  console.log(`Heartbeat check-in: ${stxAddress}`);

  return c.json({
    success: true,
    message: result.message,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Submit a response to paid attention message
 */
heartbeat.post('/respond', async (c) => {
  const body = await c.req.json();
  const {
    messageId,
    response,
    btcAddress,
    stxAddress,
    signature,
    publicKey,
  } = body;

  if (!messageId || !response || !stxAddress || !signature || !publicKey) {
    return c.json(
      {
        error:
          'Required: messageId, response, stxAddress, signature, publicKey',
      },
      400
    );
  }

  if (response.length > 500) {
    return c.json({ error: 'Response must be 500 characters or less' }, 400);
  }

  const result = await submitPaidAttentionResponse(
    messageId,
    response,
    btcAddress || '',
    stxAddress,
    signature,
    publicKey,
    c.env.AIBTC_API_URL
  );

  if (!result.success) {
    return c.json({ error: result.error }, 400);
  }

  console.log(`Paid attention response: ${stxAddress} -> ${messageId}`);

  return c.json({
    success: true,
    message: result.message,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Check aibtc.com health status
 */
heartbeat.get('/health', async (c) => {
  const health = await checkHealth(c.env.AIBTC_API_URL);

  return c.json({
    aibtc: health,
    billboards: { healthy: true },
    timestamp: new Date().toISOString(),
  });
});

/**
 * Get message format for signing
 */
heartbeat.get('/sign-format', (c) => {
  const type = c.req.query('type') || 'check-in';
  const messageId = c.req.query('messageId');
  const response = c.req.query('response');

  if (type === 'check-in') {
    return c.json({
      type: 'check-in',
      message: getCheckInMessageToSign(),
      instructions:
        'Sign this message with your Stacks wallet private key',
    });
  }

  if (type === 'response' && messageId && response) {
    return c.json({
      type: 'response',
      message: getResponseMessageToSign(messageId, response),
      instructions:
        'Sign this message with your Stacks wallet private key',
    });
  }

  return c.json({
    error: 'For response type, provide messageId and response query params',
  }, 400);
});
