# ---------------------------------------------------------------------------
# Resource Group
# ---------------------------------------------------------------------------
resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.location
}

# ---------------------------------------------------------------------------
# App Service Plan (Linux, Python 3.11)
# ---------------------------------------------------------------------------
resource "azurerm_service_plan" "main" {
  name                = "${var.app_name}-plan"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  os_type             = "Linux"
  sku_name            = "B1"
}

# ---------------------------------------------------------------------------
# App Service — backend (FastAPI) with system-assigned Managed Identity
# ---------------------------------------------------------------------------
resource "azurerm_linux_web_app" "backend" {
  name                = "${var.app_name}-backend"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  service_plan_id     = azurerm_service_plan.main.id

  identity {
    type = "SystemAssigned"
  }

  site_config {
    application_stack {
      python_version = "3.11"
    }
  }

  app_settings = {
    TENANT_ID       = var.tenant_id
    API_CLIENT_ID   = var.entra_client_id
    COSMOS_URL      = azurerm_cosmosdb_account.main.endpoint
    FRONTEND_ORIGIN = var.frontend_origin
  }
}

# ---------------------------------------------------------------------------
# Azure Static Web App — frontend
# ---------------------------------------------------------------------------
resource "azurerm_static_web_app" "frontend" {
  name                = "${var.app_name}-frontend"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku_tier            = "Free"
  sku_size            = "Free"
}

# ---------------------------------------------------------------------------
# Cosmos DB Account (serverless)
# ---------------------------------------------------------------------------
resource "azurerm_cosmosdb_account" "main" {
  name                = "${var.app_name}-cosmos"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  offer_type          = "Standard"
  kind                = "GlobalDocumentDB"

  capabilities {
    name = "EnableServerless"
  }

  consistency_policy {
    consistency_level = "Session"
  }

  geo_location {
    location          = azurerm_resource_group.main.location
    failover_priority = 0
  }
}

# ---------------------------------------------------------------------------
# Cosmos DB SQL Database
# ---------------------------------------------------------------------------
resource "azurerm_cosmosdb_sql_database" "main" {
  name                = var.cosmos_db_name
  resource_group_name = azurerm_resource_group.main.name
  account_name        = azurerm_cosmosdb_account.main.name
}

# ---------------------------------------------------------------------------
# Cosmos DB Containers (partition keys per section 6 of the brief)
# ---------------------------------------------------------------------------
resource "azurerm_cosmosdb_sql_container" "users" {
  name                = "users"
  resource_group_name = azurerm_resource_group.main.name
  account_name        = azurerm_cosmosdb_account.main.name
  database_name       = azurerm_cosmosdb_sql_database.main.name
  partition_key_paths = ["/partitionKey"]
}

resource "azurerm_cosmosdb_sql_container" "model_configs" {
  name                = "model_configs"
  resource_group_name = azurerm_resource_group.main.name
  account_name        = azurerm_cosmosdb_account.main.name
  database_name       = azurerm_cosmosdb_sql_database.main.name
  partition_key_paths = ["/partitionKey"]
}

resource "azurerm_cosmosdb_sql_container" "prompt_templates" {
  name                = "prompt_templates"
  resource_group_name = azurerm_resource_group.main.name
  account_name        = azurerm_cosmosdb_account.main.name
  database_name       = azurerm_cosmosdb_sql_database.main.name
  partition_key_paths = ["/partitionKey"]
}

resource "azurerm_cosmosdb_sql_container" "races" {
  name                = "races"
  resource_group_name = azurerm_resource_group.main.name
  account_name        = azurerm_cosmosdb_account.main.name
  database_name       = azurerm_cosmosdb_sql_database.main.name
  partition_key_paths = ["/partitionKey"]
}

resource "azurerm_cosmosdb_sql_container" "shares" {
  name                = "shares"
  resource_group_name = azurerm_resource_group.main.name
  account_name        = azurerm_cosmosdb_account.main.name
  database_name       = azurerm_cosmosdb_sql_database.main.name
  partition_key_paths = ["/partitionKey"]
}

# ---------------------------------------------------------------------------
# RBAC — Cognitive Services OpenAI User on each OpenAI resource
# ---------------------------------------------------------------------------
resource "azurerm_role_assignment" "openai_user" {
  count                = length(var.openai_resource_ids)
  scope                = var.openai_resource_ids[count.index]
  role_definition_name = "Cognitive Services OpenAI User"
  principal_id         = azurerm_linux_web_app.backend.identity[0].principal_id
}

# ---------------------------------------------------------------------------
# RBAC — Cosmos DB Built-in Data Contributor on the Cosmos account
# ---------------------------------------------------------------------------
resource "azurerm_cosmosdb_sql_role_assignment" "data_contributor" {
  resource_group_name = azurerm_resource_group.main.name
  account_name        = azurerm_cosmosdb_account.main.name
  # Built-in "Cosmos DB Built-in Data Contributor" role definition ID
  role_definition_id = "${azurerm_cosmosdb_account.main.id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002"
  principal_id       = azurerm_linux_web_app.backend.identity[0].principal_id
  scope              = azurerm_cosmosdb_account.main.id
}
