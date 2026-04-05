from datetime import datetime
import json
import secrets
from typing import Optional

import httpx
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import models
import schemas
from auth import get_optional_user
from config import settings
from database import get_db
from services import haversine_distance

router = APIRouter()

SYSTEM_PROMPT = """You are HyperLocal AI Assistant, a helpful and friendly assistant that helps users find nearby local services.

Always reply in clear English only, even if the user writes in Hindi or Hinglish.

Your job:
1. Understand the user's problem
2. Identify the service category needed
3. Provide helpful advice and find nearby service providers

Service categories available:
- plumber, electrician, ac_repair, carpenter, tutor, doctor, chemist, hospital, grocery, salon, cleaning, pest_control, painter, mechanic, other

When you identify the problem, ALWAYS respond with a JSON block at the end of your message in this exact format:
<AI_DATA>
{
  "detected_problem": "brief problem description in English",
  "suggested_category": "category_from_above_list",
  "estimated_cost_min": 200,
  "estimated_cost_max": 800,
  "best_time_to_book": "Morning 9-11 AM for best availability",
  "urgent": false
}
</AI_DATA>

Keep responses conversational, helpful, and brief (2-3 sentences max before the JSON).
Always show empathy. If emergency, say so clearly."""


def parse_ai_data(reply: str) -> tuple[str, Optional[dict]]:
    """Extract AI_DATA JSON from response."""
    clean_reply = reply
    ai_data = None

    if "<AI_DATA>" in reply and "</AI_DATA>" in reply:
        start = reply.index("<AI_DATA>") + len("<AI_DATA>")
        end = reply.index("</AI_DATA>")
        json_str = reply[start:end].strip()
        clean_reply = reply[: reply.index("<AI_DATA>")].strip()
        try:
            ai_data = json.loads(json_str)
        except json.JSONDecodeError:
            pass

    return clean_reply, ai_data


async def call_claude_api(messages: list, system: str) -> str:
    """Call Anthropic Claude API."""
    if not settings.ANTHROPIC_API_KEY:
        return mock_ai_response(messages[-1]["content"])

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(
                settings.ANTHROPIC_API_URL,
                headers={
                    "x-api-key": settings.ANTHROPIC_API_KEY,
                    "anthropic-version": settings.ANTHROPIC_VERSION,
                    "content-type": "application/json",
                },
                json={
                    "model": settings.ANTHROPIC_MODEL,
                    "max_tokens": 1024,
                    "system": system,
                    "messages": messages,
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["content"][0]["text"]
        except httpx.HTTPError:
            return mock_ai_response(messages[-1]["content"])


def mock_ai_response(user_message: str) -> str:
    """Development fallback when no API key or the provider fails."""
    msg_lower = user_message.lower()

    if any(word in msg_lower for word in ["ac", "air condition", "cooling"]):
        return """Your AC appears to have a cooling or repair issue. I can help you find nearby AC repair technicians.

<AI_DATA>
{"detected_problem": "AC not working / AC repair needed", "suggested_category": "ac_repair", "estimated_cost_min": 300, "estimated_cost_max": 1500, "best_time_to_book": "Morning 9-11 AM for best availability", "urgent": false}
</AI_DATA>"""

    if any(word in msg_lower for word in ["light", "electricity", "electric", "wire", "power"]):
        return """This looks like an electrical issue and it may be urgent. I recommend contacting a qualified electrician as soon as possible.

<AI_DATA>
{"detected_problem": "Electrical issue / power problem", "suggested_category": "electrician", "estimated_cost_min": 200, "estimated_cost_max": 800, "best_time_to_book": "ASAP - electrical issues should be fixed immediately", "urgent": true}
</AI_DATA>"""

    if any(word in msg_lower for word in ["pipe", "leak", "water", "tap", "drain"]):
        return """A water leak should be fixed quickly to avoid further damage. I can help you find nearby plumbers.

<AI_DATA>
{"detected_problem": "Water leak / plumbing issue", "suggested_category": "plumber", "estimated_cost_min": 150, "estimated_cost_max": 600, "best_time_to_book": "Today itself - water leaks cause damage", "urgent": true}
</AI_DATA>"""

    return """I understand the issue. I can help you find nearby service providers.

<AI_DATA>
{"detected_problem": "General service needed", "suggested_category": "other", "estimated_cost_min": 200, "estimated_cost_max": 1000, "best_time_to_book": "Morning 9 AM - 12 PM", "urgent": false}
</AI_DATA>"""


@router.post("/chat", response_model=schemas.ChatResponse)
async def ai_chat(
    chat_data: schemas.ChatMessage,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_optional_user),
):
    session = None
    if chat_data.session_token:
        session = db.query(models.ChatSession).filter(
            models.ChatSession.session_token == chat_data.session_token
        ).first()

    if not session:
        session = models.ChatSession(
            user_id=current_user.id if current_user else None,
            session_token=secrets.token_urlsafe(32),
            messages=[],
            language=chat_data.language,
        )
        db.add(session)
        db.flush()

    history = session.messages or []
    api_messages = [{"role": m["role"], "content": m["content"]} for m in history[-10:]]
    api_messages.append({"role": "user", "content": chat_data.message})

    raw_reply = await call_claude_api(api_messages, SYSTEM_PROMPT)
    clean_reply, ai_data = parse_ai_data(raw_reply)

    new_messages = history + [
        {"role": "user", "content": chat_data.message, "timestamp": datetime.utcnow().isoformat()},
        {"role": "assistant", "content": clean_reply, "timestamp": datetime.utcnow().isoformat()},
    ]
    session.messages = new_messages

    if ai_data:
        session.detected_problem = ai_data.get("detected_problem")
        session.suggested_category = ai_data.get("suggested_category")

    db.commit()

    suggested_services = []
    if ai_data and chat_data.latitude and chat_data.longitude:
        category_str = ai_data.get("suggested_category")
        try:
            category = models.ServiceCategory(category_str)
            providers = db.query(models.ServiceProvider).filter(
                models.ServiceProvider.category == category,
                models.ServiceProvider.is_currently_available == True,
            ).limit(50).all()

            nearby = []
            for provider in providers:
                dist = haversine_distance(
                    chat_data.latitude,
                    chat_data.longitude,
                    provider.latitude,
                    provider.longitude,
                )
                if dist <= 15:
                    nearby.append((dist, provider))

            nearby.sort(key=lambda item: item[0])
            for dist, provider in nearby[:3]:
                provider_schema = schemas.ServiceProviderResponse.model_validate(provider)
                provider_schema.distance_km = round(dist, 2)
                suggested_services.append(provider_schema)
        except (ValueError, Exception):
            pass

    return schemas.ChatResponse(
        reply=clean_reply,
        session_token=session.session_token,
        detected_problem=ai_data.get("detected_problem") if ai_data else None,
        suggested_category=ai_data.get("suggested_category") if ai_data else None,
        suggested_services=suggested_services if suggested_services else None,
        estimated_cost_range={
            "min": ai_data.get("estimated_cost_min", 0),
            "max": ai_data.get("estimated_cost_max", 0),
        }
        if ai_data
        else None,
        best_time_to_book=ai_data.get("best_time_to_book") if ai_data else None,
    )
