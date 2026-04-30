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
          entity: {
            entity_type: "application",
            entity_id: application.application_id
          },
          payload: {
            application_id: application.application_id,
            job_id: application.job_id,
            member_id: application.member_id,
            resume_ref: application.resume_url,
            recruiter_id: application.recruiter_id,
            metadata: application.metadata
          },
          idempotency_key: application.application_id,
        }),
      },
    ],
  });
}

async function publishStatusUpdated(application_id, status, actor_id) {
  await connectProducer();
  await producer.send({
    topic: "application.status_updated",
    messages: [
      {
        key: application_id,
        value: JSON.stringify({
          event_type: "application.status_updated",
          trace_id: uuidv4(),
          timestamp: new Date().toISOString(),
          actor_id,
          idempotency_key: `${application_id}:${status}`,
          entity: { entity_type: "application", entity_id: application_id },
          payload: { application_id, status },
        }),
      },
    ],
  });
}

module.exports = { publishApplicationSubmitted, publishStatusUpdated };
