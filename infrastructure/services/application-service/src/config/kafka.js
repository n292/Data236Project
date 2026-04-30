const { Kafka } = require("kafkajs");

const kafka = new Kafka({
  clientId: "application-service",
  brokers: [process.env.KAFKA_BROKER || "localhost:9092"],
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: "application-service-group" });

module.exports = { kafka, producer, consumer };