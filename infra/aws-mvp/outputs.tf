# =============================================================================
# Vireos MVP — Terraform Outputs
# =============================================================================

output "public_ip" {
  description = "Elastic IP address of the EC2 instance"
  value       = aws_eip.main.public_ip
}

output "ssh_command" {
  description = "SSH command to connect to the instance"
  value       = "ssh -i ${var.key_name}.pem ec2-user@${aws_eip.main.public_ip}"
}

output "app_url" {
  description = "Application URL (accept the self-signed certificate warning)"
  value       = "https://${aws_eip.main.public_ip}"
}

output "ssh_private_key_path" {
  description = "Path to the generated SSH private key"
  value       = "${path.module}/${var.key_name}.pem"
}
