from pymongo import MongoClient

client = MongoClient("mongodb://localhost:27017/")
db = client["linkedin_analytics"]
events_collection = db["events"]