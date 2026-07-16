#!/bin/bash
# Install PostgreSQL
sudo yum install -y postgresql16-server postgresql16

# Initialize and start
sudo /usr/bin/postgresql-16-setup initdb
sudo systemctl enable postgresql16
sudo systemctl start postgresql16

# Configure password auth
sudo -u postgres psql -c "CREATE USER mhur_user WITH PASSWORD 'mhur_pass123';"
sudo -u postgres psql -c "CREATE DATABASE mhur_planner OWNER mhur_user;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE mhur_planner TO mhur_user;"

# Allow password auth
sudo bash -c 'echo "local all all md5" > /var/lib/pgsql/16/data/pg_hba.conf'
sudo bash -c 'echo "host all all 127.0.0.1/32 md5" >> /var/lib/pgsql/16/data/pg_hba.conf'
sudo bash -c 'echo "host all all ::1/128 md5" >> /var/lib/pgsql/16/data/pg_hba.conf'
sudo systemctl restart postgresql16

echo "PostgreSQL setup complete!"
