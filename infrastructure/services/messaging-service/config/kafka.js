const { Kafka } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || 'messaging-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  retry: {
    initialRetryTime: 300,
    retries: 5,
    multiplier: 1.5,
    maxRetryTime: 10000,
  },
  logLevel: 1,
});

const producer = kafka.producer();
let isConnected = false;

const connectProducer = async () => {
  try {
    await producer.connect();
    isConnected = true;
    console.log('Kafka producer connected');
  } catch (error) {
    console.error('Kafka producer connection failed:', error.message);
    console.warn('Service will continue without Kafka. Events will be logged locally.');
  }
};

// Follows the team's shared Kafka event envelope standard
// entity must be an object: { entity_type, entity_id }
const MAX_PUBLISH_RETRIES = 3;
const RETRY_DELAY_MS = 500;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const publishEvent = async (eventType, actorId, entityType, entityId, payload, traceId = null) => {
  const event = {
    event_type: eventType,
    trace_id: traceId || uuidv4(),
    timestamp: new Date().toISOString(),
    actor_id: actorId,
    entity: { entity_type: entityType, entity_id: entityId },
    payload,
    idempotency_key: uuidv4(),
  };

  if (!isConnected) {
    console.log(`[Kafka offline] Event logged locally: ${eventType}`, JSON.stringify(event));
    return event;
  }

  let lastError;
  for (let attempt = 1; attempt <= MAX_PUBLISH_RETRIES; attempt++) {
    try {
      await producer.send({
        topic: eventType,
        messages: [{ key: entityId, value: JSON.stringify(event) }],
      });
      console.log(`Kafka event published: ${eventType} (attempt ${attempt})`);
      return event;
    } catch (error) {
      lastError = error;
      console.error(`Kafka publish attempt ${attempt}/${MAX_PUBLISH_RETRIES} failed for ${eventType}:`, error.message);
      if (attempt < MAX_PUBLISH_RETRIES) await sleep(RETRY_DELAY_MS * attempt);
    }
  }
  console.error(`All ${MAX_PUBLISH_RETRIES} publish attempts exhausted for ${eventType}:`, lastError.message);
  return event;
};

const disconnectProducer = async () => {
  if (isConnected) {
    await producer.disconnect();
    isConnected = false;
  }
};

module.exports = { connectProducer, publishEvent, disconnectProducer };
