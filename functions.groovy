#!/usr/bin/env groovy

/**
 * FoodFund Microservices - Jenkins Pipeline Functions
 * Utility functions for CI/CD pipeline operations
 */

// Find pods by name pattern in a specific namespace
def findPodsFromName(namespace, serviceName) {
    def pods = []
    try {
        def output = sh(script: "kubectl get pods -n ${namespace} -l app=${serviceName} --no-headers -o custom-columns=':metadata.name'", returnStdout: true).trim()
        if (output) {
            pods = output.split('\n').collect { it.trim() }.findAll { it }
        }
    } catch (Exception e) {
        echo "Warning: Could not find pods for service ${serviceName} in namespace ${namespace}: ${e.getMessage()}"
    }
    return pods
}

// Calculate duration between two timestamps
def durationTime(startTime, endTime) {
    def duration = endTime - startTime
    def minutes = (duration / 1000 / 60).intValue()
    def seconds = ((duration / 1000) % 60).intValue()
    return String.format("%dm %ds", minutes, seconds)
}

// Read the commit author from git log
def readCommitAuthor() {
    try {
        def author = sh(script: 'git log -1 --pretty=format:"%an"', returnStdout: true).trim()
        return author ?: "Unknown"
    } catch (Exception e) {
        echo "Warning: Could not read commit author: ${e.getMessage()}"
        return "Unknown"
    }
}

// Send Slack notification
def notifySlack(webhookUrl, channel, attachments) {
    try {
        def payload = [
            channel: channel,
            attachments: attachments
        ]

        def jsonPayload = groovy.json.JsonBuilder(payload).toString()

        sh """
            curl -X POST -H 'Content-type: application/json' --data '${jsonPayload}' ${webhookUrl}
        """
    } catch (Exception e) {
        echo "Warning: Could not send Slack notification: ${e.getMessage()}"
    }
}

// Get current Git branch
def getCurrentBranch() {
    try {
        def branch = sh(script: 'git rev-parse --abbrev-ref HEAD', returnStdout: true).trim()
        return branch ?: "unknown"
    } catch (Exception e) {
        echo "Warning: Could not get current branch: ${e.getMessage()}"
        return "unknown"
    }
}

// Get latest Git commit hash
def getLatestCommitHash() {
    try {
        def commitHash = sh(script: 'git rev-parse HEAD', returnStdout: true).trim()
        return commitHash ?: "unknown"
    } catch (Exception e) {
        echo "Warning: Could not get commit hash: ${e.getMessage()}"
        return "unknown"
    }
}

// Check if Docker image exists
def dockerImageExists(imageName, tag) {
    try {
        def result = sh(script: "docker manifest inspect ${imageName}:${tag} > /dev/null 2>&1", returnStatus: true)
        return result == 0
    } catch (Exception e) {
        return false
    }
}

// Clean up old Docker images
def cleanupOldImages(imageName, keepLatest = 5) {
    try {
        sh """
            # Get all tags for the image
            docker images ${imageName} --format "table {{.Repository}}:{{.Tag}}\\t{{.CreatedAt}}" | tail -n +2 | sort -k2 -r | tail -n +${keepLatest} | awk '{print \$1}' | xargs -r docker rmi || true
        """
    } catch (Exception e) {
        echo "Warning: Could not cleanup old images: ${e.getMessage()}"
    }
}

// Validate service configuration
def validateServiceConfig(serviceConfig) {
    def requiredFields = ['name', 'namespace', 'dockerImage', 'deploymentName']
    def missingFields = []

    requiredFields.each { field ->
        if (!serviceConfig.containsKey(field) || !serviceConfig[field]) {
            missingFields.add(field)
        }
    }

    if (missingFields) {
        error "Missing required configuration fields: ${missingFields.join(', ')}"
    }

    return true
}

// Get service-specific test pattern
def getServiceTestPattern(serviceName) {
    def patterns = [
        'auth': 'apps/auth',
        'gateway': 'apps/graphql-gateway',
        'users': 'apps/users',
        'campaigns': 'apps/campaigns'
    ]

    return patterns[serviceName] ?: 'apps'
}

// Health check for deployed service
def waitForServiceHealth(namespace, serviceName, maxRetries = 30, delaySeconds = 10) {
    for (int i = 0; i < maxRetries; i++) {
        try {
            def result = sh(script: "kubectl get pods -n ${namespace} -l app=${serviceName} -o jsonpath='{.items[*].status.phase}'", returnStdout: true).trim()
            def phases = result.split()

            if (phases.every { it == 'Running' }) {
                echo "✅ Service ${serviceName} is healthy"
                return true
            }

            echo "⏳ Waiting for service ${serviceName} to be healthy... (${i + 1}/${maxRetries})"
            sleep(delaySeconds)
        } catch (Exception e) {
            echo "⚠️ Error checking service health: ${e.getMessage()}"
            sleep(delaySeconds)
        }
    }

    error "❌ Service ${serviceName} failed to become healthy within ${maxRetries * delaySeconds} seconds"
}

// Rollback deployment on failure
def rollbackDeployment(namespace, deploymentName) {
    try {
        sh "kubectl rollout undo deployment/${deploymentName} -n ${namespace}"
        echo "✅ Rolled back deployment ${deploymentName}"
    } catch (Exception e) {
        echo "❌ Failed to rollback deployment ${deploymentName}: ${e.getMessage()}"
        throw e
    }
}

