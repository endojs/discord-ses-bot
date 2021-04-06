echo "$SSH_PRIVATE_KEY" > key.txt
ssh -i key.txt \
  -o StrictHostKeyChecking=no \
  "$REMOTE_USER@$REMOTE_HOST" 'bash -s' \
  < .github/workflows/deploy-remote.sh