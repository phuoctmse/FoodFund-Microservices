{{/*
Expand the name of the chart.
*/}}
{{- define "foodfund.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "foodfund.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "foodfund.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "foodfund.labels" -}}
helm.sh/chart: {{ include "foodfund.chart" . }}
{{ include "foodfund.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "foodfund.selectorLabels" -}}
app.kubernetes.io/name: {{ include "foodfund.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Auth Service labels
*/}}
{{- define "foodfund.auth.labels" -}}
{{ include "foodfund.labels" . }}
app.kubernetes.io/component: auth
service: auth
{{- end }}

{{/*
Auth Service selector labels
*/}}
{{- define "foodfund.auth.selectorLabels" -}}
{{ include "foodfund.selectorLabels" . }}
app.kubernetes.io/component: auth
service: auth
{{- end }}

{{/*
Gateway Service labels
*/}}
{{- define "foodfund.gateway.labels" -}}
{{ include "foodfund.labels" . }}
app.kubernetes.io/component: gateway
service: gateway
{{- end }}

{{/*
Gateway Service selector labels
*/}}
{{- define "foodfund.gateway.selectorLabels" -}}
{{ include "foodfund.selectorLabels" . }}
app.kubernetes.io/component: gateway
service: gateway
{{- end }}

{{/*
User Service labels
*/}}
{{- define "foodfund.user.labels" -}}
{{ include "foodfund.labels" . }}
app.kubernetes.io/component: user
service: user
{{- end }}

{{/*
User Service selector labels
*/}}
{{- define "foodfund.user.selectorLabels" -}}
{{ include "foodfund.selectorLabels" . }}
app.kubernetes.io/component: user
service: user
{{- end }}

{{/*
Campaign Service labels
*/}}
{{- define "foodfund.campaign.labels" -}}
{{ include "foodfund.labels" . }}
app.kubernetes.io/component: campaign
service: campaign
{{- end }}

{{/*
Campaign Service selector labels
*/}}
{{- define "foodfund.campaign.selectorLabels" -}}
{{ include "foodfund.selectorLabels" . }}
app.kubernetes.io/component: campaign
service: campaign
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "foodfund.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "foodfund.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Return the namespace
*/}}
{{- define "foodfund.namespace" -}}
{{- if .Values.namespace.create }}
  {{- .Values.namespace.name | default .Values.global.namespace }}
{{- else }}
  {{- .Release.Namespace }}
{{- end }}
{{- end }}