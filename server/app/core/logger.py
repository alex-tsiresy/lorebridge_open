import logging
import os
from logging.handlers import RotatingFileHandler
try:
    from pythonjsonlogger import jsonlogger  # type: ignore
    _JSON_LOGGER_AVAILABLE = True
except Exception:
    jsonlogger = None  # type: ignore
    _JSON_LOGGER_AVAILABLE = False

# Ensure log directory exists
log_dir = os.path.join(os.path.dirname(__file__), "../../logs")
os.makedirs(log_dir, exist_ok=True)
log_file = os.path.join(log_dir, "llm-backbone.log")

logger_name = os.path.splitext(os.path.basename(log_file))[0]
logger = logging.getLogger(logger_name)

# Set log level from environment variable
log_level = os.getenv("LOG_LEVEL", "INFO").upper()
logger.setLevel(getattr(logging, log_level, logging.INFO))

# Console handler (JSON to stdout for Promtail/Loki)
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
if _JSON_LOGGER_AVAILABLE and jsonlogger:
    console_formatter = jsonlogger.JsonFormatter(
        "%(asctime)s %(levelname)s %(name)s %(message)s"
    )
else:
    console_formatter = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
    )
console_handler.setFormatter(console_formatter)

# Rotating file handler
file_handler = RotatingFileHandler(log_file, maxBytes=10 * 1024 * 1024, backupCount=5)
file_handler.setLevel(logging.DEBUG)
file_formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
file_handler.setFormatter(file_formatter)

# Add handlers if not already present
if not logger.hasHandlers():
    logger.addHandler(console_handler)
    logger.addHandler(file_handler)
else:
    # Avoid duplicate handlers in reloads
    handler_types = {type(h) for h in logger.handlers}
    if logging.StreamHandler not in handler_types:
        logger.addHandler(console_handler)
    if RotatingFileHandler not in handler_types:
        logger.addHandler(file_handler)
