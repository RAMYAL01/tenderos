{{- define "tenderos.name" -}}tenderos{{- end -}}
{{- define "tenderos.fullname" -}}{{ printf "%s-%s" .Release.Name "tenderos" | trunc 63 | trimSuffix "-" }}{{- end -}}

{{- define "tenderos.labels" -}}
app.kubernetes.io/name: {{ include "tenderos.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
{{- end -}}

{{- define "tenderos.selector" -}}
app.kubernetes.io/name: {{ include "tenderos.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "tenderos.imagePullSecrets" -}}
{{- with .Values.global.imagePullSecrets }}
imagePullSecrets:
{{ toYaml . | indent 2 }}
{{- end }}
{{- end -}}

{{- define "tenderos.secretName" -}}{{ .Values.secrets.name }}{{- end -}}

{{- define "tenderos.dbUrl" -}}
{{- if .Values.postgres.enabled -}}
postgres://{{ .Values.postgres.user }}:$(PG_PASSWORD)@{{ .Release.Name }}-postgres:5432/{{ .Values.postgres.db }}
{{- else -}}
{{ .Values.postgres.externalUrl }}
{{- end -}}
{{- end -}}
