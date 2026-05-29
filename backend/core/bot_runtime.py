"""
In-memory bot runtime manager.
Runs each deployed bot by executing strategy scripts and placing trades.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from .database import async_session
from .models import Bot, BotStatus, Trade
from .datafeed import fetch_historical_data
from .ibkr import IBKRConnector
from ..scripts.base import get_script
from ..scripts.runner import run_backtest
from ..api.ws import manager as ws_manager

logger = logging.getLogger(__name__)


class BotRuntimeManager:
    """Manages in-memory asyncio tasks for running bots via strategy scripts."""

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
        """Background loop: fetch data -> run strategy script -> check signals -> place trades."""
        try:
            spec = get_script(bot.script_name)
            if spec is None:
                logger.error("Bot %s: script '%s' not found", bot.name, bot.script_name)
                return

            while True:
                try:
                    sleep_seconds = 86400  # default: once per day

                    # Fetch latest data
                    end = datetime.utcnow().strftime("%Y-%m-%d")
                    start = (datetime.utcnow() - timedelta(days=365)).strftime("%Y-%m-%d")
                    df = fetch_historical_data(bot.symbol, start, end)

                    last_price = 0.0
                    if df is not None and not df.empty:
                        # Run the script
                        result = spec.run_func(df, bot.script_params or {})
                        entries = result.get("entries")
                        exits = result.get("exits")

                        if entries is not None and exits is not None:
                            # Check latest signal
                            latest_entry = entries.iloc[-1] if not entries.empty else False
                            latest_exit = exits.iloc[-1] if not exits.empty else False
                            last_price = float(df["close"].iloc[-1])

                            if latest_entry:
                                # Entry signal
                                quantity = self._calc_quantity(bot, last_price)
                                if quantity > 0:
                                    side = "BUY"
                                    await self._place_order(bot, side, quantity, last_price)
                                    signal = "buy"
                                else:
                                    signal = None
                            elif latest_exit:
                                # Exit signal
                                quantity = self._calc_quantity(bot, last_price)
                                if quantity > 0:
                                    side = "SELL"
                                    await self._place_order(bot, side, quantity, last_price)
                                    signal = "sell"
                                else:
                                    signal = None
                            else:
                                signal = None
                        else:
                            signal = None

                        # Broadcast via WebSocket
                        await ws_manager.broadcast(
                            {
                                "type": "bot_update",
                                "bot_id": bot.id,
                                "status": "running",
                                "signal": signal,
                                "price": last_price,
                                "timestamp": str(datetime.utcnow()),
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

    def _calc_quantity(self, bot: Bot, price: float) -> float:
        if price <= 0:
            return 0
        return bot.max_position_size / price

    @staticmethod
    def _timeframe_to_seconds(tf: str) -> int:
        mapping = {"1m": 60, "5m": 300, "15m": 900, "30m": 1800, "1h": 3600, "4h": 14400, "1d": 86400}
        return mapping.get(tf, 86400)


manager = BotRuntimeManager()
