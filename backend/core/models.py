import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Float, Integer, Boolean, DateTime, Text, JSON, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum
from .database import Base


class BotStatus(str, enum.Enum):
    RUNNING = "running"
    STOPPED = "stopped"
    OPTIMIZING = "optimizing"
    BACKTESTING = "backtesting"
    ERROR = "error"


class AccountMode(str, enum.Enum):
    PAPER = "paper"
    LIVE = "live"


class OrderType(str, enum.Enum):
    MARKET = "market"
    LIMIT = "limit"
    MOC = "moc"


class Script(Base):
    """Registered strategy scripts."""

    __tablename__ = "scripts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    source_code: Mapped[str] = mapped_column(Text, nullable=False)
    params_spec: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Bot(Base):
    __tablename__ = "bots"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[BotStatus] = mapped_column(SAEnum(BotStatus), default=BotStatus.STOPPED)
    account_mode: Mapped[AccountMode] = mapped_column(SAEnum(AccountMode), default=AccountMode.PAPER)
    order_type: Mapped[OrderType] = mapped_column(SAEnum(OrderType), default=OrderType.MARKET)
    max_position_size: Mapped[float] = mapped_column(Float, default=5000.0)
    max_daily_loss: Mapped[float] = mapped_column(Float, default=200.0)

    # Script-based strategy — replaces strategy_config: JSON
    script_name: Mapped[str] = mapped_column(String(255), default="sma_crossover")
    script_params: Mapped[dict] = mapped_column(JSON, default=dict)

    schedule_cron: Mapped[str] = mapped_column(String(50), default="0 9 * * 1-5")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    trades = relationship("Trade", back_populates="bot", cascade="all, delete-orphan")
    backtest_results = relationship("BacktestResult", back_populates="bot", cascade="all, delete-orphan")
    optimizations = relationship("Optimization", back_populates="bot", cascade="all, delete-orphan")


class Trade(Base):
    __tablename__ = "trades"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    bot_id: Mapped[str] = mapped_column(String, ForeignKey("bots.id"), nullable=False)
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    side: Mapped[str] = mapped_column(String(10), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    pnl: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    bot = relationship("Bot", back_populates="trades")


class BacktestResult(Base):
    __tablename__ = "backtest_results"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    bot_id: Mapped[str] = mapped_column(String, ForeignKey("bots.id"), nullable=False)
    script_name: Mapped[str] = mapped_column(String(255), default="")
    script_params: Mapped[dict] = mapped_column(JSON, default=dict)

    # New metrics matching user spec
    total_pnl: Mapped[Optional[float]] = mapped_column(Float)
    max_drawdown: Mapped[Optional[float]] = mapped_column(Float)
    profitable_trades: Mapped[Optional[int]] = mapped_column(Integer)
    total_trades: Mapped[Optional[int]] = mapped_column(Integer)
    profit_factor: Mapped[Optional[float]] = mapped_column(Float)
    sharpe_ratio: Mapped[Optional[float]] = mapped_column(Float)
    equity_curve: Mapped[Optional[dict]] = mapped_column(JSON)
    start_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    end_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    bot = relationship("Bot", back_populates="backtest_results")


class Optimization(Base):
    __tablename__ = "optimizations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    bot_id: Mapped[str] = mapped_column(String, ForeignKey("bots.id"), nullable=False)
    script_name: Mapped[str] = mapped_column(String(255), default="")
    total_trials: Mapped[Optional[int]] = mapped_column(Integer)
    best_params: Mapped[Optional[dict]] = mapped_column(JSON)
    best_total_pnl: Mapped[Optional[float]] = mapped_column(Float)
    best_max_drawdown: Mapped[Optional[float]] = mapped_column(Float)
    best_profitable_trades: Mapped[Optional[int]] = mapped_column(Integer)
    best_profit_factor: Mapped[Optional[float]] = mapped_column(Float)
    results: Mapped[Optional[dict]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    bot = relationship("Bot", back_populates="optimizations")
