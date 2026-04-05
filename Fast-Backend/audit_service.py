from typing import Any

import models


def create_audit_log(
    db,
    *,
    action: str,
    entity_type: str,
    entity_id: str | None = None,
    user_id=None,
    details: dict[str, Any] | None = None,
):
    log = models.AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details or {},
    )
    db.add(log)
    return log
