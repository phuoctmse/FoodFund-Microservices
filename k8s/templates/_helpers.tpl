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
Return the proper image name
*/}}
{{- define "foodfund.image" -}}
{{- $registry := .Values.global.imageRegistry | default "" }}
{{- if .image.registry }}
  {{- $registry = .image.registry }}
{{- end }}
{{- if $registry }}
  {{- printf "%s/%s:%s" $registry .image.repository (.image.tag | default .Chart.AppVersion) }}
{{- else }}
  {{- printf "%s:%s" .image.repository (.image.tag | default .Chart.AppVersion) }}
{{- end }}
{{- end }}

{{/*
Return the proper image pull policy
*/}}
{{- define "foodfund.imagePullPolicy" -}}
{{- $pullPolicy := .Values.global.imagePullPolicy | default "IfNotPresent" }}
{{- if .image.pullPolicy }}
  {{- $pullPolicy = .image.pullPolicy }}
{{- end }}
{{- printf "%s" $pullPolicy }}
{{- end }}

{{/*
Return the namespace
*/}}
{{- define "foodfund.namespace" -}}
{{- if .Values.namespace.create }}
  {{- .Values.namespace.name }}
{{- else }}
  {{- .Release.Namespace }}
{{- end }}
{{- end }}

{{/*
PostgreSQL host
*/}}
{{- define "foodfund.postgresql.host" -}}
{{- if .Values.postgresql.enabled }}
  {{- printf "%s-postgresql" .Release.Name }}
{{- else }}
  {{- printf "%s" .Values.externalDatabase.host }}
{{- end }}
{{- end }}

{{/*
PostgreSQL port
*/}}
{{- define "foodfund.postgresql.port" -}}
{{- if .Values.postgresql.enabled }}
  {{- printf "5432" }}
{{- else }}
  {{- printf "%s" .Values.externalDatabase.port }}
{{- end }}
{{- end }}

{{/*
PostgreSQL secret name
*/}}
{{- define "foodfund.postgresql.secretName" -}}
{{- if .Values.postgresql.enabled }}
  {{- printf "%s-postgresql" .Release.Name }}
{{- else }}
  {{- printf "%s" .Values.externalDatabase.secretName }}
{{- end }}
{{- end }}
