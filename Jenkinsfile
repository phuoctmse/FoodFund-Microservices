#!/usr/bin/env groovy

/**
 * FoodFund Microservices - Helm-based Jenkins Pipeline
 *
 * This pipeline builds, tests, and deploys FoodFund microservices using Helm Charts
 * Supports multiple services with parameterized configuration and advanced deployment strategies
 */

// Pipeline parameters
def m1 = System.currentTimeMillis()

// Service configurations với Helm
def services = [
    'auth': [
        name: 'FoodFund Auth Service',
        namespace: 'foodfund-production',
        dockerImage: 'foodfund-auth',
        helmReleaseName: 'foodfund',
        chartPath: './k8s',
        port: 8002,
        healthCheckPath: '/health'
    ],
    'gateway': [
        name: 'FoodFund GraphQL Gateway',
        namespace: 'foodfund-production', 
        dockerImage: 'foodfund-gateway',
        helmReleaseName: 'foodfund',
        chartPath: './k8s',
        port: 8000,
        healthCheckPath: '/health'
    ]
]

// Default service to build if none specified
def defaultService = 'auth'

pipeline {
    agent {
        label 'Jenkins-Agent'
    }

    // Pipeline parameters with Helm options
    parameters {
        choice(
            name: 'SERVICE',
            choices: services.keySet().toList(),
            description: 'Select the service to build and deploy'
        )
        choice(
            name: 'ENVIRONMENT',
            choices: ['staging', 'production'],
            description: 'Target environment for deployment'
        )
        choice(
            name: 'HELM_ACTION',
            choices: ['upgrade', 'install', 'rollback'],
            description: 'Helm action to perform'
        )
        string(
            name: 'ROLLBACK_REVISION',
            defaultValue: '1',
            description: 'Revision number for rollback (only used if HELM_ACTION is rollback)'
        )
        booleanParam(
            name: 'SKIP_TESTS',
            defaultValue: false,
            description: 'Skip running tests'
        )
        booleanParam(
            name: 'DRY_RUN',
            defaultValue: false,
            description: 'Perform dry-run deployment (template validation only)'
        )
        booleanParam(
            name: 'UPDATE_DEPENDENCIES',
            defaultValue: true,
            description: 'Update Helm dependencies (PostgreSQL, etc.)'
        )
    }

    // Tools configuration
    tools {
        nodejs "NodeJS"
        dockerTool "Docker"
    }

    // Environment variables for Helm-based deployment
    environment {
        // Docker configuration
        DOCKER_CREDENTIALS = credentials("dockerhub")
        DOCKER_HUB_USER = "${DOCKER_CREDENTIALS_USR}"
        IMAGE_NAME = "${DOCKER_HUB_USER}/${services[params.SERVICE ?: defaultService].dockerImage}"
        IMAGE_TAG = "stable-${BUILD_NUMBER}"
        IMAGE_TAG_LATEST = "latest"

        // Service configuration with Helm
        SERVICE_NAME = "${services[params.SERVICE ?: defaultService].name}"
        HELM_RELEASE_NAME = "${services[params.SERVICE ?: defaultService].helmReleaseName}"
        CHART_PATH = "${services[params.SERVICE ?: defaultService].chartPath}"
        SERVICE_PORT = "${services[params.SERVICE ?: defaultService].port}"
        
        // Environment specific namespace
        TARGET_NAMESPACE = params.ENVIRONMENT == 'production' ? 'foodfund-production' : 'foodfund-staging'

        // Git configuration
        GIT_REPO = 'https://github.com/phuoctmse/FoodFund-Microservices.git'
        GIT_BRANCH = 'demo-learn-test'

        // Slack webhook
        SLACK_WEBHOOK = credentials("slack-webhook")
    }

    stages {
        // ========================================
        // STAGE 1: CLEANUP WORKSPACE
        // ========================================
        stage("Cleanup Workspace") {
            steps {
                cleanWs()
                echo "✅ Workspace cleaned"
            }
        }

        // ========================================
        // STAGE 2: PREPARE ENVIRONMENT
        // ========================================
        stage("Prepare Environment") {
            steps {
                script {
                    // Clone main application repository
                    git branch: "${GIT_BRANCH}",
                        credentialsId: 'github',
                        url: "${GIT_REPO}"

                    // Load utility functions
                    groovyMethods = load("functions.groovy")

                    // Install dependencies
                    sh 'npm ci'
                    
                    // Validate Helm installation
                    sh """
                        helm version --client
                        echo "✅ Helm is available"
                    """
                    
                    // Validate Helm chart
                    sh """
                        helm lint ${CHART_PATH}
                        echo "✅ Helm chart validation passed"
                    """
                    
                    echo "✅ Environment prepared with Helm validation"
                }
            }
        }

        // ========================================
        // STAGE 3: VALIDATE HELM TEMPLATES
        // ========================================
        stage("Validate Helm Templates") {
            steps {
                script {
                    echo "🔍 Validating Helm templates..."
                    
                    // Environment specific values file
                    def valuesFile = params.ENVIRONMENT == 'production' ? 
                        "${CHART_PATH}/values-production.yaml" : 
                        "${CHART_PATH}/values-staging.yaml"
                    
                    // Add Bitnami repo for PostgreSQL dependency
                    if (params.UPDATE_DEPENDENCIES) {
                        sh """
                            helm repo add bitnami https://charts.bitnami.com/bitnami || true
                            helm repo update
                            echo "✅ Helm repositories updated"
                        """
                    }
                    
                    // Template validation với dry-run
                    sh """
                        # Template validation
                        helm template ${HELM_RELEASE_NAME} ${CHART_PATH} \\
                            -f ${valuesFile} \\
                            --set ${params.SERVICE}.image.tag=${IMAGE_TAG} \\
                            --namespace ${TARGET_NAMESPACE} > /tmp/rendered-templates.yaml
                        
                        # Kubernetes validation
                        kubectl apply --dry-run=client -f /tmp/rendered-templates.yaml
                        
                        echo "✅ Helm templates validated successfully"
                    """
                }
            }
        }

        // ========================================
        // STAGE 4: LINT CHECK
        // ========================================
        stage("Lint Check") {
            steps {
                echo "🔍 Running ESLint checks..."
                sh 'npm run lint:check'
                echo "✅ Lint check passed"
            }
        }

        // ========================================
        // STAGE 5: CODE FORMAT CHECK
        // ========================================
        stage("Code Format Check") {
            steps {
                echo "📝 Running Prettier format checks..."
                sh 'npm run format:check'
                echo "✅ Code format check passed"
            }
        }

        // ========================================
        // STAGE 6: UNIT TESTS
        // ========================================
        stage("Unit Test") {
            when {
                expression { return !params.SKIP_TESTS }
            }
            steps {
                script {
                    echo "🧪 Running unit tests..."
                    def testPattern = groovyMethods.getServiceTestPattern(params.SERVICE ?: defaultService)
                    sh "npm run test -- --testPathPattern=\"${testPattern}\""
                    echo "✅ Unit tests passed"
                }
            }
        }

        // ========================================
        // STAGE 7: BUILD AND PUSH DOCKER IMAGE
        // ========================================
        stage("Build and Push") {
            when {
                expression { return params.HELM_ACTION != 'rollback' }
            }
            steps {
                script {
                    echo "🏗️ Building and pushing Docker image..."

                    // Login to Docker Hub
                    sh "docker login -u ${DOCKER_HUB_USER} -p ${DOCKER_CREDENTIALS_PSW}"

                    // Build service-specific Docker image
                    def dockerFile = "apps/${params.SERVICE}/Dockerfile"
                    sh """
                        docker build -f ${dockerFile} -t ${IMAGE_NAME} .
                        docker tag ${IMAGE_NAME} ${IMAGE_NAME}:${IMAGE_TAG}
                        docker tag ${IMAGE_NAME} ${IMAGE_NAME}:${IMAGE_TAG_LATEST}
                        docker push ${IMAGE_NAME}:${IMAGE_TAG}
                        docker push ${IMAGE_NAME}:${IMAGE_TAG_LATEST}
                    """

                    echo "✅ Docker image built and pushed: ${IMAGE_NAME}:${IMAGE_TAG}"
                }
            }
        }

        // ========================================
        // STAGE 7: CLEAN ARTIFACTS
        // ========================================
        stage("Clean Artifacts") {
            steps {
                script {
                    echo "🧹 Cleaning up Docker artifacts..."

                    // Remove local images to save space
                    sh "docker rmi ${IMAGE_NAME}:${IMAGE_TAG} || true"
                    sh "docker rmi ${IMAGE_NAME}:${IMAGE_TAG_LATEST} || true"

                    // Clean up old images
                    groovyMethods.cleanupOldImages(IMAGE_NAME)

                    echo "✅ Artifacts cleaned"
                }
            }
        }

        // ========================================
        // STAGE 8: DEPLOY WITH HELM
        // ========================================
        stage("Deploy with Helm") {
            steps {
                script {
                    echo "🚀 Deploying with Helm..."

                    withKubeCredentials(kubectlCredentials: [[
                        caCertificate: '',
                        clusterName: 'foodfund-cluster',
                        contextName: 'foodfund-context',
                        credentialsId: 'kubernetes-credentials',
                        namespace: "${TARGET_NAMESPACE}",
                        serverUrl: 'https://your-k8s-api-server.com'
                    ]]) {
                        try {
                            // Environment specific values file
                            def valuesFile = params.ENVIRONMENT == 'production' ? 
                                "${CHART_PATH}/values-production.yaml" : 
                                "${CHART_PATH}/values-staging.yaml"

                            if (params.HELM_ACTION == 'rollback') {
                                // Rollback to specific revision
                                echo "⏪ Rolling back to revision ${params.ROLLBACK_REVISION}..."
                                sh """
                                    helm rollback ${HELM_RELEASE_NAME} ${params.ROLLBACK_REVISION} \\
                                        --namespace ${TARGET_NAMESPACE}
                                """
                                
                            } else if (params.DRY_RUN) {
                                // Dry run deployment
                                echo "🧪 Performing dry-run deployment..."
                                sh """
                                    helm ${params.HELM_ACTION} ${HELM_RELEASE_NAME} ${CHART_PATH} \\
                                        -f ${valuesFile} \\
                                        --set ${params.SERVICE}.image.tag=${IMAGE_TAG} \\
                                        --namespace ${TARGET_NAMESPACE} \\
                                        --create-namespace \\
                                        --dry-run
                                """
                                
                            } else {
                                // Real deployment
                                def helmCommand = ""
                                
                                if (params.HELM_ACTION == 'install') {
                                    echo "🆕 Installing new Helm release..."
                                    helmCommand = """
                                        helm install ${HELM_RELEASE_NAME} ${CHART_PATH} \\
                                            -f ${valuesFile} \\
                                            --set ${params.SERVICE}.image.tag=${IMAGE_TAG} \\
                                            --namespace ${TARGET_NAMESPACE} \\
                                            --create-namespace \\
                                            --wait \\
                                            --timeout=600s
                                    """
                                } else {
                                    // upgrade (default)
                                    echo "⬆️ Upgrading existing Helm release..."
                                    helmCommand = """
                                        helm upgrade ${HELM_RELEASE_NAME} ${CHART_PATH} \\
                                            -f ${valuesFile} \\
                                            --set ${params.SERVICE}.image.tag=${IMAGE_TAG} \\
                                            --namespace ${TARGET_NAMESPACE} \\
                                            --wait \\
                                            --timeout=600s \\
                                            --install
                                    """
                                }
                                
                                sh helmCommand
                            }

                            // Show deployment status
                            sh """
                                helm status ${HELM_RELEASE_NAME} --namespace ${TARGET_NAMESPACE}
                                kubectl get pods -n ${TARGET_NAMESPACE}
                            """

                            echo "✅ Helm deployment completed successfully"

                        } catch (Exception e) {
                            echo "❌ Helm deployment failed: ${e.getMessage()}"
                            
                            // Auto rollback on failure (chỉ khi không phải rollback)
                            if (params.HELM_ACTION != 'rollback') {
                                echo "🔄 Attempting automatic rollback..."
                                try {
                                    sh """
                                        helm rollback ${HELM_RELEASE_NAME} 0 \\
                                            --namespace ${TARGET_NAMESPACE}
                                    """
                                    echo "✅ Automatic rollback completed"
                                } catch (Exception rollbackError) {
                                    echo "❌ Rollback also failed: ${rollbackError.getMessage()}"
                                }
                            }
                            throw e
                        }
                    }
                }
            }
        }

        // ========================================
        // STAGE 9: POST-DEPLOYMENT VALIDATION
        // ========================================
        stage("Post-Deployment Validation") {
            when {
                expression { return !params.DRY_RUN }
            }
            steps {
                script {
                    echo "🔍 Validating Helm deployment..."

                    withKubeCredentials(kubectlCredentials: [[
                        caCertificate: '',
                        clusterName: 'foodfund-cluster',
                        contextName: 'foodfund-context',
                        credentialsId: 'kubernetes-credentials',
                        namespace: "${TARGET_NAMESPACE}",
                        serverUrl: 'https://your-k8s-api-server.com'
                    ]]) {
                        // Wait for pods to be ready
                        groovyMethods.waitForServiceHealth(TARGET_NAMESPACE, "${HELM_RELEASE_NAME}-${params.SERVICE}")

                        // Health check endpoints
                        sh """
                            # Check Helm release status
                            helm list -n ${TARGET_NAMESPACE}
                            
                            # Check all resources created by Helm
                            kubectl get all -l app.kubernetes.io/instance=${HELM_RELEASE_NAME} -n ${TARGET_NAMESPACE}
                            
                            # Check service endpoints
                            kubectl get endpoints -n ${TARGET_NAMESPACE}
                        """

                        // Specific health check for the service
                        try {
                            sh """
                                # Port forward and health check
                                timeout 30s kubectl port-forward svc/${HELM_RELEASE_NAME}-${params.SERVICE}-service ${SERVICE_PORT}:${SERVICE_PORT} -n ${TARGET_NAMESPACE} &
                                sleep 5
                                curl -f http://localhost:${SERVICE_PORT}/health || echo "Health check failed but continuing..."
                            """
                        } catch (Exception e) {
                            echo "⚠️ Health check failed: ${e.getMessage()}"
                        }

                        echo "✅ Post-deployment validation completed"
                    }
                }
            }
        }
    }

    // ========================================
    // POST-BUILD ACTIONS
    // ========================================
    post {
        success {
            script {
                def m2 = System.currentTimeMillis()
                def durTime = groovyMethods.durationTime(m1, m2)
                def author = groovyMethods.readCommitAuthor()
                def branch = groovyMethods.getCurrentBranch()
                def commitHash = groovyMethods.getLatestCommitHash()

                echo "🎉 HELM DEPLOYMENT SUCCESS!"
                echo "Service: ${SERVICE_NAME}"
                echo "Environment: ${params.ENVIRONMENT}"
                echo "Helm Action: ${params.HELM_ACTION}"
                echo "Release: ${HELM_RELEASE_NAME}"
                echo "Namespace: ${TARGET_NAMESPACE}"
                echo "Image: ${IMAGE_NAME}:${IMAGE_TAG}"
                echo "Chart Path: ${CHART_PATH}"
                echo "Duration: ${durTime}"

                // Send Slack notification with Helm details
                groovyMethods.notifySlack("${SLACK_WEBHOOK}", "foodfund-deployments", [
                    [
                        title: "✅ HELM DEPLOYMENT SUCCESS: ${SERVICE_NAME}",
                        title_link: "${env.BUILD_URL}",
                        color: "good",
                        text: "Deployed by: ${author} using Helm ${params.HELM_ACTION}",
                        "mrkdwn_in": ["fields"],
                        fields: [
                            [
                                title: "Environment",
                                value: "${params.ENVIRONMENT}",
                                short: true
                            ],
                            [
                                title: "Helm Action",
                                value: "${params.HELM_ACTION}",
                                short: true
                            ],
                            [
                                title: "Release Name",
                                value: "${HELM_RELEASE_NAME}",
                                short: true
                            ],
                            [
                                title: "Namespace",
                                value: "${TARGET_NAMESPACE}",
                                short: true
                            ],
                            [
                                title: "Image",
                                value: "${IMAGE_NAME}:${IMAGE_TAG}",
                                short: false
                            ],
                            [
                                title: "Duration",
                                value: "${durTime}",
                                short: true
                            ],
                            [
                                title: "Branch",
                                value: "${branch}",
                                short: true
                            ]
                        ]
                    ]
                ])
            }
        }

        failure {
            script {
                def m2 = System.currentTimeMillis()
                def durTime = groovyMethods.durationTime(m1, m2)
                def author = groovyMethods.readCommitAuthor()
                def branch = groovyMethods.getCurrentBranch()

                echo "❌ HELM DEPLOYMENT FAILED!"
                echo "Service: ${SERVICE_NAME}"
                echo "Environment: ${params.ENVIRONMENT}"
                echo "Helm Action: ${params.HELM_ACTION}"
                echo "Release: ${HELM_RELEASE_NAME}"
                echo "Duration: ${durTime}"
                
                groovyMethods.notifySlack("${SLACK_WEBHOOK}", "foodfund-deployments", [
                    [
                        title: "❌ HELM DEPLOYMENT FAILED: ${SERVICE_NAME}",
                        title_link: "${env.BUILD_URL}",
                        color: "danger",
                        text: "Failed by: ${author} during Helm ${params.HELM_ACTION}",
                        "mrkdwn_in": ["fields"],
                        fields: [
                            [
                                title: "Environment",
                                value: "${params.ENVIRONMENT}",
                                short: true
                            ],
                            [
                                title: "Helm Action",
                                value: "${params.HELM_ACTION}",
                                short: true
                            ],
                            [
                                title: "Release Name",
                                value: "${HELM_RELEASE_NAME}",
                                short: true
                            ],
                            [
                                title: "Namespace",
                                value: "${TARGET_NAMESPACE}",
                                short: true
                            ],
                            [
                                title: "Duration",
                                value: "${durTime}",
                                short: true
                            ],
                            [
                                title: "Build Number",
                                value: "${BUILD_NUMBER}",
                                short: true
                            ]
                        ]
                    ]
                ])
            }
        }

        always {
            script {
                echo "🏁 Helm-based pipeline completed for ${SERVICE_NAME}"
                echo "Build URL: ${env.BUILD_URL}"
                echo "Helm Release: ${HELM_RELEASE_NAME}"
                echo "Target Namespace: ${TARGET_NAMESPACE}"

                // Show final Helm status
                try {
                    sh "helm list -n ${TARGET_NAMESPACE} || echo 'No Helm releases found'"
                } catch (Exception e) {
                    echo "Could not get Helm status: ${e.getMessage()}"
                }

                // Cleanup workspace
                cleanWs()
            }
        }
    }
}
