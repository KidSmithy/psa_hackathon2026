"""
Langfuse tracing hookup for the agent graph.

Reads LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY / LANGFUSE_BASE_URL from the
environment automatically (loaded by agent/__init__.py). If those are unset,
CallbackHandler() still constructs but tracing calls will fail silently on
the Langfuse side rather than crash the graph.
"""

from langfuse.langchain import CallbackHandler


def get_langfuse_handler() -> CallbackHandler:
    return CallbackHandler()
