const { Kafka } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || 'messaging-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  retry: {
    initialRetryTime: 100,
    retries: 1
  },
  logLevel: 1
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
const publishEvent = async (eventType, actorId, entity, payload, traceId = null) => {
  const event = {
    event_type: eventType,
    trace_id: traceId || uuidv4(),
    timestamp: new Date().toISOString(),
    actor_id: actorId,
    entity: entity,
    payload: payload,
    idempotency_key: uuidv4()
  };

  if (isConnected) {
    try {
      await producer.send({
        topic: eventType,
        messages: [
          {
            key: entity,
            value: JSON.stringify(event)
          }
        ]
      });
      console.log(`Kafka event published: ${eventType}`);
    } catch (error) {
      console.error(`Failed to publish Kafka event ${eventType}:`, error.message);
    }
  } else {
    console.log(`[Kafka offline] Event logged locally: ${eventType}`, JSON.stringify(event));
  }

  return event;
};

const disconnectProducer = async () => {
  if (isConnected) {
    await producer.disconnect();
    isConnected = false;
  }
};

module.exports = { connectProducer, publishEvent, disconnectProducer };
