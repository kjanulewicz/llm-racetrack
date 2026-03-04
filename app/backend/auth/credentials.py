"""DefaultAzureCredential singleton.

A single :class:`~azure.identity.DefaultAzureCredential` instance is shared
across the entire application.  In production, Managed Identity is resolved
automatically; locally, ``az login`` credentials are used (zero code change).
"""

from azure.identity import DefaultAzureCredential

_credential: DefaultAzureCredential | None = None


def get_azure_credential() -> DefaultAzureCredential:
    """Return (and lazily create) the shared credential instance."""
    global _credential
    if _credential is None:
        _credential = DefaultAzureCredential()
    return _credential
