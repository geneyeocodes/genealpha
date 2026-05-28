"""
In-memory bot runtime manager.
Runs each deployed bot as an asyncio task that periodically checks for signals
and places trades via IBKR (or logs them in paper mode).
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from .database import async_session
from .models import Bot, BotStatus, Trade
from .datafeed import fetch_historical_data, fetch_intraday_data
from .ibkr import IBKRConnector
from ..strategies.engine import StrategyEngine
from ..strategies.config_schema import StrategyConfig
from ..api.ws import manager as ws_manager

logger = logging.getLogger(__name__)


class BotRuntimeManager:
    """Manages in-memory asyncio tasks for running bots."""

    def __init__(self):
        self._tasks: Dict[str, asyncio.Task] = {}
        self._ibkr = IBKRConnector()

    async def start_bot(self, bot: Bot) -> None:
        """Create and store a background task for the given bot."""
        if bot.id in self._tasks and not self._tasks[bot.id].done():
            logger.warning("Bot %s is already running", bot.id)
            return

        task = asyncio.create_task(self._run_bot_loop(bot))
        self._tasks[bot.id] = task
        logger.info("Started bot task: %s (%s)", bot.name, bot.id)

    async def stop_bot(self, bot_id: str) -> None:
        """Cancel the background task for the given bot."""
        task = self._tasks.pop(bot_id, None)
        if task and not task.done():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
            logger.info("Stopped bot task: %s", bot_id)

    def is_running(self, bot_id: str) -> bool:
        task = self._tasks.get(bot_id)
        return task is not None and not task.done()

    def get_status(self, bot_id: str) -> str:
        return "running" if self.is_running(bot_id) else "stopped"

    async def start_all_pending(self) -> None:
        """On startup, restart any bots that were left in RUNNING status."""
        async with async_session() as db:
            result = await db.execute(select(Bot).where(Bot.status == BotStatus.RUNNING))
            running_bots = result.scalars().all()
            for bot in running_bots:
                logger.info("Restarting bot %s (%s) from DB", bot.name, bot.id)
                await self.start_bot(bot)

    async def _run_bot_loop(self, bot: Bot) -> None:
        """Background loop: fetch data -> generate signals -> place trades."""
        try:
            config = StrategyConfig(**bot.strategy_config)
            engine = StrategyEngine(config)

            while True:
                try:
                    tf = config.timeframe or "1d"
                    sleep_seconds = self._timeframe_to_seconds(tf)

                    # Fetch latest data
                    if tf in ("1m", "5m", "15m", "30m", "1h"):
                        df = fetch_intraday_data(bot.symbol, period="5d", interval=tf)
                    else:
                        end = datetime.utcnow().strftime("%Y-%m-%d")
                        start = (datetime.utcnow() - timedelta(days=365)).strftime("%Y-%m-%d")
                        df = fetch_historical_data(bot.symbol, start, end)

                    if df is not None and not df.empty:
                        signals = engine.generate_signals(df)
                        if not signals.empty:
                            latest = signals.iloc[-1]
                            signal = latest.get("signal")

                            if signal in ("buy", "sell", "stop_loss"):
                                side = "BUY" if signal == "buy" else "SELL"
                                price = float(latest["close"])
                                quantity = self._calc_quantity(bot, price, config, latest)

                                if quantity > 0:
                                    await self._place_order(bot, side, quantity, price)

                            # Broadcast via WebSocket
                            await ws_manager.broadcast(
                                {
                                    "type": "bot_update",
                                    "bot_id": bot.id,
                                    "status": "running",
                                    "signal": signal,
                                    "price": float(latest["close"]) if "close" in latest else None,
                                    "timestamp": str(latest.get("timestamp", datetime.utcnow())),
                                }
                            )

                    await asyncio.sleep(sleep_seconds)

                except asyncio.CancelledError:
                    raise
                except Exception as e:
                    logger.error("Error in bot loop %s: %s", bot.name, e)
                    await asyncio.sleep(60)

        except asyncio.CancelledError:
            logger.info("Bot %s task cancelled", bot.name)
        except Exception as e:
            logger.error("Fatal error in bot %s: %s", bot.name, e)
            async with async_session() as db:
                db_bot = await db.get(Bot, bot.id)
                if db_bot:
                    db_bot.status = BotStatus.ERROR
                    await db.commit()

    async def _place_order(self, bot: Bot, side: str, quantity: float, price: float) -> None:
        """Place order and record trade."""
        try:
            if bot.account_mode.value == "live":
                self._ibkr.place_market_order(bot.symbol, quantity, side)
                logger.info("Live order: %s %s %s @ $%.2f", side, quantity, bot.symbol, price)
            else:
                logger.info("Paper order: %s %s %s @ $%.2f", side, quantity, bot.symbol, price)

            async with async_session() as db:
                db.add(
                    Trade(
                        bot_id=bot.id,
                        symbol=bot.symbol,
                        side=side,
                        quantity=quantity,
                        price=price,
                    )
                )
                await db.commit()

        except Exception as e:
            logger.error("Order placement failed for bot %s: %s", bot.name, e)

    def _calc_quantity(self, bot: Bot, price: float, config: StrategyConfig, latest_row) -> float:
        if price <= 0:
            return 0
        sizing = config.position_sizing
        if sizing.method == "percent_equity":
            return (bot.max_position_size * (sizing.value / 100)) / price
        elif sizing.method == "fixed_quantity":
            return sizing.value
        else:
            return (bot.max_position_size * (sizing.value / 100)) / price

    @staticmethod
    def _timeframe_to_seconds(tf: str) -> int:
        mapping = {
            "1m": 60,
            "5m": 300,
            "15m": 900,
            "30m": 1800,
            "1h": 3600,
            "4h": 14400,
            "1d": 86400,
        }
        return mapping.get(tf, 86400)


manager = BotRuntimeManager()
