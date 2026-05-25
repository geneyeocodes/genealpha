import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, Text, JSON, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
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


class Bot(Base):
    __tablename__ = "bots"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    symbol = Column(String(20), nullable=False)
    status = Column(SAEnum(BotStatus), default=BotStatus.STOPPED)
    account_mode = Column(SAEnum(AccountMode), default=AccountMode.PAPER)
    order_type = Column(SAEnum(OrderType), default=OrderType.MARKET)
    max_position_size = Column(Float, default=5000.0)
    max_daily_loss = Column(Float, default=200.0)
    # Replaced strategy_name + strategy_params with a single strategy_config JSON
    strategy_config = Column(JSON, nullable=False, default=dict)
    schedule_cron = Column(String(50), default="0 9 * * 1-5")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    trades = relationship("Trade", back_populates="bot", cascade="all, delete-orphan")
    backtest_results = relationship("BacktestResult", back_populates="bot", cascade="all, delete-orphan")
    optimizations = relationship("Optimization", back_populates="bot", cascade="all, delete-orphan")


class Trade(Base):
    __tablename__ = "trades"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    bot_id = Column(String, ForeignKey("bots.id"), nullable=False)
    symbol = Column(String(20), nullable=False)
    side = Column(String(10), nullable=False)
    quantity = Column(Float, nullable=False)
    price = Column(Float, nullable=False)
    pnl = Column(Float, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    bot = relationship("Bot", back_populates="trades")


class BacktestResult(Base):
    __tablename__ = "backtest_results"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    bot_id = Column(String, ForeignKey("bots.id"), nullable=False)
    total_return = Column(Float)
    sharpe_ratio = Column(Float)
    max_drawdown = Column(Float)
    win_rate = Column(Float)
    total_trades = Column(Integer)
    avg_hold_days = Column(Float)
    profit_factor = Column(Float)
    equity_curve = Column(JSON)
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    bot = relationship("Bot", back_populates="backtest_results")


class Optimization(Base):
    __tablename__ = "optimizations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    bot_id = Column(String, ForeignKey("bots.id"), nullable=False)
    total_trials = Column(Integer)
    best_params = Column(JSON)
    best_sharpe = Column(Float)
    best_return = Column(Float)
    best_drawdown = Column(Float)
    results = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)

    bot = relationship("Bot", back_populates="optimizations")
