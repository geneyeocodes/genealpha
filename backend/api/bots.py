from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..core.database import get_db
from ..core.models import Bot, BotStatus
from ..core.schemas import BotCreate, BotUpdate, BotResponse

router = APIRouter()


@router.get("/", response_model=list[BotResponse])
async def list_bots(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Bot).order_by(Bot.created_at.desc()))
    return result.scalars().all()


@router.get("/{bot_id}", response_model=BotResponse)
async def get_bot(bot_id: str, db: AsyncSession = Depends(get_db)):
    bot = await db.get(Bot, bot_id)
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    return bot


@router.post("/", response_model=BotResponse, status_code=201)
async def create_bot(data: BotCreate, db: AsyncSession = Depends(get_db)):
    bot = Bot(**data.model_dump())
    db.add(bot)
    await db.commit()
    await db.refresh(bot)
    return bot


@router.patch("/{bot_id}", response_model=BotResponse)
async def update_bot(bot_id: str, data: BotUpdate, db: AsyncSession = Depends(get_db)):
    bot = await db.get(Bot, bot_id)
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(bot, key, val)
    await db.commit()
    await db.refresh(bot)
    return bot


@router.delete("/{bot_id}", status_code=204)
async def delete_bot(bot_id: str, db: AsyncSession = Depends(get_db)):
    bot = await db.get(Bot, bot_id)
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    await db.delete(bot)
    await db.commit()


@router.post("/{bot_id}/start", response_model=BotResponse)
async def start_bot(bot_id: str, db: AsyncSession = Depends(get_db)):
    bot = await db.get(Bot, bot_id)
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    bot.status = BotStatus.RUNNING
    await db.commit()
    await db.refresh(bot)
    return bot


@router.post("/{bot_id}/stop", response_model=BotResponse)
async def stop_bot(bot_id: str, db: AsyncSession = Depends(get_db)):
    bot = await db.get(Bot, bot_id)
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    bot.status = BotStatus.STOPPED
    await db.commit()
    await db.refresh(bot)
    return bot
