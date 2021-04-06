echo "$SSH_PRIVATE_KEY" > key.txt
chmod 600 key.txt

ssh -i key.txt \
  -o StrictHostKeyChecking=no \
  "$REMOTE_USER@$REMOTE_HOST" "GITHUB_SHA=$GITHUB_SHA bash --login -s" \
  < .github/workflows/deploy-remote.sh