// Helm-specific functions

// Rollback Helm release
def rollbackHelmRelease(releaseName, namespace, revision = 0) {
    try {
        sh "helm rollback ${releaseName} ${revision} --namespace ${namespace}"
        echo "✅ Rolled back Helm release ${releaseName} to revision ${revision}"
        return true
    } catch (Exception e) {
        echo "❌ Failed to rollback Helm release ${releaseName}: ${e.getMessage()}"
        return false
    }
}

// Get Helm release history
def getHelmHistory(releaseName, namespace) {
    try {
        def history = sh(script: "helm history ${releaseName} --namespace ${namespace} --output json", returnStdout: true).trim()
        return history
    } catch (Exception e) {
        echo "❌ Failed to get Helm history for ${releaseName}: ${e.getMessage()}"
        return null
    }
}

// Check if Helm release exists
def helmReleaseExists(releaseName, namespace) {
    try {
        def result = sh(script: "helm status ${releaseName} --namespace ${namespace}", returnStatus: true)
        return result == 0
    } catch (Exception e) {
        return false
    }
}

// Get Helm release status
def getHelmReleaseStatus(releaseName, namespace) {
    try {
        def status = sh(script: "helm status ${releaseName} --namespace ${namespace} --output json", returnStdout: true).trim()
        return status
    } catch (Exception e) {
        echo "❌ Failed to get Helm status for ${releaseName}: ${e.getMessage()}"
        return null
    }
}

// Validate Helm chart
def validateHelmChart(chartPath) {
    try {
        sh "helm lint ${chartPath}"
        echo "✅ Helm chart validation passed"
        return true
    } catch (Exception e) {
        echo "❌ Helm chart validation failed: ${e.getMessage()}"
        return false
    }
}

// Update Helm dependencies
def updateHelmDependencies(chartPath) {
    try {
        sh """
            cd ${chartPath}
            helm dependency update
        """
        echo "✅ Helm dependencies updated"
        return true
    } catch (Exception e) {
        echo "❌ Failed to update Helm dependencies: ${e.getMessage()}"
        return false
    }
}

// Perform Helm dry-run
def helmDryRun(releaseName, chartPath, valuesFile, namespace, additionalArgs = "") {
    try {
        sh """
            helm upgrade ${releaseName} ${chartPath} \\
                -f ${valuesFile} \\
                --namespace ${namespace} \\
                --create-namespace \\
                --install \\
                --dry-run \\
                ${additionalArgs}
        """
        echo "✅ Helm dry-run completed successfully"
        return true
    } catch (Exception e) {
        echo "❌ Helm dry-run failed: ${e.getMessage()}"
        return false
    }
}

// Wait for Helm release to be ready
def waitForHelmRelease(releaseName, namespace, timeout = 300) {
    def timeoutSeconds = timeout
    def checkInterval = 10
    def elapsed = 0
    
    while (elapsed < timeoutSeconds) {
        try {
            def status = sh(script: "helm status ${releaseName} --namespace ${namespace} -o json", returnStdout: true).trim()
            def statusJson = readJSON text: status
            
            if (statusJson.info.status == "deployed") {
                echo "✅ Helm release ${releaseName} is ready"
                return true
            }
            
            echo "⏳ Waiting for Helm release ${releaseName} to be ready... (${elapsed}/${timeoutSeconds}s)"
            sleep(checkInterval)
            elapsed += checkInterval
            
        } catch (Exception e) {
            echo "⚠️ Error checking Helm release status: ${e.getMessage()}"
            sleep(checkInterval)
            elapsed += checkInterval
        }
    }
    
    echo "❌ Helm release ${releaseName} failed to become ready within ${timeoutSeconds} seconds"
    return false
}

// Get Helm values for a release
def getHelmValues(releaseName, namespace) {
    try {
        def values = sh(script: "helm get values ${releaseName} --namespace ${namespace} --output json", returnStdout: true).trim()
        return values
    } catch (Exception e) {
        echo "❌ Failed to get Helm values for ${releaseName}: ${e.getMessage()}"
        return null
    }
}

// Helm upgrade with rollback on failure
def helmUpgradeWithRollback(releaseName, chartPath, valuesFile, namespace, imageTag, service, timeout = 600) {
    try {
        // Perform upgrade
        sh """
            helm upgrade ${releaseName} ${chartPath} \\
                -f ${valuesFile} \\
                --set ${service}.image.tag=${imageTag} \\
                --namespace ${namespace} \\
                --wait \\
                --timeout=${timeout}s \\
                --install
        """
        
        // Verify deployment
        if (waitForHelmRelease(releaseName, namespace)) {
            echo "✅ Helm upgrade completed successfully"
            return true
        } else {
            throw new Exception("Helm release did not become ready after upgrade")
        }
        
    } catch (Exception e) {
        echo "❌ Helm upgrade failed: ${e.getMessage()}"
        echo "🔄 Attempting automatic rollback..."
        
        if (rollbackHelmRelease(releaseName, namespace)) {
            echo "✅ Automatic rollback completed"
        } else {
            echo "❌ Automatic rollback also failed"
        }
        
        throw e
    }
}

// Export functions for use in pipeline
return this
