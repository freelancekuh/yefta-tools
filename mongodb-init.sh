#!/bin/bash
# mongodb-init.sh

echo "Creating user 'yefta' in 'yefta-db' database..."
sleep 5  # Give MongoDB some time to fully start

until mongosh --host localhost -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase "admin" --eval "print('MongoDB is ready')" > /dev/null 2>&1; do
    echo "Waiting for MongoDB to be ready..."
    sleep 5
done

# Create the user in the 'yefta-db' database
echo "Creating user 'yefta' in 'yefta-db'..."
mongosh --host localhost -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase "admin" <<EOF
use yefta-db;
db.createUser({
  user: "yefta",
  pwd: "MongoYefta123!",
  roles: [
    { role: "readWrite", db: "yefta-db" }
  ]
});
EOF
