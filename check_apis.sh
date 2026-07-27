#!/bin/bash
for url in "https://api.openai.com" "https://api.groq.com" "https://api.together.xyz"; do
  code=$(curl -m 10 -s -o /dev/null -w "%{http_code}" "$url")
  echo "$url - $code"
done
