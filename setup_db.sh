#!/bin/bash
sudo systemctl enable postgresql
sudo systemctl start postgresql
sudo -u postgres psql -c "CREATE USER mhur_user WITH PASSWORD 'mhur_pass123';"
sudo -u postgres psql -c "CREATE DATABASE mhur_planner OWNER mhur_user;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE mhur_planner TO mhur_user;"
echo "DB setup done"
