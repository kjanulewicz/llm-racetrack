variable "tenant_id" {
  type        = string
  description = "Azure AD tenant ID."
}

variable "subscription_id" {
  type        = string
  description = "Azure subscription ID."
}

variable "resource_group_name" {
  type        = string
  description = "Name of the Azure Resource Group to create."
}

variable "location" {
  type        = string
  default     = "West Europe"
  description = "Azure region for all resources."
}

variable "app_name" {
  type        = string
  default     = "llm-racetrack"
  description = "Base name used to derive resource names."
}

variable "entra_client_id" {
  type        = string
  description = "Entra ID App Registration client ID (created manually in the Azure Portal)."
}

variable "cosmos_db_name" {
  type        = string
  default     = "llm-racetrack-db"
  description = "Name of the Cosmos DB SQL database."
}

variable "openai_resource_ids" {
  type        = list(string)
  description = "Resource IDs of Azure OpenAI accounts to grant the Managed Identity access to."
}

variable "frontend_origin" {
  type        = string
  description = "Static Web App URL — set after first deploy."
}
