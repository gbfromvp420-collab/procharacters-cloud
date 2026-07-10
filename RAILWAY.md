# Monorepo note:
# Root railway.toml was removed so GitHub deploys do not force backend Dockerfile on both services.
# Set Dockerfile path per service in Railway dashboard:
#   procharacters-api  -> backend/Dockerfile
#   procharacters-web  -> frontend/Dockerfile
# See docs/DEPLOY.md
