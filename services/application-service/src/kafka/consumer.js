const { consumer } = require("../config/kafka");
const applicationModel = require("../models/applicationModel");

const processedKeys = new Set();

async function startConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topic: "application.submitted", fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const event = JSON.parse(message.value.toString());
      const key = event.idempotency_key;

      if (processedKeys.has(key)) {
        console.log(`[consumer] Skipping duplicate event: ${key}`);
        return;
      }

      try {
        await applicationModel.createApplication(event.payload);
        processedKeys.add(key);
        console.log(`[consumer] Saved application: ${key}`);
      } catch (err) {
        if (err.code === "ER_DUP_ENTRY") {
          console.log(`[consumer] Duplicate in DB, skipping: ${key}`);
          processedKeys.add(key);
        } else {
          console.error("[consumer] Failed:", err.message);
          throw err;
        }
      }
    },
  });
}

module.exports = { startConsumer };