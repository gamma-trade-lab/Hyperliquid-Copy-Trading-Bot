class SwapError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "SwapError";
    this.code = code;
  }
}

class InsufficientFundsError extends SwapError {
  constructor(message) {
    super(message, "INSUFFICIENT_FUNDS");
  }
}

class SimulationError extends SwapError {
  constructor(message) {
    super(message, "SIMULATION_FAILED");
  }
}

module.exports = {
  SwapError,
  InsufficientFundsError,
  SimulationError,
};
