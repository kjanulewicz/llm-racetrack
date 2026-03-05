output "app_service_url" {
  value       = azurerm_linux_web_app.backend.default_hostname
  description = "Default hostname of the backend App Service."
}

output "static_web_app_url" {
  value       = azurerm_static_web_app.frontend.default_host_name
  description = "Default hostname of the frontend Static Web App."
}

output "cosmos_url" {
  value       = azurerm_cosmosdb_account.main.endpoint
  description = "Cosmos DB account endpoint URL."
}

output "managed_identity_id" {
  value       = azurerm_linux_web_app.backend.identity[0].principal_id
  description = "Principal ID of the backend App Service system-assigned Managed Identity."
}
