from ib_insync import IB, Stock, MarketOrder, LimitOrder
from ..core.config import get_settings


class IBKRConnector:
    def __init__(self):
        self.ib = IB()
        self.settings = get_settings()
        self._connected = False

    def connect(self):
        if not self._connected:
            self.ib.connect(
                host=self.settings.ibkr_host,
                port=self.settings.ibkr_port,
                clientId=1,
            )
            self._connected = True

    def disconnect(self):
        if self._connected:
            self.ib.disconnect()
            self._connected = False

    def place_market_order(self, symbol: str, quantity: float, side: str):
        self.connect()
        contract = Stock(symbol, "SMART", "USD")
        order = MarketOrder(side.upper(), quantity)
        trade = self.ib.placeOrder(contract, order)
        return trade

    def get_positions(self):
        self.connect()
        return self.ib.positions()

    def get_account_summary(self):
        self.connect()
        return self.ib.accountSummary()
