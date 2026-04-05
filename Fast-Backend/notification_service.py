import models


def create_notification(
    db,
    *,
    user_id,
    title: str,
    message: str,
    notification_type: models.NotificationType = models.NotificationType.SYSTEM,
    action_url: str | None = None,
):
    notification = models.Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=notification_type,
        action_url=action_url,
    )
    db.add(notification)
    return notification
