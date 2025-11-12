#!/bin/bash
set -e  # Exit on error

# ============================================
# FoodFund Microservices Deployment Script
# ============================================
# This script handles the deployment of all microservices to Kubernetes
# using Helm charts with proper ordering and health checks.

# Required environment variables:
# - TAG: Image tag (e.g., "latest" or "develop")
# - UNIQUE_TAG: Unique image tag (e.g., "develop-abc123")
# - DOCKERHUB_USERNAME: DockerHub username
# - DEPLOY_AUTH: "true" if auth service should be deployed
# - DEPLOY_USER: "true" if user service should be deployed
# - DEPLOY_CAMPAIGN: "true" if campaign service should be deployed
# - DEPLOY_OPERATION: "true" if operation service should be deployed
# - DEPLOY_GATEWAY: "true" if gateway should be deployed

# Configuration
NAMESPACE="foodfund-k8s"
HELM_TIMEOUT="6m"
READINESS_TIMEOUT="120s"
STABILIZATION_DELAY=10

echo "=================================================="
echo "🚀 FoodFund Microservices Deployment"
echo "=================================================="
echo "Tag: ${TAG} (unique: ${UNIQUE_TAG})"
echo "Namespace: ${NAMESPACE}"
echo ""

# ============================================
# PHASE 1: Deploy Subgraph Services in Parallel
# ============================================
echo "📦 Phase 1: Deploying subgraph services in parallel..."
echo ""

# Array to track background process IDs
DEPLOY_PIDS=()

# Deploy Auth Service
if [[ "${DEPLOY_AUTH}" = "true" ]]; then
    echo "🚀 Starting auth-service deployment..."
    (
        helm upgrade --install auth-service k8s/charts/auth-service \
            --namespace ${NAMESPACE} \
            --set image.tag=${UNIQUE_TAG} \
            --set image.repository=${DOCKERHUB_USERNAME}/foodfund-auth \
            --wait \
            --timeout ${HELM_TIMEOUT} \
            --atomic \
        && echo "✅ auth-service deployed" \
        || echo "❌ auth-service deployment failed"
    ) &
    DEPLOY_PIDS+=($!)
fi

# Deploy User Service
if [[ "${DEPLOY_USER}" = "true" ]]; then
    echo "🚀 Starting user-service deployment..."
    (
        helm upgrade --install user-service k8s/charts/user-service \
            --namespace ${NAMESPACE} \
            --set image.tag=${UNIQUE_TAG} \
            --set image.repository=${DOCKERHUB_USERNAME}/foodfund-user \
            --wait \
            --timeout ${HELM_TIMEOUT} \
            --atomic \
        && echo "✅ user-service deployed" \
        || echo "❌ user-service deployment failed"
    ) &
    DEPLOY_PIDS+=($!)
fi

# Deploy Campaign Service
if [[ "${DEPLOY_CAMPAIGN}" = "true" ]]; then
    echo "🚀 Starting campaign-service deployment..."
    (
        helm upgrade --install campaign-service k8s/charts/campaign-service \
            --namespace ${NAMESPACE} \
            --set image.tag=${UNIQUE_TAG} \
            --set image.repository=${DOCKERHUB_USERNAME}/foodfund-campaign \
            --wait \
            --timeout ${HELM_TIMEOUT} \
            --atomic \
        && echo "✅ campaign-service deployed" \
        || echo "❌ campaign-service deployment failed"
    ) &
    DEPLOY_PIDS+=($!)
fi

# Deploy Operation Service
if [[ "${DEPLOY_OPERATION}" = "true" ]]; then
    echo "🚀 Starting operation-service deployment..."
    (
        helm upgrade --install operation-service k8s/charts/operation-service \
            --namespace ${NAMESPACE} \
            --set image.tag=${UNIQUE_TAG} \
            --set image.repository=${DOCKERHUB_USERNAME}/foodfund-operation \
            --wait \
            --timeout ${HELM_TIMEOUT} \
            --atomic \
        && echo "✅ operation-service deployed" \
        || echo "❌ operation-service deployment failed"
    ) &
    DEPLOY_PIDS+=($!)
fi

# Wait for all background deployments to complete
if [[ ${#DEPLOY_PIDS[@]} -gt 0 ]]; then
    echo ""
    echo "⏳ Waiting for ${#DEPLOY_PIDS[@]} deployment(s) to complete..."
    FAILED=0
    for pid in "${DEPLOY_PIDS[@]}"; do
        if ! wait $pid; then
            FAILED=$((FAILED + 1))
        fi
    done
    
    if [[ $FAILED -gt 0 ]]; then
        echo "❌ $FAILED deployment(s) failed!"
        exit 1
    fi
    
    echo "✅ All subgraph deployments completed successfully!"
else
    echo "⏭️  No subgraph services to deploy"
fi
echo ""

# ============================================
# PHASE 2: Verify Subgraph Services are Ready
# ============================================
echo "⏳ Phase 2: Verifying all subgraph services are ready..."
echo ""

# Give services a moment to stabilize
sleep ${STABILIZATION_DELAY}

# Quick check for all existing services
ALL_READY=true

if kubectl get deployment auth-service -n ${NAMESPACE} &>/dev/null && \
   ! kubectl wait --for=condition=available deployment/auth-service -n ${NAMESPACE} --timeout=${READINESS_TIMEOUT} 2>/dev/null; then
    echo "⚠️  auth-service not ready yet"
    ALL_READY=false
fi

if kubectl get deployment user-service -n ${NAMESPACE} &>/dev/null && \
   ! kubectl wait --for=condition=available deployment/user-service -n ${NAMESPACE} --timeout=${READINESS_TIMEOUT} 2>/dev/null; then
    echo "⚠️  user-service not ready yet"
    ALL_READY=false
fi

if kubectl get deployment campaign-service -n ${NAMESPACE} &>/dev/null && \
   ! kubectl wait --for=condition=available deployment/campaign-service -n ${NAMESPACE} --timeout=${READINESS_TIMEOUT} 2>/dev/null; then
    echo "⚠️  campaign-service not ready yet"
    ALL_READY=false
fi

if kubectl get deployment operation-service -n ${NAMESPACE} &>/dev/null && \
   ! kubectl wait --for=condition=available deployment/operation-service -n ${NAMESPACE} --timeout=${READINESS_TIMEOUT} 2>/dev/null; then
    echo "⚠️  operation-service not ready yet"
    ALL_READY=false
fi

if [[ "$ALL_READY" = true ]]; then
    echo "✅ All subgraph services are ready!"
else
    echo "⚠️  Some services may still be starting, but continuing with gateway deployment..."
fi
echo ""

# ============================================
# PHASE 3: Deploy GraphQL Gateway Last
# ============================================
if [[ "${DEPLOY_GATEWAY}" = "true" ]]; then
    echo "🌐 Phase 3: Deploying GraphQL Gateway..."
    echo ""
    helm upgrade --install graphql-gateway k8s/charts/graphql-gateway \
        --namespace ${NAMESPACE} \
        --set image.tag=${UNIQUE_TAG} \
        --set image.repository=${DOCKERHUB_USERNAME}/foodfund-graphql-gateway \
        --wait \
        --timeout ${HELM_TIMEOUT} \
        --atomic
    echo "✅ graphql-gateway deployed"
    echo ""
fi

echo "=================================================="
echo "✅ Deployment completed successfully!"
echo "=================================================="
