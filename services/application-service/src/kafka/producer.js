const { producer } = require("../config/kafka");
const { v4: uuidv4 } = require("uuid");

let connected = false;

async function connectProducer() {
  if (!connected) {
    await producer.connect();
    connected = true;
  }
}

async function publishApplicationSubmitted(application) {
  await connectProducer();
  await producer.send({
    topic: "application.submitted",
    messages: [
      {
        key: application.application_id,
        value: JSON.stringify({
          event_type: "application.submitted",
          trace_id: uuidv4(),
          timestamp: new Date().toISOString(),
          actor_id: application.member_id,
          idempotency_key: application.application_id,
          entity: "application",
          payload: application,
        }),
      },
    ],
  });
}

async function publishStatusUpdated(application_id, status, actor_id) {
  await connectProducer();
  await producer.send({
    topic: "application.statusUpdated",
    messages: [
      {
        key: application_id,
        value: JSON.stringify({
          event_type: "application.statusUpdated",
          trace_id: uuidv4(),
          timestamp: new Date().toISOString(),
          actor_id,
          idempotency_key: `${application_id}-${status}`,
          entity: "application",
          payload: { application_id, status },
        }),
      },
    ],
  });
}

module.exports = { publishApplicationSubmitted, publishStatusUpdated };