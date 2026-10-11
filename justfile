# Validate, build, publish, back up, deploy and check the production release.
deploy:
    node scripts/deploy.mjs

# Run the same release checks without deploying.
check:
    node scripts/deploy.mjs --check
