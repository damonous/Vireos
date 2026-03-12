# =============================================================================
# Vireos MVP — Terraform Variables
# =============================================================================

variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-west-1"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.medium"
}

variable "key_name" {
  description = "Name for the generated SSH key pair"
  type        = string
  default     = "vireos-mvp-key"
}

variable "allowed_ssh_cidr" {
  description = "CIDR block allowed to SSH into the instance. Narrow this to your IP (e.g. 1.2.3.4/32)"
  type        = string
  default     = "0.0.0.0/0"
}

variable "project_name" {
  description = "Project name used for tagging resources"
  type        = string
  default     = "vireos-mvp"
}
