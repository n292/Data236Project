from db import events_collection

events_collection.create_index("event_type")
events_collection.create_index("timestamp")
events_collection.create_index("entity.entity_id")
events_collection.create_index("payload.job_id")

print("Indexes created successfully")