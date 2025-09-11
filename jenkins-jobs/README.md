# Jenkins Job Configurations

This directory contains Jenkins job configurations for FoodFund microservices CI/CD pipelines.

## Files

- `FoodFund-Auth-Service.xml` - Jenkins job configuration for Auth service
- `FoodFund-Gateway-Service.xml` - Jenkins job configuration for GraphQL Gateway service

## Importing Jobs into Jenkins

### Method 1: Using Jenkins UI

1. Open Jenkins web interface
2. Click "New Item"
3. Enter job name (e.g., "FoodFund-Auth-Service")
4. Select "Pipeline" as job type
5. In the pipeline configuration section:
   - Select "Pipeline script from SCM"
   - SCM: Git
   - Repository URL: `https://github.com/phuoctmse/FoodFund-Microservices.git`
   - Branch: `demo-learn-test`
   - Script Path: `Jenkinsfile`
6. Save the job

### Method 2: Using Jenkins CLI

```bash
# Install Jenkins CLI if not already installed
java -jar jenkins-cli.jar -s http://your-jenkins-url create-job FoodFund-Auth-Service < FoodFund-Auth-Service.xml

java -jar jenkins-cli.jar -s http://your-jenkins-url create-job FoodFund-Gateway-Service < FoodFund-Gateway-Service.xml
```

### Method 3: Using REST API

```bash
# Create Auth Service job
curl -X POST "http://your-jenkins-url/createItem?name=FoodFund-Auth-Service" \
  --header "Content-Type: application/xml" \
  --data-binary @FoodFund-Auth-Service.xml \
  --user "username:api-token"

# Create Gateway Service job
curl -X POST "http://your-jenkins-url/createItem?name=FoodFund-Gateway-Service" \
  --header "Content-Type: application/xml" \
  --data-binary @FoodFund-Gateway-Service.xml \
  --user "username:api-token"
```

## Required Jenkins Plugins

Make sure these plugins are installed:

- Pipeline
- Pipeline: GitHub Groovy Libraries
- Docker Pipeline
- Kubernetes CLI
- Slack Notification
- Git
- NodeJS
- Credentials Binding

## Required Jenkins Credentials

Set up these credentials in Jenkins:

### 1. Docker Hub Credentials
- **ID**: `dockerhub`
- **Type**: Username with password
- **Username**: Your Docker Hub username
- **Password**: Your Docker Hub password/token

### 2. GitHub Credentials
- **ID**: `github`
- **Type**: Username with password or SSH key
- **Username**: Your GitHub username
- **Password**: Your GitHub personal access token

### 3. Slack Webhook
- **ID**: `slack-webhook`
- **Type**: Secret text
- **Secret**: Your Slack webhook URL

### 4. Kubernetes Credentials
- **ID**: `kubernetes-credentials`
- **Type**: Kubernetes configuration (kubeconfig)

## Required Jenkins Tools

Configure these tools in Jenkins Global Tool Configuration:

### 1. NodeJS
- **Name**: `NodeJS`
- **Version**: NodeJS 20.18.0 (matches your Dockerfile)

### 2. Docker
- **Name**: `Docker`
- **Installation**: Install automatically or use system Docker

## Job Parameters

Both jobs support these parameters:

- **SERVICE**: Choose which service to deploy (`auth` or `gateway`)
- **ENVIRONMENT**: Target environment (`staging` or `production`)
- **SKIP_TESTS**: Skip running tests (boolean, default: false)
- **FORCE_DEPLOY**: Force deployment even if tests fail (boolean, default: false)

## Pipeline Stages

The pipeline includes these stages:

1. **Cleanup Workspace** - Clean Jenkins workspace
2. **Prepare Environment** - Clone repositories and install dependencies
3. **Lint Check** - Run ESLint
4. **Code Format Check** - Run Prettier format check
5. **Unit Test** - Run Jest tests (can be skipped)
6. **Build and Push** - Build and push Docker images
7. **Clean Artifacts** - Remove local Docker images
8. **Deploy to Kubernetes** - Deploy to K8s cluster
9. **Post-Deployment Validation** - Verify deployment success

## Notifications

The pipeline sends Slack notifications on:
- Build success
- Build failure
- Deployment completion

Configure the Slack webhook URL in the `slack-webhook` credential.

## Troubleshooting

### Common Issues

1. **Docker permission denied**
   - Ensure Jenkins agent has Docker permissions
   - Add Jenkins user to Docker group

2. **Kubernetes connection failed**
   - Verify kubeconfig is correct
   - Check cluster connectivity from Jenkins agent

3. **Git clone failed**
   - Verify GitHub credentials
   - Check repository permissions

4. **Node modules installation failed**
   - Check NodeJS version compatibility
   - Verify npm registry access

### Logs and Debugging

- Check Jenkins job console output for detailed logs
- Use `kubectl logs` to check pod logs after deployment
- Verify Docker image builds with `docker build` locally first

## Customization

To add more services:

1. Update the `services` map in `Jenkinsfile`
2. Add corresponding Kubernetes manifests in `k8s/` directory
3. Create new job XML file based on existing templates
4. Update Docker image names and configurations

## Security Notes

- Store all secrets as Jenkins credentials
- Use least-privilege principles for service accounts
- Regularly rotate API tokens and passwords
- Enable Jenkins security features (CSRF protection, etc.)
