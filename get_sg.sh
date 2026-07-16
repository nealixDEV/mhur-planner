#!/bin/bash
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
INSTANCE_ID=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/instance-id)
echo "Instance: $INSTANCE_ID"
aws ec2 authorize-security-group-ingress --group-id $(aws ec2 describe-instances --instance-id $INSTANCE_ID --query "Reservations[0].Instances[0].SecurityGroups[0].GroupId" --output text) --protocol tcp --port 443 --cidr 0.0.0.0/0 && echo "Port 443 opened!" || echo "Failed to open port 443"
