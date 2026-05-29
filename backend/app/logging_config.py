"""
logging_config.py — structlog setup for the SwingBy backend.

Call configure_logging() once at process start (top of main.py, before the
FastAPI app is created).  Every module that needs a logger should call
structlog.get_logger() — no additional configuration required.

Correlation fields (request_id, user_id) are injected per-request via
structlog.contextvars; the RequestIDMiddleware binds request_id automatically.
"""

import logging
import os
import sys

import structlog


def configure_logging() -> structlog.BoundLogger:
    """
    Configure structlog + stdlib logging and return the root application logger.

    Environment variables
    ---------------------
    LOG_LEVEL   : DEBUG | INFO | WARNING | ERROR  (default: INFO)
    LOG_FORMAT  : json | console                  (default: json)
    """
    log_level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    log_level = getattr(logging, log_level_name, logging.INFO)

    log_format = os.getenv("LOG_FORMAT", "json").lower()
    use_json = log_format != "console"

    # Shared processors applied to every log record regardless of renderer
    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
    ]

    if use_json:
        renderer = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer(colors=True)

    structlog.configure(
        processors=shared_processors
        + [
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        processor=renderer,
        foreign_pre_chain=shared_processors,
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(log_level)

    # Suppress noisy third-party loggers
    for noisy in ("uvicorn.access", "httpx", "httpcore"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    return structlog.get_logger("swingby")
