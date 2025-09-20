from openai import OpenAI, AsyncOpenAI

from app.core.config import settings

from .base import LLMProvider


class OpenAIProvider(LLMProvider):
    def __init__(self):
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        self.async_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    def chat(
        self,
        input=None,
        text=None,
        reasoning=None,
        tools=None,
        model=None,
        temperature=1,
        max_output_tokens=2048,
        top_p=1,
        store=True,
        **kwargs,
    ):
        model = model or "gpt-4.1"
        input = input or []
        text = text or {"format": {"type": "text"}}
        reasoning = reasoning or {}
        tools = tools or []
        response = self.client.responses.create(
            model=model,
            input=input,
            text=text,
            reasoning=reasoning,
            tools=tools,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
            top_p=top_p,
            store=store,
            parallel_tool_calls=True,
            **kwargs,
        )
        return response

    def embed(self, input, model=None, **kwargs):
        model = model or "text-embedding-ada-002"
        response = self.client.embeddings.create(model=model, input=input, **kwargs)
        return response

    async def aembed(self, input, model=None, **kwargs):
        """Async version of embed method"""
        model = model or "text-embedding-ada-002"
        response = await self.async_client.embeddings.create(model=model, input=input, **kwargs)
        return response

    async def achat_completions(self, messages, model=None, **kwargs):
        """Async version of chat completions"""
        model = model or "gpt-4o"
        response = await self.async_client.chat.completions.create(
            model=model, 
            messages=messages, 
            **kwargs
        )
        return response

    def chat_stream(
        self,
        input=None,
        text=None,
        reasoning=None,
        tools=None,
        model=None,
        temperature=1,
        max_output_tokens=2048,
        top_p=1,
        store=True,
        **kwargs,
    ):
        model = model or "gpt-4.1"
        input = input or []
        text = text or {"format": {"type": "text"}}
        reasoning = reasoning or {}
        tools = tools or []
        stream = self.client.responses.create(
            model=model,
            input=input,
            text=text,
            reasoning=reasoning,
            tools=tools,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
            top_p=top_p,
            store=store,
            stream=True,
            parallel_tool_calls=True,
            **kwargs,
        )
        yield from stream
