#!/bin/bash

# Define the MongoDB connection string
MONGO_URI="mongodb://yefta:MongoYefta123\!@localhost:27017/yefta-db"

# Run the mongosh command to drop all collections in the specified database
mongosh "$MONGO_URI" --eval '
  db.getCollectionNames().forEach(function(collection) {
    db[collection].drop();
  });
'
